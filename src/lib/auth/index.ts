// Temporary mock implementation for newsletter functionality
// This will be replaced with proper Better Auth implementation in task 3

export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  tenantId?: string;
}

export interface Session {
  user: User;
  expires: Date;
}

/**
 * Get the current authenticated user from the session
 * Mock implementation - returns a test user for development
 */
export async function getCurrentUser(): Promise<User | null> {
  // Mock user for development/testing
  return {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'admin',
    tenantId: 'tenant-123',
  };
}

/**
 * Get the current session
 * Mock implementation
 */
export async function getCurrentSession(): Promise<Session | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  return {
    user,
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  };
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user;
}