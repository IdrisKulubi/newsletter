# Vercel Deployment Checklist

Use this checklist to ensure a smooth deployment to Vercel.

## Pre-Deployment Setup

### 1. Database Setup
- [ ] Create PostgreSQL database (Neon/Supabase/PlanetScale)
- [ ] Note down `DATABASE_URL` and `DIRECT_URL`
- [ ] Test database connection locally

### 2. Redis Setup
- [ ] Create Upstash Redis database
- [ ] Note down `REDIS_URL` and `REDIS_TOKEN`
- [ ] Test Redis connection locally

### 3. External Services
- [ ] Set up Resend account and get API key
- [ ] Set up OpenAI account and get API key
- [ ] Set up Cloudflare R2 bucket and get credentials
- [ ] Generate secure `BETTER_AUTH_SECRET` (min 32 characters)

### 4. Code Preparation
- [ ] Ensure all code is committed to Git
- [ ] Run `pnpm type-check` to verify TypeScript
- [ ] Run `pnpm lint` to check code quality
- [ ] Test build locally with `pnpm build`

## Vercel Deployment

### 1. Project Setup
- [ ] Push code to GitHub repository
- [ ] Connect repository to Vercel
- [ ] Configure project settings in Vercel dashboard

### 2. Environment Variables
Set these in Vercel dashboard:

**Database**
- [ ] `DATABASE_URL`
- [ ] `DIRECT_URL`

**Redis**
- [ ] `REDIS_URL`
- [ ] `REDIS_TOKEN`

**Authentication**
- [ ] `BETTER_AUTH_SECRET`
- [ ] `BETTER_AUTH_URL` (your Vercel app URL)

**External APIs**
- [ ] `RESEND_API_KEY`
- [ ] `OPENAI_API_KEY`

**Storage**
- [ ] `CLOUDFLARE_R2_ACCESS_KEY_ID`
- [ ] `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- [ ] `CLOUDFLARE_R2_BUCKET_NAME`
- [ ] `CLOUDFLARE_R2_ENDPOINT`

**App Configuration**
- [ ] `NEXT_PUBLIC_APP_URL`
- [ ] `NODE_ENV=production`

### 3. Deploy
- [ ] Trigger deployment from Vercel dashboard
- [ ] Monitor build logs for errors
- [ ] Wait for deployment to complete

## Post-Deployment

### 1. Database Migration
- [ ] Pull environment variables: `vercel env pull .env.local`
- [ ] Run migrations: `pnpm db:push`
- [ ] Seed initial data: `pnpm db:seed` (optional)

### 2. Verification
- [ ] Test health endpoint: `https://your-app.vercel.app/api/health`
- [ ] Test authentication flow
- [ ] Create test tenant and verify functionality
- [ ] Send test email campaign
- [ ] Check analytics dashboard

### 3. Monitoring Setup
- [ ] Enable Vercel Analytics
- [ ] Enable Speed Insights
- [ ] Set up error monitoring
- [ ] Configure alerts for critical functions

### 4. Custom Domain (Optional)
- [ ] Add custom domain in Vercel dashboard
- [ ] Configure DNS records
- [ ] Update `BETTER_AUTH_URL` to custom domain
- [ ] Test SSL certificate

## Production Optimization

### Performance
- [ ] Enable Vercel Analytics
- [ ] Monitor Core Web Vitals
- [ ] Optimize database queries
- [ ] Set up proper caching strategies

### Security
- [ ] Review environment variables security
- [ ] Test authentication flows
- [ ] Verify CORS settings
- [ ] Check rate limiting

### Monitoring
- [ ] Set up uptime monitoring
- [ ] Configure error alerts
- [ ] Monitor function performance
- [ ] Track database connection usage

## Troubleshooting

If deployment fails, check:
- [ ] Build logs in Vercel dashboard
- [ ] Environment variables are set correctly
- [ ] Database connection is working
- [ ] All dependencies are in package.json
- [ ] TypeScript compilation passes

## Rollback Plan

In case of issues:
- [ ] Revert to previous deployment in Vercel
- [ ] Check function logs for errors
- [ ] Verify database migrations
- [ ] Test critical functionality

## Success Criteria

Deployment is successful when:
- [ ] Application loads without errors
- [ ] Authentication works correctly
- [ ] Database operations function properly
- [ ] Email sending works
- [ ] File uploads work
- [ ] Analytics are tracking
- [ ] All critical user flows work

---

**Note**: Keep this checklist updated as your deployment process evolves.