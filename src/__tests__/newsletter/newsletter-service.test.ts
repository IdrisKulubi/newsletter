import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NewsletterService } from '@/lib/services/newsletter';
import { db } from '@/lib/db';
import { newsletters } from '@/lib/db/schema/newsletters';
import { getTenantContext } from '@/lib/db/tenant-context';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/db/tenant-context', () => ({
  getTenantContext: vi.fn(),
}));

const mockTenantContext = {
  id: 'tenant-123',
  userId: 'user-123',
  name: 'Test Tenant',
};

const mockNewsletter = {
  id: 'newsletter-123',
  tenantId: 'tenant-123',
  title: 'Test Newsletter',
  content: { blocks: [] },
  template: null,
  metadata: {},
  status: 'draft' as const,
  createdBy: 'user-123',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('NewsletterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getTenantContext as any).mockResolvedValue(mockTenantContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('create', () => {
    it('should create a newsletter with tenant isolation', async () => {
      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockNewsletter]),
      };
      (db.insert as any).mockReturnValue(mockInsert);

      const newsletterData = {
        title: 'Test Newsletter',
        content: { blocks: [] },
        metadata: {},
        status: 'draft' as const,
        createdBy: 'user-123',
      };

      const result = await NewsletterService.create(newsletterData);

      expect(db.insert).toHaveBeenCalledWith(newsletters);
      expect(mockInsert.values).toHaveBeenCalledWith({
        ...newsletterData,
        tenantId: mockTenantContext.id,
      });
      expect(result).toEqual(mockNewsletter);
    });

    it('should throw error when tenant context is not found', async () => {
      (getTenantContext as any).mockResolvedValue(null);

      const newsletterData = {
        title: 'Test Newsletter',
        content: { blocks: [] },
        metadata: {},
        status: 'draft' as const,
        createdBy: 'user-123',
      };

      await expect(NewsletterService.create(newsletterData)).rejects.toThrow(
        'Tenant context not found'
      );
    });
  });

  describe('getById', () => {
    it('should get newsletter by ID with tenant isolation', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockNewsletter]),
      };
      (db.select as any).mockReturnValue(mockSelect);

      const result = await NewsletterService.getById('newsletter-123');

      expect(db.select).toHaveBeenCalled();
      expect(mockSelect.from).toHaveBeenCalledWith(newsletters);
      expect(mockSelect.where).toHaveBeenCalled();
      expect(mockSelect.limit).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockNewsletter);
    });

    it('should return null when newsletter not found', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      (db.select as any).mockReturnValue(mockSelect);

      const result = await NewsletterService.getById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update newsletter with tenant isolation', async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ ...mockNewsletter, title: 'Updated Title' }]),
      };
      (db.update as any).mockReturnValue(mockUpdate);

      const updateData = { title: 'Updated Title' };
      const result = await NewsletterService.update('newsletter-123', updateData);

      expect(db.update).toHaveBeenCalledWith(newsletters);
      expect(mockUpdate.set).toHaveBeenCalledWith({
        ...updateData,
        updatedAt: expect.any(Date),
      });
      expect(result.title).toBe('Updated Title');
    });

    it('should throw error when newsletter not found', async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };
      (db.update as any).mockReturnValue(mockUpdate);

      await expect(
        NewsletterService.update('nonexistent', { title: 'Updated' })
      ).rejects.toThrow('Newsletter not found or access denied');
    });
  });

  describe('delete', () => {
    it('should delete newsletter with tenant isolation', async () => {
      const mockDelete = {
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      };
      (db.delete as any).mockReturnValue(mockDelete);

      await NewsletterService.delete('newsletter-123');

      expect(db.delete).toHaveBeenCalledWith(newsletters);
      expect(mockDelete.where).toHaveBeenCalled();
    });

    it('should throw error when newsletter not found', async () => {
      const mockDelete = {
        where: vi.fn().mockResolvedValue({ rowCount: 0 }),
      };
      (db.delete as any).mockReturnValue(mockDelete);

      await expect(NewsletterService.delete('nonexistent')).rejects.toThrow(
        'Newsletter not found or access denied'
      );
    });
  });

  describe('duplicate', () => {
    it('should duplicate a newsletter', async () => {
      // Mock getById
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockNewsletter]),
      };
      (db.select as any).mockReturnValue(mockSelect);

      // Mock create
      const duplicatedNewsletter = {
        ...mockNewsletter,
        id: 'newsletter-456',
        title: 'Test Newsletter (Copy)',
      };
      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([duplicatedNewsletter]),
      };
      (db.insert as any).mockReturnValue(mockInsert);

      const result = await NewsletterService.duplicate('newsletter-123');

      expect(result.title).toBe('Test Newsletter (Copy)');
      expect(result.id).toBe('newsletter-456');
    });

    it('should use custom title when provided', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockNewsletter]),
      };
      (db.select as any).mockReturnValue(mockSelect);

      const duplicatedNewsletter = {
        ...mockNewsletter,
        id: 'newsletter-456',
        title: 'Custom Title',
      };
      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([duplicatedNewsletter]),
      };
      (db.insert as any).mockReturnValue(mockInsert);

      const result = await NewsletterService.duplicate('newsletter-123', 'Custom Title');

      expect(result.title).toBe('Custom Title');
    });
  });

  describe('getStats', () => {
    it('should return newsletter statistics', async () => {
      const mockStats = [
        { status: 'draft', count: 5 },
        { status: 'review', count: 2 },
        { status: 'approved', count: 3 },
      ];

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(mockStats),
      };
      (db.select as any).mockReturnValue(mockSelect);

      const result = await NewsletterService.getStats();

      expect(result).toEqual({
        total: 10,
        draft: 5,
        review: 2,
        approved: 3,
      });
    });
  });
});