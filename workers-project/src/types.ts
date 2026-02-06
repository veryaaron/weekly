/**
 * Weekly Feedback Tool - TypeScript Types
 *
 * Core type definitions for the application
 */

// ============================================================================
// Environment Types
// ============================================================================

export interface Env {
  // Cloudflare bindings
  ASSETS: Fetcher;
  DB: D1Database;
  AI: Ai;

  // Environment variables
  ENVIRONMENT: 'development' | 'staging' | 'production';
  FORM_URL: string;
  ADMIN_EMAILS?: string;
  GOOGLE_CLIENT_ID?: string;
  RESEND_API_KEY?: string;
}

// ============================================================================
// Database Models
// ============================================================================

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  first_name: string | null;
  role: 'member' | 'admin';
  active: number; // SQLite uses 0/1 for boolean
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  team_member_id: string;
  week_number: number;
  year: number;
  accomplishments: string | null;
  previous_week_progress: string | null;
  blockers: string | null;
  priorities: string | null;
  shoutouts: string | null;
  ai_summary: string | null;
  ai_question: string | null;
  ai_answer: string | null;
  submitted_at: string;
}

export interface Report {
  id: string;
  week_number: number;
  year: number;
  content: string;
  format: 'markdown' | 'html' | 'plain';
  generated_at: string;
  generated_by: string | null;
}

export interface EmailLog {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  email_type: 'prompt' | 'reminder' | 'chase' | 'bulk_chase' | 'report';
  subject: string;
  body_preview: string | null;
  sent_at: string;
  status: 'sent' | 'failed' | 'bounced' | 'delivered';
  resend_id: string | null;
  error_message: string | null;
}

export interface Setting {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

// Generic API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// Auth types
export interface AuthVerifyRequest {
  token: string;
}

export interface AuthVerifyResponse {
  user: {
    email: string;
    name: string;
    picture?: string;
  };
  isAdmin: boolean;
  teamMember: TeamMember;
}

// Submission types
export interface SubmitFeedbackRequest {
  accomplishments: string;
  previousWeekProgress?: string;
  blockers: string;
  priorities: string;
  shoutouts?: string;
  aiAnswer?: string;
}

export interface SubmitFeedbackResponse {
  id: string;
  weekNumber: number;
  year: number;
  aiSummary?: string;
  aiQuestion?: string;
}

export interface PreviousWeekResponse {
  found: boolean;
  weekNumber?: number;
  year?: number;
  accomplishments?: string;
  blockers?: string;
  priorities?: string;
  shoutouts?: string;
}

// Admin types
export interface TeamStatusResponse {
  weekNumber: number;
  year: number;
  totalMembers: number;
  submittedCount: number;
  pendingCount: number;
  members: TeamMemberStatus[];
}

export interface TeamMemberStatus {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  hasSubmitted: boolean;
  submittedAt?: string;
}

export interface SendChaseRequest {
  email: string;
  subject?: string;
  body?: string;
}

export interface SendBulkChaseRequest {
  emails: string[];
  subject?: string;
  body?: string;
}

export interface EmailResponse {
  sent: boolean;
  resendId?: string;
  error?: string;
}

export interface GenerateReportRequest {
  weekNumber?: number;
  year?: number;
}

export interface GenerateReportResponse {
  id: string;
  weekNumber: number;
  year: number;
  content: string;
  submissionCount: number;
}

// Team management types
export interface CreateTeamMemberRequest {
  email: string;
  name: string;
  firstName?: string;
  role?: 'member' | 'admin';
}

export interface UpdateTeamMemberRequest {
  name?: string;
  firstName?: string;
  role?: 'member' | 'admin';
  active?: boolean;
}

// Settings types
export interface SettingsResponse {
  weeklyPromptEnabled: boolean;
  weeklyReminderEnabled: boolean;
  promptTime: string;
  reminderTime: string;
  promptDay: string;
  reminderDay: string;
  emailFromName: string;
  formUrl: string;
}

export interface UpdateSettingsRequest {
  weeklyPromptEnabled?: boolean;
  weeklyReminderEnabled?: boolean;
  promptTime?: string;
  reminderTime?: string;
  promptDay?: string;
  reminderDay?: string;
  emailFromName?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface WeekInfo {
  weekNumber: number;
  year: number;
  startDate: Date;
  endDate: Date;
}

export interface Logger {
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, error?: Error | unknown, data?: Record<string, unknown>) => void;
  debug: (message: string, data?: Record<string, unknown>) => void;
}

// ============================================================================
// Google OAuth Types
// ============================================================================

export interface GoogleTokenPayload {
  iss: string;
  azp: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  iat: number;
  exp: number;
}

// ============================================================================
// Scheduled Event Types
// ============================================================================

export interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}
