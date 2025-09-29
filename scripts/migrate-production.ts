#!/usr/bin/env tsx

/**
 * Production database migration script
 * Runs database migrations safely in production environment
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { config } from '../src/lib/config';

async function runMigrations() {
  console.log('🚀 Starting production database migrations...');
  
  try {
    // Create connection with production settings
    const connection = postgres(config.database.url, {
      max: 1, // Single connection for migrations
      ssl: config.database.ssl ? 'require' : false,
    });

    const db = drizzle(connection);

    // Run migrations
    console.log('📦 Running database migrations...');
    await migrate(db, {
      migrationsFolder: './src/lib/db/migrations',
    });

    console.log('✅ Database migrations completed successfully');

    // Close connection
    await connection.end();
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Validate environment before running
if (!config.database.url) {
  console.error('❌ DATABASE_URL is required');
  process.exit(1);
}

const nodeEnv = config.app.nodeEnv as string;
if (nodeEnv !== 'production' && nodeEnv !== 'staging') {
  console.warn('⚠️  Running migrations in non-production environment');
}

// Run migrations
runMigrations();