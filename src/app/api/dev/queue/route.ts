/**
 * Development API endpoint for queue monitoring and management
 * Only available in development environment
 */

import { NextRequest, NextResponse } from 'next/server';
import { queueDevTools, queueManager, queueMonitor } from '@/lib/queue';
import { config } from '@/lib/config';

// Only allow in development
if (config.app.nodeEnv === 'production') {
  throw new Error('Queue development API is not available in production');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const queue = searchParams.get('queue') as 'email' | 'analytics' | 'ai';

    switch (action) {
      case 'dashboard':
        const dashboardData = await queueDevTools.getDashboardData();
        return NextResponse.json(dashboardData);

      case 'inspect':
        if (queue) {
          const inspection = await queueDevTools.inspectQueue(queue);
          return NextResponse.json(inspection);
        } else {
          const allInspections = await queueDevTools.inspectAllQueues();
          return NextResponse.json(allInspections);
        }

      case 'stats':
        if (queue) {
          const stats = await queueManager.getQueueStats(queue);
          return NextResponse.json(stats);
        } else {
          const allStats = await queueManager.getAllQueueStats();
          return NextResponse.json(allStats);
        }

      case 'health':
        const health = await queueManager.healthCheck();
        return NextResponse.json(health);

      case 'metrics':
        if (queue) {
          const metrics = queueMonitor.getQueueMetrics(queue);
          return NextResponse.json(metrics);
        } else {
          const allMetrics = queueMonitor.getAllMetrics();
          return NextResponse.json(allMetrics);
        }

      case 'errors':
        const limit = parseInt(searchParams.get('limit') || '50');
        if (queue) {
          const errors = queueMonitor.getQueueErrors(queue, limit);
          return NextResponse.json(errors);
        } else {
          const errors = queueMonitor.getRecentErrors(limit);
          return NextResponse.json(errors);
        }

      case 'report':
        const report = queueMonitor.generateReport();
        return NextResponse.json(report);

      default:
        return NextResponse.json({
          message: 'Queue Development API',
          availableActions: [
            'dashboard',
            'inspect',
            'stats', 
            'health',
            'metrics',
            'errors',
            'report'
          ],
          usage: {
            dashboard: '/api/dev/queue?action=dashboard',
            inspect: '/api/dev/queue?action=inspect&queue=email',
            stats: '/api/dev/queue?action=stats&queue=email',
            health: '/api/dev/queue?action=health',
            metrics: '/api/dev/queue?action=metrics&queue=email',
            errors: '/api/dev/queue?action=errors&queue=email&limit=10',
            report: '/api/dev/queue?action=report',
          }
        });
    }
  } catch (error) {
    console.error('Queue API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const queue = searchParams.get('queue') as 'email' | 'analytics' | 'ai';

    switch (action) {
      case 'test':
        const testJobs = await queueDevTools.createTestJobs();
        return NextResponse.json({
          message: 'Test jobs created',
          jobs: testJobs
        });

      case 'clear':
        if (queue) {
          await queueManager.cleanQueue(queue, 0);
          return NextResponse.json({
            message: `Cleared ${queue} queue`
          });
        } else {
          await queueDevTools.clearAllQueues();
          return NextResponse.json({
            message: 'Cleared all queues'
          });
        }

      case 'pause':
        if (!queue) {
          return NextResponse.json(
            { error: 'Queue parameter required for pause action' },
            { status: 400 }
          );
        }
        await queueManager.pauseQueue(queue);
        return NextResponse.json({
          message: `Paused ${queue} queue`
        });

      case 'resume':
        if (!queue) {
          return NextResponse.json(
            { error: 'Queue parameter required for resume action' },
            { status: 400 }
          );
        }
        await queueManager.resumeQueue(queue);
        return NextResponse.json({
          message: `Resumed ${queue} queue`
        });

      case 'performance':
        const body = await request.json();
        const jobCount = body.jobCount || 100;
        const result = await queueDevTools.performanceTest(jobCount);
        return NextResponse.json({
          message: 'Performance test completed',
          result
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action', availableActions: ['test', 'clear', 'pause', 'resume', 'performance'] },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Queue API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}