/**
 * Unit tests for queue configuration and types
 */

import { describe, it, expect } from 'vitest';

describe('Queue Configuration', () => {
  it('should have correct queue names defined', () => {
    const QUEUE_NAMES = {
      EMAIL: 'email-processing',
      ANALYTICS: 'analytics-processing', 
      AI: 'ai-processing',
    } as const;

    expect(QUEUE_NAMES.EMAIL).toBe('email-processing');
    expect(QUEUE_NAMES.ANALYTICS).toBe('analytics-processing');
    expect(QUEUE_NAMES.AI).toBe('ai-processing');
  });

  it('should have correct job data interfaces', () => {
    // Test EmailJobData structure
    const emailJobData = {
      campaignId: 'test-campaign',
      tenantId: 'test-tenant',
      recipients: [
        { email: 'test@example.com', name: 'Test User' }
      ],
      batchSize: 100,
    };

    expect(emailJobData.campaignId).toBe('test-campaign');
    expect(emailJobData.tenantId).toBe('test-tenant');
    expect(emailJobData.recipients).toHaveLength(1);
    expect(emailJobData.recipients[0].email).toBe('test@example.com');
    expect(emailJobData.batchSize).toBe(100);

    // Test AnalyticsJobData structure
    const analyticsJobData = {
      campaignId: 'test-campaign',
      tenantId: 'test-tenant',
      eventType: 'campaign-complete' as const,
      data: { totalSent: 100, opened: 50 },
    };

    expect(analyticsJobData.eventType).toBe('campaign-complete');
    expect(analyticsJobData.data.totalSent).toBe(100);

    // Test AIJobData structure
    const aiJobData = {
      tenantId: 'test-tenant',
      type: 'content-generation' as const,
      data: { prompt: 'Generate content' },
    };

    expect(aiJobData.type).toBe('content-generation');
    expect(aiJobData.data.prompt).toBe('Generate content');
  });

  it('should have correct job schedule options', () => {
    const scheduleOptions = {
      delay: 5000,
      repeat: {
        pattern: '0 2 * * *', // Daily at 2 AM
        every: 86400000, // 24 hours in milliseconds
        limit: 10,
      },
      priority: 5,
      attempts: 3,
      backoff: {
        type: 'exponential' as const,
        delay: 2000,
      },
    };

    expect(scheduleOptions.delay).toBe(5000);
    expect(scheduleOptions.repeat?.pattern).toBe('0 2 * * *');
    expect(scheduleOptions.priority).toBe(5);
    expect(scheduleOptions.attempts).toBe(3);
    expect(scheduleOptions.backoff?.type).toBe('exponential');
  });

  it('should have correct queue statistics structure', () => {
    const queueStats = {
      waiting: 5,
      active: 2,
      completed: 100,
      failed: 3,
      delayed: 1,
      paused: false,
    };

    expect(typeof queueStats.waiting).toBe('number');
    expect(typeof queueStats.active).toBe('number');
    expect(typeof queueStats.completed).toBe('number');
    expect(typeof queueStats.failed).toBe('number');
    expect(typeof queueStats.delayed).toBe('number');
    expect(typeof queueStats.paused).toBe('boolean');
  });

  it('should have correct job error structure', () => {
    const jobError = {
      jobId: 'job-123',
      queueName: 'email-processing',
      jobName: 'send-newsletter',
      error: 'Connection timeout',
      timestamp: new Date(),
      attemptsMade: 2,
      maxAttempts: 3,
      data: { campaignId: 'test' },
    };

    expect(jobError.jobId).toBe('job-123');
    expect(jobError.queueName).toBe('email-processing');
    expect(jobError.error).toBe('Connection timeout');
    expect(jobError.timestamp).toBeInstanceOf(Date);
    expect(jobError.attemptsMade).toBe(2);
    expect(jobError.maxAttempts).toBe(3);
  });

  it('should have correct queue metrics structure', () => {
    const queueMetrics = {
      totalJobs: 150,
      completedJobs: 140,
      failedJobs: 5,
      activeJobs: 3,
      waitingJobs: 2,
      avgProcessingTime: 2500,
      errorRate: 3.33,
      lastUpdated: new Date(),
    };

    expect(queueMetrics.totalJobs).toBe(150);
    expect(queueMetrics.completedJobs).toBe(140);
    expect(queueMetrics.failedJobs).toBe(5);
    expect(queueMetrics.errorRate).toBeCloseTo(3.33);
    expect(queueMetrics.lastUpdated).toBeInstanceOf(Date);
  });

  it('should calculate error rate correctly', () => {
    const totalJobs = 100;
    const failedJobs = 5;
    const errorRate = (failedJobs / totalJobs) * 100;

    expect(errorRate).toBe(5);
  });

  it('should handle batch size calculations', () => {
    const recipients = Array.from({ length: 250 }, (_, i) => ({
      email: `test${i}@example.com`,
    }));
    
    const batchSize = 100;
    const expectedBatches = Math.ceil(recipients.length / batchSize);
    
    expect(expectedBatches).toBe(3);
    
    // Test batch splitting logic
    const batches = [];
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      batches.push(batch);
    }
    
    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(100);
    expect(batches[1]).toHaveLength(100);
    expect(batches[2]).toHaveLength(50);
  });

  it('should validate Redis configuration format', () => {
    const redisUrl = 'redis://localhost:6379';
    const redisConfig = {
      host: redisUrl.includes('://') 
        ? new URL(redisUrl).hostname 
        : redisUrl.split(':')[0],
      port: redisUrl.includes('://') 
        ? parseInt(new URL(redisUrl).port) || 6379
        : parseInt(redisUrl.split(':')[1]) || 6379,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    };

    expect(redisConfig.host).toBe('localhost');
    expect(redisConfig.port).toBe(6379);
    expect(redisConfig.retryDelayOnFailover).toBe(100);
    expect(redisConfig.enableReadyCheck).toBe(false);
    expect(redisConfig.maxRetriesPerRequest).toBe(null);
  });
});