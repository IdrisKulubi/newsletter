/**
 * Rate limiting tests
 * Tests rate limiting functionality and configurations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Redis before importing the module
const mockRedis = {
  pipeline: vi.fn(),
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
  zremrangebyscore: vi.fn(),
  zcard: vi.fn(),
  zadd: vi.fn(),
  expire: vi.fn(),
  eval: vi.fn(),
  info: vi.fn(),
  dbsize: vi.fn(),
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
import { rateLimiter, checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limiting';

describe('Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.pipeline.mockReturnValue(mockPipeline);
  });

  afterEach(async () => {
    await rateLimiter.disconnect();
  });

  describe('Rate limit configurations', () => {
    it('should have proper rate limit configurations', () => {
      expect(RATE_LIMITS.LOGIN_ATTEMPTS).toEqual({
        windowMs: 15 * 60 * 1000,
        maxAttempts: 5,
        blockDurationMs: 30 * 60 * 1000,
      });

      expect(RATE_LIMITS.API_REQUESTS).toEqual({
        windowMs: 60 * 1000,
        maxAttempts: 100,
        blockDurationMs: 5 * 60 * 1000,
      });

      expect(RATE_LIMITS.EMAIL_SENDING).toEqual({
        windowMs: 60 * 60 * 1000,
        maxAttempts: 1000,
        blockDurationMs: 60 * 60 * 1000,
      });
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', async () => {
      // Mock Redis responses for successful rate limit check
      mockPipeline.exec.mockResolvedValue([
        [null, 0], // zremrangebyscore
        [null, 5], // zcard (current count)
        [null, 1], // zadd
        [null, 'OK'], // expire
      ]);
      mockRedis.get.mockResolvedValue(null); // No block

      const result = await checkRateLimit('user123', 'API_REQUESTS');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(94); // 100 - 5 - 1
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should block requests when limit exceeded', async () => {
      // Mock Redis responses for rate limit exceeded
      mockPipeline.exec.mockResolvedValue([
        [null, 0], // zremrangebyscore
        [null, 100], // zcard (at limit)
        [null, 1], // zadd
        [null, 'OK'], // expire
      ]);
      mockRedis.get.mockResolvedValue(null); // No existing block
      mockRedis.setex.mockResolvedValue('OK'); // Set block

      const result = await checkRateLimit('user123', 'API_REQUESTS');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should respect existing blocks', async () => {
      const futureTime = Date.now() + 60000;
      mockRedis.get.mockResolvedValue(futureTime.toString());

      const result = await checkRateLimit('user123', 'API_REQUESTS');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should handle Redis errors gracefully', async () => {
      mockPipeline.exec.mockRejectedValue(new Error('Redis error'));

      const result = await checkRateLimit('user123', 'API_REQUESTS');

      // Should fail open
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
    });

    it('should use custom configuration when provided', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 0],
        [null, 2],
        [null, 1],
        [null, 'OK'],
      ]);
      mockRedis.get.mockResolvedValue(null);

      const customConfig = {
        maxAttempts: 5,
        windowMs: 30000,
        blockDurationMs: 60000,
      };

      const result = await checkRateLimit('user123', 'API_REQUESTS', customConfig);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2); // 5 - 2 - 1
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return current status without incrementing', async () => {
      mockRedis.get.mockResolvedValue(null); // No block
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(10);

      const result = await rateLimiter.instance.getRateLimitStatus('user123', 'API_REQUESTS');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(90); // 100 - 10
      expect(mockPipeline.zadd).not.toHaveBeenCalled(); // Should not increment
    });

    it('should handle blocked users', async () => {
      const futureTime = Date.now() + 30000;
      mockRedis.get.mockResolvedValue(futureTime.toString());

      const result = await rateLimiter.instance.getRateLimitStatus('user123', 'API_REQUESTS');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('resetRateLimit', () => {
    it('should clear rate limit data', async () => {
      mockRedis.del.mockResolvedValue(1);

      await rateLimiter.instance.resetRateLimit('user123', 'API_REQUESTS');

      expect(mockRedis.del).toHaveBeenCalledTimes(2); // Rate limit key and block key
    });
  });

  describe('getRateLimitStats', () => {
    it('should return statistics for an action', async () => {
      mockRedis.keys.mockResolvedValueOnce(['rate_limit:API_REQUESTS:user1', 'rate_limit:API_REQUESTS:user2']);
      mockRedis.keys.mockResolvedValueOnce(['rate_limit_block:API_REQUESTS:user3']);
      mockRedis.zcard.mockResolvedValueOnce(10).mockResolvedValueOnce(5);

      const stats = await rateLimiter.instance.getRateLimitStats('API_REQUESTS');

      expect(stats.totalRequests).toBe(15);
      expect(stats.blockedIdentifiers).toBe(1);
      expect(stats.topIdentifiers).toHaveLength(2);
    });

    it('should handle Redis errors in stats', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      const stats = await rateLimiter.instance.getRateLimitStats('API_REQUESTS');

      expect(stats.totalRequests).toBe(0);
      expect(stats.blockedIdentifiers).toBe(0);
      expect(stats.topIdentifiers).toHaveLength(0);
    });
  });

  describe('cleanup', () => {
    it('should remove expired rate limit data', async () => {
      mockRedis.keys.mockResolvedValue(['rate_limit:API_REQUESTS:user1']);
      mockRedis.zremrangebyscore.mockResolvedValue(5);
      mockRedis.zcard.mockResolvedValue(0);
      mockRedis.del.mockResolvedValue(1);

      await rateLimiter.instance.cleanup();

      expect(mockRedis.zremrangebyscore).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalled(); // Should delete empty keys
    });
  });

  describe('Different rate limit actions', () => {
    it('should handle login attempts with stricter limits', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 0],
        [null, 4], // 4 attempts already
        [null, 1],
        [null, 'OK'],
      ]);
      mockRedis.get.mockResolvedValue(null);

      const result = await checkRateLimit('user123', 'LOGIN_ATTEMPTS');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0); // 5 - 4 - 1 = 0
    });

    it('should handle email sending with higher limits', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 0],
        [null, 500], // 500 emails sent
        [null, 1],
        [null, 'OK'],
      ]);
      mockRedis.get.mockResolvedValue(null);

      const result = await checkRateLimit('tenant123', 'EMAIL_SENDING');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(499); // 1000 - 500 - 1
    });

    it('should handle AI requests with appropriate limits', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 0],
        [null, 50], // 50 AI requests
        [null, 1],
        [null, 'OK'],
      ]);
      mockRedis.get.mockResolvedValue(null);

      const result = await checkRateLimit('tenant123', 'AI_REQUESTS');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(49); // 100 - 50 - 1
    });
  });

  describe('Edge cases', () => {
    it('should handle null Redis pipeline results', async () => {
      mockPipeline.exec.mockResolvedValue(null);

      const result = await checkRateLimit('user123', 'API_REQUESTS');

      expect(result.allowed).toBe(true); // Should fail open
    });

    it('should handle malformed Redis responses', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 'invalid'],
        [null, 'invalid'],
        [null, 1],
        [null, 'OK'],
      ]);
      mockRedis.get.mockResolvedValue(null);

      const result = await checkRateLimit('user123', 'API_REQUESTS');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99); // Should handle gracefully
    });

    it('should handle expired blocks correctly', async () => {
      const pastTime = Date.now() - 60000;
      mockRedis.get.mockResolvedValue(pastTime.toString());
      mockPipeline.exec.mockResolvedValue([
        [null, 0],
        [null, 10],
        [null, 1],
        [null, 'OK'],
      ]);

      const result = await checkRateLimit('user123', 'API_REQUESTS');

      expect(result.allowed).toBe(true); // Block should be expired
      expect(result.remaining).toBe(89);
    });
  });
});