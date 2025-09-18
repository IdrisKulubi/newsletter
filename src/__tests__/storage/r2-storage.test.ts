/**
 * R2 Storage Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { R2StorageService } from '@/lib/storage';
import { S3Client } from '@aws-sdk/client-s3';

// Mock AWS S3 Client
vi.mock('@aws-sdk/client-s3');
vi.mock('@aws-sdk/s3-request-presigner');
vi.mock('@/lib/config', () => ({
  config: {
    r2: {
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
      accountId: 'test-account-id',
      bucketName: 'test-bucket',
      publicUrl: 'https://test-bucket.test-account.r2.cloudflarestorage.com',
    },
  },
}));

// Mock sharp for image optimization
vi.mock('sharp', () => {
  const mockSharp = vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('optimized-image-data')),
  }));
  return { default: mockSharp };
});

describe('R2StorageService', () => {
  let storageService: R2StorageService;
  let mockS3Client: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock S3Client
    mockS3Client = {
      send: vi.fn(),
    };
    (S3Client as any).mockImplementation(() => mockS3Client);

    storageService = new R2StorageService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload file with tenant isolation', async () => {
      const mockResponse = {};
      mockS3Client.send.mockResolvedValue(mockResponse);

      const tenantId = 'tenant-123';
      const category = 'assets';
      const filename = 'test-image.jpg';
      const buffer = Buffer.from('test-image-data');

      const result = await storageService.uploadFile(
        tenantId,
        category,
        filename,
        buffer,
        { contentType: 'image/jpeg' }
      );

      expect(result).toMatchObject({
        key: expect.stringContaining(`tenants/${tenantId}/${category}/`),
        url: expect.stringContaining('test-bucket.test-account.r2.cloudflarestorage.com'),
        size: expect.any(Number),
        contentType: 'image/jpeg',
        lastModified: expect.any(Date),
      });

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(Object) // AWS SDK command object
      );
    });

    it('should optimize images when requested', async () => {
      const mockResponse = {};
      mockS3Client.send.mockResolvedValue(mockResponse);

      const tenantId = 'tenant-123';
      const filename = 'test-image.jpg';
      const buffer = Buffer.from('test-image-data');

      await storageService.uploadFile(
        tenantId,
        'assets',
        filename,
        buffer,
        {
          contentType: 'image/jpeg',
          optimize: true,
          maxWidth: 800,
          maxHeight: 600,
          quality: 80,
        }
      );

      // Verify sharp was called for optimization
      const sharp = await import('sharp');
      expect(sharp.default).toHaveBeenCalledWith(buffer);
    });

    it('should handle upload errors gracefully', async () => {
      const error = new Error('Upload failed');
      mockS3Client.send.mockRejectedValue(error);

      const tenantId = 'tenant-123';
      const filename = 'test-file.txt';
      const buffer = Buffer.from('test-data');

      await expect(
        storageService.uploadFile(tenantId, 'assets', filename, buffer)
      ).rejects.toThrow('Failed to upload file: Upload failed');
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const mockResponse = {};
      mockS3Client.send.mockResolvedValue(mockResponse);

      const key = 'tenants/tenant-123/assets/test-file.jpg';

      await storageService.deleteFile(key);

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(Object) // AWS SDK command object
      );
    });

    it('should handle delete errors gracefully', async () => {
      const error = new Error('Delete failed');
      mockS3Client.send.mockRejectedValue(error);

      const key = 'tenants/tenant-123/assets/test-file.jpg';

      await expect(storageService.deleteFile(key)).rejects.toThrow(
        'Failed to delete file: Delete failed'
      );
    });
  });

  describe('listFiles', () => {
    it('should list files for tenant with category filter', async () => {
      const mockResponse = {
        Contents: [
          {
            Key: 'tenants/tenant-123/assets/file1.jpg',
            Size: 1024,
            LastModified: new Date('2024-01-01'),
          },
          {
            Key: 'tenants/tenant-123/assets/file2.png',
            Size: 2048,
            LastModified: new Date('2024-01-02'),
          },
        ],
      };
      mockS3Client.send.mockResolvedValue(mockResponse);

      const tenantId = 'tenant-123';
      const category = 'assets';

      const result = await storageService.listFiles(tenantId, category);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        key: 'tenants/tenant-123/assets/file1.jpg',
        size: 1024,
        lastModified: new Date('2024-01-01'),
      });

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(Object) // AWS SDK command object
      );
    });

    it('should list all files for tenant when no category specified', async () => {
      const mockResponse = { Contents: [] };
      mockS3Client.send.mockResolvedValue(mockResponse);

      const tenantId = 'tenant-123';

      await storageService.listFiles(tenantId);

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(Object) // AWS SDK command object
      );
    });
  });

  describe('getFileMetadata', () => {
    it('should return file metadata when file exists', async () => {
      const mockResponse = {
        ContentLength: 1024,
        ContentType: 'image/jpeg',
        LastModified: new Date('2024-01-01'),
        Metadata: {
          tenantId: 'tenant-123',
          originalFilename: 'test.jpg',
        },
      };
      mockS3Client.send.mockResolvedValue(mockResponse);

      const key = 'tenants/tenant-123/assets/test.jpg';

      const result = await storageService.getFileMetadata(key);

      expect(result).toEqual({
        size: 1024,
        contentType: 'image/jpeg',
        lastModified: new Date('2024-01-01'),
        metadata: {
          tenantId: 'tenant-123',
          originalFilename: 'test.jpg',
        },
      });
    });

    it('should return null when file does not exist', async () => {
      const error = new Error('NotFound');
      error.name = 'NotFound';
      mockS3Client.send.mockRejectedValue(error);

      const key = 'tenants/tenant-123/assets/nonexistent.jpg';

      const result = await storageService.getFileMetadata(key);

      expect(result).toBeNull();
    });
  });

  describe('validateTenantAccess', () => {
    it('should return true for valid tenant path', () => {
      const key = 'tenants/tenant-123/assets/file.jpg';
      const tenantId = 'tenant-123';

      const result = storageService.validateTenantAccess(key, tenantId);

      expect(result).toBe(true);
    });

    it('should return false for invalid tenant path', () => {
      const key = 'tenants/tenant-456/assets/file.jpg';
      const tenantId = 'tenant-123';

      const result = storageService.validateTenantAccess(key, tenantId);

      expect(result).toBe(false);
    });

    it('should return false for non-tenant path', () => {
      const key = 'public/file.jpg';
      const tenantId = 'tenant-123';

      const result = storageService.validateTenantAccess(key, tenantId);

      expect(result).toBe(false);
    });
  });

  describe('cleanupTempFiles', () => {
    it('should delete old temporary files', async () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago

      // Mock listFiles response
      const mockListResponse = {
        Contents: [
          {
            Key: 'tenants/tenant-123/temp/old-file.txt',
            Size: 1024,
            LastModified: oldDate,
          },
          {
            Key: 'tenants/tenant-123/temp/recent-file.txt',
            Size: 2048,
            LastModified: recentDate,
          },
        ],
      };

      // Mock delete response
      const mockDeleteResponse = {};

      mockS3Client.send
        .mockResolvedValueOnce(mockListResponse) // First call for listFiles
        .mockResolvedValueOnce(mockDeleteResponse); // Second call for deleteFile

      const tenantId = 'tenant-123';
      const result = await storageService.cleanupTempFiles(tenantId, 24);

      expect(result).toBe(1); // Only one old file should be deleted
      expect(mockS3Client.send).toHaveBeenCalledTimes(2); // List + Delete
    });
  });
});