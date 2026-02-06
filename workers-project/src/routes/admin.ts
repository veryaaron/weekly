/**
 * Admin Routes
 *
 * Handles admin dashboard functionality including team management,
 * submission status, and settings
 */

import type { Env, Logger, TeamStatusResponse, SettingsResponse } from '../types';
import {
  jsonResponse,
  parseJsonBody,
  BadRequestError,
  NotFoundError,
  getPathParam,
} from '../middleware/error';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  validateCreateTeamMemberRequest,
  validateUpdateTeamMemberRequest,
  validateUpdateSettingsRequest,
  validateGenerateReportRequest,
} from '../utils/validation';
import {
  getAllTeamMembers,
  getTeamMemberById,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  getWeeklyStatus,
  getSubmissionsForWeek,
  getSettings,
  updateSettings,
  getReport,
  upsertReport,
  getAllReports,
} from '../services/database';
import { getCurrentWeekInfo } from '../utils/week';

// ============================================================================
// Team Status
// ============================================================================

/**
 * GET /api/admin/status
 *
 * Get submission status for the current week
 */
export async function handleGetWeeklyStatus(
  request: Request,
  env: Env,
  logger: Logger
): Promise<Response> {
  const auth = await authenticate(request, env, logger);
  requireAdmin(auth);

  logger.info('Fetching weekly status', { requestedBy: auth.user.email });

  const status = await getWeeklyStatus(env.DB);

  const response: TeamStatusResponse = {
    weekNumber: status.weekNumber,
    year: status.year,
    totalMembers: status.totalMembers,
    submittedCount: status.submittedCount,
    pendingCount: status.pendingCount,
    members: status.members.map((m) => ({
      id: m.id,
      email: m.email,
      name: m.name,
      firstName: m.firstName,
      hasSubmitted: m.hasSubmitted,
      submittedAt: m.submittedAt || undefined,
    })),
  };

  logger.info('Weekly status retrieved', {
    totalMembers: status.totalMembers,
    submitted: status.submittedCount,
    pending: status.pendingCount,
  });

  return jsonResponse(response);
}

/**
 * GET /api/admin/submissions
 *
 * Get all submissions for a specific week
 */
export async function handleGetSubmissions(
  request: Request,
  env: Env,
  logger: Logger
): Promise<Response> {
  const auth = await authenticate(request, env, logger);
  requireAdmin(auth);

  const url = new URL(request.url);
  const weekParam = url.searchParams.get('week');
  const yearParam = url.searchParams.get('year');

  let weekNumber: number;
  let year: number;

  if (weekParam && yearParam) {
    weekNumber = parseInt(weekParam, 10);
    year = parseInt(yearParam, 10);

    if (isNaN(weekNumber) || isNaN(year)) {
      throw new BadRequestError('Invalid week or year parameter');
    }
  } else {
    const current = getCurrentWeekInfo();
    weekNumber = current.weekNumber;
    year = current.year;
  }

  logger.info('Fetching submissions', { weekNumber, year, requestedBy: auth.user.email });

  const submissions = await getSubmissionsForWeek(env.DB, weekNumber, year);

  logger.info('Submissions retrieved', { count: submissions.length, weekNumber, year });

  return jsonResponse({
    weekNumber,
    year,
    submissions: submissions.map((s) => ({
      id: s.id,
      memberName: s.member_name,
      memberEmail: s.member_email,
      accomplishments: s.accomplishments,
      previousWeekProgress: s.previous_week_progress,
      blockers: s.blockers,
      priorities: s.priorities,
      shoutouts: s.shoutouts,
      aiSummary: s.ai_summary,
      aiQuestion: s.ai_question,
      aiAnswer: s.ai_answer,
      submittedAt: s.submitted_at,
    })),
  });
}

// ============================================================================
// Team Management
// ============================================================================

/**
 * GET /api/admin/team
 *
 * List all team members
 */
