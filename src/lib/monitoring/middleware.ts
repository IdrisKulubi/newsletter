/**
 * Monitoring Middleware
 * Automatically tracks performance metrics, errors, and security events for HTTP requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';
import { performanceMonitor } from './performance-monitor';
import { errorTracker, withErrorTracking } from './error-tracker';
import { securityMonitor, SecurityEvents } from './security-monitor';

export interface MonitoringContext {
  requestId: string;
  tenantId?: string;
  userId?: string;
  startTime: number;
  path: string;
  method: string;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Create monitoring middleware for Next.js API routes
 */
export function withMonitoring<T extends any[]>(
  handler: (...args: T) => Promise<Response | NextResponse>,
  options: {
    service: string;
    operation?: string;
    skipPaths?: string[];
    enableSecurityMonitoring?: boolean;
  } = { service: 'api' }
) {
  return async (...args: T): Promise<Response | NextResponse> => {
    const request = args[0] as NextRequest;
    const context = createMonitoringContext(request);
    
    // Skip monitoring for certain paths
    if (options.skipPaths?.some(path => context.path.includes(path))) {
      return handler(...args);
    }

    const operation = options.operation || `${context.method.toLowerCase()}_${context.path.replace(/\//g, '_')}`;
    
    // Create child logger with context
    const contextLogger = logger.child({
      requestId: context.requestId,
      tenantId: context.tenantId,
      userId: context.userId,
      service: options.service,
    });

    contextLogger.info(`${context.method} ${context.path} started`, {
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
    });

    try {
      // Execute handler with error tracking
      const response = await withErrorTracking(
        () => handler(...args),
        {
          service: options.service,
          operation,
          tenantId: context.tenantId,
          userId: context.userId,
          requestId: context.requestId,
          metadata: {
            path: context.path,
            method: context.method,
            userAgent: context.userAgent,
            ipAddress: context.ipAddress,
          },
        }
      );

      const duration = Date.now() - context.startTime;
      const statusCode = getStatusCode(response);

      // Record performance metrics
      performanceMonitor.recordHttpRequest(
        context.method,
        context.path,
        statusCode,
        duration,
        {
          tenantId: context.tenantId,
          userId: context.userId,
          requestId: context.requestId,
        }
      );

      // Log request completion
      contextLogger.httpRequest(
        context.method,
        context.path,
        statusCode,
        duration,
        {
          responseSize: getResponseSize(response),
        }
      );

      // Security monitoring
      if (options.enableSecurityMonitoring !== false) {
        await monitorSecurityEvents(context, statusCode, duration);
      }

      return response;

    } catch (error) {
      const duration = Date.now() - context.startTime;
      const statusCode = 500;

      // Record error metrics
      performanceMonitor.recordHttpRequest(
        context.method,
        context.path,
        statusCode,
        duration,
        {
          tenantId: context.tenantId,
          userId: context.userId,
          requestId: context.requestId,
        }
      );

      // Log error
      contextLogger.error(
        `${context.method} ${context.path} failed`,
        error as Error,
        {
          duration,
          statusCode,
        }
      );

      // Security monitoring for errors
      if (options.enableSecurityMonitoring !== false) {
        await monitorSecurityEvents(context, statusCode, duration, error as Error);
      }

      // Re-throw error to maintain normal error handling
      throw error;
    }
  };
}

/**
 * Create monitoring context from request
 */
function createMonitoringContext(request: NextRequest): MonitoringContext {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  
  // Extract tenant and user info from headers or URL
  const tenantId = request.headers.get('x-tenant-id') || undefined;
  const userId = request.headers.get('x-user-id') || undefined;
  
  // Get client info
  const userAgent = request.headers.get('user-agent') || undefined;
  const ipAddress = getClientIP(request);

  return {
    requestId,
    tenantId,
    userId,
    startTime: Date.now(),
    path: url.pathname,
    method: request.method,
    userAgent,
    ipAddress,
  };
}

/**
 * Extract client IP address
 */
function getClientIP(request: NextRequest): string {
  // Check various headers for client IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  return 'unknown';
}

/**
 * Get status code from response
 */
function getStatusCode(response: Response | NextResponse): number {
  return response.status || 200;
}

