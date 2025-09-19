/**
 * Application configuration
 * Centralizes environment variables and configuration settings
 */

export const config = {
  // Database
  database: {
    url: process.env.DATABASE_URL!,
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10'),
    ssl: process.env.DATABASE_SSL === 'true',
  },

  // Authentication
  auth: {
    secret: process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET!,
    url: process.env.BETTER_AUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000',
  },

  // Cloudflare R2 Storage (S3-compatible)
  r2: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    accountId: process.env.R2_ACCOUNT_ID!,
    bucketName: process.env.R2_BUCKET_NAME!,
    publicUrl: process.env.R2_PUBLIC_URL, // Optional: for public bucket access
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  },

  // Email
  email: {
    resendApiKey: process.env.RESEND_API_KEY!,
  },

  // AI
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY!,
    orgId: process.env.OPENAI_ORG_ID,
  },

  // Application
  app: {
    url: process.env.APP_URL || 'http://localhost:3000',
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000'),
  },

  // Monitoring
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN,
    logLevel: process.env.LOG_LEVEL || 'info',
    enableMetrics: process.env.ENABLE_METRICS === 'true',
  },

  // Security
  security: {
    csrfSecret: process.env.CSRF_SECRET,
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
  },

  // Performance
  performance: {
    cacheTtl: parseInt(process.env.CACHE_TTL || '3600'), // 1 hour
    maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE || '10485760'), // 10MB
  },

  // Stripe
  stripe: {
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  },
} as const;

// Environment helpers
export const isDevelopment = config.app.nodeEnv === 'development';
export const isProduction = config.app.nodeEnv === 'production';
export const isStaging = config.app.nodeEnv === 'staging';
export const isTest = config.app.nodeEnv === 'test';

// Validate required environment variables
export function validateConfig() {
  const required = [
    'DATABASE_URL',
  ];

  // Check for either BetterAuth or NextAuth secret
  const hasAuthSecret = process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!hasAuthSecret) {
    required.push('BETTER_AUTH_SECRET or NEXTAUTH_SECRET');
  }

  // Optional but recommended for production
  const optional = [
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY', 
    'R2_ACCOUNT_ID',
    'R2_BUCKET_NAME',
    'RESEND_API_KEY',
    'OPENAI_API_KEY',
  ];

  const missing = required.filter(key => {
    if (key === 'BETTER_AUTH_SECRET or NEXTAUTH_SECRET') {
      return !hasAuthSecret;
    }
    return !process.env[key];
  });
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Warn about missing optional variables
  const missingOptional = optional.filter(key => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn(`Warning: Missing optional environment variables: ${missingOptional.join(', ')}`);
  }
}