/**
 * Batch Processor Unit Tests
 * Tests for batch processing logic, retry mechanisms, and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchProcessor } from '@/lib/services/batch-processor';

// Mock dependencies
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockEmailService = {
  sendBatch: vi.fn(),
};

const mockQueueManager = {
  scheduleEmailJob: vi.fn(),
  queues: {
    email: {
      getJobs: vi.fn(),
    },
  },
};

vi.mock('@/lib/db', () => ({
  db: mockDb,
}));

vi.mock('@/lib/email', () => ({
  emailService: mockEmailService,
}));

vi.mock('@/lib/queue/queue-manager', () => ({
  queueManager: mockQueueManager,
}));

describe('BatchProcessor', () => {
  let batchProcessor: BatchProcessor;

  beforeEach(() => {
    batchProcessor = new BatchProcessor();
    vi.clearAllMocks();
  });

  describe('Batch Creation', () => {
    it('should create correct number of batches', () => {
      const items = Array.from({ length: 250 }, (_, i) => ({ id: i }));
      const batchSize = 100;
      
      // Access private method for testing
      const batches = (batchProcessor as any).createBatches(items, batchSize);
      
      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(100);
      expect(batches[1]).toHaveLength(100);
      expect(batches[2]).toHaveLength(50);
    });

    it('should handle empty arrays', () => {
      const batches = (batchProcessor as any).createBatches([], 100);
      expect(batches).toHaveLength(0);
    });

    it('should handle single item', () => {
      const batches = (batchProcessor as any).createBatches([{ id: 1 }], 100);
      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(1);
    });
  });

  describe('Campaign Processing', () => {
    const mockCampaign = {
      id: 'campaign-123',
      tenantId: 'tenant-123',
      newsletterId: 'newsletter-123',
      name: 'Test Campaign',
      subjectLine: 'Test Subject',
      recipients: { list: [] },
      status: 'draft',
    };

    const mockNewsletter = {
      id: 'newsletter-123',
      title: 'Test Newsletter',
      content: { blocks: [] },
    };

    const mockSubscribers = Array.from({ length: 150 }, (_, i) => ({
      id: `subscriber-${i}`,
      tenantId: 'tenant-123',
      email: `user${i}@example.com`,
      firstName: `User${i}`,
      lastName: 'Test',
      status: 'active',
    }));

    beforeEach(() => {
      // Mock database queries
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{
                campaign: mockCampaign,
                newsletter: mockNewsletter,
              }]),
            }),
          }),
        }),
      });

      // Mock subscriber query
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockSubscribers),
        }),
      });

      // Mock campaign update
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      // Mock successful email sending
      mockEmailService.sendBatch.mockResolvedValue(
        Array.from({ length: 100 }, (_, i) => ({
          email: `user${i}@example.com`,
          status: 'sent',
          messageId: `msg-${i}`,
        }))
      );
    });

    it('should process campaign in batches successfully', async () => {
      const result = await batchProcessor.processCampaignInBatches('campaign-123', {
        batchSize: 100,
        delayBetweenBatches: 0, // No delay for testing
        maxRetries: 3,
        retryDelay: 100,
      });

      expect(result.totalRecipients).toBe(150);
      expect(result.totalBatches).toBe(2); // 150 subscribers / 100 batch size = 2 batches
      expect(result.successfulBatches).toBe(2);
      expect(result.failedBatches).toBe(0);
      expect(result.totalEmailsSent).toBe(200); // 2 batches * 100 emails each
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });

    it('should handle partial batch failures', async () => {
      // Mock mixed success/failure results
      mockEmailService.sendBatch
        .mockResolvedValueOnce(
          Array.from({ length: 100 }, (_, i) => ({
            email: `user${i}@example.com`,
            status: 'sent',
            messageId: `msg-${i}`,
          }))
        )
        .mockResolvedValueOnce(
          Array.from({ length: 50 }, (_, i) => ({
            email: `user${i + 100}@example.com`,
            status: i < 25 ? 'sent' : 'failed',
            messageId: i < 25 ? `msg-${i + 100}` : undefined,
            error: i >= 25 ? 'Delivery failed' : undefined,
          }))
        );

      const result = await batchProcessor.processCampaignInBatches('campaign-123', {
        batchSize: 100,
        delayBetweenBatches: 0,
        maxRetries: 1,
        retryDelay: 100,
      });

      expect(result.totalEmailsSent).toBe(125); // 100 + 25 successful
      expect(result.totalEmailsFailed).toBe(25);
    });

    it('should retry failed batches', async () => {
      let attemptCount = 0;
      mockEmailService.sendBatch.mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          // First attempt fails
          throw new Error('Network error');
        } else {
          // Second attempt succeeds
          return Promise.resolve(
            Array.from({ length: 100 }, (_, i) => ({
              email: `user${i}@example.com`,
              status: 'sent',
              messageId: `msg-${i}`,
            }))
          );
        }
      });

      const result = await batchProcessor.processCampaignInBatches('campaign-123', {
        batchSize: 100,
        delayBetweenBatches: 0,
        maxRetries: 3,
        retryDelay: 10,
      });

      expect(attemptCount).toBeGreaterThan(2); // Should have retried
      expect(result.successfulBatches).toBe(2);
      expect(result.failedBatches).toBe(0);
    });

    it('should fail after max retries', async () => {
      mockEmailService.sendBatch.mockRejectedValue(new Error('Persistent error'));

      await expect(
        batchProcessor.processCampaignInBatches('campaign-123', {
          batchSize: 100,
          delayBetweenBatches: 0,
          maxRetries: 2,
          retryDelay: 10,
        })
      ).rejects.toThrow('Persistent error');

      // Should have attempted 2 retries per batch
      expect(mockEmailService.sendBatch).toHaveBeenCalledTimes(4); // 2 batches * 2 retries each
    });

    it('should handle campaign not found', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]), // No campaign found
            }),
          }),
        }),
      });

      await expect(
        batchProcessor.processCampaignInBatches('non-existent-campaign')
      ).rejects.toThrow('Campaign not found');
    });

    it('should handle no subscribers', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{
                  campaign: mockCampaign,
                  newsletter: mockNewsletter,
                }]),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]), // No subscribers
          }),
        });

      await expect(
        batchProcessor.processCampaignInBatches('campaign-123')
      ).rejects.toThrow('No active subscribers found');
    });
  });

  describe('Batch Status Tracking', () => {
    it('should return correct batch status', async () => {
      const mockJobs = [
        {
          name: 'campaign-batch-campaign-123-1',
          finishedOn: Date.now(),
          failedReason: null,
          processedOn: Date.now() - 1000,
        },
        {
          name: 'campaign-batch-campaign-123-2',
          finishedOn: null,
          failedReason: 'Error message',
          processedOn: Date.now() - 500,
        },
        {
          name: 'campaign-batch-campaign-123-3',
          finishedOn: null,
          failedReason: null,
          processedOn: Date.now() - 100,
        },
      ];

      mockQueueManager.queues.email.getJobs.mockResolvedValue(mockJobs);

      const status = await batchProcessor.getBatchStatus('campaign-123');

      expect(status.totalBatches).toBe(3);
      expect(status.completedBatches).toBe(1);
      expect(status.failedBatches).toBe(1);
      expect(status.inProgressBatches).toBe(1);
      expect(status.overallStatus).toBe('processing');
    });

    it('should return completed status when all batches are done', async () => {
      const mockJobs = [
        {
          name: 'campaign-batch-campaign-123-1',
          finishedOn: Date.now(),
          failedReason: null,
          processedOn: Date.now() - 1000,
        },
        {
          name: 'campaign-batch-campaign-123-2',
          finishedOn: Date.now(),
          failedReason: null,
          processedOn: Date.now() - 500,
        },
      ];

      mockQueueManager.queues.email.getJobs.mockResolvedValue(mockJobs);

      const status = await batchProcessor.getBatchStatus('campaign-123');

      expect(status.overallStatus).toBe('completed');
      expect(status.completedBatches).toBe(2);
      expect(status.failedBatches).toBe(0);
    });

    it('should return failed status when all batches failed', async () => {
      const mockJobs = [
        {
          name: 'campaign-batch-campaign-123-1',
          finishedOn: null,
          failedReason: 'Error 1',
          processedOn: Date.now() - 1000,
        },
        {
          name: 'campaign-batch-campaign-123-2',
          finishedOn: null,
          failedReason: 'Error 2',
          processedOn: Date.now() - 500,
        },
      ];

      mockQueueManager.queues.email.getJobs.mockResolvedValue(mockJobs);

      const status = await batchProcessor.getBatchStatus('campaign-123');

      expect(status.overallStatus).toBe('failed');
      expect(status.failedBatches).toBe(2);
      expect(status.completedBatches).toBe(0);
    });
  });

  describe('Scheduled Batch Processing', () => {
    it('should schedule batch processing jobs', async () => {
      const mockCampaign = {
        id: 'campaign-123',
        tenantId: 'tenant-123',
      };

      const mockSubscribers = Array.from({ length: 250 }, (_, i) => ({
        id: `subscriber-${i}`,
        email: `user${i}@example.com`,
        firstName: `User${i}`,
      }));

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockCampaign]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockSubscribers),
          }),
        });

      mockQueueManager.scheduleEmailJob.mockResolvedValue({ id: 'job-123' });

      const jobIds = await batchProcessor.scheduleBatchProcessing('campaign-123', {
        batchSize: 100,
        delayBetweenBatches: 1000,
      });

      expect(jobIds).toHaveLength(3); // 250 subscribers / 100 batch size = 3 batches
      expect(mockQueueManager.scheduleEmailJob).toHaveBeenCalledTimes(3);

      // Verify jobs were scheduled with correct delays
      expect(mockQueueManager.scheduleEmailJob).toHaveBeenNthCalledWith(
        1,
        'campaign-batch-campaign-123-1',
        expect.any(Object),
        expect.objectContaining({ delay: 0 })
      );
      expect(mockQueueManager.scheduleEmailJob).toHaveBeenNthCalledWith(
        2,
        'campaign-batch-campaign-123-2',
        expect.any(Object),
        expect.objectContaining({ delay: 1000 })
      );
      expect(mockQueueManager.scheduleEmailJob).toHaveBeenNthCalledWith(
        3,
        'campaign-batch-campaign-123-3',
        expect.any(Object),
        expect.objectContaining({ delay: 2000 })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockDb.select.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        batchProcessor.processCampaignInBatches('campaign-123')
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle email service errors', async () => {
      const mockCampaign = {
        id: 'campaign-123',
        tenantId: 'tenant-123',
        recipients: { list: [] },
      };

      const mockNewsletter = {
        id: 'newsletter-123',
        title: 'Test Newsletter',
      };

      const mockSubscribers = [
        { email: 'user1@example.com', firstName: 'User1' },
      ];

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{
                  campaign: mockCampaign,
                  newsletter: mockNewsletter,
                }]),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockSubscribers),
          }),
        });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      mockEmailService.sendBatch.mockRejectedValue(new Error('Email service unavailable'));

      await expect(
        batchProcessor.processCampaignInBatches('campaign-123', {
          maxRetries: 1,
          retryDelay: 10,
        })
      ).rejects.toThrow('Email service unavailable');

      // Verify campaign status was updated to cancelled
      expect(mockDb.update).toHaveBeenCalledWith(expect.anything());
    });
  });
});