/**
 * Storage Demo Page
 * Demonstrates Cloudflare R2 storage integration
 */

import { FileUpload } from '@/components/storage/file-upload';

export default function StorageDemoPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">Storage Demo</h1>
          <p className="text-muted-foreground">
            Test the Cloudflare R2 storage integration with tenant isolation
          </p>
        </div>

        <FileUpload />

        <div className="bg-muted/50 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold">Features Demonstrated</h2>
          <ul className="space-y-2 text-sm">
            <li>✅ Tenant-scoped file organization</li>
            <li>✅ Image optimization with Sharp</li>
            <li>✅ File type and size validation</li>
            <li>✅ Secure file access with signed URLs</li>
            <li>✅ Multiple storage categories (assets, templates, temp, exports)</li>
            <li>✅ Error handling and user feedback</li>
          </ul>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100">
            Storage Organization
          </h2>
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
            <div><strong>Path Structure:</strong> <code>tenants/[tenant-id]/[category]/[timestamp]_[filename]</code></div>
            <div><strong>Categories:</strong></div>
            <ul className="ml-4 space-y-1">
              <li><code>assets/</code> - Images and media files (optimized)</li>
              <li><code>templates/</code> - Newsletter templates</li>
              <li><code>exports/</code> - Generated reports and exports</li>
              <li><code>temp/</code> - Temporary files (auto-cleanup)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}