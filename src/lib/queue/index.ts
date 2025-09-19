/**
 * Queue system infrastructure with Redis and BullMQ
 * Handles background job processing, scheduling, and monitoring
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { config } from '@/lib/config';

// Redis connection configuration
const redisConfig = {
  host: config.redis.url.includes('://') 
    ? new URL(config.redis.url).hostname 
    : config.redis.url.split(':')[0],
  port: config.redis.url.includes('://') 
    ? parseInt(new URL(config.redis.url).port) || 6379
    : parseInt(config.redis.url.split(':')[1]) || 6379,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
};

// Create Redis connection for BullMQ
export const redisConnection = new Redis(redisConfig);

// Job types and their data interfaces
export interface EmailJobData {
  campaignId: string;
  tenantId: string;
  recipients: Array<{
    email: string;
    name?: string;
    personalizations?: Record<string, any>;
  }>;
  batchSize?: number;
}

export interface AnalyticsJobData {
  campaignId: string;
  tenantId: string;
  eventType: 'campaign-complete' | 'daily-aggregation';
  data?: Record<string, any>;
}

export interface AIJobData {
  tenantId: string;
  type: 'content-generation' | 'subject-optimization' | 'campaign-insights';
  data: Record<string, any>;
}

export type JobData = EmailJobData | AnalyticsJobData | AIJobData;

// Queue names
export const QUEUE_NAMES = {
  EMAIL: 'email-processing',
  ANALYTICS: 'analytics-processing', 
  AI: 'ai-processing',
} as const;

// Create queues
export const emailQueue = new Queue<EmailJobData>(QUEUE_NAMES.EMAIL, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

export const analyticsQueue = new Queue<AnalyticsJobData>(QUEUE_NAMES.ANALYTICS, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

export const aiQueue = new Queue<AIJobData>(QUEUE_NAMES.AI, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 25,
    removeOnFail: 10,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

// Queue events for monitoring
export const emailQueueEvents = new QueueEvents(QUEUE_NAMES.EMAIL, {
  connection: redisConnection,
});

export const analyticsQueueEvents = new QueueEvents(QUEUE_NAMES.ANALYTICS, {
  connection: redisConnection,
});

export const aiQueueEvents = new QueueEvents(QUEUE_NAMES.AI, {
  connection: redisConnection,
});

// Export all queues for easy access
export const queues = {
  email: emailQueue,
  analytics: analyticsQueue,
  ai: aiQueue,
} as const;

// Export all queue events for monitoring
export const queueEvents = {
  email: emailQueueEvents,
  analytics: analyticsQueueEvents,
  ai: aiQueueEvents,
} as const;

// Re-export components for easy access (lazy loading to avoid circular dependencies)
export * from './queue-manager';
export * from './queue-monitor';
export * from './dev-tools';
export * from './workers';