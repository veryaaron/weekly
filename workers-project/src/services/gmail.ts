/**
 * Gmail API Service
 *
 * Handles email sending via Gmail REST API with two auth modes:
 * 1. Service Account with domain-wide delegation (preferred, multi-manager)
 * 2. Legacy OAuth2 refresh token (fallback, single-user)
 */

import type { Logger } from '../types';

// ============================================================================
// Constants
// ============================================================================

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const JWT_LIFETIME_SECONDS = 3600; // 1 hour

// ============================================================================
// Types
// ============================================================================

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  hasServiceAccountKey: boolean;
  serviceAccountEmail?: string;
  privateKeyValid: boolean;
  requiredFieldsPresent: boolean;
  hasOAuthFallback: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Token Management
// ============================================================================

/**
 * Refresh an OAuth2 access token using the stored refresh token.
 * Called once per scheduled job execution; the returned access token
 * is then reused for all emails in that batch.
 */
export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  logger: Logger
): Promise<string> {
  logger.info('Refreshing Gmail access token');

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Token refresh failed', undefined, {
      status: response.status,
      response: errorText,
    });
    throw new Error(`Gmail token refresh failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as TokenResponse;
  logger.info('Gmail access token refreshed successfully', {
    expires_in: data.expires_in,
  });

  return data.access_token;
}

// ============================================================================
// Service Account JWT Auth (Domain-Wide Delegation)
// ============================================================================

/**
 * Base64url encode a string or ArrayBuffer.
 */
function base64urlEncode(data: string | ArrayBuffer): string {
  let base64: string;
  if (typeof data === 'string') {
    base64 = btoa(data);
  } else {
    // ArrayBuffer → binary string → base64
    const bytes = new Uint8Array(data);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Parse a PEM-encoded PKCS#8 private key and import it as a CryptoKey
 * for signing JWTs with RSASSA-PKCS1-v1_5 SHA-256.
 */
async function parsePemPrivateKey(pem: string): Promise<CryptoKey> {
  // Strip PEM headers and whitespace
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/[\n\r\s]/g, '');

  // Decode base64 to binary
  const binaryString = atob(pemBody);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Import as PKCS#8 RSA key
  return crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false, // not extractable
    ['sign']
  );
}

/**
 * Build and sign a JWT for Google's OAuth2 token endpoint.
 * Used for service account authentication with domain-wide delegation.
 */
async function buildSignedJwt(
  serviceAccountEmail: string,
  privateKey: CryptoKey,
  managerEmail: string,
  privateKeyId: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: privateKeyId,
  };

  const payload = {
    iss: serviceAccountEmail,
    sub: managerEmail, // Impersonate this user
    scope: GMAIL_SEND_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + JWT_LIFETIME_SECONDS,
  };

  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const signatureBase = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    signatureBase
  );

  const signatureB64 = base64urlEncode(signature);
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Parse and validate a service account JSON key string.
 */
function parseServiceAccountKey(keyJson: string): ServiceAccountKey {
  const key = JSON.parse(keyJson) as ServiceAccountKey;

  const required = ['private_key', 'client_email', 'private_key_id'] as const;
  const missing = required.filter((field) => !key[field]);
  if (missing.length > 0) {
    throw new Error(`Service account key missing required fields: ${missing.join(', ')}`);
  }

  return key;
}

/**
 * Get an access token using a service account with domain-wide delegation.
 * The `managerEmail` is the user to impersonate (emails will be sent as this user).
 */
export async function getServiceAccountAccessToken(
  keyJson: string,
  managerEmail: string,
  logger: Logger
): Promise<string> {
  logger.info('Getting service account access token', {
    managerEmail,
  });

  const key = parseServiceAccountKey(keyJson);
  const privateKey = await parsePemPrivateKey(key.private_key);
  const jwt = await buildSignedJwt(key.client_email, privateKey, managerEmail, key.private_key_id);

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Service account token exchange failed', undefined, {
      status: response.status,
      managerEmail,
      serviceAccount: key.client_email,
      response: errorText,
    });
    throw new Error(`Service account token exchange failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as TokenResponse;
  logger.info('Service account access token obtained', {
    managerEmail,
    serviceAccount: key.client_email,
    expires_in: data.expires_in,
  });

  return data.access_token;
}

