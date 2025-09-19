/**
 * Development Tools for Queue Inspection and Management
 * Provides utilities for debugging and managing queues in development
 */

import { Job } from 'bullmq';
import { queues, queueEvents, QUEUE_NAMES } from './index';
import { queueManager } from './queue-manager';
import { queueMonitor } from './queue-monitor';

export interface JobDetails {
  id: string;
  name: string;
  data: any;
  opts: any;
  progress: number;
  delay: number;
  timestamp: number;
  attemptsMade: number;
  failedReason?: string;
  finishedOn?: number;
  processedOn?: number;
  returnvalue?: any;
}

export interface QueueInspection {
  name: string;
  stats: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  };
  jobs: {
    waiting: JobDetails[];
    active: JobDetails[];
    completed: JobDetails[];
    failed: JobDetails[];
    delayed: JobDetails[];
  };
}

export class QueueDevTools {
  /**
   * Get detailed information about a specific queue
   */
  async inspectQueue(queueName: keyof typeof queues): Promise<QueueInspection> {
    const queue = queues[queueName];
    
    // Get queue statistics
    const stats = await queueManager.getQueueStats(queueName);
    
    // Get jobs in different states
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(0, 10),
      queue.getActive(0, 10),
      queue.getCompleted(0, 10),
      queue.getFailed(0, 10),
      queue.getDelayed(0, 10),
    ]);

    // Convert jobs to detailed format
    const formatJobs = (jobs: Job[]): JobDetails[] => {
      return jobs.map(job => ({
        id: job.id!,
        name: job.name,
        data: job.data,
        opts: job.opts,
        progress: job.progress,
        delay: job.delay,
        timestamp: job.timestamp,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        finishedOn: job.finishedOn,
        processedOn: job.processedOn,
        returnvalue: job.returnvalue,
      }));
    };

    return {
      name: queueName,
      stats,
      jobs: {
        waiting: formatJobs(waiting),
        active: formatJobs(active),
        completed: formatJobs(completed),
        failed: formatJobs(failed),
        delayed: formatJobs(delayed),
      },
    };
  }

  /**
   * Get detailed information about all queues
   */
  async inspectAllQueues(): Promise<QueueInspection[]> {
    const queueNames = Object.keys(queues) as (keyof typeof queues)[];
    const inspections = await Promise.all(
      queueNames.map(name => this.inspectQueue(name))
    );
    return inspections;
  }

  /**
   * Get detailed job information
   */
  async getJobDetails(queueName: keyof typeof queues, jobId: string): Promise<JobDetails | null> {
    const queue = queues[queueName];
    const job = await queue.getJob(jobId);
    
    if (!job) {
      return null;
    }

    return {
      id: job.id!,
      name: job.name,
      data: job.data,
      opts: job.opts,
      progress: job.progress,
      delay: job.delay,
      timestamp: job.timestamp,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      returnvalue: job.returnvalue,
    };
  }

  /**
   * Create test jobs for development
   */
  async createTestJobs(): Promise<{
    email: Job[];
    analytics: Job[];
    ai: Job[];
  }> {
    console.log('Creating test jobs for development...');

    // Create test email jobs
    const emailJobs = await Promise.all([
      queueManager.scheduleEmailJob('test-email-1', {
        campaignId: 'test-campaign-1',
        tenantId: 'test-tenant-1',
        recipients: [
          { email: 'test1@example.com', name: 'Test User 1' },
          { email: 'test2@example.com', name: 'Test User 2' },
        ],
        batchSize: 2,
      }),
      queueManager.scheduleEmailJob('test-email-delayed', {
        campaignId: 'test-campaign-2',
        tenantId: 'test-tenant-1',
        recipients: [
          { email: 'delayed@example.com', name: 'Delayed User' },
        ],
      }, { delay: 5000 }), // 5 second delay
    ]);

    // Create test analytics jobs
    const analyticsJobs = await Promise.all([
      queueManager.scheduleAnalyticsJob('test-analytics-1', {
        campaignId: 'test-campaign-1',
        tenantId: 'test-tenant-1',
        eventType: 'campaign-complete',
        data: { totalSent: 100, opened: 45 },
      }),
      queueManager.scheduleAnalyticsJob('test-daily-aggregation', {
        campaignId: '',
        tenantId: 'test-tenant-1',
        eventType: 'daily-aggregation',
      }),
    ]);

    // Create test AI jobs
    const aiJobs = await Promise.all([
      queueManager.scheduleAIJob('test-content-generation', {
        tenantId: 'test-tenant-1',
        type: 'content-generation',
        data: { prompt: 'Generate a newsletter about AI trends' },
      }),
      queueManager.scheduleAIJob('test-subject-optimization', {
        tenantId: 'test-tenant-1',
        type: 'subject-optimization',
        data: { content: 'Test newsletter content', currentSubject: 'Test Subject' },
      }),
    ]);

    console.log(`Created ${emailJobs.length} email jobs, ${analyticsJobs.length} analytics jobs, ${aiJobs.length} AI jobs`);

    return {
      email: emailJobs,
      analytics: analyticsJobs,
      ai: aiJobs,
    };
  }

  /**
   * Clear all jobs from all queues (development only)
   */
  async clearAllQueues(): Promise<void> {
    console.log('Clearing all queues...');
    
    const queueNames = Object.keys(queues) as (keyof typeof queues)[];
    
    for (const queueName of queueNames) {
      const queue = queues[queueName];
      await queue.obliterate({ force: true });
      console.log(`Cleared ${queueName} queue`);
    }
    
    console.log('All queues cleared');
  }

  /**
   * Simulate job failures for testing error handling
   */
  async simulateFailures(): Promise<void> {
    console.log('Simulating job failures for testing...');

    // Create jobs that will fail
    await Promise.all([
      queueManager.scheduleEmailJob('failing-email-job', {
        campaignId: 'invalid-campaign',
        tenantId: 'invalid-tenant',
        recipients: [{ email: 'invalid-email' }],
      }),
      queueManager.scheduleAnalyticsJob('failing-analytics-job', {
        campaignId: 'invalid-campaign',
        tenantId: 'invalid-tenant',
        eventType: 'campaign-complete',
        data: null as any,
      }),
      queueManager.scheduleAIJob('failing-ai-job', {
        tenantId: 'invalid-tenant',
        type: 'content-generation',
        data: { prompt: '' }, // Empty prompt should fail
      }),
    ]);

    console.log('Created failing jobs for testing error handling');
  }

  /**
   * Monitor queue events in real-time (for development)
   */
  startRealTimeMonitoring(): void {
    console.log('Starting real-time queue monitoring...');

    Object.entries(queueEvents).forEach(([queueName, events]) => {
      events.on('completed', ({ jobId }) => {
        console.log(`✅ [${queueName.toUpperCase()}] Job ${jobId} completed`);
      });

      events.on('failed', ({ jobId, failedReason }) => {
        console.log(`❌ [${queueName.toUpperCase()}] Job ${jobId} failed: ${failedReason}`);
      });

      events.on('active', ({ jobId }) => {
        console.log(`🔄 [${queueName.toUpperCase()}] Job ${jobId} started`);
      });

      events.on('stalled', ({ jobId }) => {
        console.log(`⚠️  [${queueName.toUpperCase()}] Job ${jobId} stalled`);
      });
    });

    console.log('Real-time monitoring started. Check console for job events.');
  }

  /**
   * Generate development dashboard data
   */
  async getDashboardData(): Promise<{
    queues: QueueInspection[];
    metrics: Record<string, any>;
    health: Record<string, any>;
    recentErrors: any[];
  }> {
    const [queues, metrics, health] = await Promise.all([
      this.inspectAllQueues(),
      queueManager.getAllQueueStats(),
      queueManager.healthCheck(),
    ]);

    const recentErrors = queueMonitor.getRecentErrors(10);

    return {
      queues,
      metrics,
      health,
      recentErrors,
    };
  }

  /**
   * Export queue data for analysis
   */
  async exportQueueData(queueName: keyof typeof queues): Promise<{
    metadata: {
      queueName: string;
      exportedAt: string;
      totalJobs: number;
    };
    jobs: JobDetails[];
  }> {
    const inspection = await this.inspectQueue(queueName);
    const allJobs = [
      ...inspection.jobs.waiting,
      ...inspection.jobs.active,
      ...inspection.jobs.completed,
      ...inspection.jobs.failed,
      ...inspection.jobs.delayed,
    ];

    return {
      metadata: {
        queueName,
        exportedAt: new Date().toISOString(),
        totalJobs: allJobs.length,
      },
      jobs: allJobs,
    };
  }

  /**
   * Performance test - create multiple jobs and measure processing
   */
  async performanceTest(jobCount: number = 100): Promise<{
    startTime: number;
    endTime: number;
    duration: number;
    jobsCreated: number;
    jobsPerSecond: number;
  }> {
    console.log(`Starting performance test with ${jobCount} jobs...`);
    
    const startTime = Date.now();
    
    // Create multiple test jobs
    const jobs = [];
    for (let i = 0; i < jobCount; i++) {
      jobs.push(
        queueManager.scheduleEmailJob(`perf-test-${i}`, {
          campaignId: `perf-campaign-${i}`,
          tenantId: 'perf-test-tenant',
          recipients: [{ email: `test${i}@example.com` }],
        })
      );
    }
    
    await Promise.all(jobs);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    const jobsPerSecond = (jobCount / duration) * 1000;
    
    console.log(`Performance test completed: ${jobCount} jobs created in ${duration}ms (${jobsPerSecond.toFixed(2)} jobs/sec)`);
    
    return {
      startTime,
      endTime,
      duration,
      jobsCreated: jobCount,
      jobsPerSecond,
    };
  }
}

// Export singleton instance
export const queueDevTools = new QueueDevTools();

// Development helper functions
export const devHelpers = {
  /**
   * Quick queue inspection
   */
  async inspect(queueName?: keyof typeof queues) {
    if (queueName) {
      return await queueDevTools.inspectQueue(queueName);
    }
    return await queueDevTools.inspectAllQueues();
  },

  /**
   * Quick test job creation
   */
  async test() {
    return await queueDevTools.createTestJobs();
  },

  /**
   * Quick queue clearing
   */
  async clear() {
    return await queueDevTools.clearAllQueues();
  },

  /**
   * Quick dashboard data
   */
  async dashboard() {
    return await queueDevTools.getDashboardData();
  },

  /**
   * Start monitoring
   */
  monitor() {
    queueDevTools.startRealTimeMonitoring();
  },
};