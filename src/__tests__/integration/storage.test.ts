/**
 * Storage Server Actions Integration Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadImage, uploadFile, deleteFile, getSignedUrl, listFiles } from '@/lib/actions/storage/upload';

// Mock the storage service
vi.mock('@/lib/storage', () => ({
  r2Storage: {
    uploadFile: vi.fn(),
    deleteFile: vi.fn(),
    getSignedUrl: vi.fn(),
    listFiles: vi.fn(),
    validateTenantAccess: vi.fn(),
  },
}));

// Mock tenant context
vi.mock('@/lib/tenant/context', () => ({
  getTenantContext: vi.fn(),
}));

// Mock storage utils
vi.mock('@/lib/storage/utils', () => ({
  validateFileType: vi.fn(),
  validateFileSize: vi.fn(),
  getContentType: vi.fn(),
  generateUniqueFilename: vi.fn(),
}));

describe('Storage Server Actions', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadImage', () => {
    it('should upload image successfully', async () => {
      // Mock dependencies
      const { getTenantContext } = await import('@/lib/tenant/context');
      const { r2Storage } = await import('@/lib/storage');
      const { validateFileType, validateFileSize, getContentType, generateUniqueFilename } = await import('@/lib/storage/utils');

      vi.mocked(getTenantContext).mockResolvedValue(mockTenant);
      vi.mocked(validateFileType).mockReturnValue({ isValid: true });
      vi.mocked(validateFileSize).mockReturnValue({ isValid: true });
      vi.mocked(getContentType).mockReturnValue('image/jpeg');
      vi.mocked(generateUniqueFilename).mockReturnValue('unique-image.jpg');

      const mockUploadResult = {
        key: 'tenants/tenant-123/assets/unique-image.jpg',
        url: 'https://example.com/unique-image.jpg',
        size: 1024,
        contentType: 'image/jpeg',
        lastModified: new Date(),
      };
      vi.mocked(r2Storage.uploadFile).mockResolvedValue(mockUploadResult);

      // Create mock FormData
      const formData = new FormData();
      const mockFile = {
        name: 'test-image.jpg',
        type: 'image/jpeg',
        size: 1024,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      } as any;
      formData.append('file', mockFile);
      formData.append('maxWidth', '800');
      formData.append('quality', '85');

      const result = await uploadImage(formData);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.key).toBe(mockUploadResult.key);

      expect(r2Storage.uploadFile).toHaveBeenCalledWith(
        mockTenant.id,
        'assets',
        'unique-image.jpg',
        expect.any(Buffer),
        expect.objectContaining({
          contentType: 'image/jpeg',
          optimize: true,
          maxWidth: 800,
          quality: 85,
        })
      );
    });

    it('should fail when no tenant context', async () => {
      const { getTenantContext } = await import('@/lib/tenant/context');
      vi.mocked(getTenantContext).mockResolvedValue(null);

      const formData = new FormData();
      const mockFile = {
        name: 'test-image.jpg',
        type: 'image/jpeg',
        size: 1024,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      } as any;
      formData.append('file', mockFile);

      const result = await uploadImage(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tenant context not found');
    });

    it('should fail when no file provided', async () => {
      const { getTenantContext } = await import('@/lib/tenant/context');
      vi.mocked(getTenantContext).mockResolvedValue(mockTenant);

      const formData = new FormData();

      const result = await uploadImage(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No file provided');
    });

    it('should fail validation for invalid file type', async () => {
      const { getTenantContext } = await import('@/lib/tenant/context');
      const { validateFileType } = await import('@/lib/storage/utils');

      vi.mocked(getTenantContext).mockResolvedValue(mockTenant);
      vi.mocked(validateFileType).mockReturnValue({
        isValid: false,
        error: 'Invalid file type',
      });

      const formData = new FormData();
      const mockFile = {
        name: 'document.pdf',
        type: 'application/pdf',
        size: 1024,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      } as any;
      formData.append('file', mockFile);

      const result = await uploadImage(formData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('should fail validation for file too large', async () => {
      const { getTenantContext } = await import('@/lib/tenant/context');
      const { validateFileType, validateFileSize } = await import('@/lib/storage/utils');

      vi.mocked(getTenantContext).mockResolvedValue(mockTenant);
      vi.mocked(validateFileType).mockReturnValue({ isValid: true });
      vi.mocked(validateFileSize).mockReturnValue({
        isValid: false,
        error: 'File too large',
      });

      const formData = new FormData();
      const mockFile = {
        name: 'large-image.jpg',
        type: 'image/jpeg',
        size: 15 * 1024 * 1024, // 15MB
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(15 * 1024 * 1024)),
      } as any;
      formData.append('file', mockFile);

      const result = await uploadImage(formData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('File too large');
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const { getTenantContext } = await import('@/lib/tenant/context');
      const { r2Storage } = await import('@/lib/storage');

      vi.mocked(getTenantContext).mockResolvedValue(mockTenant);
      vi.mocked(r2Storage.validateTenantAccess).mockReturnValue(true);
      vi.mocked(r2Storage.deleteFile).mockResolvedValue(undefined);

      const key = 'tenants/tenant-123/assets/test-file.jpg';
      const result = await deleteFile(key);

      expect(result.success).toBe(true);
      expect(r2Storage.deleteFile).toHaveBeenCalledWith(key);
    });

    it('should fail when no tenant context', async () => {
      const { getTenantContext } = await import('@/lib/tenant/context');
      vi.mocked(getTenantContext).mockResolvedValue(null);

      const key = 'tenants/tenant-123/assets/test-file.jpg';
      const result = await deleteFile(key);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tenant context not found');
    });

    it('should fail when access denied', async () => {
      const { getTenantContext } = await import('@/lib/tenant/context');
      const { r2Storage } = await import('@/lib/storage');

      vi.mocked(getTenantContext).mockResolvedValue(mockTenant);
      vi.mocked(r2Storage.validateTenantAccess).mockReturnValue(false);

      const key = 'tenants/other-tenant/assets/test-file.jpg';
      const result = await deleteFile(key);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access denied');
    });
  });

  describe('getSignedUrl', () => {
    it('should generate signed URL successfully', async () => {
      const { getTenantContext } = await import('@/lib/tenant/context');
      const { r2Storage } = await import('@/lib/storage');

      vi.mocked(getTenantContext).mockResolvedValue(mockTenant);
      vi.mocked(r2Storage.validateTenantAccess).mockReturnValue(true);
      vi.mocked(r2Storage.getSignedUrl).mockResolvedValue('https://signed-url.com/file.jpg');

      const key = 'tenants/tenant-123/assets/test-file.jpg';
      const result = await getSignedUrl(key, 7200);

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://signed-url.com/file.jpg');
      expect(r2Storage.getSignedUrl).toHaveBeenCalledWith(key, { expiresIn: 7200 });
    });

    it('should fail when access denied', async () => {
      const { getTenantContext } = await import('@/lib/tenant/context');
      const { r2Storage } = await import('@/lib/storage');

      vi.mocked(getTenantContext).mockResolvedValue(mockTenant);
      vi.mocked(r2Storage.validateTenantAccess).mockReturnValue(false);

      const key = 'tenants/other-tenant/assets/test-file.jpg';
      const result = await getSignedUrl(key);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access denied');
    });
  });

  describe('listFiles', () => {
    it('should list files successfully', async () => {
      const { getTenantContext } = await import('@/lib/tenant/context');
      const { r2Storage } = await import('@/lib/storage');

      const mockFiles = [
        {
          key: 'tenants/tenant-123/assets/file1.jpg',
          url: 'https://example.com/file1.jpg',
          size: 1024,
          contentType: 'image/jpeg',
          lastModified: new Date(),
        },
        {
          key: 'tenants/tenant-123/assets/file2.png',
          url: 'https://example.com/file2.png',
          size: 2048,
          contentType: 'image/png',
          lastModified: new Date(),
        },
      ];

      vi.mocked(getTenantContext).mockResolvedValue(mockTenant);
      vi.mocked(r2Storage.listFiles).mockResolvedValue(mockFiles);

      const result = await listFiles('assets', 50);

      expect(result.success).toBe(true);
      expect(result.files).toEqual(mockFiles);
      expect(r2Storage.listFiles).toHaveBeenCalledWith(mockTenant.id, 'assets', 50);
    });

    it('should fail when no tenant context', async () => {
      const { getTenantContext } = await import('@/lib/tenant/context');
      vi.mocked(getTenantContext).mockResolvedValue(null);

      const result = await listFiles();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tenant context not found');
    });
  });
});