/**
 * Database performance tests
 * Tests database optimization utilities and caching
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  keys: vi.fn(),
  del: vi.fn(),
};

vi.mock('ioredis', () => ({
  Redis: vi.fn(() => mockRedis),
}));

// Mock database
const mockDb = {
  execute: vi.fn(),
};

vi.mock('@/lib/db', () => ({
  db: mockDb,
}));

vi.mock('drizzle-orm', () => ({
  sql: vi.fn().mockImplementation((strings, ...values) => ({ 
    query: strings.join('?'),
    values 
  })),
}));

// Import after mocking
import {
  withCache,
  invalidateCache,
  checkDatabaseHealth,
  QueryMonitor,
  paginateQuery,
  CacheKeys,
  CACHE_TTL,
} from '@/lib/performance/database';

describe('Database Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Cache utilities', () => {
    describe('withCache', () => {
      it('should return cached value if available', async () => {
        const cachedData = { id: '1', name: 'Test' };
        mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

        const queryFn = vi.fn().mockResolvedValue({ id: '2', name: 'Fresh' });
        const result = await withCache('test-key', queryFn, CACHE_TTL.SHORT);

        expect(result).toEqual(cachedData);
        expect(queryFn).not.toHaveBeenCalled();
        expect(mockRedis.get).toHaveBeenCalledWith('test-key');
      });

      it('should execute query and cache result if not cached', async () => {
        mockRedis.get.mockResolvedValue(null);
        mockRedis.setex.mockResolvedValue('OK');

        const freshData = { id: '2', name: 'Fresh' };
        const queryFn = vi.fn().mockResolvedValue(freshData);
        const result = await withCache('test-key', queryFn, CACHE_TTL.SHORT);

        expect(result).toEqual(freshData);
        expect(queryFn).toHaveBeenCalled();
        expect(mockRedis.setex).toHaveBeenCalledWith(
          'test-key',
          CACHE_TTL.SHORT,
          JSON.stringify(freshData)
        );
      });

      it('should fallback to query on cache error', async () => {
        mockRedis.get.mockRejectedValue(new Error('Redis error'));

        const freshData = { id: '2', name: 'Fresh' };
        const queryFn = vi.fn().mockResolvedValue(freshData);
        const result = await withCache('test-key', queryFn, CACHE_TTL.SHORT);

        expect(result).toEqual(freshData);
        expect(queryFn).toHaveBeenCalled();
      });
    });

    describe('invalidateCache', () => {
      it('should delete matching cache keys', async () => {
        mockRedis.keys.mockResolvedValue(['key1', 'key2', 'key3']);
        mockRedis.del.mockResolvedValue(3);

        await invalidateCache('pattern*');

        expect(mockRedis.keys).toHaveBeenCalledWith('pattern*');
        expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
      });

      it('should handle no matching keys', async () => {
        mockRedis.keys.mockResolvedValue([]);

        await invalidateCache('pattern*');

        expect(mockRedis.keys).toHaveBeenCalledWith('pattern*');
        expect(mockRedis.del).not.toHaveBeenCalled();
      });

      it('should handle cache errors gracefully', async () => {
        mockRedis.keys.mockRejectedValue(new Error('Redis error'));

        await expect(invalidateCache('pattern*')).resolves.not.toThrow();
      });
    });
  });

  describe('Cache key generators', () => {
    it('should generate consistent cache keys', () => {
      expect(CacheKeys.tenant('123')).toBe('tenant:123');
      expect(CacheKeys.tenantByDomain('example.com')).toBe('tenant:domain:example.com');
      expect(CacheKeys.user('user-456')).toBe('user:user-456');
      expect(CacheKeys.newsletter('news-789')).toBe('newsletter:news-789');
    });

    it('should generate analytics cache keys with periods', () => {
      expect(CacheKeys.tenantAnalytics('tenant-123', 'daily')).toBe('analytics:tenant-123:daily');
      expect(CacheKeys.tenantAnalytics('tenant-456', 'monthly')).toBe('analytics:tenant-456:monthly');
    });
  });

  describe('Database health check', () => {
    it('should return healthy status on successful query', async () => {
      mockDb.execute.mockResolvedValue([{ active_connections: 5 }]);

      const health = await checkDatabaseHealth();

      expect(health.healthy).toBe(true);
      expect(health.latency).toBeGreaterThan(0);
      expect(health.activeConnections).toBe(5);
    });

    it('should return unhealthy status on query failure', async () => {
      const error = new Error('Connection failed');
      mockDb.execute.mockRejectedValue(error);

      const health = await checkDatabaseHealth();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Connection failed');
      expect(health.latency).toBeGreaterThan(0);
    });

    it('should handle connection stats query failure gracefully', async () => {
      mockDb.execute
        .mockResolvedValueOnce([]) // First query succeeds
        .mockRejectedValueOnce(new Error('Stats query failed')); // Second query fails

      const health = await checkDatabaseHealth();

      expect(health.healthy).toBe(true);
      expect(health.activeConnections).toBeUndefined();
    });
  });

  describe('Query monitoring', () => {
    beforeEach(() => {
      QueryMonitor.clearStats();
    });

    it('should monitor query execution time', async () => {
      const queryFn = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('result'), 10))
      );

      const result = await QueryMonitor.monitor('test-query', queryFn, 'tenant-123');

      expect(result).toBe('result');
      expect(queryFn).toHaveBeenCalled();

      const stats = QueryMonitor.getStats();
      expect(stats.totalQueries).toBe(1);
      expect(stats.averageDuration).toBeGreaterThan(0);
    });

    it('should log slow queries', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const slowQueryFn = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('result'), 1100))
      );

      await QueryMonitor.monitor('slow-query', slowQueryFn, 'tenant-123');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow query detected'),
        expect.any(Object)
      );

      const stats = QueryMonitor.getStats();
      expect(stats.slowQueries).toBe(1);

      consoleSpy.mockRestore();
    });

    it('should handle query failures', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Query failed');
      const failingQueryFn = vi.fn().mockRejectedValue(error);

      await expect(QueryMonitor.monitor('failing-query', failingQueryFn)).rejects.toThrow('Query failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Query failed'),
        error
      );

      consoleErrorSpy.mockRestore();
    });

    it('should maintain query history', async () => {
      // Add multiple queries
      for (let i = 0; i < 5; i++) {
        const queryFn = vi.fn().mockResolvedValue(`result-${i}`);
        await QueryMonitor.monitor(`query-${i}`, queryFn);
      }

      const stats = QueryMonitor.getStats();
      expect(stats.totalQueries).toBe(5);
      expect(stats.recentQueries).toHaveLength(5);
    });

    it('should limit query history to 100 entries', async () => {
      // Add more than 100 queries
      for (let i = 0; i < 105; i++) {
        const queryFn = vi.fn().mockResolvedValue(`result-${i}`);
        await QueryMonitor.monitor(`query-${i}`, queryFn);
      }

      const stats = QueryMonitor.getStats();
      expect(stats.totalQueries).toBe(100); // Should be capped at 100
    });

    it('should clear stats correctly', async () => {
      const queryFn = vi.fn().mockResolvedValue('result');
      await QueryMonitor.monitor('test-query', queryFn);

      expect(QueryMonitor.getStats().totalQueries).toBe(1);

      QueryMonitor.clearStats();

      const stats = QueryMonitor.getStats();
      expect(stats.totalQueries).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.slowQueries).toBe(0);
      expect(stats.recentQueries).toHaveLength(0);
    });
  });

  describe('Pagination utilities', () => {
    it('should paginate query results correctly', async () => {
      const mockData = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' },
      ];

      const queryFn = vi.fn().mockResolvedValue(mockData);
      const countFn = vi.fn().mockResolvedValue(10);

      const options = { page: 2, limit: 3 };
      const result = await paginateQuery(queryFn, countFn, options);

      expect(queryFn).toHaveBeenCalledWith(3, 3); // offset: (2-1)*3 = 3, limit: 3
      expect(countFn).toHaveBeenCalled();

      expect(result.data).toEqual(mockData);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 3,
        total: 10,
        totalPages: 4,
        hasNext: true,
        hasPrev: true,
      });
    });

    it('should handle first page correctly', async () => {
      const queryFn = vi.fn().mockResolvedValue([]);
      const countFn = vi.fn().mockResolvedValue(5);

      const options = { page: 1, limit: 10 };
      const result = await paginateQuery(queryFn, countFn, options);

      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it('should handle last page correctly', async () => {
      const queryFn = vi.fn().mockResolvedValue([]);
      const countFn = vi.fn().mockResolvedValue(25);

      const options = { page: 3, limit: 10 };
      const result = await paginateQuery(queryFn, countFn, options);

      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(true);
      expect(result.pagination.totalPages).toBe(3);
    });

    it('should use cache when cache key provided', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      const queryFn = vi.fn().mockResolvedValue([{ id: 1 }]);
      const countFn = vi.fn().mockResolvedValue(1);

      const options = { page: 1, limit: 10 };
      await paginateQuery(queryFn, countFn, options, 'test-cache-key');

      expect(mockRedis.get).toHaveBeenCalledWith('test-cache-key:page:1:limit:10');
      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  describe('Cache TTL constants', () => {
    it('should have proper TTL values', () => {
      expect(CACHE_TTL.SHORT).toBe(5 * 60);
      expect(CACHE_TTL.MEDIUM).toBe(30 * 60);
      expect(CACHE_TTL.LONG).toBe(60 * 60);
      expect(CACHE_TTL.VERY_LONG).toBe(24 * 60 * 60);
    });
  });
});