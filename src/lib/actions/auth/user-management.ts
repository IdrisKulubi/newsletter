'use server';

import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { headers } from 'next/headers';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const updateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'editor', 'viewer']),
});

const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.enum(['admin', 'editor', 'viewer']),
});

export async function updateUserRole(formData: FormData) {
  try {
    // Get current session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { error: 'Unauthorized' };
    }

    // Check if current user is admin
    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser[0] || currentUser[0].role !== 'admin') {
      return { error: 'Insufficient permissions' };
    }

    const rawData = {
      userId: formData.get('userId') as string,
      role: formData.get('role') as string,
    };

    const validatedData = updateUserRoleSchema.parse(rawData);

    // Ensure user belongs to same tenant
    const targetUser = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, validatedData.userId),
          eq(users.tenantId, currentUser[0].tenantId!)
        )
      )
      .limit(1);

    if (!targetUser[0]) {
      return { error: 'User not found' };
    }

    // Update user role
    await db
      .update(users)
      .set({
        role: validatedData.role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, validatedData.userId));

    revalidatePath('/dashboard/users');
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.errors[0]?.message || 'Invalid input' };
    }

    return { error: 'Failed to update user role' };
  }
}

export async function inviteUser(formData: FormData) {
  try {
    // Get current session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { error: 'Unauthorized' };
    }

    // Check if current user is admin
    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser[0] || currentUser[0].role !== 'admin') {
      return { error: 'Insufficient permissions' };
    }

    const rawData = {
      email: formData.get('email') as string,
      name: formData.get('name') as string,
      role: formData.get('role') as string,
    };

    const validatedData = inviteUserSchema.parse(rawData);

    // Check if user already exists in this tenant
    const existingUser = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, validatedData.email),
          eq(users.tenantId, currentUser[0].tenantId!)
        )
      )
      .limit(1);

    if (existingUser[0]) {
      return { error: 'User already exists in this workspace' };
    }

    // Create new user (they'll need to set password via email verification)
    await db.insert(users).values({
      email: validatedData.email,
      name: validatedData.name,
      role: validatedData.role,
      tenantId: currentUser[0].tenantId!,
      emailVerified: false,
      isActive: true,
    });

    // TODO: Send invitation email
    // This would typically involve sending an email with a link to set password

    revalidatePath('/dashboard/users');
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.errors[0]?.message || 'Invalid input' };
    }

    return { error: 'Failed to invite user' };
  }
}

export async function deactivateUser(formData: FormData) {
  try {
    // Get current session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { error: 'Unauthorized' };
    }

    // Check if current user is admin
    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser[0] || currentUser[0].role !== 'admin') {
      return { error: 'Insufficient permissions' };
    }

    const userId = formData.get('userId') as string;

    if (!userId) {
      return { error: 'User ID is required' };
    }

    // Prevent admin from deactivating themselves
    if (userId === session.user.id) {
      return { error: 'Cannot deactivate your own account' };
    }

    // Ensure user belongs to same tenant
    const targetUser = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.tenantId, currentUser[0].tenantId!)
        )
      )
      .limit(1);

    if (!targetUser[0]) {
      return { error: 'User not found' };
    }

    // Deactivate user
    await db
      .update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    revalidatePath('/dashboard/users');
    return { success: true };
  } catch (error) {
    return { error: 'Failed to deactivate user' };
  }
}