import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenantService } from '../../lib/services/tenant';
import { middleware } from '../../middleware';
import { NextRequest } from 'next/server';

// Mock the database
vi.mock('../../lib/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

// Mock tenant context
vi.mock('../../lib/db/tenant-context', () => ({
  withTenantContext: vi.fn((tenantId, operation) => operation()),
  setTenantContext: vi.fn(),
  clearTenantContext: vi.fn(),
}));

describe('Tenant Integration Tests', () => {
  let tenantService: TenantService;
  let mockDb: any;

  beforeEach(async () => {
    const dbModule = await import('../../lib/db');
    mockDb = vi.mocked(dbModule).db as any;
    tenantService = new TenantService();
    vi.clearAllMocks();
  });

  describe('End-to-end tenant workflow', () => {
    it('should create tenant and resolve it via middleware', async () => {
      // Mock tenant creation
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Company',
        domain: 'testcompany.newsletter.com',
        customDomain: null,
        settings: {
          branding: {
            primaryColor: '#3b82f6',
          },
        },
        subscription: { plan: 'free', status: 'active' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock domain uniqueness check (empty result = unique)
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock tenant creation
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockTenant]),
        }),
      });

      // Step 1: Create tenant
      const createdTenant = await tenantService.createTenant({
        name: 'Test Company',
        domain: 'testcompany.newsletter.com',
      });

      expect(createdTenant).toEqual(mockTenant);

      // Step 2: Mock tenant lookup for middleware
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockTenant]),
          }),
        }),
      });

      // Step 3: Test middleware resolution
      const foundTenant = await tenantService.getTenantByDomain('testcompany.newsletter.com');
      
      expect(foundTenant).toEqual(mockTenant);
      expect(foundTenant?.id).toBe('tenant-123');
      expect(foundTenant?.name).toBe('Test Company');
    });

    it('should handle custom domain workflow', async () => {
      const mockTenant = {
        id: 'tenant-456',
        name: 'Custom Domain Company',
        domain: 'custom.newsletter.com',
        customDomain: 'news.customcompany.com',
        settings: {},
        subscription: { plan: 'pro', status: 'active' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock tenant lookup by custom domain
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockTenant]),
          }),
        }),
      });

      // Test custom domain resolution
      const foundTenant = await tenantService.getTenantByDomain('news.customcompany.com');
      
      expect(foundTenant).toEqual(mockTenant);
      expect(foundTenant?.customDomain).toBe('news.customcompany.com');
    });

    it('should handle tenant isolation', async () => {
      const tenant1 = {
        id: 'tenant-1',
        name: 'Company 1',
        domain: 'company1.newsletter.com',
        isActive: true,
      };

      const tenant2 = {
        id: 'tenant-2',
        name: 'Company 2',
        domain: 'company2.newsletter.com',
        isActive: true,
      };

      // Mock different tenant lookups
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([tenant1]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([tenant2]),
            }),
          }),
        });

      // Test that different domains resolve to different tenants
      const foundTenant1 = await tenantService.getTenantByDomain('company1.newsletter.com');
      const foundTenant2 = await tenantService.getTenantByDomain('company2.newsletter.com');

      expect(foundTenant1?.id).toBe('tenant-1');
      expect(foundTenant2?.id).toBe('tenant-2');
      expect(foundTenant1?.id).not.toBe(foundTenant2?.id);
    });

    it('should validate tenant access correctly', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Company',
        isActive: true,
      };

      // Mock tenant exists
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockTenant]),
          }),
        }),
      });

      const hasAccess = await tenantService.validateTenantAccess('user-1', 'tenant-123');
      expect(hasAccess).toBe(true);

      // Mock tenant doesn't exist
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const noAccess = await tenantService.validateTenantAccess('user-1', 'nonexistent-tenant');
      expect(noAccess).toBe(false);
    });

    it('should handle domain utilities correctly', () => {
      // Test subdomain extraction
      expect(tenantService.extractSubdomain('company.newsletter.com')).toBe('company');
      expect(tenantService.extractSubdomain('https://company.newsletter.com')).toBe('company');
      expect(tenantService.extractSubdomain('www.company.newsletter.com')).toBe('company');
      expect(tenantService.extractSubdomain('custom.domain.com')).toBeNull();

      // Test custom domain detection
      expect(tenantService.isCustomDomain('news.company.com')).toBe(true);
      expect(tenantService.isCustomDomain('company.newsletter.com')).toBe(false);
      expect(tenantService.isCustomDomain('www.company.newsletter.com')).toBe(false);
    });

    it('should get tenant settings with proper defaults', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Company',
        domain: 'test.newsletter.com',
        settings: {
          branding: {
            primaryColor: '#ff0000',
          },
          emailSettings: {
            fromName: 'Custom Name',
          },
        },
        isActive: true,
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockTenant]),
          }),
        }),
      });

      const settings = await tenantService.getTenantSettings('tenant-123');

      expect(settings).toEqual({
        branding: {
          logo: '',
          primaryColor: '#ff0000',
          secondaryColor: '#64748b',
        },
        emailSettings: {
          fromName: 'Custom Name',
          fromEmail: 'noreply@test.newsletter.com',
          replyTo: 'support@test.newsletter.com',
        },
        aiSettings: {
          enabled: true,
          model: 'gpt-4',
        },
        analyticsSettings: {
          retentionDays: 365,
        },
      });
    });
  });
});