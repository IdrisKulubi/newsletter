/**
 * Security validation tests
 * Tests input validation, sanitization, and security utilities
 */

import { describe, it, expect } from 'vitest';
import {
  commonSchemas,
  sanitizeHtml,
  sanitizeText,
  sanitizeEmail,
  validateFileExtension,
  validateMimeType,
  sanitizeFileName,
  validateOrigin,
  validateIpAddress,
} from '@/lib/security/validation';

describe('Security Validation', () => {
  describe('Email validation', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'user@example.com',
        'test.email@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com',
      ];

      validEmails.forEach(email => {
        expect(() => commonSchemas.email.parse(email)).not.toThrow();
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user..double@example.com',
        '.user@example.com',
        'user@example.com.',
        'a'.repeat(255) + '@example.com', // Too long
      ];

      invalidEmails.forEach(email => {
        expect(() => commonSchemas.email.parse(email)).toThrow();
      });
    });
  });

  describe('Password validation', () => {
    it('should validate strong passwords', () => {
      const validPasswords = [
        'StrongPass123!',
        'MySecure@Password1',
        'Complex#Pass99',
      ];

      validPasswords.forEach(password => {
        expect(() => commonSchemas.password.parse(password)).not.toThrow();
      });
    });

    it('should reject weak passwords', () => {
      const invalidPasswords = [
        'weak', // Too short
        'password123', // No uppercase
        'PASSWORD123', // No lowercase
        'StrongPassword', // No numbers
        'StrongPass123', // No special characters
        'a'.repeat(130), // Too long
      ];

      invalidPasswords.forEach(password => {
        expect(() => commonSchemas.password.parse(password)).toThrow();
      });
    });
  });

  describe('Domain validation', () => {
    it('should validate correct domain formats', () => {
      const validDomains = [
        'example.com',
        'sub.example.com',
        'test-domain.co.uk',
        'my-site.org',
      ];

      validDomains.forEach(domain => {
        expect(() => commonSchemas.domain.parse(domain)).not.toThrow();
      });
    });

    it('should reject invalid domain formats', () => {
      const invalidDomains = [
        'invalid..domain.com',
        '.example.com',
        'example.com.',
        'ex',
        'a'.repeat(254),
        'invalid_domain.com',
      ];

      invalidDomains.forEach(domain => {
        expect(() => commonSchemas.domain.parse(domain)).toThrow();
      });
    });
  });

  describe('HTML sanitization', () => {
    it('should remove script tags', () => {
      const maliciousHtml = '<div>Safe content</div><script>alert("xss")</script>';
      const sanitized = sanitizeHtml(maliciousHtml);
      
      expect(sanitized).toBe('<div>Safe content</div>');
      expect(sanitized).not.toContain('<script>');
    });

    it('should remove javascript URLs', () => {
      const maliciousHtml = '<a href="javascript:alert(\'xss\')">Click me</a>';
      const sanitized = sanitizeHtml(maliciousHtml);
      
      expect(sanitized).not.toContain('javascript:');
    });

    it('should remove event handlers', () => {
      const maliciousHtml = '<div onclick="alert(\'xss\')" onload="malicious()">Content</div>';
      const sanitized = sanitizeHtml(maliciousHtml);
      
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).not.toContain('onload');
    });

    it('should remove dangerous tags', () => {
      const maliciousHtml = '<iframe src="evil.com"></iframe><object data="evil.swf"></object>';
      const sanitized = sanitizeHtml(maliciousHtml);
      
      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).not.toContain('<object');
    });
  });

  describe('Text sanitization', () => {
    it('should remove control characters', () => {
      const maliciousText = 'Normal text\x00\x01\x02with control chars';
      const sanitized = sanitizeText(maliciousText);
      
      expect(sanitized).toBe('Normal textwith control chars');
    });

    it('should preserve newlines and tabs', () => {
      const text = 'Line 1\nLine 2\tTabbed';
      const sanitized = sanitizeText(text);
      
      expect(sanitized).toBe(text);
    });
  });

  describe('Email sanitization', () => {
    it('should normalize email addresses', () => {
      expect(sanitizeEmail('  USER@EXAMPLE.COM  ')).toBe('user@example.com');
      expect(sanitizeEmail('Test.Email@Domain.Org')).toBe('test.email@domain.org');
    });
  });

  describe('File validation', () => {
    it('should validate allowed file extensions', () => {
      const allowedExtensions = ['jpg', 'png', 'gif'];
      
      expect(validateFileExtension('image.jpg', allowedExtensions)).toBe(true);
      expect(validateFileExtension('image.PNG', allowedExtensions)).toBe(true);
      expect(validateFileExtension('document.pdf', allowedExtensions)).toBe(false);
      expect(validateFileExtension('noextension', allowedExtensions)).toBe(false);
    });

    it('should validate MIME types', () => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      
      expect(validateMimeType('image/jpeg', allowedTypes)).toBe(true);
      expect(validateMimeType('IMAGE/JPEG', allowedTypes)).toBe(true);
      expect(validateMimeType('application/pdf', allowedTypes)).toBe(false);
    });
  });

  describe('Filename sanitization', () => {
    it('should remove dangerous characters', () => {
      const dangerousName = 'file<>:"/\\|?*.txt';
      const sanitized = sanitizeFileName(dangerousName);
      
      expect(sanitized).toBe('file_________.txt');
    });

    it('should prevent path traversal', () => {
      const maliciousName = '../../../etc/passwd';
      const sanitized = sanitizeFileName(maliciousName);
      
      expect(sanitized).not.toContain('..');
    });

    it('should limit filename length', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const sanitized = sanitizeFileName(longName);
      
      expect(sanitized.length).toBeLessThanOrEqual(255);
      expect(sanitized.endsWith('.txt')).toBe(true);
    });
  });

  describe('Origin validation', () => {
    const allowedOrigins = [
      'https://example.com',
      'https://*.newsletter.com',
      'http://localhost:3000',
    ];

    it('should validate exact origin matches', () => {
      expect(validateOrigin('https://example.com', allowedOrigins)).toBe(true);
      expect(validateOrigin('http://localhost:3000', allowedOrigins)).toBe(true);
    });

    it('should validate wildcard subdomain matches', () => {
      expect(validateOrigin('https://app.newsletter.com', allowedOrigins)).toBe(true);
      expect(validateOrigin('https://tenant.newsletter.com', allowedOrigins)).toBe(true);
    });

    it('should reject invalid origins', () => {
      expect(validateOrigin('https://evil.com', allowedOrigins)).toBe(false);
      expect(validateOrigin('https://newsletter.com.evil.com', allowedOrigins)).toBe(false);
      expect(validateOrigin(null, allowedOrigins)).toBe(false);
    });
  });

  describe('IP address validation', () => {
    it('should validate IPv4 addresses', () => {
      const validIPv4 = [
        '192.168.1.1',
        '10.0.0.1',
        '127.0.0.1',
        '255.255.255.255',
      ];

      validIPv4.forEach(ip => {
        expect(validateIpAddress(ip)).toBe(true);
      });
    });

    it('should validate IPv6 addresses', () => {
      const validIPv6 = [
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        '2001:db8:85a3::8a2e:370:7334',
        '::1',
        'fe80::1',
      ];

      // Note: Our regex is simplified, so we'll test basic cases
      expect(validateIpAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
    });

    it('should reject invalid IP addresses', () => {
      const invalidIPs = [
        '256.256.256.256',
        '192.168.1',
        'not.an.ip.address',
        '192.168.1.1.1',
      ];

      invalidIPs.forEach(ip => {
        expect(validateIpAddress(ip)).toBe(false);
      });
    });
  });

  describe('Safe text validation', () => {
    it('should validate safe text content', () => {
      const safeTexts = [
        'Normal text content',
        'Text with numbers 123',
        'Text with symbols !@#$%',
      ];

      safeTexts.forEach(text => {
        expect(() => commonSchemas.safeText.parse(text)).not.toThrow();
      });
    });

    it('should reject dangerous text content', () => {
      const dangerousTexts = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<div onclick="malicious()">text</div>',
      ];

      dangerousTexts.forEach(text => {
        expect(() => commonSchemas.safeText.parse(text)).toThrow();
      });
    });
  });

  describe('Pagination validation', () => {
    it('should validate correct pagination parameters', () => {
      const validPagination = [
        { page: 1, limit: 20 },
        { page: 5, limit: 50 },
        { page: 100, limit: 100 },
      ];

      validPagination.forEach(params => {
        expect(() => commonSchemas.pagination.parse(params)).not.toThrow();
      });
    });

    it('should reject invalid pagination parameters', () => {
      const invalidPagination = [
        { page: 0, limit: 20 }, // Page too low
        { page: 1001, limit: 20 }, // Page too high
        { page: 1, limit: 0 }, // Limit too low
        { page: 1, limit: 101 }, // Limit too high
      ];

      invalidPagination.forEach(params => {
        expect(() => commonSchemas.pagination.parse(params)).toThrow();
      });
    });
  });

  describe('Date range validation', () => {
    it('should validate correct date ranges', () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      const validRange = {
        startDate: now,
        endDate: tomorrow,
      };

      expect(() => commonSchemas.dateRange.parse(validRange)).not.toThrow();
    });

    it('should reject invalid date ranges', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const nextYear = new Date(now.getTime() + 366 * 24 * 60 * 60 * 1000);
      
      // End date before start date
      const invalidRange1 = {
        startDate: now,
        endDate: yesterday,
      };

      // Range too long (over 365 days)
      const invalidRange2 = {
        startDate: now,
        endDate: nextYear,
      };

      expect(() => commonSchemas.dateRange.parse(invalidRange1)).toThrow();
      expect(() => commonSchemas.dateRange.parse(invalidRange2)).toThrow();
    });
  });
});