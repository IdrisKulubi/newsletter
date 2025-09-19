'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema/campaigns';
import { eq, and } from 'drizzle-orm';
import { getTenantContext } from '@/lib/tenant/context';
import { emailQueueService } from '@/lib/queue/email-service';

export interface DeleteCampaignResult {
  success: boolean;
  message: string;
}

/**
 * Delete a campaign
 */
export async function deleteCampaign(campaignId: string): Promise<DeleteCampaignResult> {
  try {
    // Get tenant context
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, message: 'Tenant context not found' };
    }

    // Get campaign to check status
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

    // Check if campaign can be deleted
    if (campaign.status === 'sending') {
      return { success: false, message: 'Cannot delete a campaign that is currently being sent' };
    }

    // If campaign is scheduled, cancel the scheduled job first
    if (campaign.status === 'scheduled') {
      try {
        await emailQueueService.cancelScheduledJob(campaignId);
      } catch (error) {
        console.warn('Failed to cancel scheduled job, proceeding with deletion:', error);
      }
    }

    // Delete campaign
    await db
      .delete(campaigns)
      .where(eq(campaigns.id, campaignId));

    revalidatePath('/dashboard/campaigns');
    
    return {
      success: true,
      message: 'Campaign deleted successfully',
    };
  } catch (error) {
    console.error('Failed to delete campaign:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete campaign',
    };
  }
}