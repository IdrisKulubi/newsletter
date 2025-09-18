'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/lib/auth/config';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
  initialUser?: User | null;
}

export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser || null);
  const [isLoading, setIsLoading] = useState(!initialUser);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/auth/session');
      if (!response.ok) {
        if (response.status === 401) {
          setUser(null);
          return;
        }
        throw new Error('Failed to fetch user session');
      }
      
      const userData = await response.json();
      setUser(userData.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      const response = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Sign in failed');
      }

      await fetchUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
      throw err;
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      setError(null);
      const response = await fetch('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Sign up failed');
      }

      await fetchUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
      throw err;
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      await fetch('/api/auth/sign-out', { method: 'POST' });
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign out failed');
    }
  };

  const refetchUser = async () => {
    await fetchUser();
  };

  useEffect(() => {
    if (!initialUser) {
      fetchUser();
    }
  }, [initialUser]);

  const value: AuthContextType = {
    user,
    isLoading,
    error,
    signIn,
    signUp,
    signOut,
    refetchUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Role-based access control hook
export function useRole() {
  const { user } = useAuth();
  
  const hasRole = (role: 'admin' | 'editor' | 'viewer') => {
    if (!user) return false;
    
    const roleHierarchy = { admin: 3, editor: 2, viewer: 1 };
    const userRoleLevel = roleHierarchy[user.role as keyof typeof roleHierarchy] || 0;
    const requiredRoleLevel = roleHierarchy[role];
    
    return userRoleLevel >= requiredRoleLevel;
  };

  const isAdmin = () => hasRole('admin');
  const isEditor = () => hasRole('editor');
  const canEdit = () => hasRole('editor');
  const canView = () => hasRole('viewer');

  return {
    role: user?.role,
    hasRole,
    isAdmin,
    isEditor,
    canEdit,
    canView,
  };
}