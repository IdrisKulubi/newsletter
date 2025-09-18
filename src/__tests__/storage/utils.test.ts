/**
 * Storage utilities tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateFileType,
  validateFileSize,
  getContentType,
  generateUniqueFilename,
  uploadOptimizedImage,
  batchDeleteFiles,
} from '@/lib/storage/utils';

// Mock the storage service
vi.mock('@/lib/storage', () => ({
  r2Storage: {
    uploadFile: vi.fn(),
    deleteFile: vi.fn(),
  },
}));

describe('Storage Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateFileType', () => {
    it('should validate allowed file types', () => {
      const allowedTypes = ['jpg', 'png', 'gif'];

      expect(validateFileType('image.jpg', allowedTypes)).toEqual({
        isValid: true,
      });

      expect(validateFileType('image.PNG', allowedTypes)).toEqual({
        isValid: true,
      });

      expect(validateFileType('document.pdf', allowedTypes)).toEqual({
        isValid: false,
        error: 'File type .pdf not allowed. Allowed types: jpg, png, gif',
      });
    });

    it('should reject files without extensions', () => {
      const allowedTypes = ['jpg', 'png'];

      expect(validateFileType('filename', allowedTypes)).toEqual({
        isValid: false,
        error: 'File must have an extension',
      });
    });
  });

  describe('validateFileSize', () => {
    it('should validate file size within limits', () => {
      const maxSizeMB = 5;
      const validSize = 3 * 1024 * 1024; // 3MB
      const invalidSize = 10 * 1024 * 1024; // 10MB

      expect(validateFileSize(validSize, maxSizeMB)).toEqual({
        isValid: true,
      });

      expect(validateFileSize(invalidSize, maxSizeMB)).toEqual({
        isValid: false,
        error: 'File size 10.00MB exceeds maximum of 5MB',
      });
    });
  });

  describe('getContentType', () => {
    it('should return correct MIME types', () => {
      expect(getContentType('image.jpg')).toBe('image/jpeg');
      expect(getContentType('image.jpeg')).toBe('image/jpeg');
      expect(getContentType('image.png')).toBe('image/png');
      expect(getContentType('image.gif')).toBe('image/gif');
      expect(getContentType('image.webp')).toBe('image/webp');
      expect(getContentType('image.svg')).toBe('image/svg+xml');
      expect(getContentType('document.pdf')).toBe('application/pdf');
      expect(getContentType('text.txt')).toBe('text/plain');
      expect(getContentType('data.csv')).toBe('text/csv');
      expect(getContentType('archive.zip')).toBe('application/zip');
    });

    it('should return default MIME type for unknown extensions', () => {
      expect(getContentType('file.unknown')).toBe('application/octet-stream');
      expect(getContentType('file')).toBe('application/octet-stream');
    });

    it('should handle case insensitive extensions', () => {
      expect(getContentType('IMAGE.JPG')).toBe('image/jpeg');
      expect(getContentType('Document.PDF')).toBe('application/pdf');
    });
  });

  describe('generateUniqueFilename', () => {
    it('should generate unique filename with timestamp and random string', () => {
      const originalFilename = 'test-image.jpg';
      const uniqueFilename = generateUniqueFilename(originalFilename);

      expect(uniqueFilename).toMatch(/^test-image_\d+_[a-z0-9]{6}\.jpg$/);
      expect(uniqueFilename).not.toBe(originalFilename);
    });

    it('should handle filenames without extensions', () => {
      const originalFilename = 'filename';
      const uniqueFilename = generateUniqueFilename(originalFilename);

      expect(uniqueFilename).toMatch(/^filename_\d+_[a-z0-9]{6}$/);
    });

    it('should generate different filenames for same input', () => {
      const originalFilename = 'test.jpg';
      const filename1 = generateUniqueFilename(originalFilename);
      const filename2 = generateUniqueFilename(originalFilename);

      expect(filename1).not.toBe(filename2);
    });
  });

  describe('uploadOptimizedImage', () => {
    it('should upload image with optimization settings', async () => {
      const { r2Storage } = await import('@/lib/storage');
      const mockUploadFile = vi.mocked(r2Storage.uploadFile);
      
      const mockResult = {
        key: 'tenants/tenant-123/assets/image.webp',
        url: 'https://example.com/image.webp',
        size: 1024,
        contentType: 'image/webp',
        lastModified: new Date(),
      };
      
      mockUploadFile.mockResolvedValue(mockResult);

      const tenantId = 'tenant-123';
      const filename = 'test-image.jpg';
      const buffer = Buffer.from('image-data');

      const result = await uploadOptimizedImage(tenantId, filename, buffer, {
        maxWidth: 800,
        maxHeight: 600,
        quality: 85,
      });

      expect(mockUploadFile).toHaveBeenCalledWith(
        tenantId,
        'assets',
        filename,
        buffer,
        {
          contentType: 'image/jpeg',
          optimize: true,
          maxWidth: 800,
          maxHeight: 600,
          quality: 85,
        }
      );

      expect(result).toBe(mockResult);
    });

    it('should reject non-image files', async () => {
      const tenantId = 'tenant-123';
      const filename = 'document.pdf';
      const buffer = Buffer.from('pdf-data');

      await expect(
        uploadOptimizedImage(tenantId, filename, buffer)
      ).rejects.toThrow('File is not an image');
    });
  });

  describe('batchDeleteFiles', () => {
    it('should delete multiple files and return results', async () => {
      const { r2Storage } = await import('@/lib/storage');
      const mockDeleteFile = vi.mocked(r2Storage.deleteFile);

      const keys = ['file1.jpg', 'file2.png', 'file3.gif'];
      
      // Mock successful deletion for first two files, failure for third
      mockDeleteFile
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Delete failed'));

      const result = await batchDeleteFiles(keys);

      expect(result).toEqual({
        successful: ['file1.jpg', 'file2.png'],
        failed: [
          {
            key: 'file3.gif',
            error: 'Delete failed',
          },
        ],
      });

      expect(mockDeleteFile).toHaveBeenCalledTimes(3);
    });

    it('should handle empty array', async () => {
      const result = await batchDeleteFiles([]);

      expect(result).toEqual({
        successful: [],
        failed: [],
      });
    });
  });
});