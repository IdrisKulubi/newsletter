/**
 * Cloudflare R2 Storage Service
 * Provides tenant-scoped file operations with image optimization
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '@/lib/config';
import sharp from 'sharp';

export interface StorageFile {
  key: string;
  url: string;
  size: number;
  contentType: string;
  lastModified: Date;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  optimize?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export interface SignedUrlOptions {
  expiresIn?: number; // seconds, default 3600 (1 hour)
  responseContentType?: string;
  responseContentDisposition?: string;
}

export class R2StorageService {
  private client: S3Client;
  private bucketName: string;

  constructor() {
    // Configure S3 client for Cloudflare R2
    this.client = new S3Client({
      region: 'auto', // R2 uses 'auto' as region
      endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    });
    
    this.bucketName = config.r2.bucketName;
  }

  /**
   * Generate tenant-scoped file path
   */
  private getTenantPath(tenantId: string, category: string, filename: string): string {
    // Sanitize filename
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    return `tenants/${tenantId}/${category}/${timestamp}_${sanitizedFilename}`;
  }

  /**
   * Optimize image if needed
   */
  private async optimizeImage(
    buffer: Buffer, 
    contentType: string, 
    options: UploadOptions
  ): Promise<{ buffer: Buffer; contentType: string }> {
    if (!options.optimize || !contentType.startsWith('image/')) {
      return { buffer, contentType };
    }

    try {
      let sharpInstance = sharp(buffer);
      
      // Resize if dimensions specified
      if (options.maxWidth || options.maxHeight) {
        sharpInstance = sharpInstance.resize(options.maxWidth, options.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      // Convert to WebP for better compression (except for SVG)
      if (contentType !== 'image/svg+xml') {
        const quality = options.quality || 85;
        buffer = await sharpInstance.webp({ quality }).toBuffer();
        contentType = 'image/webp';
      } else {
        buffer = await sharpInstance.toBuffer();
      }

      return { buffer, contentType };
    } catch (error) {
      console.warn('Image optimization failed, using original:', error);
      return { buffer, contentType };
    }
  }

  /**
   * Upload file to R2 with tenant isolation
   */
  async uploadFile(
    tenantId: string,
    category: 'assets' | 'templates' | 'exports' | 'temp',
    filename: string,
    buffer: Buffer,
    options: UploadOptions = {}
  ): Promise<StorageFile> {
    try {
      const key = this.getTenantPath(tenantId, category, filename);
      
      // Optimize image if requested
      const { buffer: processedBuffer, contentType } = await this.optimizeImage(
        buffer,
        options.contentType || 'application/octet-stream',
        options
      );

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: processedBuffer,
        ContentType: contentType,
        Metadata: {
          tenantId,
          category,
          originalFilename: filename,
          ...options.metadata,
        },
      });

      await this.client.send(command);

      // Generate public URL if R2_PUBLIC_URL is configured
      const url = config.r2.publicUrl 
        ? `${config.r2.publicUrl}/${key}`
        : await this.getSignedUrl(key, { expiresIn: 86400 }); // 24 hours for fallback

      return {
        key,
        url,
        size: processedBuffer.length,
        contentType,
        lastModified: new Date(),
      };
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get signed URL for secure file access
   */
  async getSignedUrl(key: string, options: SignedUrlOptions = {}): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ResponseContentType: options.responseContentType,
        ResponseContentDisposition: options.responseContentDisposition,
      });

      return await getSignedUrl(this.client, command, {
        expiresIn: options.expiresIn || 3600, // 1 hour default
      });
    } catch (error) {
      console.error('Failed to generate signed URL:', error);
      throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete file from R2
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List files for a tenant with optional category filter
   */
  async listFiles(
    tenantId: string,
    category?: string,
    maxKeys: number = 100
  ): Promise<StorageFile[]> {
    try {
      const prefix = category 
        ? `tenants/${tenantId}/${category}/`
        : `tenants/${tenantId}/`;

      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys,
      });

      const response = await this.client.send(command);
      
      if (!response.Contents) {
        return [];
      }

      return response.Contents.map(object => ({
        key: object.Key!,
        url: config.r2.publicUrl 
          ? `${config.r2.publicUrl}/${object.Key}`
          : '', // Will need signed URL for private access
        size: object.Size || 0,
        contentType: '', // Would need separate HeadObject call to get this
        lastModified: object.LastModified || new Date(),
      }));
    } catch (error) {
      console.error('Failed to list files:', error);
      throw new Error(`Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<{
    size: number;
    contentType: string;
    lastModified: Date;
    metadata: Record<string, string>;
  } | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      return {
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified || new Date(),
        metadata: response.Metadata || {},
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'NotFound') {
        return null;
      }
      console.error('Failed to get file metadata:', error);
      throw new Error(`Failed to get file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    const metadata = await this.getFileMetadata(key);
    return metadata !== null;
  }

  /**
   * Validate tenant access to file
   */
  validateTenantAccess(key: string, tenantId: string): boolean {
    return key.startsWith(`tenants/${tenantId}/`);
  }

  /**
   * Clean up temporary files older than specified age
   */
  async cleanupTempFiles(tenantId: string, olderThanHours: number = 24): Promise<number> {
    try {
      const tempFiles = await this.listFiles(tenantId, 'temp', 1000);
      const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
      
      let deletedCount = 0;
      
      for (const file of tempFiles) {
        if (file.lastModified < cutoffTime) {
          await this.deleteFile(file.key);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
      throw new Error(`Failed to cleanup temp files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const r2Storage = new R2StorageService();