import { sql } from "drizzle-orm";
import type { Database } from "./index";

/**
 * Set the current tenant context for Row Level Security
 */
export async function setTenantContext(db: Database, tenantId: string): Promise<void> {
  try {
    await db.execute(sql`SELECT set_current_tenant_id(${tenantId}::uuid)`);
  } catch {
    // Ignore if helper function is not yet defined
  }
}

/**
 * Clear the current tenant context
 */
export async function clearTenantContext(db: Database): Promise<void> {
  try {
    await db.execute(sql`SELECT set_config('app.current_tenant_id', '', true)`);
  } catch {
    // Ignore if helper function is not yet defined
  }
}

/**
 * Execute a database operation within a tenant context
 */
export async function withTenantContext<T>(
  db: Database,
  tenantId: string,
  operation: () => Promise<T>
): Promise<T> {
  await setTenantContext(db, tenantId);
  try {
    return await operation();
  } finally {
    await clearTenantContext(db);
  }
}

/**
 * Try to get tenant ID from DB helper (if installed)
 */
export async function getTenantIdFromDb(db: Database): Promise<string | null> {
  try {
    const result = await db.execute(
      sql`SELECT get_current_tenant_id() as tenant_id`
    );
    const tenantId = (result as any)[0]?.tenant_id as string | undefined;
    if (!tenantId || tenantId === "00000000-0000-0000-0000-000000000000")
      return null;
    return tenantId;
  } catch {
    // Swallow errors to avoid noisy overlays in dev
    return null;
  }
}
