/**
 * Cache performance tests
 * Tests Redis caching utilities and performance optimizations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
  exists: vi.fn(),
  ttl: vi.fn(),
  incrby: vi.fn(),
  expire: vi.fn(),
  mget: vi.fn(),
  pipeline: vi.fn(),
  set: vi.fn(),
  eval: vi.fn(),
  info: vi.fn(),
  dbsize: vi.fn(),
  quit: vi.fn(),
  on: vi.fn(),
};

const mockPipeline = {
  setex: vi.fn().mockReturnThis(),
  exec: vi.fn(),
};

vi.mock('ioredis', () => ({
  Redis: vi.fn(() => mockRedis),
}));

// Import after mocking
import { cacheManager, cache, CACHE_TTL, CACHE_PREFIXES } from '@/lib/performance/cache';

describe('Cache Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.pipeline.mockReturnValue(mockPipeline);
  });

  afterEach(async () => {
    await cacheManager.disconnect();
  });

  describe('Cache TTL constants', () => {
    it('should have proper TTL values', () => {
      expect(CACHE_TTL.VERY_SHORT).toBe(60);
      expect(CACHE_TTL.SHORT).toBe(5 * 60);
      expect(CACHE_TTL.MEDIUM).toBe(30 * 60);
      expect(CACHE_TTL.LONG).toBe(60 * 60);
      expect(CACHE_TTL.VERY_LONG).toBe(24 * 60 * 60);
      expect(CACHE_TTL.WEEK).toBe(7 * 24 * 60 * 60);
    });
  });

  describe('Cache prefixes', () => {
    it('should have proper prefix constants', () => {
      expect(CACHE_PREFIXES.TENANT).toBe('tenant');
      expect(CACHE_PREFIXES.USER).toBe('user');
      expect(CACHE_PREFIXES.NEWSLETTER).toBe('newsletter');
      expect(CACHE_PREFIXES.CAMPAIGN).toBe('campaign');
      expect(CACHE_PREFIXES.ANALYTICS).toBe('analytics');
      expect(CACHE_PREFIXES.SESSION).toBe('session');
      expect(CACHE_PREFIXES.RATE_LIMIT).toBe('rate_limit');
      expect(CACHE_PREFIXES.TEMP).toBe('temp');
    });
  });

  describe('Basic cache operations', () => {
    describe('get', () => {
      it('should retrieve and parse cached value', async () => {
        const testData = { id: '123', name: 'Test' };
        mockRedis.get.mockResolvedValue(JSON.stringify(testData));

        const result = await cacheManager.get('USER', 'test-key');

        expect(result).toEqual(testData);
        expect(mockRedis.get).toHaveBeenCalledWith('user:test-key');
      });

      it('should return null for non-existent keys', async () => {
        mockRedis.get.mockResolvedValue(null);

        const result = await cacheManager.get('USER', 'non-existent');

        expect(result).toBeNull();
      });

      it('should handle Redis errors gracefully', async () => {
        mockRedis.get.mockRejectedValue(new Error('Redis error'));

        const result = await cacheManager.get('USER', 'test-key');

        expect(result).toBeNull();
      });

      it('should handle JSON parse errors', async () => {
        mockRedis.get.mockResolvedValue('invalid-json');

        const result = await cacheManager.get('USER', 'test-key');

        expect(result).toBeNull();
      });
    });

    describe('set', () => {
      it('should serialize and store value with TTL', async () => {
        const testData = { id: '123', name: 'Test' };
        mockRedis.setex.mockResolvedValue('OK');

        const result = await cacheManager.set('USER', 'test-key', testData, CACHE_TTL.SHORT);

        expect(result).toBe(true);
        expect(mockRedis.setex).toHaveBeenCalledWith(
          'user:test-key',
          CACHE_TTL.SHORT,
          JSON.stringify(testData)
        );
      });

      it('should use default TTL when not specified', async () => {
        const testData = { id: '123' };
        mockRedis.setex.mockResolvedValue('OK');

        await cacheManager.set('USER', 'test-key', testData);

        expect(mockRedis.setex).toHaveBeenCalledWith(
          'user:test-key',
          CACHE_TTL.MEDIUM,
          JSON.stringify(testData)
        );
      });

      it('should handle Redis errors gracefully', async () => {
        mockRedis.setex.mockRejectedValue(new Error('Redis error'));

        const result = await cacheManager.set('USER', 'test-key', { id: '123' });

        expect(result).toBe(false);
      });
    });

    describe('delete', () => {
      it('should delete cache key', async () => {
        mockRedis.del.mockResolvedValue(1);

        const result = await cacheManager.delete('USER', 'test-key');

        expect(result).toBe(true);
        expect(mockRedis.del).toHaveBeenCalledWith('user:test-key');
      });

      it('should return false if key does not exist', async () => {
        mockRedis.del.mockResolvedValue(0);

        const result = await cacheManager.delete('USER', 'non-existent');

        expect(result).toBe(false);
      });
    });

    describe('exists', () => {
      it('should check if key exists', async () => {
        mockRedis.exists.mockResolvedValue(1);

        const result = await cacheManager.exists('USER', 'test-key');

        expect(result).toBe(true);
        expect(mockRedis.exists).toHaveBeenCalledWith('user:test-key');
      });

      it('should return false if key does not exist', async () => {
        mockRedis.exists.mockResolvedValue(0);

        const result = await cacheManager.exists('USER', 'non-existent');

        expect(result).toBe(false);
      });
    });

    describe('getTTL', () => {
      it('should return TTL for existing key', async () => {
        mockRedis.ttl.mockResolvedValue(300);

        const result = await cacheManager.getTTL('USER', 'test-key');

        expect(result).toBe(300);
        expect(mockRedis.ttl).toHaveBeenCalledWith('user:test-key');
      });

      it('should handle Redis errors', async () => {
        mockRedis.ttl.mockRejectedValue(new Error('Redis error'));

        const result = await cacheManager.getTTL('USER', 'test-key');

        expect(result).toBe(-1);
      });
    });
  });

  describe('Advanced cache operations', () => {
    describe('increment', () => {
      it('should increment numeric value', async () => {
        mockRedis.incrby.mockResolvedValue(5);

        const result = await cacheManager.increment('TEMP', 'counter', 2);

        expect(result).toBe(5);
        expect(mockRedis.incrby).toHaveBeenCalledWith('temp:counter', 2);
      });

      it('should set TTL for new keys', async () => {
        mockRedis.incrby.mockResolvedValue(1); // First increment
        mockRedis.expire.mockResolvedValue(1);

        await cacheManager.increment('TEMP', 'new-counter', 1, 300);

        expect(mockRedis.expire).toHaveBeenCalledWith('temp:new-counter', 300);
      });

      it('should not set TTL for existing keys', async () => {
        mockRedis.incrby.mockResolvedValue(5); // Not first increment

        await cacheManager.increment('TEMP', 'existing-counter', 1, 300);

        expect(mockRedis.expire).not.toHaveBeenCalled();
      });
    });

    describe('setMultiple', () => {
      it('should set multiple values using pipeline', async () => {
        const entries = [
          { key: 'key1', value: { id: 1 }, ttl: 100 },
          { key: 'key2', value: { id: 2 } },
        ];
        mockPipeline.exec.mockResolvedValue([]);

        const result = await cacheManager.setMultiple('USER', entries, CACHE_TTL.SHORT);

        expect(result).toBe(true);
        expect(mockPipeline.setex).toHaveBeenCalledWith('user:key1', 100, JSON.stringify({ id: 1 }));
        expect(mockPipeline.setex).toHaveBeenCalledWith('user:key2', CACHE_TTL.SHORT, JSON.stringify({ id: 2 }));
      });

      it('should handle empty entries', async () => {
        const result = await cacheManager.setMultiple('USER', [], CACHE_TTL.SHORT);

        expect(result).toBe(false);
        expect(mockPipeline.exec).not.toHaveBeenCalled();
      });
    });

    describe('getMultiple', () => {
      it('should get multiple values at once', async () => {
        const keys = ['key1', 'key2', 'key3'];
        const values = [
          JSON.stringify({ id: 1 }),
          null,
          JSON.stringify({ id: 3 }),
        ];
        mockRedis.mget.mockResolvedValue(values);

        const result = await cacheManager.getMultiple('USER', keys);

        expect(result).toEqual({
          key1: { id: 1 },
          key2: null,
          key3: { id: 3 },
        });
        expect(mockRedis.mget).toHaveBeenCalledWith('user:key1', 'user:key2', 'user:key3');
      });

      it('should handle empty keys array', async () => {
        const result = await cacheManager.getMultiple('USER', []);

        expect(result).toEqual({});
        expect(mockRedis.mget).not.toHaveBeenCalled();
      });
    });

    describe('getOrSet', () => {
      it('should return cached value if available', async () => {
        const cachedData = { id: '123', name: 'Cached' };
        mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

        const fetchFn = vi.fn().mockResolvedValue({ id: '123', name: 'Fresh' });
        const result = await cacheManager.getOrSet('USER', 'test-key', fetchFn, CACHE_TTL.SHORT);

        expect(result).toEqual(cachedData);
        expect(fetchFn).not.toHaveBeenCalled();
      });

      it('should fetch and cache if not available', async () => {
        mockRedis.get.mockResolvedValue(null);
        mockRedis.setex.mockResolvedValue('OK');

        const freshData = { id: '123', name: 'Fresh' };
        const fetchFn = vi.fn().mockResolvedValue(freshData);
        const result = await cacheManager.getOrSet('USER', 'test-key', fetchFn, CACHE_TTL.SHORT);

        expect(result).toEqual(freshData);
        expect(fetchFn).toHaveBeenCalled();
        expect(mockRedis.setex).toHaveBeenCalledWith(
          'user:test-key',
          CACHE_TTL.SHORT,
          JSON.stringify(freshData)
        );
      });

      it('should refresh in background when near expiry', async () => {
        const cachedData = { id: '123', name: 'Cached' };
        mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));
        mockRedis.ttl.mockResolvedValue(30); // 30 seconds remaining, should trigger refresh

        const freshData = { id: '123', name: 'Fresh' };
        const fetchFn = vi.fn().mockResolvedValue(freshData);
        
        const result = await cacheManager.getOrSet('USER', 'test-key', fetchFn, CACHE_TTL.SHORT, 0.1);

        expect(result).toEqual(cachedData); // Should return cached immediately
        
        // Wait a bit for background refresh
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(fetchFn).toHaveBeenCalled(); // Should have triggered background refresh
      });

      it('should fallback to fetch on cache errors', async () => {
        mockRedis.get.mockRejectedValue(new Error('Redis error'));

        const freshData = { id: '123', name: 'Fresh' };
        const fetchFn = vi.fn().mockResolvedValue(freshData);
        const result = await cacheManager.getOrSet('USER', 'test-key', fetchFn, CACHE_TTL.SHORT);

        expect(result).toEqual(freshData);
        expect(fetchFn).toHaveBeenCalled();
      });
    });
  });

  describe('Pattern operations', () => {
    describe('deletePattern', () => {
      it('should delete keys matching pattern', async () => {
        mockRedis.keys.mockResolvedValue(['user:key1', 'user:key2']);
        mockRedis.del.mockResolvedValue(2);

        const result = await cacheManager.deletePattern('USER', 'key*');

        expect(result).toBe(2);
        expect(mockRedis.keys).toHaveBeenCalledWith('user:key*');
        expect(mockRedis.del).toHaveBeenCalledWith('user:key1', 'user:key2');
      });

      it('should handle no matching keys', async () => {
        mockRedis.keys.mockResolvedValue([]);

        const result = await cacheManager.deletePattern('USER', 'nonexistent*');

        expect(result).toBe(0);
        expect(mockRedis.del).not.toHaveBeenCalled();
      });
    });

    describe('clearPrefix', () => {
      it('should clear all keys with prefix', async () => {
        mockRedis.keys.mockResolvedValue(['user:key1', 'user:key2']);
        mockRedis.del.mockResolvedValue(2);

        const result = await cacheManager.clearPrefix('USER');

        expect(result).toBe(2);
        expect(mockRedis.keys).toHaveBeenCalledWith('user:*');
      });
    });
  });

  describe('Distributed locking', () => {
    describe('acquireLock', () => {
      it('should acquire lock successfully', async () => {
        mockRedis.set.mockResolvedValue('OK');

        const lockValue = await cacheManager.acquireLock('test-resource', 30);

        expect(lockValue).toBeTruthy();
        expect(lockValue).toMatch(/^\d+-[\d.]+$/); // timestamp-random format
        expect(mockRedis.set).toHaveBeenCalledWith(
          'temp:lock:test-resource',
          lockValue,
          'EX',
          30,
          'NX'
        );
      });

      it('should fail to acquire existing lock', async () => {
        mockRedis.set.mockResolvedValue(null);

        const lockValue = await cacheManager.acquireLock('test-resource', 30);

        expect(lockValue).toBeNull();
      });

      it('should retry on lock acquisition failure', async () => {
        mockRedis.set
          .mockResolvedValueOnce(null) // First attempt fails
          .mockResolvedValueOnce(null) // Second attempt fails
          .mockResolvedValueOnce('OK'); // Third attempt succeeds

        const lockValue = await cacheManager.acquireLock('test-resource', 30, 3, 1);

        expect(lockValue).toBeTruthy();
        expect(mockRedis.set).toHaveBeenCalledTimes(3);
      });
    });

    describe('releaseLock', () => {
      it('should release lock with correct value', async () => {
        mockRedis.eval.mockResolvedValue(1);

        const result = await cacheManager.releaseLock('test-resource', 'lock-value');

        expect(result).toBe(true);
        expect(mockRedis.eval).toHaveBeenCalledWith(
          expect.stringContaining('if redis.call("GET", KEYS[1]) == ARGV[1]'),
          1,
          'temp:lock:test-resource',
          'lock-value'
        );
      });

      it('should fail to release lock with wrong value', async () => {
        mockRedis.eval.mockResolvedValue(0);

        const result = await cacheManager.releaseLock('test-resource', 'wrong-value');

        expect(result).toBe(false);
      });
    });
  });

  describe('Cache statistics and health', () => {
    describe('getStats', () => {
      it('should return cache statistics', async () => {
        mockRedis.info.mockResolvedValue('used_memory_human:10.5M\nother_info:value');
        mockRedis.dbsize.mockResolvedValue(1000);

        const stats = await cacheManager.getStats();

        expect(stats.connected).toBe(true);
        expect(stats.memoryUsage).toBe('10.5M');
        expect(stats.keyCount).toBe(1000);
      });

      it('should handle disconnected state', async () => {
        // Simulate disconnected state
        const disconnectedManager = new (cacheManager.constructor as any)();
        disconnectedManager.isConnected = false;

        const stats = await disconnectedManager.getStats();

        expect(stats.connected).toBe(false);
        expect(stats.memoryUsage).toBe('0B');
        expect(stats.keyCount).toBe(0);
      });
    });

    describe('healthCheck', () => {
      it('should pass health check', async () => {
        mockRedis.setex.mockResolvedValue('OK');
        mockRedis.get.mockResolvedValue('ok');
        mockRedis.del.mockResolvedValue(1);

        const isHealthy = await cacheManager.healthCheck();

        expect(isHealthy).toBe(true);
      });

      it('should fail health check on Redis error', async () => {
        mockRedis.setex.mockRejectedValue(new Error('Redis error'));

        const isHealthy = await cacheManager.healthCheck();

        expect(isHealthy).toBe(false);
      });
    });
  });

  describe('Convenience functions', () => {
    it('should provide tenant cache functions', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ id: 'tenant-123' }));
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.del.mockResolvedValue(1);

      const tenant = await cache.getTenant('123');
      expect(tenant).toEqual({ id: 'tenant-123' });

      await cache.setTenant('123', { id: 'tenant-123' });
      expect(mockRedis.setex).toHaveBeenCalledWith('tenant:123', CACHE_TTL.LONG, expect.any(String));

      const deleted = await cache.deleteTenant('123');
      expect(deleted).toBe(true);
    });

    it('should provide user cache functions', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ id: 'user-456' }));
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.del.mockResolvedValue(1);

      const user = await cache.getUser('456');
      expect(user).toEqual({ id: 'user-456' });

      await cache.setUser('456', { id: 'user-456' });
      expect(mockRedis.setex).toHaveBeenCalledWith('user:456', CACHE_TTL.MEDIUM, expect.any(String));

      const deleted = await cache.deleteUser('456');
      expect(deleted).toBe(true);
    });

    it('should provide analytics cache functions', async () => {
      const analyticsData = { views: 100, clicks: 50 };
      mockRedis.get.mockResolvedValue(JSON.stringify(analyticsData));
      mockRedis.setex.mockResolvedValue('OK');

      const analytics = await cache.getAnalytics('campaign-123');
      expect(analytics).toEqual(analyticsData);

      await cache.setAnalytics('campaign-123', analyticsData, CACHE_TTL.SHORT);
      expect(mockRedis.setex).toHaveBeenCalledWith('analytics:campaign-123', CACHE_TTL.SHORT, expect.any(String));
    });
  });
});