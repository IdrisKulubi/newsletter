# Newsletter SaaS Platform - Vercel Deployment

This document provides a quick start guide for deploying the Newsletter SaaS Platform on Vercel.

## Quick Start

### Prerequisites

- Vercel account
- PostgreSQL database (Neon, Supabase, or PlanetScale recommended)
- Redis instance (Upstash recommended)
- Cloudflare R2 bucket
- Resend API key
- OpenAI API key

### 1. Database Setup

Choose a PostgreSQL provider:

**Option A: Neon (Recommended)**
```bash
# Create account at https://neon.tech
# Create database and get connection string
```

**Option B: Supabase**
```bash
# Create account at https://supabase.com
# Create project and get connection string
```

**Option C: PlanetScale**
```bash
# Create account at https://planetscale.com
# Create database and get connection string
```

### 2. Redis Setup (Upstash)

```bash
# Create account at https://upstash.com
# Create Redis database
# Get connection URL and token
```

### 3. Deploy to Vercel

**Option A: Deploy with Vercel CLI**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from project root
cd newsletter
vercel

# Follow prompts to configure project
```

**Option B: Deploy via GitHub**
1. Push code to GitHub repository
2. Connect repository to Vercel
3. Configure environment variables
4. Deploy automatically

### 4. Environment Variables

Configure these in Vercel dashboard or via CLI:

```bash
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..." # For migrations

# Redis
REDIS_URL="redis://..."
REDIS_TOKEN="..." # For Upstash

# Authentication
BETTER_AUTH_SECRET="your-secret-key"
BETTER_AUTH_URL="https://your-app.vercel.app"

# Email
RESEND_API_KEY="re_..."

# AI
OPENAI_API_KEY="sk-..."

# Storage
CLOUDFLARE_R2_ACCESS_KEY_ID="..."
CLOUDFLARE_R2_SECRET_ACCESS_KEY="..."
CLOUDFLARE_R2_BUCKET_NAME="..."
CLOUDFLARE_R2_ENDPOINT="..."

# App
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"
```

### 5. Database Migration

Run migrations after deployment:

```bash
# Using Vercel CLI
vercel env pull .env.local
pnpm db:push

# Or set up GitHub Actions for automatic migrations
```

### 6. Verify Deployment

```bash
# Check health endpoint
curl https://your-app.vercel.app/api/health

# Test authentication
curl https://your-app.vercel.app/api/auth/session
```

## Production Considerations

### Custom Domains

1. Add custom domain in Vercel dashboard
2. Configure DNS records
3. Update `BETTER_AUTH_URL` environment variable

### Monitoring

Use Vercel's built-in monitoring:
- **Analytics**: Vercel Analytics for performance metrics
- **Speed Insights**: Core Web Vitals tracking
- **Logs**: Real-time function logs in dashboard

### Scaling

Vercel automatically scales based on traffic:
- **Serverless Functions**: Auto-scaling based on requests
- **Edge Network**: Global CDN for static assets
- **Database**: Use connection pooling for high traffic

## Troubleshooting

### Common Issues

**Build Failures**
```bash
# Check build logs in Vercel dashboard
# Ensure all dependencies are in package.json
# Verify TypeScript compilation locally
```

**Database Connection Issues**
```bash
# Verify DATABASE_URL format
# Check database provider connection limits
# Use connection pooling for production
```

**Environment Variables**
```bash
# Ensure all required variables are set
# Check variable names match exactly
# Redeploy after environment changes
```

### Performance Optimization

**Database**
- Use connection pooling
- Implement proper indexing
- Consider read replicas for high traffic

**Caching**
- Leverage Vercel's Edge Cache
- Implement Redis caching for frequent queries
- Use Next.js built-in caching strategies

**Assets**
- Optimize images with Next.js Image component
- Use Cloudflare R2 for file storage
- Enable compression in next.config.ts

## Support

For deployment issues:
- Check Vercel documentation
- Review function logs in Vercel dashboard
- Monitor database and Redis metrics
- Use Vercel community forums for help