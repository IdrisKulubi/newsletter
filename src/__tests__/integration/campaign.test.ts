/**
 * Campaign Management Integration Tests
 * Tests for campaign CRUD operations, scheduling, and batch processing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema/campaigns';
import { newsletters } from '@/lib/db/schema/newsletters';
import { subscribers } from '@/lib/db/schema/subscribers';
import { tenants } from '@/lib/db/schema/tenants';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

// Import campaign actions
import {
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaigns,
  getCampaignById,
  getCampaignStats,
  scheduleCampaign,
  unscheduleCampaign,
  sendCampaign,
  retryCampaign,
  checkRetryEligibility,
} from '@/lib/actions/campaign';

// Mock dependencies
vi.mock('@/lib/tenant/context', () => ({
  getTenantContext: vi.fn(() => Promise.resolve({
    id: 'test-tenant-id',
    name: 'Test Tenant',
    domain: 'test.example.com',
  })),
}));

vi.mock('@/lib/auth/session', () => ({
  getCurrentUser: vi.fn(() => Promise.resolve({
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
  })),
}));

vi.mock('@/lib/queue/email-service', () => ({
  emailQueueService: {
    sendEmailCampaign: vi.fn(() => Promise.resolve('job-123')),
    scheduleEmailCampaign: vi.fn(() => Promise.resolve('job-456')),
    cancelScheduledJob: vi.fn(() => Promise.resolve()),
    retryCampaign: vi.fn(() => Promise.resolve('job-789')),
    getEmailQueueStats: vi.fn(() => Promise.resolve({
      waiting: 0,
      active: 0,
      completed: 10,
      failed: 2,
    })),
  },
}));

vi.mock('@/lib/services/batch-processor', () => ({
  batchProcessor: {
    processCampaignInBatches: vi.fn(() => Promise.resolve({
      totalRecipients: 1000,
      totalBatches: 10,
      successfulBatches: 9,
      failedBatches: 1,
      totalEmailsSent: 950,
      totalEmailsFailed: 50,
      processingTimeMs: 30000,
    })),
    getBatchStatus: vi.fn(() => Promise.resolve({
      totalBatches: 10,
      completedBatches: 9,
      failedBatches: 1,
      inProgressBatches: 0,
      overallStatus: 'completed' as const,
    })),
    scheduleBatchProcessing: vi.fn(() => Promise.resolve(['job-1', 'job-2'])),
  },
}));

describe('Campaign Management', () => {
  let testTenantId: string;
  let testUserId: string;
  let testNewsletterId: string;
  let testCampaignId: string;

  beforeEach(async () => {
    // Create test tenant
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: 'Test Tenant',
        domain: 'test.example.com',
        settings: {},
      })
      .returning();
    testTenantId = tenant.id;

    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        tenantId: testTenantId,
      })
      .returning();
    testUserId = user.id;

    // Create test newsletter
    const [newsletter] = await db
      .insert(newsletters)
      .values({
        tenantId: testTenantId,
        title: 'Test Newsletter',
        content: { blocks: [] },
        status: 'approved',
        createdBy: testUserId,
      })
      .returning();
    testNewsletterId = newsletter.id;

    // Create test subscribers
    await db.insert(subscribers).values([
      {
        tenantId: testTenantId,
        email: 'subscriber1@example.com',
        firstName: 'John',
        lastName: 'Doe',
        status: 'active',
      },
      {
        tenantId: testTenantId,
        email: 'subscriber2@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        status: 'active',
      },
    ]);
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(campaigns).where(eq(campaigns.tenantId, testTenantId));
    await db.delete(subscribers).where(eq(subscribers.tenantId, testTenantId));
    await db.delete(newsletters).where(eq(newsletters.tenantId, testTenantId));
    await db.delete(users).where(eq(users.tenantId, testTenantId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));
  });

  describe('Campaign CRUD Operations', () => {
    it('should create a new campaign', async () => {
      const campaignData = {
        newsletterId: testNewsletterId,
        name: 'Test Campaign',
        subjectLine: 'Test Subject',
        previewText: 'Test preview',
        recipients: {
          list: [
            { email: 'subscriber1@example.com', name: 'John Doe' },
            { email: 'subscriber2@example.com', name: 'Jane Smith' },
          ],
        },
      };

      const result = await createCampaign(campaignData);

      expect(result.success).toBe(true);
      expect(result.campaignId).toBeDefined();
      expect(result.message).toBe('Campaign created successfully');

      // Verify campaign was created in database
      const createdCampaign = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, result.campaignId!))
        .limit(1);

      expect(createdCampaign).toHaveLength(1);
      expect(createdCampaign[0].name).toBe('Test Campaign');
      expect(createdCampaign[0].status).toBe('draft');

      testCampaignId = result.campaignId!;
    });

    it('should update an existing campaign', async () => {
      // First create a campaign
      const createResult = await createCampaign({
        newsletterId: testNewsletterId,
        name: 'Original Campaign',
        subjectLine: 'Original Subject',
        recipients: { list: [] },
      });

      const updateData = {
        campaignId: createResult.campaignId!,
        name: 'Updated Campaign',
        subjectLine: 'Updated Subject',
      };

      const result = await updateCampaign(updateData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Campaign updated successfully');

      // Verify campaign was updated
      const updatedCampaign = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, createResult.campaignId!))
        .limit(1);

      expect(updatedCampaign[0].name).toBe('Updated Campaign');
      expect(updatedCampaign[0].subjectLine).toBe('Updated Subject');
    });

    it('should get campaigns with pagination', async () => {
      // Create multiple campaigns
      for (let i = 1; i <= 5; i++) {
        await createCampaign({
          newsletterId: testNewsletterId,
          name: `Campaign ${i}`,
          subjectLine: `Subject ${i}`,
          recipients: { list: [] },
        });
      }

      const result = await getCampaigns({
        page: 1,
        limit: 3,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.success).toBe(true);
      expect(result.campaigns).toHaveLength(3);
      expect(result.pagination?.total).toBe(5);
      expect(result.pagination?.totalPages).toBe(2);
    });

    it('should get campaign statistics', async () => {
      // Create campaigns with different statuses
      const campaign1 = await createCampaign({
        newsletterId: testNewsletterId,
        name: 'Draft Campaign',
        subjectLine: 'Subject',
        recipients: { list: [] },
      });

      await updateCampaign({
        campaignId: campaign1.campaignId!,
        status: 'sent',
      });

      const result = await getCampaignStats();

      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats!.total).toBeGreaterThan(0);
    });

    it('should delete a campaign', async () => {
      // Create a campaign
      const createResult = await createCampaign({
        newsletterId: testNewsletterId,
        name: 'Campaign to Delete',
        subjectLine: 'Subject',
        recipients: { list: [] },
      });

      const result = await deleteCampaign(createResult.campaignId!);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Campaign deleted successfully');

      // Verify campaign was deleted
      const deletedCampaign = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, createResult.campaignId!))
        .limit(1);

      expect(deletedCampaign).toHaveLength(0);
    });
  });

  describe('Campaign Scheduling', () => {
    beforeEach(async () => {
      // Create a test campaign
      const createResult = await createCampaign({
        newsletterId: testNewsletterId,
        name: 'Schedulable Campaign',
        subjectLine: 'Subject',
        recipients: { list: [] },
      });
      testCampaignId = createResult.campaignId!;
    });

    it('should schedule a campaign for future sending', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      
      const result = await scheduleCampaign({
        campaignId: testCampaignId,
        scheduledAt: futureDate.toISOString(),
        timezone: 'America/New_York',
      });

      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();
      expect(result.scheduledAt).toBeDefined();

      // Verify campaign status was updated
      const campaign = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, testCampaignId))
        .limit(1);

      expect(campaign[0].status).toBe('scheduled');
      expect(campaign[0].scheduledAt).toBeDefined();
    });

    it('should unschedule a scheduled campaign', async () => {
      // First schedule the campaign
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await scheduleCampaign({
        campaignId: testCampaignId,
        scheduledAt: futureDate.toISOString(),
      });

      const result = await unscheduleCampaign(testCampaignId);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Campaign unscheduled successfully');

      // Verify campaign status was updated
      const campaign = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, testCampaignId))
        .limit(1);

      expect(campaign[0].status).toBe('draft');
      expect(campaign[0].scheduledAt).toBeNull();
    });

    it('should reject scheduling for past dates', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      const result = await scheduleCampaign({
        campaignId: testCampaignId,
        scheduledAt: pastDate.toISOString(),
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Scheduled time must be in the future');
    });
  });

  describe('Campaign Sending', () => {
    beforeEach(async () => {
      // Create a test campaign
      const createResult = await createCampaign({
        newsletterId: testNewsletterId,
        name: 'Sendable Campaign',
        subjectLine: 'Subject',
        recipients: { list: [
          { email: 'subscriber1@example.com' },
          { email: 'subscriber2@example.com' },
        ] },
      });
      testCampaignId = createResult.campaignId!;
    });

    it('should send a campaign immediately', async () => {
      const result = await sendCampaign({
        campaignId: testCampaignId,
      });

      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();
      expect(result.message).toBe('Campaign is being sent');

      // Verify campaign status was updated
      const campaign = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, testCampaignId))
        .limit(1);

      expect(campaign[0].status).toBe('sending');
    });

    it('should schedule a campaign for future sending', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      
      const result = await sendCampaign({
        campaignId: testCampaignId,
        scheduledAt: futureDate,
      });

      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();
      expect(result.message).toBe('Campaign scheduled successfully');

      // Verify campaign status was updated
      const campaign = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, testCampaignId))
        .limit(1);

      expect(campaign[0].status).toBe('scheduled');
    });
  });

  describe('Campaign Retry Logic', () => {
    beforeEach(async () => {
      // Create a test campaign with sent status and some failures
      const createResult = await createCampaign({
        newsletterId: testNewsletterId,
        name: 'Failed Campaign',
        subjectLine: 'Subject',
        recipients: { list: [] },
      });
      testCampaignId = createResult.campaignId!;

      // Update campaign to simulate a sent campaign with failures
      await db
        .update(campaigns)
        .set({
          status: 'sent',
          analytics: {
            totalSent: 1000,
            delivered: 800, // 20% failure rate
            opened: 400,
            clicked: 100,
            bounced: 150,
            unsubscribed: 10,
            complained: 5,
            openRate: 50,
            clickRate: 12.5,
            bounceRate: 15,
            lastUpdated: new Date(),
          },
        })
        .where(eq(campaigns.id, testCampaignId));
    });

    it('should check retry eligibility for a failed campaign', async () => {
      const result = await checkRetryEligibility(testCampaignId);

      expect(result.success).toBe(true);
      expect(result.eligible).toBe(true);
      expect(result.failureRate).toBe(20); // 20% failure rate
      expect(result.reason).toContain('eligible for retry');
    });

    it('should retry a failed campaign', async () => {
      const result = await retryCampaign(testCampaignId);

      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();
      expect(result.message).toBe('Campaign retry initiated');

      // Verify campaign status was updated
      const campaign = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, testCampaignId))
        .limit(1);

      expect(campaign[0].status).toBe('sending');
    });

    it('should reject retry for campaigns with low failure rates', async () => {
      // Update campaign to have low failure rate
      await db
        .update(campaigns)
        .set({
          analytics: {
            totalSent: 1000,
            delivered: 980, // 2% failure rate
            opened: 500,
            clicked: 150,
            bounced: 20,
            unsubscribed: 5,
            complained: 1,
            openRate: 51,
            clickRate: 15.3,
            bounceRate: 2,
            lastUpdated: new Date(),
          },
        })
        .where(eq(campaigns.id, testCampaignId));

      const eligibilityResult = await checkRetryEligibility(testCampaignId);
      expect(eligibilityResult.eligible).toBe(false);
      expect(eligibilityResult.reason).toContain('minimal failures');

      const retryResult = await retryCampaign(testCampaignId);
      expect(retryResult.success).toBe(false);
      expect(retryResult.message).toContain('minimal failures');
    });
  });

  describe('Batch Processing', () => {
    it('should handle large recipient lists with batching', async () => {
      // Create many subscribers
      const subscribers = Array.from({ length: 500 }, (_, i) => ({
        tenantId: testTenantId,
        email: `subscriber${i}@example.com`,
        firstName: `User${i}`,
        status: 'active' as const,
      }));

      await db.insert(subscribers).values(subscribers);

      // Create campaign
      const createResult = await createCampaign({
        newsletterId: testNewsletterId,
        name: 'Large Campaign',
        subjectLine: 'Subject',
        recipients: { list: subscribers.map(s => ({ email: s.email })) },
      });

      // Send campaign (this will use batch processing)
      const sendResult = await sendCampaign({
        campaignId: createResult.campaignId!,
      });

      expect(sendResult.success).toBe(true);
      expect(sendResult.jobId).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid campaign data', async () => {
      const result = await createCampaign({
        newsletterId: 'invalid-id',
        name: '',
        subjectLine: '',
        recipients: { list: [] },
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Validation error');
    });

    it('should handle non-existent campaigns', async () => {
      const result = await getCampaignById('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Campaign not found');
    });

    it('should prevent updating sent campaigns', async () => {
      // Create and mark campaign as sent
      const createResult = await createCampaign({
        newsletterId: testNewsletterId,
        name: 'Sent Campaign',
        subjectLine: 'Subject',
        recipients: { list: [] },
      });

      await db
        .update(campaigns)
        .set({ status: 'sent' })
        .where(eq(campaigns.id, createResult.campaignId!));

      const updateResult = await updateCampaign({
        campaignId: createResult.campaignId!,
        name: 'Updated Name',
      });

      expect(updateResult.success).toBe(false);
      expect(updateResult.message).toBe('Cannot update a sent campaign');
    });

    it('should prevent deleting campaigns that are being sent', async () => {
      // Create and mark campaign as sending
      const createResult = await createCampaign({
        newsletterId: testNewsletterId,
        name: 'Sending Campaign',
        subjectLine: 'Subject',
        recipients: { list: [] },
      });

      await db
        .update(campaigns)
        .set({ status: 'sending' })
        .where(eq(campaigns.id, createResult.campaignId!));

      const deleteResult = await deleteCampaign(createResult.campaignId!);

      expect(deleteResult.success).toBe(false);
      expect(deleteResult.message).toBe('Cannot delete a campaign that is currently being sent');
    });
  });
});