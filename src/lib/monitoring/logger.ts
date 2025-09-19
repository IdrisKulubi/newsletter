/**
 * Structured Logging System
 * Provides comprehensive logging with different levels, structured data, and error tracking
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  tenantId?: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    duration: number;
    memoryUsage: number;
    cpuUsage?: number;
  };
}

export interface LoggerConfig {
  level: LogLevel;
  service: string;
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
  maxFileSize: number;
  maxFiles: number;
}

class Logger {
  private config: LoggerConfig;
  private logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
  };

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: 'info',
      service: 'newsletter-platform',
      enableConsole: true,
      enableFile: false,
      enableRemote: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      ...config,
    };
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Partial<Pick<LogEntry, 'service' | 'tenantId' | 'userId' | 'requestId'>>): Logger {
    const childLogger = new Logger(this.config);
    childLogger.defaultContext = { ...this.defaultContext, ...context };
    return childLogger;
  }

  private defaultContext: Partial<LogEntry> = {};

  /**
   * Log a debug message
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }

  /**
   * Log an info message
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  /**
   * Log a warning message
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    const errorData = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
    } : undefined;

    this.log('error', message, metadata, errorData);
  }

  /**
   * Log a fatal error message
   */
  fatal(message: string, error?: Error, metadata?: Record<string, any>): void {
    const errorData = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
    } : undefined;

    this.log('fatal', message, metadata, errorData);
  }

  /**
   * Log with performance metrics
   */
  performance(
    message: string,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    const performance = {
      duration,
      memoryUsage: process.memoryUsage().heapUsed,
      cpuUsage: process.cpuUsage().user,
    };

    this.log('info', message, metadata, undefined, performance);
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    error?: LogEntry['error'],
    performance?: LogEntry['performance']
  ): void {
    // Check if log level is enabled
    if (this.logLevels[level] < this.logLevels[this.config.level]) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.config.service,
      ...this.defaultContext,
      metadata,
      error,
      performance,
    };

    // Output to console
    if (this.config.enableConsole) {
      this.logToConsole(logEntry);
    }

    // Output to file (in production, you might use a proper file logger)
    if (this.config.enableFile) {
      this.logToFile(logEntry);
    }

    // Send to remote logging service
    if (this.config.enableRemote && this.config.remoteEndpoint) {
      this.logToRemote(logEntry);
    }
  }

  /**
   * Log to console with appropriate formatting
   */
  private logToConsole(entry: LogEntry): void {
    const { timestamp, level, message, service, tenantId, userId, requestId, metadata, error, performance } = entry;
    
    // Create context string
    const context = [
      service,
      tenantId && `tenant:${tenantId}`,
      userId && `user:${userId}`,
      requestId && `req:${requestId}`,
    ].filter(Boolean).join(' ');

    // Format message
    const formattedMessage = `[${timestamp}] ${level.toUpperCase()} [${context}] ${message}`;

    // Choose console method based on level
    const consoleMethod = level === 'error' || level === 'fatal' ? console.error :
                         level === 'warn' ? console.warn :
                         console.log;

    consoleMethod(formattedMessage);

    // Log additional data
    if (metadata && Object.keys(metadata).length > 0) {
      consoleMethod('  Metadata:', JSON.stringify(metadata, null, 2));
    }

    if (error) {
      consoleMethod('  Error:', error);
    }

    if (performance) {
      consoleMethod('  Performance:', {
        duration: `${performance.duration}ms`,
        memory: `${Math.round(performance.memoryUsage / 1024 / 1024)}MB`,
        cpu: performance.cpuUsage ? `${performance.cpuUsage}μs` : undefined,
      });
    }
  }

  /**
   * Log to file (simplified implementation)
   */
  private logToFile(entry: LogEntry): void {
    // In a production environment, you would use a proper file logging library
    // like winston, pino, or bunyan with rotation, compression, etc.
    try {
      const logLine = JSON.stringify(entry) + '\n';
      // This is a simplified implementation - in production use proper file logging
      if (typeof window === 'undefined') {
        // Server-side only
        require('fs').appendFileSync('app.log', logLine);
      }
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Send logs to remote service
   */
  private async logToRemote(entry: LogEntry): Promise<void> {
    try {
      if (!this.config.remoteEndpoint) return;

      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      // Don't log this error to avoid infinite loops
      console.error('Failed to send log to remote service:', error);
    }
  }

  /**
   * Create a timer for measuring operation duration
   */
  timer(operation: string): {
    end: (message?: string, metadata?: Record<string, any>) => void;
  } {
    const start = Date.now();
    
    return {
      end: (message?: string, metadata?: Record<string, any>) => {
        const duration = Date.now() - start;
        this.performance(
          message || `${operation} completed`,
          duration,
          { operation, ...metadata }
        );
      },
    };
  }

  /**
   * Log HTTP request
   */
  httpRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    
    this.log(level, `${method} ${url} ${statusCode}`, {
      http: {
        method,
        url,
        statusCode,
        duration,
      },
      ...metadata,
    });
  }

  /**
   * Log database operation
   */
  dbOperation(
    operation: string,
    table: string,
    duration: number,
    rowsAffected?: number,
    metadata?: Record<string, any>
  ): void {
    this.performance(`DB ${operation} on ${table}`, duration, {
      database: {
        operation,
        table,
        rowsAffected,
      },
      ...metadata,
    });
  }

  /**
   * Log external API call
   */
  apiCall(
    service: string,
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    
    this.log(level, `API call to ${service}`, {
      api: {
        service,
        endpoint,
        method,
        statusCode,
        duration,
      },
      ...metadata,
    });
  }

  /**
   * Log security event
   */
  security(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata?: Record<string, any>
  ): void {
    const level = severity === 'critical' ? 'fatal' : 
                 severity === 'high' ? 'error' :
                 severity === 'medium' ? 'warn' : 'info';

    this.log(level, `Security event: ${event}`, {
      security: {
        event,
        severity,
      },
      ...metadata,
    });
  }

  /**
   * Log business event
   */
  business(
    event: string,
    metadata?: Record<string, any>
  ): void {
    this.info(`Business event: ${event}`, {
      business: {
        event,
      },
      ...metadata,
    });
  }
}

