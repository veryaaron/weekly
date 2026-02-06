/**
 * Auth Routes
 *
 * Handles authentication and user verification
 */

import type { Env, Logger, AuthVerifyResponse } from '../types';
import { jsonResponse, parseJsonBody, BadRequestError } from '../middleware/error';
import { verifyGoogleToken, findOrCreateTeamMember, isAdminEmail, isTeamMemberAdmin } from '../middleware/auth';
import { validateAuthVerifyRequest } from '../utils/validation';

/**
 * POST /api/auth/verify
 *
 * Verifies a Google OAuth token and returns user info
 */
export async function handleAuthVerify(
  request: Request,
  env: Env,
  logger: Logger
): Promise<Response> {
  // Parse and validate request body
  const body = await parseJsonBody(request);
  const validation = validateAuthVerifyRequest(body);

  if (!validation.success) {
    throw new BadRequestError(validation.error!.message, validation.error!.code);
  }

  const { token } = validation.data!;

  // Verify token with Google
  logger.info('Verifying Google token');
  const payload = await verifyGoogleToken(token, env.GOOGLE_CLIENT_ID, logger);

  // Find or create team member
  logger.info('Looking up team member', { email: payload.email });
  const teamMember = await findOrCreateTeamMember(env.DB, payload, logger);

  // Determine admin status
  const isAdmin = isTeamMemberAdmin(teamMember) || isAdminEmail(payload.email, env.ADMIN_EMAILS);

  const response: AuthVerifyResponse = {
    user: {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    },
    isAdmin,
    teamMember,
  };

  logger.info('Auth verification successful', {
    email: payload.email,
    isAdmin,
    teamMemberId: teamMember.id,
  });

  return jsonResponse(response);
}
