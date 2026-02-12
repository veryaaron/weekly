/**
 * Database Service
 *
 * Handles all D1 database operations with proper typing and error handling
 */

import type {
  TeamMember,
  Submission,
  Report,
  EmailLog,
  Setting,
  Logger,
  Workspace,
  WorkspaceMember,
  WorkspaceSubmission,
  WorkspaceReport,
  WorkspaceSettings,
  WorkspaceEmailLog,
} from '../types';
import { getCurrentWeekInfo, getPreviousWeekInfo } from '../utils/week';
import { InternalError, NotFoundError, ConflictError } from '../middleware/error';

// ============================================================================
// ID Generation
// ============================================================================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// Team Members
// ============================================================================

/**
 * Get all team members
 */
export async function getAllTeamMembers(
  db: D1Database,
  includeInactive: boolean = false
): Promise<TeamMember[]> {
  const query = includeInactive
    ? 'SELECT * FROM team_members ORDER BY name'
    : 'SELECT * FROM team_members WHERE active = 1 ORDER BY name';

  const result = await db.prepare(query).all<TeamMember>();
  return result.results || [];
}

/**
 * Get a team member by ID
 */
export async function getTeamMemberById(
  db: D1Database,
  id: string
): Promise<TeamMember | null> {
  return db.prepare('SELECT * FROM team_members WHERE id = ?').bind(id).first<TeamMember>();
}

/**
 * Get a team member by email
 */
export async function getTeamMemberByEmail(
  db: D1Database,
  email: string
): Promise<TeamMember | null> {
  return db
    .prepare('SELECT * FROM team_members WHERE email = ?')
    .bind(email.toLowerCase())
    .first<TeamMember>();
}

/**
 * Create a new team member
 */
export async function createTeamMember(
  db: D1Database,
  data: {
    email: string;
    name: string;
    firstName?: string;
    role?: 'member' | 'admin';
  }
): Promise<TeamMember> {
  const id = generateId('tm');
  const email = data.email.toLowerCase();

  // Check for existing email
  const existing = await getTeamMemberByEmail(db, email);
  if (existing) {
    throw new ConflictError(`Team member with email ${email} already exists`, 'EMAIL_EXISTS');
  }

  await db
    .prepare(
      `INSERT INTO team_members (id, email, name, first_name, role, active)
       VALUES (?, ?, ?, ?, ?, 1)`
    )
    .bind(id, email, data.name, data.firstName || null, data.role || 'member')
    .run();

  const created = await getTeamMemberById(db, id);
  if (!created) {
    throw new InternalError('Failed to create team member');
  }

  return created;
}

/**
 * Update a team member
 */
