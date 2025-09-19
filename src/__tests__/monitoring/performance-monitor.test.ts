/**
 * Performance Monitor Tests
 * Tests for the performance monitoring and metrics collection system
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    // Clear metrics and alerts
    performanceMonitor['metrics'] = [];
    performanceMonitor['alerts'] = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Metric recording', () => {
    it('should record performance metrics', () => {
      performanceMonitor.recordMetric(
        'response_time',
        'api_request',
        150,
        'ms',
        { endpoint: '/api/test' },
        { tenantId: 'tenant-123', userId: 'user-456' }
      );

      const stats = performanceMonitor.getStats('api_request');
      
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(1);
      expect(stats?.avg).toBe(150);
      expect(stats?.min).toBe(150);
      expect(stats?.max).toBe(150);
      expect(stats?.unit).toBe('ms');
    });

    it('should record multiple metrics and calculate statistics', () => {
      const values = [100, 150, 200, 250, 300];
      
      values.forEach(value => {
        performanceMonitor.recordMetric('response_time', 'api_request', value, 'ms');
      });

      const stats = performanceMonitor.getStats('api_request');
      
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(5);
      expect(stats?.min).toBe(100);
      expect(stats?.max).toBe(300);
      expect(stats?.avg).toBe(200);
      expect(stats?.p50).toBe(200);
      expect(stats?.p95).toBe(300);
      expect(stats?.p99).toBe(300);
    });

    it('should maintain metrics limit', () => {
      const maxMetrics = performanceMonitor['maxMetrics'];
      
      // Record more metrics than the limit
      for (let i = 0; i < maxMetrics + 100; i++) {
        performanceMonitor.recordMetric('response_time', 'test_metric', i, 'ms');
      }

      expect(performanceMonitor['metrics'].length).toBeLessThanOrEqual(maxMetrics);
    });
  });

  describe('Timer functionality', () => {
    it('should create and use timer', async () => {
      const timer = performanceMonitor.timer('response_time', 'test_operation');
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));
      
      timer.end();

      const stats = performanceMonitor.getStats('test_operation');
      
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(1);
      expect(stats?.avg).toBeGreaterThan(0);
    });

    it('should record timer with context', () => {
      const timer = performanceMonitor.timer(
        'database_query',
        'user_lookup',
        { table: 'users' },
        { tenantId: 'tenant-123' }
      );
      
      timer.end();

      const stats = performanceMonitor.getStats('user_lookup');
      
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(1);
    });
  });

  describe('Specialized metric recording', () => {
    it('should record HTTP request metrics', () => {
      performanceMonitor.recordHttpRequest(
        'GET',
        '/api/users',
        200,
        150,
        { tenantId: 'tenant-123' }
      );

      const stats = performanceMonitor.getStats('http_request');
      
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(1);
      expect(stats?.avg).toBe(150);
    });

    it('should record database query metrics', () => {
      performanceMonitor.recordDatabaseQuery(
        'SELECT',
        'users',
        75,
        10,
        { tenantId: 'tenant-123' }
      );

      const stats = performanceMonitor.getStats('db_SELECT');
      
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(1);
      expect(stats?.avg).toBe(75);
    });

    it('should record external API call metrics', () => {
      performanceMonitor.recordExternalApiCall(
        'openai',
        '/completions',
        'POST',
        200,
        2500,
        { tenantId: 'tenant-123' }
      );

      const stats = performanceMonitor.getStats('api_openai');
      
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(1);
      expect(stats?.avg).toBe(2500);
    });

    it('should record cache metrics', () => {
      performanceMonitor.recordCacheMetrics('hit', 'redis', { tenantId: 'tenant-123' });
      performanceMonitor.recordCacheMetrics('miss', 'redis', { tenantId: 'tenant-123' });

      const hitStats = performanceMonitor.getStats('cache_hit');
      const missStats = performanceMonitor.getStats('cache_miss');
      
      expect(hitStats?.count).toBe(1);
      expect(missStats?.count).toBe(1);
    });

    it('should record queue processing metrics', () => {
      performanceMonitor.recordQueueProcessing(
        'email',
        'send_campaign',
        5000,
        true,
        { tenantId: 'tenant-123' }
      );

      const stats = performanceMonitor.getStats('queue_email');
      
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(1);
      expect(stats?.avg).toBe(5000);
    });
  });

  describe('System metrics', () => {
    it('should record system metrics', () => {
      performanceMonitor.recordSystemMetrics();

      const memoryStats = performanceMonitor.getStats('heap_usage');
      const cpuStats = performanceMonitor.getStats('cpu_time');
      
      expect(memoryStats).toBeDefined();
      expect(cpuStats).toBeDefined();
    });

    it('should start system metrics collection', () => {
      const interval = performanceMonitor.startSystemMetricsCollection(100); // 100ms for testing
      
      expect(interval).toBeDefined();
      
      // Clean up
      clearInterval(interval);
    });
  });

  describe('Performance alerts', () => {
    it('should create alerts for threshold violations', () => {
      // Record a slow response time that should trigger an alert
      performanceMonitor.recordMetric('response_time', 'response_time', 5000, 'ms'); // 5 seconds

      const activeAlerts = performanceMonitor.getActiveAlerts();
      
      expect(activeAlerts.length).toBeGreaterThan(0);
      
      const alert = activeAlerts[0];
      expect(alert.severity).toBe('critical');
      expect(alert.metric).toBe('response_time');
      expect(alert.actualValue).toBe(5000);
    });

    it('should create warning alerts for moderate threshold violations', () => {
      // Record a moderately slow response time
      performanceMonitor.recordMetric('response_time', 'response_time', 1500, 'ms'); // 1.5 seconds

      const activeAlerts = performanceMonitor.getActiveAlerts();
      
      expect(activeAlerts.length).toBeGreaterThan(0);
      
      const alert = activeAlerts[0];
      expect(alert.severity).toBe('warning');
      expect(alert.metric).toBe('response_time');
      expect(alert.actualValue).toBe(1500);
    });

    it('should handle cache hit rate alerts correctly', () => {
      // Record low cache hit rate (lower is worse for cache hit rate)
      performanceMonitor.recordMetric('cache_hit_rate', 'cache_hit_rate', 50, '%'); // 50%

      const activeAlerts = performanceMonitor.getActiveAlerts();
      
      expect(activeAlerts.length).toBeGreaterThan(0);
      
      const alert = activeAlerts[0];
      expect(alert.severity).toBe('critical');
      expect(alert.metric).toBe('cache_hit_rate');
      expect(alert.actualValue).toBe(50);
    });

    it('should resolve alerts', () => {
      // Create an alert
      performanceMonitor.recordMetric('response_time', 'response_time', 5000, 'ms');
      
      const activeAlerts = performanceMonitor.getActiveAlerts();
      expect(activeAlerts.length).toBe(1);
      
      const alertId = activeAlerts[0].id;
      const resolved = performanceMonitor.resolveAlert(alertId);
      
      expect(resolved).toBe(true);
      
      const remainingAlerts = performanceMonitor.getActiveAlerts();
      expect(remainingAlerts.length).toBe(0);
    });

    it('should not resolve non-existent alerts', () => {
      const resolved = performanceMonitor.resolveAlert('non-existent-id');
      expect(resolved).toBe(false);
    });

    it('should maintain alerts limit', () => {
      const maxAlerts = performanceMonitor['maxAlerts'];
      
      // Create more alerts than the limit
      for (let i = 0; i < maxAlerts + 10; i++) {
        performanceMonitor.recordMetric('response_time', 'response_time', 5000, 'ms');
      }

      expect(performanceMonitor['alerts'].length).toBeLessThanOrEqual(maxAlerts);
    });
  });

  describe('Statistics and reporting', () => {
    it('should get statistics for specific metrics', () => {
      const values = [100, 200, 300, 400, 500];
      
      values.forEach(value => {
        performanceMonitor.recordMetric('response_time', 'test_metric', value, 'ms');
      });

      const stats = performanceMonitor.getStats('test_metric');
      
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(5);
      expect(stats?.min).toBe(100);
      expect(stats?.max).toBe(500);
      expect(stats?.avg).toBe(300);
    });

    it('should filter statistics by tags', () => {
      performanceMonitor.recordMetric('response_time', 'api_request', 100, 'ms', { endpoint: '/api/users' });
      performanceMonitor.recordMetric('response_time', 'api_request', 200, 'ms', { endpoint: '/api/posts' });
      performanceMonitor.recordMetric('response_time', 'api_request', 300, 'ms', { endpoint: '/api/users' });

      const userStats = performanceMonitor.getStats('api_request', 24 * 60 * 60 * 1000, { endpoint: '/api/users' });
      
      expect(userStats).toBeDefined();
      expect(userStats?.count).toBe(2);
      expect(userStats?.avg).toBe(200); // (100 + 300) / 2
    });

    it('should get all statistics', () => {
      performanceMonitor.recordMetric('response_time', 'metric1', 100, 'ms');
      performanceMonitor.recordMetric('database_query', 'metric2', 50, 'ms');
      performanceMonitor.recordMetric('external_api', 'metric3', 200, 'ms');

      const allStats = performanceMonitor.getAllStats();
      
      expect(Object.keys(allStats)).toHaveLength(3);
      expect(allStats.metric1).toBeDefined();
      expect(allStats.metric2).toBeDefined();
      expect(allStats.metric3).toBeDefined();
    });

    it('should get performance summary', () => {
      // Add some HTTP request metrics
      performanceMonitor.recordHttpRequest('GET', '/api/test', 200, 150);
      performanceMonitor.recordHttpRequest('POST', '/api/test', 500, 300);
      performanceMonitor.recordHttpRequest('GET', '/api/test', 200, 100);

      // Add some other metrics
      performanceMonitor.recordMetric('database_query', 'db_query', 75, 'ms');

      const summary = performanceMonitor.getSummary();
      
      expect(summary.totalMetrics).toBeGreaterThan(0);
      expect(summary.avgResponseTime).toBeGreaterThan(0);
      expect(summary.errorRate).toBeGreaterThan(0); // Should have some errors from 500 status
      expect(summary.topSlowOperations).toBeDefined();
      expect(Array.isArray(summary.topSlowOperations)).toBe(true);
    });

    it('should filter statistics by time range', () => {
      const now = Date.now();
      
      // Mock timestamp for old metric
      const oldMetric = {
        id: 'old-metric',
        timestamp: new Date(now - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        type: 'response_time' as const,
        name: 'old_metric',
        value: 100,
        unit: 'ms',
        tags: {},
      };
      
      // Mock timestamp for recent metric
      const recentMetric = {
        id: 'recent-metric',
        timestamp: new Date(now - 1 * 60 * 60 * 1000), // 1 hour ago
        type: 'response_time' as const,
        name: 'recent_metric',
        value: 200,
        unit: 'ms',
        tags: {},
      };

      performanceMonitor['metrics'].push(oldMetric, recentMetric);

      // Get stats for last 2 hours
      const recentStats = performanceMonitor.getAllStats(2 * 60 * 60 * 1000);
      
      expect(recentStats.recent_metric).toBeDefined();
      expect(recentStats.old_metric).toBeUndefined();
    });
  });

  describe('Recent alerts', () => {
    it('should get recent alerts', () => {
      // Create some alerts
      performanceMonitor.recordMetric('response_time', 'response_time', 5000, 'ms');
      performanceMonitor.recordMetric('response_time', 'response_time', 6000, 'ms');

      const recentAlerts = performanceMonitor.getRecentAlerts(10);
      
      expect(recentAlerts.length).toBe(2);
      expect(recentAlerts[0].timestamp.getTime()).toBeGreaterThanOrEqual(recentAlerts[1].timestamp.getTime());
    });

    it('should limit recent alerts', () => {
      // Create multiple alerts
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordMetric('response_time', 'response_time', 5000, 'ms');
      }

      const recentAlerts = performanceMonitor.getRecentAlerts(5);
      
      expect(recentAlerts.length).toBe(5);
    });
  });

  describe('Health check', () => {
    it('should provide health status', () => {
      const health = performanceMonitor.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.metricsCount).toBe(0);
      expect(health.activeAlerts).toBe(0);
    });

    it('should report active alerts in health check', () => {
      // Create an alert
      performanceMonitor.recordMetric('response_time', 'response_time', 5000, 'ms');

      const health = performanceMonitor.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.activeAlerts).toBe(1);
    });

    it('should handle health check errors gracefully', () => {
      // Mock an error in getActiveAlerts
      const originalGetActiveAlerts = performanceMonitor.getActiveAlerts;
      performanceMonitor.getActiveAlerts = vi.fn().mockImplementation(() => {
        throw new Error('Health check error');
      });

      const health = performanceMonitor.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Health check error');

      // Restore original method
      performanceMonitor.getActiveAlerts = originalGetActiveAlerts;
    });
  });

  describe('Edge cases', () => {
    it('should handle empty metrics gracefully', () => {
      const stats = performanceMonitor.getStats('non_existent_metric');
      expect(stats).toBeNull();
    });

    it('should handle invalid time ranges', () => {
      performanceMonitor.recordMetric('response_time', 'test_metric', 100, 'ms');
      
      const stats = performanceMonitor.getStats('test_metric', -1000); // Negative time range
      expect(stats).toBeDefined(); // Should still work, just with different filtering
    });

    it('should handle metrics with same timestamp', () => {
      const now = Date.now();
      
      // Add multiple metrics with same timestamp
      for (let i = 0; i < 5; i++) {
        const metric = {
          id: `metric-${i}`,
          timestamp: new Date(now),
          type: 'response_time' as const,
          name: 'same_time_metric',
          value: 100 + i * 10,
          unit: 'ms',
          tags: {},
        };
        performanceMonitor['metrics'].push(metric);
      }

      const stats = performanceMonitor.getStats('same_time_metric');
      
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(5);
    });
  });
});