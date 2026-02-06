/**
 * Input Validation Utilities
 *
 * Validation schemas and helpers for API inputs
 * Note: Using manual validation to avoid Zod dependency overhead in Workers
 */

import type { ApiError } from '../types';

// ============================================================================
// Validation Result Types
// ============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate that a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate that a value is a valid email address
 */
export function isValidEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  // Simple email regex - not exhaustive but catches most cases
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value.trim());
}

/**
 * Validate that a value is a positive integer
 */
export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * Validate that a value is a valid week number (1-53)
 */
export function isValidWeekNumber(value: unknown): value is number {
  return isPositiveInteger(value) && value >= 1 && value <= 53;
}

/**
 * Validate that a value is a valid year (2020-2100)
 */
export function isValidYear(value: unknown): value is number {
  return isPositiveInteger(value) && value >= 2020 && value <= 2100;
}

/**
 * Validate that a value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Validate that a value is one of the allowed values
 */
export function isOneOf<T extends string>(value: unknown, allowed: T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

/**
 * Validate time format (HH:MM)
 */
export function isValidTimeFormat(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  return timeRegex.test(value);
}

// ============================================================================
// Request Validators
// ============================================================================

/**
 * Validate auth verify request
 */
export function validateAuthVerifyRequest(body: unknown): ValidationResult<{ token: string }> {
  if (!body || typeof body !== 'object') {
    return {
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Request body must be an object' },
    };
  }

  const { token } = body as Record<string, unknown>;

  if (!isNonEmptyString(token)) {
    return {
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Token is required and must be a non-empty string' },
    };
  }

  return { success: true, data: { token } };
}

/**
 * Validate submit feedback request
 */
export function validateSubmitFeedbackRequest(body: unknown): ValidationResult<{
  accomplishments: string;
  previousWeekProgress?: string;
  blockers: string;
  priorities: string;
  shoutouts?: string;
  aiAnswer?: string;
}> {
  if (!body || typeof body !== 'object') {
    return {
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Request body must be an object' },
    };
  }

  const data = body as Record<string, unknown>;

  // Required fields
  if (!isNonEmptyString(data.accomplishments)) {
    return {
      success: false,
      error: { code: 'INVALID_ACCOMPLISHMENTS', message: 'Accomplishments is required' },
    };
  }

  if (!isNonEmptyString(data.blockers)) {
    return {
      success: false,
      error: { code: 'INVALID_BLOCKERS', message: 'Blockers is required' },
    };
  }

  if (!isNonEmptyString(data.priorities)) {
    return {
      success: false,
      error: { code: 'INVALID_PRIORITIES', message: 'Priorities is required' },
    };
  }

  // Optional fields
  const result: {
    accomplishments: string;
    previousWeekProgress?: string;
    blockers: string;
    priorities: string;
    shoutouts?: string;
    aiAnswer?: string;
  } = {
    accomplishments: data.accomplishments.trim(),
    blockers: data.blockers.trim(),
    priorities: data.priorities.trim(),
  };

  if (isNonEmptyString(data.previousWeekProgress)) {
    result.previousWeekProgress = data.previousWeekProgress.trim();
  }

  if (isNonEmptyString(data.shoutouts)) {
    result.shoutouts = data.shoutouts.trim();
  }

  if (isNonEmptyString(data.aiAnswer)) {
    result.aiAnswer = data.aiAnswer.trim();
  }

  return { success: true, data: result };
}

/**
 * Validate send chase email request
 */
export function validateSendChaseRequest(body: unknown): ValidationResult<{
  email: string;
  subject?: string;
  body?: string;
}> {
  if (!body || typeof body !== 'object') {
    return {
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Request body must be an object' },
    };
  }

  const data = body as Record<string, unknown>;

  if (!isValidEmail(data.email)) {
    return {
      success: false,
      error: { code: 'INVALID_EMAIL', message: 'Valid email address is required' },
    };
  }

  const result: { email: string; subject?: string; body?: string } = {
    email: (data.email as string).trim().toLowerCase(),
  };

  if (isNonEmptyString(data.subject)) {
    result.subject = data.subject.trim();
  }

  if (isNonEmptyString(data.body)) {
    result.body = data.body.trim();
  }

  return { success: true, data: result };
}

/**
 * Validate bulk chase request
 */
export function validateBulkChaseRequest(body: unknown): ValidationResult<{
  emails: string[];
  subject?: string;
  body?: string;
}> {
  if (!body || typeof body !== 'object') {
    return {
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Request body must be an object' },
    };
  }

  const data = body as Record<string, unknown>;

  if (!Array.isArray(data.emails) || data.emails.length === 0) {
    return {
      success: false,
      error: { code: 'INVALID_EMAILS', message: 'Emails array is required and must not be empty' },
    };
  }

  const validEmails: string[] = [];
  for (const email of data.emails) {
    if (!isValidEmail(email)) {
      return {
        success: false,
        error: { code: 'INVALID_EMAIL', message: `Invalid email address: ${email}` },
      };
    }
    validEmails.push((email as string).trim().toLowerCase());
  }

  const result: { emails: string[]; subject?: string; body?: string } = {
    emails: validEmails,
  };

  if (isNonEmptyString(data.subject)) {
    result.subject = data.subject.trim();
  }

  if (isNonEmptyString(data.body)) {
    result.body = data.body.trim();
  }

  return { success: true, data: result };
}

/**
 * Validate create team member request
 */
export function validateCreateTeamMemberRequest(body: unknown): ValidationResult<{
  email: string;
  name: string;
  firstName?: string;
  role?: 'member' | 'admin';
}> {
  if (!body || typeof body !== 'object') {
    return {
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Request body must be an object' },
    };
  }

  const data = body as Record<string, unknown>;

  if (!isValidEmail(data.email)) {
    return {
      success: false,
      error: { code: 'INVALID_EMAIL', message: 'Valid email address is required' },
    };
  }

  if (!isNonEmptyString(data.name)) {
    return {
      success: false,
      error: { code: 'INVALID_NAME', message: 'Name is required' },
    };
  }

  const result: {
    email: string;
    name: string;
    firstName?: string;
    role?: 'member' | 'admin';
  } = {
    email: (data.email as string).trim().toLowerCase(),
    name: data.name.trim(),
  };

  if (isNonEmptyString(data.firstName)) {
    result.firstName = data.firstName.trim();
  }

  if (data.role !== undefined) {
    if (!isOneOf(data.role, ['member', 'admin'])) {
      return {
        success: false,
        error: { code: 'INVALID_ROLE', message: 'Role must be "member" or "admin"' },
      };
    }
    result.role = data.role;
  }

  return { success: true, data: result };
}

/**
 * Validate update team member request
 */
export function validateUpdateTeamMemberRequest(body: unknown): ValidationResult<{
  name?: string;
  firstName?: string;
  role?: 'member' | 'admin';
  active?: boolean;
}> {
  if (!body || typeof body !== 'object') {
    return {
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Request body must be an object' },
    };
  }

  const data = body as Record<string, unknown>;
  const result: {
    name?: string;
    firstName?: string;
    role?: 'member' | 'admin';
    active?: boolean;
  } = {};

  if (data.name !== undefined) {
    if (!isNonEmptyString(data.name)) {
      return {
        success: false,
        error: { code: 'INVALID_NAME', message: 'Name must be a non-empty string' },
      };
    }
    result.name = data.name.trim();
  }

  if (data.firstName !== undefined) {
    if (typeof data.firstName !== 'string') {
      return {
        success: false,
        error: { code: 'INVALID_FIRST_NAME', message: 'First name must be a string' },
      };
    }
    result.firstName = data.firstName.trim() || undefined;
  }

  if (data.role !== undefined) {
    if (!isOneOf(data.role, ['member', 'admin'])) {
      return {
        success: false,
        error: { code: 'INVALID_ROLE', message: 'Role must be "member" or "admin"' },
      };
    }
    result.role = data.role;
  }

  if (data.active !== undefined) {
    if (!isBoolean(data.active)) {
      return {
        success: false,
        error: { code: 'INVALID_ACTIVE', message: 'Active must be a boolean' },
      };
    }
    result.active = data.active;
  }

  // At least one field must be provided
  if (Object.keys(result).length === 0) {
    return {
      success: false,
      error: { code: 'EMPTY_UPDATE', message: 'At least one field must be provided for update' },
    };
  }

  return { success: true, data: result };
}

/**
 * Validate update settings request
 */
export function validateUpdateSettingsRequest(body: unknown): ValidationResult<{
  weeklyPromptEnabled?: boolean;
  weeklyReminderEnabled?: boolean;
  promptTime?: string;
  reminderTime?: string;
  promptDay?: string;
  reminderDay?: string;
  emailFromName?: string;
}> {
  if (!body || typeof body !== 'object') {
    return {
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Request body must be an object' },
    };
  }

  const data = body as Record<string, unknown>;
  const result: {
    weeklyPromptEnabled?: boolean;
    weeklyReminderEnabled?: boolean;
    promptTime?: string;
    reminderTime?: string;
    promptDay?: string;
    reminderDay?: string;
    emailFromName?: string;
  } = {};

  const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  if (data.weeklyPromptEnabled !== undefined) {
    if (!isBoolean(data.weeklyPromptEnabled)) {
      return {
        success: false,
        error: { code: 'INVALID_SETTING', message: 'weeklyPromptEnabled must be a boolean' },
      };
    }
    result.weeklyPromptEnabled = data.weeklyPromptEnabled;
  }

  if (data.weeklyReminderEnabled !== undefined) {
    if (!isBoolean(data.weeklyReminderEnabled)) {
      return {
        success: false,
        error: { code: 'INVALID_SETTING', message: 'weeklyReminderEnabled must be a boolean' },
      };
    }
    result.weeklyReminderEnabled = data.weeklyReminderEnabled;
  }

  if (data.promptTime !== undefined) {
    if (!isValidTimeFormat(data.promptTime)) {
      return {
        success: false,
        error: { code: 'INVALID_TIME', message: 'promptTime must be in HH:MM format' },
      };
    }
    result.promptTime = data.promptTime;
  }

  if (data.reminderTime !== undefined) {
    if (!isValidTimeFormat(data.reminderTime)) {
      return {
        success: false,
        error: { code: 'INVALID_TIME', message: 'reminderTime must be in HH:MM format' },
      };
    }
    result.reminderTime = data.reminderTime;
  }

  if (data.promptDay !== undefined) {
    if (!isOneOf(data.promptDay, validDays as any)) {
      return {
        success: false,
        error: { code: 'INVALID_DAY', message: 'promptDay must be a valid day of the week' },
      };
    }
    result.promptDay = data.promptDay;
  }

  if (data.reminderDay !== undefined) {
    if (!isOneOf(data.reminderDay, validDays as any)) {
      return {
        success: false,
        error: { code: 'INVALID_DAY', message: 'reminderDay must be a valid day of the week' },
      };
    }
    result.reminderDay = data.reminderDay;
  }

  if (data.emailFromName !== undefined) {
    if (!isNonEmptyString(data.emailFromName)) {
      return {
        success: false,
        error: { code: 'INVALID_NAME', message: 'emailFromName must be a non-empty string' },
      };
    }
    result.emailFromName = data.emailFromName.trim();
  }

  return { success: true, data: result };
}

/**
 * Validate generate report request
 */
export function validateGenerateReportRequest(body: unknown): ValidationResult<{
  weekNumber?: number;
  year?: number;
}> {
  if (!body || typeof body !== 'object') {
    // Empty body is valid - will use current week
    return { success: true, data: {} };
  }

  const data = body as Record<string, unknown>;
  const result: { weekNumber?: number; year?: number } = {};

  if (data.weekNumber !== undefined) {
    if (!isValidWeekNumber(data.weekNumber)) {
      return {
        success: false,
        error: { code: 'INVALID_WEEK', message: 'Week number must be between 1 and 53' },
      };
    }
    result.weekNumber = data.weekNumber;
  }

  if (data.year !== undefined) {
    if (!isValidYear(data.year)) {
      return {
        success: false,
        error: { code: 'INVALID_YEAR', message: 'Year must be between 2020 and 2100' },
      };
    }
    result.year = data.year;
  }

  return { success: true, data: result };
}

// ============================================================================
// Sanitization Helpers
// ============================================================================

/**
 * Sanitize a string for safe storage (trim, remove null bytes)
 */
export function sanitizeString(value: string): string {
  return value.trim().replace(/\0/g, '');
}

/**
 * Sanitize HTML to prevent XSS (basic)
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
