'use client';

import { createAuthClient } from 'better-auth/react';

// Create BetterAuth client
export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' 
    ? window.location.origin 
    : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;

// Legacy client-side auth utilities
export async function getClientSession() {
  try {
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'include',
    });
    
    if (response.ok) {
      return await response.json();
    }
    
    return null;
  } catch (error) {
    console.error('Failed to get client session:', error);
    return null;
  }
}
