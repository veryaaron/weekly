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

import type { Env, ScheduledEvent, Logger, ResolvedSecrets } from './types';
import { resolveSecrets } from './types';
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
import { refreshAccessToken, sendEmail, getServiceAccountAccessToken, validateServiceAccountKey } from './services/gmail';
import { getPromptEmail, getReminderEmail } from './utils/email-templates';

// ============================================================================
// Dual-Mode Email Auth Helper
// ============================================================================

/**
 * Get an email access token using the best available method:
 * 1. Service account with domain-wide delegation (preferred)
 * 2. Legacy OAuth2 refresh token (fallback)
 *
 * Accepts resolved secret strings (from resolveSecrets), NOT raw env bindings.
 */
async function getEmailAccessToken(
  secrets: ResolvedSecrets,
  googleClientId: string | undefined,
  superAdminEmails: string | undefined,
  managerEmail: string | undefined,
  logger: Logger
): Promise<string> {
  // Try service account first
  if (secrets.googleServiceAccountKey) {
    const impersonateEmail = managerEmail || superAdminEmails?.split(',')[0]?.trim();
    if (!impersonateEmail) {
      throw new Error('Service account requires a manager email to impersonate, but none was provided and SUPER_ADMIN_EMAILS is not set');
    }
    logger.info('Using service account for email auth', { managerEmail: impersonateEmail });
    return getServiceAccountAccessToken(secrets.googleServiceAccountKey, impersonateEmail, logger);
  }

  // Fall back to OAuth
  if (!googleClientId || !secrets.googleClientSecret || !secrets.googleRefreshToken) {
    throw new Error('No email auth configured. Set GOOGLE_SERVICE_ACCOUNT_KEY (preferred) or OAuth secrets (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN).');
  }

  logger.info('Using legacy OAuth for email auth');
  return refreshAccessToken(googleClientId, secrets.googleClientSecret, secrets.googleRefreshToken, logger);
}

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

  // Resolve all Secrets Store bindings once per request
  const secrets = await resolveSecrets(env);

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
      const response = await handleSendPromptEmails(env, secrets, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    if (path === '/api/admin/email/reminder' && request.method === 'POST') {
      const auth = await authenticate(request, env, logger);
      requireAdmin(auth);
      const response = await handleSendReminderEmails(env, secrets, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    // Send to a single member: POST /api/admin/email/send { email, type: 'prompt'|'reminder' }
    if (path === '/api/admin/email/send' && request.method === 'POST') {
      const auth = await authenticate(request, env, logger);
      requireAdmin(auth);
      const response = await handleSendSingleEmail(request, env, secrets, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    // Email test & validation endpoints
    if (path === '/api/admin/email/test-config' && request.method === 'POST') {
      const auth = await authenticate(request, env, logger);
      requireAdmin(auth);
      const response = await handleTestEmailConfig(env, secrets, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    if (path === '/api/admin/email/test-token' && request.method === 'POST') {
      const auth = await authenticate(request, env, logger);
      requireAdmin(auth);
      const response = await handleTestEmailToken(request, env, secrets, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    if (path === '/api/admin/email/test-send' && request.method === 'POST') {
      const auth = await authenticate(request, env, logger);
      requireAdmin(auth);
      const response = await handleTestEmailSend(request, env, secrets, logger);
      logRequest(logger, request, response, startTime);
      return response;
    }

    if (path === '/api/admin/email/test-preview' && request.method === 'POST') {
      const auth = await authenticate(request, env, logger);
      requireAdmin(auth);
      const response = await handleTestEmailPreview(request, env, logger);
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
      const response = await handleGenerateWorkspaceReport(request, env, secrets, logger, workspaceId);
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
 * Uses service account if available, falls back to OAuth.
 */
async function handleSendPromptEmails(env: Env, secrets: ResolvedSecrets, logger: Logger): Promise<Response> {
  let accessToken: string;
  try {
    accessToken = await getEmailAccessToken(secrets, env.GOOGLE_CLIENT_ID, env.SUPER_ADMIN_EMAILS, undefined, logger);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Email auth failed in prompt handler', error instanceof Error ? error : undefined);
    return new Response(
      JSON.stringify({ success: false, error: { code: 'AUTH_ERROR', message } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

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
 * Uses service account if available, falls back to OAuth.
 */
async function handleSendReminderEmails(env: Env, secrets: ResolvedSecrets, logger: Logger): Promise<Response> {
  let accessToken: string;
  try {
    accessToken = await getEmailAccessToken(secrets, env.GOOGLE_CLIENT_ID, env.SUPER_ADMIN_EMAILS, undefined, logger);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Email auth failed in reminder handler', error instanceof Error ? error : undefined);
    return new Response(
      JSON.stringify({ success: false, error: { code: 'AUTH_ERROR', message } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

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
async function handleSendSingleEmail(request: Request, env: Env, secrets: ResolvedSecrets, logger: Logger): Promise<Response> {
  let body: { email?: string; type?: string };
  try {
    body = (await request.json()) as { email?: string; type?: string };
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

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

  let accessToken: string;
  try {
    accessToken = await getEmailAccessToken(secrets, env.GOOGLE_CLIENT_ID, env.SUPER_ADMIN_EMAILS, undefined, logger);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Email auth failed in send handler', error instanceof Error ? error : undefined);
    return new Response(
      JSON.stringify({ success: false, error: { code: 'AUTH_ERROR', message } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

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
// Email Test & Validation Handlers
// ============================================================================

/**
 * Validate the service account key configuration.
 * POST /api/admin/email/test-config
 */
async function handleTestEmailConfig(env: Env, secrets: ResolvedSecrets, logger: Logger): Promise<Response> {
  const hasOAuthFallback = !!(env.GOOGLE_CLIENT_ID && secrets.googleClientSecret && secrets.googleRefreshToken);
  const result = await validateServiceAccountKey(secrets.googleServiceAccountKey, hasOAuthFallback, logger);

  return new Response(
    JSON.stringify({ success: true, data: result }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Test token exchange with Google (proves domain-wide delegation works).
 * POST /api/admin/email/test-token { managerEmail: string }
 */
async function handleTestEmailToken(request: Request, env: Env, secrets: ResolvedSecrets, logger: Logger): Promise<Response> {
  let body: { managerEmail?: string };
  try {
    body = (await request.json()) as { managerEmail?: string };
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const managerEmail = body.managerEmail;
  if (!managerEmail) {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'BAD_REQUEST', message: 'Required: managerEmail' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!secrets.googleServiceAccountKey) {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'CONFIG_ERROR', message: 'GOOGLE_SERVICE_ACCOUNT_KEY is not configured' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const startTime = Date.now();
    const accessToken = await getServiceAccountAccessToken(secrets.googleServiceAccountKey, managerEmail, logger);
    const elapsed = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          tokenObtained: true,
          managerEmail,
          tokenPreview: `${accessToken.substring(0, 20)}...`,
          elapsedMs: elapsed,
          message: `Successfully obtained access token for ${managerEmail}. Domain-wide delegation is working.`,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'TOKEN_EXCHANGE_FAILED',
          message,
          hint: message.includes('unauthorized_client')
            ? 'Domain-wide delegation may not be enabled yet. Check with IT that the service account client ID has been authorized in Google Workspace Admin Console.'
            : message.includes('invalid_grant')
            ? 'The manager email may not exist in your Google Workspace, or the service account key may be invalid.'
            : 'Check the error message for details. Common causes: delegation not enabled, wrong scope, invalid key.',
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Send a test email via service account or OAuth fallback.
 * POST /api/admin/email/test-send { managerEmail?, recipientEmail, templateType, firstName? }
 */
async function handleTestEmailSend(request: Request, env: Env, logger: Logger): Promise<Response> {
  let body: { managerEmail?: string; recipientEmail?: string; templateType?: string; firstName?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!body.recipientEmail || !body.templateType || (body.templateType !== 'prompt' && body.templateType !== 'reminder')) {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'BAD_REQUEST', message: 'Required: recipientEmail, templateType ("prompt" or "reminder")' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const firstName = body.firstName || body.recipientEmail.split('@')[0];
  const formUrl = env.FORM_URL || 'https://tools.kubagroup.com/weekly';
  const template = body.templateType === 'prompt'
    ? getPromptEmail(firstName, formUrl)
    : getReminderEmail(firstName, formUrl);

  let accessToken: string;
  let authMethod: string;
  try {
    if (body.managerEmail && env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      accessToken = await getServiceAccountAccessToken(env.GOOGLE_SERVICE_ACCOUNT_KEY, body.managerEmail, logger);
      authMethod = `service-account (as ${body.managerEmail})`;
    } else {
      accessToken = await getEmailAccessToken(env, body.managerEmail, logger);
      authMethod = env.GOOGLE_SERVICE_ACCOUNT_KEY ? 'service-account' : 'oauth-fallback';
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: { code: 'AUTH_ERROR', message } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const result = await sendEmail(accessToken, body.recipientEmail, template.subject, template.body, logger);

  // Log test email to DB
  await logEmail(env.DB, {
    recipientEmail: body.recipientEmail,
    recipientName: firstName,
    emailType: body.templateType as 'prompt' | 'reminder',
    subject: `[TEST] ${template.subject}`,
    bodyPreview: template.body.substring(0, 100),
    status: result.success ? 'sent' : 'failed',
    resendId: result.messageId,
    errorMessage: result.error,
  });

  if (!result.success) {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'SEND_FAILED', message: result.error, authMethod } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        messageId: result.messageId,
        recipient: body.recipientEmail,
        templateType: body.templateType,
        authMethod,
        message: `Test email sent successfully to ${body.recipientEmail}`,
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Preview an email template without sending.
 * POST /api/admin/email/test-preview { templateType, firstName?, managerName? }
 */
async function handleTestEmailPreview(request: Request, env: Env, logger: Logger): Promise<Response> {
  let body: { templateType?: string; firstName?: string; managerName?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!body.templateType || (body.templateType !== 'prompt' && body.templateType !== 'reminder')) {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'BAD_REQUEST', message: 'Required: templateType ("prompt" or "reminder")' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const firstName = body.firstName || 'Team Member';
  const formUrl = env.FORM_URL || 'https://tools.kubagroup.com/weekly';
  const template = body.templateType === 'prompt'
    ? getPromptEmail(firstName, formUrl, body.managerName)
    : getReminderEmail(firstName, formUrl, body.managerName);

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        subject: template.subject,
        body: template.body,
        templateType: body.templateType,
        firstName,
        managerName: body.managerName || 'Aaron',
      },
    }),
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
      // Validate that at least one email auth method is configured
      const hasServiceAccount = !!env.GOOGLE_SERVICE_ACCOUNT_KEY;
      const hasOAuth = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN);

      if (!hasServiceAccount && !hasOAuth) {
        logger.error('No email auth configured — skipping email send', undefined, {
          hasServiceAccount,
          hasOAuth,
        });
        throw new Error('No email auth configured. Set GOOGLE_SERVICE_ACCOUNT_KEY or OAuth secrets.');
      }

      // Get access token using best available method
      const accessToken = await getEmailAccessToken(env, undefined, logger);

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
