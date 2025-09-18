/**
 * File Upload Component
 * Demonstrates R2 storage integration
 */

'use client';

import { useState } from 'react';
import { uploadImage, uploadFile } from '@/lib/actions/storage/upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface UploadResult {
  success: boolean;
  data?: {
    key: string;
    url: string;
    size: number;
    contentType: string;
  };
  error?: string;
}

export function FileUpload() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
    setResult(null);
  };

  const handleImageUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('maxWidth', '1920');
      formData.append('maxHeight', '1080');
      formData.append('quality', '85');

      const uploadResult = await uploadImage(formData);
      setResult(uploadResult);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (category: 'assets' | 'templates' | 'exports' | 'temp') => {
    if (!selectedFile) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('category', category);

      const uploadResult = await uploadFile(formData);
      setResult(uploadResult);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      });
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>File Upload</CardTitle>
        <CardDescription>
          Upload files to Cloudflare R2 storage with tenant isolation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="file-input">Select File</Label>
          <Input
            id="file-input"
            type="file"
            onChange={handleFileSelect}
            disabled={uploading}
            accept="image/*,.pdf,.doc,.docx,.txt,.csv,.zip"
          />
          {selectedFile && (
            <div className="text-sm text-muted-foreground">
              Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
            </div>
          )}
        </div>

        {uploading && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Uploading...</div>
            <Progress value={undefined} className="w-full" />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleImageUpload}
            disabled={!selectedFile || uploading || !selectedFile.type.startsWith('image/')}
            variant="default"
          >
            Upload as Optimized Image
          </Button>
          <Button
            onClick={() => handleFileUpload('assets')}
            disabled={!selectedFile || uploading}
            variant="outline"
          >
            Upload to Assets
          </Button>
          <Button
            onClick={() => handleFileUpload('templates')}
            disabled={!selectedFile || uploading}
            variant="outline"
          >
            Upload to Templates
          </Button>
          <Button
            onClick={() => handleFileUpload('temp')}
            disabled={!selectedFile || uploading}
            variant="outline"
          >
            Upload to Temp
          </Button>
        </div>

        {result && (
          <Alert variant={result.success ? 'default' : 'destructive'}>
            <AlertDescription>
              {result.success ? (
                <div className="space-y-2">
                  <div className="font-medium">Upload successful!</div>
                  <div className="text-sm space-y-1">
                    <div><strong>Key:</strong> {result.data?.key}</div>
                    <div><strong>Size:</strong> {result.data?.size ? formatFileSize(result.data.size) : 'Unknown'}</div>
                    <div><strong>Type:</strong> {result.data?.contentType}</div>
                    {result.data?.url && (
                      <div>
                        <strong>URL:</strong>{' '}
                        <a 
                          href={result.data.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline break-all"
                        >
                          {result.data.url}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-medium">Upload failed</div>
                  <div className="text-sm">{result.error}</div>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}