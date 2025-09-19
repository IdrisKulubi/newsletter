/**
 * Metrics endpoint for monitoring systems
 * Returns application metrics in Prometheus format
 */

import { NextRequest, NextResponse } from 'next/server';
import { metrics } from '@/lib/monitoring/metrics';
import { logger } from '@/lib/monitoring/logger';

export async function GET(request: NextRequest) {
  try {
    const allMetrics = metrics.getMetrics();
    
    // Convert to Prometheus format
    const prometheusMetrics = convertToPrometheusFormat(allMetrics);
    
    logger.info('Metrics Exported', {
      type: 'metrics_export',
      count: allMetrics.length,
    });

    return new NextResponse(prometheusMetrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      },
    });
  } catch (error) {
    logger.error('Metrics Export Failed', {
      type: 'metrics_export_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to export metrics' },
      { status: 500 }
    );
  }
}

function convertToPrometheusFormat(metricsData: any[]): string {
  const metricGroups = new Map<string, any[]>();
  
  // Group metrics by name
  metricsData.forEach(metric => {
    if (!metricGroups.has(metric.name)) {
      metricGroups.set(metric.name, []);
    }
    metricGroups.get(metric.name)!.push(metric);
  });

  let output = '';
  
  // Convert each metric group to Prometheus format
  metricGroups.forEach((metrics, name) => {
    // Add help text
    output += `# HELP ${name} Application metric for ${name}\n`;
    output += `# TYPE ${name} gauge\n`;
    
    metrics.forEach(metric => {
      const labels = metric.tags ? 
        Object.entries(metric.tags)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',') : '';
      
      const labelString = labels ? `{${labels}}` : '';
      const timestamp = Math.floor(metric.timestamp.getTime() / 1000);
      
      output += `${name}${labelString} ${metric.value} ${timestamp}\n`;
    });
    
    output += '\n';
  });

  return output;
}