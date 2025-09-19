#!/usr/bin/env tsx

/**
 * Background worker process for handling queued jobs
 * Runs email sending, AI processing, and other background tasks
 */

import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../src/lib/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Job processors
import { processCampaignEmail } from '../src/lib/queue/processors/campaign-email';
import { processAIInsights } from '../src/lib/queue/processors/ai-insights';
import { processAnalyticsAggregation } from '../src/lib/queue/processors/analytics-aggregation';

// Initialize Redis connection
const redis = new IORedis(config.redis.url, {
  password: config.redis.password,
  tls: config.redis.tls,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
});

// Initialize database connection
const dbConnection = postgres(config.database.url, {
  max: config.database.poolSize,
  ssl: config.database.ssl ? 'require' : false,
});

const db = drizzle(dbConnection);

// Job type definitions
interface CampaignEmailJob {
  campaignId: string;
  recipientId: string;
  tenantId: string;
}

interface AIInsightsJob {
  campaignId: string;
  tenantId: string;
}

interface AnalyticsAggregationJob {
  tenantId: string;
  date: string;
}

// Create workers for different job types
const campaignWorker = new Worker<CampaignEmailJob>(
  'campaign-emails',
  async (job: Job<CampaignEmailJob>) => {
    console.log(`Processing campaign email job: ${job.id}`);
    return await processCampaignEmail(job.data, db);
  },
  {
    connection: redis,
    concurrency: 5, // Process 5 emails concurrently
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
  }
);

const aiWorker = new Worker<AIInsightsJob>(
  'ai-insights',
  async (job: Job<AIInsightsJob>) => {
    console.log(`Processing AI insights job: ${job.id}`);
    return await processAIInsights(job.data, db);
  },
  {
    connection: redis,
    concurrency: 2, // Limit AI processing to avoid rate limits
    removeOnComplete: 50,
    removeOnFail: 25,
  }
);

const analyticsWorker = new Worker<AnalyticsAggregationJob>(
  'analytics-aggregation',
  async (job: Job<AnalyticsAggregationJob>) => {
    console.log(`Processing analytics aggregation job: ${job.id}`);
    return await processAnalyticsAggregation(job.data, db);
  },
  {
    connection: redis,
    concurrency: 1, // Single concurrent analytics job
    removeOnComplete: 30,
    removeOnFail: 10,
  }
);

// Error handling
campaignWorker.on('failed', (job, err) => {
  console.error(`Campaign email job ${job?.id} failed:`, err);
});

aiWorker.on('failed', (job, err) => {
  console.error(`AI insights job ${job?.id} failed:`, err);
});

analyticsWorker.on('failed', (job, err) => {
  console.error(`Analytics aggregation job ${job?.id} failed:`, err);
});

// Success logging
campaignWorker.on('completed', (job) => {
  console.log(`Campaign email job ${job.id} completed`);
});

aiWorker.on('completed', (job) => {
  console.log(`AI insights job ${job.id} completed`);
});

analyticsWorker.on('completed', (job) => {
  console.log(`Analytics aggregation job ${job.id} completed`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  
  await Promise.all([
    campaignWorker.close(),
    aiWorker.close(),
    analyticsWorker.close(),
  ]);
  
  await redis.quit();
  await dbConnection.end();
  
  console.log('Worker shutdown complete');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  
  await Promise.all([
    campaignWorker.close(),
    aiWorker.close(),
    analyticsWorker.close(),
  ]);
  
  await redis.quit();
  await dbConnection.end();
  
  console.log('Worker shutdown complete');
  process.exit(0);
});

console.log('🚀 Background workers started');
console.log('📧 Campaign email worker: ready');
console.log('🤖 AI insights worker: ready');
console.log('📊 Analytics aggregation worker: ready');