export async function handleGetTeamMembers(
  request: Request,
  env: Env,
  logger: Logger
): Promise<Response> {
  const auth = await authenticate(request, env, logger);
  requireAdmin(auth);

  const url = new URL(request.url);
  const includeInactive = url.searchParams.get('includeInactive') === 'true';

  logger.info('Fetching team members', { includeInactive, requestedBy: auth.user.email });

  const members = await getAllTeamMembers(env.DB, includeInactive);

  logger.info('Team members retrieved', { count: members.length });

  return jsonResponse({
    members: members.map((m) => ({
      id: m.id,
      email: m.email,
      name: m.name,
      firstName: m.first_name,
      role: m.role,
      active: m.active === 1,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    })),
  });
}

/**
 * POST /api/admin/team
 *
 * Create a new team member
 */
export async function handleCreateTeamMember(
  request: Request,
  env: Env,
  logger: Logger
): Promise<Response> {
  const auth = await authenticate(request, env, logger);
  requireAdmin(auth);

  const body = await parseJsonBody(request);
  const validation = validateCreateTeamMemberRequest(body);

  if (!validation.success) {
    throw new BadRequestError(validation.error!.message, validation.error!.code);
  }

  const data = validation.data!;

  logger.info('Creating team member', { email: data.email, requestedBy: auth.user.email });

  const member = await createTeamMember(env.DB, {
    email: data.email,
    name: data.name,
    firstName: data.firstName,
    role: data.role,
  });

  logger.info('Team member created', { id: member.id, email: member.email });

  return jsonResponse(
    {
      id: member.id,
      email: member.email,
      name: member.name,
      firstName: member.first_name,
      role: member.role,
      active: member.active === 1,
      createdAt: member.created_at,
      updatedAt: member.updated_at,
    },
    201
  );
}

/**
 * PUT /api/admin/team/:id
 *
 * Update a team member
 */
export async function handleUpdateTeamMember(
  request: Request,
  env: Env,
  logger: Logger,
  path: string
): Promise<Response> {
  const auth = await authenticate(request, env, logger);
  requireAdmin(auth);

  const memberId = getPathParam(path, 'id', /^\/api\/admin\/team\/([^/]+)$/);

  const body = await parseJsonBody(request);
  const validation = validateUpdateTeamMemberRequest(body);

  if (!validation.success) {
    throw new BadRequestError(validation.error!.message, validation.error!.code);
  }

  const data = validation.data!;

  logger.info('Updating team member', { id: memberId, requestedBy: auth.user.email });

  const member = await updateTeamMember(env.DB, memberId, {
    name: data.name,
    firstName: data.firstName,
    role: data.role,
    active: data.active,
  });

  logger.info('Team member updated', { id: member.id });

  return jsonResponse({
    id: member.id,
    email: member.email,
    name: member.name,
    firstName: member.first_name,
    role: member.role,
    active: member.active === 1,
    createdAt: member.created_at,
    updatedAt: member.updated_at,
  });
}

/**
 * DELETE /api/admin/team/:id
 *
 * Deactivate a team member (soft delete)
 */
export async function handleDeleteTeamMember(
  request: Request,
  env: Env,
  logger: Logger,
  path: string
): Promise<Response> {
  const auth = await authenticate(request, env, logger);
  requireAdmin(auth);

  const memberId = getPathParam(path, 'id', /^\/api\/admin\/team\/([^/]+)$/);

  logger.info('Deactivating team member', { id: memberId, requestedBy: auth.user.email });

  await deleteTeamMember(env.DB, memberId);

  logger.info('Team member deactivated', { id: memberId });

  return jsonResponse({ success: true, message: 'Team member deactivated' });
}

// ============================================================================
// Settings
// ============================================================================

/**
 * GET /api/admin/settings
 *
 * Get all settings
 */
