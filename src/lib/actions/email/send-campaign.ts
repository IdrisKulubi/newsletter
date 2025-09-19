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
    // Get campaign with newsletter and tenant info
    const campaignData = await db
      .select({
        campaign: campaigns,
        newsletter: newsletters,
      })
      .from(campaigns)
      .innerJoin(newsletters, eq(campaigns.newsletterId, newsletters.id))
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (campaignData.length === 0) {
      throw new Error('Campaign not found');
    }

    const { campaign, newsletter } = campaignData[0];

    // Get subscribers for this tenant
    const recipientList = await db
      .select()
      .from(subscribers)
      .where(
        and(
          eq(subscribers.tenantId, campaign.tenantId),
          eq(subscribers.status, 'active')
        )
      );

    if (recipientList.length === 0) {
      throw new Error('No active subscribers found');
    }

    // Prepare email batch
    const recipients: EmailRecipient[] = recipientList.map(subscriber => ({
      email: subscriber.email,
      name: subscriber.firstName && subscriber.lastName 
        ? `${subscriber.firstName} ${subscriber.lastName}` 
        : subscriber.firstName || undefined,
      personalizations: {
        firstName: subscriber.firstName || '',
        lastName: subscriber.lastName || '',
        email: subscriber.email,
      },
    }));

    const emailBatch: EmailBatch = {
      recipients,
      newsletter,
      from: `newsletter@${campaign.tenantId}.com`, // Use tenant-based from address
      replyTo: `support@${campaign.tenantId}.com`, // Use tenant-based reply-to
      tags: [
        `tenant:${campaign.tenantId}`,
        `campaign:${campaign.id}`,
        `newsletter:${newsletter.id}`,
      ],
      headers: {
        'X-Tenant-ID': campaign.tenantId,
        'X-Campaign-ID': campaign.id,
        'X-Newsletter-ID': newsletter.id,
      },
    };

    // Send the batch
    const results = await emailService.sendBatch(emailBatch);

    // Calculate statistics
    const totalSent = results.length;
    const successful = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;

    // Update campaign with results
    const analytics = {
      totalSent,
      delivered: 0, // Will be updated by webhooks
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0,
      complained: 0,
      openRate: 0,
      clickRate: 0,
      bounceRate: 0,
      lastUpdated: new Date(),
    };

    await db
      .update(campaigns)
      .set({
        status: failed === 0 ? 'sent' : 'sent', // Use 'sent' status even if some failed
        sentAt: new Date(),
        analytics,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));

    console.log(`Campaign ${campaignId} sent: ${successful}/${totalSent} successful`);

    // Log failed sends
    if (failed > 0) {
      const failedResults = results.filter(r => r.status === 'failed');
      console.error(`Campaign ${campaignId} failures:`, failedResults);
    }
  } catch (error) {
    console.error(`Failed to process campaign ${campaignId}:`, error);
    
    // Update campaign status to cancelled (closest available status)
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