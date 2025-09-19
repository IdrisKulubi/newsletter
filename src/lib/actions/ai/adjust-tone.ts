/**
 * Server Action for AI tone and style adjustment
 */

'use server';

import { z } from 'zod';
import { aiService } from '@/lib/ai';
import { getTenantFromHeaders } from '../../tenant/server';

const AdjustToneSchema = z.object({
  content: z.string().min(50, 'Content must be at least 50 characters'),
  target_tone: z.string().min(3, 'Target tone must be specified'),
  target_style: z.string().optional(),
});

export async function adjustToneAction(formData: FormData) {
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
      target_tone: formData.get('target_tone') as string,
      target_style: formData.get('target_style') as string || undefined,
    };

    const validatedData = AdjustToneSchema.parse(data);

    // Adjust tone and style using AI service
    const result = await aiService.adjustToneAndStyle(
      validatedData.content,
      validatedData.target_tone,
      validatedData.target_style,
      tenant.id
    );

    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('Adjust tone action error:', error);
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Invalid input data',
        details: error.issues
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to adjust tone and style'
    };
  }
}

// Alternative function-based approach for programmatic use
export async function adjustToneAndStyle(
  content: string,
  targetTone: string,
  targetStyle?: string,
  tenantId?: string
) {
  return aiService.adjustToneAndStyle(content, targetTone, targetStyle, tenantId);
}