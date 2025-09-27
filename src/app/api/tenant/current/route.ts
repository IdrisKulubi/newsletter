import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tenants } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/config';

export async function GET(request: NextRequest) {
  try {
    // Try to get tenant from header (set by middleware)
    let tenantId = request.headers.get('x-tenant-id');

    // Fallback: derive tenant from authenticated user session if available
    if (!tenantId) {
      try {
        const session = await auth.api.getSession({ headers: request.headers });
        const userTenantId = (session as any)?.user?.tenantId as string | undefined;
        if (userTenantId) {
          tenantId = userTenantId;
        }
      } catch {}
    }

    // If still no tenant, return a friendly empty response (avoid console errors in dev)
    if (!tenantId) {
      return NextResponse.json({ tenant: null, error: 'No tenant context' }, { status: 200 });
    }

    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant[0]) {
      return NextResponse.json({ tenant: null, error: 'Tenant not found' }, { status: 200 });
    }

    return NextResponse.json(tenant[0]);
  } catch (error) {
    console.error('Error fetching tenant:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