/**
 * Send an email as a workspace manager using the service account.
 * Returns a result object (never throws) so batch operations can continue.
 */
export async function sendAsManager(
  keyJson: string,
  managerEmail: string,
  to: string,
  subject: string,
  body: string,
  logger: Logger
): Promise<SendResult> {
  try {
    const accessToken = await getServiceAccountAccessToken(keyJson, managerEmail, logger);
    return await sendEmail(accessToken, to, subject, body, logger);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('sendAsManager failed', error instanceof Error ? error : undefined, {
      managerEmail,
      recipient: to,
    });
    return { success: false, error: message };
  }
}

/**
 * Validate a service account key without attempting token exchange.
 * Used by the test page to check configuration.
 */
export async function validateServiceAccountKey(
  keyJson: string | undefined,
  hasOAuthFallback: boolean,
  logger: Logger
): Promise<ConfigValidationResult> {
  const result: ConfigValidationResult = {
    valid: false,
    hasServiceAccountKey: false,
    privateKeyValid: false,
    requiredFieldsPresent: false,
    hasOAuthFallback,
    errors: [],
    warnings: [],
  };

  if (!keyJson) {
    result.errors.push('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
    if (hasOAuthFallback) {
      result.warnings.push('OAuth fallback is available — emails will send as Aaron');
    }
    return result;
  }

  result.hasServiceAccountKey = true;

  // Try parsing JSON
  let key: ServiceAccountKey;
  try {
    key = parseServiceAccountKey(keyJson);
    result.requiredFieldsPresent = true;
    result.serviceAccountEmail = key.client_email;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Key parsing failed: ${msg}`);
    return result;
  }

  // Try parsing the private key
  try {
    await parsePemPrivateKey(key.private_key);
    result.privateKeyValid = true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Private key invalid: ${msg}`);
    return result;
  }

  result.valid = true;

  if (!result.hasOAuthFallback) {
    result.warnings.push('No OAuth fallback configured — service account is the only email method');
  }

  logger.info('Service account key validation passed', {
    serviceAccountEmail: result.serviceAccountEmail,
  });

  return result;
}

// ============================================================================
// MIME Message Builder
// ============================================================================

/**
 * Build an RFC 2822 MIME message and return it as a base64url-encoded string.
 * Gmail API requires the `raw` field to be base64url (no padding).
 */
function buildMimeMessage(to: string, subject: string, body: string): string {
  const mimeLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ];

  const mimeString = mimeLines.join('\r\n');

  // Base64url encode (Workers runtime has btoa)
  const base64 = btoa(
    // Handle UTF-8 characters by encoding to percent-escaped bytes first
    encodeURIComponent(mimeString).replace(/%([0-9A-F]{2})/g, (_match, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
  );

  // Convert base64 to base64url (replace + with -, / with _, remove = padding)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ============================================================================
// Email Sending
// ============================================================================

/**
 * Send a single email via the Gmail REST API.
 * Returns a result object (never throws) so batch operations can continue
 * even if individual sends fail.
 */
export async function sendEmail(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  logger: Logger
): Promise<SendResult> {
  try {
    const raw = buildMimeMessage(to, subject, body);

    const response = await fetch(GMAIL_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Gmail send failed', undefined, {
        status: response.status,
        recipient: to,
        response: errorText,
      });
      return {
        success: false,
        error: `Gmail API error (${response.status}): ${errorText}`,
      };
    }

    const data = (await response.json()) as { id: string; threadId: string };
    return { success: true, messageId: data.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Gmail send exception', error instanceof Error ? error : undefined, {
      recipient: to,
    });
    return { success: false, error: message };
  }
}
