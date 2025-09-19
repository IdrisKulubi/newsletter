/**
 * Performance Monitoring System
 * Tracks application performance metrics, response times, and resource usage
 */

import { logger } from './logger';

export interface PerformanceMetric {
  id: string;
  timestamp: Date;
  type: MetricType;
  name: string;
  value: number;
  unit: string;
  tags: Record<string, string>;
  tenantId?: string;
  userId?: string;
  requestId?: string;
}

export type MetricType = 
  | 'response_time'
  | 'database_query'
  | 'external_api'
  | 'memory_usage'
  | 'cpu_usage'
  | 'cache_hit_rate'
  | 'throughput'
  | 'error_rate'
  | 'queue_processing'
  | 'file_upload'
  | 'email_delivery';

export interface PerformanceAlert {
  id: string;
  timestamp: Date;
  metric: string;
  threshold: number;
  actualValue: number;
  severity: 'warning' | 'critical';
  message: string;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface PerformanceStats {
  metric: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  unit: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private maxMetrics = 50000; // Keep last 50k metrics
  private maxAlerts = 1000;
  
  // Performance thresholds
  private thresholds: Record<string, { warning: number; critical: number; unit: string }> = {
    'response_time': { warning: 1000, critical: 3000, unit: 'ms' },
    'database_query': { warning: 500, critical: 2000, unit: 'ms' },
    'external_api': { warning: 2000, critical: 5000, unit: 'ms' },
    'memory_usage': { warning: 75, critical: 90, unit: '%' },
    'cpu_usage': { warning: 80, critical: 95, unit: '%' },
    'cache_hit_rate': { warning: 80, critical: 60, unit: '%' }, // Lower is worse for cache hit rate
    'error_rate': { warning: 5, critical: 10, unit: '%' },
    'queue_processing': { warning: 30000, critical: 60000, unit: 'ms' },
    'file_upload': { warning: 10000, critical: 30000, unit: 'ms' },
    'email_delivery': { warning: 5000, critical: 15000, unit: 'ms' },
  };

  /**
   * Record a performance metric
   */
  recordMetric(
    type: MetricType,
    name: string,
    value: number,
    unit: string,
    tags: Record<string, string> = {},
    context?: {
      tenantId?: string;
      userId?: string;
      requestId?: string;
    }
  ): void {
    const metric: PerformanceMetric = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type,
      name,
      value,
      unit,
      tags,
      tenantId: context?.tenantId,
      userId: context?.userId,
      requestId: context?.requestId,
    };

    // Store metric
    this.metrics.push(metric);
    
    // Maintain metrics limit
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Check for threshold violations
    this.checkThresholds(metric);

    // Log performance metric
    logger.performance(`${type}: ${name}`, value, {
      unit,
      tags,
      ...context,
    });
  }

  /**
   * Check if metric violates thresholds
   */
  private checkThresholds(metric: PerformanceMetric): void {
    const threshold = this.thresholds[metric.name] || this.thresholds[metric.type];
    if (!threshold) return;

    let severity: 'warning' | 'critical' | null = null;
    let exceeded = false;

    // Special handling for cache hit rate (lower is worse)
    if (metric.type === 'cache_hit_rate') {
      if (metric.value < threshold.critical) {
        severity = 'critical';
        exceeded = true;
      } else if (metric.value < threshold.warning) {
        severity = 'warning';
        exceeded = true;
      }
    } else {
      // Normal case (higher is worse)
      if (metric.value > threshold.critical) {
        severity = 'critical';
        exceeded = true;
      } else if (metric.value > threshold.warning) {
        severity = 'warning';
        exceeded = true;
      }
    }

    if (exceeded && severity) {
      this.createAlert(metric, threshold, severity);
    }
  }

  /**
   * Create performance alert
   */
  private createAlert(
    metric: PerformanceMetric,
    threshold: { warning: number; critical: number; unit: string },
    severity: 'warning' | 'critical'
  ): void {
    const thresholdValue = severity === 'critical' ? threshold.critical : threshold.warning;
    
    const alert: PerformanceAlert = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      metric: metric.name,
      threshold: thresholdValue,
      actualValue: metric.value,
      severity,
      message: this.generateAlertMessage(metric, thresholdValue, severity),
      resolved: false,
    };

    this.alerts.push(alert);
    
