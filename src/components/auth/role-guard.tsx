'use client';

import { useRole } from '@/contexts/auth-context';
import { ReactNode } from 'react';

interface RoleGuardProps {
  children: ReactNode;
  requiredRole: 'admin' | 'editor' | 'viewer';
  fallback?: ReactNode;
}

export function RoleGuard({ children, requiredRole, fallback }: RoleGuardProps) {
  const { hasRole } = useRole();

  if (!hasRole(requiredRole)) {
    return fallback || null;
  }

  return <>{children}</>;
}

interface AdminOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AdminOnly({ children, fallback }: AdminOnlyProps) {
  return (
    <RoleGuard requiredRole="admin" fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

interface EditorOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function EditorOnly({ children, fallback }: EditorOnlyProps) {
  return (
    <RoleGuard requiredRole="editor" fallback={fallback}>
      {children}
    </RoleGuard>
  );
}