import { db } from "./index";
import { sql, eq } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { headers } from "next/headers";
import { tenants } from "./schema/tenants";
import { users } from "./schema/users";

/**
 * Set the current tenant context for Row Level Security
 */
export async function setTenantContext(tenantId: string): Promise<void> {
  try {
    await db.execute(sql`SELECT set_current_tenant_id(${tenantId}::uuid)`);
  } catch {
    // Ignore if helper function is not yet defined
  }
}

/**
 * Clear the current tenant context
 */
export async function clearTenantContext(): Promise<void> {
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
 * Try to get tenant ID from BetterAuth session
 */
export async function getTenantIdFromSession(): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const tenantId = (session as any)?.user?.tenantId as string | undefined;
    return tenantId ?? null;
  } catch {
    return null;
  }
}

/**
 * Try to get tenant ID from DB helper (if installed)
 */
export async function getTenantIdFromDb(): Promise<string | null> {
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

/**
 * In development, auto-provision a tenant and attach it to the current user
 */
async function ensureDevTenantForSession(): Promise<string | null> {
  if (process.env.NODE_ENV === "production") return null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const user = (session as any)?.user as
      | { id: string; name?: string; tenantId?: string }
      | undefined;
    if (!user) return null;
    if (user.tenantId) return user.tenantId;

    const shortId = user.id.replace(/-/g, "").slice(0, 8);
    const domain = `dev-${shortId}.newsletter.local`;

    // Find existing tenant by domain or create a new one
    let existing = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.domain, domain))
      .limit(1);

    let tenantId: string | null = existing[0]?.id ?? null;

    if (!tenantId) {
      const [created] = await db
        .insert(tenants)
        .values({
          name: user.name ? `${user.name}'s Workspace` : "My Workspace",
          domain,
          isActive: true,
          settings: {},
          subscription: { plan: "free", status: "active" },
        })
        .returning({ id: tenants.id });
      tenantId = created?.id ?? null;
    }

    if (tenantId) {
      await db.update(users).set({ tenantId }).where(eq(users.id, user.id));
      return tenantId;
    }
  } catch {
    // ignore in dev
  }
  return null;
}

/**
 * Resolve a tenant context using best-effort strategies
 */
export async function getTenantContext(): Promise<{
  id: string;
  userId?: string;
  name: string;
} | null> {
  // 1) From session
  const fromSession = await getTenantIdFromSession();
  if (fromSession) return { id: fromSession, name: "Current Tenant" };

  // 2) In dev, auto-provision a tenant
  const devTenant = await ensureDevTenantForSession();
  if (devTenant) return { id: devTenant, name: "Current Tenant" };

  // 3) From DB helper
  const fromDb = await getTenantIdFromDb();
  if (fromDb) return { id: fromDb, name: "Current Tenant" };

  return null;
}
