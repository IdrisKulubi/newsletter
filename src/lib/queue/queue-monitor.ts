/**
 * Queue Monitoring and Error Handling
 * Provides comprehensive monitoring, logging, and error handling for queue operations
 */

import { Job } from 'bullmq';

export interface QueueMetrics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  activeJobs: number;
  waitingJobs: number;
  avgProcessingTime: number;
  errorRate: number;
  lastUpdated: Date;
}

export interface JobError {
  jobId: string;
  queueName: string;
  jobName: string;
  error: string;
  timestamp: Date;
  attemptsMade: number;
  maxAttempts: number;
  data: any;
}

export class QueueMonitor {
  private metrics: Map<string, QueueMetrics> = new Map();
  private errors: JobError[] = [];
  private maxErrorHistory = 1000;
  private initialized = false;

  constructor() {
    // Delay initialization to avoid circular dependencies
    setTimeout(() => this.initialize(), 0);
  }

  public initialize() {
    if (!this.initialized) {
      this.setupEventListeners();
      this.initialized = true;
    }
  }

  /**
   * Set up event listeners for all queues
   */
  private setupEventListeners(): void {
    // Import queue events dynamically to avoid circular dependencies
    import('./index').then(({ queueEvents }) => {
      // Email queue events
      this.setupQueueEventListeners('email', queueEvents.email);
      
      // Analytics queue events
      this.setupQueueEventListeners('analytics', queueEvents.analytics);
      
      // AI queue events
      this.setupQueueEventListeners('ai', queueEvents.ai);
    }).catch(error => {
      console.error('Failed to setup queue event listeners:', error);
    });
  }

  /**
   * Set up event listeners for a specific queue
   */
  private setupQueueEventListeners(queueName: string, events: any): void {
    // Job completed
    events.on('completed', ({ jobId, returnvalue }: { jobId: string; returnvalue: any }) => {
      this.handleJobCompleted(queueName, jobId, returnvalue);
    });

    // Job failed
    events.on('failed', ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
      this.handleJobFailed(queueName, jobId, failedReason);
    });

    // Job progress
    events.on('progress', ({ jobId, data }: { jobId: string; data: any }) => {
      this.handleJobProgress(queueName, jobId, data);
    });

    // Job stalled
    events.on('stalled', ({ jobId }: { jobId: string }) => {
      this.handleJobStalled(queueName, jobId);
    });

    // Job active
    events.on('active', ({ jobId }: { jobId: string }) => {
      this.handleJobActive(queueName, jobId);
    });

