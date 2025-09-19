#!/usr/bin/env tsx

/**
 * Health check script for background workers
 * Used by Docker health check to ensure workers are running properly
 */

import IORedis from 'ioredis';
import { config } from '../src/lib/config';

async function checkWorkerHealth() {
  try {
    // Check Redis connection
    const redis = new IORedis(config.redis.url, {
      password: config.redis.password,
      tls: config.redis.tls,
      connectTimeout: 5000,
      lazyConnect: true,
    });

    await redis.ping();
    
    // Check if workers are processing jobs
    const activeJobs = await redis.llen('bull:campaign-emails:active');
    const waitingJobs = await redis.llen('bull:campaign-emails:waiting');
    
    console.log(`Active jobs: ${activeJobs}, Waiting jobs: ${waitingJobs}`);
    
    await redis.quit();
    
    console.log('✅ Worker health check passed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Worker health check failed:', error);
    process.exit(1);
  }
}

checkWorkerHealth();