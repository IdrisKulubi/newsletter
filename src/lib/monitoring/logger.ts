/**
 * Production logging configuration
 * Structured logging with different levels and formats
 */

import { config } from '../config';

export interface LogContext {
  tenantId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: any;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

class Logger {
  private logLevel: LogLevel;

  constructor() {
    this.logLevel = config.monitoring.logLevel as LogLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };

    return levels[level] <= levels[this.logLevel];
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...context,
      environment: config.app.nodeEnv,
    };

    return JSON.stringify(logEntry);
  }

  error(message: string, context?: LogContext) {
    if (this.shouldLog('error')) {
      console.error(this.formatLog('error', message, context));
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatLog('warn', message, context));
    }
  }

  info(message: string, context?: LogContext) {
    if (this.shouldLog('info')) {
      console.info(this.formatLog('info', message, context));
    }
  }

  debug(message: string, context?: LogContext) {
    if (this.shouldLog('debug')) {
      console.debug(this.formatLog('debug', message, context));
    }
  }

  // Specialized logging methods
  logApiRequest(method: string, path: string, statusCode: number, duration: number, context?: LogContext) {
    this.info('API Request', {
      type: 'api_request',
      method,
      path,
      statusCode,
      duration,
      ...context,
    });
  }

  logDatabaseQuery(query: string, duration: number, context?: LogContext) {
    this.debug('Database Query', {
      type: 'database_query',
      query: query.substring(0, 200), // Truncate long queries
      duration,
      ...context,
    });
  }

  logEmailSent(campaignId: string, recipientEmail: string, context?: LogContext) {
    this.info('Email Sent', {
      type: 'email_sent',
      campaignId,
      recipientEmail: this.maskEmail(recipientEmail),
      ...context,
    });
  }

  logEmailFailed(campaignId: string, recipientEmail: string, error: string, context?: LogContext) {
    this.error('Email Failed', {
      type: 'email_failed',
      campaignId,
      recipientEmail: this.maskEmail(recipientEmail),
      error,
      ...context,
    });
  }

  logAIRequest(type: string, duration: number, tokensUsed?: number, context?: LogContext) {
    this.info('AI Request', {
      type: 'ai_request',
      aiType: type,
      duration,
      tokensUsed,
      ...context,
    });
  }

  logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high', context?: LogContext) {
    this.warn('Security Event', {
      type: 'security_event',
      event,
      severity,
      ...context,
    });
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `${local}***@${domain}`;
    return `${local.substring(0, 2)}***@${domain}`;
  }
}

export const logger = new Logger();