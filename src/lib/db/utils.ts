import { db } from './index';
import { sql } from 'drizzle-orm';

/**
 * Database utility functions
 */

/**
 * Check if the database connection is healthy
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats() {
  try {
    const result = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples
      FROM pg_stat_user_tables 
      ORDER BY schemaname, tablename
    `);
    
    return result;
  } catch (error) {
    console.error('Failed to get database stats:', error);
    return [];
  }
}

/**
 * Run database maintenance tasks
 */
export async function runMaintenance() {
  try {
    // Analyze tables for better query planning
    await db.execute(sql`ANALYZE`);
    
    // Vacuum to reclaim space (non-blocking)
    await db.execute(sql`VACUUM (ANALYZE)`);
    
    console.log('Database maintenance completed');
  } catch (error) {
    console.error('Database maintenance failed:', error);
    throw error;
  }
}

/**
 * Create a database transaction wrapper
 */
export async function withTransaction<T>(
  operation: (tx: any) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    return await operation(tx);
  });
}