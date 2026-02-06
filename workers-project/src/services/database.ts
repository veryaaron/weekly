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
