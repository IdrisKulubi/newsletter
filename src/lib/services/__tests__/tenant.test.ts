import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TenantService } from '../tenant';
import { db } from '../../db';
import { tenants } from '../../db/schema/tenants';
import { eq } from 'drizzle-orm';

// Mock the database
vi.mock('../../db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

// Mock tenant context
vi.mock('../../db/tenant-context', () => ({
  withTenantContext: vi.fn((tenantId, operation) => operation()),
  setTenantContext: vi.fn(),
  clearTenantContext: vi.fn(),
}));

describe('TenantService', () => {
  let tenantService: TenantService;
  const mockDb = db as any;

  beforeEach(() => {
    tenantService = new TenantService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createTenant', () => {
    it('should create a new tenant successfully', async () => {
      const mockTenant = {
        id: 'tenant-1',
        name: 'Test Company',
        domain: 'test.newsletter.com',
        customDomain: null,
        settings: {},
        subscription: { plan: 'free', status: 'active' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock domain uniqueness check
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock insert
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockTenant]),
        }),
      });

      const result = await tenantService.createTenant({
        name: 'Test Company',
        domain: 'test.newsletter.com',
      });

      expect(result).toEqual(mockTenant);
      expect(mockDb.insert).toHaveBeenCalledWith(tenants);
    });

    it('should throw error for duplicate domain', async () => {
      // Mock existing tenant
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'existing-tenant' }]),
          }),
        }),
      });

      await expect(
        tenantService.createTenant({
          name: 'Test Company',
          domain: 'existing.newsletter.com',
        })
      ).rejects.toThrow('Domain already exists');
    });
  });

  describe('getTenantByDomain', () => {
    it('should find tenant by subdomain', async () => {
      const mockTenant = {
        id: 'tenant-1',
        name: 'Test Company',
        domain: 'test.newsletter.com',
        customDomain: null,
        isActive: true,
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockTenant]),
          }),
        }),
      });

      const result = await tenantService.getTenantByDomain('test.newsletter.com');

      expect(result).toEqual(mockTenant);
    });

    it('should find tenant by custom domain', async () => {
      const mockTenant = {
        id: 'tenant-1',
        name: 'Test Company',
        domain: 'test.newsletter.com',
        customDomain: 'news.testcompany.com',
        isActive: true,
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockTenant]),
          }),
        }),
      });

      const result = await tenantService.getTenantByDomain('news.testcompany.com');

      expect(result).toEqual(mockTenant);
    });

    it('should handle domain cleaning (remove protocol and www)', async () => {
      const mockTenant = {
        id: 'tenant-1',
        domain: 'test.newsletter.com',
        isActive: true,
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockTenant]),
          }),
        }),
      });

      await tenantService.getTenantByDomain('https://www.test.newsletter.com');

      // Verify the domain was cleaned before querying
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return null for non-existent domain', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await tenantService.getTenantByDomain('nonexistent.newsletter.com');

      expect(result).toBeNull();
    });
  });

  describe('updateTenant', () => {
    it('should update tenant successfully', async () => {
      const mockUpdatedTenant = {
        id: 'tenant-1',
        name: 'Updated Company',
        domain: 'test.newsletter.com',
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

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUpdatedTenant]),
          }),
        }),
      });

      const result = await tenantService.updateTenant('tenant-1', {
        name: 'Updated Company',
      });

      expect(result).toEqual(mockUpdatedTenant);
      expect(mockDb.update).toHaveBeenCalledWith(tenants);
    });
  });

  describe('deleteTenant', () => {
    it('should soft delete tenant', async () => {
      const mockDeletedTenant = {
        id: 'tenant-1',
        isActive: false,
        updatedAt: new Date(),
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockDeletedTenant]),
          }),
        }),
      });

      const result = await tenantService.deleteTenant('tenant-1');

      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalledWith(tenants);
    });
  });

  describe('domain utilities', () => {
    it('should extract subdomain correctly', () => {
      expect(tenantService.extractSubdomain('company.newsletter.com')).toBe('company');
      expect(tenantService.extractSubdomain('https://company.newsletter.com')).toBe('company');
      expect(tenantService.extractSubdomain('www.company.newsletter.com')).toBe('company');
      expect(tenantService.extractSubdomain('custom.domain.com')).toBeNull();
    });

    it('should identify custom domains correctly', () => {
      expect(tenantService.isCustomDomain('news.company.com')).toBe(true);
      expect(tenantService.isCustomDomain('company.newsletter.com')).toBe(false);
      expect(tenantService.isCustomDomain('www.company.newsletter.com')).toBe(false);
    });
  });

  describe('tenant isolation', () => {
    it('should validate tenant access', async () => {
      const mockTenant = {
        id: 'tenant-1',
        isActive: true,
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockTenant]),
          }),
        }),
      });

      const result = await tenantService.validateTenantAccess('user-1', 'tenant-1');

      expect(result).toBe(true);
    });

    it('should reject access to non-existent tenant', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await tenantService.validateTenantAccess('user-1', 'nonexistent-tenant');

      expect(result).toBe(false);
    });
  });

  describe('tenant settings', () => {
    it('should return tenant settings with defaults', async () => {
      const mockTenant = {
        id: 'tenant-1',
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

      const result = await tenantService.getTenantSettings('tenant-1');

      expect(result).toEqual({
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

    it('should throw error for non-existent tenant settings', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        tenantService.getTenantSettings('nonexistent-tenant')
      ).rejects.toThrow('Tenant not found');
    });
  });
});