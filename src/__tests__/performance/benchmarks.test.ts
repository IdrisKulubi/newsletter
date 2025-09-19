/**
 * Performance benchmarks and security stress tests
 * Tests system performance under load and security measures effectiveness
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Redis for benchmarks
const mockRedis = {
  pipeline: vi.fn(),
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
  mget: vi.fn(),
  zremrangebyscore: vi.fn(),
  zcard: vi.fn(),
  zadd: vi.fn(),
  expire: vi.fn(),
  quit: vi.fn(),
  on: vi.fn(),
};

const mockPipeline = {
  zremrangebyscore: vi.fn().mockReturnThis(),
  zcard: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: vi.fn(),
};

vi.mock('ioredis', () => ({
  Redis: vi.fn(() => mockRedis),
}));

// Import after mocking
import { checkRateLimit } from '@/lib/security/rate-limiting';
import { sanitizeHtml, commonSchemas } from '@/lib/security/validation';
import { withCache, QueryMonitor } from '@/lib/performance/database';
import { cacheManager } from '@/lib/performance/cache';

describe('Performance Benchmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.pipeline.mockReturnValue(mockPipeline);
    QueryMonitor.clearStats();
  });

  afterEach(async () => {
    await cacheManager.disconnect();
  });

  describe('Rate limiting performance', () => {
    it('should handle high-volume rate limit checks efficiently', async () => {
      // Mock successful rate limit responses
      mockPipeline.exec.mockResolvedValue([
        [null, 0], // zremrangebyscore
        [null, 50], // zcard
        [null, 1], // zadd
        [null, 'OK'], // expire
      ]);
      mockRedis.get.mockResolvedValue(null);

      const startTime = Date.now();
      const promises = [];

      // Simulate 100 concurrent rate limit checks
      for (let i = 0; i < 100; i++) {
        promises.push(checkRateLimit(`user-${i}`, 'API_REQUESTS'));
      }

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All requests should be allowed
      expect(results.every(result => result.allowed)).toBe(true);
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(1000); // 1 second for 100 requests
      
      console.log(`Rate limiting benchmark: ${results.length} checks in ${duration}ms`);
    });

    it('should handle rate limit exceeded scenarios efficiently', async () => {
      // Mock rate limit exceeded responses
      mockPipeline.exec.mockResolvedValue([
        [null, 0],
        [null, 100], // At limit
        [null, 1],
        [null, 'OK'],
      ]);
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      const startTime = Date.now();
      const promises = [];

      // Simulate 50 requests that will be rate limited
      for (let i = 0; i < 50; i++) {
        promises.push(checkRateLimit('heavy-user', 'API_REQUESTS'));
      }

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All requests should be blocked
      expect(results.every(result => !result.allowed)).toBe(true);
      
      // Should still complete quickly even when blocking
      expect(duration).toBeLessThan(500);
      
      console.log(`Rate limiting (blocked) benchmark: ${results.length} checks in ${duration}ms`);
    });
  });

  describe('Input validation performance', () => {
    it('should validate emails efficiently at scale', () => {
      const emails = [];
      for (let i = 0; i < 1000; i++) {
        emails.push(`user${i}@example.com`);
      }

      const startTime = Date.now();
      
      const results = emails.map(email => {
        try {
          commonSchemas.email.parse(email);
          return true;
        } catch {
          return false;
        }
      });
      
      const duration = Date.now() - startTime;

      expect(results.every(result => result)).toBe(true);
      expect(duration).toBeLessThan(100); // Should be very fast
      
      console.log(`Email validation benchmark: ${emails.length} validations in ${duration}ms`);
    });

    it('should sanitize HTML content efficiently', () => {
      const maliciousHtml = `
        <div>Safe content</div>
        <script>alert('xss')</script>
        <iframe src="evil.com"></iframe>
        <div onclick="malicious()">More content</div>
        <a href="javascript:alert('xss')">Link</a>
      `;

      const startTime = Date.now();
      
      const results = [];
      for (let i = 0; i < 1000; i++) {
        results.push(sanitizeHtml(maliciousHtml));
      }
      
      const duration = Date.now() - startTime;

      // All results should be sanitized
      expect(results.every(html => 
        !html.includes('<script>') && 
        !html.includes('<iframe>') && 
        !html.includes('onclick') &&
        !html.includes('javascript:')
      )).toBe(true);
      
      expect(duration).toBeLessThan(200);
      
      console.log(`HTML sanitization benchmark: ${results.length} sanitizations in ${duration}ms`);
    });

    it('should handle complex validation schemas efficiently', () => {
      const testData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Newsletter',
        content: [
          {
            id: '123e4567-e89b-12d3-a456-426614174002',
            type: 'text',
            content: { text: 'Hello world' },
            styling: { color: 'blue' },
          },
        ],
        template: { theme: 'default' },
        metadata: { author: 'test' },
        status: 'draft',
      };

      const startTime = Date.now();
      
      const results = [];
      for (let i = 0; i < 100; i++) {
        try {
          commonSchemas.newsletterTitle.parse(testData.title);
          commonSchemas.tenantId.parse(testData.tenantId);
          results.push(true);
        } catch {
          results.push(false);
        }
      }
      
      const duration = Date.now() - startTime;

      expect(results.every(result => result)).toBe(true);
      expect(duration).toBeLessThan(50);
      
      console.log(`Complex validation benchmark: ${results.length} validations in ${duration}ms`);
    });
  });

  describe('Cache performance', () => {
    it('should handle high-volume cache operations', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ id: 'test', data: 'cached' }));
      mockRedis.setex.mockResolvedValue('OK');

      const startTime = Date.now();
      const promises = [];

      // Simulate 200 concurrent cache operations
      for (let i = 0; i < 200; i++) {
        if (i % 2 === 0) {
          promises.push(cacheManager.get('USER', `user-${i}`));
        } else {
          promises.push(cacheManager.set('USER', `user-${i}`, { id: i, name: `User ${i}` }));
        }
      }

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results.length).toBe(200);
      expect(duration).toBeLessThan(500);
      
      console.log(`Cache operations benchmark: ${results.length} operations in ${duration}ms`);
    });

    it('should handle cache misses efficiently', async () => {
      mockRedis.get.mockResolvedValue(null);

      const startTime = Date.now();
      const promises = [];

      // Simulate 100 cache misses
      for (let i = 0; i < 100; i++) {
        promises.push(cacheManager.get('USER', `non-existent-${i}`));
      }

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results.every(result => result === null)).toBe(true);
      expect(duration).toBeLessThan(200);
      
      console.log(`Cache miss benchmark: ${results.length} misses in ${duration}ms`);
    });

    it('should handle batch cache operations efficiently', async () => {
      const values = Array(50).fill(null).map((_, i) => 
        i % 3 === 0 ? null : JSON.stringify({ id: i, name: `Item ${i}` })
      );
      mockRedis.mget.mockResolvedValue(values);

      const keys = Array(50).fill(null).map((_, i) => `key-${i}`);

      const startTime = Date.now();
      const result = await cacheManager.getMultiple('USER', keys);
      const duration = Date.now() - startTime;

      expect(Object.keys(result)).toHaveLength(50);
      expect(duration).toBeLessThan(50);
      
      console.log(`Batch cache get benchmark: ${keys.length} keys in ${duration}ms`);
    });
  });

  describe('Database query performance', () => {
    it('should monitor query performance effectively', async () => {
      const mockQueries = Array(20).fill(null).map((_, i) => 
        vi.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve(`result-${i}`), Math.random() * 50))
        )
      );

      const startTime = Date.now();
      const promises = mockQueries.map((queryFn, i) => 
        QueryMonitor.monitor(`test-query-${i}`, queryFn, 'tenant-123')
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(20);
      
      const stats = QueryMonitor.getStats();
      expect(stats.totalQueries).toBe(20);
      expect(stats.averageDuration).toBeGreaterThan(0);
      
      console.log(`Query monitoring benchmark: ${results.length} queries in ${duration}ms`);
      console.log(`Average query duration: ${stats.averageDuration.toFixed(2)}ms`);
    });

    it('should handle cache-wrapped queries efficiently', async () => {
      mockRedis.get.mockResolvedValue(null); // Cache miss
      mockRedis.setex.mockResolvedValue('OK');

      const mockQueryFn = vi.fn().mockResolvedValue({ id: 'test', data: 'fresh' });

      const startTime = Date.now();
      const promises = [];

      // First batch - cache misses, will execute queries
      for (let i = 0; i < 10; i++) {
        promises.push(withCache(`test-key-${i}`, mockQueryFn, 300));
      }

      await Promise.all(promises);
      const firstBatchDuration = Date.now() - startTime;

      // Second batch - cache hits
      mockRedis.get.mockResolvedValue(JSON.stringify({ id: 'test', data: 'cached' }));
      
      const secondStartTime = Date.now();
      const secondPromises = [];

      for (let i = 0; i < 10; i++) {
        secondPromises.push(withCache(`test-key-${i}`, mockQueryFn, 300));
      }

      await Promise.all(secondPromises);
      const secondBatchDuration = Date.now() - secondStartTime;

      // Cache hits should be significantly faster
      expect(secondBatchDuration).toBeLessThan(firstBatchDuration);
      
      console.log(`Cache-wrapped queries benchmark:`);
      console.log(`  Cache misses: 10 queries in ${firstBatchDuration}ms`);
      console.log(`  Cache hits: 10 queries in ${secondBatchDuration}ms`);
      console.log(`  Speedup: ${(firstBatchDuration / secondBatchDuration).toFixed(2)}x`);
    });
  });

  describe('Security stress tests', () => {
    it('should handle malicious input patterns efficiently', () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        '"><script>alert(1)</script>',
        '\';alert(1);//',
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        'SELECT * FROM users WHERE id = 1; DROP TABLE users;--',
      ];

      const startTime = Date.now();
      
      const results = maliciousInputs.map(input => {
        const sanitized = sanitizeHtml(input);
        return {
          original: input,
          sanitized,
          safe: !sanitized.includes('<script>') && 
                !sanitized.includes('javascript:') && 
                !sanitized.includes('onerror') &&
                !sanitized.includes('onload')
        };
      });
      
      const duration = Date.now() - startTime;

      expect(results.every(result => result.safe)).toBe(true);
      expect(duration).toBeLessThan(10);
      
      console.log(`Malicious input handling: ${maliciousInputs.length} inputs in ${duration}ms`);
    });

    it('should handle concurrent validation requests', async () => {
      const testEmails = Array(100).fill(null).map((_, i) => `user${i}@example.com`);
      
      const startTime = Date.now();
      
      const promises = testEmails.map(email => 
        new Promise((resolve) => {
          try {
            const result = commonSchemas.email.parse(email);
            resolve({ success: true, result });
          } catch (error) {
            resolve({ success: false, error: error.message });
          }
        })
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results.every(result => result.success)).toBe(true);
      expect(duration).toBeLessThan(50);
      
      console.log(`Concurrent validation: ${testEmails.length} validations in ${duration}ms`);
    });

    it('should maintain performance under rate limiting pressure', async () => {
      // Simulate mixed rate limiting scenarios
      const scenarios = [
        { user: 'normal-user', expectedAllowed: true },
        { user: 'heavy-user', expectedAllowed: false },
        { user: 'burst-user', expectedAllowed: true },
      ];

      mockPipeline.exec.mockImplementation(() => {
        const user = mockPipeline.zadd.mock.calls[mockPipeline.zadd.mock.calls.length - 1]?.[0];
        if (user?.includes('heavy-user')) {
          return Promise.resolve([[null, 0], [null, 100], [null, 1], [null, 'OK']]);
        }
        return Promise.resolve([[null, 0], [null, 10], [null, 1], [null, 'OK']]);
      });
      
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      const startTime = Date.now();
      const promises = [];

      // Generate 150 requests across different user types
      for (let i = 0; i < 150; i++) {
        const scenario = scenarios[i % scenarios.length];
        promises.push(checkRateLimit(`${scenario.user}-${i}`, 'API_REQUESTS'));
      }

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(150);
      expect(duration).toBeLessThan(1000);
      
      const allowedCount = results.filter(r => r.allowed).length;
      const blockedCount = results.filter(r => !r.allowed).length;
      
      console.log(`Rate limiting stress test: ${results.length} requests in ${duration}ms`);
      console.log(`  Allowed: ${allowedCount}, Blocked: ${blockedCount}`);
    });
  });

  describe('Memory and resource usage', () => {
    it('should not leak memory during intensive operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform intensive operations
      const operations = [];
      
      for (let i = 0; i < 1000; i++) {
        operations.push(
          sanitizeHtml(`<div>Content ${i}</div><script>alert(${i})</script>`),
          commonSchemas.email.safeParse(`user${i}@example.com`),
          cacheManager.get('USER', `user-${i}`)
        );
      }
      
      await Promise.all(operations.filter(op => op instanceof Promise));
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      console.log(`Memory usage test:`);
      console.log(`  Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });
});