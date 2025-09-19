/**
 * Security monitoring and alerting system
 * Monitors security events and performance metrics
 */

import { Redis } from "ioredis";
import { config } from "@/lib/config";
import { rateLimiter } from "@/lib/security/rate-limiting";

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  timestamp: Date;
  source: string;
  details: Record<string, any>;
  tenantId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export type SecurityEventType =
  | "rate_limit_exceeded"
  | "invalid_csrf_token"
  | "suspicious_login_attempt"
  | "malicious_input_detected"
  | "unauthorized_access_attempt"
  | "file_upload_violation"
  | "sql_injection_attempt"
  | "xss_attempt"
  | "path_traversal_attempt"
  | "brute_force_attack"
  | "account_lockout"
  | "privilege_escalation_attempt";

export type SecuritySeverity = "low" | "medium" | "high" | "critical";

export interface PerformanceMetrics {
  timestamp: Date;
  responseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  cacheHitRate: number;
  errorRate: number;
  throughput: number;
}

export interface SecurityAlert {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  message: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  source: string;
  tenantId?: string;
  resolved: boolean;
}

class SecurityMonitor {
  private redis: Redis;
  private events: SecurityEvent[] = [];
  private alerts: Map<string, SecurityAlert> = new Map();
  private maxEvents = 10000;
  private alertThresholds: Record<
    SecurityEventType,
    { count: number; window: number }
  > = {
    rate_limit_exceeded: { count: 10, window: 300 }, // 10 in 5 minutes
    invalid_csrf_token: { count: 5, window: 300 },
    suspicious_login_attempt: { count: 3, window: 600 },
    malicious_input_detected: { count: 5, window: 300 },
    unauthorized_access_attempt: { count: 3, window: 300 },
    brute_force_attack: { count: 1, window: 0 }, // Immediate alert
    file_upload_violation: { count: 5, window: 300 }, // 5 in 5 minutes
    sql_injection_attempt: { count: 3, window: 300 }, // 3 in 5 minutes
    xss_attempt: { count: 3, window: 300 }, // 3 in 5 minutes
    path_traversal_attempt: { count: 3, window: 300 }, // 3 in 5 minutes
    account_lockout: { count: 1, window: 0 }, // Immediate alert
    privilege_escalation_attempt: { count: 1, window: 0 }, // Immediate alert
  };

  constructor() {
    this.redis = new Redis(config.redis.url, {
      keyPrefix: "security_monitor:",
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy: (times) => {
        // Reconnect after 100ms
        return 100;
      },
    });
  }

  /**
   * Record a security event
   */
  async recordEvent(
    event: Omit<SecurityEvent, "id" | "timestamp">
  ): Promise<void> {
    const securityEvent: SecurityEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    // Store in memory (with rotation)
    this.events.push(securityEvent);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Store in Redis for persistence
    try {
      await this.redis.lpush("events", JSON.stringify(securityEvent));
      await this.redis.ltrim("events", 0, this.maxEvents - 1);

      // Set expiration for the list
      await this.redis.expire("events", 7 * 24 * 60 * 60); // 7 days
    } catch (error) {
      console.error("Failed to store security event:", error);
    }

    // Check for alert conditions
    await this.checkAlertConditions(securityEvent);

    // Log critical events immediately
    if (event.severity === "critical") {
      console.error("CRITICAL SECURITY EVENT:", securityEvent);
    }
  }

  /**
   * Check if an event should trigger an alert
   */
  private async checkAlertConditions(event: SecurityEvent): Promise<void> {
    const threshold = this.alertThresholds[event.type];
    if (!threshold) return;

    const alertKey = this.generateAlertKey(event);
    const now = Date.now();
    const windowStart = now - threshold.window * 1000;

    try {
      // Count recent events of this type
      const recentEvents = await this.redis.zcount(
        `event_count:${event.type}:${event.source}`,
        windowStart,
        now
      );

      // Add current event to the count
      await this.redis.zadd(
        `event_count:${event.type}:${event.source}`,
        now,
        event.id
      );

      // Clean up old events
      await this.redis.zremrangebyscore(
        `event_count:${event.type}:${event.source}`,
        0,
        windowStart
      );

      // Set expiration
      await this.redis.expire(
        `event_count:${event.type}:${event.source}`,
        threshold.window + 300
      );

      // Check if threshold is exceeded
      if (recentEvents >= threshold.count) {
        await this.createAlert(event, recentEvents + 1);
      }
    } catch (error) {
      console.error("Failed to check alert conditions:", error);
    }
  }

  /**
   * Create or update a security alert
   */
  private async createAlert(
    event: SecurityEvent,
    count: number
  ): Promise<void> {
    const alertKey = this.generateAlertKey(event);
    const existingAlert = this.alerts.get(alertKey);

    if (existingAlert && !existingAlert.resolved) {
      // Update existing alert
      existingAlert.count = count;
      existingAlert.lastSeen = event.timestamp;
    } else {
      // Create new alert
      const alert: SecurityAlert = {
        id: crypto.randomUUID(),
        type: event.type,
        severity: event.severity,
        message: this.generateAlertMessage(event, count),
        count,
        firstSeen: event.timestamp,
        lastSeen: event.timestamp,
        source: event.source,
        tenantId: event.tenantId,
        resolved: false,
      };

      this.alerts.set(alertKey, alert);

      // Store in Redis
      try {
        await this.redis.hset("alerts", alertKey, JSON.stringify(alert));
      } catch (error) {
        console.error("Failed to store alert:", error);
      }

      // Send notification (implement based on your notification system)
      await this.sendAlertNotification(alert);
    }
  }

