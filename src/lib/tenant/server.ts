/**
 * Server-side tenant utilities
 * Provides tenant resolution from headers and server context
 */

import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { tenants } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  customDomain?: string;
}

/**
 * Get tenant from request headers
 * This would typically extract tenant info from subdomain or custom domain
 */
export async function getTenantFromHeaders(): Promise<Tenant | null> {
  try {
    const headersList = await headers();
    const host = headersList.get('host');
    
    if (!host) {
      return null;
    }

    // Extract subdomain or use custom domain logic
    const domain = host.split('.')[0];
    
    // Query database for tenant
    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.domain, domain))
      .limit(1);

    if (!tenant.length) {
      return null;
    }

    return {
      id: tenant[0].id,
      name: tenant[0].name,
      domain: tenant[0].domain,
      customDomain: tenant[0].customDomain || undefined
    };
  } catch (error) {
    console.error('Error getting tenant from headers:', error);
    return null;
  }
}

/**
 * Get tenant by ID
 */
export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  try {
    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant.length) {
      return null;
    }

    return {
      id: tenant[0].id,
      name: tenant[0].name,
      domain: tenant[0].domain,
      customDomain: tenant[0].customDomain || undefined
    };
  } catch (error) {
    console.error('Error getting tenant by ID:', error);
    return null;
  }
}