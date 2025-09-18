'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { NewsletterService } from '@/lib/services/newsletter';
import { insertNewsletterSchema } from '@/lib/db/schema/newsletters';
import { getCurrentUser } from '@/lib/auth';

const createNewsletterSchema = insertNewsletterSchema.omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
});

export async function createNewsletter(formData: FormData) {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Authentication required');
    }

    // Parse form data
    const rawData = {
      title: formData.get('title'),
      content: formData.get('content') ? JSON.parse(formData.get('content') as string) : { blocks: [] },
      template: formData.get('template') ? JSON.parse(formData.get('template') as string) : null,
      metadata: formData.get('metadata') ? JSON.parse(formData.get('metadata') as string) : {},
      status: formData.get('status') || 'draft',
      createdBy: user.id,
    };

    // Validate data
    const validatedData = createNewsletterSchema.parse(rawData);

    // Create newsletter
    const newsletter = await NewsletterService.create(validatedData);

    // Revalidate and redirect
    revalidatePath('/dashboard/newsletters');
    redirect(`/dashboard/newsletters/${newsletter.id}/edit`);
  } catch (error) {
    console.error('Failed to create newsletter:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to create newsletter');
  }
}

export async function createNewsletterFromTemplate(templateId: string, title: string) {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Authentication required');
    }

    // Create newsletter with template
    const newsletter = await NewsletterService.create({
      title,
      content: { blocks: [] },
      template: {
        id: templateId,
        name: 'Default Template',
        config: {
          layout: 'single-column',
          headerStyle: 'minimal',
          footerStyle: 'minimal',
          colorScheme: 'light',
        },
      },
      metadata: {},
      status: 'draft',
      createdBy: user.id,
    });

    // Revalidate and redirect
    revalidatePath('/dashboard/newsletters');
    redirect(`/dashboard/newsletters/${newsletter.id}/edit`);
  } catch (error) {
    console.error('Failed to create newsletter from template:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to create newsletter');
  }
}