  /**
   * Generate alert key for deduplication
   */
  private generateAlertKey(event: SecurityEvent): string {
    return `${event.type}:${event.source}:${event.tenantId || "global"}`;
  }

  /**
   * Generate human-readable alert message
   */
  private generateAlertMessage(event: SecurityEvent, count: number): string {
    const messages = {
      rate_limit_exceeded: `Rate limit exceeded ${count} times from ${event.source}`,
      invalid_csrf_token: `Invalid CSRF tokens detected ${count} times from ${event.source}`,
      suspicious_login_attempt: `Suspicious login attempts detected ${count} times from ${event.source}`,
      malicious_input_detected: `Malicious input detected ${count} times from ${event.source}`,
      unauthorized_access_attempt: `Unauthorized access attempts detected ${count} times from ${event.source}`,
      brute_force_attack: `Brute force attack detected from ${event.source}`,
      file_upload_violation: `File upload violations detected ${count} times from ${event.source}`,
      sql_injection_attempt: `SQL injection attempts detected ${count} times from ${event.source}`,
      xss_attempt: `XSS attempts detected ${count} times from ${event.source}`,
      path_traversal_attempt: `Path traversal attempts detected ${count} times from ${event.source}`,
      account_lockout: `Account lockout triggered for ${event.source}`,
      privilege_escalation_attempt: `Privilege escalation attempts detected ${count} times from ${event.source}`,
    };

    return (
      messages[event.type] ||
      `Security event ${event.type} detected ${count} times from ${event.source}`
    );
  }

  /**
   * Send alert notification (implement based on your notification system)
   */
  private async sendAlertNotification(alert: SecurityAlert): Promise<void> {
    // This would integrate with your notification system (email, Slack, etc.)
    console.warn("SECURITY ALERT:", {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      count: alert.count,
      source: alert.source,
      tenantId: alert.tenantId,
    });

    // For critical alerts, you might want to send immediate notifications
    if (alert.severity === "critical") {
      // Send to incident management system
      // await this.sendToIncidentManagement(alert);
    }
  }

