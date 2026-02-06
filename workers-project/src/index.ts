/**
 * Kuba Tools - Cloudflare Worker
 *
 * Main entry point for tools.kubagroup.com
 * Handles routing between:
 * - Landing page (/)
 * - Weekly feedback form (/weekly)
 * - Admin dashboard (/admin)
 * - API endpoints (/api/*)
 *
 * Static assets are served via the ASSETS binding
 */

import type { Env, ScheduledEvent } from './types';
import { getLandingPage } from './pages/landing';
import { handleHealthCheck, handlePing, handleHealthStats } from './routes/health';
import { handleAuthVerify } from './routes/auth';
import { handleGetPreviousSubmission, handleSubmitFeedback } from './routes/submissions';
import {
  handleGetWeeklyStatus,
  handleGetSubmissions,
  handleGetTeamMembers,
  handleCreateTeamMember,
  handleUpdateTeamMember,
  handleDeleteTeamMember,
  handleGetSettings,
  handleUpdateSettings,
  handleGetReports,
  handleGetReport,
  handleGenerateReport,
} from './routes/admin';
import { handleError, errorResponse, NotFoundError } from './middleware/error';
import { authenticate, requireAdmin } from './middleware/auth';
import { createLogger, generateRequestId, logRequest } from './utils/logger';

// Re-export Env type for wrangler
export type { Env };

// ============================================================================
// CORS Handling
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function corsResponse(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

function handleCorsPreFlight(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

// ============================================================================
// API Router
// ============================================================================

async function handleApiRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  path: string
): Promise<Response> {
  const requestId = generateRequestId();
  const logger = createLogger({
    requestId,
    path,
    method: request.method,
  });

  const startTime = Date.now();

  try {
    // Health endpoints (no auth required)
    if (path === '/api/health' && request.method === 'GET') {
      const response = await handleHealthCheck(request, env, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    if (path === '/api/ping' && request.method === 'GET') {
      const response = await handlePing(request, env, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    // Health stats (admin only)
    if (path === '/api/health/stats' && request.method === 'GET') {
      const auth = await authenticate(request, env, logger);
      requireAdmin(auth);
      const response = await handleHealthStats(request, env, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    // =========================================================================
    // Auth endpoints
    // =========================================================================

    if (path === '/api/auth/verify' && request.method === 'POST') {
      const response = await handleAuthVerify(request, env, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    // =========================================================================
    // Submission endpoints
    // =========================================================================

    if (path === '/api/submissions/previous' && request.method === 'GET') {
      const response = await handleGetPreviousSubmission(request, env, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    if (path === '/api/submissions' && request.method === 'POST') {
      const response = await handleSubmitFeedback(request, env, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    // =========================================================================
    // Admin endpoints
    // =========================================================================

    if (path === '/api/admin/status' && request.method === 'GET') {
      const response = await handleGetWeeklyStatus(request, env, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    if (path === '/api/admin/submissions' && request.method === 'GET') {
      const response = await handleGetSubmissions(request, env, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    if (path === '/api/admin/report' && request.method === 'POST') {
      const response = await handleGenerateReport(request, env, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    // Reports list and single report
    if (path === '/api/admin/reports' && request.method === 'GET') {
      const response = await handleGetReports(request, env, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    if (path.match(/^\/api\/admin\/reports\/\d+\/\d+$/) && request.method === 'GET') {
      const response = await handleGetReport(request, env, logger, path);
      logRequest(logger, request, response, startTime);
      return response;
    }

    // Team management
    if (path === '/api/admin/team' && request.method === 'GET') {
      const response = await handleGetTeamMembers(request, env, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    if (path === '/api/admin/team' && request.method === 'POST') {
      const response = await handleCreateTeamMember(request, env, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    if (path.match(/^\/api\/admin\/team\/[^/]+$/) && request.method === 'PUT') {
      const response = await handleUpdateTeamMember(request, env, logger, path);
      logRequest(logger, request, response, startTime);
      return response;
    }

    if (path.match(/^\/api\/admin\/team\/[^/]+$/) && request.method === 'DELETE') {
      const response = await handleDeleteTeamMember(request, env, logger, path);
      logRequest(logger, request, response, startTime);
      return response;
    }

    // Email endpoints (Phase 3)
    if (path === '/api/admin/email/chase' && request.method === 'POST') {
      return errorResponse({ code: 'NOT_IMPLEMENTED', message: 'Email endpoint coming in Phase 3' }, 501);
    }

    if (path === '/api/admin/email/bulk' && request.method === 'POST') {
      return errorResponse({ code: 'NOT_IMPLEMENTED', message: 'Email endpoint coming in Phase 3' }, 501);
    }

    // Settings endpoints
    if (path === '/api/admin/settings' && request.method === 'GET') {
      const response = await handleGetSettings(request, env, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    if (path === '/api/admin/settings' && request.method === 'PUT') {
      const response = await handleUpdateSettings(request, env, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    // =========================================================================
    // 404 for unknown API routes
    // =========================================================================

    throw new NotFoundError(`API endpoint not found: ${request.method} ${path}`);

  } catch (error) {
    const response = handleError(error, logger);
    logRequest(logger, request, response, startTime);
    return response;
  }
}

// ============================================================================
// Main Request Handler
// ============================================================================

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight for all requests
    if (request.method === 'OPTIONS') {
      return handleCorsPreFlight();
    }

    try {
      // =========================================================================
      // API Routes - handle before static assets
      // =========================================================================
      if (path.startsWith('/api/')) {
        const response = await handleApiRequest(request, env, ctx, path);
        return corsResponse(response);
      }

      // =========================================================================
      // Page Routes
      // =========================================================================

      // Route: Landing page
      if (path === '/' || path === '/index.html') {
        return getLandingPage();
      }

      // Route: Weekly report form - serve the static index.html
      if (path === '/weekly' || path === '/weekly/') {
        const assetUrl = new URL('/index.html', request.url);
        return env.ASSETS.fetch(new Request(assetUrl, request));
      }

      // Route: Admin dashboard - serve static admin.html
      if (path === '/admin' || path === '/admin/') {
        const assetUrl = new URL('/admin.html', request.url);
        return env.ASSETS.fetch(new Request(assetUrl, request));
      }

      // Route: Static assets for /weekly path (rewrite to root)
      if (path.startsWith('/weekly/')) {
        const filename = path.replace('/weekly/', '/');
        const assetUrl = new URL(filename, request.url);
        return env.ASSETS.fetch(new Request(assetUrl, request));
      }

      // =========================================================================
      // Static Assets - fallback
      // =========================================================================
      return env.ASSETS.fetch(request);

    } catch (error) {
      console.error('Error handling request:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  // ============================================================================
  // Scheduled Handler (Cron Triggers)
  // ============================================================================

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const logger = createLogger({
      requestId: `cron_${Date.now()}`,
      path: '/scheduled',
      method: 'CRON',
    });

    logger.info('Scheduled job triggered', {
      cron: event.cron,
      scheduledTime: new Date(event.scheduledTime).toISOString(),
    });

    try {
      // Wednesday 9am UTC - Weekly prompt
      if (event.cron === '0 9 * * 3') {
        // TODO: Implement in Phase 4
        logger.info('Wednesday prompt - not yet implemented');
      }

      // Thursday 5pm UTC - Reminder
      if (event.cron === '0 17 * * 4') {
        // TODO: Implement in Phase 4
        logger.info('Thursday reminder - not yet implemented');
      }

      logger.info('Scheduled job completed successfully');
    } catch (error) {
      logger.error('Scheduled job failed', error);
      // Re-throw to mark the scheduled execution as failed
      throw error;
    }
  },
};
