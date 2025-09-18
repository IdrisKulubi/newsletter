'use server';

import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export async function signOutAction() {
  try {
    await auth.api.signOut({
      headers: await headers(),
    });

    redirect('/auth/signin');
  } catch (error) {
    return {
      error: 'Sign out failed',
    };
  }
}