  /**
   * Get recent security events
   */
  async getRecentEvents(
    limit: number = 100,
    eventType?: SecurityEventType,
    severity?: SecuritySeverity,
    tenantId?: string
  ): Promise<SecurityEvent[]> {
    try {
      const events = await this.redis.lrange("events", 0, limit - 1);
      return events
        .map((eventStr) => JSON.parse(eventStr) as SecurityEvent)
        .filter((event) => {
          if (eventType && event.type !== eventType) return false;
          if (severity && event.severity !== severity) return false;
          if (tenantId && event.tenantId !== tenantId) return false;
          return true;
        });
    } catch (error) {
      console.error("Failed to get recent events:", error);
      return [];
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(tenantId?: string): Promise<SecurityAlert[]> {
    try {
      const alertsData = await this.redis.hgetall("alerts");
      const alerts = Object.values(alertsData)
        .map((alertStr) => JSON.parse(alertStr) as SecurityAlert)
        .filter((alert) => !alert.resolved);

      if (tenantId) {
        return alerts.filter((alert) => alert.tenantId === tenantId);
      }

      return alerts;
    } catch (error) {
      console.error("Failed to get active alerts:", error);
      return Array.from(this.alerts.values()).filter(
        (alert) => !alert.resolved
      );
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<boolean> {
    try {
      const alertsData = await this.redis.hgetall("alerts");

      for (const [key, alertStr] of Object.entries(alertsData)) {
        const alert = JSON.parse(alertStr) as SecurityAlert;
        if (alert.id === alertId) {
          alert.resolved = true;
          await this.redis.hset("alerts", key, JSON.stringify(alert));
          this.alerts.set(key, alert);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error("Failed to resolve alert:", error);
      return false;
    }
  }

  /**
   * Get security statistics
   */
  async getSecurityStats(timeRange: number = 24 * 60 * 60 * 1000): Promise<{
    totalEvents: number;
    eventsByType: Record<SecurityEventType, number>;
    eventsBySeverity: Record<SecuritySeverity, number>;
    topSources: Array<{ source: string; count: number }>;
    activeAlerts: number;
    resolvedAlerts: number;
  }> {
    const cutoff = new Date(Date.now() - timeRange);
    const recentEvents = this.events.filter(
      (event) => event.timestamp >= cutoff
    );

    const eventsByType = recentEvents.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<SecurityEventType, number>);

    const eventsBySeverity = recentEvents.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<SecuritySeverity, number>);

    const sourceCounts = recentEvents.reduce((acc, event) => {
      acc[event.source] = (acc[event.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topSources = Object.entries(sourceCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([source, count]) => ({ source, count }));

    const alerts = Array.from(this.alerts.values());
    const activeAlerts = alerts.filter((alert) => !alert.resolved).length;
    const resolvedAlerts = alerts.filter((alert) => alert.resolved).length;

    return {
      totalEvents: recentEvents.length,
      eventsByType,
      eventsBySeverity,
      topSources,
      activeAlerts,
      resolvedAlerts,
    };
  }

  /**
   * Record performance metrics
   */
  async recordPerformanceMetrics(
    metrics: Omit<PerformanceMetrics, "timestamp">
  ): Promise<void> {
    const performanceMetrics: PerformanceMetrics = {
      ...metrics,
      timestamp: new Date(),
    };

    try {
      await this.redis.lpush(
        "performance_metrics",
        JSON.stringify(performanceMetrics)
      );
      await this.redis.ltrim("performance_metrics", 0, 1000); // Keep last 1000 metrics
      await this.redis.expire("performance_metrics", 24 * 60 * 60); // 24 hours
    } catch (error) {
      console.error("Failed to store performance metrics:", error);
    }
  }

  /**
   * Get performance statistics
   */
  async getPerformanceStats(limit: number = 100): Promise<{
    averageResponseTime: number;
    averageMemoryUsage: number;
    averageCpuUsage: number;
    averageCacheHitRate: number;
    averageErrorRate: number;
    averageThroughput: number;
    metrics: PerformanceMetrics[];
  }> {
    try {
      const metricsData = await this.redis.lrange(
        "performance_metrics",
        0,
        limit - 1
      );
      const metrics = metricsData.map(
        (metricStr) => JSON.parse(metricStr) as PerformanceMetrics
      );

      if (metrics.length === 0) {
        return {
          averageResponseTime: 0,
          averageMemoryUsage: 0,
          averageCpuUsage: 0,
          averageCacheHitRate: 0,
          averageErrorRate: 0,
          averageThroughput: 0,
          metrics: [],
        };
      }

      const averageResponseTime =
        metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
      const averageMemoryUsage =
        metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length;
      const averageCpuUsage =
        metrics.reduce((sum, m) => sum + m.cpuUsage, 0) / metrics.length;
      const averageCacheHitRate =
        metrics.reduce((sum, m) => sum + m.cacheHitRate, 0) / metrics.length;
      const averageErrorRate =
        metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length;
      const averageThroughput =
        metrics.reduce((sum, m) => sum + m.throughput, 0) / metrics.length;

      return {
        averageResponseTime,
        averageMemoryUsage,
        averageCpuUsage,
        averageCacheHitRate,
        averageErrorRate,
        averageThroughput,
        metrics,
      };
    } catch (error) {
      console.error("Failed to get performance stats:", error);
      return {
        averageResponseTime: 0,
        averageMemoryUsage: 0,
        averageCpuUsage: 0,
        averageCacheHitRate: 0,
        averageErrorRate: 0,
        averageThroughput: 0,
        metrics: [],
      };
    }
  }

  /**
   * Health check for the monitoring system
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    eventsStored: number;
    alertsActive: number;
    redisConnected: boolean;
    error?: string;
  }> {
    try {
      const eventsCount = await this.redis.llen("events");
      const alertsCount = await this.redis.hlen("alerts");

      return {
        healthy: true,
        eventsStored: eventsCount,
        alertsActive: alertsCount,
        redisConnected: true,
      };
    } catch (error) {
      return {
        healthy: false,
        eventsStored: this.events.length,
        alertsActive: this.alerts.size,
        redisConnected: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

// Singleton instance
export const securityMonitor = new SecurityMonitor();

// Convenience functions for common security events
export const SecurityEvents = {
  rateLimitExceeded: (source: string, details: any, tenantId?: string) =>
    securityMonitor.recordEvent({
      type: "rate_limit_exceeded",
      severity: "medium",
      source,
      details,
      tenantId,
    }),

  invalidCSRFToken: (source: string, details: any, tenantId?: string) =>
    securityMonitor.recordEvent({
      type: "invalid_csrf_token",
      severity: "high",
      source,
      details,
      tenantId,
    }),

  suspiciousLogin: (source: string, details: any, userId?: string) =>
    securityMonitor.recordEvent({
      type: "suspicious_login_attempt",
      severity: "high",
      source,
      details,
      userId,
    }),

  maliciousInput: (source: string, details: any, tenantId?: string) =>
    securityMonitor.recordEvent({
      type: "malicious_input_detected",
      severity: "high",
      source,
      details,
      tenantId,
    }),

  unauthorizedAccess: (
    source: string,
    details: any,
    tenantId?: string,
    userId?: string
  ) =>
    securityMonitor.recordEvent({
      type: "unauthorized_access_attempt",
      severity: "high",
      source,
      details,
      tenantId,
      userId,
    }),

  bruteForceAttack: (source: string, details: any) =>
    securityMonitor.recordEvent({
      type: "brute_force_attack",
      severity: "critical",
      source,
      details,
    }),
};
