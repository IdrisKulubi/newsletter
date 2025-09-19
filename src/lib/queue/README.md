# Queue System Documentation

This directory contains the complete Redis and BullMQ-based queue system infrastructure for the Newsletter SaaS Platform.

## Overview

The queue system provides:
- **Background job processing** for email sending, analytics, and AI operations
- **Job scheduling and retry logic** with exponential backoff
- **Queue monitoring and error handling** with comprehensive logging
- **Development tools** for debugging and testing
- **Horizontal scalability** with configurable concurrency

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Email Queue   │    │ Analytics Queue │    │   AI Queue      │
│                 │    │                 │    │                 │
│ • Batch sending │    │ • Aggregation   │    │ • Content gen   │
│ • Retry logic   │    │ • Reporting     │    │ • Optimization  │
│ • Rate limiting │    │ • Insights      │    │ • Analysis      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Redis + BullMQ │
                    │                 │
                    │ • Job storage   │
                    │ • Event streams │
                    │ • Monitoring    │
                    └─────────────────┘
```

## Components

### 1. Queue Manager (`queue-manager.ts`)
High-level interface for job scheduling and queue management.

```typescript
import { queueManager } from '@/lib/queue';

// Schedule an email job
const job = await queueManager.scheduleEmailJob('send-newsletter', {
  campaignId: 'campaign-123',
  tenantId: 'tenant-456',
  recipients: [
    { email: 'user@example.com', name: 'John Doe' }
  ],
});

// Schedule batch email sending
const jobs = await queueManager.scheduleBatchEmailSending(
  'campaign-123',
  'tenant-456',
  recipients,
  100 // batch size
);

// Get queue statistics
const stats = await queueManager.getQueueStats('email');
```

### 2. Queue Monitor (`queue-monitor.ts`)
Comprehensive monitoring and error tracking system.

```typescript
import { queueMonitor } from '@/lib/queue';

// Get queue metrics
const metrics = queueMonitor.getQueueMetrics('email');

// Get recent errors
const errors = queueMonitor.getRecentErrors(50);

// Generate monitoring report
const report = queueMonitor.generateReport();
```

### 3. Workers (`workers.ts`)
Job processors that handle the actual work.

```typescript
import { startWorkers, stopWorkers } from '@/lib/queue';

// Start all workers
startWorkers();

// Stop all workers gracefully
await stopWorkers();
```

### 4. Development Tools (`dev-tools.ts`)
Utilities for debugging and testing in development.

```typescript
import { queueDevTools, devHelpers } from '@/lib/queue';

// Quick inspection
const inspection = await devHelpers.inspect('email');

// Create test jobs
await devHelpers.test();

// Clear all queues
await devHelpers.clear();

// Start real-time monitoring
devHelpers.monitor();
```

## Job Types

### Email Jobs
Handle batch email sending with retry logic and rate limiting.

```typescript
interface EmailJobData {
  campaignId: string;
  tenantId: string;
  recipients: Array<{
    email: string;
    name?: string;
    personalizations?: Record<string, any>;
  }>;
  batchSize?: number;
}
```

### Analytics Jobs
Process analytics aggregation and reporting.

```typescript
interface AnalyticsJobData {
  campaignId: string;
  tenantId: string;
  eventType: 'campaign-complete' | 'daily-aggregation';
  data?: Record<string, any>;
}
```

### AI Jobs
Handle AI-powered content generation and optimization.

```typescript
interface AIJobData {
  tenantId: string;
  type: 'content-generation' | 'subject-optimization' | 'campaign-insights';
  data: Record<string, any>;
}
```

## Configuration

### Environment Variables
```bash
REDIS_URL=redis://localhost:6379
```

### Queue Configuration
Each queue has specific settings for optimal performance:

- **Email Queue**: High concurrency (5), priority-based processing
- **Analytics Queue**: Medium concurrency (3), batch processing
- **AI Queue**: Low concurrency (2), rate limit respect

## Development API

A development API is available at `/api/dev/queue` for testing and monitoring:

### GET Endpoints
```bash
# Get dashboard data
GET /api/dev/queue?action=dashboard

# Inspect specific queue
GET /api/dev/queue?action=inspect&queue=email

# Get queue statistics
GET /api/dev/queue?action=stats&queue=email

# Health check
GET /api/dev/queue?action=health

# Get metrics
GET /api/dev/queue?action=metrics&queue=email

# Get errors
GET /api/dev/queue?action=errors&queue=email&limit=10

