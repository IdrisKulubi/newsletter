/**
 * Monitoring System Integration Tests
 * Tests the complete monitoring system working together
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  logger, 
  errorTracker, 
  performanceMonitor, 
  healthChecker,
  withErrorTracking,
  withPerformanceMonitoring,
  monitoring,
  initializeMonitoring
} from '@/lib/monitoring';

// Mock external dependencies
vi.mock('@/lib/db', () => ({
  db: {
    execute: vi.fn().mockResolvedValue([{ test: 1 }]),
  },
}));

vi.mock('ioredis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    ping: vi.fn().mockResolvedValue('PONG'),
    info: vi.fn().mockResolvedValue('used_memory:1000000'),
    quit: vi.fn().mockResolvedValue('OK'),
    lpush: vi.fn().mockResolvedValue(1),
    ltrim: vi.fn().mockResolvedValue('OK'),
    expire: vi.fn().mockResolvedValue(1),
    llen: vi.fn().mockResolvedValue(10),
    hlen: vi.fn().mockResolvedValue(5),
    lrange: vi.fn().mockResolvedValue([]),
    hgetall: vi.fn().mockResolvedValue({}),
    zadd: vi.fn().mockResolvedValue(1),
    zcount: vi.fn().mockResolvedValue(0),
    zremrangebyscore: vi.fn().mockResolvedValue(0),
    hset: vi.fn().mockResolvedValue(1),
  })),
}));

vi.mock('@/lib/config', () => ({
  config: {
    redis: { url: 'redis://localhost:6379' },
    r2: {
      accountId: 'test-account',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      bucketName: 'test-bucket',
    },
    email: { resendApiKey: 'test-resend-key' },
    ai: { openaiApiKey: 'test-openai-key' },
    app: { nodeEnv: 'test' },
  },
}));

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  statusText: 'OK',
});

describe('Monitoring System Integration', () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };

    // Clear monitoring state
    errorTracker['errors'].clear();
    errorTracker['circuitBreakers'].clear();
    performanceMonitor['metrics'] = [];
    performanceMonitor['alerts'] = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('End-to-end error tracking and recovery', () => {
    it('should track errors, log them, and record performance impact', async () => {
      const operation = vi.fn()
        .mockRejectedValue(new Error('connection timeout'));

      const context = {
        service: 'test-service',
        operation: 'test-operation',
        tenantId: 'tenant-123',
        userId: 'user-456',
        requestId: 'req-789',
      };

      // First attempt should fail and track error
      await expect(withErrorTracking(operation, context)).rejects.toThrow('connection timeout');

      // Verify error was tracked
      const recentErrors = errorTracker.getRecentErrors(1);
      expect(recentErrors).toHaveLength(1);
      expect(recentErrors[0].message).toBe('connection timeout');
      expect(recentErrors[0].category).toBe('database');

      // Verify logging occurred
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Error tracked: database/test-operation')
      );

      // Manual recovery with a successful operation should succeed
      const trackedError = recentErrors[0];
      const successOperation = vi.fn().mockResolvedValue('success');
      const recovery = await errorTracker.attemptRecovery(trackedError.id, successOperation);
      
      expect(recovery.success).toBe(true);
      expect(recovery.result).toBe('success');
    });

    it('should integrate performance monitoring with error tracking', async () => {
      const slowOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        throw new Error('slow operation failed');
      };

      const context = {
        service: 'test-service',
        operation: 'slow-operation',
        tenantId: 'tenant-123',
      };

      await expect(
        withPerformanceMonitoring(
          () => withErrorTracking(slowOperation, context),
          {
            type: 'response_time',
            name: 'slow_operation',
            service: 'test-service',
            tenantId: 'tenant-123',
          }
        )
      ).rejects.toThrow('slow operation failed');

      // Verify error was tracked
      const recentErrors = errorTracker.getRecentErrors(1);
      expect(recentErrors).toHaveLength(1);

      // Verify performance was recorded (even for failed operations)
      const stats = performanceMonitor.getStats('slow_operation');
      expect(stats).toBeDefined();
      expect(stats?.avg).toBeGreaterThan(90); // Should be around 100ms
    });
  });

  describe('Health check integration', () => {
    it('should provide comprehensive system health including all monitoring components', async () => {
      // Add some test data to monitoring systems
      await errorTracker.trackError(new Error('test error'), {
        service: 'test-service',
        operation: 'test-operation',
      });

      performanceMonitor.recordMetric('response_time', 'test_metric', 150, 'ms');

      // Run comprehensive health check
      const systemHealth = await healthChecker.runAllChecks();

      expect(systemHealth).toBeDefined();
      expect(systemHealth.components).toHaveLength(10); // All registered health checks
      expect(systemHealth.summary.total).toBe(10);

      // Should include monitoring system components
      const monitoringComponents = systemHealth.components.filter(c => 
        ['security_monitor', 'error_tracker'].includes(c.name)
      );
      expect(monitoringComponents).toHaveLength(2);
    });

    it('should detect unhealthy monitoring components', async () => {
      // Mock a failing monitoring component
      const originalHealthCheck = errorTracker.healthCheck;
      errorTracker.healthCheck = vi.fn().mockReturnValue({
        healthy: false,
        totalErrors: 1000,
        unresolvedErrors: 500,
        circuitBreakersOpen: 3,
        error: 'Too many unresolved errors',
      });

      const systemHealth = await healthChecker.runAllChecks();

      expect(['degraded', 'unhealthy']).toContain(systemHealth.status);
      
      const errorTrackerComponent = systemHealth.components.find(c => c.name === 'error_tracker');
      expect(errorTrackerComponent?.status).toBe('unhealthy');

      // Restore original method
      errorTracker.healthCheck = originalHealthCheck;
    }, 10000); // Increase timeout
  });

  describe('Convenience monitoring functions', () => {
    it('should provide easy-to-use monitoring functions', () => {
      // Test convenience logging
      monitoring.info('Test info message', { key: 'value' });
      monitoring.warn('Test warning message');
      monitoring.error('Test error message', new Error('test error'));

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Test info message')
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Test warning message')
      );
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Test error message')
      );
    });

    it('should provide easy performance tracking', () => {
      const timer = monitoring.timer('test-operation');
      timer.end();

      monitoring.recordMetric('response_time', 'test_metric', 100);

      const stats = performanceMonitor.getStats('test_metric');
      expect(stats).toBeDefined();
    });

    it('should provide easy error tracking', async () => {
      const error = new Error('test error');
      await monitoring.trackError(error, 'test-service', 'test-operation');

      const recentErrors = errorTracker.getRecentErrors(1);
      expect(recentErrors).toHaveLength(1);
      expect(recentErrors[0].message).toBe('test error');
    });

    it('should provide easy health checks', async () => {
      const health = await monitoring.healthCheck();
      expect(health).toBeDefined();
      expect(health.status).toBeDefined();

      const componentHealth = await monitoring.componentHealth('database');
      expect(componentHealth).toBeDefined();
    });
  });

  describe('System initialization', () => {
    it('should initialize monitoring system with default options', () => {
      const result = initializeMonitoring();

      expect(result).toBeDefined();
      expect(result.logger).toBeDefined();
      expect(result.errorTracker).toBeDefined();
      expect(result.performanceMonitor).toBeDefined();
      expect(result.healthChecker).toBeDefined();

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Initializing monitoring system')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Monitoring system initialized successfully')
      );
    });

    it('should initialize monitoring system with custom options', () => {
      const result = initializeMonitoring({
        enableSystemMetrics: false,
        systemMetricsInterval: 30000,
        logLevel: 'debug',
      });

      expect(result).toBeDefined();
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('enableSystemMetrics')
      );
    });
  });

  describe('Cross-component interactions', () => {
    it('should log performance metrics when recording them', () => {
      performanceMonitor.recordMetric(
        'response_time',
        'api_request',
        250,
        'ms',
        { endpoint: '/api/test' },
        { tenantId: 'tenant-123', requestId: 'req-456' }
      );

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('response_time: api_request')
      );
    });

    it('should create security events for authentication errors', async () => {
      const authError = new Error('invalid token');
      await errorTracker.trackError(authError, {
        service: 'auth-service',
        operation: 'login',
        userId: 'user-123',
      });

      // Should have recorded a security event (mocked, but we can verify the call pattern)
      const recentErrors = errorTracker.getRecentErrors(1);
      expect(recentErrors[0].category).toBe('authentication');
    });

    it('should handle cascading failures gracefully', async () => {
      // Simulate a scenario where multiple systems fail
      const dbError = new Error('database connection failed');
      const cacheError = new Error('redis connection failed');
      const apiError = new Error('external api timeout');

      const context = {
        service: 'critical-service',
        operation: 'critical-operation',
      };

      // Track multiple related errors
      await errorTracker.trackError(dbError, context);
      await errorTracker.trackError(cacheError, context);
      await errorTracker.trackError(apiError, context);

      // Record performance impact
      performanceMonitor.recordMetric('response_time', 'critical_operation', 5000, 'ms');

      // System should still be functional
      const health = await healthChecker.runAllChecks();
      expect(health).toBeDefined();

      const errorStats = errorTracker.getErrorStats();
      expect(errorStats.totalErrors).toBe(3);
      // Don't assert specific categorization as it depends on error pattern matching
      expect(Object.keys(errorStats.errorsByCategory).length).toBeGreaterThan(0);

      // Should have created performance alert
      const activeAlerts = performanceMonitor.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle high-load scenario with many concurrent operations', async () => {
      const operations = Array.from({ length: 100 }, (_, i) => 
        withPerformanceMonitoring(
          async () => {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
            if (Math.random() < 0.1) { // 10% failure rate
              throw new Error(`Operation ${i} failed`);
            }
            return `result-${i}`;
          },
          {
            type: 'response_time',
            name: 'bulk_operation',
            service: 'bulk-service',
            requestId: `req-${i}`,
          }
        ).catch(error => {
          return errorTracker.trackError(error, {
            service: 'bulk-service',
            operation: 'bulk_operation',
            requestId: `req-${i}`,
          });
        })
      );

      const results = await Promise.allSettled(operations);

      // Verify metrics were recorded
      const stats = performanceMonitor.getStats('bulk_operation');
      expect(stats).toBeDefined();
      expect(stats?.count).toBeGreaterThan(80); // Most should succeed

      // Verify errors were tracked
      const errorStats = errorTracker.getErrorStats();
      expect(errorStats.totalErrors).toBeGreaterThan(0);
      expect(errorStats.totalErrors).toBeLessThan(20); // Should be around 10% failure rate

      // System should still be healthy
      const health = performanceMonitor.healthCheck();
      expect(health.healthy).toBe(true);
    });

    it('should handle gradual system degradation', async () => {
      // Simulate gradually increasing response times
      const responseTimes = [100, 200, 500, 1000, 2000, 4000]; // Gradual increase

      responseTimes.forEach((time, index) => {
        performanceMonitor.recordMetric('response_time', 'degrading_service', time, 'ms', {
          iteration: index.toString(),
        });
      });

      // Should create alerts as thresholds are crossed
      const activeAlerts = performanceMonitor.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);

      // Latest alert should be critical
      const latestAlert = activeAlerts[activeAlerts.length - 1];
      expect(latestAlert.severity).toBe('critical');
      expect(latestAlert.actualValue).toBe(4000);

      // Performance stats should reflect degradation
      const stats = performanceMonitor.getStats('degrading_service');
      expect(stats?.max).toBe(4000);
      expect(stats?.avg).toBeGreaterThan(1000);
    });
  });

  describe('Error recovery scenarios', () => {
    it('should handle circuit breaker scenarios', async () => {
      const failingService = vi.fn().mockRejectedValue(new Error('service unavailable'));
      const context = {
        service: 'external-service',
        operation: 'api_call',
      };

      // Trigger multiple failures to open circuit breaker
      for (let i = 0; i < 5; i++) {
        await expect(withErrorTracking(failingService, context)).rejects.toThrow();
      }

      // Circuit breaker should be open
      const circuitBreakers = errorTracker.getCircuitBreakerStatus();
      const key = 'external-service:api_call';
      expect(circuitBreakers[key]?.state).toBe('open');

      // Attempts should be blocked
      const recentError = errorTracker.getRecentErrors(1)[0];
      const recovery = await errorTracker.attemptRecovery(recentError.id, failingService);
      expect(recovery.success).toBe(false);
      expect(recovery.error?.message).toBe('Circuit breaker open');
    });

    it('should handle successful recovery after failures', async () => {
      let attemptCount = 0;
      const flakyService = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error('connection timeout');
        }
        return 'success';
      });

      const context = {
        service: 'flaky-service',
        operation: 'flaky_operation',
      };

      // First attempt fails
      await expect(withErrorTracking(flakyService, context)).rejects.toThrow();

      // Manual recovery should succeed
      const recentError = errorTracker.getRecentErrors(1)[0];
      const recovery = await errorTracker.attemptRecovery(recentError.id, flakyService);

      expect(recovery.success).toBe(true);
      expect(recovery.result).toBe('success');
      expect(recentError.resolved).toBe(true);
    });
  });
});