import { NextResponse } from 'next/server';
import { healthChecker } from '@/lib/monitoring/health-check';
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';
import { errorTracker } from '@/lib/monitoring/error-tracker';
import { securityMonitor } from '@/lib/monitoring/security-monitor';
import { logger } from '@/lib/monitoring/logger';

export async function GET(request: Request) {
  const timer = performanceMonitor.timer('response_time', 'health_check');
  const requestId = crypto.randomUUID();
  
  try {
    logger.info('Health check requested', { requestId });

    // Get query parameters
    const url = new URL(request.url);
    const detailed = url.searchParams.get('detailed') === 'true';
    const component = url.searchParams.get('component');

    if (component) {
      // Check specific component
      const componentHealth = await healthChecker.runCheck(component);
      
      if (!componentHealth) {
        return NextResponse.json(
          { error: 'Component not found', available: Array.from(healthChecker['checks'].keys()) },
          { status: 404 }
        );
      }

      timer.end();
      return NextResponse.json(componentHealth);
    }

    if (detailed) {
      // Run comprehensive health check
      const systemHealth = await healthChecker.runAllChecks();
      
      // Add monitoring system status
      const monitoringStatus = {
        performanceMonitor: performanceMonitor.healthCheck(),
        errorTracker: errorTracker.healthCheck(),
        securityMonitor: await securityMonitor.healthCheck(),
      };

      // Add performance summary
      const performanceSummary = performanceMonitor.getSummary();
      
      // Add error summary
      const errorStats = errorTracker.getErrorStats();
      
      // Add security summary
      const securityStats = await securityMonitor.getSecurityStats();

      const response = {
        ...systemHealth,
        monitoring: monitoringStatus,
        performance: performanceSummary,
        errors: {
          totalErrors: errorStats.totalErrors,
          unresolvedErrors: errorStats.unresolvedErrors,
          errorsByCategory: errorStats.errorsByCategory,
          errorsBySeverity: errorStats.errorsBySeverity,
        },
        security: {
          totalEvents: securityStats.totalEvents,
          activeAlerts: securityStats.activeAlerts,
          eventsByType: securityStats.eventsByType,
          eventsBySeverity: securityStats.eventsBySeverity,
        },
      };

      timer.end();
      return NextResponse.json(response);
    }

    // Basic health check
    const basicHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: healthChecker.getUptime(),
      environment: process.env.NODE_ENV || 'development',
    };

    timer.end();
    return NextResponse.json(basicHealth);

  } catch (error) {
    timer.end();
    
    logger.error('Health check failed', error as Error, { requestId });
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId,
      },
      { status: 503 }
    );
  }
}