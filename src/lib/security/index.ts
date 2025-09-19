/**
 * Security module exports
 * Centralized exports for all security utilities
 */

// Validation utilities
export * from './validation';

// Rate limiting
export * from './rate-limiting';

// Security headers and CSRF protection
export * from './headers';

// Re-export commonly used functions with shorter names
export {
  checkRateLimit as rateLimit,
  rateLimiter,
} from './rate-limiting';

export {
  sanitizeHtml,
  sanitizeText,
  sanitizeEmail,
  sanitizeFileName,
  validateOrigin,
  validateIpAddress,
  commonSchemas as schemas,
} from './validation';

export {
  applySecurityHeaders,
  CSRFProtection,
  getClientIP,
  validateOrigin as validateRequestOrigin,
  getAllowedOrigins,
} from './headers';