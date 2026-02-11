/**
 * Email Templates
 *
 * Plain-text templates for scheduled weekly emails.
 * Matches the existing templates from the Google Apps Script version.
 */

// ============================================================================
// Types
// ============================================================================

export interface EmailTemplate {
  subject: string;
  body: string;
}

// ============================================================================
// Templates
// ============================================================================

/**
 * Wednesday morning prompt — sent to all active team members.
 */
export function getPromptEmail(firstName: string, formUrl: string): EmailTemplate {
  return {
    subject: 'Weekly Feedback Time',
    body: `Hi ${firstName},

It's time for your weekly feedback! Please take a few minutes to share your accomplishments, blockers, and priorities.

Submit here: ${formUrl}

Please submit by Thursday to be included in the weekly report.

Thanks,
Aaron`,
  };
}

/**
 * Thursday follow-up reminder — sent only to members who haven't submitted.
 */
export function getReminderEmail(firstName: string, formUrl: string): EmailTemplate {
  return {
    subject: 'Reminder: Weekly Feedback Due Today',
    body: `Hi ${firstName},

This is a gentle reminder that we haven't received your weekly feedback yet. The report will be generated soon, and we'd love to include your updates!

Submit here: ${formUrl}

Takes only 5 minutes. Your input helps keep the team connected.

Thanks,
Aaron`,
  };
}
