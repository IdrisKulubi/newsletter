'use server';

import { AssetService } from '@/lib/services/asset';

export interface AssetUploadOptions {
  optimize?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export async function uploadAsset(
  formData: FormData,
  category: 'image' | 'document' = 'image',
  options?: AssetUploadOptions
) {
  try {
    const file = formData.get('file') as File;
    if (!file) {
      throw new Error('No file provided');
    }

    const result = await AssetService.uploadAsset(file, category, options);
    return { success: true, data: result };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Upload failed' 
    };
  }
}



export async function getAssetById(id: string) {
  try {
    const asset = await AssetService.getById(id);
    return { success: true, data: asset };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Asset not found' 
    };
  }
}

export async function listAssets(options?: {
  category?: 'image' | 'document';
  limit?: number;
  offset?: number;
}) {
  try {
    const assets = await AssetService.list(options);
    return { success: true, data: assets };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to list assets' 
    };
  }
}

export async function deleteAsset(id: string) {
  try {
    await AssetService.delete(id);
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete asset' 
    };
  }
}

export async function getSignedUrl(id: string, expiresIn?: number) {
  try {
    const url = await AssetService.getSignedUrl(id, expiresIn);
    return { success: true, data: url };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get signed URL' 
    };
  }
}

export async function getAssetUsageStats() {
  try {
    const stats = await AssetService.getUsageStats();
    return { success: true, data: stats };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get usage stats' 
    };
  }
}