export async function handleGetSettings(
  request: Request,
  env: Env,
  logger: Logger
): Promise<Response> {
  const auth = await authenticate(request, env, logger);
  requireAdmin(auth);

  logger.info('Fetching settings', { requestedBy: auth.user.email });

  const settings = await getSettings(env.DB);

  const response: SettingsResponse = {
    weeklyPromptEnabled: settings['weekly_prompt_enabled'] === 'true',
    weeklyReminderEnabled: settings['weekly_reminder_enabled'] === 'true',
    promptTime: settings['prompt_time'] || '09:00',
    reminderTime: settings['reminder_time'] || '17:00',
    promptDay: settings['prompt_day'] || 'wednesday',
    reminderDay: settings['reminder_day'] || 'thursday',
    emailFromName: settings['email_from_name'] || 'Weekly Feedback',
    formUrl: settings['form_url'] || env.FORM_URL || 'https://tools.kubagroup.com/weekly',
  };

  return jsonResponse(response);
}

/**
 * PUT /api/admin/settings
 *
 * Update settings
 */
export async function handleUpdateSettings(
  request: Request,
  env: Env,
  logger: Logger
): Promise<Response> {
  const auth = await authenticate(request, env, logger);
  requireAdmin(auth);

  const body = await parseJsonBody(request);
  const validation = validateUpdateSettingsRequest(body);

  if (!validation.success) {
    throw new BadRequestError(validation.error!.message, validation.error!.code);
  }

  const data = validation.data!;

  logger.info('Updating settings', { requestedBy: auth.user.email });

  const updates: Record<string, string> = {};

  if (data.weeklyPromptEnabled !== undefined) {
    updates['weekly_prompt_enabled'] = data.weeklyPromptEnabled ? 'true' : 'false';
  }
  if (data.weeklyReminderEnabled !== undefined) {
    updates['weekly_reminder_enabled'] = data.weeklyReminderEnabled ? 'true' : 'false';
  }
  if (data.promptTime !== undefined) {
    updates['prompt_time'] = data.promptTime;
  }
  if (data.reminderTime !== undefined) {
    updates['reminder_time'] = data.reminderTime;
  }
  if (data.promptDay !== undefined) {
    updates['prompt_day'] = data.promptDay;
  }
  if (data.reminderDay !== undefined) {
    updates['reminder_day'] = data.reminderDay;
  }
  if (data.emailFromName !== undefined) {
    updates['email_from_name'] = data.emailFromName;
  }

  await updateSettings(env.DB, updates);

  logger.info('Settings updated', { updatedKeys: Object.keys(updates) });

  // Return updated settings
  return handleGetSettings(request, env, logger);
}

// ============================================================================
// Reports
// ============================================================================

/**
 * GET /api/admin/reports
 *
 * List all generated reports
 */
export async function handleGetReports(
  request: Request,
  env: Env,
  logger: Logger
): Promise<Response> {
  const auth = await authenticate(request, env, logger);
  requireAdmin(auth);

  logger.info('Fetching reports', { requestedBy: auth.user.email });

  const reports = await getAllReports(env.DB);

  return jsonResponse({
    reports: reports.map((r) => ({
      id: r.id,
      weekNumber: r.week_number,
      year: r.year,
      format: r.format,
      generatedAt: r.generated_at,
      generatedBy: r.generated_by,
      contentPreview: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
    })),
  });
}

/**
 * GET /api/admin/reports/:weekNumber/:year
 *
 * Get a specific report
 */
export async function handleGetReport(
  request: Request,
  env: Env,
  logger: Logger,
  path: string
): Promise<Response> {
  const auth = await authenticate(request, env, logger);
  requireAdmin(auth);

  const match = path.match(/^\/api\/admin\/reports\/(\d+)\/(\d+)$/);
  if (!match) {
    throw new BadRequestError('Invalid report path. Use /api/admin/reports/:weekNumber/:year');
  }

  const weekNumber = parseInt(match[1], 10);
  const year = parseInt(match[2], 10);

  logger.info('Fetching report', { weekNumber, year, requestedBy: auth.user.email });

  const report = await getReport(env.DB, weekNumber, year);

  if (!report) {
    throw new NotFoundError(`Report for week ${weekNumber}, ${year} not found`);
  }

  return jsonResponse({
    id: report.id,
    weekNumber: report.week_number,
    year: report.year,
    content: report.content,
    format: report.format,
    generatedAt: report.generated_at,
    generatedBy: report.generated_by,
  });
}

