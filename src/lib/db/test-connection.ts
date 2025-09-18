import { db } from './index';
import { checkDatabaseHealth } from './utils';
import { sql } from 'drizzle-orm';

/**
 * Test database connection and basic functionality
 */
async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');

  try {
    // Test basic connection
    const isHealthy = await checkDatabaseHealth();
    if (!isHealthy) {
      throw new Error('Database health check failed');
    }
    console.log('✅ Database connection is healthy');

    // Test if tables exist
    const tablesResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tableNames = tablesResult.map(row => row.table_name);
    console.log('📋 Available tables:', tableNames);

    // Test RLS functions exist
    const functionsResult = await db.execute(sql`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name IN ('get_current_tenant_id', 'set_current_tenant_id')
    `);

    const functionNames = functionsResult.map(row => row.routine_name);
    console.log('🔧 Available RLS functions:', functionNames);

    console.log('🎉 Database setup test completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Database test failed:', error);
    return false;
  }
}

// Export for use in other files
export { testDatabaseConnection };

// Run test if this file is executed directly
if (require.main === module) {
  testDatabaseConnection()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}