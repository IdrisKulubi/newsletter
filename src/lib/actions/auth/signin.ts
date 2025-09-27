'use server';

import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
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
      console.error('Signin error:', result.error);
      return {
        error: result.error.message || 'Invalid email or password',
      };
    }

    // Successful sign in - redirect to dashboard
    redirect('/dashboard');
  } catch (error) {
    console.error('Signin action error:', error);
    
    if (error instanceof z.ZodError) {
      return {
        error: error.errors[0]?.message || 'Invalid input',
      };
    }

    // Handle redirect errors (these are expected)
    if (error && typeof error === 'object' && 'digest' in error) {
      throw error;
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

    console.error('Google signin failed:', result.error);
    return {
      error: 'Failed to initiate Google sign in',
    };
  } catch (error) {
    console.error('Google signin action error:', error);
    
    // Handle redirect errors (these are expected)
    if (error && typeof error === 'object' && 'digest' in error) {
      throw error;
    }
    
    return {
      error: 'An unexpected error occurred',
    };
  }
}