/**
 * POST /api/admin/report
 *
 * Generate a new report for a specific week
 * TODO: Integrate with AI in Phase 5
 */
export async function handleGenerateReport(
  request: Request,
  env: Env,
  logger: Logger
): Promise<Response> {
  const auth = await authenticate(request, env, logger);
  requireAdmin(auth);

  const body = await parseJsonBody(request);
  const validation = validateGenerateReportRequest(body);

  if (!validation.success) {
    throw new BadRequestError(validation.error!.message, validation.error!.code);
  }

  const data = validation.data!;
  const { weekNumber: currentWeek, year: currentYear } = getCurrentWeekInfo();

  const weekNumber = data.weekNumber || currentWeek;
  const year = data.year || currentYear;

  logger.info('Generating report', { weekNumber, year, requestedBy: auth.user.email });

  // Get submissions for the week
  const submissions = await getSubmissionsForWeek(env.DB, weekNumber, year);

  if (submissions.length === 0) {
    throw new BadRequestError(`No submissions found for week ${weekNumber}, ${year}`);
  }

  // Generate report content (simple version - AI will be added in Phase 5)
  const content = generateSimpleReport(submissions, weekNumber, year);

  // Save report
  const report = await upsertReport(env.DB, weekNumber, year, content, auth.user.email);

  logger.info('Report generated', { reportId: report.id, submissionCount: submissions.length });

  return jsonResponse(
    {
      id: report.id,
      weekNumber: report.week_number,
      year: report.year,
      content: report.content,
      submissionCount: submissions.length,
    },
    201
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a simple report without AI
 * TODO: Replace with Workers AI in Phase 5
 */
function generateSimpleReport(
  submissions: Array<{
    member_name: string;
    accomplishments: string | null;
    blockers: string | null;
    priorities: string | null;
    shoutouts: string | null;
  }>,
  weekNumber: number,
  year: number
): string {
  const lines: string[] = [
    `# Weekly Team Report - Week ${weekNumber}, ${year}`,
    '',
    `**Submissions:** ${submissions.length} team member${submissions.length !== 1 ? 's' : ''}`,
    '',
    '---',
    '',
  ];

  // Accomplishments section
  lines.push('## Key Accomplishments', '');
  for (const sub of submissions) {
    if (sub.accomplishments) {
      lines.push(`**${sub.member_name}:**`);
      lines.push(sub.accomplishments);
      lines.push('');
    }
  }

  // Blockers section
  const blockersExist = submissions.some((s) => s.blockers && s.blockers.trim().length > 0);
  if (blockersExist) {
    lines.push('## Blockers & Challenges', '');
    for (const sub of submissions) {
      if (sub.blockers && sub.blockers.trim().length > 0) {
        lines.push(`**${sub.member_name}:**`);
        lines.push(sub.blockers);
        lines.push('');
      }
    }
  }

  // Priorities section
  lines.push('## Upcoming Priorities', '');
  for (const sub of submissions) {
    if (sub.priorities) {
      lines.push(`**${sub.member_name}:**`);
      lines.push(sub.priorities);
      lines.push('');
    }
  }

  // Shoutouts section
  const shoutoutsExist = submissions.some((s) => s.shoutouts && s.shoutouts.trim().length > 0);
  if (shoutoutsExist) {
    lines.push('## Shoutouts & Recognition', '');
    for (const sub of submissions) {
      if (sub.shoutouts && sub.shoutouts.trim().length > 0) {
        lines.push(`**${sub.member_name}:**`);
        lines.push(sub.shoutouts);
        lines.push('');
      }
    }
  }

  lines.push('---', '');
  lines.push(`*Report generated on ${new Date().toISOString()}*`);

  return lines.join('\n');
}
