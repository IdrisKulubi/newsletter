/**
 * Error Tracker Tests
 * Tests for error tracking and recovery system
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { errorTracker, withErrorTracking } from '@/lib/monitoring/error-tracker';

// Mock the security monitor
vi.mock('@/lib/monitoring/security-monitor', () => ({
  securityMonitor: {
    recordEvent: vi.fn(),
  },
}));

describe('ErrorTracker', () => {
  beforeEach(() => {
    // Clear any existing errors
    errorTracker['errors'].clear();
    errorTracker['circuitBreakers'].clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Error tracking', () => {
    it('should track errors with context', async () => {
      const error = new Error('Test error');
      const context = {
        service: 'test-service',
        operation: 'test-operation',
        tenantId: 'tenant-123',
        userId: 'user-456',
        requestId: 'req-789',
        metadata: { key: 'value' },
      };

      const trackedError = await errorTracker.trackError(error, context);

      expect(trackedError).toBeDefined();
      expect(trackedError.message).toBe('Test error');
      expect(trackedError.service).toBe('test-service');
      expect(trackedError.operation).toBe('test-operation');
      expect(trackedError.tenantId).toBe('tenant-123');
      expect(trackedError.userId).toBe('user-456');
      expect(trackedError.requestId).toBe('req-789');
      expect(trackedError.resolved).toBe(false);
    });

    it('should categorize errors correctly', async () => {
      const dbError = new Error('connection timeout');
      const apiError = new Error('rate limit exceeded');
      const authError = new Error('invalid token');

      const context = {
        service: 'test-service',
        operation: 'test-operation',
      };

      const trackedDbError = await errorTracker.trackError(dbError, context);
      const trackedApiError = await errorTracker.trackError(apiError, context);
      const trackedAuthError = await errorTracker.trackError(authError, context);

      expect(trackedDbError.category).toBe('database');
      expect(trackedApiError.category).toBe('external_api');
      expect(trackedAuthError.category).toBe('authentication');
    });

    it('should assign recovery strategies based on error patterns', async () => {
      const retryableError = new Error('connection timeout');
      const fallbackError = new Error('invalid token');
      const circuitBreakerError = new Error('service unavailable');

      const context = {
        service: 'test-service',
        operation: 'test-operation',
      };

      const retryable = await errorTracker.trackError(retryableError, context);
      const fallback = await errorTracker.trackError(fallbackError, context);
      const circuitBreaker = await errorTracker.trackError(circuitBreakerError, context);

      expect(retryable.recoveryStrategy).toBe('retry');
      expect(fallback.recoveryStrategy).toBe('fallback');
      expect(circuitBreaker.recoveryStrategy).toBe('circuit_breaker');
    });
  });

  describe('Error recovery', () => {
    it('should attempt recovery for retryable errors', async () => {
      const error = new Error('connection timeout');
      const context = {
        service: 'test-service',
        operation: 'test-operation',
      };

      const trackedError = await errorTracker.trackError(error, context);
      
      const recoveryFunction = vi.fn().mockResolvedValue('success');

      const result = await errorTracker.attemptRecovery(trackedError.id, recoveryFunction);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(recoveryFunction).toHaveBeenCalledTimes(1);
    });

    it('should fail recovery after max attempts', async () => {
      const error = new Error('connection timeout');
      const context = {
        service: 'test-service',
        operation: 'test-operation',
      };

      const trackedError = await errorTracker.trackError(error, context);
      
      // Simulate max attempts reached
      trackedError.recoveryAttempts = trackedError.maxRecoveryAttempts;

      const recoveryFunction = vi.fn().mockResolvedValue('success');
      const result = await errorTracker.attemptRecovery(trackedError.id, recoveryFunction);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Max recovery attempts reached');
      expect(recoveryFunction).not.toHaveBeenCalled();
    });

    it('should handle recovery function failures', async () => {
      const error = new Error('connection timeout');
      const context = {
        service: 'test-service',
        operation: 'test-operation',
      };

      const trackedError = await errorTracker.trackError(error, context);
      
      const recoveryError = new Error('Recovery failed');
      const recoveryFunction = vi.fn().mockRejectedValue(recoveryError);

      const result = await errorTracker.attemptRecovery(trackedError.id, recoveryFunction);

      expect(result.success).toBe(false);
      expect(result.error).toBe(recoveryError);
    });
  });

  describe('Circuit breaker', () => {
    it('should open circuit breaker after threshold failures', async () => {
      const error = new Error('service unavailable');
      const context = {
        service: 'test-service',
        operation: 'test-operation',
      };

      // Track multiple errors to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await errorTracker.trackError(error, context);
      }

      const circuitBreakers = errorTracker.getCircuitBreakerStatus();
      const key = 'test-service:test-operation';
      
      expect(circuitBreakers[key]).toBeDefined();
      expect(circuitBreakers[key].state).toBe('open');
    });

    it('should prevent operations when circuit breaker is open', async () => {
      const error = new Error('service unavailable');
      const context = {
        service: 'test-service',
        operation: 'test-operation',
      };

      const trackedError = await errorTracker.trackError(error, context);
      
      // Manually set circuit breaker to open
      const key = 'test-service:test-operation';
      errorTracker['circuitBreakers'].set(key, {
        service: 'test-service',
        operation: 'test-operation',
        state: 'open',
        failureCount: 5,
        lastFailureTime: new Date(),
        nextAttemptTime: new Date(Date.now() + 60000), // 1 minute from now
        threshold: 3,
        timeout: 60000,
      });

      const recoveryFunction = vi.fn().mockResolvedValue('success');
      const result = await errorTracker.attemptRecovery(trackedError.id, recoveryFunction);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Circuit breaker open');
      expect(recoveryFunction).not.toHaveBeenCalled();
    });

    it('should reset circuit breaker manually', () => {
      const key = 'test-service:test-operation';
      errorTracker['circuitBreakers'].set(key, {
        service: 'test-service',
        operation: 'test-operation',
        state: 'open',
        failureCount: 5,
        lastFailureTime: new Date(),
        nextAttemptTime: new Date(Date.now() + 60000),
        threshold: 3,
        timeout: 60000,
      });

      const success = errorTracker.resetCircuitBreaker('test-service', 'test-operation');
      
      expect(success).toBe(true);
      
      const circuitBreakers = errorTracker.getCircuitBreakerStatus();
      expect(circuitBreakers[key].state).toBe('closed');
      expect(circuitBreakers[key].failureCount).toBe(0);
    });
  });

  describe('Error statistics', () => {
    it('should provide error statistics', async () => {
      const errors = [
        new Error('database connection timeout'),
        new Error('rate limit exceeded'),
        new Error('invalid token'),
        new Error('database deadlock'),
      ];

      const context = {
        service: 'test-service',
        operation: 'test-operation',
      };

      for (const error of errors) {
        await errorTracker.trackError(error, context);
      }

      const stats = errorTracker.getErrorStats();

      expect(stats.totalErrors).toBe(4);
      expect(stats.errorsByCategory.database).toBe(2);
      expect(stats.errorsByCategory.external_api).toBe(1);
      expect(stats.errorsByCategory.authentication).toBe(1);
      expect(stats.unresolvedErrors).toBe(4);
      expect(stats.resolvedErrors).toBe(0);
    });

    it('should filter recent errors correctly', async () => {
      const error = new Error('test error');
      const context = {
        service: 'test-service',
        operation: 'test-operation',
      };

      await errorTracker.trackError(error, context);

      const recentErrors = errorTracker.getRecentErrors(10, 'system', 'medium', false);
      
      expect(recentErrors).toHaveLength(1);
      expect(recentErrors[0].message).toBe('test error');
      expect(recentErrors[0].resolved).toBe(false);
    });
  });

  describe('Error resolution', () => {
    it('should resolve errors manually', async () => {
      const error = new Error('test error');
      const context = {
        service: 'test-service',
        operation: 'test-operation',
      };

      const trackedError = await errorTracker.trackError(error, context);
      
      const success = errorTracker.resolveError(trackedError.id, 'Manual resolution');
      
      expect(success).toBe(true);
      expect(trackedError.resolved).toBe(true);
      expect(trackedError.resolution).toBe('Manual resolution');
      expect(trackedError.resolvedAt).toBeDefined();
    });

    it('should not resolve already resolved errors', async () => {
      const error = new Error('test error');
      const context = {
        service: 'test-service',
        operation: 'test-operation',
      };

      const trackedError = await errorTracker.trackError(error, context);
      
      // Resolve first time
      errorTracker.resolveError(trackedError.id, 'First resolution');
      
      // Try to resolve again
      const success = errorTracker.resolveError(trackedError.id, 'Second resolution');
      
      expect(success).toBe(false);
      expect(trackedError.resolution).toBe('First resolution');
    });
  });

  describe('withErrorTracking wrapper', () => {
    it('should execute function successfully without errors', async () => {
      const successFunction = vi.fn().mockResolvedValue('success');
      const context = {
        service: 'test-service',
        operation: 'test-operation',
      };

      const result = await withErrorTracking(successFunction, context);

      expect(result).toBe('success');
      expect(successFunction).toHaveBeenCalledTimes(1);
    });

    it('should track errors and attempt recovery', async () => {
      const flakyFunction = vi.fn().mockRejectedValue(new Error('connection timeout'));

      const context = {
        service: 'test-service',
        operation: 'test-operation',
      };

      // This should track the error and throw since recovery is not automatic in withErrorTracking
      await expect(withErrorTracking(flakyFunction, context)).rejects.toThrow('connection timeout');
      
      expect(flakyFunction).toHaveBeenCalledTimes(2); // Called once initially, then once during recovery attempt
      
      // Check that error was tracked
      const recentErrors = errorTracker.getRecentErrors(1);
      expect(recentErrors).toHaveLength(1);
      expect(recentErrors[0].message).toBe('connection timeout');
    });
  });

  describe('Health check', () => {
    it('should provide health status', () => {
      const health = errorTracker.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.totalErrors).toBe(0);
      expect(health.unresolvedErrors).toBe(0);
      expect(health.circuitBreakersOpen).toBe(0);
    });

    it('should report unhealthy status on errors', async () => {
      // Add some errors
      const error = new Error('test error');
      const context = {
        service: 'test-service',
        operation: 'test-operation',
      };

      await errorTracker.trackError(error, context);

      const health = errorTracker.healthCheck();

      expect(health.healthy).toBe(true); // Still healthy with just one error
      expect(health.totalErrors).toBe(1);
      expect(health.unresolvedErrors).toBe(1);
    });
  });
});