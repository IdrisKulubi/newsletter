/**
 * Server Action for AI content generation
 */

'use server';

import { z } from 'zod';
import { aiService } from '@/lib/ai';
import { getTenantFromHeaders } from '../../tenant/server';

const GenerateContentSchema = z.object({
  prompt: z.string().min(10, 'Prompt must be at least 10 characters'),
  company: z.string().optional(),
  audience: z.string().optional(),
  tone: z.string().optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
});

export async function generateContentAction(formData: FormData) {
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
      prompt: formData.get('prompt') as string,
      company: formData.get('company') as string || undefined,
      audience: formData.get('audience') as string || undefined,
      tone: formData.get('tone') as string || undefined,
      length: formData.get('length') as 'short' | 'medium' | 'long' || undefined,
    };

    const validatedData = GenerateContentSchema.parse(data);

    // Generate content using AI service
    const result = await aiService.generateContent(
      validatedData.prompt,
      {
        company: validatedData.company,
        audience: validatedData.audience,
        tone: validatedData.tone,
        length: validatedData.length,
      },
      tenant.id
    );

    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('Generate content action error:', error);
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Invalid input data',
        details: error.issues
      } as const;
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate content'
    };
  }
}

// Alternative function-based approach for programmatic use
export async function generateContent(
  prompt: string,
  context?: {
    company?: string;
    audience?: string;
    tone?: string;
    length?: 'short' | 'medium' | 'long';
  },
  tenantId?: string
) {
  return aiService.generateContent(prompt, context, tenantId);
}