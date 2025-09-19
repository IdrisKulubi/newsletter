import { NextResponse } from 'next/server';
import { securityMonitor } from '@/lib/monitoring/security-monitor';
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';
import { logger } from '@/lib/monitoring/logger';

export async function GET(request: Request) {
  const timer = performanceMonitor.timer('response_time', 'security_endpoint');
  const requestId = crypto.randomUUID();
  
  try {
    logger.info('Security endpoint requested', { requestId });

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const eventType = url.searchParams.get('eventType') as any;
    const severity = url.searchParams.get('severity') as any;
    const tenantId = url.searchParams.get('tenantId');
    const timeRange = parseInt(url.searchParams.get('timeRange') || '86400000'); // 24 hours default

    // Get security statistics
    const securityStats = await securityMonitor.getSecurityStats(timeRange);
    
    // Get recent security events
    const recentEvents = await securityMonitor.getRecentEvents(
      limit,
      eventType,
      severity,
      tenantId
    );

    // Get active alerts
    const activeAlerts = await securityMonitor.getActiveAlerts(tenantId);

    // Get performance metrics for security monitoring
    const performanceStats = await securityMonitor.getPerformanceStats(100);

    const response = {
      stats: securityStats,
      events: recentEvents.map(event => ({
        id: event.id,
        timestamp: event.timestamp,
        type: event.type,
        severity: event.severity,
        source: event.source,
        tenantId: event.tenantId,
        userId: event.userId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        details: event.details,
      })),
      alerts: activeAlerts.map(alert => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        count: alert.count,
        firstSeen: alert.firstSeen,
        lastSeen: alert.lastSeen,
        source: alert.source,
        tenantId: alert.tenantId,
        resolved: alert.resolved,
      })),
      performance: {
        averageResponseTime: performanceStats.averageResponseTime,
        averageMemoryUsage: performanceStats.averageMemoryUsage,
        averageCpuUsage: performanceStats.averageCpuUsage,
        averageCacheHitRate: performanceStats.averageCacheHitRate,
        averageErrorRate: performanceStats.averageErrorRate,
        averageThroughput: performanceStats.averageThroughput,
      },
      filters: {
        limit,
        eventType,
        severity,
        tenantId,
        timeRange,
      },
      timestamp: new Date().toISOString(),
    };

    timer.end();
    return NextResponse.json(response);

  } catch (error) {
    timer.end();
    
    logger.error('Security endpoint failed', error as Error, { requestId });
    
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
  const timer = performanceMonitor.timer('response_time', 'resolve_security_alert');
  const requestId = crypto.randomUUID();
  
  try {
    logger.info('Security alert resolution requested', { requestId });

    const body = await request.json();
    const { alertId } = body;

    if (!alertId) {
      return NextResponse.json(
        { error: 'alertId is required' },
        { status: 400 }
      );
    }

    const success = await securityMonitor.resolveAlert(alertId);

    if (!success) {
      return NextResponse.json(
        { error: 'Alert not found or already resolved' },
        { status: 404 }
      );
    }

    timer.end();
    return NextResponse.json({
      success: true,
      alertId,
      resolvedAt: new Date().toISOString(),
    });

  } catch (error) {
    timer.end();
    
    logger.error('Security alert resolution failed', error as Error, { requestId });
    
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