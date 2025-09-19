/**
 * Error Tracking and Recovery System
 * Provides comprehensive error tracking, categorization, and recovery mechanisms
 */

import { logger } from './logger';
import { securityMonitor } from './security-monitor';

export type ErrorCategory = 
  | 'database'
  | 'external_api'
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'business_logic'
  | 'system'
  | 'network'
  | 'rate_limit'
  | 'storage'
  | 'queue'
  | 'ai_service'
  | 'email_service';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type RecoveryStrategy = 
  | 'retry'
  | 'fallback'
  | 'circuit_breaker'
  | 'graceful_degradation'
  | 'manual_intervention'
  | 'ignore';

export interface TrackedError {
  id: string;
  timestamp: Date;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  code?: string;
  service: string;
  operation: string;
  tenantId?: string;
  userId?: string;
  requestId?: string;
  metadata: Record<string, any>;
  recoveryStrategy: RecoveryStrategy;
  recoveryAttempts: number;
  maxRecoveryAttempts: number;
  resolved: boolean;
  resolvedAt?: Date;
  resolution?: string;
}

export interface ErrorPattern {
  category: ErrorCategory;
  messagePattern: RegExp;
  severity: ErrorSeverity;
  recoveryStrategy: RecoveryStrategy;
  maxRetries: number;
  retryDelay: number;
  circuitBreakerThreshold: number;
}

export interface CircuitBreakerState {
  service: string;
  operation: string;
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: Date;
  nextAttemptTime: Date;
  threshold: number;
  timeout: number;
}

class ErrorTracker {
  private errors: Map<string, TrackedError> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private errorPatterns: ErrorPattern[] = [];
  private maxErrorHistory = 10000;

  constructor() {
    this.initializeErrorPatterns();
  }

  /**
   * Initialize common error patterns and recovery strategies
   */
  private initializeErrorPatterns(): void {
    this.errorPatterns = [
      // Database errors
      {
        category: 'database',
        messagePattern: /connection.*timeout|connection.*refused|connection.*lost/i,
        severity: 'high',
        recoveryStrategy: 'retry',
        maxRetries: 3,
        retryDelay: 1000,
        circuitBreakerThreshold: 5,
      },
      {
        category: 'database',
        messagePattern: /deadlock|lock.*timeout/i,
        severity: 'medium',
        recoveryStrategy: 'retry',
        maxRetries: 5,
        retryDelay: 500,
        circuitBreakerThreshold: 10,
      },
      
      // External API errors
      {
        category: 'external_api',
        messagePattern: /rate.*limit|too.*many.*requests/i,
        severity: 'medium',
        recoveryStrategy: 'retry',
        maxRetries: 3,
        retryDelay: 5000,
        circuitBreakerThreshold: 3,
      },
      {
        category: 'external_api',
        messagePattern: /service.*unavailable|gateway.*timeout/i,
        severity: 'high',
        recoveryStrategy: 'circuit_breaker',
        maxRetries: 2,
        retryDelay: 2000,
        circuitBreakerThreshold: 3,
      },
      
      // Authentication errors
      {
        category: 'authentication',
        messagePattern: /invalid.*token|token.*expired|unauthorized/i,
        severity: 'medium',
        recoveryStrategy: 'fallback',
        maxRetries: 1,
        retryDelay: 0,
        circuitBreakerThreshold: 10,
      },
      
      // Storage errors
      {
        category: 'storage',
        messagePattern: /access.*denied|permission.*denied|quota.*exceeded/i,
        severity: 'high',
        recoveryStrategy: 'manual_intervention',
        maxRetries: 0,
        retryDelay: 0,
        circuitBreakerThreshold: 1,
      },
      
      // Queue errors
      {
        category: 'queue',
        messagePattern: /job.*failed|queue.*connection|redis.*error/i,
        severity: 'medium',
        recoveryStrategy: 'retry',
        maxRetries: 3,
        retryDelay: 2000,
        circuitBreakerThreshold: 5,
      },
      
      // AI service errors
      {
        category: 'ai_service',
        messagePattern: /openai.*error|ai.*service.*unavailable/i,
        severity: 'medium',
        recoveryStrategy: 'graceful_degradation',
        maxRetries: 2,
        retryDelay: 3000,
        circuitBreakerThreshold: 5,
      },
      
      // Email service errors
      {
        category: 'email_service',
        messagePattern: /resend.*error|email.*delivery.*failed/i,
        severity: 'high',
        recoveryStrategy: 'retry',
        maxRetries: 3,
        retryDelay: 5000,
        circuitBreakerThreshold: 3,
      },
    ];
  }

