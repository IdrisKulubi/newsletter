# Vercel Deployment Guide

Complete guide for deploying the Newsletter SaaS Platform on Vercel.

## Prerequisites

### Required Services

1. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
2. **Database** - Choose one:
   - [Neon](https://neon.tech) (Recommended)
   - [Supabase](https://supabase.com)
   - [PlanetScale](https://planetscale.com)
3. **Redis** - [Upstash](https://upstash.com) (Recommended)
4. **Email** - [Resend](https://resend.com)
5. **AI** - [OpenAI](https://openai.com)
6. **Storage** - [Cloudflare R2](https://cloudflare.com/products/r2/)

## Step-by-Step Deployment

### 1. Database Setup (Neon)

```bash
# 1. Create account at https://neon.tech
# 2. Create new project
# 3. Copy connection strings:
#    - DATABASE_URL (pooled connection)
#    - DIRECT_URL (direct connection for migrations)
```

### 2. Redis Setup (Upstash)

```bash
# 1. Create account at https://upstash.com
# 2. Create Redis database
# 3. Copy connection details:
#    - REDIS_URL
#    - REDIS_TOKEN
```

### 3. Cloudflare R2 Setup

```bash
# 1. Create Cloudflare account
# 2. Go to R2 Object Storage
# 3. Create bucket
# 4. Create API token with R2 permissions
# 5. Note down:
#    - Access Key ID
#    - Secret Access Key
#    - Bucket name
#    - Endpoint URL
```

### 4. Deploy to Vercel

**Option A: GitHub Integration (Recommended)**

1. Push code to GitHub repository
2. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Import your GitHub repository
5. Configure environment variables (see below)
6. Deploy

**Option B: Vercel CLI**

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from project directory
cd newsletter
vercel

# Follow prompts to configure
```

### 5. Environment Variables

Configure in Vercel dashboard under Settings > Environment Variables:

```env
# Database
DATABASE_URL=postgresql://username:password@host/database?sslmode=require
DIRECT_URL=postgresql://username:password@host/database?sslmode=require

# Redis (Upstash)
REDIS_URL=rediss://default:password@host:port
REDIS_TOKEN=your_upstash_token

# Authentication
BETTER_AUTH_SECRET=your-super-secret-key-min-32-chars
BETTER_AUTH_URL=https://your-app.vercel.app

# Email (Resend)
RESEND_API_KEY=re_your_api_key

# AI (OpenAI)
OPENAI_API_KEY=sk-your_openai_key

# Storage (Cloudflare R2)
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_key
CLOUDFLARE_R2_BUCKET_NAME=your_bucket_name
CLOUDFLARE_R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com

# App Configuration
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NODE_ENV=production
```

### 6. Custom Domain (Optional)

1. Go to Vercel dashboard > Domains
2. Add your custom domain
3. Configure DNS records as shown
4. Update `BETTER_AUTH_URL` to use custom domain

## Post-Deployment Setup

### 1. Database Migration

After first deployment, run migrations:

```bash
# Pull environment variables locally
vercel env pull .env.local

# Run database migrations
pnpm db:push

# Seed initial data (optional)
pnpm db:seed
```

### 2. Verify Deployment

Test key endpoints:

```bash
# Health check
curl https://your-app.vercel.app/api/health

# Authentication
curl https://your-app.vercel.app/api/auth/session
```

### 3. Set up Monitoring

Enable Vercel's built-in monitoring:

1. **Analytics**: Go to Analytics tab in dashboard
2. **Speed Insights**: Enable in project settings
3. **Function Logs**: Monitor in Functions tab

## Production Optimization

### Performance

1. **Enable Analytics**
   ```bash
   # Add to package.json
   npm install @vercel/analytics
   ```

2. **Speed Insights**
   ```bash
   npm install @vercel/speed-insights
   ```

3. **Edge Config** (for feature flags)
   ```bash
   npm install @vercel/edge-config
   ```

### Security

1. **Environment Variables**: Never commit secrets
2. **CORS**: Configure in middleware for API routes
3. **Rate Limiting**: Implement in API routes
4. **Authentication**: Verify JWT tokens properly

### Scaling

Vercel automatically handles:
- **Auto-scaling**: Functions scale based on traffic
- **Global CDN**: Static assets served from edge
- **Cold starts**: Optimized for serverless functions

## Troubleshooting

### Common Issues

**Build Failures**
```bash
# Check build logs in Vercel dashboard
# Ensure TypeScript compiles locally: pnpm type-check
# Verify all dependencies in package.json
```

**Database Connection**
```bash
# Verify connection string format
# Check database provider status
# Ensure SSL is enabled for production
```

**Function Timeouts**
```bash
# Check function duration in dashboard
# Optimize slow database queries
# Consider upgrading Vercel plan for longer timeouts
```

**Environment Variables**
```bash
# Ensure all required variables are set
# Check for typos in variable names
# Redeploy after environment changes
```

### Performance Issues

**Slow Database Queries**
- Add proper indexes
- Use connection pooling
- Consider read replicas

**Large Bundle Size**
- Analyze bundle with `@next/bundle-analyzer`
- Use dynamic imports for large components
- Optimize images and assets

**Cold Starts**
- Keep functions warm with cron jobs
- Optimize function initialization
- Use edge functions for simple operations

## Maintenance

### Regular Tasks

1. **Monitor Logs**: Check function logs weekly
2. **Update Dependencies**: Monthly security updates
3. **Database Maintenance**: Monitor connection usage
4. **Performance**: Review analytics monthly

### Backup Strategy

1. **Database**: Set up automated backups with your provider
2. **Environment**: Keep secure backup of environment variables
3. **Code**: Use Git tags for release versions

## Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Vercel Community](https://github.com/vercel/vercel/discussions)
- [Neon Documentation](https://neon.tech/docs)
- [Upstash Documentation](https://docs.upstash.com)