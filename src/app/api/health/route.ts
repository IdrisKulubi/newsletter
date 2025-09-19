/**
 * Health check endpoint for monitoring and load balancers
 */

import { NextRequest, NextResponse } from 'next/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import IORedis from 'ioredis';
import { config } from '@/lib/config';
import { logger } from '@/lib/monitoring/logger';

interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  checks: {
    database: {
      status: 'healthy' | 'unhealthy';
      latency?: number;
      error?: string;
    };
    redis: {
      status: 'healthy' | 'unhealthy';
      latency?: number;
      error?: string;
    };
    storage: {
      status: 'healthy' | 'unhealthy';
      error?: string;
    };
  };
  uptime: number;
}

const startTime = Date.now();

export async function GET(request: NextRequest) {
  const start = Date.now();
  
  const healthCheck: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.app.nodeEnv,
    checks: {
      database: { status: 'unhealthy' },
      redis: { status: 'unhealthy' },
      storage: { status: 'unhealthy' },
    },
    uptime: Date.now() - startTime,
  };

  // Check database connection
  try {
    const dbStart = Date.now();
    const connection = postgres(config.database.url, {
      max: 1,
      ssl: config.database.ssl ? 'require' : false,
    });
    
    const db = drizzle(connection);
    await db.execute('SELECT 1');
    await connection.end();
    
    healthCheck.checks.database = {
      status: 'healthy',
      latency: Date.now() - dbStart,
    };
  } catch (error) {
    healthCheck.checks.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
    healthCheck.status = 'unhealthy';
  }

  // Check Redis connection
  try {
    const redisStart = Date.now();
    const redis = new IORedis(config.redis.url, {
      password: config.redis.password,
      tls: config.redis.tls,
      connectTimeout: 5000,
      lazyConnect: true,
    });
    
    await redis.ping();
    await redis.quit();
    
    healthCheck.checks.redis = {
      status: 'healthy',
      latency: Date.now() - redisStart,
    };
  } catch (error) {
    healthCheck.checks.redis = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown Redis error',
    };
    healthCheck.status = 'unhealthy';
  }

  // Check storage (simplified check)
  try {
    // For now, just check if credentials are configured
    if (config.r2.accessKeyId && config.r2.secretAccessKey && config.r2.bucketName) {
      healthCheck.checks.storage = {
        status: 'healthy',
      };
    } else {
      throw new Error('Storage credentials not configured');
    }
  } catch (error) {
    healthCheck.checks.storage = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown storage error',
    };
    healthCheck.status = 'unhealthy';
  }

  // Log health check
  const duration = Date.now() - start;
  logger.info('Health Check', {
    type: 'health_check',
    status: healthCheck.status,
    duration,
    checks: healthCheck.checks,
  });

  // Return appropriate status code
  const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
  
  return NextResponse.json(healthCheck, { status: statusCode });
}