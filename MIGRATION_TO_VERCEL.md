# Migration Guide: Docker to Vercel

This guide helps you migrate from a Docker-based deployment to Vercel.

## Overview

The Newsletter SaaS Platform has been optimized for Vercel deployment, offering:
- **Serverless architecture** with automatic scaling
- **Global CDN** for better performance
- **Built-in monitoring** and analytics
- **Zero-config deployment** with GitHub integration
- **Cost optimization** with pay-per-use pricing

## Migration Steps

### 1. Backup Current Data

Before migrating, ensure you have backups:

```bash
# Backup database
pg_dump $DATABASE_URL > backup.sql

# Backup environment variables
cp .env.production .env.backup

# Backup uploaded files (if using local storage)
tar -czf uploads-backup.tar.gz uploads/
```

### 2. Set Up New Services

**Database Migration Options:**

**Option A: Migrate to Neon (Recommended)**
```bash
# 1. Create Neon account and database
# 2. Import existing data:
psql $NEW_DATABASE_URL < backup.sql
```

**Option B: Keep existing PostgreSQL**
```bash
# Ensure your database is accessible from Vercel
# Update connection string for external access
```

**Redis Migration:**
```bash
# Migrate to Upstash Redis
# 1. Create Upstash account
# 2. Export existing Redis data (if needed)
# 3. Import to new Redis instance
```

### 3. Update Configuration

**Remove Docker-specific files:**
- `Dockerfile`
- `Dockerfile.worker`
- `docker-compose.yml`
- `.dockerignore`

**Update Next.js config:**
```typescript
// Remove Docker-specific settings
// Add Vercel optimizations
serverExternalPackages: ["postgres", "ioredis"]
```

**Update package.json scripts:**
```json
{
  "scripts": {
    "vercel-build": "pnpm db:push && pnpm build",
    "deploy:production": "vercel --prod"
  }
}
```

### 4. Environment Variables Mapping

Map your existing environment variables:

| Docker Environment | Vercel Environment | Notes |
|-------------------|-------------------|-------|
| `DATABASE_URL` | `DATABASE_URL` | Update for new provider |
| `REDIS_URL` | `REDIS_URL` | Update for Upstash |
| - | `REDIS_TOKEN` | New for Upstash |
| `APP_URL` | `NEXT_PUBLIC_APP_URL` | Public variable |
| - | `DIRECT_URL` | For database migrations |

### 5. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add DATABASE_URL
vercel env add REDIS_URL
# ... add all other variables

# Deploy to production
vercel --prod
```

### 6. Update DNS

If using custom domains:
```bash
# Update DNS records to point to Vercel
# A record: 76.76.19.61
# CNAME: cname.vercel-dns.com
```

### 7. Verify Migration

Test all functionality:
- [ ] Authentication works
- [ ] Database operations function
- [ ] Email sending works
- [ ] File uploads work
- [ ] Background jobs process
- [ ] Analytics track correctly

## Key Differences

### Architecture Changes

| Aspect | Docker | Vercel |
|--------|--------|--------|
| **Hosting** | Self-hosted containers | Serverless functions |
| **Scaling** | Manual scaling | Automatic scaling |
| **Database** | Self-managed | Managed service |
| **Redis** | Self-hosted | Managed service |
| **Monitoring** | Custom setup | Built-in analytics |
| **SSL** | Manual setup | Automatic |

### Performance Benefits

- **Cold starts**: Optimized for serverless
- **Global distribution**: Edge network
- **Automatic optimization**: Image and asset optimization
- **Caching**: Built-in edge caching

### Cost Considerations

**Vercel Pricing:**
- **Hobby**: Free for personal projects
- **Pro**: $20/month per user
- **Enterprise**: Custom pricing

**Typical savings:**
- No server maintenance costs
- Pay-per-use pricing
- Reduced DevOps overhead

## Rollback Plan

If issues occur during migration:

1. **Keep old deployment running** during migration
2. **Use DNS switching** for quick rollback
3. **Maintain database backups** for data recovery
4. **Document all changes** for easy reversal

## Post-Migration Optimization

### 1. Enable Vercel Features

```bash
# Add Vercel Analytics
npm install @vercel/analytics

# Add Speed Insights
npm install @vercel/speed-insights
```

### 2. Optimize for Serverless

- **Database connections**: Use connection pooling
- **Function duration**: Optimize slow operations
- **Bundle size**: Minimize function payload
- **Cold starts**: Implement warming strategies

### 3. Set Up Monitoring

- Enable Vercel Analytics
- Configure error tracking
- Set up uptime monitoring
- Monitor function performance

## Troubleshooting

### Common Migration Issues

**Database Connection Errors**
```bash
# Ensure connection string format is correct
# Check SSL requirements
# Verify network access
```

**Function Timeouts**
```bash
# Optimize database queries
# Use connection pooling
# Consider upgrading Vercel plan
```

**Environment Variable Issues**
```bash
# Ensure all variables are set in Vercel
# Check for typos in variable names
# Verify public vs private variables
```

## Support

For migration assistance:
- [Vercel Documentation](https://vercel.com/docs)
- [Migration Support](https://vercel.com/help)
- [Community Forums](https://github.com/vercel/vercel/discussions)

---

**Migration Timeline**: Plan for 2-4 hours depending on data size and complexity.