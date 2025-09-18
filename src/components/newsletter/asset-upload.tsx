'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AssetService } from '@/lib/services/asset';

interface AssetUploadProps {
  tenantId: string;
  onUploadComplete: (url: string, asset?: any) => void;
  accept?: string;
  maxSize?: number;
  category?: 'image' | 'document';
  className?: string;
}

export function AssetUpload({
  tenantId,
  onUploadComplete,
  accept = 'image/*',
  maxSize = 5 * 1024 * 1024, // 5MB
  category = 'image',
  className,
}: AssetUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file
    const validation = AssetService.validateFileType(file);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid file type');
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const asset = await AssetService.uploadAsset(file, category, {
        optimize: category === 'image',
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 85,
      });

      clearInterval(progressInterval);
      setProgress(100);

      // Call the completion handler
      onUploadComplete(asset.url, asset);

      // Reset after a short delay
      setTimeout(() => {
        setProgress(0);
        setUploading(false);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
      setProgress(0);
    }
  }, [tenantId, onUploadComplete, category]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept.split(',').reduce((acc, type) => {
      acc[type.trim()] = [];
      return acc;
    }, {} as Record<string, string[]>),
    maxSize,
    multiple: false,
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={className}>
      <Card>
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
              ${uploading ? 'pointer-events-none opacity-50' : ''}
            `}
          >
            <input {...getInputProps()} />
            
            {uploading ? (
              <div className="space-y-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600 mb-2">Uploading...</p>
                  <Progress value={progress} className="w-full max-w-xs mx-auto" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {category === 'image' ? (
                  <Image className="h-8 w-8 mx-auto text-gray-400" />
                ) : (
                  <FileText className="h-8 w-8 mx-auto text-gray-400" />
                )}
                
                <div>
                  <p className="text-lg font-medium text-gray-900">
                    {isDragActive ? 'Drop the file here' : 'Upload a file'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Drag and drop or click to select
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Max size: {formatFileSize(maxSize)}
                  </p>
                </div>

                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </Button>
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription className="flex items-center justify-between">
                {error}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setError(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface AssetGalleryProps {
  tenantId: string;
  category?: 'image' | 'document';
  onSelectAsset: (asset: any) => void;
  className?: string;
}

export function AssetGallery({
  tenantId,
  category = 'image',
  onSelectAsset,
  className,
}: AssetGalleryProps) {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load assets on mount
  useState(() => {
    loadAssets();
  });

  const loadAssets = async () => {
    try {
      setLoading(true);
      const result = await AssetService.list({ category, limit: 50 });
      setAssets(result.assets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center p-8`}>
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {assets.map((asset) => (
          <Card
            key={asset.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onSelectAsset(asset)}
          >
            <CardContent className="p-2">
              {asset.mimeType.startsWith('image/') ? (
                <img
                  src={asset.url}
                  alt={asset.originalName}
                  className="w-full h-24 object-cover rounded"
                />
              ) : (
                <div className="w-full h-24 bg-gray-100 rounded flex items-center justify-center">
                  <FileText className="h-8 w-8 text-gray-400" />
                </div>
              )}
              <p className="text-xs text-gray-600 mt-2 truncate">
                {asset.originalName}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {assets.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No assets found. Upload some files to get started.
        </div>
      )}
    </div>
  );
}