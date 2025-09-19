import { NextResponse } from 'next/server';
import { errorTracker } from '@/lib/monitoring/error-tracker';
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';
import { logger } from '@/lib/monitoring/logger';

export async function GET(request: Request) {
  const timer = performanceMonitor.timer('response_time', 'errors_endpoint');
  const requestId = crypto.randomUUID();
  
  try {
    logger.info('Errors endpoint requested', { requestId });

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const category = url.searchParams.get('category') as any;
    const severity = url.searchParams.get('severity') as any;
    const resolved = url.searchParams.get('resolved');
    const timeRange = parseInt(url.searchParams.get('timeRange') || '86400000'); // 24 hours default

    // Get error statistics
    const errorStats = errorTracker.getErrorStats(timeRange);
    
    // Get recent errors with filters
    const recentErrors = errorTracker.getRecentErrors(
      limit,
      category,
      severity,
      resolved === 'true' ? true : resolved === 'false' ? false : undefined
    );

    // Get circuit breaker status
    const circuitBreakers = errorTracker.getCircuitBreakerStatus();

    const response = {
      stats: errorStats,
      errors: recentErrors.map(error => ({
        id: error.id,
        timestamp: error.timestamp,
        category: error.category,
        severity: error.severity,
        message: error.message,
        service: error.service,
        operation: error.operation,
        tenantId: error.tenantId,
        userId: error.userId,
        recoveryStrategy: error.recoveryStrategy,
        recoveryAttempts: error.recoveryAttempts,
        maxRecoveryAttempts: error.maxRecoveryAttempts,
        resolved: error.resolved,
        resolvedAt: error.resolvedAt,
        resolution: error.resolution,
      })),
      circuitBreakers: Object.entries(circuitBreakers).map(([key, state]) => ({
        service: key,
        state: state.state,
        failureCount: state.failureCount,
        threshold: state.threshold,
        lastFailureTime: state.lastFailureTime,
        nextAttemptTime: state.nextAttemptTime,
      })),
      filters: {
        limit,
        category,
        severity,
        resolved,
        timeRange,
      },
      timestamp: new Date().toISOString(),
    };

    timer.end();
    return NextResponse.json(response);

  } catch (error) {
    timer.end();
    
    logger.error('Errors endpoint failed', error as Error, { requestId });
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const timer = performanceMonitor.timer('response_time', 'resolve_error');
  const requestId = crypto.randomUUID();
  
  try {
    logger.info('Error resolution requested', { requestId });

    const body = await request.json();
    const { errorId, resolution } = body;

    if (!errorId || !resolution) {
      return NextResponse.json(
        { error: 'errorId and resolution are required' },
        { status: 400 }
      );
    }

    const success = errorTracker.resolveError(errorId, resolution);

    if (!success) {
      return NextResponse.json(
        { error: 'Error not found or already resolved' },
        { status: 404 }
      );
    }

    timer.end();
    return NextResponse.json({
      success: true,
      errorId,
      resolution,
      resolvedAt: new Date().toISOString(),
    });

  } catch (error) {
    timer.end();
    
    logger.error('Error resolution failed', error as Error, { requestId });
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}