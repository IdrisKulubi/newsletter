/**
 * Server Actions for AI Insights
 * Handles AI-powered post-campaign analysis and insights generation
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { aiInsightsService, CampaignInsights } from '@/lib/services/ai-insights';
import { getTenantContext } from '@/lib/auth/tenant-context';
import { getCurrentUser } from '@/lib/auth';

// Validation schemas
const generateInsightsSchema = z.object({
  campaignId: z.string().uuid('Invalid campaign ID'),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
});

const getCampaignInsightsSchema = z.object({
  campaignId: z.string().uuid('Invalid campaign ID'),
});

/**
 * Generate AI insights for a completed campaign
 */
export async function generateCampaignInsights(
  formData: FormData
): Promise<{ success: boolean; error?: string; insights?: CampaignInsights }> {
  try {
    // Validate user authentication
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Get tenant context
    const tenantContext = await getTenantContext();
    if (!tenantContext) {
      return { success: false, error: 'Tenant context required' };
    }

    // Validate form data
    const rawData = {
      campaignId: formData.get('campaignId'),
      priority: formData.get('priority') || 'normal',
    };

    const validatedData = generateInsightsSchema.parse(rawData);

    // Check user permissions (admin or editor can generate insights)
    if (user.role === 'viewer') {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Generate insights
    const insights = await aiInsightsService.generateCampaignInsights(
      validatedData.campaignId,
      tenantContext.id
    );

    // Revalidate the campaign page to show new insights
    revalidatePath(`/dashboard/campaigns/${validatedData.campaignId}`);
    revalidatePath('/dashboard/campaigns');

    return { success: true, insights };
  } catch (error) {
    console.error('Generate campaign insights error:', error);
    
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: `Validation error: ${error.issues.map(e => e.message).join(', ')}` 
      };
    }

    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to generate insights' 
    };
  }
}

/**
 * Queue AI insights generation as a background job
 */
export async function queueInsightsGeneration(
  formData: FormData
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    // Validate user authentication
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Get tenant context
    const tenantContext = await getTenantContext();
    if (!tenantContext) {
      return { success: false, error: 'Tenant context required' };
    }

    // Validate form data
    const rawData = {
      campaignId: formData.get('campaignId'),
      priority: formData.get('priority') || 'normal',
    };

    const validatedData = generateInsightsSchema.parse(rawData);

    // Check user permissions
    if (user.role === 'viewer') {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Queue insights generation
    await aiInsightsService.queueInsightsGeneration(
      validatedData.campaignId,
      tenantContext.id,
      validatedData.priority as 'high' | 'normal' | 'low'
    );

    return { 
      success: true, 
      message: 'AI insights generation queued successfully. You will be notified when complete.' 
    };
  } catch (error) {
    console.error('Queue insights generation error:', error);
    
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: `Validation error: ${error.issues.map(e => e.message).join(', ')}` 
      };
    }

    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to queue insights generation' 
    };
  }
}

/**
 * Get AI insights for a campaign
 */
export async function getCampaignInsights(
  campaignId: string
): Promise<{ success: boolean; error?: string; insights?: CampaignInsights | null }> {
  try {
    // Validate user authentication
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Get tenant context
    const tenantContext = await getTenantContext();
    if (!tenantContext) {
      return { success: false, error: 'Tenant context required' };
    }

    // Validate campaign ID
    const validatedData = getCampaignInsightsSchema.parse({ campaignId });

    // Get insights
    const insights = await aiInsightsService.getCampaignInsights(
      validatedData.campaignId,
      tenantContext.id
    );

    return { success: true, insights };
  } catch (error) {
    console.error('Get campaign insights error:', error);
    
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: `Validation error: ${error.issues.map(e => e.message).join(', ')}` 
      };
    }

    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get insights' 
    };
  }
}

/**
 * Regenerate insights for a campaign (force refresh)
 */
export async function regenerateCampaignInsights(
  formData: FormData
): Promise<{ success: boolean; error?: string; insights?: CampaignInsights }> {
  try {
    // Validate user authentication
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Get tenant context
    const tenantContext = await getTenantContext();
    if (!tenantContext) {
      return { success: false, error: 'Tenant context required' };
    }

    // Validate form data
    const rawData = {
      campaignId: formData.get('campaignId'),
    };

    const validatedData = getCampaignInsightsSchema.parse(rawData);

    // Check user permissions (only admin and editor can regenerate)
    if (user.role === 'viewer') {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Force regenerate insights
    const insights = await aiInsightsService.generateCampaignInsights(
      validatedData.campaignId,
      tenantContext.id
    );

    // Revalidate the campaign page
    revalidatePath(`/dashboard/campaigns/${validatedData.campaignId}`);
    revalidatePath('/dashboard/campaigns');

    return { success: true, insights };
  } catch (error) {
    console.error('Regenerate campaign insights error:', error);
    
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: `Validation error: ${error.issues.map(e => e.message).join(', ')}` 
      };
    }

    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to regenerate insights' 
    };
  }
}

/**
 * Get insights dashboard data for multiple campaigns
 */
export async function getInsightsDashboard(): Promise<{
  success: boolean;
  error?: string;
  data?: {
    totalCampaignsWithInsights: number;
    averageEngagementScore: number;
    topPerformingCampaigns: Array<{
      id: string;
      name: string;
      engagementScore: number;
      overallPerformance: string;
    }>;
    recentInsights: Array<{
      campaignId: string;
      campaignName: string;
      generatedAt: Date;
      overallPerformance: string;
    }>;
  };
}> {
  try {
    // Validate user authentication
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Get tenant context
    const tenantContext = await getTenantContext();
    if (!tenantContext) {
      return { success: false, error: 'Tenant context required' };
    }

    // This would typically query the database for insights data
    // For now, return a placeholder structure
    const data = {
      totalCampaignsWithInsights: 0,
      averageEngagementScore: 0,
      topPerformingCampaigns: [],
      recentInsights: [],
    };

    return { success: true, data };
  } catch (error) {
    console.error('Get insights dashboard error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get insights dashboard' 
    };
  }
}