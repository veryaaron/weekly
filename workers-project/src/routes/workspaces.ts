/**
 * Workspace Routes
 *
 * Multi-tenant workspace management and workspace-scoped operations
 */

import type { Env, Logger } from '../types';
import {
  jsonResponse,
  parseJsonBody,
  BadRequestError,
  NotFoundError,
} from '../middleware/error';

// Request body types
interface UpdateWorkspaceBody {
  managerName?: string;
  allowedDomains?: string[];
  status?: 'active' | 'inactive';
}

interface CreateMemberBody {
  email: string;
  name: string;
  firstName?: string;
  role?: 'member' | 'admin';
}

interface UpdateMemberBody {
  name?: string;
  firstName?: string;
  role?: 'member' | 'admin';
  active?: boolean;
}

interface SubmitFeedbackBody {
  accomplishments: string;
  previousWeekProgress?: string;
  blockers: string;
  priorities: string;
  shoutouts?: string;
  aiAnswer?: string;
}

interface UpdateSettingsBody {
  weeklyPromptEnabled?: boolean;
  weeklyReminderEnabled?: boolean;
  promptDay?: string;
  promptTime?: string;
  reminderDay?: string;
  reminderTime?: string;
  emailFromName?: string;
}

interface GenerateReportBody {
  weekNumber?: number;
  year?: number;
}
import {
  authenticateWorkspace,
  authenticateWithWorkspace,
  requireSuperAdmin,
  requireWorkspaceManager,
  WorkspaceAuthContext,
} from '../middleware/auth';
import {
  getAllWorkspaces,
  getWorkspaceById,
  updateWorkspace,
  getWorkspaceMembers,
  getWorkspaceMemberById,
  createWorkspaceMember,
  updateWorkspaceMember,
  deleteWorkspaceMember,
  getWorkspaceWeeklyStatus,
  getWorkspaceSubmissionsForWeek,
  getWorkspaceSubmission,
  upsertWorkspaceSubmission,
  getPreviousWorkspaceSubmission,
  getWorkspaceSettings,
  updateWorkspaceSettings,
  getWorkspaceReports,
  getWorkspaceReport,
  upsertWorkspaceReport,
  findOrCreateWorkspaceMember,
} from '../services/database';
import { getCurrentWeekInfo } from '../utils/week';

// ============================================================================
// Workspace List & Management
// ============================================================================

/**
 * GET /api/workspaces
 *
 * List workspaces the user has access to
 * Super admins see all workspaces
 */
export async function handleListWorkspaces(
  request: Request,
  env: Env,
  logger: Logger
): Promise<Response> {
  const auth = await authenticateWorkspace(request, env, logger);

  let workspaces;
  if (auth.isSuperAdmin) {
    // Super admin sees all workspaces
    workspaces = await getAllWorkspaces(env.DB);
  } else {
    // Regular user sees their workspaces
    workspaces = auth.workspaces;
  }

  logger.info('Listed workspaces', {
    email: auth.user.email,
    count: workspaces.length,
    isSuperAdmin: auth.isSuperAdmin,
  });

  return jsonResponse({
    workspaces,
    isSuperAdmin: auth.isSuperAdmin,
  });
}

/**
 * GET /api/workspaces/:wsId
 *
 * Get a specific workspace details
 */
export async function handleGetWorkspace(
  request: Request,
  env: Env,
  logger: Logger,
  workspaceId: string
): Promise<Response> {
  const auth = await authenticateWithWorkspace(request, env, logger, workspaceId);

  const settings = await getWorkspaceSettings(env.DB, workspaceId);

  logger.info('Got workspace', {
    email: auth.user.email,
    workspaceId,
  });

  return jsonResponse({
    workspace: auth.currentWorkspace,
    settings,
    isManager: auth.currentWorkspace?.manager_email === auth.user.email.toLowerCase(),
    isSuperAdmin: auth.isSuperAdmin,
  });
}

/**
 * PUT /api/workspaces/:wsId
 *
 * Update workspace details (manager or super admin only)
 */
export async function handleUpdateWorkspace(
  request: Request,
  env: Env,
  logger: Logger,
  workspaceId: string
): Promise<Response> {
  const auth = await authenticateWithWorkspace(request, env, logger, workspaceId);
  requireWorkspaceManager(auth);

  const body = (await parseJsonBody(request)) as UpdateWorkspaceBody;

  const updated = await updateWorkspace(env.DB, workspaceId, {
    managerName: body.managerName,
    allowedDomains: body.allowedDomains,
    status: body.status,
  });

  logger.info('Updated workspace', {
    email: auth.user.email,
    workspaceId,
  });

  return jsonResponse({ workspace: updated });
}

