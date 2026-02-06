/**
 * Structured Logging Utility
 *
 * Provides consistent, structured logging for the application
 * Logs are output as JSON for easy parsing by Cloudflare's logging
 */

import type { Logger } from '../types';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
  requestId?: string;
  path?: string;
  method?: string;
}

/**
 * Create a logger instance with optional request context
 */
export function createLogger(context?: {
  requestId?: string;
  path?: string;
  method?: string;
}): Logger {
  const log = (level: LogLevel, message: string, data?: Record<string, unknown>, error?: Error | unknown) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };

    if (data && Object.keys(data).length > 0) {
      entry.data = data;
    }

    if (error) {
      if (error instanceof Error) {
        entry.error = {
          message: error.message,
          name: error.name,
          stack: error.stack,
        };
      } else {
        entry.error = {
          message: String(error),
        };
      }
    }

    // Output as JSON for structured logging
    const output = JSON.stringify(entry);

    switch (level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  };

  return {
    debug: (message: string, data?: Record<string, unknown>) => log('debug', message, data),
    info: (message: string, data?: Record<string, unknown>) => log('info', message, data),
    warn: (message: string, data?: Record<string, unknown>) => log('warn', message, data),
    error: (message: string, error?: Error | unknown, data?: Record<string, unknown>) =>
      log('error', message, data, error),
  };
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Log a request/response cycle
 */
export function logRequest(
  logger: Logger,
  request: Request,
  response: Response,
  startTime: number
): void {
  const duration = Date.now() - startTime;
  const url = new URL(request.url);

  logger.info('Request completed', {
    method: request.method,
    path: url.pathname,
    status: response.status,
    duration_ms: duration,
    user_agent: request.headers.get('user-agent') || undefined,
  });
}

/**
 * Log an API error
 */
export function logApiError(
  logger: Logger,
  code: string,
  message: string,
  error?: Error | unknown,
  details?: Record<string, unknown>
): void {
  logger.error(`API Error: ${code}`, error, {
    error_code: code,
    error_message: message,
    ...details,
  });
}

/**
 * Log a database operation
 */
export function logDbOperation(
  logger: Logger,
  operation: string,
  table: string,
  duration?: number,
  rowCount?: number
): void {
  logger.debug('Database operation', {
    operation,
    table,
    duration_ms: duration,
    row_count: rowCount,
  });
}

/**
 * Log an email operation
 */
export function logEmailOperation(
  logger: Logger,
  type: string,
  recipient: string,
  success: boolean,
  resendId?: string,
  error?: string
): void {
  if (success) {
    logger.info('Email sent', {
      email_type: type,
      recipient,
      resend_id: resendId,
    });
  } else {
    logger.error('Email failed', undefined, {
      email_type: type,
      recipient,
      error_message: error,
    });
  }
}

/**
 * Log a scheduled job execution
 */
export function logScheduledJob(
  logger: Logger,
  jobName: string,
  cron: string,
  success: boolean,
  details?: Record<string, unknown>
): void {
  if (success) {
    logger.info('Scheduled job completed', {
      job_name: jobName,
      cron,
      ...details,
    });
  } else {
    logger.error('Scheduled job failed', undefined, {
      job_name: jobName,
      cron,
      ...details,
    });
  }
}
