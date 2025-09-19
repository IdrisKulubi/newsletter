/**
 * Application metrics collection
 * Tracks performance and business metrics
 */

import { config } from '../config';
import { logger } from './logger';

interface MetricData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: Date;
}

class MetricsCollector {
  private enabled: boolean;
  private metrics: MetricData[] = [];

  constructor() {
    this.enabled = config.monitoring.enableMetrics;
  }

  private record(metric: MetricData) {
    if (!this.enabled) return;

    const metricWithTimestamp = {
      ...metric,
      timestamp: metric.timestamp || new Date(),
    };

    this.metrics.push(metricWithTimestamp);

    // Log metric for external collection
    logger.info('Metric Recorded', {
      type: 'metric',
      metric: metricWithTimestamp,
    });

    // Keep only last 1000 metrics in memory
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  // Performance metrics
  recordApiLatency(endpoint: string, method: string, duration: number, statusCode: number) {
    this.record({
      name: 'api_latency',
      value: duration,
      tags: {
        endpoint,
        method,
        status_code: statusCode.toString(),
      },
    });
  }

  recordDatabaseQueryTime(operation: string, duration: number) {
    this.record({
      name: 'database_query_time',
      value: duration,
      tags: {
        operation,
      },
    });
  }

  recordCacheHit(key: string, hit: boolean) {
    this.record({
      name: 'cache_hit_rate',
      value: hit ? 1 : 0,
      tags: {
        cache_key: key,
      },
    });
  }

  // Business metrics
  recordEmailSent(tenantId: string, campaignId: string) {
    this.record({
      name: 'emails_sent',
      value: 1,
      tags: {
        tenant_id: tenantId,
        campaign_id: campaignId,
      },
    });
  }

  recordEmailDelivered(tenantId: string, campaignId: string) {
    this.record({
      name: 'emails_delivered',
      value: 1,
      tags: {
        tenant_id: tenantId,
        campaign_id: campaignId,
      },
    });
  }

  recordEmailOpened(tenantId: string, campaignId: string) {
    this.record({
      name: 'emails_opened',
      value: 1,
      tags: {
        tenant_id: tenantId,
        campaign_id: campaignId,
      },
    });
  }

  recordEmailClicked(tenantId: string, campaignId: string, linkUrl: string) {
    this.record({
      name: 'emails_clicked',
      value: 1,
      tags: {
        tenant_id: tenantId,
        campaign_id: campaignId,
        link_domain: new URL(linkUrl).hostname,
      },
    });
  }

  recordCampaignCreated(tenantId: string) {
    this.record({
      name: 'campaigns_created',
      value: 1,
      tags: {
        tenant_id: tenantId,
      },
    });
  }

  recordUserRegistration(tenantId: string) {
    this.record({
      name: 'users_registered',
      value: 1,
      tags: {
        tenant_id: tenantId,
      },
    });
  }

  recordAITokensUsed(tenantId: string, operation: string, tokens: number) {
    this.record({
      name: 'ai_tokens_used',
      value: tokens,
      tags: {
        tenant_id: tenantId,
        operation,
      },
    });
  }

  recordStorageUsed(tenantId: string, bytes: number) {
    this.record({
      name: 'storage_used_bytes',
      value: bytes,
      tags: {
        tenant_id: tenantId,
      },
    });
  }

  // Error metrics
  recordError(type: string, tenantId?: string) {
    this.record({
      name: 'errors',
      value: 1,
      tags: {
        error_type: type,
        tenant_id: tenantId || 'unknown',
      },
    });
  }

  recordRateLimitHit(endpoint: string, tenantId?: string) {
    this.record({
      name: 'rate_limit_hits',
      value: 1,
      tags: {
        endpoint,
        tenant_id: tenantId || 'unknown',
      },
    });
  }

  // Queue metrics
  recordJobProcessed(queueName: string, jobType: string, duration: number, success: boolean) {
    this.record({
      name: 'job_processed',
      value: duration,
      tags: {
        queue_name: queueName,
        job_type: jobType,
        success: success.toString(),
      },
    });
  }

  recordQueueSize(queueName: string, size: number) {
    this.record({
      name: 'queue_size',
      value: size,
      tags: {
        queue_name: queueName,
      },
    });
  }

  // Get metrics for export
  getMetrics(): MetricData[] {
    return [...this.metrics];
  }

  // Clear metrics (useful for testing)
  clearMetrics() {
    this.metrics = [];
  }
}

export const metrics = new MetricsCollector();