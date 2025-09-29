/**
 * Client-safe file validation utilities
 * These functions can be used both on client and server side
 */

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate file type for newsletter assets
 * This is a pure function with no server dependencies
 */
export function validateFileType(file: File): FileValidationResult {
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

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? `.${parts.pop()?.toLowerCase()}` : '';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Check if file is a document
 */
export function isDocumentFile(file: File): boolean {
  const documentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];
  
  return documentTypes.includes(file.type);
}