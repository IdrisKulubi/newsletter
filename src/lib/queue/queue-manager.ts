/**
 * Queue Management Service
 * Provides high-level interface for job scheduling, monitoring, and management
 */

import { Job, JobsOptions } from 'bullmq';
import { 
  queues, 
  queueEvents, 
  EmailJobData, 
  AnalyticsJobData, 
  AIJobData,
  QUEUE_NAMES 
} from './index';

export interface JobScheduleOptions {
  delay?: number;
  repeat?: {
    pattern?: string; // Cron pattern
    every?: number; // Milliseconds
    limit?: number;
  };
  priority?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export class QueueManager {
  /**
   * Schedule an email processing job
   */
  async scheduleEmailJob(
    jobName: string,
    data: EmailJobData,
    options: JobScheduleOptions = {}
  ): Promise<Job<EmailJobData>> {
    const jobOptions: JobsOptions = {
      delay: options.delay,
      repeat: options.repeat,
      priority: options.priority || 0,
      attempts: options.attempts || 3,
      backoff: options.backoff || { type: 'exponential', delay: 2000 },
    };

    return await queues.email.add(jobName, data, jobOptions);
  }

  /**
   * Schedule an analytics processing job
   */
  async scheduleAnalyticsJob(
    jobName: string,
    data: AnalyticsJobData,
    options: JobScheduleOptions = {}
  ): Promise<Job<AnalyticsJobData>> {
    const jobOptions: JobsOptions = {
      delay: options.delay,
      repeat: options.repeat,
      priority: options.priority || 0,
      attempts: options.attempts || 2,
      backoff: options.backoff || { type: 'exponential', delay: 1000 },
    };

    return await queues.analytics.add(jobName, data, jobOptions);
  }

  /**
   * Schedule an AI processing job
   */
  async scheduleAIJob(
    jobName: string,
    data: AIJobData,
    options: JobScheduleOptions = {}
  ): Promise<Job<AIJobData>> {
    const jobOptions: JobsOptions = {
      delay: options.delay,
      repeat: options.repeat,
      priority: options.priority || 0,
      attempts: options.attempts || 2,
      backoff: options.backoff || { type: 'exponential', delay: 5000 },
    };

    return await queues.ai.add(jobName, data, jobOptions);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: keyof typeof queues): Promise<QueueStats> {
    const queue = queues[queueName];
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: await queue.isPaused(),
    };
  }

  /**
   * Get all queue statistics
   */
  async getAllQueueStats(): Promise<Record<string, QueueStats>> {
    const [emailStats, analyticsStats, aiStats] = await Promise.all([
      this.getQueueStats('email'),
      this.getQueueStats('analytics'),
      this.getQueueStats('ai'),
    ]);

    return {
      email: emailStats,
      analytics: analyticsStats,
      ai: aiStats,
    };
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: keyof typeof queues): Promise<void> {
    await queues[queueName].pause();
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: keyof typeof queues): Promise<void> {
    await queues[queueName].resume();
  }

  /**
   * Clean completed jobs from a queue
   */
  async cleanQueue(
    queueName: keyof typeof queues,
    grace: number = 24 * 60 * 60 * 1000 // 24 hours
  ): Promise<void> {
    const queue = queues[queueName];
    await Promise.all([
      queue.clean(grace, 100, 'completed'),
      queue.clean(grace, 50, 'failed'),
    ]);
  }

  /**
   * Get failed jobs for a queue
   */
  async getFailedJobs(queueName: keyof typeof queues, limit: number = 50): Promise<Job[]> {
    return await queues[queueName].getFailed(0, limit);
  }

  /**
   * Retry a failed job
   */
  async retryJob(queueName: keyof typeof queues, jobId: string): Promise<void> {
    const queue = queues[queueName];
    const job = await queue.getJob(jobId);
    if (job) {
      await job.retry();
    }
  }

  /**
   * Remove a job from queue
   */
  async removeJob(queueName: keyof typeof queues, jobId: string): Promise<void> {
    const queue = queues[queueName];
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }

  /**
   * Schedule recurring analytics aggregation job
   */
  async scheduleRecurringAnalytics(tenantId: string): Promise<Job<AnalyticsJobData>> {
    return await this.scheduleAnalyticsJob(
      `daily-analytics-${tenantId}`,
      {
        campaignId: '',
        tenantId,
        eventType: 'daily-aggregation',
      },
      {
        repeat: {
          pattern: '0 2 * * *', // Daily at 2 AM
        },
      }
    );
  }

  /**
   * Schedule batch email sending
   */
  async scheduleBatchEmailSending(
    campaignId: string,
    tenantId: string,
    recipients: EmailJobData['recipients'],
    batchSize: number = 100
  ): Promise<Job<EmailJobData>[]> {
    const jobs: Job<EmailJobData>[] = [];
    
    // Split recipients into batches
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const job = await this.scheduleEmailJob(
        `email-batch-${campaignId}-${Math.floor(i / batchSize)}`,
        {
          campaignId,
          tenantId,
          recipients: batch,
          batchSize,
        },
        {
          priority: 10, // High priority for email sending
        }
      );
      jobs.push(job);
    }

    return jobs;
  }

  /**
   * Health check for queue system
   */
  async healthCheck(): Promise<{
    redis: boolean;
    queues: Record<string, boolean>;
    overall: boolean;
  }> {
    try {
      // Check Redis connection
      const redisHealth = await queues.email.client.ping() === 'PONG';
      
      // Check each queue
      const queueHealth = await Promise.all(
        Object.entries(queues).map(async ([name, queue]) => {
          try {
            await queue.getWaiting();
            return [name, true];
          } catch {
            return [name, false];
          }
        })
      );

      const queueHealthMap = Object.fromEntries(queueHealth);
      const allQueuesHealthy = Object.values(queueHealthMap).every(Boolean);

      return {
        redis: redisHealth,
        queues: queueHealthMap,
        overall: redisHealth && allQueuesHealthy,
      };
    } catch (error) {
      return {
        redis: false,
        queues: Object.fromEntries(Object.keys(queues).map(name => [name, false])),
        overall: false,
      };
    }
  }
}

// Export singleton instance
export const queueManager = new QueueManager();