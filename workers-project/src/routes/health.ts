/**
 * Health Check Route
 *
 * Provides health and status information about the API
 */

import type { Env, Logger } from '../types';
import { jsonResponse, InternalError } from '../middleware/error';
import { getCurrentWeekInfo } from '../utils/week';

// ============================================================================
// Types
// ============================================================================

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  environment: string;
  version: string;
  checks: {
    database: CheckResult;
  };
  info: {
    currentWeek: number;
    currentYear: number;
  };
}

interface CheckResult {
  status: 'pass' | 'fail';
  latency_ms?: number;
  error?: string;
}

// ============================================================================
// Health Check Handler
// ============================================================================

/**
 * Handle GET /api/health
 */
export async function handleHealthCheck(
  request: Request,
  env: Env,
  logger: Logger
): Promise<Response> {
  const startTime = Date.now();
  const checks: { database: CheckResult } = {
    database: { status: 'fail' },
  };

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Check D1 database
  try {
    const dbStart = Date.now();
    const result = await env.DB.prepare('SELECT 1 as ok').first<{ ok: number }>();
    const dbLatency = Date.now() - dbStart;

    if (result?.ok === 1) {
      checks.database = { status: 'pass', latency_ms: dbLatency };
    } else {
      checks.database = { status: 'fail', error: 'Unexpected response from database' };
      overallStatus = 'unhealthy';
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    checks.database = { status: 'fail', error: errorMessage };
    overallStatus = 'unhealthy';
    logger.error('Database health check failed', error);
  }

  // Get current week info
  const weekInfo = getCurrentWeekInfo();

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    environment: env.ENVIRONMENT || 'development',
    version: '2.0.0', // Updated for D1 migration
    checks,
    info: {
      currentWeek: weekInfo.weekNumber,
      currentYear: weekInfo.year,
    },
  };

  logger.info('Health check completed', {
    status: overallStatus,
    latency_ms: Date.now() - startTime,
    database_status: checks.database.status,
  });

  // Return 200 even for degraded, 503 for unhealthy
  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;
  return jsonResponse(response, statusCode);
}

// ============================================================================
// Simple Ping Handler
// ============================================================================

/**
 * Handle GET /api/ping - Simple ping endpoint
 */
export async function handlePing(
  request: Request,
  env: Env,
  logger: Logger
): Promise<Response> {
  return jsonResponse({ pong: true, timestamp: new Date().toISOString() });
}

// ============================================================================
// Database Stats (Admin only)
// ============================================================================

interface DatabaseStats {
  teamMembers: {
    total: number;
    active: number;
    inactive: number;
  };
  submissions: {
    total: number;
    thisWeek: number;
  };
  reports: {
    total: number;
  };
  emailLogs: {
    total: number;
    last24h: number;
  };
}

/**
 * Handle GET /api/health/stats - Detailed database stats (admin only)
 */
export async function handleHealthStats(
  request: Request,
  env: Env,
  logger: Logger
): Promise<Response> {
  const weekInfo = getCurrentWeekInfo();

  try {
    // Run all queries in parallel for better performance
    const [
      teamMembersTotal,
      teamMembersActive,
      submissionsTotal,
      submissionsThisWeek,
      reportsTotal,
      emailLogsTotal,
      emailLogs24h,
    ] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as count FROM team_members').first<{ count: number }>(),
      env.DB.prepare('SELECT COUNT(*) as count FROM team_members WHERE active = 1').first<{ count: number }>(),
      env.DB.prepare('SELECT COUNT(*) as count FROM submissions').first<{ count: number }>(),
      env.DB.prepare(
        'SELECT COUNT(*) as count FROM submissions WHERE week_number = ? AND year = ?'
      )
        .bind(weekInfo.weekNumber, weekInfo.year)
        .first<{ count: number }>(),
      env.DB.prepare('SELECT COUNT(*) as count FROM reports').first<{ count: number }>(),
      env.DB.prepare('SELECT COUNT(*) as count FROM email_logs').first<{ count: number }>(),
      env.DB.prepare(
        'SELECT COUNT(*) as count FROM email_logs WHERE sent_at > datetime("now", "-1 day")'
      ).first<{ count: number }>(),
    ]);

    const stats: DatabaseStats = {
      teamMembers: {
        total: teamMembersTotal?.count || 0,
        active: teamMembersActive?.count || 0,
        inactive: (teamMembersTotal?.count || 0) - (teamMembersActive?.count || 0),
      },
      submissions: {
        total: submissionsTotal?.count || 0,
        thisWeek: submissionsThisWeek?.count || 0,
      },
      reports: {
        total: reportsTotal?.count || 0,
      },
      emailLogs: {
        total: emailLogsTotal?.count || 0,
        last24h: emailLogs24h?.count || 0,
      },
    };

    logger.info('Health stats retrieved', {
      teamMembers: stats.teamMembers.total,
      activeMembers: stats.teamMembers.active,
      submissions: stats.submissions.total,
      submissionsThisWeek: stats.submissions.thisWeek,
    });

    return jsonResponse({
      ...stats,
      currentWeek: weekInfo.weekNumber,
      currentYear: weekInfo.year,
    });
  } catch (error) {
    logger.error('Failed to retrieve health stats', error);
    throw new InternalError('Failed to retrieve database statistics');
  }
}