export async function updateTeamMember(
  db: D1Database,
  id: string,
  data: {
    name?: string;
    firstName?: string;
    role?: 'member' | 'admin';
    active?: boolean;
  }
): Promise<TeamMember> {
  const existing = await getTeamMemberById(db, id);
  if (!existing) {
    throw new NotFoundError(`Team member ${id} not found`);
  }

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }

  if (data.firstName !== undefined) {
    updates.push('first_name = ?');
    values.push(data.firstName || null);
  }

  if (data.role !== undefined) {
    updates.push('role = ?');
    values.push(data.role);
  }

  if (data.active !== undefined) {
    updates.push('active = ?');
    values.push(data.active ? 1 : 0);
  }

  if (updates.length > 0) {
    updates.push('updated_at = datetime("now")');
    values.push(id);

    await db
      .prepare(`UPDATE team_members SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  const updated = await getTeamMemberById(db, id);
  if (!updated) {
    throw new InternalError('Failed to update team member');
  }

  return updated;
}

/**
 * Delete a team member (soft delete - sets active = 0)
 */
export async function deleteTeamMember(db: D1Database, id: string): Promise<void> {
  const existing = await getTeamMemberById(db, id);
  if (!existing) {
    throw new NotFoundError(`Team member ${id} not found`);
  }

  await db
    .prepare('UPDATE team_members SET active = 0, updated_at = datetime("now") WHERE id = ?')
    .bind(id)
    .run();
}

// ============================================================================
// Submissions
// ============================================================================

/**
 * Get a submission by team member and week
 */
export async function getSubmission(
  db: D1Database,
  teamMemberId: string,
  weekNumber: number,
  year: number
): Promise<Submission | null> {
  return db
    .prepare(
      'SELECT * FROM submissions WHERE team_member_id = ? AND week_number = ? AND year = ?'
    )
    .bind(teamMemberId, weekNumber, year)
    .first<Submission>();
}

/**
 * Get the previous week's submission for a team member
 */
export async function getPreviousWeekSubmission(
  db: D1Database,
  teamMemberId: string
): Promise<Submission | null> {
  const { weekNumber, year } = getPreviousWeekInfo();
  return getSubmission(db, teamMemberId, weekNumber, year);
}

/**
 * Get all submissions for a specific week
 */
export async function getSubmissionsForWeek(
  db: D1Database,
  weekNumber: number,
  year: number
): Promise<(Submission & { member_name: string; member_email: string })[]> {
  const result = await db
    .prepare(
      `SELECT s.*, t.name as member_name, t.email as member_email
       FROM submissions s
       JOIN team_members t ON s.team_member_id = t.id
       WHERE s.week_number = ? AND s.year = ?
       ORDER BY s.submitted_at DESC`
    )
    .bind(weekNumber, year)
    .all<Submission & { member_name: string; member_email: string }>();

  return result.results || [];
}

/**
 * Create or update a submission
 */
export async function upsertSubmission(
  db: D1Database,
  teamMemberId: string,
  data: {
    accomplishments: string;
    previousWeekProgress?: string;
    blockers: string;
    priorities: string;
    shoutouts?: string;
    aiSummary?: string;
    aiQuestion?: string;
    aiAnswer?: string;
  }
): Promise<Submission> {
  const { weekNumber, year } = getCurrentWeekInfo();

  // Check for existing submission
  const existing = await getSubmission(db, teamMemberId, weekNumber, year);

  if (existing) {
    // Update existing
    await db
      .prepare(
        `UPDATE submissions SET
          accomplishments = ?,
          previous_week_progress = ?,
          blockers = ?,
          priorities = ?,
          shoutouts = ?,
          ai_summary = ?,
          ai_question = ?,
          ai_answer = ?,
          submitted_at = datetime("now")
         WHERE id = ?`
      )
      .bind(
        data.accomplishments,
        data.previousWeekProgress || null,
        data.blockers,
        data.priorities,
        data.shoutouts || null,
        data.aiSummary || null,
        data.aiQuestion || null,
        data.aiAnswer || null,
        existing.id
      )
      .run();

    const updated = await db
      .prepare('SELECT * FROM submissions WHERE id = ?')
      .bind(existing.id)
      .first<Submission>();

    if (!updated) {
      throw new InternalError('Failed to update submission');
    }

    return updated;
  }

  // Create new
  const id = generateId('sub');

  await db
    .prepare(
      `INSERT INTO submissions
        (id, team_member_id, week_number, year, accomplishments, previous_week_progress,
         blockers, priorities, shoutouts, ai_summary, ai_question, ai_answer)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      teamMemberId,
      weekNumber,
      year,
      data.accomplishments,
      data.previousWeekProgress || null,
      data.blockers,
      data.priorities,
      data.shoutouts || null,
      data.aiSummary || null,
      data.aiQuestion || null,
      data.aiAnswer || null
    )
    .run();

  const created = await db
    .prepare('SELECT * FROM submissions WHERE id = ?')
    .bind(id)
    .first<Submission>();

  if (!created) {
    throw new InternalError('Failed to create submission');
  }

  return created;
}

// ============================================================================
// Weekly Status
// ============================================================================

export interface WeeklyStatus {
  weekNumber: number;
  year: number;
  totalMembers: number;
  submittedCount: number;
  pendingCount: number;
  members: {
    id: string;
    email: string;
    name: string;
    firstName: string | null;
    hasSubmitted: boolean;
    submittedAt: string | null;
  }[];
}

/**
 * Get the status of submissions for the current week
 */
export async function getWeeklyStatus(db: D1Database): Promise<WeeklyStatus> {
  const { weekNumber, year } = getCurrentWeekInfo();

  // Get all active team members with their submission status
  const result = await db
    .prepare(
      `SELECT
         t.id,
         t.email,
         t.name,
         t.first_name,
         s.submitted_at
       FROM team_members t
       LEFT JOIN submissions s ON t.id = s.team_member_id
         AND s.week_number = ? AND s.year = ?
       WHERE t.active = 1
       ORDER BY t.name`
    )
    .bind(weekNumber, year)
    .all<{
      id: string;
      email: string;
      name: string;
      first_name: string | null;
      submitted_at: string | null;
    }>();

  const members = (result.results || []).map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    firstName: row.first_name,
    hasSubmitted: row.submitted_at !== null,
    submittedAt: row.submitted_at,
  }));

  const submittedCount = members.filter((m) => m.hasSubmitted).length;

  return {
    weekNumber,
    year,
    totalMembers: members.length,
    submittedCount,
    pendingCount: members.length - submittedCount,
    members,
  };
}

// ============================================================================
// Reports
// ============================================================================

/**
 * Get a report by week
 */
export async function getReport(
  db: D1Database,
  weekNumber: number,
  year: number
): Promise<Report | null> {
  return db
    .prepare('SELECT * FROM reports WHERE week_number = ? AND year = ?')
    .bind(weekNumber, year)
    .first<Report>();
}

/**
 * Get all reports
 */