// ============================================================================
// Workspace Members
// ============================================================================

/**
 * GET /api/workspaces/:wsId/team
 *
 * List all members in a workspace
 */
export async function handleGetWorkspaceTeam(
  request: Request,
  env: Env,
  logger: Logger,
  workspaceId: string
): Promise<Response> {
  const auth = await authenticateWithWorkspace(request, env, logger, workspaceId);

  const url = new URL(request.url);
  const includeInactive = url.searchParams.get('includeInactive') === 'true';

  const members = await getWorkspaceMembers(env.DB, workspaceId, includeInactive);

  logger.info('Listed workspace members', {
    email: auth.user.email,
    workspaceId,
    count: members.length,
  });

  return jsonResponse({ members });
}

/**
 * POST /api/workspaces/:wsId/team
 *
 * Add a member to the workspace (manager only)
 */
export async function handleCreateWorkspaceMember(
  request: Request,
  env: Env,
  logger: Logger,
  workspaceId: string
): Promise<Response> {
  const auth = await authenticateWithWorkspace(request, env, logger, workspaceId);
  requireWorkspaceManager(auth);

  const body = (await parseJsonBody(request)) as CreateMemberBody;

  if (!body.email || !body.name) {
    throw new BadRequestError('Email and name are required', 'MISSING_FIELDS');
  }

  // Validate email domain against workspace allowed domains
  const workspace = auth.currentWorkspace!;
  const allowedDomains = JSON.parse(workspace.allowed_domains) as string[];
  const emailDomain = body.email.toLowerCase().split('@')[1];

  if (!allowedDomains.includes(emailDomain)) {
    throw new BadRequestError(
      `Email domain ${emailDomain} is not allowed. Allowed domains: ${allowedDomains.join(', ')}`,
      'INVALID_DOMAIN'
    );
  }

  const member = await createWorkspaceMember(env.DB, workspaceId, {
    email: body.email,
    name: body.name,
    firstName: body.firstName,
    role: body.role,
  });

  logger.info('Created workspace member', {
    email: auth.user.email,
    workspaceId,
    memberId: member.id,
    memberEmail: member.email,
  });

  return jsonResponse({ member }, 201);
}

/**
 * PUT /api/workspaces/:wsId/team/:memberId
 *
 * Update a workspace member (manager only)
 */
export async function handleUpdateWorkspaceMember(
  request: Request,
  env: Env,
  logger: Logger,
  workspaceId: string,
  memberId: string
): Promise<Response> {
  const auth = await authenticateWithWorkspace(request, env, logger, workspaceId);
  requireWorkspaceManager(auth);

  const body = (await parseJsonBody(request)) as UpdateMemberBody;

  const member = await updateWorkspaceMember(env.DB, workspaceId, memberId, {
    name: body.name,
    firstName: body.firstName,
    role: body.role,
    active: body.active,
  });

  logger.info('Updated workspace member', {
    email: auth.user.email,
    workspaceId,
    memberId,
  });

  return jsonResponse({ member });
}

/**
 * DELETE /api/workspaces/:wsId/team/:memberId
 *
 * Remove a member from the workspace (soft delete, manager only)
 */
export async function handleDeleteWorkspaceMember(
  request: Request,
  env: Env,
  logger: Logger,
  workspaceId: string,
  memberId: string
): Promise<Response> {
  const auth = await authenticateWithWorkspace(request, env, logger, workspaceId);
  requireWorkspaceManager(auth);

  await deleteWorkspaceMember(env.DB, workspaceId, memberId);

  logger.info('Deleted workspace member', {
    email: auth.user.email,
    workspaceId,
    memberId,
  });

  return jsonResponse({ success: true });
}

// ============================================================================
// Workspace Status & Submissions
// ============================================================================

/**
 * GET /api/workspaces/:wsId/status
 *
 * Get submission status for the current week in this workspace
 */
export async function handleGetWorkspaceStatus(
  request: Request,
  env: Env,
  logger: Logger,
  workspaceId: string
): Promise<Response> {
  const auth = await authenticateWithWorkspace(request, env, logger, workspaceId);

  const status = await getWorkspaceWeeklyStatus(env.DB, workspaceId);

  logger.info('Got workspace status', {
    email: auth.user.email,
    workspaceId,
    submitted: status.submittedCount,
    pending: status.pendingCount,
  });

  return jsonResponse(status);
}

