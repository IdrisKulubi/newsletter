/**
 * Comprehensive Health Check System
 * Monitors all system components and provides detailed health status
 */

import { logger } from './logger';
import { errorTracker } from './error-tracker';
import { securityMonitor } from './security-monitor';
import { queueMonitor } from '../queue/queue-monitor';
import { config } from '../config';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: Date;
  duration: number;
  details?: Record<string, any>;
  error?: string;
}

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  lastCheck: Date;
  duration: number;
  details: Record<string, any>;
  error?: string;
}

export interface SystemHealth {
  status: HealthStatus;
  timestamp: Date;
  uptime: number;
  version: string;
  environment: string;
  components: ComponentHealth[];
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    total: number;
  };
}

class HealthChecker {
  private checks: Map<string, () => Promise<HealthCheckResult>> = new Map();
  private lastResults: Map<string, ComponentHealth> = new Map();
  private startTime: Date = new Date();

  constructor() {
    this.registerDefaultChecks();
  }

  /**
   * Register default health checks
   */
  private registerDefaultChecks(): void {
    this.registerCheck('database', this.checkDatabase.bind(this));
    this.registerCheck('redis', this.checkRedis.bind(this));
    this.registerCheck('storage', this.checkStorage.bind(this));
    this.registerCheck('email_service', this.checkEmailService.bind(this));
    this.registerCheck('ai_service', this.checkAIService.bind(this));
    this.registerCheck('queue_system', this.checkQueueSystem.bind(this));
    this.registerCheck('security_monitor', this.checkSecurityMonitor.bind(this));
    this.registerCheck('error_tracker', this.checkErrorTracker.bind(this));
    this.registerCheck('memory', this.checkMemory.bind(this));
    this.registerCheck('disk_space', this.checkDiskSpace.bind(this));
  }

  /**
   * Register a custom health check
   */
  registerCheck(name: string, checkFunction: () => Promise<HealthCheckResult>): void {
    this.checks.set(name, checkFunction);
  }