export async function getAllReports(db: D1Database): Promise<Report[]> {
  const result = await db
    .prepare('SELECT * FROM reports ORDER BY year DESC, week_number DESC')
    .all<Report>();
  return result.results || [];
}

/**
 * Create or update a report
 */
export async function upsertReport(
  db: D1Database,
  weekNumber: number,
  year: number,
  content: string,
  generatedBy?: string
): Promise<Report> {
  const existing = await getReport(db, weekNumber, year);

  if (existing) {
    await db
      .prepare(
        `UPDATE reports SET content = ?, generated_at = datetime("now"), generated_by = ?
         WHERE id = ?`
      )
      .bind(content, generatedBy || null, existing.id)
      .run();

    const updated = await db
      .prepare('SELECT * FROM reports WHERE id = ?')
      .bind(existing.id)
      .first<Report>();

    if (!updated) {
      throw new InternalError('Failed to update report');
    }

    return updated;
  }

  const id = generateId('rpt');

  await db
    .prepare(
      `INSERT INTO reports (id, week_number, year, content, generated_by)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, weekNumber, year, content, generatedBy || null)
    .run();

  const created = await db
    .prepare('SELECT * FROM reports WHERE id = ?')
    .bind(id)
    .first<Report>();

  if (!created) {
    throw new InternalError('Failed to create report');
  }

  return created;
}

// ============================================================================
// Email Logs
// ============================================================================

/**
 * Log a sent email
 */
export async function logEmail(
  db: D1Database,
  data: {
    recipientEmail: string;
    recipientName?: string;
    emailType: 'prompt' | 'reminder' | 'chase' | 'bulk_chase' | 'report';
    subject: string;
    bodyPreview?: string;
    status?: 'sent' | 'failed';
    resendId?: string;
    errorMessage?: string;
  }
): Promise<EmailLog> {
  const id = generateId('eml');

  await db
    .prepare(
      `INSERT INTO email_logs
        (id, recipient_email, recipient_name, email_type, subject, body_preview, status, resend_id, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      data.recipientEmail.toLowerCase(),
      data.recipientName || null,
      data.emailType,
      data.subject,
      data.bodyPreview || null,
      data.status || 'sent',
      data.resendId || null,
      data.errorMessage || null
    )
    .run();

  const created = await db
    .prepare('SELECT * FROM email_logs WHERE id = ?')
    .bind(id)
    .first<EmailLog>();

  if (!created) {
    throw new InternalError('Failed to log email');
  }

  return created;
}

/**
 * Get recent email logs
 */
export async function getRecentEmailLogs(
  db: D1Database,
  limit: number = 50
): Promise<EmailLog[]> {
  const result = await db
    .prepare('SELECT * FROM email_logs ORDER BY sent_at DESC LIMIT ?')
    .bind(limit)
    .all<EmailLog>();
  return result.results || [];
}

// ============================================================================
// Settings
// ============================================================================

/**
 * Get all settings as a key-value object
 */
export async function getSettings(db: D1Database): Promise<Record<string, string>> {
  const result = await db.prepare('SELECT key, value FROM settings').all<Setting>();
  const settings: Record<string, string> = {};

  for (const row of result.results || []) {
    settings[row.key] = row.value;
  }

  return settings;
}

/**
 * Get a single setting
 */
export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const result = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind(key)
    .first<{ value: string }>();
  return result?.value || null;
}

/**
 * Update a setting
 */