# Generate report
GET /api/dev/queue?action=report
```

### POST Endpoints
```bash
# Create test jobs
POST /api/dev/queue?action=test

# Clear queues
POST /api/dev/queue?action=clear&queue=email

# Pause queue
POST /api/dev/queue?action=pause&queue=email

# Resume queue
POST /api/dev/queue?action=resume&queue=email

# Performance test
POST /api/dev/queue?action=performance
Content-Type: application/json
{ "jobCount": 100 }
```

## Usage Examples

### Basic Job Scheduling
```typescript
import { queueManager } from '@/lib/queue';

// Schedule immediate email job
const emailJob = await queueManager.scheduleEmailJob('welcome-email', {
  campaignId: 'welcome-123',
  tenantId: 'company-456',
  recipients: [{ email: 'new-user@example.com' }],
});

// Schedule delayed job
const delayedJob = await queueManager.scheduleEmailJob('reminder-email', {
  campaignId: 'reminder-123',
  tenantId: 'company-456',
  recipients: [{ email: 'user@example.com' }],
}, {
  delay: 24 * 60 * 60 * 1000, // 24 hours
});

// Schedule recurring analytics
const recurringJob = await queueManager.scheduleRecurringAnalytics('company-456');
```

### Monitoring and Error Handling
```typescript
import { queueMonitor } from '@/lib/queue';

// Monitor queue health
const health = queueMonitor.getQueueHealth('email');
if (health.status === 'critical') {
  console.error('Email queue is in critical state!');
}

// Get recent errors for investigation
const errors = queueMonitor.getRecentErrors(20);
errors.forEach(error => {
  console.log(`Job ${error.jobId} failed: ${error.error}`);
});
```

### Development and Testing
```typescript
import { queueDevTools } from '@/lib/queue';

// Create test data for development
await queueDevTools.createTestJobs();

// Performance testing
const result = await queueDevTools.performanceTest(1000);
console.log(`Created ${result.jobsCreated} jobs in ${result.duration}ms`);

// Export queue data for analysis
const exportData = await queueDevTools.exportQueueData('email');
```

## Testing

### Unit Tests
```bash
pnpm test:run src/__tests__/unit/queue-config.test.ts
```

### Integration Tests (requires Redis)
```bash
# Start Redis first
redis-server

# Run integration tests
pnpm test:run src/__tests__/integration/queue-basic.test.ts
```

## Production Considerations

### Scaling
- **Horizontal scaling**: Run multiple worker instances
- **Queue partitioning**: Separate queues by tenant or priority
- **Resource monitoring**: Monitor Redis memory and CPU usage

### Monitoring
- **Health checks**: Regular queue health monitoring
- **Alerting**: Set up alerts for high error rates or stalled jobs
- **Metrics**: Track job processing times and success rates

### Error Handling
- **Retry policies**: Configure appropriate retry attempts and delays
- **Dead letter queues**: Handle permanently failed jobs
- **Circuit breakers**: Prevent cascade failures

### Security
- **Redis authentication**: Use Redis AUTH in production
- **Network security**: Secure Redis network access
- **Job data**: Sanitize and validate job data

## Troubleshooting

### Common Issues

1. **Redis Connection Errors**
   - Check Redis server status
   - Verify connection string
   - Check network connectivity

2. **Jobs Not Processing**
   - Ensure workers are started
   - Check queue pause status
   - Verify job data format

3. **High Error Rates**
   - Review error logs
   - Check external service availability
   - Adjust retry policies

4. **Performance Issues**
   - Monitor Redis memory usage
   - Adjust worker concurrency
   - Optimize job processing logic

### Debug Commands
```typescript
// Check queue status
const stats = await queueManager.getAllQueueStats();

// Inspect failed jobs
const failedJobs = await queueManager.getFailedJobs('email', 10);

// Health check
const health = await queueManager.healthCheck();

// Clear stuck jobs
await queueManager.cleanQueue('email', 0);
```

## Contributing

When adding new job types or queue functionality:

1. **Define interfaces** in the main index file
2. **Add worker logic** in the workers file
3. **Update monitoring** to track new job types
4. **Add tests** for new functionality
5. **Update documentation** with usage examples

## Dependencies

- **BullMQ**: Queue management and job processing
- **ioredis**: Redis client for Node.js
- **Redis**: In-memory data store for job queues

## License

This queue system is part of the Newsletter SaaS Platform and follows the same license terms.