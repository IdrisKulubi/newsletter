import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { assets, type Asset, type NewAsset } from "@/lib/db/schema/assets";
import { getTenantContext } from "@/lib/db/tenant-resolver";
import { r2Storage } from "@/lib/storage";

export interface AssetUploadOptions {
  optimize?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export class AssetService {
  /**
   * Upload asset for newsletter use
   */
  static async uploadAsset(
    file: File,
    category: "image" | "document" = "image",
    options: AssetUploadOptions = {}
  ): Promise<Asset> {
    const tenantContext = await getTenantContext();
    if (!tenantContext) {
      throw new Error("Tenant context not found");
    }

    try {
      // Convert file to buffer
      const buffer = Buffer.from(await file.arrayBuffer());

      // Upload to R2
      const storageFile = await r2Storage.uploadFile(
        tenantContext.id,
        "assets",
        file.name,
        buffer,
        {
          contentType: file.type,
          optimize: options.optimize ?? true,
          maxWidth: options.maxWidth,
          maxHeight: options.maxHeight,
          quality: options.quality,
          metadata: {
            category,
            uploadedFor: "newsletter",
          },
        }
      );

      // Save asset record to database
      const [asset] = await db
        .insert(assets)
        .values({
          tenantId: tenantContext.id,
          filename: storageFile.key.split("/").pop() || file.name,
          originalName: file.name,
          mimeType: storageFile.contentType,
          size: storageFile.size,
          url: storageFile.url,
          category,
          uploadedBy: tenantContext.userId || "system", // Provide fallback for undefined userId
        })
        .returning();

      return asset;
    } catch (error) {
      console.error("Failed to upload asset:", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to upload asset"
      );
    }
  }

  /**
   * Get asset by ID with tenant isolation
   */
  static async getById(id: string): Promise<Asset | null> {
    const tenantContext = await getTenantContext();
    if (!tenantContext) {
      throw new Error("Tenant context not found");
    }

    const [asset] = await db
      .select()
      .from(assets)
      .where(and(eq(assets.id, id), eq(assets.tenantId, tenantContext.id)))
      .limit(1);

    return asset || null;
  }

  /**
   * List assets with filtering
   */
  static async list(
    options: {
      category?: "image" | "document" | "template" | "export";
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    assets: Asset[];
    total: number;
  }> {
    const tenantContext = await getTenantContext();
    if (!tenantContext) {
      throw new Error("Tenant context not found");
    }

    const { category, limit = 50, offset = 0 } = options;

    // Build where conditions
    const whereConditions = [eq(assets.tenantId, tenantContext.id)];

    if (category) {
      whereConditions.push(eq(assets.category, category));
    }

    // Get assets
    const assetList = await db
      .select()
      .from(assets)
      .where(and(...whereConditions))
      .orderBy(desc(assets.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(and(...whereConditions));

    return {
      assets: assetList,
      total: count,
    };
  }

  /**
   * Delete asset
   */
  static async delete(id: string): Promise<void> {
    const tenantContext = await getTenantContext();
    if (!tenantContext) {
      throw new Error("Tenant context not found");
    }

    // Get asset to find storage key
    const asset = await this.getById(id);
    if (!asset) {
      throw new Error("Asset not found");
    }

    try {
      // Extract storage key from URL
      const storageKey = this.extractStorageKey(asset.url);

      // Delete from R2
      if (storageKey) {
        await r2Storage.deleteFile(storageKey);
      }

      // Delete from database
      await db
        .delete(assets)
        .where(and(eq(assets.id, id), eq(assets.tenantId, tenantContext.id)));
    } catch (error) {
      console.error("Failed to delete asset:", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to delete asset"
      );
    }
  }

  /**
   * Get signed URL for private asset access
   */
  static async getSignedUrl(
    id: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const asset = await this.getById(id);
    if (!asset) {
      throw new Error("Asset not found");
    }

    const storageKey = this.extractStorageKey(asset.url);
    if (!storageKey) {
      throw new Error("Invalid asset URL");
    }

    return r2Storage.getSignedUrl(storageKey, { expiresIn });
  }

  /**
   * Optimize existing image asset
   */
  static async optimizeImage(
    id: string,
    options: {
      maxWidth?: number;
      maxHeight?: number;
      quality?: number;
    }
  ): Promise<Asset> {
    const asset = await this.getById(id);
    if (!asset) {
      throw new Error("Asset not found");
    }

    if (!asset.mimeType.startsWith("image/")) {
      throw new Error("Asset is not an image");
    }

    const tenantContext = await getTenantContext();
    if (!tenantContext) {
      throw new Error("Tenant context not found");
    }

    try {
      // Get original file from R2
      const storageKey = this.extractStorageKey(asset.url);
      if (!storageKey) {
        throw new Error("Invalid asset URL");
      }

      // For now, we'll create a new optimized version
      // In a real implementation, you might want to fetch the original and re-optimize
      const optimizedFilename = `optimized_${asset.filename}`;

      // This is a placeholder - in reality you'd fetch the original file,
      // optimize it, and upload the new version
      const [updatedAsset] = await db
        .update(assets)
        .set({
          filename: optimizedFilename,
          updatedAt: new Date(),
        })
        .where(and(eq(assets.id, id), eq(assets.tenantId, tenantContext.id)))
        .returning();

      return updatedAsset;
    } catch (error) {
      console.error("Failed to optimize image:", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to optimize image"
      );
    }
  }

  /**
   * Get asset usage statistics
   */
  static async getUsageStats(): Promise<{
    totalAssets: number;
    totalSize: number;
    byCategory: Record<string, { count: number; size: number }>;
  }> {
    const tenantContext = await getTenantContext();
    if (!tenantContext) {
      throw new Error("Tenant context not found");
    }

    const stats = await db
      .select({
        category: assets.category,
        count: sql<number>`count(*)`,
        totalSize: sql<number>`sum(${assets.size})`,
      })
      .from(assets)
      .where(eq(assets.tenantId, tenantContext.id))
      .groupBy(assets.category);

    const result = {
      totalAssets: 0,
      totalSize: 0,
      byCategory: {} as Record<string, { count: number; size: number }>,
    };

    stats.forEach((stat) => {
      result.totalAssets += stat.count;
      result.totalSize += stat.totalSize || 0;
      result.byCategory[stat.category] = {
        count: stat.count,
        size: stat.totalSize || 0,
      };
    });

    return result;
  }

  /**
   * Extract storage key from asset URL
   */
  private static extractStorageKey(url: string): string | null {
    try {
      // Handle both public URLs and signed URLs
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // Remove leading slash
      return pathname.startsWith("/") ? pathname.slice(1) : pathname;
    } catch {
      return null;
    }
  }

  /**
   * Validate file type for newsletter assets
   */
  static validateFileType(file: File): {
    isValid: boolean;
    error?: string;
  } {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: `File type ${
          file.type
        } is not allowed. Allowed types: ${allowedTypes.join(", ")}`,
      };
    }

    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `File size ${(file.size / 1024 / 1024).toFixed(
          2
        )}MB exceeds the 5MB limit`,
      };
    }

    return { isValid: true };
  }
}

// Import sql function
import { sql } from "drizzle-orm";
