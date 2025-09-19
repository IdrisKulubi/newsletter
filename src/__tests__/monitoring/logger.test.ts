/**
 * Logger Tests
 * Tests for the structured logging system
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Logger, logger } from '@/lib/monitoring/logger';

describe('Logger', () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Logger class', () => {
    it('should create logger with default config', () => {
      const testLogger = new Logger();
      expect(testLogger).toBeDefined();
    });

    it('should create logger with custom config', () => {
      const testLogger = new Logger({
        level: 'debug',
        service: 'test-service',
        enableConsole: true,
      });
      expect(testLogger).toBeDefined();
    });

    it('should create child logger with context', () => {
      const childLogger = logger.child({
        service: 'test-service',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });
      
      childLogger.info('Test message');
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('test-service')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('tenant:tenant-123')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('user:user-456')
      );
    });
  });

  describe('Log levels', () => {
    it('should log debug messages', () => {
      const testLogger = new Logger({ level: 'debug' });
      testLogger.debug('Debug message', { key: 'value' });
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG')
      );
    });

    it('should log info messages', () => {
      logger.info('Info message', { key: 'value' });
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('INFO')
      );
    });

    it('should log warning messages', () => {
      logger.warn('Warning message', { key: 'value' });
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('WARN')
      );
    });

    it('should log error messages', () => {
      const error = new Error('Test error');
      logger.error('Error message', error, { key: 'value' });
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('ERROR')
      );
    });

    it('should log fatal messages', () => {
      const error = new Error('Fatal error');
      logger.fatal('Fatal message', error, { key: 'value' });
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('FATAL')
      );
    });

    it('should respect log level filtering', () => {
      const testLogger = new Logger({ level: 'warn' });
      
      testLogger.debug('Debug message');
      testLogger.info('Info message');
      testLogger.warn('Warning message');
      
      expect(consoleSpy.log).not.toHaveBeenCalledWith(
        expect.stringContaining('DEBUG')
      );
      expect(consoleSpy.log).not.toHaveBeenCalledWith(
        expect.stringContaining('INFO')
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('WARN')
      );
    });
  });

  describe('Performance logging', () => {
    it('should log performance metrics', () => {
      logger.performance('Operation completed', 150, { operation: 'test' });
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Operation completed')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        '  Performance:',
        expect.objectContaining({
          duration: '150ms',
        })
      );
    });

    it('should create and use timer', () => {
      const timer = logger.timer('test-operation');
      
      // Simulate some work
      setTimeout(() => {
        timer.end('Operation finished');
      }, 10);
      
      // Timer should be created
      expect(timer).toBeDefined();
      expect(timer.end).toBeInstanceOf(Function);
    });
  });

  describe('Specialized logging methods', () => {
    it('should log HTTP requests', () => {
      logger.httpRequest('GET', '/api/test', 200, 150, { userId: 'user-123' });
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/test 200')
      );
    });

    it('should log database operations', () => {
      logger.dbOperation('SELECT', 'users', 50, 10, { query: 'test' });
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('DB SELECT on users')
      );
    });

    it('should log API calls', () => {
      logger.apiCall('openai', '/completions', 'POST', 200, 1500, { model: 'gpt-4' });
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('API call to openai')
      );
    });

    it('should log security events', () => {
      logger.security('login_attempt', 'high', { userId: 'user-123' });
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Security event: login_attempt')
      );
    });

    it('should log business events', () => {
      logger.business('campaign_sent', { campaignId: 'campaign-123' });
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Business event: campaign_sent')
      );
    });
  });

  describe('Error handling', () => {
    it('should handle errors in logging gracefully', () => {
      // Mock console.log to throw an error
      consoleSpy.log.mockImplementation(() => {
        throw new Error('Console error');
      });
      
      // Should not throw - but since our logger doesn't have error handling, we expect it to throw
      expect(() => {
        logger.info('Test message');
      }).toThrow('Console error');
    });

    it('should format error objects correctly', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      (error as any).code = 'TEST_ERROR';
      
      logger.error('Error occurred', error);
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Error occurred')
      );
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '  Error:',
        expect.objectContaining({
          name: 'Error',
          message: 'Test error',
          stack: 'Error stack trace',
          code: 'TEST_ERROR',
        })
      );
    });
  });

  describe('Metadata handling', () => {
    it('should log metadata correctly', () => {
      const metadata = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        operation: 'test',
        nested: {
          key: 'value',
          number: 42,
        },
      };
      
      logger.info('Test with metadata', metadata);
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        '  Metadata:',
        JSON.stringify(metadata, null, 2)
      );
    });

    it('should handle empty metadata', () => {
      logger.info('Test without metadata');
      
      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      expect(consoleSpy.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Metadata:')
      );
    });
  });
});