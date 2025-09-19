/**
 * Comprehensive input validation and sanitization utilities
 * Provides type-safe validation schemas and sanitization functions
 */

import { z } from 'zod';

// Common validation patterns
export const commonSchemas = {
  // Email validation with additional security checks
  email: z
    .string()
    .email('Invalid email format')
    .min(5, 'Email too short')
    .max(254, 'Email too long')
    .refine(
      (email) => !email.includes('..'),
      'Email cannot contain consecutive dots'
    )
    .refine(
      (email) => !email.startsWith('.') && !email.endsWith('.'),
      'Email cannot start or end with a dot'
    ),

  // Tenant ID validation
  tenantId: z
    .string()
    .uuid('Invalid tenant ID format')
    .min(1, 'Tenant ID required'),

  // User ID validation
  userId: z
    .string()
    .uuid('Invalid user ID format')
    .min(1, 'User ID required'),

  // Domain validation for tenant domains
  domain: z
    .string()
    .min(3, 'Domain too short')
    .max(253, 'Domain too long')
    .regex(
      /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
      'Invalid domain format'
    )
    .refine(
      (domain) => !domain.includes('..'),
      'Domain cannot contain consecutive dots'
    ),

  // Password validation with security requirements
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character'),

  // Safe text content (prevents XSS)
  safeText: z
    .string()
    .max(10000, 'Text too long')
    .refine(
      (text) => !/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(text),
      'Script tags not allowed'
    )
    .refine(
      (text) => !/javascript:/gi.test(text),
      'JavaScript URLs not allowed'
    )
    .refine(
      (text) => !/on\w+\s*=/gi.test(text),
      'Event handlers not allowed'
    ),

  // Newsletter title validation
  newsletterTitle: z
    .string()
    .min(1, 'Title required')
    .max(200, 'Title too long')
    .trim(),

  // Campaign name validation
  campaignName: z
    .string()
    .min(1, 'Campaign name required')
    .max(100, 'Campaign name too long')
    .trim(),

  // Subject line validation
  subjectLine: z
    .string()
    .min(1, 'Subject line required')
    .max(150, 'Subject line too long')
    .trim(),

  // File name validation
  fileName: z
    .string()
    .min(1, 'File name required')
    .max(255, 'File name too long')
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      'File name can only contain letters, numbers, dots, underscores, and hyphens'
    )
    .refine(
      (name) => !name.startsWith('.') || name.length > 1,
      'Invalid file name'
    ),

  // URL validation
  url: z
    .string()
    .url('Invalid URL format')
    .max(2048, 'URL too long')
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          return ['http:', 'https:'].includes(parsed.protocol);
        } catch {
          return false;
        }
      },
      'Only HTTP and HTTPS URLs are allowed'
    ),

  // Pagination parameters
  pagination: z.object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),

  // Date range validation
  dateRange: z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  }).refine(
    (data) => data.startDate <= data.endDate,
    'Start date must be before or equal to end date'
  ).refine(
    (data) => {
      const daysDiff = Math.abs(data.endDate.getTime() - data.startDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 365;
    },
    'Date range cannot exceed 365 days'
  ),
};

// Newsletter content validation
export const newsletterContentSchema = z.object({
  id: z.string().uuid(),
  tenantId: commonSchemas.tenantId,
  title: commonSchemas.newsletterTitle,
  content: z.array(z.object({
    id: z.string().uuid(),
    type: z.enum(['text', 'image', 'button', 'divider', 'social']),
    content: z.record(z.string(), z.any()),
    styling: z.record(z.string(), z.any()).optional(),
  })).max(50, 'Too many content blocks'),
  template: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  status: z.enum(['draft', 'review', 'approved']),
});

// Campaign validation
export const campaignSchema = z.object({
  id: z.string().uuid(),
  tenantId: commonSchemas.tenantId,
  newsletterId: z.string().uuid(),
  name: commonSchemas.campaignName,
  subjectLine: commonSchemas.subjectLine,
  previewText: z.string().max(150, 'Preview text too long').optional(),
  recipients: z.array(commonSchemas.email).max(10000, 'Too many recipients'),
  scheduledAt: z.coerce.date().optional(),
});