/**
 * GET /api/workspaces/:wsId/submissions
 *
 * Get all submissions for a week in this workspace
 */
export async function handleGetWorkspaceSubmissions(
  request: Request,
  env: Env,
  logger: Logger,
  workspaceId: string
): Promise<Response> {
  const auth = await authenticateWithWorkspace(request, env, logger, workspaceId);

  const url = new URL(request.url);
  let weekNumber = parseInt(url.searchParams.get('week') || '', 10);
  let year = parseInt(url.searchParams.get('year') || '', 10);

  // Default to current week if not specified
  if (!weekNumber || !year) {
    const current = getCurrentWeekInfo();
    weekNumber = weekNumber || current.weekNumber;
    year = year || current.year;
  }

  const submissions = await getWorkspaceSubmissionsForWeek(
    env.DB,
    workspaceId,
    weekNumber,
    year
  );

  logger.info('Got workspace submissions', {
    email: auth.user.email,
    workspaceId,
    weekNumber,
    year,
    count: submissions.length,
  });

  return jsonResponse({
    weekNumber,
    year,
    submissions,
  });
}

/**
 * GET /api/workspaces/:wsId/submissions/previous
 *
 * Get the previous week's submission for the current user in this workspace
 */
export async function handleGetWorkspacePreviousSubmission(
  request: Request,
  env: Env,
  logger: Logger,
  workspaceId: string
): Promise<Response> {
  const auth = await authenticateWithWorkspace(request, env, logger, workspaceId);

  if (!auth.currentMember) {
    return jsonResponse({ found: false });
  }

  const submission = await getPreviousWorkspaceSubmission(
    env.DB,
    workspaceId,
    auth.currentMember.id
  );

  if (!submission) {
    return jsonResponse({ found: false });
  }

  return jsonResponse({
    found: true,
    weekNumber: submission.week_number,
    year: submission.year,
    accomplishments: submission.accomplishments,
    blockers: submission.blockers,
    priorities: submission.priorities,
    shoutouts: submission.shoutouts,
  });
}

/**
 * POST /api/workspaces/:wsId/submissions
 *
 * Submit feedback to a specific workspace
 */
export async function handleSubmitWorkspaceFeedback(
  request: Request,
  env: Env,
  logger: Logger,
  workspaceId: string
): Promise<Response> {
  const auth = await authenticateWithWorkspace(request, env, logger, workspaceId);

  // Find or create the member in this workspace
  let member = auth.currentMember;
  if (!member) {
    // Auto-create member if they're from allowed domain
    const workspace = auth.currentWorkspace!;
    const allowedDomains = JSON.parse(workspace.allowed_domains) as string[];
    const emailDomain = auth.user.email.toLowerCase().split('@')[1];

    if (!allowedDomains.includes(emailDomain)) {
      throw new BadRequestError(
        'You are not authorized to submit to this workspace',
        'NOT_AUTHORIZED'
      );
    }

    member = await findOrCreateWorkspaceMember(
      env.DB,
      workspaceId,
      auth.user.email,
      auth.user.name,
      auth.user.givenName
    );
  }

  const body = (await parseJsonBody(request)) as SubmitFeedbackBody;

  if (!body.accomplishments || !body.blockers || !body.priorities) {
    throw new BadRequestError(
      'Accomplishments, blockers, and priorities are required',
      'MISSING_FIELDS'
    );
  }

  // Generate AI summary if AI binding is available
  let aiSummary: string | undefined;
  let aiQuestion: string | undefined;

  if (env.AI) {
    try {
      const summaryPrompt = `Summarize this weekly feedback in 2-3 sentences:
Accomplishments: ${body.accomplishments}
Blockers: ${body.blockers}
Priorities: ${body.priorities}`;

      const summaryResult = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
        prompt: summaryPrompt,
        max_tokens: 150,
      });

      aiSummary = (summaryResult as { response?: string }).response;

      // Generate a follow-up question
      const questionPrompt = `Based on this weekly feedback, suggest one thoughtful follow-up question:
Accomplishments: ${body.accomplishments}
Blockers: ${body.blockers}`;

      const questionResult = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
        prompt: questionPrompt,
        max_tokens: 100,
      });

      aiQuestion = (questionResult as { response?: string }).response;
    } catch (error) {
      logger.warn('AI summary generation failed', { error });
    }
  }

  const submission = await upsertWorkspaceSubmission(env.DB, workspaceId, member.id, {
    accomplishments: body.accomplishments,
    previousWeekProgress: body.previousWeekProgress,
    blockers: body.blockers,
    priorities: body.priorities,
    shoutouts: body.shoutouts,
    aiSummary,
    aiQuestion,
    aiAnswer: body.aiAnswer,
  });

  const { weekNumber, year } = getCurrentWeekInfo();

  logger.info('Workspace submission created', {
    email: auth.user.email,
    workspaceId,
    memberId: member.id,
    submissionId: submission.id,
    weekNumber,
    year,
  });

  return jsonResponse({
    id: submission.id,
    weekNumber,
    year,
    aiSummary,
    aiQuestion,
  }, 201);
}

