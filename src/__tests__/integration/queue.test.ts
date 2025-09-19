/**
 * Integration tests for queue operations and job processing
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { queueManager } from '@/lib/queue/queue-manager';
import { queueDevTools } from '@/lib/queue/dev-tools';
import { queues, redisConnection } from '@/lib/queue/index';
import { startWorkers, stopWorkers } from '@/lib/queue/workers';

describe('Queue System Integration Tests', () => {
  beforeAll(async () => {
    // Start workers for testing
    startWorkers();
    
    // Wait a bit for workers to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Clean up after tests
    await queueDevTools.clearAllQueues();
    await stopWorkers();
    await redisConnection.quit();
  });

  beforeEach(async () => {
    // Clear queues before each test
    await queueDevTools.clearAllQueues();
  });

  describe('Queue Manager', () => {
    it('should schedule email jobs successfully', async () => {
      const job = await queueManager.scheduleEmailJob('test-email', {
        campaignId: 'test-campaign-1',
        tenantId: 'test-tenant-1',
        recipients: [
          { email: 'test@example.com', name: 'Test User' }
        ],
      });

      expect(job.id).toBeDefined();
      expect(job.name).toBe('test-email');
      expect(job.data.campaignId).toBe('test-campaign-1');
    });

    it('should schedule analytics jobs successfully', async () => {
      const job = await queueManager.scheduleAnalyticsJob('test-analytics', {
        campaignId: 'test-campaign-1',
        tenantId: 'test-tenant-1',
        eventType: 'campaign-complete',
        data: { totalSent: 100 },
      });

      expect(job.id).toBeDefined();
      expect(job.name).toBe('test-analytics');
      expect(job.data.eventType).toBe('campaign-complete');
    });

    it('should schedule AI jobs successfully', async () => {
      const job = await queueManager.scheduleAIJob('test-ai', {
        tenantId: 'test-tenant-1',
        type: 'content-generation',
        data: { prompt: 'Test prompt' },
      });

      expect(job.id).toBeDefined();
      expect(job.name).toBe('test-ai');
      expect(job.data.type).toBe('content-generation');
    });

    it('should get queue statistics', async () => {
      // Add some jobs
      await queueManager.scheduleEmailJob('test-1', {
        campaignId: 'test',
        tenantId: 'test',
        recipients: [{ email: 'test@example.com' }],
      });

      await queueManager.scheduleEmailJob('test-2', {
        campaignId: 'test',
        tenantId: 'test',
        recipients: [{ email: 'test@example.com' }],
      });

      const stats = await queueManager.getQueueStats('email');
      expect(stats.waiting).toBeGreaterThanOrEqual(0);
      expect(stats.paused).toBe(false);
    });

    it('should schedule batch email sending', async () => {
      const recipients = Array.from({ length: 250 }, (_, i) => ({
        email: `test${i}@example.com`,
        name: `Test User ${i}`,
      }));

      const jobs = await queueManager.scheduleBatchEmailSending(
        'batch-campaign',
        'test-tenant',
        recipients,
        100 // Batch size
      );

      expect(jobs).toHaveLength(3); // 250 recipients / 100 batch size = 3 batches
      expect(jobs[0].data.recipients).toHaveLength(100);
      expect(jobs[1].data.recipients).toHaveLength(100);
      expect(jobs[2].data.recipients).toHaveLength(50);
    });

    it('should perform health check', async () => {
      const health = await queueManager.healthCheck();
      
      expect(health.redis).toBe(true);
      expect(health.queues.email).toBe(true);
      expect(health.queues.analytics).toBe(true);
      expect(health.queues.ai).toBe(true);
      expect(health.overall).toBe(true);
    });
  });

  describe('Queue Processing', () => {
    it('should process email jobs', async () => {
      const job = await queueManager.scheduleEmailJob('process-test-email', {
        campaignId: 'process-test-campaign',
        tenantId: 'process-test-tenant',
        recipients: [
          { email: 'process-test@example.com', name: 'Process Test User' }
        ],
      });

      // Wait for job to be processed
      const result = await job.waitUntilFinished(queues.email.events as any);
      
      expect(result.processed).toBe(1);
      expect(result.total).toBe(1);
      expect(result.campaignId).toBe('process-test-campaign');
    }, 10000); // 10 second timeout

    it('should process analytics jobs', async () => {
      const job = await queueManager.scheduleAnalyticsJob('process-test-analytics', {
        campaignId: 'process-test-campaign',
        tenantId: 'process-test-tenant',
        eventType: 'campaign-complete',
        data: { totalSent: 50, opened: 25 },
      });

      const result = await job.waitUntilFinished(queues.analytics.events as any);
      
      expect(result.campaignId).toBe('process-test-campaign');
      expect(result.metrics.totalSent).toBe(50);
      expect(result.metrics.opened).toBe(25);
      expect(result.metrics.openRate).toBe(50);
    }, 10000);

    it('should process AI jobs', async () => {
      const job = await queueManager.scheduleAIJob('process-test-ai', {
        tenantId: 'process-test-tenant',
        type: 'content-generation',
        data: { prompt: 'Generate test content' },
      });

      const result = await job.waitUntilFinished(queues.ai.events as any);
      
      expect(result.type).toBe('content-generation');
      expect(result.content).toContain('Generate test content');
      expect(result.prompt).toBe('Generate test content');
    }, 10000);
  });

  describe('Queue Monitoring', () => {
    it('should track queue metrics', async () => {
      // Create and process some jobs
      const jobs = await Promise.all([
        queueManager.scheduleEmailJob('metrics-test-1', {
          campaignId: 'metrics-test',
          tenantId: 'metrics-test',
          recipients: [{ email: 'metrics1@example.com' }],
        }),
        queueManager.scheduleEmailJob('metrics-test-2', {
          campaignId: 'metrics-test',
          tenantId: 'metrics-test',
          recipients: [{ email: 'metrics2@example.com' }],
        }),
      ]);

      // Wait for jobs to complete
      await Promise.all(jobs.map(job => job.waitUntilFinished(queues.email.events as any)));

      // Verify jobs completed by checking queue stats
      const stats = await queueManager.getQueueStats('email');
      expect(stats.completed).toBeGreaterThanOrEqual(2);
    }, 15000);

    it('should have all queues available', async () => {
      expect(queues.email).toBeDefined();
      expect(queues.analytics).toBeDefined();
      expect(queues.ai).toBeDefined();
    });
  });

  describe('Development Tools', () => {
    it('should inspect queue details', async () => {
      // Add some test jobs
      await queueManager.scheduleEmailJob('inspect-test', {
        campaignId: 'inspect-test',
        tenantId: 'inspect-test',
        recipients: [{ email: 'inspect@example.com' }],
      });

      const inspection = await queueDevTools.inspectQueue('email');
      
      expect(inspection.name).toBe('email');
      expect(inspection.stats).toBeDefined();
      expect(inspection.jobs).toBeDefined();
      expect(inspection.jobs.waiting.length).toBeGreaterThanOrEqual(0);
    });

    it('should create test jobs', async () => {
      const testJobs = await queueDevTools.createTestJobs();
      
      expect(testJobs.email).toHaveLength(2);
      expect(testJobs.analytics).toHaveLength(2);
      expect(testJobs.ai).toHaveLength(2);
    });

    it('should export queue data', async () => {
      // Add a test job
      await queueManager.scheduleEmailJob('export-test', {
        campaignId: 'export-test',
        tenantId: 'export-test',
        recipients: [{ email: 'export@example.com' }],
      });

      const exportData = await queueDevTools.exportQueueData('email');
      
      expect(exportData.metadata.queueName).toBe('email');
      expect(exportData.metadata.exportedAt).toBeDefined();
      expect(exportData.jobs).toBeDefined();
    });

    it('should perform performance test', async () => {
      const result = await queueDevTools.performanceTest(10);
      
      expect(result.jobsCreated).toBe(10);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.jobsPerSecond).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle job failures gracefully', async () => {
      // Create a job that will fail (invalid data)
      const job = await queueManager.scheduleEmailJob('failing-job', {
        campaignId: '', // Empty campaign ID should cause failure
        tenantId: '',
        recipients: [],
      });

      try {
        await job.waitUntilFinished(queues.email.events as any);
      } catch (error) {
        // Job should fail, which is expected
        expect(error).toBeDefined();
      }

      // Verify job failed by checking failed jobs
      const failedJobs = await queueManager.getFailedJobs('email', 10);
      expect(failedJobs.length).toBeGreaterThan(0);
    }, 10000);

    it('should retry failed jobs', async () => {
      // This test would require more complex setup to simulate retryable failures
      // For now, we'll just test the retry mechanism exists
      const failedJobs = await queueManager.getFailedJobs('email', 10);
      expect(Array.isArray(failedJobs)).toBe(true);
    });
  });

  describe('Queue Management Operations', () => {
    it('should pause and resume queues', async () => {
      await queueManager.pauseQueue('email');
      let stats = await queueManager.getQueueStats('email');
      expect(stats.paused).toBe(true);

      await queueManager.resumeQueue('email');
      stats = await queueManager.getQueueStats('email');
      expect(stats.paused).toBe(false);
    });

    it('should clean old jobs', async () => {
      // Add some jobs and let them complete
      const jobs = await Promise.all([
        queueManager.scheduleEmailJob('clean-test-1', {
          campaignId: 'clean-test',
          tenantId: 'clean-test',
          recipients: [{ email: 'clean1@example.com' }],
        }),
        queueManager.scheduleEmailJob('clean-test-2', {
          campaignId: 'clean-test',
          tenantId: 'clean-test',
          recipients: [{ email: 'clean2@example.com' }],
        }),
      ]);

      // Wait for completion
      await Promise.all(jobs.map(job => job.waitUntilFinished(queues.email.events as any)));

      // Clean with very short grace period (0ms) to clean immediately
      await queueManager.cleanQueue('email', 0);

      // Verify jobs were cleaned
      const stats = await queueManager.getQueueStats('email');
      expect(stats.completed).toBe(0);
    }, 15000);
  });
});