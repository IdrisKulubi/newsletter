'use server';

import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';

const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export async function signUpAction(formData: FormData) {
  try {
    const rawData = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      name: formData.get('name') as string,
    };

    const validatedData = signUpSchema.parse(rawData);

    const result = await auth.api.signUpEmail({
      body: validatedData,
      headers: await headers(),
    });

    if (result.error) {
      console.error('Signup error:', result.error);
      return {
        error: result.error.message || 'Sign up failed',
      };
    }

    // Since email verification is disabled, redirect directly to dashboard
    redirect('/dashboard');
  } catch (error) {
    console.error('Signup action error:', error);
    
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