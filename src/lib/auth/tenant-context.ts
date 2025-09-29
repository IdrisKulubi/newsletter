import { getTenantContext as getDbTenantContext } from "@/lib/db/tenant-resolver";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface TenantContext {
  tenant: {
    id: string;
    name: string;
    domain: string;
    subdomain: string;
    settings?: Record<string, any>;
  };
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Get the current tenant context for server actions
 * This function retrieves the tenant information from the database context
 * and returns it in a format suitable for server actions
 */
export async function getTenantContext(): Promise<TenantContext | null> {
  try {
    // Get the basic tenant context from the database
    const basicContext = await getDbTenantContext();
    
    if (!basicContext) {
      return null;
    }

    // Fetch full tenant details from the database
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, basicContext.id),
    });

    if (!tenant) {
      return null;
    }

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain || "",
        subdomain: tenant.subdomain || "",
        settings: tenant.settings || {},
      },
      // User context would be added here if available from session
      // For now, we'll leave it undefined
    };
  } catch (error) {
    console.error("Failed to get tenant context:", error);
    return null;
  }
}

/**
 * Ensure tenant context is available, throw error if not
 * This is a convenience function for server actions that require tenant context
 */
export async function requireTenantContext(): Promise<TenantContext> {
  const context = await getTenantContext();
  
  if (!context) {
    throw new Error("Tenant context is required but not available");
  }
  
  return context;
}

/**
 * Get tenant ID from context
 * Returns null if no tenant context is available
 */
export async function getCurrentTenantId(): Promise<string | null> {
  const context = await getTenantContext();
  return context?.tenant.id || null;
}

/**
 * Check if the current user has access to a specific tenant
 * This is useful for multi-tenant authorization
 */
export async function hasAccessToTenant(tenantId: string): Promise<boolean> {
  const context = await getTenantContext();
  return context?.tenant.id === tenantId;
}

/**
 * Execute a function within a specific tenant context
 * This ensures the tenant context is properly set for the operation
 */
export async function withTenantContext<T>(
  tenantId: string,
  operation: () => Promise<T>
): Promise<T> {
  // Import the database tenant context function
  const { withTenantContext: dbWithTenantContext } = await import("@/lib/db/tenant-context");
  
  return dbWithTenantContext(tenantId, operation);
}