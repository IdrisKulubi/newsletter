/**
 * Tenant context utilities for Server Actions and API routes
 */

import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { tenants } from '@/lib/db/schema/tenants';
import { eq, or } from 'drizzle-orm';
import type { Tenant } from '@/lib/db/schema/tenants';

/**
 * Get tenant context from request headers
 * This should be called from Server Actions or API routes
 */
export async function getTenantContext(): Promise<Tenant | null> {
  try {
    const headersList = await headers();
    const host = headersList.get('host');
    
    if (!host) {
      console.warn('No host header found in request');
      return null;
    }

    // Extract domain from host (remove port if present)
    const domain = host.split(':')[0];
    
    // Try to find tenant by domain or custom domain
    const tenant = await db
      .select()
      .from(tenants)
      .where(
        or(
          eq(tenants.domain, domain),
          eq(tenants.customDomain, domain)
        )
      )
      .limit(1);

    if (tenant.length === 0) {
      console.warn(`No tenant found for domain: ${domain}`);
      return null;
    }

    const tenantData = tenant[0];

    // Check if tenant is active
    if (!tenantData.isActive) {
      console.warn(`Tenant ${tenantData.id} is inactive`);
      return null;
    }

    return tenantData;
  } catch (error) {
    console.error('Error getting tenant context:', error);
    return null;
  }
}

/**
 * Get tenant by ID (for admin operations)
 */
export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  try {
    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return tenant.length > 0 ? tenant[0] : null;
  } catch (error) {
    console.error('Error getting tenant by ID:', error);
    return null;
  }
}

/**
 * Validate tenant access for a user
 * This is a placeholder - should be implemented with actual auth
 */
export async function validateTenantAccess(
  tenantId: string,
  userId?: string
): Promise<boolean> {
  try {
    // TODO: Implement actual user-tenant relationship validation
    // For now, just check if tenant exists and is active
    const tenant = await getTenantById(tenantId);
    return tenant !== null && tenant.isActive;
  } catch (error) {
    console.error('Error validating tenant access:', error);
    return false;
  }
}

/**
 * Get tenant domain info
 */
export function getTenantDomainInfo(tenant: Tenant): {
  primaryDomain: string;
  customDomain?: string;
  isCustomDomain: boolean;
} {
  return {
    primaryDomain: tenant.domain,
    customDomain: tenant.customDomain || undefined,
    isCustomDomain: !!tenant.customDomain,
  };
}

/**
 * Check if domain belongs to tenant
 */
export function isDomainForTenant(domain: string, tenant: Tenant): boolean {
  return domain === tenant.domain || domain === tenant.customDomain;
}