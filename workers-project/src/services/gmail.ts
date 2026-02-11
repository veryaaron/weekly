/**
 * Gmail API Service
 *
 * Handles OAuth2 token refresh and email sending via Gmail REST API.
 * Used by the scheduled handler to send weekly prompt and reminder emails.
 */

import type { Logger } from '../types';

// ============================================================================
// Constants
// ============================================================================

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

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