    // Job waiting
    events.on('waiting', ({ jobId }: { jobId: string }) => {
      this.handleJobWaiting(queueName, jobId);
    });
  }

  /**
   * Handle job completion
   */
  private handleJobCompleted(queueName: string, jobId: string, returnValue: any): void {
    console.log(`[${queueName.toUpperCase()}] Job ${jobId} completed successfully`);
    
    // Update metrics
    this.updateMetrics(queueName, 'completed');
    
    // Log success for important jobs
    if (queueName === 'email') {
      console.log(`Email batch job ${jobId} completed. Processed: ${returnValue?.processed || 'unknown'} emails`);
    }
  }

  /**
   * Handle job failure
   */
  private handleJobFailed(queueName: string, jobId: string, failedReason: string): void {
    console.error(`[${queueName.toUpperCase()}] Job ${jobId} failed: ${failedReason}`);
    
    // Update metrics
    this.updateMetrics(queueName, 'failed');
    
    // Store error for analysis
    this.storeJobError(queueName, jobId, failedReason);
    
    // Alert for critical failures
    if (queueName === 'email') {
      this.alertCriticalFailure(queueName, jobId, failedReason);
    }
  }

  /**
   * Handle job progress updates
   */
  private handleJobProgress(queueName: string, jobId: string, data: any): void {
    console.log(`[${queueName.toUpperCase()}] Job ${jobId} progress: ${JSON.stringify(data)}`);
  }

  /**
   * Handle job stalled (stuck in active state)
   */
  private handleJobStalled(queueName: string, jobId: string): void {
    console.warn(`[${queueName.toUpperCase()}] Job ${jobId} stalled - may need manual intervention`);
    
    // Log stalled job for investigation
    this.storeJobError(queueName, jobId, 'Job stalled - exceeded processing time limit');
  }

  /**
   * Handle job becoming active
   */
  private handleJobActive(queueName: string, jobId: string): void {
    console.log(`[${queueName.toUpperCase()}] Job ${jobId} started processing`);
    this.updateMetrics(queueName, 'active');
  }

  /**
   * Handle job waiting in queue
   */
  private handleJobWaiting(queueName: string, jobId: string): void {
    console.log(`[${queueName.toUpperCase()}] Job ${jobId} waiting in queue`);
    this.updateMetrics(queueName, 'waiting');
  }

  /**
   * Update queue metrics
   */
  private updateMetrics(queueName: string, eventType: string): void {
    const current = this.metrics.get(queueName) || {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      activeJobs: 0,
      waitingJobs: 0,
      avgProcessingTime: 0,
      errorRate: 0,
      lastUpdated: new Date(),
    };

    // Update counters based on event type
    switch (eventType) {
      case 'completed':
        current.completedJobs++;
        current.totalJobs++;
        break;
      case 'failed':
        current.failedJobs++;
        current.totalJobs++;
        break;
      case 'active':
        current.activeJobs++;
        break;
      case 'waiting':
        current.waitingJobs++;
        break;
    }

    // Calculate error rate
    if (current.totalJobs > 0) {
      current.errorRate = (current.failedJobs / current.totalJobs) * 100;
    }

    current.lastUpdated = new Date();
    this.metrics.set(queueName, current);
  }

  /**
   * Store job error for analysis
   */
  private storeJobError(queueName: string, jobId: string, error: string): void {
    const jobError: JobError = {
      jobId,
      queueName,
      jobName: 'unknown', // Would need to fetch from job data
      error,
      timestamp: new Date(),
      attemptsMade: 0, // Would need to fetch from job
      maxAttempts: 0, // Would need to fetch from job
      data: {}, // Would need to fetch from job
    };

    this.errors.unshift(jobError);
    
    // Keep only recent errors
    if (this.errors.length > this.maxErrorHistory) {
      this.errors = this.errors.slice(0, this.maxErrorHistory);
    }
  }

  /**
   * Alert for critical failures
   */
  private alertCriticalFailure(queueName: string, jobId: string, error: string): void {
    // In production, this would send alerts to monitoring systems
    console.error(`🚨 CRITICAL FAILURE in ${queueName} queue:`, {
      jobId,
      error,
      timestamp: new Date().toISOString(),
    });
    
    // Could integrate with services like:
    // - Sentry for error tracking
    // - Slack/Discord for team notifications
    // - PagerDuty for on-call alerts
    // - Email notifications for administrators
  }

  /**
   * Get metrics for a specific queue
   */
  getQueueMetrics(queueName: string): QueueMetrics | null {
    return this.metrics.get(queueName) || null;
  }

  /**
   * Get metrics for all queues
   */
  getAllMetrics(): Record<string, QueueMetrics> {
    const result: Record<string, QueueMetrics> = {};
    for (const [queueName, metrics] of this.metrics.entries()) {
      result[queueName] = metrics;
    }
    return result;
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 50): JobError[] {
    return this.errors.slice(0, limit);
  }

  /**
   * Get errors for a specific queue
   */
  getQueueErrors(queueName: string, limit: number = 50): JobError[] {
    return this.errors
      .filter(error => error.queueName === queueName)
      .slice(0, limit);
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errors = [];
  }

  /**
   * Get queue health status
   */
  getQueueHealth(queueName: string): {
    status: 'healthy' | 'warning' | 'critical';
    errorRate: number;
    recentErrors: number;
    lastActivity: Date | null;
  } {
    const metrics = this.metrics.get(queueName);
    const recentErrors = this.errors
      .filter(error => 
        error.queueName === queueName && 
        error.timestamp > new Date(Date.now() - 60 * 60 * 1000) // Last hour
      ).length;

    if (!metrics) {
      return {
        status: 'critical',
        errorRate: 0,
        recentErrors: 0,
        lastActivity: null,
      };
    }

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (metrics.errorRate > 50 || recentErrors > 10) {
      status = 'critical';
    } else if (metrics.errorRate > 20 || recentErrors > 5) {
      status = 'warning';
    }

    return {
      status,
      errorRate: metrics.errorRate,
      recentErrors,
      lastActivity: metrics.lastUpdated,
    };
  }

  /**
   * Generate monitoring report
   */
  generateReport(): {
    summary: {
      totalQueues: number;
      healthyQueues: number;
      warningQueues: number;
      criticalQueues: number;
    };
    queues: Record<string, {
      metrics: QueueMetrics | null;
      health: ReturnType<QueueMonitor['getQueueHealth']>;
    }>;
    recentErrors: JobError[];
  } {
    const queueNames = ['email-processing', 'analytics-processing', 'ai-processing'];
    const queues: Record<string, any> = {};
    let healthyQueues = 0;
    let warningQueues = 0;
    let criticalQueues = 0;

    for (const queueName of queueNames) {
      const metrics = this.getQueueMetrics(queueName);
      const health = this.getQueueHealth(queueName);
      
      queues[queueName] = { metrics, health };
      
      switch (health.status) {
        case 'healthy':
          healthyQueues++;
          break;
        case 'warning':
          warningQueues++;
          break;
        case 'critical':
          criticalQueues++;
          break;
      }
    }

    return {
      summary: {
        totalQueues: queueNames.length,
        healthyQueues,
        warningQueues,
        criticalQueues,
      },
      queues,
      recentErrors: this.getRecentErrors(20),
    };
  }
}

// Export singleton instance
export const queueMonitor = new QueueMonitor();