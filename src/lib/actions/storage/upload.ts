/**
 * Storage upload Server Actions
 */

'use server';

import { z } from 'zod';
import { r2Storage } from '@/lib/storage';
import { validateFileType, validateFileSize, getContentType, generateUniqueFilename } from '@/lib/storage/utils';
import { getTenantContext } from '@/lib/tenant/context';

// Validation schemas
const uploadImageSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  size: z.number().positive('File size must be positive'),
  maxWidth: z.number().optional(),
  maxHeight: z.number().optional(),
  quality: z.number().min(1).max(100).optional(),
});

const uploadFileSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  size: z.number().positive('File size must be positive'),
  category: z.enum(['assets', 'templates', 'exports', 'temp']),
});

export interface UploadResult {
  success: boolean;
  data?: {
    key: string;
    url: string;
    size: number;
    contentType: string;
  };
  error?: string;
}

/**
 * Upload image with optimization
 */
export async function uploadImage(
  formData: FormData
): Promise<UploadResult> {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, error: 'Tenant context not found' };
    }

    const file = formData.get('file') as File;
    if (!file) {
      return { success: false, error: 'No file provided' };
    }

    // Validate input
    const validation = uploadImageSchema.safeParse({
      filename: file.name,
      size: file.size,
      maxWidth: formData.get('maxWidth') ? Number(formData.get('maxWidth')) : undefined,
      maxHeight: formData.get('maxHeight') ? Number(formData.get('maxHeight')) : undefined,
      quality: formData.get('quality') ? Number(formData.get('quality')) : undefined,
    });

    if (!validation.success) {
      return { 
        success: false, 
        error: validation.error?.errors?.map(e => e.message).join(', ') || 'Validation failed'
      };
    }

    const { filename, size, maxWidth, maxHeight, quality } = validation.data;

    // Validate file type (images only)
    const typeValidation = validateFileType(filename, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']);
    if (!typeValidation.isValid) {
      return { success: false, error: typeValidation.error };
    }

    // Validate file size (max 10MB for images)
    const sizeValidation = validateFileSize(size, 10);
    if (!sizeValidation.isValid) {
      return { success: false, error: sizeValidation.error };
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Generate unique filename
    const uniqueFilename = generateUniqueFilename(filename);

    // Upload with optimization
    const result = await r2Storage.uploadFile(
      tenant.id,
      'assets',
      uniqueFilename,
      buffer,
      {
        contentType: getContentType(filename),
        optimize: true,
        maxWidth,
        maxHeight,
        quality,
        metadata: {
          originalFilename: filename,
          uploadedBy: 'user', // TODO: Get from auth context
        },
      }
    );

    return {
      success: true,
      data: {
        key: result.key,
        url: result.url,
        size: result.size,
        contentType: result.contentType,
      },
    };
  } catch (error) {
    console.error('Upload image error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Upload general file
 */
export async function uploadFile(
  formData: FormData
): Promise<UploadResult> {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, error: 'Tenant context not found' };
    }

    const file = formData.get('file') as File;
    const category = formData.get('category') as string;

    if (!file) {
      return { success: false, error: 'No file provided' };
    }

    // Validate input
    const validation = uploadFileSchema.safeParse({
      filename: file.name,
      size: file.size,
      category,
    });

    if (!validation.success) {
      return { 
        success: false, 
        error: validation.error?.errors?.map(e => e.message).join(', ') || 'Validation failed'
      };
    }

    const { filename, size } = validation.data;

    // Validate file size based on category
    const maxSize = category === 'assets' ? 10 : category === 'templates' ? 5 : 50; // MB
    const sizeValidation = validateFileSize(size, maxSize);
    if (!sizeValidation.isValid) {
      return { success: false, error: sizeValidation.error };
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Generate unique filename
    const uniqueFilename = generateUniqueFilename(filename);

    // Upload file
    const result = await r2Storage.uploadFile(
      tenant.id,
      validation.data.category,
      uniqueFilename,
      buffer,
      {
        contentType: getContentType(filename),
        metadata: {
          originalFilename: filename,
          uploadedBy: 'user', // TODO: Get from auth context
        },
      }
    );

    return {
      success: true,
      data: {
        key: result.key,
        url: result.url,
        size: result.size,
        contentType: result.contentType,
      },
    };
  } catch (error) {
    console.error('Upload file error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Delete file
 */
export async function deleteFile(key: string): Promise<{ success: boolean; error?: string }> {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, error: 'Tenant context not found' };
    }

    // Validate tenant access
    if (!r2Storage.validateTenantAccess(key, tenant.id)) {
      return { success: false, error: 'Access denied' };
    }

    await r2Storage.deleteFile(key);

    return { success: true };
  } catch (error) {
    console.error('Delete file error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}

/**
 * Get signed URL for file access
 */
export async function getSignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, error: 'Tenant context not found' };
    }

    // Validate tenant access
    if (!r2Storage.validateTenantAccess(key, tenant.id)) {
      return { success: false, error: 'Access denied' };
    }

    const url = await r2Storage.getSignedUrl(key, { expiresIn });

    return { success: true, url };
  } catch (error) {
    console.error('Get signed URL error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate URL',
    };
  }
}

/**
 * List files for tenant
 */
export async function listFiles(
  category?: string,
  maxKeys: number = 100
): Promise<{
  success: boolean;
  files?: Array<{
    key: string;
    url: string;
    size: number;
    contentType: string;
    lastModified: Date;
  }>;
  error?: string;
}> {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, error: 'Tenant context not found' };
    }

    const files = await r2Storage.listFiles(tenant.id, category as any, maxKeys);

    return { success: true, files };
  } catch (error) {
    console.error('List files error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list files',
    };
  }
}