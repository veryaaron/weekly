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

import type { Env, ScheduledEvent, Logger } from './types';
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
import {
  handleListWorkspaces,
  handleGetWorkspace,
  handleUpdateWorkspace,
  handleGetWorkspaceTeam,
  handleCreateWorkspaceMember,
  handleUpdateWorkspaceMember,
  handleDeleteWorkspaceMember,
  handleGetWorkspaceStatus,
  handleGetWorkspaceSubmissions,
  handleGetWorkspacePreviousSubmission,
  handleSubmitWorkspaceFeedback,
  handleGetWorkspaceSettings,
  handleUpdateWorkspaceSettings,
  handleGetWorkspaceReports,
  handleGetWorkspaceReport,
  handleGenerateWorkspaceReport,
  handleSuperListWorkspaces,
  handleSuperGetSubmissions,
} from './routes/workspaces';
import { handleError, errorResponse, NotFoundError } from './middleware/error';
import { authenticate, requireAdmin } from './middleware/auth';
import { createLogger, generateRequestId, logRequest, logEmailOperation, logScheduledJob } from './utils/logger';
import { getAllTeamMembers, getTeamMemberByEmail, getWeeklyStatus, logEmail } from './services/database';
import { refreshAccessToken, sendEmail } from './services/gmail';
import { getPromptEmail, getReminderEmail } from './utils/email-templates';

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

    // Email endpoints
    if (path === '/api/admin/email/prompt' && request.method === 'POST') {
      const auth = await authenticate(request, env, logger);
      requireAdmin(auth);
      const response = await handleSendPromptEmails(env, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    if (path === '/api/admin/email/reminder' && request.method === 'POST') {
      const auth = await authenticate(request, env, logger);
      requireAdmin(auth);
      const response = await handleSendReminderEmails(env, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    // Send to a single member: POST /api/admin/email/send { email, type: 'prompt'|'reminder' }
    if (path === '/api/admin/email/send' && request.method === 'POST') {
      const auth = await authenticate(request, env, logger);
      requireAdmin(auth);
      const response = await handleSendSingleEmail(request, env, logger);
      logRequest(logger, request, response, startTime);
      return response;
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
    // Workspace endpoints (multi-tenant)
    // =========================================================================

    // List workspaces
    if (path === '/api/workspaces' && request.method === 'GET') {
      const response = await handleListWorkspaces(request, env, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    // Get specific workspace
    const workspaceMatch = path.match(/^\/api\/workspaces\/([^/]+)$/);
    if (workspaceMatch) {
      const workspaceId = workspaceMatch[1];
      if (request.method === 'GET') {
        const response = await handleGetWorkspace(request, env, logger, workspaceId);
        logRequest(logger, request, response, startTime);
        return response;
      }
      if (request.method === 'PUT') {
        const response = await handleUpdateWorkspace(request, env, logger, workspaceId);
        logRequest(logger, request, response, startTime);
        return response;
      }
    }

    // Workspace team management
    const teamMatch = path.match(/^\/api\/workspaces\/([^/]+)\/team$/);
    if (teamMatch) {
      const workspaceId = teamMatch[1];
      if (request.method === 'GET') {
        const response = await handleGetWorkspaceTeam(request, env, logger, workspaceId);
        logRequest(logger, request, response, startTime);
        return response;
      }
      if (request.method === 'POST') {
        const response = await handleCreateWorkspaceMember(request, env, logger, workspaceId);
        logRequest(logger, request, response, startTime);
        return response;
      }
    }

    // Workspace team member operations
    const teamMemberMatch = path.match(/^\/api\/workspaces\/([^/]+)\/team\/([^/]+)$/);
    if (teamMemberMatch) {
      const [, workspaceId, memberId] = teamMemberMatch;
      if (request.method === 'PUT') {
        const response = await handleUpdateWorkspaceMember(request, env, logger, workspaceId, memberId);
        logRequest(logger, request, response, startTime);
        return response;
      }
      if (request.method === 'DELETE') {
        const response = await handleDeleteWorkspaceMember(request, env, logger, workspaceId, memberId);
        logRequest(logger, request, response, startTime);
        return response;
      }
    }

    // Workspace status
    const statusMatch = path.match(/^\/api\/workspaces\/([^/]+)\/status$/);
    if (statusMatch && request.method === 'GET') {
      const workspaceId = statusMatch[1];
      const response = await handleGetWorkspaceStatus(request, env, logger, workspaceId);
      logRequest(logger, request, response, startTime);
      return response;
    }

    // Workspace submissions - previous week
    const prevSubmissionMatch = path.match(/^\/api\/workspaces\/([^/]+)\/submissions\/previous$/);
    if (prevSubmissionMatch && request.method === 'GET') {
      const workspaceId = prevSubmissionMatch[1];
      const response = await handleGetWorkspacePreviousSubmission(request, env, logger, workspaceId);
      logRequest(logger, request, response, startTime);
      return response;
    }

    // Workspace submissions
    const submissionsMatch = path.match(/^\/api\/workspaces\/([^/]+)\/submissions$/);
    if (submissionsMatch) {
      const workspaceId = submissionsMatch[1];
      if (request.method === 'GET') {
        const response = await handleGetWorkspaceSubmissions(request, env, logger, workspaceId);
        logRequest(logger, request, response, startTime);
        return response;
      }
      if (request.method === 'POST') {
        const response = await handleSubmitWorkspaceFeedback(request, env, logger, workspaceId);
        logRequest(logger, request, response, startTime);
        return response;
      }
    }

    // Workspace settings
    const settingsMatch = path.match(/^\/api\/workspaces\/([^/]+)\/settings$/);
    if (settingsMatch) {
      const workspaceId = settingsMatch[1];
      if (request.method === 'GET') {
        const response = await handleGetWorkspaceSettings(request, env, logger, workspaceId);
        logRequest(logger, request, response, startTime);
        return response;
      }
      if (request.method === 'PUT') {
        const response = await handleUpdateWorkspaceSettings(request, env, logger, workspaceId);
        logRequest(logger, request, response, startTime);
        return response;
      }
    }

    // Workspace reports list
    const reportsMatch = path.match(/^\/api\/workspaces\/([^/]+)\/reports$/);
    if (reportsMatch && request.method === 'GET') {
      const workspaceId = reportsMatch[1];
      const response = await handleGetWorkspaceReports(request, env, logger, workspaceId);
      logRequest(logger, request, response, startTime);
      return response;
    }

    // Workspace specific report
    const reportMatch = path.match(/^\/api\/workspaces\/([^/]+)\/reports\/(\d+)\/(\d+)$/);
    if (reportMatch && request.method === 'GET') {
      const [, workspaceId, week, year] = reportMatch;
      const response = await handleGetWorkspaceReport(
        request, env, logger, workspaceId, parseInt(week, 10), parseInt(year, 10)
      );
      logRequest(logger, request, response, startTime);
      return response;
    }

    // Generate workspace report
    const generateReportMatch = path.match(/^\/api\/workspaces\/([^/]+)\/report$/);
    if (generateReportMatch && request.method === 'POST') {
      const workspaceId = generateReportMatch[1];
      const response = await handleGenerateWorkspaceReport(request, env, logger, workspaceId);
      logRequest(logger, request, response, startTime);
      return response;
    }

    // =========================================================================
    // Super Admin endpoints
    // =========================================================================

    if (path === '/api/super/workspaces' && request.method === 'GET') {
      const response = await handleSuperListWorkspaces(request, env, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    if (path === '/api/super/submissions' && request.method === 'GET') {
      const response = await handleSuperGetSubmissions(request, env, logger);
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
// Manual Email Trigger Handlers
// ============================================================================

/**
 * Send weekly prompt emails to all active team members.
 * Used for manual testing / resending from the admin dashboard.
 */
async function handleSendPromptEmails(env: Env, logger: Logger): Promise<Response> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REFRESH_TOKEN) {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'CONFIG_ERROR', message: 'Gmail API secrets not configured' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const accessToken = await refreshAccessToken(
    env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REFRESH_TOKEN, logger
  );

  const formUrl = env.FORM_URL || 'https://tools.kubagroup.com/weekly';
  const members = await getAllTeamMembers(env.DB);
  let sentCount = 0;
  let failedCount = 0;

  for (const member of members) {
    const firstName = member.first_name || member.name.split(' ')[0];
    const template = getPromptEmail(firstName, formUrl);
    const result = await sendEmail(accessToken, member.email, template.subject, template.body, logger);

    logEmailOperation(logger, 'prompt', member.email, result.success, result.messageId, result.error);

    await logEmail(env.DB, {
      recipientEmail: member.email,
      recipientName: member.name,
      emailType: 'prompt',
      subject: template.subject,
      bodyPreview: template.body.substring(0, 100),
      status: result.success ? 'sent' : 'failed',
      resendId: result.messageId,
      errorMessage: result.error,
    });

    if (result.success) sentCount++;
    else failedCount++;
  }

  return new Response(
    JSON.stringify({ success: true, data: { sent: sentCount, failed: failedCount, total: members.length } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Send reminder emails to team members who haven't submitted this week.
 * Used for manual testing / resending from the admin dashboard.
 */
async function handleSendReminderEmails(env: Env, logger: Logger): Promise<Response> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REFRESH_TOKEN) {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'CONFIG_ERROR', message: 'Gmail API secrets not configured' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const accessToken = await refreshAccessToken(
    env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REFRESH_TOKEN, logger
  );

  const formUrl = env.FORM_URL || 'https://tools.kubagroup.com/weekly';
  const status = await getWeeklyStatus(env.DB);
  const pending = status.members.filter((m) => !m.hasSubmitted);

  if (pending.length === 0) {
    return new Response(
      JSON.stringify({ success: true, data: { sent: 0, failed: 0, total: 0, message: 'Everyone has already submitted' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let sentCount = 0;
  let failedCount = 0;

  for (const member of pending) {
    const firstName = member.firstName || member.name.split(' ')[0];
    const template = getReminderEmail(firstName, formUrl);
    const result = await sendEmail(accessToken, member.email, template.subject, template.body, logger);

    logEmailOperation(logger, 'reminder', member.email, result.success, result.messageId, result.error);

    await logEmail(env.DB, {
      recipientEmail: member.email,
      recipientName: member.name,
      emailType: 'reminder',
      subject: template.subject,
      bodyPreview: template.body.substring(0, 100),
      status: result.success ? 'sent' : 'failed',
      resendId: result.messageId,
      errorMessage: result.error,
    });

    if (result.success) sentCount++;
    else failedCount++;
  }

  return new Response(
    JSON.stringify({ success: true, data: { sent: sentCount, failed: failedCount, total: pending.length } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Send a single email (prompt or reminder) to one team member.
 * Body: { email: string, type: 'prompt' | 'reminder' }
 */
async function handleSendSingleEmail(request: Request, env: Env, logger: Logger): Promise<Response> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REFRESH_TOKEN) {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'CONFIG_ERROR', message: 'Gmail API secrets not configured' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body = (await request.json()) as { email?: string; type?: string };
  const email = body.email;
  const emailType = body.type;

  if (!email || !emailType || (emailType !== 'prompt' && emailType !== 'reminder')) {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'BAD_REQUEST', message: 'Required: email (string), type ("prompt" or "reminder")' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Look up member to get their name
  const member = await getTeamMemberByEmail(env.DB, email);
  const memberName = member?.name || email.split('@')[0];
  const firstName = member?.first_name || memberName.split(' ')[0];

  const accessToken = await refreshAccessToken(
    env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REFRESH_TOKEN, logger
  );

  const formUrl = env.FORM_URL || 'https://tools.kubagroup.com/weekly';
  const template = emailType === 'prompt'
    ? getPromptEmail(firstName, formUrl)
    : getReminderEmail(firstName, formUrl);

  const result = await sendEmail(accessToken, email, template.subject, template.body, logger);

  logEmailOperation(logger, emailType, email, result.success, result.messageId, result.error);

  await logEmail(env.DB, {
    recipientEmail: email,
    recipientName: memberName,
    emailType: emailType,
    subject: template.subject,
    bodyPreview: template.body.substring(0, 100),
    status: result.success ? 'sent' : 'failed',
    resendId: result.messageId,
    errorMessage: result.error,
  });

  if (!result.success) {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'SEND_FAILED', message: result.error } }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, data: { email, type: emailType, messageId: result.messageId } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
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
      // Validate Gmail secrets are configured
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REFRESH_TOKEN) {
        logger.error('Gmail secrets not configured — skipping email send', undefined, {
          hasClientId: !!env.GOOGLE_CLIENT_ID,
          hasClientSecret: !!env.GOOGLE_CLIENT_SECRET,
          hasRefreshToken: !!env.GOOGLE_REFRESH_TOKEN,
        });
        throw new Error('Gmail API secrets not configured. Set GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN.');
      }

      // Refresh access token once for the entire batch
      const accessToken = await refreshAccessToken(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        env.GOOGLE_REFRESH_TOKEN,
        logger
      );

      const formUrl = env.FORM_URL || 'https://tools.kubagroup.com/weekly';

      // =====================================================================
      // Wednesday 9am UTC — Weekly prompt to all active team members
      // =====================================================================
      if (event.cron === '0 9 * * 3') {
        logger.info('Running Wednesday weekly prompt job');

        const members = await getAllTeamMembers(env.DB);
        let sentCount = 0;
        let failedCount = 0;

        for (const member of members) {
          const firstName = member.first_name || member.name.split(' ')[0];
          const template = getPromptEmail(firstName, formUrl);
          const result = await sendEmail(accessToken, member.email, template.subject, template.body, logger);

          logEmailOperation(logger, 'prompt', member.email, result.success, result.messageId, result.error);

          await logEmail(env.DB, {
            recipientEmail: member.email,
            recipientName: member.name,
            emailType: 'prompt',
            subject: template.subject,
            bodyPreview: template.body.substring(0, 100),
            status: result.success ? 'sent' : 'failed',
            resendId: result.messageId,
            errorMessage: result.error,
          });

          if (result.success) sentCount++;
          else failedCount++;
        }

        logScheduledJob(logger, 'weekly_prompt', event.cron, true, {
          total_members: members.length,
          sent: sentCount,
          failed: failedCount,
        });
      }

      // =====================================================================
      // Thursday 5pm UTC — Reminder to members who haven't submitted
      // =====================================================================
      if (event.cron === '0 17 * * 4') {
        logger.info('Running Thursday reminder job');

        const status = await getWeeklyStatus(env.DB);
        const pending = status.members.filter((m) => !m.hasSubmitted);

        if (pending.length === 0) {
          logger.info('All team members have submitted — no reminders needed', {
            weekNumber: status.weekNumber,
            year: status.year,
            totalMembers: status.totalMembers,
          });
        } else {
          let sentCount = 0;
          let failedCount = 0;

          for (const member of pending) {
            const firstName = member.firstName || member.name.split(' ')[0];
            const template = getReminderEmail(firstName, formUrl);
            const result = await sendEmail(accessToken, member.email, template.subject, template.body, logger);

            logEmailOperation(logger, 'reminder', member.email, result.success, result.messageId, result.error);

            await logEmail(env.DB, {
              recipientEmail: member.email,
              recipientName: member.name,
              emailType: 'reminder',
              subject: template.subject,
              bodyPreview: template.body.substring(0, 100),
              status: result.success ? 'sent' : 'failed',
              resendId: result.messageId,
              errorMessage: result.error,
            });

            if (result.success) sentCount++;
            else failedCount++;
          }

          logScheduledJob(logger, 'weekly_reminder', event.cron, true, {
            weekNumber: status.weekNumber,
            year: status.year,
            pending_count: pending.length,
            sent: sentCount,
            failed: failedCount,
          });
        }
      }

      logger.info('Scheduled job completed successfully');
    } catch (error) {
      logger.error('Scheduled job failed', error);
      // Re-throw to mark the scheduled execution as failed
      throw error;
    }
  },
};
