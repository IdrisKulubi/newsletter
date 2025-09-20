/**
 * Security headers and CSRF protection utilities
 * Implements comprehensive security headers and CSRF token validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

/**
 * Security headers configuration
 */
export const SECURITY_HEADERS = {
  // Prevent clickjacking attacks
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Enable XSS protection
  'X-XSS-Protection': '1; mode=block',
  
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Permissions policy (formerly Feature Policy)
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
  ].join(', '),
  
  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "media-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; '),
  
  // Strict Transport Security (HTTPS only)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
} as const;

/**
 * Development-specific security headers (more permissive)
 */
export const DEV_SECURITY_HEADERS = {
  ...SECURITY_HEADERS,
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: https: blob:",
    "media-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
} as const;

/**
 * Apply security headers to a response
 */
export function applySecurityHeaders(
  response: NextResponse,
  isDevelopment = false
): NextResponse {
  const headersToApply = isDevelopment ? DEV_SECURITY_HEADERS : SECURITY_HEADERS;
  
  Object.entries(headersToApply).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

/**
 * CSRF token management
 */
export class CSRFProtection {
  private static readonly TOKEN_LENGTH = 32;
  private static readonly HEADER_NAME = 'x-csrf-token';
  private static readonly COOKIE_NAME = 'csrf-token';
  private static readonly COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 60 * 60 * 24, // 24 hours
  };
  
  /**
   * Generate a new CSRF token using Web Crypto API
   */
  static generateToken(): string {
    const array = new Uint8Array(this.TOKEN_LENGTH);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  /**
   * Set CSRF token in response cookies
   */
  static setTokenCookie(response: NextResponse, token?: string): string {
    const csrfToken = token || this.generateToken();
    
    response.cookies.set(this.COOKIE_NAME, csrfToken, this.COOKIE_OPTIONS);
    
    return csrfToken;
  }
  
  /**
   * Get CSRF token from request cookies
   */
  static getTokenFromCookies(request: NextRequest): string | null {
    return request.cookies.get(this.COOKIE_NAME)?.value || null;
  }
  
  /**
   * Get CSRF token from request headers
   */
  static getTokenFromHeaders(request: NextRequest): string | null {
    return request.headers.get(this.HEADER_NAME) || null;
  }
  
  /**
   * Validate CSRF token
   */
  static validateToken(request: NextRequest): boolean {
    const cookieToken = this.getTokenFromCookies(request);
    const headerToken = this.getTokenFromHeaders(request);
    
    if (!cookieToken || !headerToken) {
      return false;
    }
    
    // Use constant-time comparison to prevent timing attacks
    return this.constantTimeCompare(cookieToken, headerToken);
  }
  
  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private static constantTimeCompare(a: string | null, b: string | null): boolean {
    // Handle null/undefined cases
    if (!a || !b) {
      return false;
    }
    
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }
  
  /**
   * Middleware for CSRF protection
   */
  static middleware() {
    return (request: NextRequest): NextResponse | null => {
      const { method } = request;
      const { pathname } = request.nextUrl;
      
      // Skip CSRF protection for safe methods and certain paths
      if (
        ['GET', 'HEAD', 'OPTIONS'].includes(method) ||
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/api/webhooks') ||
        pathname.startsWith('/_next')
      ) {
        return null;
      }
      
      // Validate CSRF token for state-changing requests
      if (!this.validateToken(request)) {
        return NextResponse.json(
          { error: 'Invalid CSRF token' },
          { status: 403 }
        );
      }
      
      return null;
    };
  }
}

/**
 * Origin validation for additional CSRF protection
 */
export function validateOrigin(request: NextRequest, allowedOrigins: string[]): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  // Check origin header first
  if (origin) {
    return allowedOrigins.some(allowed => {
      if (allowed === origin) return true;
      
      // Support wildcard subdomains in format: https://*.domain.com
      if (allowed.includes('://*.')) {
        const [protocol, rest] = allowed.split('://');
        const domain = rest.substring(2); // Remove '*.'
        try {
          const url = new URL(origin);
          return url.protocol === `${protocol}:` && 
                 (url.hostname.endsWith('.' + domain) || url.hostname === domain);
        } catch {
          return false;
        }
      }
      
      // Support wildcard subdomains in format: *.domain.com
      if (allowed.startsWith('*.')) {
        const domain = allowed.substring(2);
        try {
          const url = new URL(origin);
          return url.hostname.endsWith('.' + domain) || url.hostname === domain;
        } catch {
          return false;
        }
      }
      
      return false;
    });
  }
  
  // Fallback to referer header
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      return allowedOrigins.includes(refererUrl.origin);
    } catch {
      return false;
    }
  }
  
  return false;
}

/**
 * Get allowed origins based on environment
 */
export function getAllowedOrigins(): string[] {
  const baseOrigins = [
    process.env.APP_URL || 'http://localhost:3000',
  ];
  
  // Add production domains
  if (process.env.NODE_ENV === 'production') {
    baseOrigins.push(
      'https://newsletter.com',
      'https://*.newsletter.com'
    );
  }
  
  // Add custom domains from environment
  const customDomains = process.env.ALLOWED_ORIGINS?.split(',') || [];
  baseOrigins.push(...customDomains);
  
  return baseOrigins;
}

/**
 * Security middleware that applies headers and CSRF protection
 */
export function securityMiddleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  
  // Apply security headers
  applySecurityHeaders(response, process.env.NODE_ENV === 'development');
  
  // Set CSRF token for new sessions
  if (!CSRFProtection.getTokenFromCookies(request)) {
    CSRFProtection.setTokenCookie(response);
  }
  
  // Validate origin for state-changing requests
  const { method } = request;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const allowedOrigins = getAllowedOrigins();
    if (!validateOrigin(request, allowedOrigins)) {
      return NextResponse.json(
        { error: 'Invalid origin' },
        { status: 403 }
      );
    }
  }
  
  return response;
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: NextRequest): string {
  // Check various headers for the real IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (cfConnectingIP) return cfConnectingIP;
  if (realIP) return realIP;
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }
  
  // Fallback to request ip if available (Vercel specific)
  // The 'ip' property is not part of the standard NextRequest type,
  // but is available on Vercel.
  return (request as any).ip || 'unknown';
}

/**
 * Server-side CSRF token utilities for Server Actions
 */
export async function getCSRFToken(): Promise<string | null> {
  try {
    const headersList = await headers();
    return headersList.get('x-csrf-token') || null;
  } catch {
    return null;
  }
}

/**
 * Validate CSRF token in Server Actions
 */
export async function validateCSRFToken(): Promise<boolean> {
  try {
    const headersList = await headers();
    const cookieHeader = headersList.get('cookie');
    const csrfHeader = headersList.get('x-csrf-token');
    
    if (!cookieHeader || !csrfHeader) {
      return false;
    }
    
    // Parse CSRF token from cookies
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, string>);
    
    const cookieToken = cookies['csrf-token'];
    
    if (!cookieToken) {
      return false;
    }
    
    // Use constant-time comparison - create a helper function since we can't access private method
    return constantTimeCompare(cookieToken, csrfHeader);
  } catch {
    return false;
  }
}

/**
 * Helper function for constant-time string comparison
 */
function constantTimeCompare(a: string | null, b: string | null): boolean {
  // Handle null/undefined cases
  if (!a || !b) {
    return false;
  }
  
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}