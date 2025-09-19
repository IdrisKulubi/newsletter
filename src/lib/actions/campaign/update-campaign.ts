'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema/campaigns';
import { eq, and } from 'drizzle-orm';
import { getTenantContext } from '@/lib/tenant/context';
import { z } from 'zod';

export const updateCampaignSchema = z.object({
  campaignId: z.string().uuid(),
  name: z.string().min(1, 'Campaign name is required').optional(),
  subjectLine: z.string().min(1, 'Subject line is required').optional(),
  previewText: z.string().optional(),
  recipients: z.object({
    list: z.array(z.object({
      email: z.string().email(),
      name: z.string().optional(),
      metadata: z.record(z.string(), z.any()).optional(),
    })),
    segmentId: z.string().optional(),
  }).optional(),
  status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled']).optional(),
});

export type UpdateCampaignData = z.infer<typeof updateCampaignSchema>;

export interface UpdateCampaignResult {
  success: boolean;
  message: string;
}

/**
 * Update an existing campaign
 */
export async function updateCampaign(data: UpdateCampaignData): Promise<UpdateCampaignResult> {
  try {
    // Validate input
    const validatedData = updateCampaignSchema.parse(data);

    // Get tenant context
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, message: 'Tenant context not found' };
    }

    // Get current campaign
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

    // Check if campaign can be updated
    if (campaign.status === 'sent') {
      return { success: false, message: 'Cannot update a sent campaign' };
    }

    if (campaign.status === 'sending') {
      return { success: false, message: 'Cannot update a campaign that is currently being sent' };
    }

    // Prepare update data
    const updateData: Partial<typeof campaigns.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name;
    }

    if (validatedData.subjectLine !== undefined) {
      updateData.subjectLine = validatedData.subjectLine;
    }

    if (validatedData.previewText !== undefined) {
      updateData.previewText = validatedData.previewText;
    }

    if (validatedData.recipients !== undefined) {
      updateData.recipients = validatedData.recipients;
    }

    if (validatedData.status !== undefined) {
      // Validate status transitions
      const validTransitions: Record<string, string[]> = {
        'draft': ['scheduled', 'cancelled'],
        'scheduled': ['draft', 'cancelled'],
        'paused': ['sending', 'cancelled'],
        'cancelled': ['draft'], // Allow reactivating cancelled campaigns
      };

      const allowedStatuses = validTransitions[campaign.status] || [];
      
      if (!allowedStatuses.includes(validatedData.status)) {
        return {
          success: false,
          message: `Cannot change status from ${campaign.status} to ${validatedData.status}`,
        };
      }

      updateData.status = validatedData.status;

      // Clear scheduled time if changing from scheduled to draft
      if (campaign.status === 'scheduled' && validatedData.status === 'draft') {
        updateData.scheduledAt = null;
      }
    }

    // Update campaign
    await db
      .update(campaigns)
      .set(updateData)
      .where(eq(campaigns.id, validatedData.campaignId));

    revalidatePath('/dashboard/campaigns');
    
    return {
      success: true,
      message: 'Campaign updated successfully',
    };
  } catch (error) {
    console.error('Failed to update campaign:', error);
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: `Validation error: ${error.errors.map(e => e.message).join(', ')}`,
      };
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update campaign',
    };
  }
}