  /**
   * Run all health checks
   */
  async runAllChecks(): Promise<SystemHealth> {
    const startTime = Date.now();
    const components: ComponentHealth[] = [];
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;

    // Run all checks in parallel
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, checkFn]) => {
      try {
        const result = await Promise.race([
          checkFn(),
          new Promise<HealthCheckResult>((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), 10000)
          )
        ]);

        const component: ComponentHealth = {
          name,
          status: result.status,
          lastCheck: result.timestamp,
          duration: result.duration,
          details: result.details || {},
          error: result.error,
        };

        this.lastResults.set(name, component);
        return component;
      } catch (error) {
        const component: ComponentHealth = {
          name,
          status: 'unhealthy',
          lastCheck: new Date(),
          duration: Date.now() - startTime,
          details: {},
          error: error instanceof Error ? error.message : 'Unknown error',
        };

        this.lastResults.set(name, component);
        return component;
      }
    });

    const results = await Promise.all(checkPromises);
    components.push(...results);

    // Count status types
    components.forEach(component => {
      switch (component.status) {
        case 'healthy':
          healthyCount++;
          break;
        case 'degraded':
          degradedCount++;
          break;
        case 'unhealthy':
          unhealthyCount++;
          break;
      }
    });

    // Determine overall system status
    let overallStatus: HealthStatus = 'healthy';
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    }

    const systemHealth: SystemHealth = {
      status: overallStatus,
      timestamp: new Date(),
      uptime: Date.now() - this.startTime.getTime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.app.nodeEnv,
      components,
      summary: {
        healthy: healthyCount,
        degraded: degradedCount,
        unhealthy: unhealthyCount,
        total: components.length,
      },
    };

    // Log health check results
    logger.info('Health check completed', {
      status: overallStatus,
      duration: Date.now() - startTime,
      summary: systemHealth.summary,
    });

    return systemHealth;
  }

  /**
   * Run a specific health check
   */
  async runCheck(name: string): Promise<ComponentHealth | null> {
    const checkFn = this.checks.get(name);
    if (!checkFn) {
      return null;
    }

    try {
      const result = await checkFn();
      const component: ComponentHealth = {
        name,
        status: result.status,
        lastCheck: result.timestamp,
        duration: result.duration,
        details: result.details || {},
        error: result.error,
      };

      this.lastResults.set(name, component);
      return component;
    } catch (error) {
      const component: ComponentHealth = {
        name,
        status: 'unhealthy',
        lastCheck: new Date(),
        duration: 0,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      this.lastResults.set(name, component);
      return component;
    }
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    try {
      // Import database connection dynamically to avoid circular dependencies
      const { db } = await import('../db');
      
      // Simple query to test connection
      const result = await db.execute('SELECT 1 as test');
      
      return {
        status: 'healthy',
        timestamp: new Date(),
        duration: Date.now() - start,
        details: {
          connected: true,
          responseTime: Date.now() - start,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'Database connection failed',
        details: {
          connected: false,
        },
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    try {
      const { Redis } = await import('ioredis');
      const redis = new Redis(config.redis.url, {
        connectTimeout: 5000,
        lazyConnect: true,
      });

      await redis.ping();
      const info = await redis.info('memory');
      await redis.quit();

      return {
        status: 'healthy',
        timestamp: new Date(),
        duration: Date.now() - start,
        details: {
          connected: true,
          responseTime: Date.now() - start,
          memoryInfo: info.split('\n').slice(0, 3).join(', '),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'Redis connection failed',
        details: {
          connected: false,
        },
      };
    }
  }

  /**
   * Check storage service (Cloudflare R2)
   */
  private async checkStorage(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    try {
      const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3');
      
      const s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.r2.accessKeyId,
          secretAccessKey: config.r2.secretAccessKey,
        },
      });

      await s3Client.send(new HeadBucketCommand({
        Bucket: config.r2.bucketName,
      }));

      return {
        status: 'healthy',
        timestamp: new Date(),
        duration: Date.now() - start,
        details: {
          connected: true,
          bucket: config.r2.bucketName,
          responseTime: Date.now() - start,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'Storage service failed',
        details: {
          connected: false,
          bucket: config.r2.bucketName,
        },
      };
    }
  }

  /**
   * Check email service (Resend)
   */
  private async checkEmailService(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    try {
      // Simple API call to check Resend service
      const response = await fetch('https://api.resend.com/domains', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.email.resendApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return {
          status: 'healthy',
          timestamp: new Date(),
          duration: Date.now() - start,
          details: {
            connected: true,
            responseTime: Date.now() - start,
            statusCode: response.status,
          },
        };
      } else {
        return {
          status: 'degraded',
          timestamp: new Date(),
          duration: Date.now() - start,
          error: `HTTP ${response.status}: ${response.statusText}`,
          details: {
            connected: false,
            statusCode: response.status,
          },
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'Email service failed',
        details: {
          connected: false,
        },
      };
    }
  }

  /**
   * Check AI service (OpenAI)
   */
  private async checkAIService(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    try {
      // Simple API call to check OpenAI service
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.ai.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return {
          status: 'healthy',
          timestamp: new Date(),
          duration: Date.now() - start,
          details: {
            connected: true,
            responseTime: Date.now() - start,
            statusCode: response.status,
          },
        };
      } else {
        return {
          status: 'degraded',
          timestamp: new Date(),
          duration: Date.now() - start,
          error: `HTTP ${response.status}: ${response.statusText}`,
          details: {
            connected: false,
            statusCode: response.status,
          },
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'AI service failed',
        details: {
          connected: false,
        },
      };
    }
  }

  /**
   * Check queue system health
   */
  private async checkQueueSystem(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    try {
      const report = queueMonitor.generateReport();
      const criticalQueues = report.summary.criticalQueues;
      const warningQueues = report.summary.warningQueues;

      let status: HealthStatus = 'healthy';
      if (criticalQueues > 0) {
        status = 'unhealthy';
      } else if (warningQueues > 0) {
        status = 'degraded';
      }

      return {
        status,
        timestamp: new Date(),
        duration: Date.now() - start,
        details: {
          totalQueues: report.summary.totalQueues,
          healthyQueues: report.summary.healthyQueues,
          warningQueues: report.summary.warningQueues,
          criticalQueues: report.summary.criticalQueues,
          recentErrors: report.recentErrors.length,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'Queue system check failed',
        details: {
          connected: false,
        },
      };
    }
  }

  /**
   * Check security monitor health
   */
  private async checkSecurityMonitor(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    try {
      const health = await securityMonitor.healthCheck();
      
      return {
        status: health.healthy ? 'healthy' : 'degraded',
        timestamp: new Date(),
        duration: Date.now() - start,
        details: {
          eventsStored: health.eventsStored,
          alertsActive: health.alertsActive,
          redisConnected: health.redisConnected,
        },
        error: health.error,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'Security monitor check failed',
      };
    }
  }

  /**
   * Check error tracker health
   */
  private async checkErrorTracker(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    try {
      const health = errorTracker.healthCheck();
      
      let status: HealthStatus = 'healthy';
      if (health.circuitBreakersOpen > 0) {
        status = 'degraded';
      }
      if (health.unresolvedErrors > 100) {
        status = 'degraded';
      }

      return {
        status: health.healthy ? status : 'unhealthy',
        timestamp: new Date(),
        duration: Date.now() - start,
        details: {
          totalErrors: health.totalErrors,
          unresolvedErrors: health.unresolvedErrors,
          circuitBreakersOpen: health.circuitBreakersOpen,
        },
        error: health.error,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'Error tracker check failed',
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    try {
      const memUsage = process.memoryUsage();
      const totalMem = memUsage.heapTotal;
      const usedMem = memUsage.heapUsed;
      const usagePercent = (usedMem / totalMem) * 100;

      let status: HealthStatus = 'healthy';
      if (usagePercent > 90) {
        status = 'unhealthy';
      } else if (usagePercent > 75) {
        status = 'degraded';
      }

      return {
        status,
        timestamp: new Date(),
        duration: Date.now() - start,
        details: {
          heapUsed: Math.round(usedMem / 1024 / 1024),
          heapTotal: Math.round(totalMem / 1024 / 1024),
          usagePercent: Math.round(usagePercent),
          external: Math.round(memUsage.external / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'Memory check failed',
      };
    }
  }

  /**
   * Check disk space (simplified for Node.js)
   */
  private async checkDiskSpace(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    try {
      // This is a simplified check - in production you might use a library like 'check-disk-space'
      const stats = await import('fs').then(fs => fs.promises.stat('.'));
      
      return {
        status: 'healthy',
        timestamp: new Date(),
        duration: Date.now() - start,
        details: {
          available: true,
          note: 'Disk space monitoring requires additional setup in production',
        },
      };
    } catch (error) {
      return {
        status: 'degraded',
        timestamp: new Date(),
        duration: Date.now() - start,
        error: 'Disk space check not fully implemented',
        details: {
          available: false,
        },
      };
    }
  }

  /**
   * Get last health check results
   */
  getLastResults(): Record<string, ComponentHealth> {
    const results: Record<string, ComponentHealth> = {};
    for (const [name, health] of this.lastResults.entries()) {
      results[name] = health;
    }
    return results;
  }

  /**
   * Get system uptime
   */
  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }
}

// Export singleton instance
export const healthChecker = new HealthChecker();