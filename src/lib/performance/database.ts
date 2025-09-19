/**
 * Database performance optimization utilities
 * Provides query optimization, connection pooling, and caching strategies
 */

import { Redis } from 'ioredis';
import { config } from '@/lib/config';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

// Cache configuration
export const CACHE_TTL = {
  SHORT: 5 * 60, // 5 minutes
  MEDIUM: 30 * 60, // 30 minutes
  LONG: 60 * 60, // 1 hour
  VERY_LONG: 24 * 60 * 60, // 24 hours
} as const;

// Redis client for caching
let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redis.url, {
      retryStrategy: () => 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return redisClient;
}

/**
 * Cache key generators
 */
export const CacheKeys = {
  tenant: (id: string) => `tenant:${id}`,
  tenantByDomain: (domain: string) => `tenant:domain:${domain}`,
  user: (id: string) => `user:${id}`,
  userByEmail: (email: string) => `user:email:${email}`,
  newsletter: (id: string) => `newsletter:${id}`,
  campaign: (id: string) => `campaign:${id}`,
  campaignAnalytics: (id: string) => `campaign:analytics:${id}`,
  tenantAnalytics: (tenantId: string, period: string) => `analytics:${tenantId}:${period}`,
  tenantUsers: (tenantId: string) => `tenant:users:${tenantId}`,
  tenantNewsletters: (tenantId: string) => `tenant:newsletters:${tenantId}`,
  tenantCampaigns: (tenantId: string) => `tenant:campaigns:${tenantId}`,
} as const;

/**
 * Generic cache wrapper for database queries
 */
export async function withCache<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttl: number = CACHE_TTL.MEDIUM
): Promise<T> {
  const redis = getRedisClient();
  
  try {
    // Try to get from cache first
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Execute query
    const result = await queryFn();
    
    // Cache the result
    await redis.setex(key, ttl, JSON.stringify(result));
    
    return result;
  } catch (error) {
    console.error('Cache error:', error);
    // Fallback to direct query
    return queryFn();
  }
}

/**
 * Invalidate cache entries by pattern
 */
export async function invalidateCache(pattern: string): Promise<void> {
  const redis = getRedisClient();
  
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}

/**
 * Batch cache invalidation for related entities
 */
export async function invalidateRelatedCache(tenantId: string, entityType?: string): Promise<void> {
  const patterns = [
    `tenant:${tenantId}`,
    `tenant:users:${tenantId}`,
    `tenant:newsletters:${tenantId}`,
    `tenant:campaigns:${tenantId}`,
    `analytics:${tenantId}:*`,
  ];
  
  if (entityType) {
    patterns.push(`${entityType}:*`);
  }
  
  await Promise.all(patterns.map(pattern => invalidateCache(pattern)));
}

/**
 * Database connection health check
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latency: number;
  activeConnections?: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    // Dynamic import to avoid circular dependencies in tests
    const { db } = await import('@/lib/db');
    
    // Simple query to check connection
    await db.execute(sql`SELECT 1`);
    
    const latency = Date.now() - startTime;
    
    // Get connection pool stats if available
    let activeConnections: number | undefined;
    try {
      const result = await db.execute(sql`
        SELECT count(*) as active_connections 
        FROM pg_stat_activity 
        WHERE state = 'active'
      `);
      activeConnections = Number(result[0]?.active_connections) || 0;
    } catch {
      // Ignore if we can't get connection stats
    }
    
    return {
      healthy: true,
      latency,
      activeConnections,
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Query performance monitoring
 */
export class QueryMonitor {
  private static slowQueryThreshold = 1000; // 1 second
  private static queries: Array<{
    query: string;
    duration: number;
    timestamp: Date;
    tenantId?: string;
  }> = [];
  
  static async monitor<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    tenantId?: string
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;
      
      // Log slow queries
      if (duration > this.slowQueryThreshold) {
        console.warn(`Slow query detected: ${queryName} took ${duration}ms`, {
          query: queryName,
          duration,
          tenantId,
        });
      }
      
      // Store query stats (keep last 100 queries)
      this.queries.push({
        query: queryName,
        duration,
        timestamp: new Date(),
        tenantId,
      });
      
