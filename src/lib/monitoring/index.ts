/**
 * Monitoring System Exports
 * Central export point for all monitoring components
 */

// Core monitoring components
export { logger, log, Logger } from './logger';
export { errorTracker, withErrorTracking } from './error-tracker';
export { securityMonitor, SecurityEvents } from './security-monitor';
export { healthChecker } from './health-check';
export { performanceMonitor } from './performance-monitor';

// Middleware and utilities
export { 
  withMonitoring, 
  createExpressMonitoringMiddleware, 
  withPerformanceMonitoring 
} from './middleware';

// Types
export type { LogLevel, LogEntry } from './logger';
export type { 
  ErrorCategory, 
  ErrorSeverity, 
  TrackedError, 
  RecoveryStrategy 
} from './error-tracker';
export type { 
  SecurityEvent, 
  SecurityEventType, 
  SecuritySeverity, 
  SecurityAlert 
} from './security-monitor';
export type { 
  HealthStatus, 
  HealthCheckResult, 
  ComponentHealth, 
  SystemHealth 
} from './health-check';
export type { 
  PerformanceMetric, 
  MetricType, 
  PerformanceAlert, 
  PerformanceStats 
} from './performance-monitor';

// Convenience functions for common monitoring tasks
export const monitoring = {
  // Quick logging
  info: (message: string, metadata?: Record<string, any>) => {
    const { logger } = require('./logger');
    return logger.info(message, metadata);
  },
  warn: (message: string, metadata?: Record<string, any>) => {
    const { logger } = require('./logger');
    return logger.warn(message, metadata);
  },
  error: (message: string, error?: Error, metadata?: Record<string, any>) => {
    const { logger } = require('./logger');
    return logger.error(message, error, metadata);
  },
  
  // Quick performance tracking
  timer: (operation: string) => {
    const { performanceMonitor } = require('./performance-monitor');
    return performanceMonitor.timer('response_time', operation);
  },
  recordMetric: (type: string, name: string, value: number, unit: string = 'ms') => {
    const { performanceMonitor } = require('./performance-monitor');
    return performanceMonitor.recordMetric(type as any, name, value, unit);
  },
  
  // Quick error tracking
  trackError: (error: Error, service: string, operation: string) => {
    const { errorTracker } = require('./error-tracker');
    return errorTracker.trackError(error, { service, operation });
  },
  
  // Quick security events
  securityEvent: (type: string, severity: 'low' | 'medium' | 'high' | 'critical', source: string, details: any) => {
    const { securityMonitor } = require('./security-monitor');
    return securityMonitor.recordEvent({
      type: type as any,
      severity,
      source,
      details,
    });
  },
  
  // Health checks
  healthCheck: () => {
    const { healthChecker } = require('./health-check');
    return healthChecker.runAllChecks();
  },
  componentHealth: (component: string) => {
    const { healthChecker } = require('./health-check');
    return healthChecker.runCheck(component);
  },
};

// Initialize monitoring system
export function initializeMonitoring(options: {
  enableSystemMetrics?: boolean;
  systemMetricsInterval?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
} = {}) {
  const {
    enableSystemMetrics = true,
    systemMetricsInterval = 60000, // 1 minute
    logLevel = 'info',
  } = options;

  const { logger } = require('./logger');
  logger.info('Initializing monitoring system', {
    enableSystemMetrics,
    systemMetricsInterval,
    logLevel,
  });

  // Start system metrics collection
  if (enableSystemMetrics) {
    const { performanceMonitor } = require('./performance-monitor');
    const interval = performanceMonitor.startSystemMetricsCollection(systemMetricsInterval);
    
    // Cleanup on process exit
    process.on('SIGTERM', () => {
      clearInterval(interval);
      logger.info('Monitoring system shutdown');
    });
    
    process.on('SIGINT', () => {
      clearInterval(interval);
      logger.info('Monitoring system shutdown');
    });
  }

  // Log initialization complete
  logger.info('Monitoring system initialized successfully');
  
  return {
    logger,
    errorTracker,
    securityMonitor,
    healthChecker,
    performanceMonitor,
  };
}