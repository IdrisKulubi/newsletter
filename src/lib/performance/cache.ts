/**
 * Redis caching utilities for frequently accessed data
 * Provides intelligent caching strategies for different data types
 */

import { Redis } from 'ioredis';
import { config } from '@/lib/config';

// Cache TTL configurations
export const CACHE_TTL = {
  VERY_SHORT: 60, // 1 minute
  SHORT: 5 * 60, // 5 minutes
  MEDIUM: 30 * 60, // 30 minutes
  LONG: 60 * 60, // 1 hour
  VERY_LONG: 24 * 60 * 60, // 24 hours
  WEEK: 7 * 24 * 60 * 60, // 1 week
} as const;

// Cache key prefixes for organization
export const CACHE_PREFIXES = {
  TENANT: 'tenant',
  USER: 'user',
  NEWSLETTER: 'newsletter',
  CAMPAIGN: 'campaign',
  ANALYTICS: 'analytics',
  SESSION: 'session',
  RATE_LIMIT: 'rate_limit',
  TEMP: 'temp',
} as const;

export type CachePrefix = keyof typeof CACHE_PREFIXES;

class CacheManager {
  private redis: Redis;
  private isConnected = false;
  
  constructor() {
    this.redis = new Redis(config.redis.url, {
      connectTimeout: 5000,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keyPrefix: 'newsletter:',
    });
    
    this.redis.on('connect', () => {
      this.isConnected = true;
      console.log('Redis cache connected');
    });
    
    this.redis.on('error', (error) => {
      this.isConnected = false;
      console.error('Redis cache error:', error);
    });
  }
  
  /**
   * Generate a cache key with proper namespacing
   */
  private generateKey(prefix: CachePrefix, key: string): string {
    return `${CACHE_PREFIXES[prefix]}:${key}`;
  }
  
