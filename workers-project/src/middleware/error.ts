/**
 * Error Handling Middleware
 *
 * Provides consistent error responses and logging for the API
 */

import type { ApiResponse, ApiError, Logger } from '../types';
import { logApiError } from '../utils/logger';

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base API error class
 */
export class ApiException extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: string, message: string, statusCode: number = 400, details?: unknown) {
    super(message);
    this.name = 'ApiException';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toApiError(): ApiError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

/**
 * 400 Bad Request
 */
export class BadRequestError extends ApiException {
  constructor(message: string, code: string = 'BAD_REQUEST', details?: unknown) {
    super(code, message, 400, details);
    this.name = 'BadRequestError';
  }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedError extends ApiException {
  constructor(message: string = 'Authentication required', code: string = 'UNAUTHORIZED') {
    super(code, message, 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * 403 Forbidden
 */
export class ForbiddenError extends ApiException {
  constructor(message: string = 'Access denied', code: string = 'FORBIDDEN') {
    super(code, message, 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * 404 Not Found
 */
export class NotFoundError extends ApiException {
  constructor(message: string = 'Resource not found', code: string = 'NOT_FOUND') {
    super(code, message, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * 409 Conflict
 */
export class ConflictError extends ApiException {
  constructor(message: string, code: string = 'CONFLICT', details?: unknown) {
    super(code, message, 409, details);
    this.name = 'ConflictError';
  }
}

/**
 * 429 Too Many Requests
 */
export class RateLimitError extends ApiException {
  constructor(message: string = 'Too many requests', retryAfter?: number) {
    super('RATE_LIMITED', message, 429, retryAfter ? { retryAfter } : undefined);
    this.name = 'RateLimitError';
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalError extends ApiException {
  constructor(message: string = 'Internal server error', code: string = 'INTERNAL_ERROR') {
    super(code, message, 500);
    this.name = 'InternalError';
  }
}

/**
 * 503 Service Unavailable
 */
export class ServiceUnavailableError extends ApiException {
  constructor(message: string = 'Service temporarily unavailable', code: string = 'SERVICE_UNAVAILABLE') {
    super(code, message, 503);
    this.name = 'ServiceUnavailableError';
  }
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Create a successful JSON response
 */
export function jsonResponse<T>(data: T, status: number = 200): Response {
  const body: ApiResponse<T> = {
    success: true,
    data,
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Create an error JSON response
 */
export function errorResponse(error: ApiError, status: number = 400): Response {
  const body: ApiResponse = {
    success: false,
    error,
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Create a response from an ApiException
 */
export function exceptionResponse(exception: ApiException): Response {
  return errorResponse(exception.toApiError(), exception.statusCode);
}

// ============================================================================
// Error Handler
// ============================================================================

/**
 * Handle errors and return appropriate response
 */
export function handleError(error: unknown, logger: Logger): Response {
  // Known API exception
  if (error instanceof ApiException) {
    logApiError(logger, error.code, error.message, error, error.details as Record<string, unknown>);
    return exceptionResponse(error);
  }

  // Standard Error
  if (error instanceof Error) {
    logApiError(logger, 'INTERNAL_ERROR', error.message, error);

    // Don't expose internal error details in production
    return errorResponse(
      {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
      500
    );
  }

  // Unknown error type
  logApiError(logger, 'UNKNOWN_ERROR', 'An unknown error occurred', error);
  return errorResponse(
    {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
    },
    500
  );
}

// ============================================================================
// Request Parsing Helpers
// ============================================================================

/**
 * Parse JSON body from request with error handling
 */
export async function parseJsonBody<T = unknown>(request: Request): Promise<T> {
  const contentType = request.headers.get('content-type');

  if (!contentType?.includes('application/json')) {
    throw new BadRequestError('Content-Type must be application/json', 'INVALID_CONTENT_TYPE');
  }

  try {
    const body = await request.json();
    return body as T;
  } catch {
    throw new BadRequestError('Invalid JSON in request body', 'INVALID_JSON');
  }
}

/**
 * Get authorization token from request headers
 */
export function getAuthToken(request: Request): string {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    throw new UnauthorizedError('Authorization header is required', 'MISSING_AUTH_HEADER');
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Invalid authorization format. Use: Bearer <token>', 'INVALID_AUTH_FORMAT');
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    throw new UnauthorizedError('Token is required', 'MISSING_TOKEN');
  }

  return token;
}

/**
 * Get URL parameter from path
 */
export function getPathParam(path: string, paramName: string, pattern: RegExp): string {
  const match = path.match(pattern);
  if (!match || !match[1]) {
    throw new BadRequestError(`Missing ${paramName} parameter`, 'MISSING_PARAM');
  }
  return match[1];
}
