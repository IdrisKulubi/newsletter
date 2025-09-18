/**
 * Storage utility functions
 */

import { r2Storage } from './index';

/**
 * Validate file type for uploads
 */
export function validateFileType(
  filename: string, 
  allowedTypes: string[]
): { isValid: boolean; error?: string } {
  const parts = filename.toLowerCase().split('.');
  const extension = parts.length > 1 ? parts.pop() : undefined;
  
  if (!extension) {
    return { isValid: false, error: 'File must have an extension' };
  }

  if (!allowedTypes.includes(extension)) {
    return { 
      isValid: false, 
      error: `File type .${extension} not allowed. Allowed types: ${allowedTypes.join(', ')}` 
    };
  }

  return { isValid: true };
}

/**
 * Validate file size
 */
export function validateFileSize(
  size: number, 
  maxSizeMB: number
): { isValid: boolean; error?: string } {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  if (size > maxSizeBytes) {
    return { 
      isValid: false, 
      error: `File size ${(size / 1024 / 1024).toFixed(2)}MB exceeds maximum of ${maxSizeMB}MB` 
    };
  }

  return { isValid: true };
}

/**
 * Get content type from filename
 */
export function getContentType(filename: string): string {
  const extension = filename.toLowerCase().split('.').pop();
  
  const mimeTypes: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    
    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    
    // Text
    txt: 'text/plain',
    csv: 'text/csv',
    
    // Archives
    zip: 'application/zip',
    
    // Default
    default: 'application/octet-stream',
  };

  return mimeTypes[extension || 'default'] || mimeTypes.default;
}

/**
 * Generate unique filename to prevent conflicts
 */
export function generateUniqueFilename(originalFilename: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const parts = originalFilename.split('.');
  const extension = parts.length > 1 ? parts.pop() : undefined;
  const nameWithoutExt = parts.join('.');
  
  return extension 
    ? `${nameWithoutExt}_${timestamp}_${random}.${extension}`
    : `${nameWithoutExt}_${timestamp}_${random}`;
}

/**
 * Upload image with optimization
 */
export async function uploadOptimizedImage(
  tenantId: string,
  filename: string,
  buffer: Buffer,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  } = {}
) {
  const contentType = getContentType(filename);
  
  // Validate it's an image
  if (!contentType.startsWith('image/')) {
    throw new Error('File is not an image');
  }

  return await r2Storage.uploadFile(
    tenantId,
    'assets',
    filename,
    buffer,
    {
      contentType,
      optimize: true,
      maxWidth: options.maxWidth || 1920,
      maxHeight: options.maxHeight || 1080,
      quality: options.quality || 85,
    }
  );
}

/**
 * Upload newsletter template
 */
export async function uploadTemplate(
  tenantId: string,
  filename: string,
  buffer: Buffer
) {
  const contentType = getContentType(filename);
  
  return await r2Storage.uploadFile(
    tenantId,
    'templates',
    filename,
    buffer,
    { contentType }
  );
}

/**
 * Upload export file (temporary)
 */
export async function uploadExport(
  tenantId: string,
  filename: string,
  buffer: Buffer
) {
  const contentType = getContentType(filename);
  
  return await r2Storage.uploadFile(
    tenantId,
    'exports',
    filename,
    buffer,
    { 
      contentType,
      metadata: {
        temporary: 'true',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      }
    }
  );
}

/**
 * Batch delete files
 */
export async function batchDeleteFiles(keys: string[]): Promise<{
  successful: string[];
  failed: { key: string; error: string }[];
}> {
  const successful: string[] = [];
  const failed: { key: string; error: string }[] = [];

  for (const key of keys) {
    try {
      await r2Storage.deleteFile(key);
      successful.push(key);
    } catch (error) {
      failed.push({
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { successful, failed };
}

/**
 * Get file URL with fallback to signed URL
 */
export async function getFileUrl(
  key: string,
  options: { expiresIn?: number } = {}
): Promise<string> {
  // If public URL is configured, use it
  if (process.env.R2_PUBLIC_URL) {
    return `${process.env.R2_PUBLIC_URL}/${key}`;
  }
  
  // Otherwise, generate signed URL
  return await r2Storage.getSignedUrl(key, options);
}

/**
 * Cleanup old files for a tenant
 */
export async function cleanupOldFiles(
  tenantId: string,
  category: 'temp' | 'exports',
  olderThanDays: number = 7
): Promise<number> {
  const files = await r2Storage.listFiles(tenantId, category, 1000);
  const cutoffTime = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  
  let deletedCount = 0;
  
  for (const file of files) {
    if (file.lastModified < cutoffTime) {
      try {
        await r2Storage.deleteFile(file.key);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete old file ${file.key}:`, error);
      }
    }
  }

  return deletedCount;
}