/**
 * Server Action for AI subject line optimization
 */

'use server';

import { z } from 'zod';
import { aiService } from '@/lib/ai';
import { getTenantFromHeaders } from '../../tenant/server';

const OptimizeSubjectLinesSchema = z.object({
  content: z.string().min(50, 'Content must be at least 50 characters'),
  company: z.string().optional(),
  audience: z.string().optional(),
  campaign_type: z.string().optional(),
});

export async function optimizeSubjectLinesAction(formData: FormData) {
  try {
    // Get tenant context
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return {
        success: false,
        error: 'Tenant not found'
      };
    }

    // Parse and validate form data
    const data = {
      content: formData.get('content') as string,
      company: formData.get('company') as string || undefined,
      audience: formData.get('audience') as string || undefined,
      campaign_type: formData.get('campaign_type') as string || undefined,
    };

    const validatedData = OptimizeSubjectLinesSchema.parse(data);

    // Generate subject line variations using AI service
    const variations = await aiService.optimizeSubjectLines(
      validatedData.content,
      {
        company: validatedData.company,
        audience: validatedData.audience,
        campaign_type: validatedData.campaign_type,
      },
      tenant.id
    );

    return {
      success: true,
      data: { variations }
    };
  } catch (error) {
    console.error('Optimize subject lines action error:', error);
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Invalid input data',
        details: error.issues
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to optimize subject lines'
    };
  }
}

// Alternative function-based approach for programmatic use
export async function optimizeSubjectLines(
  content: string,
  context?: {
    company?: string;
    audience?: string;
    campaign_type?: string;
  },
  tenantId?: string
) {
  return aiService.optimizeSubjectLines(content, context, tenantId);
}