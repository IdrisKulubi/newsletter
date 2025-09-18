import { NextRequest, NextResponse } from 'next/server';
import { tenantService } from '@/lib/services/tenant';

/**
 * GET /api/tenants/current
 * Get current tenant information based on request headers
 */
export async function GET(request: NextRequest) {
  try {
    // Get tenant ID from headers (set by middleware)
    const tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'No tenant context found' },
        { status: 404 }
      );
    }

    // Fetch tenant data
    const tenant = await tenantService.getTenantById(tenantId);
    
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Return tenant data (excluding sensitive information)
    const publicTenantData = {
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain,
      customDomain: tenant.customDomain,
      settings: tenant.settings,
      subscription: tenant.subscription,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };

    return NextResponse.json(publicTenantData);
  } catch (error) {
    console.error('Error fetching current tenant:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}