export async function updateSetting(
  db: D1Database,
  key: string,
  value: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (?, ?, datetime("now"))
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime("now")`
    )
    .bind(key, value, value)
    .run();
}

/**
 * Update multiple settings at once
 */
export async function updateSettings(
  db: D1Database,
  settings: Record<string, string>
): Promise<void> {
  for (const [key, value] of Object.entries(settings)) {
    await updateSetting(db, key, value);
  }
}

// ============================================================================
// Workspace Functions (Multi-Tenant)
// ============================================================================

/**
 * Check if a user is a super admin
 */
export function isSuperAdmin(email: string, superAdminEmails?: string): boolean {
  if (!superAdminEmails) return false;

  const normalizedEmail = email.toLowerCase().trim();
  const adminList = superAdminEmails
    .split(',')
    .map((e) => e.toLowerCase().trim())
    .filter((e) => e.length > 0);

  return adminList.includes(normalizedEmail);
}

/**
 * Check if email domain is allowed for workspace creation
 */
export function isAllowedDomain(email: string, allowedDomains?: string): boolean {
  if (!allowedDomains) return false;

  const domain = email.toLowerCase().split('@')[1];
  if (!domain) return false;

  const domainList = allowedDomains
    .split(',')
    .map((d) => d.toLowerCase().trim())
    .filter((d) => d.length > 0);

  return domainList.includes(domain);
}

// ============================================================================
// Workspaces
// ============================================================================

/**
 * Get a workspace by ID
 */
export async function getWorkspaceById(
  db: D1Database,
  id: string
): Promise<Workspace | null> {
  return db
    .prepare('SELECT * FROM workspaces WHERE id = ?')
    .bind(id)
    .first<Workspace>();
}

/**
 * Get a workspace by manager email
 */
export async function getWorkspaceByManagerEmail(
  db: D1Database,
  email: string
): Promise<Workspace | null> {
  return db
    .prepare('SELECT * FROM workspaces WHERE manager_email = ?')
    .bind(email.toLowerCase())
    .first<Workspace>();
}

/**
 * Get all workspaces a user has access to (either as manager or member)
 */
export async function getUserWorkspaces(
  db: D1Database,
  email: string
): Promise<Workspace[]> {
  const normalizedEmail = email.toLowerCase();

  // Get workspaces where user is either manager OR a member
  const result = await db
    .prepare(
      `SELECT DISTINCT w.*
       FROM workspaces w
       LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
       WHERE w.manager_email = ? OR (wm.email = ? AND wm.active = 1)
       ORDER BY w.created_at DESC`
    )
    .bind(normalizedEmail, normalizedEmail)
    .all<Workspace>();

  return result.results || [];
}

/**
 * Get all workspaces (super admin only)
 */
export async function getAllWorkspaces(db: D1Database): Promise<Workspace[]> {
  const result = await db
    .prepare('SELECT * FROM workspaces ORDER BY created_at DESC')
    .all<Workspace>();
  return result.results || [];
}

/**
 * Find or create a workspace for a manager
 */
export async function findOrCreateWorkspace(
  db: D1Database,
  managerEmail: string,
  managerName: string,
  allowedDomains: string[] = ['kubapay.com', 'vixtechnology.com', 'voqa.com']
): Promise<Workspace> {
  const email = managerEmail.toLowerCase();

  // Check for existing workspace
  const existing = await getWorkspaceByManagerEmail(db, email);
  if (existing) {
    return existing;
  }

  // Create new workspace
  const id = generateId('ws');

  await db
    .prepare(
      `INSERT INTO workspaces (id, manager_email, manager_name, allowed_domains, status)
       VALUES (?, ?, ?, ?, 'active')`
    )
    .bind(id, email, managerName, JSON.stringify(allowedDomains))
    .run();

  // Create default workspace settings
  await db
    .prepare(
      `INSERT INTO workspace_settings (workspace_id, email_from_name)
       VALUES (?, 'Weekly Feedback')`
    )
    .bind(id)
    .run();

  const created = await getWorkspaceById(db, id);
  if (!created) {
    throw new InternalError('Failed to create workspace');
  }

  return created;
}

/**
 * Update workspace details
 */
export async function updateWorkspace(
  db: D1Database,
  id: string,
  data: {
    managerName?: string;
    allowedDomains?: string[];
    status?: 'active' | 'inactive';
  }
): Promise<Workspace> {
  const existing = await getWorkspaceById(db, id);
  if (!existing) {
    throw new NotFoundError(`Workspace ${id} not found`);
  }

  const updates: string[] = [];
  const values: (string | null)[] = [];

  if (data.managerName !== undefined) {
    updates.push('manager_name = ?');
    values.push(data.managerName);
  }

  if (data.allowedDomains !== undefined) {
    updates.push('allowed_domains = ?');
    values.push(JSON.stringify(data.allowedDomains));
  }

  if (data.status !== undefined) {
    updates.push('status = ?');
    values.push(data.status);
  }

  if (updates.length > 0) {
    updates.push('updated_at = datetime("now")');
    values.push(id);

    await db
      .prepare(`UPDATE workspaces SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  const updated = await getWorkspaceById(db, id);
  if (!updated) {
    throw new InternalError('Failed to update workspace');
  }

  return updated;
}

// ============================================================================
// Workspace Members
// ============================================================================

/**
 * Get all members in a workspace
 */
export async function getWorkspaceMembers(
  db: D1Database,
  workspaceId: string,
  includeInactive: boolean = false
): Promise<WorkspaceMember[]> {
  const query = includeInactive
    ? 'SELECT * FROM workspace_members WHERE workspace_id = ? ORDER BY name'
    : 'SELECT * FROM workspace_members WHERE workspace_id = ? AND active = 1 ORDER BY name';

  const result = await db.prepare(query).bind(workspaceId).all<WorkspaceMember>();
  return result.results || [];
}

/**
 * Get a workspace member by ID
 */
export async function getWorkspaceMemberById(
  db: D1Database,
  workspaceId: string,
  memberId: string
): Promise<WorkspaceMember | null> {
  return db
    .prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND id = ?')
    .bind(workspaceId, memberId)
    .first<WorkspaceMember>();
}

/**
 * Get a workspace member by email
 */
