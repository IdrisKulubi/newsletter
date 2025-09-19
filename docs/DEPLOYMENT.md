# Deployment Guide

This guide covers deploying the Newsletter SaaS Platform to production and staging environments.

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL database (managed or self-hosted)
- Redis instance (managed or self-hosted)
- Cloudflare R2 bucket configured
- Resend API account
- OpenAI API account
- Domain name configured

## Environment Setup

### 1. Environment Variables

Copy the appropriate environment template:

```bash
# For production
cp .env.production .env.production.local

# For staging
cp .env.staging .env.staging.local
```

Fill in all required values in your `.env.{environment}.local` file.

### 2. Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `BETTER_AUTH_SECRET` | Authentication secret (32+ chars) | `your-secure-secret-key-here` |
| `RESEND_API_KEY` | Resend email service API key | `re_xxxxxxxxxx` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-xxxxxxxxxx` |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key | `your-access-key` |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key | `your-secret-key` |
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID | `your-account-id` |
| `R2_BUCKET_NAME` | Cloudflare R2 bucket name | `newsletter-assets-prod` |
| `REDIS_URL` | Redis connection string | `redis://host:6379` |

## Deployment Methods

### Method 1: Docker Compose (Recommended)

1. **Build and deploy:**
   ```bash
   ./scripts/deploy.sh production
   ```

2. **Or manually:**
   ```bash
   # Build images
   docker-compose build

   # Run migrations
   docker-compose run --rm newsletter-app pnpm tsx scripts/migrate-production.ts

   # Start services
   docker-compose up -d
   ```

### Method 2: Manual Deployment

1. **Install dependencies:**
   ```bash
   pnpm install --frozen-lockfile --prod
   ```

2. **Build application:**
   ```bash
   pnpm build
   ```

3. **Run migrations:**
   ```bash
   pnpm tsx scripts/migrate-production.ts
   ```

4. **Start application:**
   ```bash
   NODE_ENV=production pnpm start
   ```

5. **Start worker processes:**
   ```bash
   NODE_ENV=production pnpm tsx scripts/worker.ts
   ```

## Database Setup

### Initial Migration

```bash
# Run database migrations
pnpm tsx scripts/migrate-production.ts

# Seed initial data (staging only or with --seed flag)
pnpm tsx scripts/seed-production.ts
```

### Backup and Restore

```bash
# Create backup
pg_dump $DATABASE_URL > backup.sql

# Restore backup
psql $DATABASE_URL < backup.sql
```

## Monitoring Setup

### 1. Start Monitoring Stack

```bash
docker-compose -f docker-compose.yml -f monitoring/docker-compose.monitoring.yml up -d
```

### 2. Access Monitoring Tools

- **Grafana**: http://localhost:3001 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093

### 3. Configure Alerts

Edit `monitoring/alertmanager.yml` to configure notification channels:

```yaml
route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
- name: 'web.hook'
  slack_configs:
  - api_url: 'YOUR_SLACK_WEBHOOK_URL'
    channel: '#alerts'
    title: 'Newsletter Platform Alert'
    text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

## Health Checks

The application provides several health check endpoints:

- **Main health check**: `GET /api/health`
- **Metrics**: `GET /api/metrics`

Example health check response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": { "status": "healthy", "latency": 45 },
    "redis": { "status": "healthy", "latency": 12 },
    "storage": { "status": "healthy" }
  },
  "uptime": 3600000
}
```

## SSL/TLS Configuration

### Using Reverse Proxy (Recommended)

Configure nginx or similar:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Scaling

### Horizontal Scaling

1. **Application instances:**
   ```bash
   docker-compose up -d --scale newsletter-app=3
   ```

2. **Worker instances:**
   ```bash
   docker-compose up -d --scale worker=5
   ```

### Database Scaling

- Use read replicas for analytics queries
- Implement connection pooling (already configured)
- Consider database sharding for very large deployments

### Redis Scaling

- Use Redis Cluster for high availability
- Implement Redis Sentinel for automatic failover

## Troubleshooting

### Common Issues

1. **Database connection errors:**
   ```bash
   # Check database connectivity
   docker-compose exec newsletter-app pnpm tsx -e "console.log('DB test')"
   ```

2. **Redis connection errors:**
   ```bash
   # Check Redis connectivity
   docker-compose exec redis redis-cli ping
   ```

3. **Email delivery issues:**
   - Verify Resend API key
   - Check domain authentication (DKIM/SPF)
   - Monitor webhook endpoints

4. **Storage issues:**
   - Verify R2 credentials
   - Check bucket permissions
   - Test file upload/download

### Log Analysis

```bash
# View application logs
docker-compose logs -f newsletter-app

# View worker logs
docker-compose logs -f worker

# View database logs
docker-compose logs -f postgres

# View Redis logs
docker-compose logs -f redis
```

## Security Checklist

- [ ] All environment variables are properly secured
- [ ] Database uses SSL connections
- [ ] Redis is password protected
- [ ] API keys are rotated regularly
- [ ] HTTPS is enforced
- [ ] Security headers are configured
- [ ] Rate limiting is enabled
- [ ] Input validation is implemented
- [ ] CSRF protection is active

## Performance Optimization

### Database Optimization

- Enable connection pooling (configured)
- Use appropriate indexes
- Monitor slow queries
- Regular VACUUM and ANALYZE

### Caching Strategy

- Redis caching for frequently accessed data
- CDN for static assets
- Application-level caching

### Monitoring Key Metrics

- Response times
- Error rates
- Database query performance
- Queue processing times
- Memory and CPU usage
- Email delivery rates

## Backup Strategy

### Automated Backups

```bash
# Database backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL | gzip > "backup_${DATE}.sql.gz"

# Upload to R2 or S3
aws s3 cp "backup_${DATE}.sql.gz" s3://your-backup-bucket/
```

### Recovery Procedures

1. **Database recovery:**
   ```bash
   # Stop application
   docker-compose stop newsletter-app worker

   # Restore database
   gunzip -c backup_20240101_120000.sql.gz | psql $DATABASE_URL

   # Start application
   docker-compose start newsletter-app worker
   ```

2. **Full system recovery:**
   - Restore database from backup
   - Restore Redis data if needed
   - Restore uploaded files from R2/S3
   - Restart all services

## Maintenance

### Regular Maintenance Tasks

1. **Weekly:**
   - Review error logs
   - Check disk space
   - Monitor performance metrics

2. **Monthly:**
   - Update dependencies
   - Rotate API keys
   - Review security logs
   - Clean up old data

3. **Quarterly:**
   - Security audit
   - Performance review
   - Backup testing
   - Disaster recovery testing

### Updates and Patches

```bash
# Update application
git pull origin main
docker-compose build
docker-compose up -d

# Update dependencies
pnpm update
pnpm audit fix
```

## Support and Monitoring

### Key Metrics to Monitor

- Application uptime
- Response times (95th percentile < 2s)
- Error rate (< 1%)
- Email delivery rate (> 95%)
- Database query times
- Queue processing times
- Memory usage (< 80%)
- CPU usage (< 70%)
- Disk usage (< 80%)

### Alert Thresholds

- Application down: Immediate
- High error rate: 2 minutes
- Slow responses: 3 minutes
- Database issues: 30 seconds
- Queue backlog: 5 minutes
- Resource usage: 5 minutes

For additional support, refer to the troubleshooting runbook and monitoring dashboards.