// Create default logger instance
export const logger = new Logger({
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  service: 'newsletter-platform',
  enableConsole: true,
  enableFile: process.env.NODE_ENV === 'production',
  enableRemote: !!process.env.REMOTE_LOG_ENDPOINT,
  remoteEndpoint: process.env.REMOTE_LOG_ENDPOINT,
});

// Export logger class for custom instances
export { Logger };

// Convenience functions for common logging patterns
export const log = {
  debug: (message: string, metadata?: Record<string, any>) => logger.debug(message, metadata),
  info: (message: string, metadata?: Record<string, any>) => logger.info(message, metadata),
  warn: (message: string, metadata?: Record<string, any>) => logger.warn(message, metadata),
  error: (message: string, error?: Error, metadata?: Record<string, any>) => logger.error(message, error, metadata),
  fatal: (message: string, error?: Error, metadata?: Record<string, any>) => logger.fatal(message, error, metadata),
  performance: (message: string, duration: number, metadata?: Record<string, any>) => logger.performance(message, duration, metadata),
  timer: (operation: string) => logger.timer(operation),
  httpRequest: (method: string, url: string, statusCode: number, duration: number, metadata?: Record<string, any>) => 
    logger.httpRequest(method, url, statusCode, duration, metadata),
  dbOperation: (operation: string, table: string, duration: number, rowsAffected?: number, metadata?: Record<string, any>) => 
    logger.dbOperation(operation, table, duration, rowsAffected, metadata),
  apiCall: (service: string, endpoint: string, method: string, statusCode: number, duration: number, metadata?: Record<string, any>) => 
    logger.apiCall(service, endpoint, method, statusCode, duration, metadata),
  security: (event: string, severity: 'low' | 'medium' | 'high' | 'critical', metadata?: Record<string, any>) => 
    logger.security(event, severity, metadata),
  business: (event: string, metadata?: Record<string, any>) => logger.business(event, metadata),
};