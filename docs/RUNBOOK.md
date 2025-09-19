# Operations Runbook

This runbook provides step-by-step procedures for common operational tasks and incident response.

## Table of Contents

1. [Emergency Procedures](#emergency-procedures)
2. [Common Issues](#common-issues)
3. [Maintenance Tasks](#maintenance-tasks)
4. [Monitoring and Alerts](#monitoring-and-alerts)
5. [Performance Tuning](#performance-tuning)
6. [Data Management](#data-management)

## Emergency Procedures

### Application Down

**Symptoms:**
- Health check endpoint returns 503
- Users cannot access the application
- Monitoring alerts firing

**Immediate Actions:**

1. **Check service status:**
   ```bash
   docker-compose ps
   curl -f http://localhost:3000/api/health
   ```

2. **Check logs:**
   ```bash
   docker-compose logs --tail=100 newsletter-app
   ```

3. **Restart services if needed:**
   ```bash
   docker-compose restart newsletter-app
   ```

4. **If database issues:**
   ```bash
   docker-compose logs postgres
   docker-compose restart postgres
   ```

5. **If Redis issues:**
   ```bash
   docker-compose logs redis
   docker-compose restart redis
   ```

**Escalation:** If restart doesn't resolve, check database connectivity and disk space.

### Database Connection Issues

**Symptoms:**
- Database health check failing
- Connection timeout errors
- "too many connections" errors

**Actions:**

1. **Check database status:**
   ```bash
   docker-compose exec postgres pg_isready
   ```

2. **Check connection count:**
   ```bash
   docker-compose exec postgres psql -U newsletter -c "SELECT count(*) FROM pg_stat_activity;"
   ```

3. **Kill long-running queries:**
   ```bash
   docker-compose exec postgres psql -U newsletter -c "
   SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE state = 'active' AND query_start < now() - interval '5 minutes';"
   ```

4. **Restart database if needed:**
   ```bash
   docker-compose restart postgres
   ```

### High Memory Usage

**Symptoms:**
- Memory usage > 90%
- Application becoming unresponsive
- OOM killer messages in logs

**Actions:**

1. **Check memory usage:**
   ```bash
   docker stats
   free -h
   ```

2. **Identify memory-heavy processes:**
   ```bash
   docker-compose exec newsletter-app ps aux --sort=-%mem | head -10
   ```

3. **Restart application:**
   ```bash
   docker-compose restart newsletter-app worker
   ```

4. **Scale down if needed:**
   ```bash
   docker-compose up -d --scale worker=1
   ```

### Email Delivery Issues

**Symptoms:**
- High email failure rate
- Resend API errors
- Bounce rate alerts

**Actions:**

1. **Check Resend API status:**
   ```bash
   curl -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/domains
   ```

2. **Check queue status:**
   ```bash
   docker-compose exec redis redis-cli llen bull:campaign-emails:waiting
   docker-compose exec redis redis-cli llen bull:campaign-emails:failed
   ```

3. **Review failed jobs:**
   ```bash
   docker-compose logs worker | grep "failed"
   ```

4. **Restart worker processes:**
   ```bash
   docker-compose restart worker
   ```

## Common Issues

### Issue: Queue Backlog

**Symptoms:**
- Large number of waiting jobs
- Slow email processing
- Queue size alerts

**Diagnosis:**
```bash
# Check queue sizes
docker-compose exec redis redis-cli llen bull:campaign-emails:waiting
docker-compose exec redis redis-cli llen bull:ai-insights:waiting

# Check worker status
docker-compose logs worker --tail=50
```

**Resolution:**
```bash
# Scale up workers
docker-compose up -d --scale worker=5

# Or restart workers
docker-compose restart worker
```

### Issue: Slow Database Queries

**Symptoms:**
- High database latency
- Slow API responses
- Database query time alerts

**Diagnosis:**
```bash
# Check slow queries
docker-compose exec postgres psql -U newsletter -c "
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;"
```

**Resolution:**
```bash
# Analyze and vacuum tables
docker-compose exec postgres psql -U newsletter -c "ANALYZE;"
docker-compose exec postgres psql -U newsletter -c "VACUUM ANALYZE;"

# Check for missing indexes
# Review query execution plans
```

### Issue: High CPU Usage

**Symptoms:**
- CPU usage > 80%
- Slow response times
- High load average

**Diagnosis:**
```bash
# Check CPU usage
docker stats
top -p $(docker-compose exec newsletter-app pgrep node)
```

**Resolution:**
```bash
# Scale horizontally
docker-compose up -d --scale newsletter-app=3

# Or restart to clear any memory leaks
docker-compose restart newsletter-app
```

### Issue: Storage Issues

**Symptoms:**
- File upload failures
- R2 connection errors
- Storage health check failing

**Diagnosis:**
```bash
# Test R2 connectivity
aws s3 ls s3://$R2_BUCKET_NAME --endpoint-url=https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com
```

**Resolution:**
```bash
# Verify credentials
echo $R2_ACCESS_KEY_ID
echo $R2_SECRET_ACCESS_KEY

# Check bucket permissions
# Restart application
docker-compose restart newsletter-app
```

## Maintenance Tasks

### Daily Tasks

1. **Check system health:**
   ```bash
   curl -s http://localhost:3000/api/health | jq .
   ```

2. **Review error logs:**
   ```bash
   docker-compose logs --since=24h newsletter-app | grep -i error
   ```

3. **Check disk space:**
   ```bash
   df -h
   docker system df
   ```

### Weekly Tasks

1. **Clean up Docker resources:**
   ```bash
   docker system prune -f
   docker volume prune -f
   ```

2. **Review performance metrics:**
   - Check Grafana dashboards
   - Review slow queries
   - Monitor queue processing times

3. **Update SSL certificates (if needed):**
   ```bash
   certbot renew --dry-run
   ```

### Monthly Tasks

1. **Database maintenance:**
   ```bash
   # Full vacuum and analyze
   docker-compose exec postgres psql -U newsletter -c "VACUUM FULL ANALYZE;"
   
   # Update statistics
   docker-compose exec postgres psql -U newsletter -c "ANALYZE;"
   ```

2. **Security updates:**
   ```bash
   # Update base images
   docker-compose pull
   docker-compose up -d
   
   # Update dependencies
   pnpm update
   pnpm audit fix
   ```

3. **Backup verification:**
   ```bash
   # Test backup restore
   ./scripts/test-backup-restore.sh
   ```

### Quarterly Tasks

1. **Security audit:**
   - Review access logs
   - Rotate API keys
   - Update passwords
   - Review user permissions

2. **Performance review:**
   - Analyze growth trends
   - Plan capacity upgrades
   - Review and optimize queries

3. **Disaster recovery test:**
   - Test full system restore
   - Verify backup integrity
   - Update recovery procedures

## Monitoring and Alerts

### Key Dashboards

1. **Application Overview:**
   - Request rate and latency
   - Error rate
   - Active users
   - Email delivery metrics

2. **Infrastructure:**
   - CPU and memory usage
   - Disk space
   - Network I/O
   - Database performance

3. **Business Metrics:**
   - Campaign creation rate
   - Email open/click rates
   - User registration rate
   - Revenue metrics

### Alert Response Procedures

#### Critical Alerts

**Application Down:**
1. Check service status
2. Review logs for errors
3. Restart services if needed
4. Escalate if not resolved in 5 minutes

**Database Down:**
1. Check database connectivity
2. Review database logs
3. Restart database service
4. Escalate immediately if data corruption suspected

#### Warning Alerts

**High Error Rate:**
1. Identify error patterns in logs
2. Check for recent deployments
3. Monitor for 10 minutes
4. Rollback if errors persist

**High Latency:**
1. Check database query performance
2. Review application metrics
3. Scale resources if needed
4. Investigate root cause

### Log Analysis

**Common log patterns to monitor:**

```bash
# Error patterns
grep -E "(ERROR|FATAL|Exception)" logs/app.log

# Performance issues
grep -E "(timeout|slow|latency)" logs/app.log

# Security events
grep -E "(failed login|rate limit|suspicious)" logs/app.log

# Email delivery issues
grep -E "(bounce|complaint|delivery failed)" logs/app.log
```

## Performance Tuning

### Database Optimization

1. **Query optimization:**
   ```sql
   -- Find slow queries
   SELECT query, mean_exec_time, calls, total_exec_time
   FROM pg_stat_statements 
   ORDER BY mean_exec_time DESC 
   LIMIT 20;
   
   -- Check index usage
   SELECT schemaname, tablename, attname, n_distinct, correlation
   FROM pg_stats
   WHERE schemaname = 'public'
   ORDER BY n_distinct DESC;
   ```

2. **Connection pooling:**
   - Monitor connection count
   - Adjust pool size based on load
   - Use read replicas for analytics

3. **Indexing strategy:**
   ```sql
   -- Add indexes for common queries
   CREATE INDEX CONCURRENTLY idx_campaigns_tenant_created 
   ON campaigns(tenant_id, created_at);
   
   CREATE INDEX CONCURRENTLY idx_email_events_campaign_type 
   ON email_events(campaign_id, event_type);
   ```

### Application Optimization

1. **Caching strategy:**
   ```bash
   # Monitor cache hit rates
   docker-compose exec redis redis-cli info stats | grep keyspace
   
   # Clear cache if needed
   docker-compose exec redis redis-cli flushdb
   ```

2. **Queue optimization:**
   ```bash
   # Monitor queue processing
   docker-compose exec redis redis-cli llen bull:campaign-emails:active
   docker-compose exec redis redis-cli llen bull:campaign-emails:waiting
   
   # Adjust worker concurrency
   # Edit docker-compose.yml worker replicas
   ```

### Resource Scaling

1. **Horizontal scaling:**
   ```bash
   # Scale application
   docker-compose up -d --scale newsletter-app=3
   
   # Scale workers
   docker-compose up -d --scale worker=5
   ```

2. **Vertical scaling:**
   - Increase container memory limits
   - Adjust CPU limits
   - Upgrade server resources

## Data Management

### Backup Procedures

1. **Database backup:**
   ```bash
   # Create backup
   docker-compose exec postgres pg_dump -U newsletter newsletter > backup_$(date +%Y%m%d).sql
   
   # Compress and store
   gzip backup_$(date +%Y%m%d).sql
   aws s3 cp backup_$(date +%Y%m%d).sql.gz s3://backup-bucket/
   ```

2. **File backup:**
   ```bash
   # Sync R2 bucket
   aws s3 sync s3://newsletter-assets s3://newsletter-assets-backup --endpoint-url=https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com
   ```

### Data Retention

1. **Email events cleanup:**
   ```sql
   -- Delete events older than 2 years
   DELETE FROM email_events 
   WHERE created_at < NOW() - INTERVAL '2 years';
   ```

2. **Log rotation:**
   ```bash
   # Configure logrotate
   /var/log/newsletter/*.log {
       daily
       rotate 30
       compress
       delaycompress
       missingok
       notifempty
   }
   ```

### Data Migration

1. **Schema changes:**
   ```bash
   # Generate migration
   pnpm db:generate
   
   # Apply migration
   pnpm tsx scripts/migrate-production.ts
   ```

2. **Data export/import:**
   ```bash
   # Export tenant data
   docker-compose exec postgres pg_dump -U newsletter -t tenants newsletter > tenants_export.sql
   
   # Import data
   docker-compose exec postgres psql -U newsletter newsletter < tenants_export.sql
   ```

## Contact Information

**On-call Engineer:** [Your contact info]
**Database Admin:** [DBA contact info]
**Security Team:** [Security contact info]
**Management:** [Management contact info]

**Escalation Matrix:**
1. Level 1: On-call engineer (0-15 minutes)
2. Level 2: Senior engineer + DBA (15-30 minutes)
3. Level 3: Engineering manager + Security (30+ minutes)

**External Services:**
- Resend Support: [support contact]
- Cloudflare Support: [support contact]
- OpenAI Support: [support contact]