import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

// Mock the auth module
const mockGetSession = vi.fn();
vi.mock('@/lib/auth/config', () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

// Mock the database
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
};

vi.mock('@/lib/db', () => ({
  db: mockDb,
}));

vi.mock('@/lib/db/schema', () => ({
  tenants: {
    id: 'id',
    domain: 'domain',
    customDomain: 'customDomain',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  or: vi.fn(),
}));

describe('Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Static file handling', () => {
    it('should skip middleware for Next.js static files', async () => {
      const request = new NextRequest('http://localhost:3000/_next/static/test.js');
      const response = await middleware(request);
      
      expect(response.status).toBe(200);
    });

    it('should skip middleware for API auth routes', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/signin');
      const response = await middleware(request);
      
      expect(response.status).toBe(200);
    });

    it('should skip middleware for static assets', async () => {
      const request = new NextRequest('http://localhost:3000/favicon.ico');
      const response = await middleware(request);
      
      expect(response.status).toBe(200);
    });
  });

  describe('Tenant resolution', () => {
    it('should handle localhost development', async () => {
      mockGetSession.mockResolvedValue({ user: { id: '1', role: 'admin' } });
      
      const request = new NextRequest('http://localhost:3000/dashboard');
      const response = await middleware(request);
      
      expect(response.headers.get('x-tenant-id')).toBeNull();
    });

    it('should resolve tenant from subdomain', async () => {
      mockGetSession.mockResolvedValue({ user: { id: '1', role: 'admin' } });
      mockDb.limit.mockResolvedValue([{ id: 'tenant-123' }]);
      
      const request = new NextRequest('http://test-company.newsletter.com/dashboard');
      const response = await middleware(request);
      
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should redirect invalid subdomains', async () => {
      mockDb.limit.mockResolvedValue([]);
      
      const request = new NextRequest('http://invalid.newsletter.com/dashboard');
      const response = await middleware(request);
      
      expect(response.status).toBe(307); // Redirect
    });
  });

  describe('Authentication protection', () => {
    it('should redirect unauthenticated users to signin', async () => {
      mockGetSession.mockResolvedValue(null);
      
      const request = new NextRequest('http://localhost:3000/dashboard');
      const response = await middleware(request);
      
      expect(response.status).toBe(307); // Redirect
      expect(response.headers.get('location')).toContain('/auth/signin');
    });

    it('should allow authenticated users to protected routes', async () => {
      mockGetSession.mockResolvedValue({ user: { id: '1', role: 'admin' } });
      
      const request = new NextRequest('http://localhost:3000/dashboard');
      const response = await middleware(request);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('x-user-id')).toBe('1');
      expect(response.headers.get('x-user-role')).toBe('admin');
    });

    it('should redirect authenticated users away from auth pages', async () => {
      mockGetSession.mockResolvedValue({ user: { id: '1', role: 'admin' } });
      
      const request = new NextRequest('http://localhost:3000/auth/signin');
      const response = await middleware(request);
      
      expect(response.status).toBe(307); // Redirect
      expect(response.headers.get('location')).toContain('/dashboard');
    });

    it('should allow unauthenticated users to auth pages', async () => {
      mockGetSession.mockResolvedValue(null);
      
      const request = new NextRequest('http://localhost:3000/auth/signin');
      const response = await middleware(request);
      
      expect(response.status).toBe(200);
    });

    it('should allow access to home page without authentication', async () => {
      mockGetSession.mockResolvedValue(null);
      
      const request = new NextRequest('http://localhost:3000/');
      const response = await middleware(request);
      
      expect(response.status).toBe(200);
    });
  });

  describe('Session context', () => {
    it('should add user context headers for authenticated users', async () => {
      mockGetSession.mockResolvedValue({ 
        user: { id: 'user-123', role: 'editor' } 
      });
      
      const request = new NextRequest('http://localhost:3000/dashboard');
      const response = await middleware(request);
      
      expect(response.headers.get('x-user-id')).toBe('user-123');
      expect(response.headers.get('x-user-role')).toBe('editor');
    });

    it('should handle users without roles', async () => {
      mockGetSession.mockResolvedValue({ 
        user: { id: 'user-123' } 
      });
      
      const request = new NextRequest('http://localhost:3000/dashboard');
      const response = await middleware(request);
      
      expect(response.headers.get('x-user-id')).toBe('user-123');
      expect(response.headers.get('x-user-role')).toBe('viewer');
    });
  });
});