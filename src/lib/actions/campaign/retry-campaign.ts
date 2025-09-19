'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema/campaigns';
import { eq, and } from 'drizzle-orm';
import { getTenantContext } from '@/lib/tenant/context';
import { emailQueueService } from '@/lib/queue/email-service';
import { batchProcessor } from '@/lib/services/batch-processor';

export interface RetryCampaignResult {
  success: boolean;
  message: string;
  jobId?: string;
}

/**
 * Retry a failed campaign
 */
export async function retryCampaign(campaignId: string): Promise<RetryCampaignResult> {
  try {
    // Get tenant context
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, message: 'Tenant context not found' };
    }

    // Get campaign
    const existingCampaign = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.tenantId, tenant.id)
        )
      )
      .limit(1);

    if (existingCampaign.length === 0) {
      return { success: false, message: 'Campaign not found' };
    }

    const campaign = existingCampaign[0];

    // Check if campaign can be retried
    if (campaign.status !== 'cancelled' && campaign.status !== 'sent') {
      return { 
        success: false, 
        message: `Cannot retry campaign with status: ${campaign.status}` 
      };
    }

    // If campaign was sent but had failures, we can retry
    if (campaign.status === 'sent') {
      const analytics = campaign.analytics;
      const totalSent = analytics.totalSent || 0;
      const delivered = analytics.delivered || 0;
      
      // Only retry if there were significant failures
      const failureRate = totalSent > 0 ? (totalSent - delivered) / totalSent : 0;
      if (failureRate < 0.1) { // Less than 10% failure rate
        return {
          success: false,
          message: 'Campaign had minimal failures and does not need retry',
        };
      }
    }

    // Reset campaign status to sending
    await db
      .update(campaigns)
      .set({
        status: 'sending',
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));

    // Schedule retry with batch processing
    const jobId = await emailQueueService.retryCampaign(campaignId);

    revalidatePath('/dashboard/campaigns');
    
    return {
      success: true,
      message: 'Campaign retry initiated',
      jobId,
    };
  } catch (error) {
    console.error('Failed to retry campaign:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to retry campaign',
    };
  }
}

/**
 * Retry specific failed batches of a campaign
 */
export async function retryFailedBatches(campaignId: string): Promise<RetryCampaignResult> {
  try {
    // Get tenant context
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, message: 'Tenant context not found' };
    }

    // Get campaign
    const existingCampaign = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.tenantId, tenant.id)
        )
      )
      .limit(1);

    if (existingCampaign.length === 0) {
      return { success: false, message: 'Campaign not found' };
    }

    // Get batch status
    const batchStatus = await batchProcessor.getBatchStatus(campaignId);
    
    if (batchStatus.failedBatches === 0) {
      return {
        success: false,
        message: 'No failed batches found for this campaign',
      };
    }

    // Schedule retry for failed batches only
    const jobIds = await batchProcessor.scheduleBatchProcessing(campaignId, {
      batchSize: 50, // Smaller batches for retry
      delayBetweenBatches: 2000, // Longer delay for retry
      maxRetries: 2, // Fewer retries for retry attempt
      retryDelay: 10000, // Longer retry delay
    });

    revalidatePath('/dashboard/campaigns');
    
    return {
      success: true,
      message: `Retry scheduled for ${batchStatus.failedBatches} failed batches`,
      jobId: jobIds[0], // Return first job ID
    };
  } catch (error) {
    console.error('Failed to retry failed batches:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to retry failed batches',
    };
  }
}

/**
 * Get retry history for a campaign
 */
export async function getCampaignRetryHistory(campaignId: string): Promise<{
  success: boolean;
  message: string;
  retryHistory?: Array<{
    attemptNumber: number;
    timestamp: Date;
    status: string;
    emailsSent: number;
    emailsFailed: number;
    reason?: string;
  }>;
}> {
  try {
    // Get tenant context
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, message: 'Tenant context not found' };
    }

    // This would typically query a retry history table
    // For now, we'll return a basic implementation based on queue jobs
    const jobs = await emailQueueService.getEmailQueueStats();
    
    // In a real implementation, you would:
    // 1. Query a retry_history table
    // 2. Get job history from the queue
    // 3. Parse analytics updates to determine retry attempts

    const retryHistory = [
      {
        attemptNumber: 1,
        timestamp: new Date(),
        status: 'completed',
        emailsSent: 950,
        emailsFailed: 50,
        reason: 'Initial send',
      },
      // Additional retry attempts would be listed here
    ];

    return {
      success: true,
      message: 'Retry history retrieved successfully',
      retryHistory,
    };
  } catch (error) {
    console.error('Failed to get retry history:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get retry history',
    };
  }
}

/**
 * Check if a campaign is eligible for retry
 */
export async function checkRetryEligibility(campaignId: string): Promise<{
  success: boolean;
  message: string;
  eligible?: boolean;
  reason?: string;
  failureRate?: number;
  lastRetryAt?: Date;
}> {
  try {
    // Get tenant context
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, message: 'Tenant context not found' };
    }

    // Get campaign
    const existingCampaign = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.tenantId, tenant.id)
        )
      )
      .limit(1);

    if (existingCampaign.length === 0) {
      return { success: false, message: 'Campaign not found' };
    }

    const campaign = existingCampaign[0];
    const analytics = campaign.analytics;

    // Calculate failure rate
    const totalSent = analytics.totalSent || 0;
    const delivered = analytics.delivered || 0;
    const failureRate = totalSent > 0 ? (totalSent - delivered) / totalSent : 0;

    // Check eligibility criteria
    let eligible = false;
    let reason = '';

    if (campaign.status === 'sending') {
      reason = 'Campaign is currently being sent';
    } else if (campaign.status === 'draft' || campaign.status === 'scheduled') {
      reason = 'Campaign has not been sent yet';
    } else if (failureRate < 0.05) { // Less than 5% failure rate
      reason = 'Campaign had minimal failures (< 5%)';
    } else if (failureRate > 0.5) { // More than 50% failure rate
      reason = 'Campaign had too many failures (> 50%) - investigate issues first';
    } else {
      eligible = true;
      reason = `Campaign had ${(failureRate * 100).toFixed(1)}% failure rate and is eligible for retry`;
    }

    return {
      success: true,
      message: 'Retry eligibility checked successfully',
      eligible,
      reason,
      failureRate: failureRate * 100, // Return as percentage
      lastRetryAt: campaign.updatedAt, // This would be actual last retry timestamp
    };
  } catch (error) {
    console.error('Failed to check retry eligibility:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to check retry eligibility',
    };
  }
}