'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema/campaigns';
import { newsletters } from '@/lib/db/schema/newsletters';
import { subscribers } from '@/lib/db/schema/subscribers';
import { emailService, EmailBatch, EmailRecipient } from '@/lib/email';
import { eq, and } from 'drizzle-orm';
import { getTenantContext } from '@/lib/tenant/context';
import { emailQueueService } from '@/lib/queue/email-service';

export interface SendCampaignData {
  campaignId: string;
  scheduledAt?: Date;
}

export interface SendCampaignResult {
  success: boolean;
  message: string;
  jobId?: string;
}

/**
 * Send or schedule a campaign
 */
export async function sendCampaign(data: SendCampaignData): Promise<SendCampaignResult> {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, message: 'Tenant context not found' };
    }

    // Get campaign with newsletter
    const campaignData = await db
      .select({
        campaign: campaigns,
        newsletter: newsletters,
      })
      .from(campaigns)
      .innerJoin(newsletters, eq(campaigns.newsletterId, newsletters.id))
      .where(
        and(
          eq(campaigns.id, data.campaignId),
          eq(campaigns.tenantId, tenant.id)
        )
      )
      .limit(1);

    if (campaignData.length === 0) {
      return { success: false, message: 'Campaign not found' };
    }

    const { campaign, newsletter } = campaignData[0];

    // Validate campaign status
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      return { success: false, message: 'Campaign cannot be sent in current status' };
    }

    // If scheduling for future, update status and schedule
    if (data.scheduledAt && data.scheduledAt > new Date()) {
      await db
        .update(campaigns)
        .set({
          status: 'scheduled',
          scheduledAt: data.scheduledAt,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, data.campaignId));

      // Schedule the job
      const jobId = await emailQueueService.scheduleEmailCampaign(data.campaignId, data.scheduledAt);

      revalidatePath('/dashboard/campaigns');
      return { 
        success: true, 
        message: 'Campaign scheduled successfully',
        jobId,
      };
    }

    // Send immediately
    const jobId = await emailQueueService.sendEmailCampaign(data.campaignId);

    // Update campaign status
    await db
      .update(campaigns)
      .set({
        status: 'sending',
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, data.campaignId));

    revalidatePath('/dashboard/campaigns');
    return { 
      success: true, 
      message: 'Campaign is being sent',
      jobId,
    };
  } catch (error) {
    console.error('Failed to send campaign:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to send campaign' 
    };
  }
}

/**
 * Process campaign sending (called by queue worker)
 */
export async function processCampaignSending(campaignId: string): Promise<void> {
  try {
    // Import batch processor to avoid circular dependencies
    const { batchProcessor } = await import('@/lib/services/batch-processor');

    // Process campaign using batch processor with retry logic
    const result = await batchProcessor.processCampaignInBatches(campaignId, {
      batchSize: 100, // Process 100 emails per batch
      delayBetweenBatches: 1000, // 1 second delay between batches
      maxRetries: 3, // Retry failed batches up to 3 times
      retryDelay: 5000, // 5 second delay before retry
    });

    console.log(`Campaign ${campaignId} processing completed:`, {
      totalRecipients: result.totalRecipients,
      totalBatches: result.totalBatches,
      successfulBatches: result.successfulBatches,
      failedBatches: result.failedBatches,
      totalEmailsSent: result.totalEmailsSent,
      totalEmailsFailed: result.totalEmailsFailed,
      processingTimeMs: result.processingTimeMs,
    });

    // Log any failures
    if (result.failedBatches > 0) {
      console.warn(`Campaign ${campaignId} had ${result.failedBatches} failed batches out of ${result.totalBatches}`);
    }
  } catch (error) {
    console.error(`Failed to process campaign ${campaignId}:`, error);
    
    // Update campaign status to cancelled on error
    await db
      .update(campaigns)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));
    
    throw error;
  }
}

/**
 * Cancel a scheduled campaign
 */
export async function cancelCampaign(campaignId: string): Promise<SendCampaignResult> {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, message: 'Tenant context not found' };
    }

    // Get campaign
    const campaign = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.tenantId, tenant.id)
        )
      )
      .limit(1);

    if (campaign.length === 0) {
      return { success: false, message: 'Campaign not found' };
    }

    const currentCampaign = campaign[0];

    // Can only cancel scheduled campaigns
    if (currentCampaign.status !== 'scheduled') {
      return { success: false, message: 'Only scheduled campaigns can be cancelled' };
    }

    // Cancel the scheduled job
    await emailQueueService.cancelScheduledJob(campaignId);

    // Update campaign status
    await db
      .update(campaigns)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));

    revalidatePath('/dashboard/campaigns');
    return { success: true, message: 'Campaign cancelled successfully' };
  } catch (error) {
    console.error('Failed to cancel campaign:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to cancel campaign' 
    };
  }
}