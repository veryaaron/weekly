/**
 * Authentication Middleware
 *
 * Handles Google OAuth token verification and user lookup
 */

import type { Env, TeamMember, GoogleTokenPayload, Logger, Workspace, WorkspaceMember } from '../types';
import { UnauthorizedError, ForbiddenError, InternalError } from './error';
import {
  isSuperAdmin,
  isAllowedDomain,
  getUserWorkspaces,
  findOrCreateWorkspace,
  findOrCreateWorkspaceMember,
  getWorkspaceById,
  getWorkspaceMemberByEmail,
} from '../services/database';

// ============================================================================
// Types
// ============================================================================

export interface AuthContext {
  user: {
    email: string;
    name: string;
    picture?: string;
    givenName?: string;
  };
  teamMember: TeamMember;
  isAdmin: boolean;
}

// Workspace-aware auth context for multi-tenant operations
export interface WorkspaceAuthContext {
  user: {
    email: string;
    name: string;
    picture?: string;
    givenName?: string;
  };
  isSuperAdmin: boolean;
  workspaces: Workspace[];
  // Set when accessing a specific workspace endpoint
  currentWorkspace?: Workspace;
  currentMember?: WorkspaceMember;
}

// ============================================================================
// Token Verification
// ============================================================================

/**
 * Verify a Google OAuth token and extract the payload
 */
export async function verifyGoogleToken(
  token: string,
  clientId?: string,
  logger?: Logger
): Promise<GoogleTokenPayload> {
  try {
    // Google's token info endpoint for verification
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger?.warn('Google token verification failed', {
        status: response.status,
        error: errorText,
      });
      throw new UnauthorizedError('Invalid or expired token', 'INVALID_TOKEN');
    }

    const payload = (await response.json()) as GoogleTokenPayload;

    // Verify the audience (client ID) if provided
    if (clientId && payload.aud !== clientId) {
      logger?.warn('Token audience mismatch', {
        expected: clientId,
        received: payload.aud,
      });
      throw new UnauthorizedError('Token not issued for this application', 'INVALID_AUDIENCE');
    }

    // Verify email is present and verified
    if (!payload.email) {
      throw new UnauthorizedError('Email not found in token', 'MISSING_EMAIL');
    }

    if (!payload.email_verified) {
      throw new UnauthorizedError('Email not verified', 'EMAIL_NOT_VERIFIED');
    }

    // Check token expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new UnauthorizedError('Token has expired', 'TOKEN_EXPIRED');
    }

    return payload;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    logger?.error('Error verifying Google token', error);
    throw new UnauthorizedError('Failed to verify token', 'TOKEN_VERIFICATION_FAILED');
  }
}

// ============================================================================
// User Lookup/Creation
// ============================================================================

/**
 * Find or create a team member from the token payload
 */
