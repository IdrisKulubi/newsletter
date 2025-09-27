'use client';

// Client-side auth utilities that don't import server-side dependencies

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

export async function signOut() {
  try {
    const response = await fetch('/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
    });
    
    if (response.ok) {
      window.location.href = '/auth/signin';
    }
  } catch (error) {
    console.error('Failed to sign out:', error);
  }
}