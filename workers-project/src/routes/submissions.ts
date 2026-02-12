/**
 * Submission Routes
 *
 * Handles weekly feedback submissions
 */

import type { Env, Logger, PreviousWeekResponse, SubmitFeedbackResponse } from '../types';
import { jsonResponse, parseJsonBody, BadRequestError } from '../middleware/error';
import { authenticate, AuthContext } from '../middleware/auth';
import { validateSubmitFeedbackRequest } from '../utils/validation';
import {
  getPreviousWeekSubmission,
  upsertSubmission,
  getTeamMemberByEmail,
  getUserWorkspaces,
  findOrCreateWorkspaceMember,
  upsertWorkspaceSubmission,
} from '../services/database';
import { getCurrentWeekInfo, getPreviousWeekInfo } from '../utils/week';

/**
 * GET /api/submissions/previous
 *
 * Get the authenticated user's previous week submission
 */
export async function handleGetPreviousSubmission(
  request: Request,
  env: Env,
  logger: Logger
): Promise<Response> {
  // Authenticate user
  const auth = await authenticate(request, env, logger);

  logger.info('Fetching previous week submission', {
    email: auth.user.email,
    teamMemberId: auth.teamMember.id,
  });

  // Get previous week's submission
  const submission = await getPreviousWeekSubmission(env.DB, auth.teamMember.id);
  const { weekNumber, year } = getPreviousWeekInfo();

  if (!submission) {
    const response: PreviousWeekResponse = {
      found: false,
    };
    logger.info('No previous submission found', { weekNumber, year });
    return jsonResponse(response);
  }

  const response: PreviousWeekResponse = {
    found: true,
    weekNumber: submission.week_number,
    year: submission.year,
    accomplishments: submission.accomplishments || undefined,
    blockers: submission.blockers || undefined,
    priorities: submission.priorities || undefined,
    shoutouts: submission.shoutouts || undefined,
  };

  logger.info('Previous submission found', {
    weekNumber: submission.week_number,
    year: submission.year,
  });

  return jsonResponse(response);
}

/**
 * POST /api/submissions
 *
 * Submit weekly feedback
 */
export async function handleSubmitFeedback(
  request: Request,
  env: Env,
  logger: Logger
): Promise<Response> {
  // Authenticate user
  const auth = await authenticate(request, env, logger);

  // Parse and validate request body
  const body = await parseJsonBody(request);
  const validation = validateSubmitFeedbackRequest(body);

  if (!validation.success) {
    throw new BadRequestError(validation.error!.message, validation.error!.code);
  }

  const data = validation.data!;
  const { weekNumber, year } = getCurrentWeekInfo();

  logger.info('Submitting feedback', {
    email: auth.user.email,
    teamMemberId: auth.teamMember.id,
    weekNumber,
    year,
  });

  // Generate AI summary (placeholder - will be implemented in Phase 5)
  let aiSummary: string | undefined;
  let aiQuestion: string | undefined;

  // For now, create simple summaries without AI
  // TODO: Replace with Workers AI in Phase 5
  aiSummary = generateSimpleSummary(data.accomplishments, data.blockers, data.priorities);
  aiQuestion = generateSimpleQuestion(data.priorities, data.blockers);

  // Create or update submission (legacy table)
  const submission = await upsertSubmission(env.DB, auth.teamMember.id, {
    accomplishments: data.accomplishments,
    previousWeekProgress: data.previousWeekProgress,
    blockers: data.blockers,
    priorities: data.priorities,
    shoutouts: data.shoutouts,
    aiSummary,
    aiQuestion,
    aiAnswer: data.aiAnswer,
  });

  // Also write to workspace_submissions so the admin dashboard sees it
  try {
    const workspaces = await getUserWorkspaces(env.DB, auth.user.email);
    for (const ws of workspaces) {
      const wsMember = await findOrCreateWorkspaceMember(
        env.DB,
        ws.id,
        auth.user.email,
        auth.user.name,
        auth.user.givenName
      );
      await upsertWorkspaceSubmission(env.DB, ws.id, wsMember.id, {
        accomplishments: data.accomplishments,
        previousWeekProgress: data.previousWeekProgress,
        blockers: data.blockers,
        priorities: data.priorities,
        shoutouts: data.shoutouts,
        aiSummary,
        aiQuestion,
        aiAnswer: data.aiAnswer,
      });
      logger.info('Synced submission to workspace', { workspaceId: ws.id, memberId: wsMember.id });
    }
  } catch (wsError) {
    // Don't fail the main submission if workspace sync fails
    logger.warn('Failed to sync submission to workspace_submissions', { error: wsError });
  }

  const response: SubmitFeedbackResponse = {
    id: submission.id,
    weekNumber: submission.week_number,
    year: submission.year,
    aiSummary,
    aiQuestion,
  };

  logger.info('Feedback submitted successfully', {
    submissionId: submission.id,
    weekNumber,
    year,
  });

  return jsonResponse(response, 201);
}

// ============================================================================
// Helper Functions (temporary until AI integration)
// ============================================================================

/**
 * Generate a simple summary without AI
 * TODO: Replace with Workers AI in Phase 5
 */
function generateSimpleSummary(
  accomplishments: string,
  blockers: string,
  priorities: string
): string {
  const accomplishmentCount = countBulletPoints(accomplishments);
  const blockerCount = countBulletPoints(blockers);
  const priorityCount = countBulletPoints(priorities);

  const parts: string[] = [];

  if (accomplishmentCount > 0) {
    parts.push(`${accomplishmentCount} accomplishment${accomplishmentCount > 1 ? 's' : ''} this week`);
  }

  if (blockerCount > 0) {
    parts.push(`${blockerCount} blocker${blockerCount > 1 ? 's' : ''} identified`);
  }

  if (priorityCount > 0) {
    parts.push(`${priorityCount} priority item${priorityCount > 1 ? 's' : ''} for next week`);
  }

  if (parts.length === 0) {
    return 'Update submitted.';
  }

  return parts.join(', ') + '.';
}

/**
 * Generate a simple follow-up question without AI
 * TODO: Replace with Workers AI in Phase 5
 */
function generateSimpleQuestion(priorities: string, blockers: string): string {
  const questions = [
    'What support do you need to achieve your priorities for next week?',
    'Is there anything blocking your progress that the team should know about?',
    'How can we help you be more effective next week?',
    'Are there any dependencies or risks you\'re concerned about?',
    'What would make next week more successful for you?',
  ];

  // If there are blockers mentioned, ask about them
  if (blockers && blockers.trim().length > 10) {
    return 'How can the team help you overcome the blockers you mentioned?';
  }

  // Otherwise, pick a random question
  const index = Math.floor(Date.now() / 1000) % questions.length;
  return questions[index];
}

/**
 * Count bullet points or line items in text
 */
function countBulletPoints(text: string): number {
  if (!text || text.trim().length === 0) return 0;

  // Count lines that start with bullet points, numbers, or dashes
  const lines = text.split('\n').filter((line) => {
    const trimmed = line.trim();
    return (
      trimmed.length > 0 &&
      (trimmed.startsWith('-') ||
        trimmed.startsWith('•') ||
        trimmed.startsWith('*') ||
        /^\d+\./.test(trimmed) ||
        trimmed.length > 5) // Count any substantial line
    );
  });

  return Math.max(1, lines.length); // At least 1 if there's any content
}
