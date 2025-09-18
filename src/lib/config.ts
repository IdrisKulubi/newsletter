/**
 * Application configuration
 * Centralizes environment variables and configuration settings
 */

export const config = {
  // Database
  database: {
    url: process.env.DATABASE_URL!,
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
  },

  // Email
  email: {
    resendApiKey: process.env.RESEND_API_KEY!,
  },

  // AI
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY!,
  },

  // Application
  app: {
    url: process.env.APP_URL || 'http://localhost:3000',
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // Stripe
  stripe: {
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  },
} as const;

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