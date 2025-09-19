import { User } from '@/lib/auth/config';
import { ExtendedUser, UserRole } from '@/types';

/**
 * Safely get user role from Better Auth user object
 */
export function getUserRole(user: User | null): UserRole {
  if (!user) return 'viewer';
  
  // Better Auth user might have role as additional field
  const role = (user as any).role;
  
  if (role && ['admin', 'editor', 'viewer'].includes(role)) {
    return role as UserRole;
  }
  
  return 'viewer'; // Default role
}

/**
 * Convert Better Auth user to extended user with proper typing
 */
export function toExtendedUser(user: User): ExtendedUser {
  const anyUser = user as any;
  
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    name: user.name,
    image: user.image,
    role: getUserRole(user),
    tenantId: anyUser.tenantId || null,
    isActive: anyUser.isActive ?? true,
    lastLoginAt: anyUser.lastLoginAt ? new Date(anyUser.lastLoginAt) : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Check if user has required role or higher
 */
export function hasRole(user: User | null, requiredRole: UserRole): boolean {
  if (!user) return false;
  
  const roleHierarchy = { admin: 3, editor: 2, viewer: 1 };
  const userRole = getUserRole(user);
  const userRoleLevel = roleHierarchy[userRole] || 0;
  const requiredRoleLevel = roleHierarchy[requiredRole];
  
  return userRoleLevel >= requiredRoleLevel;
}

/**
 * Check if user is admin
 */
export function isAdmin(user: User | null): boolean {
  return hasRole(user, 'admin');
}

/**
 * Check if user is editor or higher
 */
export function isEditor(user: User | null): boolean {
  return hasRole(user, 'editor');
}

/**
 * Check if user can view (any authenticated user)
 */
export function canView(user: User | null): boolean {
  return hasRole(user, 'viewer');
}