  /**
   * Get a value from cache
   */
  async get<T>(prefix: CachePrefix, key: string): Promise<T | null> {
    if (!this.isConnected) return null;
    
    try {
      const cacheKey = this.generateKey(prefix, key);
      const value = await this.redis.get(cacheKey);
      
      if (value === null) return null;
      
      return JSON.parse(value);
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }
  
  /**
   * Set a value in cache with TTL
   */
  async set<T>(
    prefix: CachePrefix,
    key: string,
    value: T,
    ttl: number = CACHE_TTL.MEDIUM
  ): Promise<boolean> {
    if (!this.isConnected) return false;
    
    try {
      const cacheKey = this.generateKey(prefix, key);
      const serialized = JSON.stringify(value);
      
      await this.redis.setex(cacheKey, ttl, serialized);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }
  
  /**
   * Delete a value from cache
   */
  async delete(prefix: CachePrefix, key: string): Promise<boolean> {
    if (!this.isConnected) return false;
    
    try {
      const cacheKey = this.generateKey(prefix, key);
      const result = await this.redis.del(cacheKey);
      return result > 0;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }
  
  /**
   * Delete multiple keys by pattern
   */
  async deletePattern(prefix: CachePrefix, pattern: string): Promise<number> {
    if (!this.isConnected) return 0;
    
    try {
      const searchPattern = this.generateKey(prefix, pattern);
      const keys = await this.redis.keys(searchPattern);
      
      if (keys.length === 0) return 0;
      
      const result = await this.redis.del(...keys);
      return result;
    } catch (error) {
      console.error('Cache delete pattern error:', error);
      return 0;
    }
  }
  
  /**
   * Check if a key exists in cache
   */
  async exists(prefix: CachePrefix, key: string): Promise<boolean> {
    if (!this.isConnected) return false;
    
    try {
      const cacheKey = this.generateKey(prefix, key);
      const result = await this.redis.exists(cacheKey);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }
  
  /**
   * Get TTL for a key
   */
  async getTTL(prefix: CachePrefix, key: string): Promise<number> {
    if (!this.isConnected) return -1;
    
    try {
      const cacheKey = this.generateKey(prefix, key);
      return await this.redis.ttl(cacheKey);
    } catch (error) {
      console.error('Cache TTL error:', error);
      return -1;
    }
  }
  
  /**
   * Increment a numeric value in cache
   */
  async increment(
    prefix: CachePrefix,
    key: string,
    amount: number = 1,
    ttl?: number
  ): Promise<number> {
    if (!this.isConnected) return 0;
    
    try {
      const cacheKey = this.generateKey(prefix, key);
      const result = await this.redis.incrby(cacheKey, amount);
      
      if (ttl && result === amount) {
        // Set TTL only if this is a new key
        await this.redis.expire(cacheKey, ttl);
      }
      
      return result;
    } catch (error) {
      console.error('Cache increment error:', error);
      return 0;
    }
  }
  
  /**
   * Set multiple values at once
   */
  async setMultiple<T>(
    prefix: CachePrefix,
    entries: Array<{ key: string; value: T; ttl?: number }>,
    defaultTTL: number = CACHE_TTL.MEDIUM
  ): Promise<boolean> {
    if (!this.isConnected || entries.length === 0) return false;
    
    try {
      const pipeline = this.redis.pipeline();
      
      entries.forEach(({ key, value, ttl }) => {
        const cacheKey = this.generateKey(prefix, key);
        const serialized = JSON.stringify(value);
        pipeline.setex(cacheKey, ttl || defaultTTL, serialized);
      });
      
      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('Cache set multiple error:', error);
      return false;
    }
  }
  
  /**
   * Get multiple values at once
   */
  async getMultiple<T>(
    prefix: CachePrefix,
    keys: string[]
  ): Promise<Record<string, T | null>> {
    if (!this.isConnected || keys.length === 0) return {};
    
    try {
      const cacheKeys = keys.map(key => this.generateKey(prefix, key));
      const values = await this.redis.mget(...cacheKeys);
      
      const result: Record<string, T | null> = {};
      
      keys.forEach((key, index) => {
        const value = values[index];
        result[key] = value ? JSON.parse(value) : null;
      });
      
      return result;
    } catch (error) {
      console.error('Cache get multiple error:', error);
      return {};
    }
  }
  
  /**
   * Cache with automatic refresh
   */
  async getOrSet<T>(
    prefix: CachePrefix,
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = CACHE_TTL.MEDIUM,
    refreshThreshold: number = 0.1 // Refresh when 10% of TTL remains
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(prefix, key);
      
      if (cached !== null) {
        // Check if we should refresh in background
        const remainingTTL = await this.getTTL(prefix, key);
        const shouldRefresh = remainingTTL > 0 && remainingTTL < (ttl * refreshThreshold);
        
        if (shouldRefresh) {
          // Refresh in background without blocking
          fetchFn().then(freshValue => {
            this.set(prefix, key, freshValue, ttl);
          }).catch(error => {
            console.error('Background cache refresh failed:', error);
          });
        }
        
        return cached;
      }
      
      // Not in cache, fetch and store
      const freshValue = await fetchFn();
      await this.set(prefix, key, freshValue, ttl);
      
      return freshValue;
    } catch (error) {
      console.error('Cache get or set error:', error);
      // Fallback to direct fetch
      return fetchFn();
    }
  }
  
  /**
   * Distributed lock implementation
   */
  async acquireLock(
    lockKey: string,
    ttl: number = 30,
    retryAttempts: number = 3,
    retryDelay: number = 100
  ): Promise<string | null> {
    if (!this.isConnected) return null;
    
    const lockValue = `${Date.now()}-${Math.random()}`;
    const cacheKey = this.generateKey('TEMP', `lock:${lockKey}`);
    
    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      try {
        const result = await this.redis.set(cacheKey, lockValue, 'EX', ttl, 'NX');
        
        if (result === 'OK') {
          return lockValue;
        }
        
        if (attempt < retryAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      } catch (error) {
        console.error('Lock acquisition error:', error);
      }
    }
    
    return null;
  }
  
  /**
   * Release distributed lock
   */
  async releaseLock(lockKey: string, lockValue: string): Promise<boolean> {
    if (!this.isConnected) return false;
    
    try {
      const cacheKey = this.generateKey('TEMP', `lock:${lockKey}`);
      
      // Use Lua script to ensure atomic check and delete
      const luaScript = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `;
      
      const result = await this.redis.eval(luaScript, 1, cacheKey, lockValue);
      return result === 1;
    } catch (error) {
      console.error('Lock release error:', error);
      return false;
    }
  }
  
  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    memoryUsage: string;
    keyCount: number;
    hitRate?: number;
  }> {
    if (!this.isConnected) {
      return {
        connected: false,
        memoryUsage: '0B',
        keyCount: 0,
      };
    }
    
    try {
      const info = await this.redis.info('memory');
      const keyCount = await this.redis.dbsize();
      
      // Parse memory usage from info
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : '0B';
      
      return {
        connected: true,
        memoryUsage,
        keyCount,
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return {
        connected: false,
        memoryUsage: '0B',
        keyCount: 0,
      };
    }
  }
  
  /**
   * Clear all cache entries with a specific prefix
   */
  async clearPrefix(prefix: CachePrefix): Promise<number> {
    return this.deletePattern(prefix, '*');
  }
  
  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isConnected) return false;
    
    try {
      const testKey = this.generateKey('TEMP', 'health_check');
      await this.redis.setex(testKey, 1, 'ok');
      const result = await this.redis.get(testKey);
      await this.redis.del(testKey);
      
      return result === 'ok';
    } catch (error) {
      console.error('Cache health check failed:', error);
      return false;
    }
  }
  
  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
    this.isConnected = false;
  }
}

// Singleton instance - lazy initialization
let cacheManagerInstance: CacheManager | null = null;

export const cacheManager = {
  get instance(): CacheManager {
    if (!cacheManagerInstance) {
      cacheManagerInstance = new CacheManager();
    }
    return cacheManagerInstance;
  },
  
  // Delegate methods for backward compatibility
  get: <T>(prefix: CachePrefix, key: string) => 
    cacheManagerInstance?.get<T>(prefix, key) || Promise.resolve(null),
  set: <T>(prefix: CachePrefix, key: string, value: T, ttl?: number) => 
    cacheManagerInstance?.set(prefix, key, value, ttl) || Promise.resolve(false),
  delete: (prefix: CachePrefix, key: string) => 
    cacheManagerInstance?.delete(prefix, key) || Promise.resolve(false),
  exists: (prefix: CachePrefix, key: string) => 
    cacheManagerInstance?.exists(prefix, key) || Promise.resolve(false),
  getTTL: (prefix: CachePrefix, key: string) => 
    cacheManagerInstance?.getTTL(prefix, key) || Promise.resolve(-1),
  increment: (prefix: CachePrefix, key: string, amount?: number, ttl?: number) => 
    cacheManagerInstance?.increment(prefix, key, amount, ttl) || Promise.resolve(0),
  setMultiple: <T>(prefix: CachePrefix, entries: Array<{ key: string; value: T; ttl?: number }>, defaultTTL?: number) => 
    cacheManagerInstance?.setMultiple(prefix, entries, defaultTTL) || Promise.resolve(false),
  getMultiple: <T>(prefix: CachePrefix, keys: string[]) => 
    cacheManagerInstance?.getMultiple<T>(prefix, keys) || Promise.resolve({}),
  getOrSet: <T>(prefix: CachePrefix, key: string, fetchFn: () => Promise<T>, ttl?: number, refreshThreshold?: number) => 
    cacheManagerInstance?.getOrSet(prefix, key, fetchFn, ttl, refreshThreshold) || fetchFn(),
  deletePattern: (prefix: CachePrefix, pattern: string) => 
    cacheManagerInstance?.deletePattern(prefix, pattern) || Promise.resolve(0),
  acquireLock: (lockKey: string, ttl?: number, retryAttempts?: number, retryDelay?: number) => 
    cacheManagerInstance?.acquireLock(lockKey, ttl, retryAttempts, retryDelay) || Promise.resolve(null),
  releaseLock: (lockKey: string, lockValue: string) => 
    cacheManagerInstance?.releaseLock(lockKey, lockValue) || Promise.resolve(false),
  getStats: () => 
    cacheManagerInstance?.getStats() || Promise.resolve({ connected: false, memoryUsage: '0B', keyCount: 0 }),
  clearPrefix: (prefix: CachePrefix) => 
    cacheManagerInstance?.clearPrefix(prefix) || Promise.resolve(0),
  healthCheck: () => 
    cacheManagerInstance?.healthCheck() || Promise.resolve(false),
  disconnect: () => 
    cacheManagerInstance?.disconnect() || Promise.resolve(),
};

// Convenience functions for common cache operations
export const cache = {
  // Tenant caching
  getTenant: (id: string) => cacheManager.get('TENANT', id),
  setTenant: (id: string, data: any) => cacheManager.set('TENANT', id, data, CACHE_TTL.LONG),
  deleteTenant: (id: string) => cacheManager.delete('TENANT', id),
  
  // User caching
  getUser: (id: string) => cacheManager.get('USER', id),
  setUser: (id: string, data: any) => cacheManager.set('USER', id, data, CACHE_TTL.MEDIUM),
  deleteUser: (id: string) => cacheManager.delete('USER', id),
  
  // Newsletter caching
  getNewsletter: (id: string) => cacheManager.get('NEWSLETTER', id),
  setNewsletter: (id: string, data: any) => cacheManager.set('NEWSLETTER', id, data, CACHE_TTL.SHORT),
  deleteNewsletter: (id: string) => cacheManager.delete('NEWSLETTER', id),
  
  // Campaign caching
  getCampaign: (id: string) => cacheManager.get('CAMPAIGN', id),
  setCampaign: (id: string, data: any) => cacheManager.set('CAMPAIGN', id, data, CACHE_TTL.SHORT),
  deleteCampaign: (id: string) => cacheManager.delete('CAMPAIGN', id),
  
  // Analytics caching
  getAnalytics: (key: string) => cacheManager.get('ANALYTICS', key),
  setAnalytics: (key: string, data: any, ttl = CACHE_TTL.MEDIUM) => 
    cacheManager.set('ANALYTICS', key, data, ttl),
  deleteAnalytics: (key: string) => cacheManager.delete('ANALYTICS', key),
  
  // Session caching
  getSession: (id: string) => cacheManager.get('SESSION', id),
  setSession: (id: string, data: any) => cacheManager.set('SESSION', id, data, CACHE_TTL.LONG),
  deleteSession: (id: string) => cacheManager.delete('SESSION', id),
  
  // Generic operations
  get: <T>(prefix: CachePrefix, key: string) => cacheManager.get<T>(prefix, key),
  set: <T>(prefix: CachePrefix, key: string, value: T, ttl?: number) => 
    cacheManager.set(prefix, key, value, ttl),
  delete: (prefix: CachePrefix, key: string) => cacheManager.delete(prefix, key),
  exists: (prefix: CachePrefix, key: string) => cacheManager.exists(prefix, key),
  
  // Utility functions
  getOrSet: <T>(prefix: CachePrefix, key: string, fetchFn: () => Promise<T>, ttl?: number) =>
    cacheManager.getOrSet(prefix, key, fetchFn, ttl),
  acquireLock: (key: string, ttl?: number) => cacheManager.acquireLock(key, ttl),
  releaseLock: (key: string, value: string) => cacheManager.releaseLock(key, value),
  
  // Management
  getStats: () => cacheManager.getStats(),
  healthCheck: () => cacheManager.healthCheck(),
  clearPrefix: (prefix: CachePrefix) => cacheManager.clearPrefix(prefix),
};