/**
 * Get response size (simplified)
 */
function getResponseSize(response: Response | NextResponse): number {
  const contentLength = response.headers.get('content-length');
  return contentLength ? parseInt(contentLength, 10) : 0;
}

/**
 * Monitor security events based on request/response
 */
async function monitorSecurityEvents(
  context: MonitoringContext,
  statusCode: number,
  duration: number,
  error?: Error
): Promise<void> {
  const source = context.ipAddress || 'unknown';

  // Monitor authentication failures
  if (statusCode === 401) {
    await SecurityEvents.suspiciousLogin(source, {
      path: context.path,
      method: context.method,
      userAgent: context.userAgent,
      duration,
    }, context.userId);
  }

  // Monitor authorization failures
  if (statusCode === 403) {
    await SecurityEvents.unauthorizedAccess(source, {
      path: context.path,
      method: context.method,
      userAgent: context.userAgent,
      duration,
    }, context.tenantId, context.userId);
  }

  // Monitor rate limiting
  if (statusCode === 429) {
    await SecurityEvents.rateLimitExceeded(source, {
      path: context.path,
      method: context.method,
      userAgent: context.userAgent,
      duration,
    }, context.tenantId);
  }

  // Monitor server errors
  if (statusCode >= 500) {
    await securityMonitor.recordEvent({
      type: 'malicious_input_detected',
      severity: 'medium',
      source,
      details: {
        path: context.path,
        method: context.method,
        statusCode,
        error: error?.message,
        userAgent: context.userAgent,
        duration,
      },
      tenantId: context.tenantId,
      userId: context.userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }

  // Monitor slow requests (potential DoS)
  if (duration > 10000) { // 10 seconds
    await securityMonitor.recordEvent({
      type: 'suspicious_login_attempt',
      severity: 'low',
      source,
      details: {
        path: context.path,
        method: context.method,
        duration,
        userAgent: context.userAgent,
        reason: 'slow_request',
      },
      tenantId: context.tenantId,
      userId: context.userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }
}

/**
 * Express-style middleware for monitoring
 */
export function createExpressMonitoringMiddleware(options: {
  service: string;
  enableSecurityMonitoring?: boolean;
}) {
  return (req: any, res: any, next: any) => {
    const context = {
      requestId: crypto.randomUUID(),
      tenantId: req.headers['x-tenant-id'],
      userId: req.headers['x-user-id'],
      startTime: Date.now(),
      path: req.path || req.url,
      method: req.method,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.connection.remoteAddress,
    };

    // Add context to request
    req.monitoringContext = context;

    // Create child logger
    req.logger = logger.child({
      requestId: context.requestId,
      tenantId: context.tenantId,
      userId: context.userId,
      service: options.service,
    });

    req.logger.info(`${context.method} ${context.path} started`);

    // Override res.end to capture response
    const originalEnd = res.end;
    res.end = function(chunk: any, encoding: any) {
      const duration = Date.now() - context.startTime;
      const statusCode = res.statusCode;

      // Record metrics
      performanceMonitor.recordHttpRequest(
        context.method,
        context.path,
        statusCode,
        duration,
        {
          tenantId: context.tenantId,
          userId: context.userId,
          requestId: context.requestId,
        }
      );

      // Log completion
      req.logger.httpRequest(
        context.method,
        context.path,
        statusCode,
        duration
      );

      // Security monitoring
      if (options.enableSecurityMonitoring !== false) {
        monitorSecurityEvents(context, statusCode, duration).catch(error => {
          console.error('Security monitoring failed:', error);
        });
      }

      originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}

/**
 * Utility function to wrap any async function with monitoring
 */
export async function withPerformanceMonitoring<T>(
  operation: () => Promise<T>,
  context: {
    type: string;
    name: string;
    service: string;
    tenantId?: string;
    userId?: string;
    requestId?: string;
    tags?: Record<string, string>;
  }
): Promise<T> {
  const timer = performanceMonitor.timer(
    context.type as any,
    context.name,
    context.tags,
    {
      tenantId: context.tenantId,
      userId: context.userId,
      requestId: context.requestId,
    }
  );

  try {
    const result = await operation();
    timer.end();
    return result;
  } catch (error) {
    timer.end();
    throw error;
  }
}