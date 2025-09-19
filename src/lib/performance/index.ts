/**
 * Performance module exports
 * Centralized exports for all performance utilities
 */

// Database performance utilities
export * from './database';

// Cache utilities
export * from './cache';

// Re-export commonly used functions with shorter names
export {
  withCache,
  invalidateCache,
  checkDatabaseHealth,
  QueryMonitor,
  paginateQuery,
  CacheKeys,
} from './database';

export {
  cacheManager,
  cache,
  CACHE_TTL,
  CACHE_PREFIXES,
} from './cache';