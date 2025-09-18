'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { NewsletterService } from '@/lib/services/newsletter';
import { updateNewsletterSchema } from '@/lib/db/schema/newsletters';
import { getCurrentUser } from '@/lib/auth';

export async function updateNewsletter(id: string, formData: FormData) {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Authentication required');
    }

    // Parse form data
    const rawData: Record<string, any> = {};
    
    if (formData.get('title')) {
      rawData.title = formData.get('title');
    }
    
    if (formData.get('content')) {
      rawData.content = JSON.parse(formData.get('content') as string);
    }
    
    if (formData.get('template')) {
      rawData.template = JSON.parse(formData.get('template') as string);
    }
    
    if (formData.get('metadata')) {
      rawData.metadata = JSON.parse(formData.get('metadata') as string);
    }
    
    if (formData.get('status')) {
      rawData.status = formData.get('status');
    }

    // Validate data
    const validatedData = updateNewsletterSchema.parse(rawData);

    // Update newsletter
    const newsletter = await NewsletterService.update(id, validatedData);

    // Revalidate paths
    revalidatePath('/dashboard/newsletters');
    revalidatePath(`/dashboard/newsletters/${id}`);
    revalidatePath(`/dashboard/newsletters/${id}/edit`);

    return { success: true, newsletter };
  } catch (error) {
    console.error('Failed to update newsletter:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update newsletter' 
    };
  }
}

export async function updateNewsletterContent(id: string, content: any) {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Authentication required');
    }

    // Update newsletter content
    const newsletter = await NewsletterService.update(id, { content });

    // Revalidate paths
    revalidatePath(`/dashboard/newsletters/${id}/edit`);

    return { success: true, newsletter };
  } catch (error) {
    console.error('Failed to update newsletter content:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update newsletter content' 
    };
  }
}

export async function updateNewsletterStatus(id: string, status: 'draft' | 'review' | 'approved') {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Authentication required');
    }

    // Update newsletter status
    const newsletter = await NewsletterService.updateStatus(id, status);

    // Revalidate paths
    revalidatePath('/dashboard/newsletters');
    revalidatePath(`/dashboard/newsletters/${id}`);

    return { success: true, newsletter };
  } catch (error) {
    console.error('Failed to update newsletter status:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update newsletter status' 
    };
  }
}