export async function findOrCreateTeamMember(
  db: D1Database,
  payload: GoogleTokenPayload,
  logger?: Logger
): Promise<TeamMember> {
  const email = payload.email.toLowerCase();

  // Try to find existing team member
  const existing = await db
    .prepare('SELECT * FROM team_members WHERE email = ?')
    .bind(email)
    .first<TeamMember>();

  if (existing) {
    // Update name if changed
    if (existing.name !== payload.name) {
      await db
        .prepare('UPDATE team_members SET name = ?, first_name = ?, updated_at = datetime("now") WHERE id = ?')
        .bind(payload.name, payload.given_name || null, existing.id)
        .run();

      logger?.info('Updated team member name', { email, oldName: existing.name, newName: payload.name });

      return {
        ...existing,
        name: payload.name,
        first_name: payload.given_name || existing.first_name,
      };
    }
    return existing;
  }

  // Create new team member
  const id = `tm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  await db
    .prepare(
      `INSERT INTO team_members (id, email, name, first_name, role, active)
       VALUES (?, ?, ?, ?, 'member', 1)`
    )
    .bind(id, email, payload.name, payload.given_name || null)
    .run();

  logger?.info('Created new team member', { id, email, name: payload.name });

  return {
    id,
    email,
    name: payload.name,
    first_name: payload.given_name || null,
    role: 'member',
    active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ============================================================================
// Admin Check
// ============================================================================

/**
 * Check if an email is in the admin list
 */
export function isAdminEmail(email: string, adminEmails?: string): boolean {
  if (!adminEmails) return false;

  const normalizedEmail = email.toLowerCase().trim();
  const adminList = adminEmails
    .split(',')
    .map((e) => e.toLowerCase().trim())
    .filter((e) => e.length > 0);

  return adminList.includes(normalizedEmail);
}

/**
 * Check if a team member has admin role
 */
export function isTeamMemberAdmin(teamMember: TeamMember): boolean {
  return teamMember.role === 'admin';
}

// ============================================================================
// Middleware Functions
// ============================================================================

/**
 * Authenticate a request and return the auth context
 */
export async function authenticate(
  request: Request,
  env: Env,
  logger: Logger
): Promise<AuthContext> {
  // Get token from Authorization header
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    throw new UnauthorizedError('Authorization header is required', 'MISSING_AUTH_HEADER');
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Invalid authorization format', 'INVALID_AUTH_FORMAT');
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    throw new UnauthorizedError('Token is required', 'MISSING_TOKEN');
  }

  // Verify token with Google
  const payload = await verifyGoogleToken(token, env.GOOGLE_CLIENT_ID, logger);

  // Find or create team member
  const teamMember = await findOrCreateTeamMember(env.DB, payload, logger);

  // Check if user is active
  if (!teamMember.active) {
    throw new ForbiddenError('Your account has been deactivated', 'ACCOUNT_DEACTIVATED');
  }

  // Determine admin status
  const isAdmin =
    isTeamMemberAdmin(teamMember) || isAdminEmail(payload.email, env.ADMIN_EMAILS);

  return {
    user: {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      givenName: payload.given_name,
    },
    teamMember,
    isAdmin,
  };
}

/**
 * Require admin access - throws if not admin
 */
export function requireAdmin(authContext: AuthContext): void {
  if (!authContext.isAdmin) {
    throw new ForbiddenError('Admin access required', 'ADMIN_REQUIRED');
  }
}

/**
 * Require active team member
 */
export function requireActiveTeamMember(teamMember: TeamMember): void {
  if (!teamMember.active) {
    throw new ForbiddenError('Your account has been deactivated', 'ACCOUNT_DEACTIVATED');
  }
}

// ============================================================================
// Workspace-Aware Authentication (Multi-Tenant)
// ============================================================================

/**
 * Authenticate a request for workspace operations
 * Returns workspaces the user has access to and their super admin status
 */
export async function authenticateWorkspace(
  request: Request,
  env: Env,
  logger: Logger
): Promise<WorkspaceAuthContext> {
  // Get token from Authorization header
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    throw new UnauthorizedError('Authorization header is required', 'MISSING_AUTH_HEADER');
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Invalid authorization format', 'INVALID_AUTH_FORMAT');
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    throw new UnauthorizedError('Token is required', 'MISSING_TOKEN');
  }

  // Verify token with Google
  const payload = await verifyGoogleToken(token, env.GOOGLE_CLIENT_ID, logger);

  const email = payload.email.toLowerCase();
  const superAdminEmails = env.SUPER_ADMIN_EMAILS || env.ADMIN_EMAILS; // Backwards compatibility
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

  logger.info('Workspace authentication successful', {
    email,
    isSuperAdmin: userIsSuperAdmin,
    workspaceCount: workspaces.length,
  });

  return {
    user: {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      givenName: payload.given_name,
    },
    isSuperAdmin: userIsSuperAdmin,
    workspaces,
  };
}

/**
 * Authenticate and resolve a specific workspace context
 * Used for workspace-scoped API endpoints (/api/workspaces/:wsId/*)
 */
export async function authenticateWithWorkspace(
  request: Request,
  env: Env,
  logger: Logger,
  workspaceId: string
): Promise<WorkspaceAuthContext> {
  const auth = await authenticateWorkspace(request, env, logger);

  // Get the workspace
  const workspace = await getWorkspaceById(env.DB, workspaceId);
  if (!workspace) {
    throw new ForbiddenError('Workspace not found', 'WORKSPACE_NOT_FOUND');
  }

  // Check if user has access to this workspace
  const hasAccess =
    auth.isSuperAdmin || // Super admins can access any workspace
    workspace.manager_email === auth.user.email.toLowerCase() || // Manager of the workspace
    auth.workspaces.some((w) => w.id === workspaceId); // Member of the workspace

  if (!hasAccess) {
    throw new ForbiddenError('You do not have access to this workspace', 'WORKSPACE_ACCESS_DENIED');
  }

  // Get the user's membership in this workspace (if they're a member)
  const member = await getWorkspaceMemberByEmail(env.DB, workspaceId, auth.user.email);

  return {
    ...auth,
    currentWorkspace: workspace,
    currentMember: member || undefined,
  };
}

/**
 * Require super admin access
 */
export function requireSuperAdmin(auth: WorkspaceAuthContext): void {
  if (!auth.isSuperAdmin) {
    throw new ForbiddenError('Super admin access required', 'SUPER_ADMIN_REQUIRED');
  }
}

/**
 * Require manager access to workspace (either manager or super admin)
 */
export function requireWorkspaceManager(auth: WorkspaceAuthContext): void {
  if (!auth.currentWorkspace) {
    throw new InternalError('No workspace context');
  }

  const isManager = auth.currentWorkspace.manager_email === auth.user.email.toLowerCase();

  if (!auth.isSuperAdmin && !isManager) {
    throw new ForbiddenError('Manager access required', 'MANAGER_REQUIRED');
  }
}
