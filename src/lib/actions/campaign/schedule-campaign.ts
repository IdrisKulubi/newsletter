'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema/campaigns';
import { eq, and } from 'drizzle-orm';
import { getTenantContext } from '@/lib/tenant/context';
import { emailQueueService } from '@/lib/queue/email-service';
import { z } from 'zod';

export const scheduleCampaignSchema = z.object({
  campaignId: z.string().uuid(),
  scheduledAt: z.string().datetime(), // ISO string
  timezone: z.string().default('UTC'), // IANA timezone identifier
});

export type ScheduleCampaignData = z.infer<typeof scheduleCampaignSchema>;

export interface ScheduleCampaignResult {
  success: boolean;
  message: string;
  jobId?: string;
  scheduledAt?: Date;
}

/**
 * Schedule a campaign for future sending with timezone support
 */
export async function scheduleCampaign(data: ScheduleCampaignData): Promise<ScheduleCampaignResult> {
  try {
    // Validate input
    const validatedData = scheduleCampaignSchema.parse(data);

    // Get tenant context
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, message: 'Tenant context not found' };
    }

    // Parse and validate scheduled time
    const scheduledAt = new Date(validatedData.scheduledAt);
    const now = new Date();

    if (scheduledAt <= now) {
      return { success: false, message: 'Scheduled time must be in the future' };
    }

    // Validate timezone (basic check)
    try {
      Intl.DateTimeFormat(undefined, { timeZone: validatedData.timezone });
    } catch (error) {
      return { success: false, message: 'Invalid timezone provided' };
    }

    // Get campaign
    const existingCampaign = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, validatedData.campaignId),
          eq(campaigns.tenantId, tenant.id)
        )
      )
      .limit(1);

    if (existingCampaign.length === 0) {
      return { success: false, message: 'Campaign not found' };
    }

    const campaign = existingCampaign[0];

    // Check if campaign can be scheduled
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      return { 
        success: false, 
        message: `Cannot schedule campaign with status: ${campaign.status}` 
      };
    }

    // If already scheduled, cancel the existing job
    if (campaign.status === 'scheduled') {
      try {
        await emailQueueService.cancelScheduledJob(validatedData.campaignId);
      } catch (error) {
        console.warn('Failed to cancel existing scheduled job:', error);
      }
    }

    // Convert scheduled time to UTC for storage and queue
    const utcScheduledAt = new Date(scheduledAt.toISOString());

    // Schedule the job
    const jobId = await emailQueueService.scheduleEmailCampaign(
      validatedData.campaignId, 
      utcScheduledAt
    );

    // Update campaign status and scheduled time
    await db
      .update(campaigns)
      .set({
        status: 'scheduled',
        scheduledAt: utcScheduledAt,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, validatedData.campaignId));

    revalidatePath('/dashboard/campaigns');
    
    return {
      success: true,
      message: `Campaign scheduled for ${scheduledAt.toLocaleString('en-US', { 
        timeZone: validatedData.timezone,
        dateStyle: 'full',
        timeStyle: 'short'
      })}`,
      jobId,
      scheduledAt: utcScheduledAt,
    };
  } catch (error) {
    console.error('Failed to schedule campaign:', error);
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: `Validation error: ${error.errors.map(e => e.message).join(', ')}`,
      };
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to schedule campaign',
    };
  }
}

/**
 * Unschedule a campaign (change from scheduled back to draft)
 */
export async function unscheduleCampaign(campaignId: string): Promise<ScheduleCampaignResult> {
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

    // Check if campaign is scheduled
    if (campaign.status !== 'scheduled') {
      return { 
        success: false, 
        message: 'Campaign is not scheduled' 
      };
    }

    // Cancel the scheduled job
    await emailQueueService.cancelScheduledJob(campaignId);

    // Update campaign status
    await db
      .update(campaigns)
      .set({
        status: 'draft',
        scheduledAt: null,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));

    revalidatePath('/dashboard/campaigns');
    
    return {
      success: true,
      message: 'Campaign unscheduled successfully',
    };
  } catch (error) {
    console.error('Failed to unschedule campaign:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to unschedule campaign',
    };
  }
}

/**
 * Reschedule a campaign to a new time
 */
export async function rescheduleCampaign(data: ScheduleCampaignData): Promise<ScheduleCampaignResult> {
  try {
    // First unschedule the campaign
    const unscheduleResult = await unscheduleCampaign(data.campaignId);
    if (!unscheduleResult.success) {
      return unscheduleResult;
    }

    // Then schedule it again with the new time
    return await scheduleCampaign(data);
  } catch (error) {
    console.error('Failed to reschedule campaign:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to reschedule campaign',
    };
  }
}

/**
 * Get upcoming scheduled campaigns
 */
export async function getUpcomingCampaigns(limit: number = 10): Promise<{
  success: boolean;
  message: string;
  campaigns?: Array<{
    id: string;
    name: string;
    scheduledAt: Date;
    timeUntilSend: string;
  }>;
}> {
  try {
    // Get tenant context
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, message: 'Tenant context not found' };
    }

    // Get scheduled campaigns
    const scheduledCampaigns = await db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        scheduledAt: campaigns.scheduledAt,
      })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.tenantId, tenant.id),
          eq(campaigns.status, 'scheduled')
        )
      )
      .orderBy(campaigns.scheduledAt)
      .limit(limit);

    // Calculate time until send for each campaign
    const now = new Date();
    const campaignsWithTimeUntil = scheduledCampaigns
      .filter(campaign => campaign.scheduledAt && campaign.scheduledAt > now)
      .map(campaign => {
        const timeUntilMs = campaign.scheduledAt!.getTime() - now.getTime();
        const hours = Math.floor(timeUntilMs / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntilMs % (1000 * 60 * 60)) / (1000 * 60));
        
        let timeUntilSend: string;
        if (hours > 24) {
          const days = Math.floor(hours / 24);
          timeUntilSend = `${days} day${days !== 1 ? 's' : ''}`;
        } else if (hours > 0) {
          timeUntilSend = `${hours}h ${minutes}m`;
        } else {
          timeUntilSend = `${minutes}m`;
        }

        return {
          id: campaign.id,
          name: campaign.name,
          scheduledAt: campaign.scheduledAt!,
          timeUntilSend,
        };
      });

    return {
      success: true,
      message: 'Upcoming campaigns retrieved successfully',
      campaigns: campaignsWithTimeUntil,
    };
  } catch (error) {
    console.error('Failed to get upcoming campaigns:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get upcoming campaigns',
    };
  }
}