    // Maintain alerts limit
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.shift();
    }

    // Log alert
    logger.warn(`Performance alert: ${alert.message}`, {
      alertId: alert.id,
      metric: metric.name,
      threshold: thresholdValue,
      actualValue: metric.value,
      severity,
      tenantId: metric.tenantId,
    });
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(
    metric: PerformanceMetric,
    threshold: number,
    severity: 'warning' | 'critical'
  ): string {
    const comparison = metric.type === 'cache_hit_rate' ? 'below' : 'above';
    return `${metric.name} ${comparison} ${severity} threshold: ${metric.value}${metric.unit} (threshold: ${threshold}${metric.unit})`;
  }

  /**
   * Create a timer for measuring operation duration
   */
  timer(
    type: MetricType,
    name: string,
    tags: Record<string, string> = {},
    context?: {
      tenantId?: string;
      userId?: string;
      requestId?: string;
    }
  ): {
    end: () => void;
  } {
    const start = Date.now();
    
    return {
      end: () => {
        const duration = Date.now() - start;
        this.recordMetric(type, name, duration, 'ms', tags, context);
      },
    };
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: {
      tenantId?: string;
      userId?: string;
      requestId?: string;
    }
  ): void {
    this.recordMetric(
      'response_time',
      'http_request',
      duration,
      'ms',
      {
        method,
        path,
        status_code: statusCode.toString(),
        status_class: `${Math.floor(statusCode / 100)}xx`,
      },
      context
    );
  }

  /**
   * Record database query metrics
   */
  recordDatabaseQuery(
    operation: string,
    table: string,
    duration: number,
    rowsAffected?: number,
    context?: {
      tenantId?: string;
      userId?: string;
      requestId?: string;
    }
  ): void {
    const tags: Record<string, string> = {
      operation,
      table,
    };
    
    if (rowsAffected !== undefined) {
      tags.rows_affected = rowsAffected.toString();
    }

    this.recordMetric('database_query', `db_${operation}`, duration, 'ms', tags, context);
  }

  /**
   * Record external API call metrics
   */
  recordExternalApiCall(
    service: string,
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    context?: {
      tenantId?: string;
      userId?: string;
      requestId?: string;
    }
  ): void {
    this.recordMetric(
      'external_api',
      `api_${service}`,
      duration,
      'ms',
      {
        service,
        endpoint,
        method,
        status_code: statusCode.toString(),
      },
      context
    );
  }

  /**
   * Record system resource metrics
   */
  recordSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Memory usage percentage
    const memoryPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    this.recordMetric('memory_usage', 'heap_usage', memoryPercent, '%');

    // CPU usage (simplified)
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    this.recordMetric('cpu_usage', 'cpu_time', cpuPercent, 's');

    // Memory details
    this.recordMetric('memory_usage', 'heap_used', memUsage.heapUsed / 1024 / 1024, 'MB');
    this.recordMetric('memory_usage', 'heap_total', memUsage.heapTotal / 1024 / 1024, 'MB');
    this.recordMetric('memory_usage', 'external', memUsage.external / 1024 / 1024, 'MB');
    this.recordMetric('memory_usage', 'rss', memUsage.rss / 1024 / 1024, 'MB');
  }

  /**
   * Record cache metrics
   */
  recordCacheMetrics(
    operation: 'hit' | 'miss',
    cacheType: string,
    context?: {
      tenantId?: string;
      userId?: string;
      requestId?: string;
    }
  ): void {
    this.recordMetric(
      'cache_hit_rate',
      `cache_${operation}`,
      operation === 'hit' ? 1 : 0,
      'count',
      { cache_type: cacheType, operation },
      context
    );
  }

  /**
   * Record queue processing metrics
   */
  recordQueueProcessing(
    queueName: string,
    jobType: string,
    duration: number,
    success: boolean,
    context?: {
      tenantId?: string;
      userId?: string;
      requestId?: string;
    }
  ): void {
    this.recordMetric(
      'queue_processing',
      `queue_${queueName}`,
      duration,
      'ms',
      {
        queue: queueName,
        job_type: jobType,
        success: success.toString(),
      },
      context
    );
  }

  /**
   * Get performance statistics for a metric
   */
  getStats(
    metricName: string,
    timeRange: number = 24 * 60 * 60 * 1000, // 24 hours
    tags?: Record<string, string>
  ): PerformanceStats | null {
    const cutoff = new Date(Date.now() - timeRange);
    let filteredMetrics = this.metrics.filter(
      metric => metric.name === metricName && metric.timestamp >= cutoff
    );

    // Filter by tags if provided
    if (tags) {
      filteredMetrics = filteredMetrics.filter(metric => {
        return Object.entries(tags).every(([key, value]) => metric.tags[key] === value);
      });
    }

    if (filteredMetrics.length === 0) {
      return null;
    }

    const values = filteredMetrics.map(m => m.value).sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      metric: metricName,
      count: values.length,
      min: values[0],
      max: values[values.length - 1],
      avg: sum / values.length,
      p50: values[Math.floor(values.length * 0.5)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
      unit: filteredMetrics[0].unit,
    };
  }

  /**
   * Get all performance statistics
   */
  getAllStats(timeRange: number = 24 * 60 * 60 * 1000): Record<string, PerformanceStats> {
    const cutoff = new Date(Date.now() - timeRange);
    const recentMetrics = this.metrics.filter(metric => metric.timestamp >= cutoff);
    
    const metricNames = [...new Set(recentMetrics.map(m => m.name))];
    const stats: Record<string, PerformanceStats> = {};

    for (const metricName of metricNames) {
      const stat = this.getStats(metricName, timeRange);
      if (stat) {
        stats[metricName] = stat;
      }
    }

    return stats;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 50): PerformanceAlert[] {
    return this.alerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      
      logger.info(`Performance alert resolved: ${alertId}`, {
        alertId,
        metric: alert.metric,
        resolvedAt: alert.resolvedAt,
      });
      
      return true;
    }
    return false;
  }

  /**
   * Get performance summary
   */
  getSummary(timeRange: number = 24 * 60 * 60 * 1000): {
    totalMetrics: number;
    activeAlerts: number;
    resolvedAlerts: number;
    avgResponseTime: number;
    errorRate: number;
    topSlowOperations: Array<{ name: string; avgDuration: number; count: number }>;
  } {
    const cutoff = new Date(Date.now() - timeRange);
    const recentMetrics = this.metrics.filter(metric => metric.timestamp >= cutoff);
    const recentAlerts = this.alerts.filter(alert => alert.timestamp >= cutoff);

    // Calculate average response time
    const responseTimeMetrics = recentMetrics.filter(m => m.type === 'response_time');
    const avgResponseTime = responseTimeMetrics.length > 0 
      ? responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length
      : 0;

    // Calculate error rate (simplified)
    const httpMetrics = recentMetrics.filter(m => m.name === 'http_request');
    const errorMetrics = httpMetrics.filter(m => m.tags.status_class === '5xx' || m.tags.status_class === '4xx');
    const errorRate = httpMetrics.length > 0 ? (errorMetrics.length / httpMetrics.length) * 100 : 0;

    // Find top slow operations
    const operationStats: Record<string, { total: number; count: number }> = {};
    recentMetrics.forEach(metric => {
      const key = `${metric.type}:${metric.name}`;
      if (!operationStats[key]) {
        operationStats[key] = { total: 0, count: 0 };
      }
      operationStats[key].total += metric.value;
      operationStats[key].count++;
    });

    const topSlowOperations = Object.entries(operationStats)
      .map(([name, stats]) => ({
        name,
        avgDuration: stats.total / stats.count,
        count: stats.count,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10);

    return {
      totalMetrics: recentMetrics.length,
      activeAlerts: recentAlerts.filter(a => !a.resolved).length,
      resolvedAlerts: recentAlerts.filter(a => a.resolved).length,
      avgResponseTime,
      errorRate,
      topSlowOperations,
    };
  }

  /**
   * Start automatic system metrics collection
   */
  startSystemMetricsCollection(intervalMs: number = 60000): NodeJS.Timeout {
    return setInterval(() => {
      this.recordSystemMetrics();
    }, intervalMs);
  }

  /**
   * Health check for performance monitor
   */
  healthCheck(): {
    healthy: boolean;
    metricsCount: number;
    activeAlerts: number;
    error?: string;
  } {
    try {
      const activeAlerts = this.getActiveAlerts().length;
      
      return {
        healthy: true,
        metricsCount: this.metrics.length,
        activeAlerts,
      };
    } catch (error) {
      return {
        healthy: false,
        metricsCount: 0,
        activeAlerts: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();