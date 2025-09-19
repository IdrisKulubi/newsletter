import { NextResponse } from 'next/server';
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';
import { logger } from '@/lib/monitoring/logger';

export async function GET(request: Request) {
  const timer = performanceMonitor.timer('response_time', 'metrics_endpoint');
  const requestId = crypto.randomUUID();
  
  try {
    logger.info('Metrics endpoint requested', { requestId });

    const url = new URL(request.url);
    const timeRange = parseInt(url.searchParams.get('timeRange') || '3600000'); // 1 hour default
    const metric = url.searchParams.get('metric');
    const format = url.searchParams.get('format') || 'json';

    if (metric) {
      // Get specific metric stats
      const stats = performanceMonitor.getStats(metric, timeRange);
      
      if (!stats) {
        return NextResponse.json(
          { error: 'Metric not found or no data available' },
          { status: 404 }
        );
      }

      timer.end();
      return NextResponse.json(stats);
    }

    // Get all metrics
    const allStats = performanceMonitor.getAllStats(timeRange);
    const summary = performanceMonitor.getSummary(timeRange);
    const activeAlerts = performanceMonitor.getActiveAlerts();

    const response = {
      summary,
      metrics: allStats,
      alerts: {
        active: activeAlerts.length,
        recent: activeAlerts.slice(0, 10),
      },
      timeRange,
      timestamp: new Date().toISOString(),
    };

    // Support Prometheus format for monitoring tools
    if (format === 'prometheus') {
      const prometheusMetrics = convertToPrometheusFormat(allStats, summary);
      timer.end();
      return new Response(prometheusMetrics, {
        headers: {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        },
      });
    }

    timer.end();
    return NextResponse.json(response);

  } catch (error) {
    timer.end();
    
    logger.error('Metrics endpoint failed', error as Error, { requestId });
    
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

function convertToPrometheusFormat(
  stats: Record<string, any>,
  summary: any
): string {
  const lines: string[] = [];
  
  // Add help and type information
  lines.push('# HELP newsletter_response_time_seconds Response time in seconds');
  lines.push('# TYPE newsletter_response_time_seconds histogram');
  
  lines.push('# HELP newsletter_error_rate_percent Error rate percentage');
  lines.push('# TYPE newsletter_error_rate_percent gauge');
  
  lines.push('# HELP newsletter_active_alerts_total Number of active performance alerts');
  lines.push('# TYPE newsletter_active_alerts_total gauge');

  // Convert stats to Prometheus format
  Object.entries(stats).forEach(([metricName, stat]: [string, any]) => {
    const sanitizedName = metricName.replace(/[^a-zA-Z0-9_]/g, '_');
    
    if (stat.unit === 'ms') {
      // Convert milliseconds to seconds for Prometheus
      lines.push(`newsletter_${sanitizedName}_seconds_avg ${(stat.avg / 1000).toFixed(6)}`);
      lines.push(`newsletter_${sanitizedName}_seconds_p95 ${(stat.p95 / 1000).toFixed(6)}`);
      lines.push(`newsletter_${sanitizedName}_seconds_p99 ${(stat.p99 / 1000).toFixed(6)}`);
    } else if (stat.unit === '%') {
      lines.push(`newsletter_${sanitizedName}_percent ${stat.avg.toFixed(2)}`);
    } else {
      lines.push(`newsletter_${sanitizedName}_total ${stat.count}`);
    }
  });

  // Add summary metrics
  lines.push(`newsletter_error_rate_percent ${summary.errorRate.toFixed(2)}`);
  lines.push(`newsletter_active_alerts_total ${summary.activeAlerts}`);
  lines.push(`newsletter_total_metrics_total ${summary.totalMetrics}`);

  return lines.join('\n') + '\n';
}