export async function getWorkspaceMemberByEmail(
  db: D1Database,
  workspaceId: string,
  email: string
): Promise<WorkspaceMember | null> {
  return db
    .prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND email = ?')
    .bind(workspaceId, email.toLowerCase())
    .first<WorkspaceMember>();
}

/**
 * Find or create a workspace member
 */
export async function findOrCreateWorkspaceMember(
  db: D1Database,
  workspaceId: string,
  email: string,
  name: string,
  firstName?: string
): Promise<WorkspaceMember> {
  const normalizedEmail = email.toLowerCase();

  // Check for existing member
  const existing = await getWorkspaceMemberByEmail(db, workspaceId, normalizedEmail);
  if (existing) {
    // Reactivate if inactive
    if (!existing.active) {
      await db
        .prepare(
          'UPDATE workspace_members SET active = 1, name = ?, first_name = ?, updated_at = datetime("now") WHERE id = ?'
        )
        .bind(name, firstName || null, existing.id)
        .run();
      return {
        ...existing,
        active: 1,
        name,
        first_name: firstName || null,
      };
    }
    // Update name if changed
    if (existing.name !== name) {
      await db
        .prepare(
          'UPDATE workspace_members SET name = ?, first_name = ?, updated_at = datetime("now") WHERE id = ?'
        )
        .bind(name, firstName || null, existing.id)
        .run();
      return { ...existing, name, first_name: firstName || null };
    }
    return existing;
  }

  // Create new member
  const id = generateId('wm');

  await db
    .prepare(
      `INSERT INTO workspace_members (id, workspace_id, email, name, first_name, role, active)
       VALUES (?, ?, ?, ?, ?, 'member', 1)`
    )
    .bind(id, workspaceId, normalizedEmail, name, firstName || null)
    .run();

  const created = await getWorkspaceMemberById(db, workspaceId, id);
  if (!created) {
    throw new InternalError('Failed to create workspace member');
  }

  return created;
}

/**
 * Create a new workspace member
 */
