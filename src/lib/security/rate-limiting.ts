/**
 * Comprehensive rate limiting system using Redis
 * Provides flexible rate limiting for different actions and user types
 */

import { Redis } from 'ioredis';
import { config } from '@/lib/config';

// Rate limit configurations for different actions
export const RATE_LIMITS = {
  // Authentication attempts
  LOGIN_ATTEMPTS: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5,
    blockDurationMs: 30 * 60 * 1000, // 30 minutes
  },
  
  // Password reset attempts
  PASSWORD_RESET: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3,
    blockDurationMs: 60 * 60 * 1000, // 1 hour
  },
  
  // Email sending
  EMAIL_SENDING: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 1000, // Per tenant
    blockDurationMs: 60 * 60 * 1000, // 1 hour
  },
  
  // API requests (general)
  API_REQUESTS: {
    windowMs: 60 * 1000, // 1 minute
    maxAttempts: 100, // Per user
    blockDurationMs: 5 * 60 * 1000, // 5 minutes
  },
  
  // File uploads
  FILE_UPLOADS: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 50, // Per tenant
    blockDurationMs: 60 * 60 * 1000, // 1 hour
  },
  
  // AI requests
  AI_REQUESTS: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 100, // Per tenant
    blockDurationMs: 60 * 60 * 1000, // 1 hour
  },
  
  // Newsletter creation
  NEWSLETTER_CREATION: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 20, // Per tenant
    blockDurationMs: 60 * 60 * 1000, // 1 hour
  },
  
  // Campaign creation
  CAMPAIGN_CREATION: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 10, // Per tenant
    blockDurationMs: 60 * 60 * 1000, // 1 hour
  },
} as const;

export type RateLimitAction = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
  blockDurationMs: number;
}

class RateLimiter {
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis(config.redis.url, {
      retryStrategy: () => 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  
  /**
   * Check if an action is rate limited
   */
  async checkRateLimit(
    identifier: string,
    action: RateLimitAction,
    customConfig?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    const rateLimitConfig = { ...RATE_LIMITS[action], ...customConfig };
    const key = this.generateKey(identifier, action);
    const now = Date.now();
    const windowStart = now - rateLimitConfig.windowMs;
    
    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();
      
      // Remove expired entries
      pipeline.zremrangebyscore(key, 0, windowStart);
      
      // Count current requests in window
      pipeline.zcard(key);
      
      // Add current request
      pipeline.zadd(key, now, `${now}-${Math.random()}`);
      
      // Set expiration
      pipeline.expire(key, Math.ceil(rateLimitConfig.windowMs / 1000));
      
      const results = await pipeline.exec();
      
      if (!results) {
        throw new Error('Redis pipeline failed');
      }
      
      const currentCount = Math.max(0, Number(results[1][1]) || 0);
      const resetTime = now + rateLimitConfig.windowMs;
      
      // Check if blocked
      const blockKey = this.generateBlockKey(identifier, action);
      const blockExpiry = await this.redis.get(blockKey);
      
      if (blockExpiry && parseInt(blockExpiry) > now) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: parseInt(blockExpiry),
          retryAfter: Math.ceil((parseInt(blockExpiry) - now) / 1000),
        };
      }
      
      // Check if limit exceeded
      if (currentCount >= rateLimitConfig.maxAttempts) {
        // Block the identifier
        await this.redis.setex(
          blockKey,
          Math.ceil(rateLimitConfig.blockDurationMs / 1000),
          (now + rateLimitConfig.blockDurationMs).toString()
        );
        
        return {
          allowed: false,
          remaining: 0,
          resetTime: now + rateLimitConfig.blockDurationMs,
          retryAfter: Math.ceil(rateLimitConfig.blockDurationMs / 1000),
        };
      }
      
      return {
        allowed: true,
        remaining: Math.max(0, rateLimitConfig.maxAttempts - currentCount - 1),
        resetTime,
      };
      
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Fail open - allow the request if Redis is down
      return {
        allowed: true,
        remaining: rateLimitConfig.maxAttempts - 1,
        resetTime: now + rateLimitConfig.windowMs,
      };
    }
  }
  
  /**
   * Reset rate limit for an identifier and action
   */
  async resetRateLimit(identifier: string, action: RateLimitAction): Promise<void> {
    const key = this.generateKey(identifier, action);
    const blockKey = this.generateBlockKey(identifier, action);
    
    await Promise.all([
      this.redis.del(key),
      this.redis.del(blockKey),
    ]);
  }
  
  /**
   * Get current rate limit status without incrementing
   */
  async getRateLimitStatus(
    identifier: string,
    action: RateLimitAction
  ): Promise<RateLimitResult> {
    const rateLimitConfig = RATE_LIMITS[action];
    const key = this.generateKey(identifier, action);
    const now = Date.now();
    const windowStart = now - rateLimitConfig.windowMs;
    
    try {
      // Check if blocked
      const blockKey = this.generateBlockKey(identifier, action);
      const blockExpiry = await this.redis.get(blockKey);
      
      if (blockExpiry && parseInt(blockExpiry) > now) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: parseInt(blockExpiry),
          retryAfter: Math.ceil((parseInt(blockExpiry) - now) / 1000),
        };
      }
      
      // Count current requests in window
      await this.redis.zremrangebyscore(key, 0, windowStart);
      const currentCount = await this.redis.zcard(key);
      const resetTime = now + rateLimitConfig.windowMs;
      
      return {
        allowed: currentCount < rateLimitConfig.maxAttempts,
        remaining: Math.max(0, rateLimitConfig.maxAttempts - currentCount),
        resetTime,
      };
      
    } catch (error) {
      console.error('Rate limit status error:', error);
      return {
        allowed: true,
        remaining: rateLimitConfig.maxAttempts,
        resetTime: now + rateLimitConfig.windowMs,
      };
    }
  }
  
  /**
   * Get rate limit statistics for monitoring
   */
  async getRateLimitStats(action: RateLimitAction): Promise<{
    totalRequests: number;
    blockedIdentifiers: number;
    topIdentifiers: Array<{ identifier: string; count: number }>;
  }> {
    try {
      const pattern = this.generateKey('*', action);
      const blockPattern = this.generateBlockKey('*', action);
      
      const [keys, blockKeys] = await Promise.all([
        this.redis.keys(pattern),
        this.redis.keys(blockPattern),
      ]);
      
      let totalRequests = 0;
      const identifierCounts: Record<string, number> = {};
      
      // Count requests per identifier
      for (const key of keys) {
        const count = await this.redis.zcard(key);
        totalRequests += count;
        
        const identifier = this.extractIdentifierFromKey(key, action);
        identifierCounts[identifier] = count;
      }
      
      // Sort identifiers by request count
      const topIdentifiers = Object.entries(identifierCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([identifier, count]) => ({ identifier, count }));
      
      return {
        totalRequests,
        blockedIdentifiers: blockKeys.length,
        topIdentifiers,
      };
      
    } catch (error) {
      console.error('Rate limit stats error:', error);
      return {
        totalRequests: 0,
        blockedIdentifiers: 0,
        topIdentifiers: [],
      };
    }
  }
  
  private generateKey(identifier: string, action: RateLimitAction): string {
    return `rate_limit:${action}:${identifier}`;
  }
  
  private generateBlockKey(identifier: string, action: RateLimitAction): string {
    return `rate_limit_block:${action}:${identifier}`;
  }
  
  private extractIdentifierFromKey(key: string, action: RateLimitAction): string {
    const prefix = `rate_limit:${action}:`;
    return key.substring(prefix.length);
  }
  
  /**
   * Clean up expired rate limit data
   */
  async cleanup(): Promise<void> {
    try {
      const now = Date.now();
      const patterns = Object.keys(RATE_LIMITS).map(action => 
        this.generateKey('*', action as RateLimitAction)
      );
      
      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        
        for (const key of keys) {
          const action = this.extractActionFromKey(key);
          if (action) {
            const config = RATE_LIMITS[action];
            const windowStart = now - config.windowMs;
            await this.redis.zremrangebyscore(key, 0, windowStart);
            
            // Remove empty keys
            const count = await this.redis.zcard(key);
            if (count === 0) {
              await this.redis.del(key);
            }
          }
        }
      }
    } catch (error) {
      console.error('Rate limit cleanup error:', error);
    }
  }
  
  private extractActionFromKey(key: string): RateLimitAction | null {
    const parts = key.split(':');
    if (parts.length >= 3 && parts[0] === 'rate_limit') {
      return parts[1] as RateLimitAction;
    }
    return null;
  }
  
  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