// User registration validation
export const userRegistrationSchema = z.object({
  email: commonSchemas.email,
  password: commonSchemas.password,
  name: z.string().min(1, 'Name required').max(100, 'Name too long').trim(),
  tenantId: commonSchemas.tenantId.optional(),
});

// Tenant creation validation
export const tenantCreationSchema = z.object({
  name: z.string().min(1, 'Tenant name required').max(100, 'Tenant name too long').trim(),
  domain: commonSchemas.domain,
  customDomain: commonSchemas.domain.optional(),
});

// File upload validation
export const fileUploadSchema = z.object({
  fileName: commonSchemas.fileName,
  fileSize: z.number().int().min(1).max(50 * 1024 * 1024), // 50MB max
  fileType: z.string().regex(/^[a-zA-Z0-9]+\/[a-zA-Z0-9\-\+\.]+$/, 'Invalid MIME type'),
  tenantId: commonSchemas.tenantId,
});

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(html: string): string {
  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // Remove event handlers (onclick, onload, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^>\s]+/gi, '');
  
  // Remove potentially dangerous tags
  const dangerousTags = ['iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button'];
  dangerousTags.forEach(tag => {
    const regex = new RegExp(`<${tag}\\b[^>]*>.*?<\\/${tag}>`, 'gi');
    sanitized = sanitized.replace(regex, '');
    const selfClosingRegex = new RegExp(`<${tag}\\b[^>]*\\/>`, 'gi');
    sanitized = sanitized.replace(selfClosingRegex, '');
  });
  
  return sanitized;
}

/**
 * Sanitize text content
 */
export function sanitizeText(text: string): string {
  // Remove null bytes and control characters except newlines and tabs
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Validate and sanitize email address
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Validate file extension against allowed types
 */
export function validateFileExtension(fileName: string, allowedExtensions: string[]): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension ? allowedExtensions.includes(extension) : false;
}

/**
 * Validate MIME type against allowed types
 */
export function validateMimeType(mimeType: string, allowedTypes: string[]): boolean {
  return allowedTypes.includes(mimeType.toLowerCase());
}

/**
 * Generate a safe filename by removing dangerous characters
 */
export function sanitizeFileName(fileName: string): string {
  // Remove path traversal attempts
  let sanitized = fileName.replace(/\.\./g, '');
  
  // Remove or replace dangerous characters
  sanitized = sanitized.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  
  // Limit length
  if (sanitized.length > 255) {
    const extension = sanitized.split('.').pop();
    const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'));
    sanitized = nameWithoutExt.substring(0, 255 - (extension?.length || 0) - 1) + '.' + extension;
  }
  
  return sanitized;
}

/**
 * Validate request origin for CSRF protection
 */
export function validateOrigin(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  
  try {
    const url = new URL(origin);
    return allowedOrigins.some(allowed => {
      if (allowed === url.origin) return true;
      
      // Support wildcard subdomains in format: https://*.domain.com
      if (allowed.includes('://*.')) {
        const [protocol, rest] = allowed.split('://');
        const domain = rest.substring(2); // Remove '*.'
        return url.protocol === `${protocol}:` && 
               (url.hostname.endsWith('.' + domain) || url.hostname === domain);
      }
      
      // Support wildcard subdomains in format: *.domain.com
      if (allowed.startsWith('*.')) {
        const domain = allowed.substring(2);
        return url.hostname.endsWith('.' + domain) || url.hostname === domain;
      }
      
      return false;
    });
  } catch {
    return false;
  }
}

/**
 * Rate limiting key generator
 */
export function generateRateLimitKey(identifier: string, action: string): string {
  return `rate_limit:${action}:${identifier}`;
}

/**
 * Validate IP address format
 */
export function validateIpAddress(ip: string): boolean {
  // IPv4 regex
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  // IPv6 regex (simplified)
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}