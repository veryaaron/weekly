/**
 * Auth Routes
 *
 * Handles authentication and user verification
 */

import type { Env, Logger, AuthVerifyResponse, Workspace } from '../types';
import { jsonResponse, parseJsonBody, BadRequestError } from '../middleware/error';
import {
  verifyGoogleToken,
  findOrCreateTeamMember,
  isAdminEmail,
  isTeamMemberAdmin,
} from '../middleware/auth';
import { validateAuthVerifyRequest } from '../utils/validation';
import {
  isSuperAdmin,
  isAllowedDomain,
  getUserWorkspaces,
  findOrCreateWorkspace,
} from '../services/database';

// Extended response type that includes workspace info
interface AuthVerifyResponseWithWorkspaces extends AuthVerifyResponse {
  isSuperAdmin: boolean;
  workspaces: Workspace[];
}

/**
 * POST /api/auth/verify
 *
 * Verifies a Google OAuth token and returns user info
 * Now includes workspace information for multi-tenant support
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

  const email = payload.email.toLowerCase();

  // Find or create team member (for backwards compatibility with old single-tenant code)
  logger.info('Looking up team member', { email });
  const teamMember = await findOrCreateTeamMember(env.DB, payload, logger);

  // Determine admin status (old way, for backwards compatibility)
  const isAdmin =
    isTeamMemberAdmin(teamMember) || isAdminEmail(payload.email, env.ADMIN_EMAILS);

  // === New multi-tenant workspace logic ===

  const superAdminEmails = env.SUPER_ADMIN_EMAILS || env.ADMIN_EMAILS;
  const allowedDomains = env.ALLOWED_DOMAINS || 'kubapay.com,vixtechnology.com,voqa.com';

  // Check if user is a super admin
  const userIsSuperAdmin = isSuperAdmin(email, superAdminEmails);

  // Get workspaces user has access to
  let workspaces = await getUserWorkspaces(env.DB, email);

  // If user has no workspaces but is from an allowed domain, create their workspace
  if (workspaces.length === 0 && isAllowedDomain(email, allowedDomains)) {
    const newWorkspace = await findOrCreateWorkspace(
      env.DB,
      email,
      payload.name,
      allowedDomains.split(',').map((d) => d.trim())
    );
    workspaces = [newWorkspace];
    logger.info('Created new workspace for user', { email, workspaceId: newWorkspace.id });
  }

  const response: AuthVerifyResponseWithWorkspaces = {
    user: {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    },
    isAdmin, // Backwards compatibility
    teamMember, // Backwards compatibility
    isSuperAdmin: userIsSuperAdmin,
    workspaces,
  };

  logger.info('Auth verification successful', {
    email: payload.email,
    isAdmin,
    isSuperAdmin: userIsSuperAdmin,
    teamMemberId: teamMember.id,
    workspaceCount: workspaces.length,
  });

  return jsonResponse(response);
}