// ============================================================================
// Workspace Settings
// ============================================================================

/**
 * GET /api/workspaces/:wsId/settings
 *
 * Get workspace settings
 */
export async function handleGetWorkspaceSettings(
  request: Request,
  env: Env,
  logger: Logger,
  workspaceId: string
): Promise<Response> {
  const auth = await authenticateWithWorkspace(request, env, logger, workspaceId);

  const settings = await getWorkspaceSettings(env.DB, workspaceId);

  if (!settings) {
    throw new NotFoundError('Workspace settings not found');
  }

  return jsonResponse({
    weeklyPromptEnabled: Boolean(settings.weekly_prompt_enabled),
    weeklyReminderEnabled: Boolean(settings.weekly_reminder_enabled),
    promptDay: settings.prompt_day,
    promptTime: settings.prompt_time,
    reminderDay: settings.reminder_day,
    reminderTime: settings.reminder_time,
    emailFromName: settings.email_from_name,
  });
}

/**
 * PUT /api/workspaces/:wsId/settings
 *
 * Update workspace settings (manager only)
 */
export async function handleUpdateWorkspaceSettings(
  request: Request,
  env: Env,
  logger: Logger,
  workspaceId: string
): Promise<Response> {
  const auth = await authenticateWithWorkspace(request, env, logger, workspaceId);
  requireWorkspaceManager(auth);

  const body = (await parseJsonBody(request)) as UpdateSettingsBody;

  const settings = await updateWorkspaceSettings(env.DB, workspaceId, {
    weeklyPromptEnabled: body.weeklyPromptEnabled,
    weeklyReminderEnabled: body.weeklyReminderEnabled,
    promptDay: body.promptDay,
    promptTime: body.promptTime,
    reminderDay: body.reminderDay,
    reminderTime: body.reminderTime,
    emailFromName: body.emailFromName,
  });

  logger.info('Updated workspace settings', {
    email: auth.user.email,
    workspaceId,
  });

  return jsonResponse({
    weeklyPromptEnabled: Boolean(settings.weekly_prompt_enabled),
    weeklyReminderEnabled: Boolean(settings.weekly_reminder_enabled),
    promptDay: settings.prompt_day,
    promptTime: settings.prompt_time,
    reminderDay: settings.reminder_day,
    reminderTime: settings.reminder_time,
    emailFromName: settings.email_from_name,
  });
}

// ============================================================================
// Workspace Reports
// ============================================================================

/**
 * GET /api/workspaces/:wsId/reports
 *
 * List all reports for this workspace
 */
export async function handleGetWorkspaceReports(
  request: Request,
  env: Env,
  logger: Logger,
  workspaceId: string
): Promise<Response> {
  const auth = await authenticateWithWorkspace(request, env, logger, workspaceId);

  const reports = await getWorkspaceReports(env.DB, workspaceId);

  return jsonResponse({ reports });
}

/**
 * GET /api/workspaces/:wsId/reports/:week/:year
 *
 * Get a specific report
 */
export async function handleGetWorkspaceReport(
  request: Request,
  env: Env,
  logger: Logger,
  workspaceId: string,
  weekNumber: number,
  year: number
): Promise<Response> {
  const auth = await authenticateWithWorkspace(request, env, logger, workspaceId);

  const report = await getWorkspaceReport(env.DB, workspaceId, weekNumber, year);

  if (!report) {
    throw new NotFoundError(`Report for week ${weekNumber}/${year} not found`);
  }

  return jsonResponse({ report });
}

/**
 * POST /api/workspaces/:wsId/report
 *
 * Generate a report for this workspace
 */
