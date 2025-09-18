'use server';

import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function signInAction(formData: FormData) {
  try {
    const rawData = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    };

    const validatedData = signInSchema.parse(rawData);

    const result = await auth.api.signInEmail({
      body: validatedData,
      headers: await headers(),
    });

    if (result.error) {
      return {
        error: result.error.message || 'Sign in failed',
      };
    }

    // Successful sign in - redirect to dashboard
    redirect('/dashboard');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        error: error.errors[0]?.message || 'Invalid input',
      };
    }

    return {
      error: 'An unexpected error occurred',
    };
  }
}

export async function signInWithGoogleAction() {
  try {
    const result = await auth.api.signInSocial({
      body: {
        provider: 'google',
        callbackURL: '/dashboard',
      },
      headers: await headers(),
    });

    if (result.data?.url) {
      redirect(result.data.url);
    }

    return {
      error: 'Failed to initiate Google sign in',
    };
  } catch (error) {
    return {
      error: 'An unexpected error occurred',
    };
  }
}

export async function signInWithMicrosoftAction() {
  try {
    const result = await auth.api.signInSocial({
      body: {
        provider: 'microsoft',
        callbackURL: '/dashboard',
      },
      headers: await headers(),
    });

    if (result.data?.url) {
      redirect(result.data.url);
    }

    return {
      error: 'Failed to initiate Microsoft sign in',
    };
  } catch (error) {
    return {
      error: 'An unexpected error occurred',
    };
  }
}