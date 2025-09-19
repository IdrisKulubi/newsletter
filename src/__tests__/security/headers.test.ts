/**
 * Security headers tests
 * Tests security headers and CSRF protection functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
  applySecurityHeaders,
  CSRFProtection,
  validateOrigin,
  getAllowedOrigins,
  getClientIP,
  SECURITY_HEADERS,
  DEV_SECURITY_HEADERS,
} from '@/lib/security/headers';

// Mock Next.js
vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    next: vi.fn(() => ({
      headers: new Map(),
      cookies: {
        set: vi.fn(),
        get: vi.fn(),
      },
    })),
    json: vi.fn((data, init) => ({
      ...init,
      json: data,
    })),
  },
}));

describe('Security Headers', () => {
  let mockResponse: any;

  beforeEach(() => {
    mockResponse = {
      headers: new Map(),
      cookies: {
        set: vi.fn(),
        get: vi.fn(),
      },
    };
    vi.clearAllMocks();
  });

  describe('applySecurityHeaders', () => {
    it('should apply production security headers', () => {
      const response = applySecurityHeaders(mockResponse as NextResponse, false);

      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.get('Strict-Transport-Security')).toBe(
        'max-age=31536000; includeSubDomains; preload'
      );
    });

    it('should apply development security headers', () => {
      const response = applySecurityHeaders(mockResponse as NextResponse, true);

      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('Content-Security-Policy')).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    });

    it('should include Content Security Policy', () => {
      const response = applySecurityHeaders(mockResponse as NextResponse, false);
      const csp = response.headers.get('Content-Security-Policy');

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it('should include Permissions Policy', () => {
      const response = applySecurityHeaders(mockResponse as NextResponse, false);
      const permissionsPolicy = response.headers.get('Permissions-Policy');

      expect(permissionsPolicy).toContain('camera=()');
      expect(permissionsPolicy).toContain('microphone=()');
      expect(permissionsPolicy).toContain('geolocation=()');
    });
  });

  describe('CSRF Protection', () => {
    let mockRequest: any;

    beforeEach(() => {
      mockRequest = {
        nextUrl: { method: 'POST', pathname: '/api/test' },
        headers: new Map(),
        cookies: new Map(),
      };
    });

    describe('generateToken', () => {
      it('should generate a valid CSRF token', () => {
        const token = CSRFProtection.generateToken();

        expect(token).toHaveLength(64); // 32 bytes * 2 (hex)
        expect(token).toMatch(/^[a-f0-9]+$/);
      });

      it('should generate unique tokens', () => {
        const token1 = CSRFProtection.generateToken();
        const token2 = CSRFProtection.generateToken();

        expect(token1).not.toBe(token2);
      });
    });

    describe('setTokenCookie', () => {
      it('should set CSRF token cookie', () => {
        const token = CSRFProtection.setTokenCookie(mockResponse);

        expect(mockResponse.cookies.set).toHaveBeenCalledWith(
          'csrf-token',
          token,
          expect.objectContaining({
            httpOnly: true,
            sameSite: 'strict',
            maxAge: 60 * 60 * 24,
          })
        );
      });

      it('should use provided token', () => {
        const customToken = 'custom-token-123';
        const returnedToken = CSRFProtection.setTokenCookie(mockResponse, customToken);

        expect(returnedToken).toBe(customToken);
        expect(mockResponse.cookies.set).toHaveBeenCalledWith(
          'csrf-token',
          customToken,
          expect.any(Object)
        );
      });
    });

    describe('getTokenFromCookies', () => {
      it('should extract CSRF token from cookies', () => {
        const testToken = 'test-csrf-token';
        mockRequest.cookies.set('csrf-token', { value: testToken });

        const token = CSRFProtection.getTokenFromCookies(mockRequest);

        expect(token).toBe(testToken);
      });

      it('should return null if no token cookie', () => {
        const token = CSRFProtection.getTokenFromCookies(mockRequest);

        expect(token).toBeNull();
      });
    });

    describe('getTokenFromHeaders', () => {
      it('should extract CSRF token from headers', () => {
        const testToken = 'test-csrf-token';
        mockRequest.headers.set('x-csrf-token', testToken);

        const token = CSRFProtection.getTokenFromHeaders(mockRequest);

        expect(token).toBe(testToken);
      });

      it('should return null if no token header', () => {
        const token = CSRFProtection.getTokenFromHeaders(mockRequest);

        expect(token).toBe(null);
      });
    });

    describe('validateToken', () => {
      it('should validate matching tokens', () => {
        const testToken = 'test-csrf-token';
        mockRequest.cookies.set('csrf-token', { value: testToken });
        mockRequest.headers.set('x-csrf-token', testToken);

        const isValid = CSRFProtection.validateToken(mockRequest);

        expect(isValid).toBe(true);
      });

      it('should reject mismatched tokens', () => {
        mockRequest.cookies.set('csrf-token', { value: 'token1' });
        mockRequest.headers.set('x-csrf-token', 'token2');

        const isValid = CSRFProtection.validateToken(mockRequest);

        expect(isValid).toBe(false);
      });

      it('should reject missing cookie token', () => {
        mockRequest.headers.set('x-csrf-token', 'test-token');

        const isValid = CSRFProtection.validateToken(mockRequest);

        expect(isValid).toBe(false);
      });

      it('should reject missing header token', () => {
        mockRequest.cookies.set('csrf-token', { value: 'test-token' });

        const isValid = CSRFProtection.validateToken(mockRequest);

        expect(isValid).toBe(false);
      });
    });

    describe('middleware', () => {
      it('should skip CSRF protection for safe methods', () => {
        mockRequest.nextUrl.method = 'GET';

        const middleware = CSRFProtection.middleware();
        const result = middleware(mockRequest);

        expect(result).toBeNull();
      });

      it('should skip CSRF protection for auth routes', () => {
        mockRequest.nextUrl.pathname = '/api/auth/signin';

        const middleware = CSRFProtection.middleware();
        const result = middleware(mockRequest);

        expect(result).toBeNull();
      });

      it('should skip CSRF protection for webhook routes', () => {
        mockRequest.nextUrl.pathname = '/api/webhooks/stripe';

        const middleware = CSRFProtection.middleware();
        const result = middleware(mockRequest);

        expect(result).toBeNull();
      });

      it('should validate CSRF token for state-changing requests', () => {
        mockRequest.nextUrl.method = 'POST';
        mockRequest.nextUrl.pathname = '/api/campaigns';

        const middleware = CSRFProtection.middleware();
        const result = middleware(mockRequest);

        expect(result).toBeTruthy();
        expect(result.status).toBe(403);
      });
    });
  });

  describe('Origin validation', () => {
    let mockRequest: any;

    beforeEach(() => {
      mockRequest = {
        headers: new Map(),
      };
    });

    it('should validate exact origin matches', () => {
      const allowedOrigins = ['https://example.com', 'http://localhost:3000'];
      mockRequest.headers.set('origin', 'https://example.com');

      const isValid = validateOrigin(mockRequest, allowedOrigins);

      expect(isValid).toBe(true);
    });

    it('should validate wildcard subdomain matches', () => {
      const allowedOrigins = ['https://*.newsletter.com'];
      mockRequest.headers.set('origin', 'https://app.newsletter.com');

      const isValid = validateOrigin(mockRequest, allowedOrigins);

      expect(isValid).toBe(true);
    });

    it('should reject invalid origins', () => {
      const allowedOrigins = ['https://example.com'];
      mockRequest.headers.set('origin', 'https://evil.com');

      const isValid = validateOrigin(mockRequest, allowedOrigins);

      expect(isValid).toBe(false);
    });

    it('should fallback to referer header', () => {
      const allowedOrigins = ['https://example.com'];
      mockRequest.headers.set('referer', 'https://example.com/page');

      const isValid = validateOrigin(mockRequest, allowedOrigins);

      expect(isValid).toBe(true);
    });

    it('should reject requests without origin or referer', () => {
      const allowedOrigins = ['https://example.com'];

      const isValid = validateOrigin(mockRequest, allowedOrigins);

      expect(isValid).toBe(false);
    });
  });

  describe('getAllowedOrigins', () => {
    it('should include default origins', () => {
      const origins = getAllowedOrigins();

      expect(origins).toContain('http://localhost:3000');
    });

    it('should include production domains in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const origins = getAllowedOrigins();

      expect(origins).toContain('https://newsletter.com');
      expect(origins).toContain('https://*.newsletter.com');

      process.env.NODE_ENV = originalEnv;
    });

    it('should include custom domains from environment', () => {
      const originalOrigins = process.env.ALLOWED_ORIGINS;
      process.env.ALLOWED_ORIGINS = 'https://custom1.com,https://custom2.com';

      const origins = getAllowedOrigins();

      expect(origins).toContain('https://custom1.com');
      expect(origins).toContain('https://custom2.com');

      process.env.ALLOWED_ORIGINS = originalOrigins;
    });
  });

  describe('getClientIP', () => {
    let mockRequest: any;

    beforeEach(() => {
      mockRequest = {
        headers: new Map(),
        ip: undefined,
      };
    });

    it('should extract IP from Cloudflare header', () => {
      mockRequest.headers.set('cf-connecting-ip', '192.168.1.1');

      const ip = getClientIP(mockRequest);

      expect(ip).toBe('192.168.1.1');
    });

    it('should extract IP from X-Real-IP header', () => {
      mockRequest.headers.set('x-real-ip', '192.168.1.2');

      const ip = getClientIP(mockRequest);

      expect(ip).toBe('192.168.1.2');
    });

    it('should extract IP from X-Forwarded-For header', () => {
      mockRequest.headers.set('x-forwarded-for', '192.168.1.3, 10.0.0.1');

      const ip = getClientIP(mockRequest);

      expect(ip).toBe('192.168.1.3');
    });

    it('should fallback to request IP', () => {
      mockRequest.ip = '192.168.1.4';

      const ip = getClientIP(mockRequest);

      expect(ip).toBe('192.168.1.4');
    });

    it('should return unknown if no IP available', () => {
      const ip = getClientIP(mockRequest);

      expect(ip).toBe('unknown');
    });

    it('should prioritize Cloudflare IP over others', () => {
      mockRequest.headers.set('cf-connecting-ip', '192.168.1.1');
      mockRequest.headers.set('x-real-ip', '192.168.1.2');
      mockRequest.headers.set('x-forwarded-for', '192.168.1.3');
      mockRequest.ip = '192.168.1.4';

      const ip = getClientIP(mockRequest);

      expect(ip).toBe('192.168.1.1');
    });
  });

  describe('Security header constants', () => {
    it('should have proper production security headers', () => {
      expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
      expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
      expect(SECURITY_HEADERS['X-XSS-Protection']).toBe('1; mode=block');
      expect(SECURITY_HEADERS['Strict-Transport-Security']).toContain('max-age=31536000');
    });

    it('should have proper development security headers', () => {
      expect(DEV_SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
      expect(DEV_SECURITY_HEADERS['Content-Security-Policy']).toContain("'unsafe-inline'");
      expect(DEV_SECURITY_HEADERS['Content-Security-Policy']).toContain("'unsafe-eval'");
    });

    it('should have restrictive CSP in production', () => {
      const csp = SECURITY_HEADERS['Content-Security-Policy'];
      
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("upgrade-insecure-requests");
    });

    it('should have permissive CSP in development', () => {
      const csp = DEV_SECURITY_HEADERS['Content-Security-Policy'];
      
      expect(csp).toContain("'unsafe-inline'");
      expect(csp).toContain("'unsafe-eval'");
      expect(csp).not.toContain("upgrade-insecure-requests");
    });
  });
});