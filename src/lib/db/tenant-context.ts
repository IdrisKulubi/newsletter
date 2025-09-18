import { db } from './index';
import { sql } from 'drizzle-orm';

/**
 * Set the current tenant context for Row Level Security
 * This function must be called before any database operations
 * to ensure proper tenant isolation
 */
export async function setTenantContext(tenantId: string): Promise<void> {
  await db.execute(sql`SELECT set_current_tenant_id(${tenantId}::uuid)`);
}

/**
 * Clear the current tenant context
 */
export async function clearTenantContext(): Promise<void> {
  await db.execute(sql`SELECT set_config('app.current_tenant_id', '', true)`);
}

/**
 * Execute a database operation within a tenant context
 * Automatically sets and clears the tenant context
 */
export async function withTenantContext<T>(
  tenantId: string,
  operation: () => Promise<T>
): Promise<T> {
  await setTenantContext(tenantId);
  try {
    return await operation();
  } finally {
    await clearTenantContext();
  }
}

/**
 * Get the current tenant ID from the database session
 */
export async function getCurrentTenantId(): Promise<string | null> {
  const result = await db.execute(sql`SELECT get_current_tenant_id() as tenant_id`);
  const tenantId = result[0]?.tenant_id as string;
  return tenantId === '00000000-0000-0000-0000-000000000000' ? null : tenantId;
}

/**
 * Get the current tenant context with full tenant information
 * This is a convenience function that combines tenant ID lookup with tenant data
 */
export async function getTenantContext(): Promise<{
  id: string;
  userId?: string;
  name: string;
} | null> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) {
    return null;
  }

  // For now, return a basic context
  // In a full implementation, you might want to fetch tenant details from the database
  return {
    id: tenantId,
    name: 'Current Tenant', // This would be fetched from the database
  };
}