export async function createWorkspaceMember(
  db: D1Database,
  workspaceId: string,
  data: {
    email: string;
    name: string;
    firstName?: string;
    role?: 'member' | 'admin';
  }
): Promise<WorkspaceMember> {
  const email = data.email.toLowerCase();

  // Check for existing member
  const existing = await getWorkspaceMemberByEmail(db, workspaceId, email);
  if (existing) {
    throw new ConflictError(
      `Member with email ${email} already exists in this workspace`,
      'MEMBER_EXISTS'
    );
  }

  const id = generateId('wm');

  await db
    .prepare(
      `INSERT INTO workspace_members (id, workspace_id, email, name, first_name, role, active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    )
    .bind(id, workspaceId, email, data.name, data.firstName || null, data.role || 'member')
    .run();

  const created = await getWorkspaceMemberById(db, workspaceId, id);
  if (!created) {
    throw new InternalError('Failed to create workspace member');
  }

  return created;
}

/**
 * Update a workspace member
 */
export async function updateWorkspaceMember(
  db: D1Database,
  workspaceId: string,
  memberId: string,
  data: {
    name?: string;
    firstName?: string;
    role?: 'member' | 'admin';
    active?: boolean;
  }
): Promise<WorkspaceMember> {
  const existing = await getWorkspaceMemberById(db, workspaceId, memberId);
  if (!existing) {
    throw new NotFoundError(`Workspace member ${memberId} not found`);
  }

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }

  if (data.firstName !== undefined) {
    updates.push('first_name = ?');
    values.push(data.firstName || null);
  }

  if (data.role !== undefined) {
    updates.push('role = ?');
    values.push(data.role);
  }

  if (data.active !== undefined) {
    updates.push('active = ?');
    values.push(data.active ? 1 : 0);
  }

  if (updates.length > 0) {
    updates.push('updated_at = datetime("now")');
    values.push(memberId);

    await db
      .prepare(`UPDATE workspace_members SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  const updated = await getWorkspaceMemberById(db, workspaceId, memberId);
  if (!updated) {
    throw new InternalError('Failed to update workspace member');
  }

  return updated;
}

/**
 * Delete a workspace member (soft delete - sets active = 0)
 */
export async function deleteWorkspaceMember(
  db: D1Database,
  workspaceId: string,
  memberId: string
): Promise<void> {
  const existing = await getWorkspaceMemberById(db, workspaceId, memberId);
  if (!existing) {
    throw new NotFoundError(`Workspace member ${memberId} not found`);
  }

  await db
    .prepare(
      'UPDATE workspace_members SET active = 0, updated_at = datetime("now") WHERE id = ?'
    )
    .bind(memberId)
    .run();
}

// ============================================================================
// Workspace Submissions
// ============================================================================

/**
 * Get a workspace submission by member and week
 */
export async function getWorkspaceSubmission(
  db: D1Database,
  workspaceId: string,
  memberId: string,
  weekNumber: number,
  year: number
): Promise<WorkspaceSubmission | null> {
  return db
    .prepare(
      `SELECT * FROM workspace_submissions
       WHERE workspace_id = ? AND workspace_member_id = ? AND week_number = ? AND year = ?`
    )
    .bind(workspaceId, memberId, weekNumber, year)
    .first<WorkspaceSubmission>();
}

/**
 * Get the previous week's submission for a workspace member
 */
export async function getPreviousWorkspaceSubmission(
  db: D1Database,
  workspaceId: string,
  memberId: string
): Promise<WorkspaceSubmission | null> {
  const { weekNumber, year } = getPreviousWeekInfo();
  return getWorkspaceSubmission(db, workspaceId, memberId, weekNumber, year);
}

/**
 * Get all workspace submissions for a specific week
 * Checks both workspace_submissions AND the legacy submissions table,
 * preferring workspace_submissions data when both exist.
 */
export async function getWorkspaceSubmissionsForWeek(
  db: D1Database,
  workspaceId: string,
  weekNumber: number,
  year: number
): Promise<(WorkspaceSubmission & { member_name: string; member_email: string })[]> {
  // Use a UNION to pull from both tables, deduplicating by email
  // workspace_submissions takes priority (listed first, dedup keeps first)
  const result = await db
    .prepare(
      `SELECT * FROM (
        SELECT ws.id, ws.workspace_id, ws.workspace_member_id, ws.week_number, ws.year,
               ws.accomplishments, ws.previous_week_progress, ws.blockers, ws.priorities,
               ws.shoutouts, ws.ai_summary, ws.ai_question, ws.ai_answer, ws.submitted_at,
               wm.name as member_name, wm.email as member_email
        FROM workspace_submissions ws
        JOIN workspace_members wm ON ws.workspace_member_id = wm.id
        WHERE ws.workspace_id = ? AND ws.week_number = ? AND ws.year = ?

        UNION ALL

        SELECT 'legacy_' || s.id, ?, tm.id, s.week_number, s.year,
               s.accomplishments, s.previous_week_progress, s.blockers, s.priorities,
               s.shoutouts, s.ai_summary, s.ai_question, s.ai_answer, s.submitted_at,
               wm2.name as member_name, wm2.email as member_email
        FROM submissions s
        JOIN team_members tm ON s.team_member_id = tm.id
        JOIN workspace_members wm2 ON LOWER(tm.email) = LOWER(wm2.email)
          AND wm2.workspace_id = ?
        WHERE s.week_number = ? AND s.year = ?
        AND NOT EXISTS (
          SELECT 1 FROM workspace_submissions ws2
          WHERE ws2.workspace_id = ?
            AND ws2.workspace_member_id = wm2.id
            AND ws2.week_number = s.week_number
            AND ws2.year = s.year
        )
      ) combined
      ORDER BY submitted_at DESC`
    )
    .bind(
      workspaceId, weekNumber, year,
      workspaceId, workspaceId, weekNumber, year,
      workspaceId
    )
    .all<WorkspaceSubmission & { member_name: string; member_email: string }>();

  return result.results || [];
}

/**
 * Create or update a workspace submission
 */
export async function upsertWorkspaceSubmission(
  db: D1Database,
  workspaceId: string,
  memberId: string,
  data: {
    accomplishments: string;
    previousWeekProgress?: string;
    blockers: string;
    priorities: string;
    shoutouts?: string;
    aiSummary?: string;
    aiQuestion?: string;
    aiAnswer?: string;
  }
): Promise<WorkspaceSubmission> {
  const { weekNumber, year } = getCurrentWeekInfo();

  // Check for existing submission
  const existing = await getWorkspaceSubmission(db, workspaceId, memberId, weekNumber, year);

  if (existing) {
    // Update existing
    await db
      .prepare(
        `UPDATE workspace_submissions SET
          accomplishments = ?,
          previous_week_progress = ?,
          blockers = ?,
          priorities = ?,
          shoutouts = ?,
          ai_summary = ?,
          ai_question = ?,
          ai_answer = ?,
          submitted_at = datetime("now")
         WHERE id = ?`
      )
      .bind(
        data.accomplishments,
        data.previousWeekProgress || null,
        data.blockers,
        data.priorities,
        data.shoutouts || null,
        data.aiSummary || null,
        data.aiQuestion || null,
        data.aiAnswer || null,
        existing.id
      )
      .run();

    const updated = await db
      .prepare('SELECT * FROM workspace_submissions WHERE id = ?')
      .bind(existing.id)
      .first<WorkspaceSubmission>();

    if (!updated) {
      throw new InternalError('Failed to update workspace submission');
    }

    return updated;
  }

  // Create new
  const id = generateId('wsub');

  await db
    .prepare(
      `INSERT INTO workspace_submissions
        (id, workspace_id, workspace_member_id, week_number, year, accomplishments,
         previous_week_progress, blockers, priorities, shoutouts, ai_summary, ai_question, ai_answer)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      workspaceId,
      memberId,
      weekNumber,
      year,
      data.accomplishments,
      data.previousWeekProgress || null,
      data.blockers,
      data.priorities,
      data.shoutouts || null,
      data.aiSummary || null,
      data.aiQuestion || null,
      data.aiAnswer || null
    )
    .run();

  const created = await db
    .prepare('SELECT * FROM workspace_submissions WHERE id = ?')
    .bind(id)
    .first<WorkspaceSubmission>();

  if (!created) {
    throw new InternalError('Failed to create workspace submission');
  }

  return created;
}

// ============================================================================
// Workspace Weekly Status
// ============================================================================

export interface WorkspaceWeeklyStatus {
  workspaceId: string;
  weekNumber: number;
  year: number;
  totalMembers: number;
  submittedCount: number;
  pendingCount: number;
  members: {
    id: string;
    email: string;
    name: string;
    firstName: string | null;
    hasSubmitted: boolean;
    submittedAt: string | null;
  }[];
}

/**
 * Get the status of submissions for the current week in a workspace
 * Checks both workspace_submissions AND the legacy submissions table
 * (the form writes to submissions; workspace_submissions may also have data from migration)
 */
export async function getWorkspaceWeeklyStatus(
  db: D1Database,
  workspaceId: string
): Promise<WorkspaceWeeklyStatus> {
  const { weekNumber, year } = getCurrentWeekInfo();

  // Get all active workspace members with their submission status
  // Check both workspace_submissions and legacy submissions (via email → team_members)
  const result = await db
    .prepare(
      `SELECT
         wm.id,
         wm.email,
         wm.name,
         wm.first_name,
         COALESCE(ws.submitted_at, s.submitted_at) AS submitted_at
       FROM workspace_members wm
       LEFT JOIN workspace_submissions ws ON wm.id = ws.workspace_member_id
         AND ws.workspace_id = ? AND ws.week_number = ? AND ws.year = ?
       LEFT JOIN team_members tm ON LOWER(wm.email) = LOWER(tm.email)
       LEFT JOIN submissions s ON tm.id = s.team_member_id
         AND s.week_number = ? AND s.year = ?
       WHERE wm.workspace_id = ? AND wm.active = 1
       ORDER BY wm.name`
    )
    .bind(workspaceId, weekNumber, year, weekNumber, year, workspaceId)
    .all<{
      id: string;
      email: string;
      name: string;
      first_name: string | null;
      submitted_at: string | null;
    }>();

  const members = (result.results || []).map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    firstName: row.first_name,
    hasSubmitted: row.submitted_at !== null,
    submittedAt: row.submitted_at,
  }));

  const submittedCount = members.filter((m) => m.hasSubmitted).length;

  return {
    workspaceId,
    weekNumber,
    year,
    totalMembers: members.length,
    submittedCount,
    pendingCount: members.length - submittedCount,
    members,
  };
}

// ============================================================================
// Workspace Reports
// ============================================================================

/**
 * Get a workspace report by week
 */
export async function getWorkspaceReport(
  db: D1Database,
  workspaceId: string,
  weekNumber: number,
  year: number
): Promise<WorkspaceReport | null> {
  return db
    .prepare(
      'SELECT * FROM workspace_reports WHERE workspace_id = ? AND week_number = ? AND year = ?'
    )
    .bind(workspaceId, weekNumber, year)
    .first<WorkspaceReport>();
}

/**
 * Get all workspace reports
 */
export async function getWorkspaceReports(
  db: D1Database,
  workspaceId: string
): Promise<WorkspaceReport[]> {
  const result = await db
    .prepare(
      'SELECT * FROM workspace_reports WHERE workspace_id = ? ORDER BY year DESC, week_number DESC'
    )
    .bind(workspaceId)
    .all<WorkspaceReport>();
  return result.results || [];
}

/**
 * Create or update a workspace report
 */
export async function upsertWorkspaceReport(
  db: D1Database,
  workspaceId: string,
  weekNumber: number,
  year: number,
  content: string,
  generatedBy?: string
): Promise<WorkspaceReport> {
  const existing = await getWorkspaceReport(db, workspaceId, weekNumber, year);

  if (existing) {
    await db
      .prepare(
        `UPDATE workspace_reports SET content = ?, generated_at = datetime("now"), generated_by = ?
         WHERE id = ?`
      )
      .bind(content, generatedBy || null, existing.id)
      .run();

    const updated = await db
      .prepare('SELECT * FROM workspace_reports WHERE id = ?')
      .bind(existing.id)
      .first<WorkspaceReport>();

    if (!updated) {
      throw new InternalError('Failed to update workspace report');
    }

    return updated;
  }

  const id = generateId('wrpt');

  await db
    .prepare(
      `INSERT INTO workspace_reports (id, workspace_id, week_number, year, content, generated_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, workspaceId, weekNumber, year, content, generatedBy || null)
    .run();

  const created = await db
    .prepare('SELECT * FROM workspace_reports WHERE id = ?')
    .bind(id)
    .first<WorkspaceReport>();

  if (!created) {
    throw new InternalError('Failed to create workspace report');
  }

  return created;
}

// ============================================================================
// Workspace Settings
// ============================================================================

/**
 * Get workspace settings
 */
export async function getWorkspaceSettings(
  db: D1Database,
  workspaceId: string
): Promise<WorkspaceSettings | null> {
  return db
    .prepare('SELECT * FROM workspace_settings WHERE workspace_id = ?')
    .bind(workspaceId)
    .first<WorkspaceSettings>();
}

/**
 * Update workspace settings
 */
export async function updateWorkspaceSettings(
  db: D1Database,
  workspaceId: string,
  settings: {
    weeklyPromptEnabled?: boolean;
    weeklyReminderEnabled?: boolean;
    promptDay?: string;
    promptTime?: string;
    reminderDay?: string;
    reminderTime?: string;
    emailFromName?: string;
  }
): Promise<WorkspaceSettings> {
  const existing = await getWorkspaceSettings(db, workspaceId);
  if (!existing) {
    throw new NotFoundError(`Workspace settings for ${workspaceId} not found`);
  }

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (settings.weeklyPromptEnabled !== undefined) {
    updates.push('weekly_prompt_enabled = ?');
    values.push(settings.weeklyPromptEnabled ? 1 : 0);
  }

  if (settings.weeklyReminderEnabled !== undefined) {
    updates.push('weekly_reminder_enabled = ?');
    values.push(settings.weeklyReminderEnabled ? 1 : 0);
  }

  if (settings.promptDay !== undefined) {
    updates.push('prompt_day = ?');
    values.push(settings.promptDay);
  }

  if (settings.promptTime !== undefined) {
    updates.push('prompt_time = ?');
    values.push(settings.promptTime);
  }

  if (settings.reminderDay !== undefined) {
    updates.push('reminder_day = ?');
    values.push(settings.reminderDay);
  }

  if (settings.reminderTime !== undefined) {
    updates.push('reminder_time = ?');
    values.push(settings.reminderTime);
  }

  if (settings.emailFromName !== undefined) {
    updates.push('email_from_name = ?');
    values.push(settings.emailFromName);
  }

  if (updates.length > 0) {
    updates.push('updated_at = datetime("now")');
    values.push(workspaceId);

    await db
      .prepare(`UPDATE workspace_settings SET ${updates.join(', ')} WHERE workspace_id = ?`)
      .bind(...values)
      .run();
  }

  const updated = await getWorkspaceSettings(db, workspaceId);
  if (!updated) {
    throw new InternalError('Failed to update workspace settings');
  }

  return updated;
}

// ============================================================================
// Workspace Email Logs
// ============================================================================

/**
 * Log a workspace email
 */
export async function logWorkspaceEmail(
  db: D1Database,
  workspaceId: string,
  data: {
    recipientEmail: string;
    recipientName?: string;
    emailType: 'prompt' | 'reminder' | 'chase' | 'bulk_chase' | 'report';
    subject: string;
    bodyPreview?: string;
    status?: 'sent' | 'failed';
    resendId?: string;
    errorMessage?: string;
  }
): Promise<WorkspaceEmailLog> {
  const id = generateId('weml');

  await db
    .prepare(
      `INSERT INTO workspace_email_logs
        (id, workspace_id, recipient_email, recipient_name, email_type, subject, body_preview, status, resend_id, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      workspaceId,
      data.recipientEmail.toLowerCase(),
      data.recipientName || null,
      data.emailType,
      data.subject,
      data.bodyPreview || null,
      data.status || 'sent',
      data.resendId || null,
      data.errorMessage || null
    )
    .run();

  const created = await db
    .prepare('SELECT * FROM workspace_email_logs WHERE id = ?')
    .bind(id)
    .first<WorkspaceEmailLog>();

  if (!created) {
    throw new InternalError('Failed to log workspace email');
  }

  return created;
}

/**
 * Get recent workspace email logs
 */
export async function getWorkspaceRecentEmailLogs(
  db: D1Database,
  workspaceId: string,
  limit: number = 50
): Promise<WorkspaceEmailLog[]> {
  const result = await db
    .prepare(
      'SELECT * FROM workspace_email_logs WHERE workspace_id = ? ORDER BY sent_at DESC LIMIT ?'
    )
    .bind(workspaceId, limit)
    .all<WorkspaceEmailLog>();
  return result.results || [];
}
