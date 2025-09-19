'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { campaigns, insertCampaignSchema } from '@/lib/db/schema/campaigns';
import { newsletters } from '@/lib/db/schema/newsletters';
import { eq, and } from 'drizzle-orm';
import { getTenantContext } from '@/lib/tenant/context';
import { getCurrentUser } from '@/lib/auth/session';
import { z } from 'zod';

export const createCampaignSchema = z.object({
  newsletterId: z.string().uuid(),
  name: z.string().min(1, 'Campaign name is required'),
  subjectLine: z.string().min(1, 'Subject line is required'),
  previewText: z.string().optional(),
  recipients: z.object({
    list: z.array(z.object({
      email: z.string().email(),
      name: z.string().optional(),
      metadata: z.record(z.string(), z.any()).optional(),
    })),
    segmentId: z.string().optional(),
  }),
});

export type CreateCampaignData = z.infer<typeof createCampaignSchema>;

export interface CreateCampaignResult {
  success: boolean;
  message: string;
  campaignId?: string;
}

/**
 * Create a new campaign
 */
export async function createCampaign(data: CreateCampaignData): Promise<CreateCampaignResult> {
  try {
    // Validate input
    const validatedData = createCampaignSchema.parse(data);

    // Get tenant context
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, message: 'Tenant context not found' };
    }

    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'User not authenticated' };
    }

    // Verify newsletter exists and belongs to tenant
    const newsletter = await db
      .select()
      .from(newsletters)
      .where(
        and(
          eq(newsletters.id, validatedData.newsletterId),
          eq(newsletters.tenantId, tenant.id)
        )
      )
      .limit(1);

    if (newsletter.length === 0) {
      return { success: false, message: 'Newsletter not found' };
    }

    // Verify newsletter is approved
    if (newsletter[0].status !== 'approved') {
      return { success: false, message: 'Newsletter must be approved before creating a campaign' };
    }

    // Create campaign
    const [newCampaign] = await db
      .insert(campaigns)
      .values({
        tenantId: tenant.id,
        newsletterId: validatedData.newsletterId,
        name: validatedData.name,
        subjectLine: validatedData.subjectLine,
        previewText: validatedData.previewText,
        recipients: validatedData.recipients,
        status: 'draft',
        createdBy: user.id,
      })
      .returning();

    revalidatePath('/dashboard/campaigns');
    
    return {
      success: true,
      message: 'Campaign created successfully',
      campaignId: newCampaign.id,
    };
  } catch (error) {
    console.error('Failed to create campaign:', error);
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: `Validation error: ${error.issues.map(e => e.message).join(', ')}`,
      };
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create campaign',
    };
  }
}