/**
 * Tenant context tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTenantContext, getTenantById, validateTenantAccess } from '@/lib/tenant/context';

// Mock Next.js headers
vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  },
}));

// Mock database schema
vi.mock('@/lib/db/schema/tenants', () => ({
  tenants: {
    id: 'id',
    domain: 'domain',
    customDomain: 'customDomain',
    isActive: 'isActive',
  },
}));

describe('Tenant Context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTenantContext', () => {
    it('should return tenant for valid domain', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Company',
        domain: 'testcompany.newsletter.com',
        customDomain: null,
        isActive: true,
        settings: {},
        subscription: { plan: 'free', status: 'active' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock headers
      const { headers } = await import('next/headers');
      const mockHeaders = vi.mocked(headers);
      mockHeaders.mockResolvedValue({
        get: vi.fn().mockReturnValue('testcompany.newsletter.com'),
      } as any);

      // Mock database query
      const { db } = await import('@/lib/db');
      const mockDb = vi.mocked(db);
      mockDb.limit.mockResolvedValue([mockTenant]);

      const result = await getTenantContext();

      expect(result).toEqual(mockTenant);
      expect(mockHeaders).toHaveBeenCalled();
    });

    it('should return tenant for custom domain', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Company',
        domain: 'testcompany.newsletter.com',
        customDomain: 'news.testcompany.com',
        isActive: true,
        settings: {},
        subscription: { plan: 'pro', status: 'active' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock headers with custom domain
      const { headers } = await import('next/headers');
      const mockHeaders = vi.mocked(headers);
      mockHeaders.mockResolvedValue({
        get: vi.fn().mockReturnValue('news.testcompany.com'),
      } as any);

      // Mock database query
      const { db } = await import('@/lib/db');
      const mockDb = vi.mocked(db);
      mockDb.limit.mockResolvedValue([mockTenant]);

      const result = await getTenantContext();

      expect(result).toEqual(mockTenant);
    });

    it('should return null for inactive tenant', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Inactive Company',
        domain: 'inactive.newsletter.com',
        customDomain: null,
        isActive: false, // Inactive tenant
        settings: {},
        subscription: { plan: 'free', status: 'cancelled' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock headers
      const { headers } = await import('next/headers');
      const mockHeaders = vi.mocked(headers);
      mockHeaders.mockResolvedValue({
        get: vi.fn().mockReturnValue('inactive.newsletter.com'),
      } as any);

      // Mock database query
      const { db } = await import('@/lib/db');
      const mockDb = vi.mocked(db);
      mockDb.limit.mockResolvedValue([mockTenant]);

      const result = await getTenantContext();

      expect(result).toBeNull();
    });

    it('should return null when no tenant found', async () => {
      // Mock headers
      const { headers } = await import('next/headers');
      const mockHeaders = vi.mocked(headers);
      mockHeaders.mockResolvedValue({
        get: vi.fn().mockReturnValue('nonexistent.newsletter.com'),
      } as any);

      // Mock database query returning empty array
      const { db } = await import('@/lib/db');
      const mockDb = vi.mocked(db);
      mockDb.limit.mockResolvedValue([]);

      const result = await getTenantContext();

      expect(result).toBeNull();
    });

    it('should return null when no host header', async () => {
      // Mock headers with no host
      const { headers } = await import('next/headers');
      const mockHeaders = vi.mocked(headers);
      mockHeaders.mockResolvedValue({
        get: vi.fn().mockReturnValue(null),
      } as any);

      const result = await getTenantContext();

      expect(result).toBeNull();
    });

    it('should handle host with port', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Company',
        domain: 'localhost',
        customDomain: null,
        isActive: true,
        settings: {},
        subscription: { plan: 'free', status: 'active' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock headers with port
      const { headers } = await import('next/headers');
      const mockHeaders = vi.mocked(headers);
      mockHeaders.mockResolvedValue({
        get: vi.fn().mockReturnValue('localhost:3000'),
      } as any);

      // Mock database query
      const { db } = await import('@/lib/db');
      const mockDb = vi.mocked(db);
      mockDb.limit.mockResolvedValue([mockTenant]);

      const result = await getTenantContext();

      expect(result).toEqual(mockTenant);
    });
  });

  describe('getTenantById', () => {
    it('should return tenant by ID', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Company',
        domain: 'testcompany.newsletter.com',
        customDomain: null,
        isActive: true,
        settings: {},
        subscription: { plan: 'free', status: 'active' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock database query
      const { db } = await import('@/lib/db');
      const mockDb = vi.mocked(db);
      mockDb.limit.mockResolvedValue([mockTenant]);

      const result = await getTenantById('tenant-123');

      expect(result).toEqual(mockTenant);
    });

    it('should return null when tenant not found', async () => {
      // Mock database query returning empty array
      const { db } = await import('@/lib/db');
      const mockDb = vi.mocked(db);
      mockDb.limit.mockResolvedValue([]);

      const result = await getTenantById('nonexistent-tenant');

      expect(result).toBeNull();
    });
  });

  describe('validateTenantAccess', () => {
    it('should return true for active tenant', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Company',
        domain: 'testcompany.newsletter.com',
        customDomain: null,
        isActive: true,
        settings: {},
        subscription: { plan: 'free', status: 'active' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock database query
      const { db } = await import('@/lib/db');
      const mockDb = vi.mocked(db);
      mockDb.limit.mockResolvedValue([mockTenant]);

      const result = await validateTenantAccess('tenant-123', 'user-456');

      expect(result).toBe(true);
    });

    it('should return false for inactive tenant', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Inactive Company',
        domain: 'inactive.newsletter.com',
        customDomain: null,
        isActive: false,
        settings: {},
        subscription: { plan: 'free', status: 'cancelled' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock database query
      const { db } = await import('@/lib/db');
      const mockDb = vi.mocked(db);
      mockDb.limit.mockResolvedValue([mockTenant]);

      const result = await validateTenantAccess('tenant-123', 'user-456');

      expect(result).toBe(false);
    });

    it('should return false for nonexistent tenant', async () => {
      // Mock database query returning empty array
      const { db } = await import('@/lib/db');
      const mockDb = vi.mocked(db);
      mockDb.limit.mockResolvedValue([]);

      const result = await validateTenantAccess('nonexistent-tenant', 'user-456');

      expect(result).toBe(false);
    });
  });
});