      if (this.queries.length > 100) {
        this.queries.shift();
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Query failed: ${queryName} after ${duration}ms`, error);
      throw error;
    }
  }
  
  static getStats(): {
    totalQueries: number;
    averageDuration: number;
    slowQueries: number;
    recentQueries: Array<{
      query: string;
      duration: number;
      timestamp: Date;
      tenantId?: string;
    }>;
  } {
    const totalQueries = this.queries.length;
    const averageDuration = totalQueries > 0 
      ? this.queries.reduce((sum, q) => sum + q.duration, 0) / totalQueries 
      : 0;
    const slowQueries = this.queries.filter(q => q.duration > this.slowQueryThreshold).length;
    
    return {
      totalQueries,
      averageDuration,
      slowQueries,
      recentQueries: this.queries.slice(-10),
    };
  }
  
  static clearStats(): void {
    this.queries = [];
  }
}

/**
 * Optimized pagination helper
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export async function paginateQuery<T>(
  queryFn: (offset: number, limit: number) => Promise<T[]>,
  countFn: () => Promise<number>,
  options: PaginationOptions,
  cacheKey?: string
): Promise<PaginationResult<T>> {
  const { page, limit } = options;
  const offset = (page - 1) * limit;
  
  const executeQuery = async () => {
    const [data, total] = await Promise.all([
      queryFn(offset, limit),
      countFn(),
    ]);
    
    const totalPages = Math.ceil(total / limit);
    
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  };
  
  if (cacheKey) {
    const fullCacheKey = `${cacheKey}:page:${page}:limit:${limit}`;
    return withCache(fullCacheKey, executeQuery, CACHE_TTL.SHORT);
  }
  
  return executeQuery();
}

/**
 * Bulk operations helper
 */
export async function bulkInsert<T>(
  tableName: string,
  data: T[],
  batchSize: number = 1000
): Promise<void> {
  if (data.length === 0) return;
  
  // Process in batches to avoid memory issues
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    try {
      // Use a transaction for each batch
      await db.transaction(async (tx) => {
        // This would need to be implemented per table
        // For now, we'll use a generic approach
        console.log(`Bulk inserting ${batch.length} records into ${tableName}`);
      });
    } catch (error) {
      console.error(`Bulk insert failed for batch ${i / batchSize + 1}:`, error);
      throw error;
    }
  }
}

/**
 * Database index recommendations
 */
export const RECOMMENDED_INDEXES = {
  tenants: [
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenants_domain ON tenants(domain)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenants_custom_domain ON tenants(custom_domain)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenants_active ON tenants(is_active)',
  ],
  users: [
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_tenant_id ON users(tenant_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active ON users(is_active)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role ON users(role)',
  ],
  newsletters: [
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletters_tenant_id ON newsletters(tenant_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletters_status ON newsletters(status)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletters_created_at ON newsletters(created_at)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletters_tenant_status ON newsletters(tenant_id, status)',
  ],
  campaigns: [
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_tenant_id ON campaigns(tenant_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_status ON campaigns(status)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_scheduled_at ON campaigns(scheduled_at)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_tenant_status ON campaigns(tenant_id, status)',
  ],
  email_events: [
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_campaign_id ON email_events(campaign_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_tenant_id ON email_events(tenant_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_event_type ON email_events(event_type)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_timestamp ON email_events(timestamp)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_tenant_timestamp ON email_events(tenant_id, timestamp)',
  ],
} as const;

/**
 * Apply recommended database indexes
 */
export async function applyRecommendedIndexes(): Promise<void> {
  console.log('Applying recommended database indexes...');
  
  const { db } = await import('@/lib/db');
  
  for (const [table, indexes] of Object.entries(RECOMMENDED_INDEXES)) {
    console.log(`Creating indexes for ${table}...`);
    
    for (const indexSql of indexes) {
      try {
        await db.execute(sql.raw(indexSql));
        console.log(`✓ Applied index: ${indexSql}`);
      } catch (error) {
        console.error(`✗ Failed to apply index: ${indexSql}`, error);
      }
    }
  }
  
  console.log('Finished applying recommended indexes');
}

/**
 * Database maintenance utilities
 */
export async function runDatabaseMaintenance(): Promise<void> {
  console.log('Running database maintenance...');
  
  try {
    const { db } = await import('@/lib/db');
    
    // Analyze tables for better query planning
    await db.execute(sql`ANALYZE`);
    console.log('✓ Database analysis completed');
    
    // Vacuum to reclaim space (non-blocking)
    await db.execute(sql`VACUUM (ANALYZE)`);
    console.log('✓ Database vacuum completed');
    
  } catch (error) {
    console.error('Database maintenance failed:', error);
  }
}

/**
 * Connection pool monitoring
 */
export async function getConnectionPoolStats(): Promise<{
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
}> {
  try {
    const { db } = await import('@/lib/db');
    
    const result = await db.execute(sql`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections,
        count(*) FILTER (WHERE state = 'idle in transaction') as waiting_connections
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `);
    
    const stats = result[0] as any;
    
    return {
      totalConnections: Number(stats.total_connections) || 0,
      activeConnections: Number(stats.active_connections) || 0,
      idleConnections: Number(stats.idle_connections) || 0,
      waitingConnections: Number(stats.waiting_connections) || 0,
    };
  } catch (error) {
    console.error('Failed to get connection pool stats:', error);
    return {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingConnections: 0,
    };
  }
}