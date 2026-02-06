/**
 * Authentication Middleware
 *
 * Handles Google OAuth token verification and user lookup
 */

import type { Env, TeamMember, GoogleTokenPayload, Logger } from '../types';
import { UnauthorizedError, ForbiddenError, InternalError } from './error';

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