  /**
   * Track an error and determine recovery strategy
   */
  async trackError(
    error: Error,
    context: {
      service: string;
      operation: string;
      tenantId?: string;
      userId?: string;
      requestId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<TrackedError> {
    const pattern = this.matchErrorPattern(error);
    const trackedError: TrackedError = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      category: pattern?.category || 'system',
      severity: pattern?.severity || 'medium',
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
      service: context.service,
      operation: context.operation,
      tenantId: context.tenantId,
      userId: context.userId,
      requestId: context.requestId,
      metadata: context.metadata || {},
      recoveryStrategy: pattern?.recoveryStrategy || 'manual_intervention',
      recoveryAttempts: 0,
      maxRecoveryAttempts: pattern?.maxRetries || 0,
      resolved: false,
    };

    // Store error
    this.errors.set(trackedError.id, trackedError);
    
    // Maintain error history limit
    if (this.errors.size > this.maxErrorHistory) {
      const oldestKey = this.errors.keys().next().value;
      this.errors.delete(oldestKey);
    }

    // Log error
    logger.error(
      `Error tracked: ${trackedError.category}/${trackedError.operation}`,
      error,
      {
        errorId: trackedError.id,
        category: trackedError.category,
        severity: trackedError.severity,
        recoveryStrategy: trackedError.recoveryStrategy,
        ...context,
      }
    );

    // Record security event for certain error types
    if (trackedError.category === 'authentication' || trackedError.category === 'authorization') {
      await securityMonitor.recordEvent({
        type: 'unauthorized_access_attempt',
        severity: trackedError.severity === 'critical' ? 'critical' : 'high',
        source: context.requestId || 'unknown',
        details: {
          error: error.message,
          service: context.service,
          operation: context.operation,
        },
        tenantId: context.tenantId,
        userId: context.userId,
      });
    }

    // Update circuit breaker state
    if (pattern && pattern.recoveryStrategy === 'circuit_breaker') {
      await this.updateCircuitBreaker(context.service, context.operation, pattern);
    }

    return trackedError;
  }

  /**
   * Match error against known patterns
   */
  private matchErrorPattern(error: Error): ErrorPattern | null {
    for (const pattern of this.errorPatterns) {
      if (pattern.messagePattern.test(error.message)) {
        return pattern;
      }
    }
    return null;
  }

  /**
   * Attempt error recovery
   */
  async attemptRecovery<T>(
    errorId: string,
    recoveryFunction: () => Promise<T>
  ): Promise<{ success: boolean; result?: T; error?: Error }> {
    const trackedError = this.errors.get(errorId);
    if (!trackedError) {
      return { success: false, error: new Error('Error not found') };
    }

    if (trackedError.recoveryAttempts >= trackedError.maxRecoveryAttempts) {
      logger.warn(`Max recovery attempts reached for error ${errorId}`);
      return { success: false, error: new Error('Max recovery attempts reached') };
    }

    // Check circuit breaker
    const circuitBreakerKey = `${trackedError.service}:${trackedError.operation}`;
    const circuitBreaker = this.circuitBreakers.get(circuitBreakerKey);
    if (circuitBreaker && circuitBreaker.state === 'open') {
      if (Date.now() < circuitBreaker.nextAttemptTime.getTime()) {
        logger.warn(`Circuit breaker open for ${circuitBreakerKey}`);
        return { success: false, error: new Error('Circuit breaker open') };
      } else {
        // Transition to half-open
        circuitBreaker.state = 'half-open';
        logger.info(`Circuit breaker transitioning to half-open for ${circuitBreakerKey}`);
      }
    }

    trackedError.recoveryAttempts++;

    try {
      // Apply recovery delay
      const pattern = this.errorPatterns.find(p => p.category === trackedError.category);
      if (pattern && pattern.retryDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, pattern.retryDelay));
      }

      const result = await recoveryFunction();
      
      // Mark as resolved
      trackedError.resolved = true;
      trackedError.resolvedAt = new Date();
      trackedError.resolution = 'Automatic recovery successful';

      // Reset circuit breaker on success
      if (circuitBreaker) {
        circuitBreaker.state = 'closed';
        circuitBreaker.failureCount = 0;
      }

      logger.info(`Error recovery successful for ${errorId}`, {
        errorId,
        attempts: trackedError.recoveryAttempts,
        strategy: trackedError.recoveryStrategy,
      });

      return { success: true, result };
    } catch (recoveryError) {
      logger.error(`Error recovery failed for ${errorId}`, recoveryError as Error, {
        errorId,
        attempts: trackedError.recoveryAttempts,
        strategy: trackedError.recoveryStrategy,
      });

      // Update circuit breaker on failure
      if (circuitBreaker) {
        circuitBreaker.failureCount++;
        circuitBreaker.lastFailureTime = new Date();
        
        if (circuitBreaker.failureCount >= circuitBreaker.threshold) {
          circuitBreaker.state = 'open';
          circuitBreaker.nextAttemptTime = new Date(Date.now() + circuitBreaker.timeout);
          logger.warn(`Circuit breaker opened for ${circuitBreakerKey}`);
        }
      }

      return { success: false, error: recoveryError as Error };
    }
  }

  /**
   * Update circuit breaker state
   */
  private async updateCircuitBreaker(
    service: string,
    operation: string,
    pattern: ErrorPattern
  ): Promise<void> {
    const key = `${service}:${operation}`;
    let circuitBreaker = this.circuitBreakers.get(key);

    if (!circuitBreaker) {
      circuitBreaker = {
        service,
        operation,
        state: 'closed',
        failureCount: 0,
        lastFailureTime: new Date(),
        nextAttemptTime: new Date(),
        threshold: pattern.circuitBreakerThreshold,
        timeout: 60000, // 1 minute default
      };
      this.circuitBreakers.set(key, circuitBreaker);
    }

    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = new Date();

    if (circuitBreaker.failureCount >= circuitBreaker.threshold && circuitBreaker.state === 'closed') {
      circuitBreaker.state = 'open';
      circuitBreaker.nextAttemptTime = new Date(Date.now() + circuitBreaker.timeout);
      
      logger.warn(`Circuit breaker opened for ${key}`, {
        service,
        operation,
        failureCount: circuitBreaker.failureCount,
        threshold: circuitBreaker.threshold,
      });
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(timeRange: number = 24 * 60 * 60 * 1000): {
    totalErrors: number;
    errorsByCategory: Record<ErrorCategory, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    resolvedErrors: number;
    unresolvedErrors: number;
    topErrors: Array<{ message: string; count: number; category: ErrorCategory }>;
  } {
    const cutoff = new Date(Date.now() - timeRange);
    const recentErrors = Array.from(this.errors.values())
      .filter(error => error.timestamp >= cutoff);

    const errorsByCategory = recentErrors.reduce((acc, error) => {
      acc[error.category] = (acc[error.category] || 0) + 1;
      return acc;
    }, {} as Record<ErrorCategory, number>);

    const errorsBySeverity = recentErrors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<ErrorSeverity, number>);

    const resolvedErrors = recentErrors.filter(error => error.resolved).length;
    const unresolvedErrors = recentErrors.length - resolvedErrors;

    // Group by message for top errors
    const errorCounts = recentErrors.reduce((acc, error) => {
      const key = error.message;
      if (!acc[key]) {
        acc[key] = { count: 0, category: error.category };
      }
      acc[key].count++;
      return acc;
    }, {} as Record<string, { count: number; category: ErrorCategory }>);

    const topErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([message, data]) => ({
        message,
        count: data.count,
        category: data.category,
      }));

    return {
      totalErrors: recentErrors.length,
      errorsByCategory,
      errorsBySeverity,
      resolvedErrors,
      unresolvedErrors,
      topErrors,
    };
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): Record<string, CircuitBreakerState> {
    const status: Record<string, CircuitBreakerState> = {};
    for (const [key, state] of this.circuitBreakers.entries()) {
      status[key] = { ...state };
    }
    return status;
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(service: string, operation: string): boolean {
    const key = `${service}:${operation}`;
    const circuitBreaker = this.circuitBreakers.get(key);
    
    if (circuitBreaker) {
      circuitBreaker.state = 'closed';
      circuitBreaker.failureCount = 0;
      circuitBreaker.nextAttemptTime = new Date();
      
      logger.info(`Circuit breaker reset for ${key}`);
      return true;
    }
    
    return false;
  }

  /**
   * Get recent errors
   */
  getRecentErrors(
    limit: number = 100,
    category?: ErrorCategory,
    severity?: ErrorSeverity,
    resolved?: boolean
  ): TrackedError[] {
    return Array.from(this.errors.values())
      .filter(error => {
        if (category && error.category !== category) return false;
        if (severity && error.severity !== severity) return false;
        if (resolved !== undefined && error.resolved !== resolved) return false;
        return true;
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Resolve error manually
   */
  resolveError(errorId: string, resolution: string): boolean {
    const error = this.errors.get(errorId);
    if (error && !error.resolved) {
      error.resolved = true;
      error.resolvedAt = new Date();
      error.resolution = resolution;
      
      logger.info(`Error manually resolved: ${errorId}`, {
        errorId,
        resolution,
      });
      
      return true;
    }
    return false;
  }

  /**
   * Health check for error tracker
   */
  healthCheck(): {
    healthy: boolean;
    totalErrors: number;
    unresolvedErrors: number;
    circuitBreakersOpen: number;
    error?: string;
  } {
    try {
      const totalErrors = this.errors.size;
      const unresolvedErrors = Array.from(this.errors.values())
        .filter(error => !error.resolved).length;
      const circuitBreakersOpen = Array.from(this.circuitBreakers.values())
        .filter(cb => cb.state === 'open').length;

      return {
        healthy: true,
        totalErrors,
        unresolvedErrors,
        circuitBreakersOpen,
      };
    } catch (error) {
      return {
        healthy: false,
        totalErrors: 0,
        unresolvedErrors: 0,
        circuitBreakersOpen: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const errorTracker = new ErrorTracker();

// Convenience wrapper for tracking and recovering from errors
export async function withErrorTracking<T>(
  operation: () => Promise<T>,
  context: {
    service: string;
    operation: string;
    tenantId?: string;
    userId?: string;
    requestId?: string;
    metadata?: Record<string, any>;
  }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const trackedError = await errorTracker.trackError(error as Error, context);
    
    // Attempt automatic recovery if strategy allows
    if (trackedError.recoveryStrategy === 'retry' && trackedError.maxRecoveryAttempts > 0) {
      const recovery = await errorTracker.attemptRecovery(trackedError.id, operation);
      if (recovery.success && recovery.result !== undefined) {
        return recovery.result;
      }
    }
    
    // Re-throw original error if recovery fails or not applicable
    throw error;
  }
}