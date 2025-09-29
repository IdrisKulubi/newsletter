import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AssetService } from '@/lib/services/asset';
import { db } from '@/lib/db';
import { assets } from '@/lib/db/schema/assets';
import { getTenantContext } from '@/lib/db/tenant-resolver';
import { r2Storage } from '@/lib/storage';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/db/tenant-context', () => ({
  getTenantContext: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  r2Storage: {
    uploadFile: vi.fn(),
    deleteFile: vi.fn(),
    getSignedUrl: vi.fn(),
  },
}));

const mockTenantContext = {
  id: 'tenant-123',
  userId: 'user-123',
  name: 'Test Tenant',
};

const mockAsset = {
  id: 'asset-123',
  tenantId: 'tenant-123',
  filename: 'test-image.jpg',
  originalName: 'test-image.jpg',
  mimeType: 'image/jpeg',
  size: 1024000,
  url: 'https://example.com/test-image.jpg',
  category: 'image' as const,
  uploadedBy: 'user-123',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockStorageFile = {
  key: 'tenants/tenant-123/assets/123456_test-image.jpg',
  url: 'https://example.com/test-image.jpg',
  size: 1024000,
  contentType: 'image/jpeg',
  lastModified: new Date(),
};

describe('AssetService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getTenantContext as any).mockResolvedValue(mockTenantContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('uploadAsset', () => {
    it('should upload asset with tenant isolation', async () => {
      // Mock file
      const mockFile = new File(['test content'], 'test-image.jpg', {
        type: 'image/jpeg',
      });
      
      // Mock arrayBuffer method
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

      // Mock storage upload
      (r2Storage.uploadFile as any).mockResolvedValue(mockStorageFile);

      // Mock database insert
      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockAsset]),
      };
      (db.insert as any).mockReturnValue(mockInsert);

      const result = await AssetService.uploadAsset(mockFile, 'image', {
        optimize: true,
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 85,
      });

      expect(r2Storage.uploadFile).toHaveBeenCalledWith(
        'tenant-123',
        'assets',
        'test-image.jpg',
        expect.any(Buffer),
        {
          contentType: 'image/jpeg',
          optimize: true,
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 85,
          metadata: {
            category: 'image',
            uploadedFor: 'newsletter',
          },
        }
      );

      expect(db.insert).toHaveBeenCalledWith(assets);
      expect(mockInsert.values).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        filename: expect.any(String),
        originalName: 'test-image.jpg',
        mimeType: 'image/jpeg',
        size: 1024000,
        url: 'https://example.com/test-image.jpg',
        category: 'image',
        uploadedBy: 'user-123',
      });

      expect(result).toEqual(mockAsset);
    });

    it('should throw error when tenant context is not found', async () => {
      (getTenantContext as any).mockResolvedValue(null);

      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      await expect(AssetService.uploadAsset(mockFile)).rejects.toThrow(
        'Tenant context not found'
      );
    });

    it('should handle upload errors', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));
      (r2Storage.uploadFile as any).mockRejectedValue(new Error('Upload failed'));

      await expect(AssetService.uploadAsset(mockFile)).rejects.toThrow(
        'Upload failed'
      );
    });
  });

  describe('getById', () => {
    it('should get asset by ID with tenant isolation', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockAsset]),
      };
      (db.select as any).mockReturnValue(mockSelect);

      const result = await AssetService.getById('asset-123');

      expect(db.select).toHaveBeenCalled();
      expect(mockSelect.from).toHaveBeenCalledWith(assets);
      expect(mockSelect.where).toHaveBeenCalled();
      expect(mockSelect.limit).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockAsset);
    });

    it('should return null when asset not found', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      (db.select as any).mockReturnValue(mockSelect);

      const result = await AssetService.getById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should list assets with filtering', async () => {
      const mockAssets = [mockAsset];
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockAssets),
      };
      (db.select as any).mockReturnValue(mockSelect);

      // Mock count query
      const mockCountSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      };
      (db.select as any).mockReturnValueOnce(mockSelect).mockReturnValueOnce(mockCountSelect);

      const result = await AssetService.list({
        category: 'image',
        limit: 10,
        offset: 0,
      });

      expect(result).toEqual({
        assets: mockAssets,
        total: 1,
      });
    });
  });

  describe('delete', () => {
    it('should delete asset and remove from storage', async () => {
      // Mock getById
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockAsset]),
      };
      (db.select as any).mockReturnValue(mockSelect);

      // Mock delete
      const mockDelete = {
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      };
      (db.delete as any).mockReturnValue(mockDelete);

      await AssetService.delete('asset-123');

      expect(r2Storage.deleteFile).toHaveBeenCalled();
      expect(db.delete).toHaveBeenCalledWith(assets);
    });

    it('should throw error when asset not found', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      (db.select as any).mockReturnValue(mockSelect);

      await expect(AssetService.delete('nonexistent')).rejects.toThrow(
        'Asset not found'
      );
    });
  });

  describe('getSignedUrl', () => {
    it('should generate signed URL for asset', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockAsset]),
      };
      (db.select as any).mockReturnValue(mockSelect);

      (r2Storage.getSignedUrl as any).mockResolvedValue('https://signed-url.com');

      const result = await AssetService.getSignedUrl('asset-123', 7200);

      expect(r2Storage.getSignedUrl).toHaveBeenCalledWith(
        expect.any(String),
        { expiresIn: 7200 }
      );
      expect(result).toBe('https://signed-url.com');
    });
  });

  describe('validateFileType', () => {
    it('should validate allowed file types', () => {
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const result = AssetService.validateFileType(validFile);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid file types', () => {
      const invalidFile = new File(['test'], 'test.exe', { type: 'application/exe' });
      const result = AssetService.validateFileType(invalidFile);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('File type application/exe is not allowed');
    });

    it('should reject files that are too large', () => {
      // Create a mock file that appears to be 10MB
      const largeFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      Object.defineProperty(largeFile, 'size', { value: 10 * 1024 * 1024 });

      const result = AssetService.validateFileType(largeFile);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exceeds the 5MB limit');
    });
  });

  describe('getUsageStats', () => {
    it('should return usage statistics', async () => {
      const mockStats = [
        { category: 'image', count: 5, totalSize: 5000000 },
        { category: 'document', count: 2, totalSize: 2000000 },
      ];

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(mockStats),
      };
      (db.select as any).mockReturnValue(mockSelect);

      const result = await AssetService.getUsageStats();

      expect(result).toEqual({
        totalAssets: 7,
        totalSize: 7000000,
        byCategory: {
          image: { count: 5, size: 5000000 },
          document: { count: 2, size: 2000000 },
        },
      });
    });
  });
});