import { db } from '../db';
import { tenants, type Tenant, type CreateTenantData, type UpdateTenantData } from '../db/schema/tenants';
import { eq, and, or } from 'drizzle-orm';
import { withTenantContext } from '../db/tenant-context';

/**
 * Tenant Service
 * Handles all tenant-related operations including CRUD operations and domain mapping
 */
export class TenantService {
  /**
   * Create a new tenant
   */
  async createTenant(data: CreateTenantData): Promise<Tenant> {
    // Validate domain uniqueness
    await this.validateDomainUniqueness(data.domain, data.customDomain);

    const [tenant] = await db
      .insert(tenants)
      .values({
        name: data.name,
        domain: data.domain,
        customDomain: data.customDomain,
        settings: data.settings || {},
        subscription: data.subscription || { plan: 'free', status: 'active' },
        isActive: true,
      })
      .returning();

    return tenant;
  }

  /**
   * Get tenant by ID
   */
  async getTenantById(tenantId: string): Promise<Tenant | null> {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(and(eq(tenants.id, tenantId), eq(tenants.isActive, true)))
      .limit(1);

    return tenant || null;
  }

  /**
   * Get tenant by domain (subdomain or custom domain)
   */
  async getTenantByDomain(domain: string): Promise<Tenant | null> {
    // Remove protocol and www prefix if present
    const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').toLowerCase();
    
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(
        and(
          or(
            eq(tenants.domain, cleanDomain),
            eq(tenants.customDomain, cleanDomain)
          ),
          eq(tenants.isActive, true)
        )
      )
      .limit(1);

    return tenant || null;
  }

  /**
   * Update tenant
   */
  async updateTenant(tenantId: string, data: UpdateTenantData): Promise<Tenant | null> {
    return withTenantContext(tenantId, async () => {
      // If updating domain, validate uniqueness
      if (data.domain || data.customDomain) {
        await this.validateDomainUniqueness(data.domain, data.customDomain, tenantId);
      }

      const [tenant] = await db
        .update(tenants)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId))
        .returning();

      return tenant || null;
    });
  }

  /**
   * Delete tenant (soft delete by setting isActive to false)
   */
  async deleteTenant(tenantId: string): Promise<boolean> {
    return withTenantContext(tenantId, async () => {
      const [tenant] = await db
        .update(tenants)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId))
        .returning();

      return !!tenant;
    });
  }

  /**
   * List all active tenants with pagination
   */
  async listTenants(limit = 50, offset = 0): Promise<Tenant[]> {
    return db
      .select()
      .from(tenants)
      .where(eq(tenants.isActive, true))
      .limit(limit)
      .offset(offset)
      .orderBy(tenants.createdAt);
  }

  /**
   * Validate user access to tenant
   */
  async validateTenantAccess(userId: string, tenantId: string): Promise<boolean> {
    // This will be enhanced when user-tenant relationships are implemented
    // For now, we just check if the tenant exists and is active
    const tenant = await this.getTenantById(tenantId);
    return !!tenant;
  }

  /**
   * Extract subdomain from domain
   */
  extractSubdomain(domain: string): string | null {
    const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').toLowerCase();
    const parts = cleanDomain.split('.');
    
    // If it's a subdomain pattern like "company.newsletter.com"
    if (parts.length >= 3 && parts[1] === 'newsletter') {
      return parts[0];
    }
    
    return null;
  }

  /**
   * Check if domain is a custom domain (not a subdomain)
   */
  isCustomDomain(domain: string): boolean {
    const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').toLowerCase();
    return !cleanDomain.includes('newsletter.com');
  }

  /**
   * Get tenant settings with defaults
   */
  async getTenantSettings(tenantId: string) {
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    return {
      branding: {
        logo: tenant.settings?.branding?.logo || '',
        primaryColor: tenant.settings?.branding?.primaryColor || '#3b82f6',
        secondaryColor: tenant.settings?.branding?.secondaryColor || '#64748b',
      },
      emailSettings: {
        fromName: tenant.settings?.emailSettings?.fromName || tenant.name,
        fromEmail: tenant.settings?.emailSettings?.fromEmail || `noreply@${tenant.domain}`,
        replyTo: tenant.settings?.emailSettings?.replyTo || `support@${tenant.domain}`,
      },
      aiSettings: {
        enabled: tenant.settings?.aiSettings?.enabled ?? true,
        model: tenant.settings?.aiSettings?.model || 'gpt-4',
      },
      analyticsSettings: {
        retentionDays: tenant.settings?.analyticsSettings?.retentionDays || 365,
      },
    };
  }

  /**
   * Private method to validate domain uniqueness
   */
  private async validateDomainUniqueness(
    domain?: string,
    customDomain?: string,
    excludeTenantId?: string
  ): Promise<void> {
    if (!domain && !customDomain) return;

    const conditions = [];
    
    if (domain) {
      conditions.push(eq(tenants.domain, domain));
    }
    
    if (customDomain) {
      conditions.push(eq(tenants.customDomain, customDomain));
    }

    let query = db
      .select({ id: tenants.id })
      .from(tenants)
      .where(and(or(...conditions), eq(tenants.isActive, true)));

    if (excludeTenantId) {
      query = query.where(and(or(...conditions), eq(tenants.isActive, true)));
    }

    const existing = await query.limit(1);

    if (existing.length > 0 && existing[0].id !== excludeTenantId) {
      throw new Error('Domain already exists');
    }
  }
}

// Export singleton instance
export const tenantService = new TenantService();