export async function handleGenerateWorkspaceReport(
  request: Request,
  env: Env,
  logger: Logger,
  workspaceId: string
): Promise<Response> {
  const auth = await authenticateWithWorkspace(request, env, logger, workspaceId);
  requireWorkspaceManager(auth);

  const body = (await parseJsonBody(request)) as GenerateReportBody;

  let weekNumber = body.weekNumber;
  let year = body.year;

  if (!weekNumber || !year) {
    const current = getCurrentWeekInfo();
    weekNumber = weekNumber || current.weekNumber;
    year = year || current.year;
  }

  // Get submissions for the week
  const submissions = await getWorkspaceSubmissionsForWeek(
    env.DB,
    workspaceId,
    weekNumber,
    year
  );

  if (submissions.length === 0) {
    throw new BadRequestError('No submissions found for this week', 'NO_SUBMISSIONS');
  }

  // Generate report content
  let content = `# Weekly Report - Week ${weekNumber}, ${year}\n\n`;
  content += `Generated for ${auth.currentWorkspace?.manager_name || 'Manager'}\n`;
  content += `Total submissions: ${submissions.length}\n\n`;

  for (const sub of submissions) {
    content += `## ${sub.member_name}\n\n`;

    if (sub.accomplishments) {
      content += `### Accomplishments\n${sub.accomplishments}\n\n`;
    }

    if (sub.blockers) {
      content += `### Blockers\n${sub.blockers}\n\n`;
    }

    if (sub.priorities) {
      content += `### Priorities\n${sub.priorities}\n\n`;
    }

    if (sub.shoutouts) {
      content += `### Shoutouts\n${sub.shoutouts}\n\n`;
    }

    if (sub.ai_summary) {
      content += `### AI Summary\n${sub.ai_summary}\n\n`;
    }

    content += '---\n\n';
  }

  // Save the report
  const report = await upsertWorkspaceReport(
    env.DB,
    workspaceId,
    weekNumber,
    year,
    content,
    auth.user.email
  );

  logger.info('Generated workspace report', {
    email: auth.user.email,
    workspaceId,
    weekNumber,
    year,
    submissionCount: submissions.length,
  });

  return jsonResponse({
    id: report.id,
    weekNumber,
    year,
    content,
    submissionCount: submissions.length,
  }, 201);
}

// ============================================================================
// Super Admin Routes
// ============================================================================

/**
 * GET /api/super/workspaces
 *
 * List ALL workspaces (super admin only)
 */
export async function handleSuperListWorkspaces(
  request: Request,
  env: Env,
  logger: Logger
): Promise<Response> {
  const auth = await authenticateWorkspace(request, env, logger);
  requireSuperAdmin(auth);

  const workspaces = await getAllWorkspaces(env.DB);

  // Get member counts for each workspace
  const workspacesWithCounts = await Promise.all(
    workspaces.map(async (workspace) => {
      const members = await getWorkspaceMembers(env.DB, workspace.id, false);
      return {
        ...workspace,
        memberCount: members.length,
      };
    })
  );

  logger.info('Super admin listed all workspaces', {
    email: auth.user.email,
    count: workspaces.length,
  });

  return jsonResponse({ workspaces: workspacesWithCounts });
}

/**
 * GET /api/super/submissions
 *
 * Get ALL submissions across all workspaces (super admin only)
 */
export async function handleSuperGetSubmissions(
  request: Request,
  env: Env,
  logger: Logger
): Promise<Response> {
  const auth = await authenticateWorkspace(request, env, logger);
  requireSuperAdmin(auth);

  const url = new URL(request.url);
  let weekNumber = parseInt(url.searchParams.get('week') || '', 10);
  let year = parseInt(url.searchParams.get('year') || '', 10);

  if (!weekNumber || !year) {
    const current = getCurrentWeekInfo();
    weekNumber = weekNumber || current.weekNumber;
    year = year || current.year;
  }

  // Get all workspaces
  const workspaces = await getAllWorkspaces(env.DB);

  // Get submissions from each workspace
  const allSubmissions = await Promise.all(
    workspaces.map(async (workspace) => {
      const submissions = await getWorkspaceSubmissionsForWeek(
        env.DB,
        workspace.id,
        weekNumber,
        year
      );
      return submissions.map((sub) => ({
        ...sub,
        workspace_name: workspace.manager_name,
        workspace_id: workspace.id,
      }));
    })
  );

  const flatSubmissions = allSubmissions.flat();

  logger.info('Super admin got all submissions', {
    email: auth.user.email,
    weekNumber,
    year,
    count: flatSubmissions.length,
  });

  return jsonResponse({
    weekNumber,
    year,
    submissions: flatSubmissions,
    workspaceCount: workspaces.length,
  });
}
