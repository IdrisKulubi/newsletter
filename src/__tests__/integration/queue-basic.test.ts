/**
 * Basic integration tests for queue operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { queueManager } from '@/lib/queue/queue-manager';
import { queueDevTools } from '@/lib/queue/dev-tools';
import { queues, redisConnection } from '@/lib/queue/index';

describe('Basic Queue System Tests', () => {
  beforeAll(async () => {
    // Wait a bit for Redis connection to establish
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Clean up after tests
    try {
      await queueDevTools.clearAllQueues();
      await redisConnection.quit();
    } catch (error) {
      console.log('Cleanup error (expected in test environment):', error);
    }
  });

  beforeEach(async () => {
    // Clear queues before each test
    try {
      await queueDevTools.clearAllQueues();
    } catch (error) {
      console.log('Clear error (expected in test environment):', error);
    }
  });

  describe('Queue Manager Basic Operations', () => {
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

    it('should perform health check', async () => {
      const health = await queueManager.healthCheck();
      
      expect(health.redis).toBe(true);
      expect(health.queues.email).toBe(true);
      expect(health.queues.analytics).toBe(true);
      expect(health.queues.ai).toBe(true);
      expect(health.overall).toBe(true);
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

    it('should have all queues available', async () => {
      expect(queues.email).toBeDefined();
      expect(queues.analytics).toBeDefined();
      expect(queues.ai).toBeDefined();
    });
  });
});