// Singleton instance - lazy initialization
let rateLimiterInstance: RateLimiter | null = null;

export const rateLimiter = {
  get instance(): RateLimiter {
    if (!rateLimiterInstance) {
      rateLimiterInstance = new RateLimiter();
    }
    return rateLimiterInstance;
  },
  
  // Delegate methods
  checkRateLimit: (identifier: string, action: RateLimitAction, customConfig?: Partial<RateLimitConfig>) =>
    rateLimiterInstance?.checkRateLimit(identifier, action, customConfig) || 
    Promise.resolve({ allowed: true, remaining: 100, resetTime: Date.now() + 60000 }),
    
  resetRateLimit: (identifier: string, action: RateLimitAction) =>
    rateLimiterInstance?.resetRateLimit(identifier, action) || Promise.resolve(),
    
  getRateLimitStatus: (identifier: string, action: RateLimitAction) =>
    rateLimiterInstance?.getRateLimitStatus(identifier, action) ||
    Promise.resolve({ allowed: true, remaining: 100, resetTime: Date.now() + 60000 }),
    
  getRateLimitStats: (action: RateLimitAction) =>
    rateLimiterInstance?.getRateLimitStats(action) ||
    Promise.resolve({ totalRequests: 0, blockedIdentifiers: 0, topIdentifiers: [] }),
    
  cleanup: () => rateLimiterInstance?.cleanup() || Promise.resolve(),
  
  disconnect: () => rateLimiterInstance?.disconnect() || Promise.resolve(),
};

/**
 * Middleware helper for rate limiting
 */
export async function checkRateLimit(
  identifier: string,
  action: RateLimitAction,
  customConfig?: Partial<RateLimitConfig>
): Promise<RateLimitResult> {
  return rateLimiter.instance.checkRateLimit(identifier, action, customConfig);
}

/**
 * Express-style middleware for rate limiting
 */
export function createRateLimitMiddleware(
  action: RateLimitAction,
  getIdentifier: (req: any) => string,
  customConfig?: Partial<RateLimitConfig>
) {
  return async (req: any, res: any, next: any) => {
    try {
      const identifier = getIdentifier(req);
      const result = await checkRateLimit(identifier, action, customConfig);
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', RATE_LIMITS[action].maxAttempts);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));
      
      if (!result.allowed) {
        if (result.retryAfter) {
          res.setHeader('Retry-After', result.retryAfter);
        }
        
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
        });
      }
      
      next();
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      // Fail open
      next();
    }
  };
}