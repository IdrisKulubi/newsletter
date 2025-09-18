import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static files and API routes that don't need auth
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Extract tenant from subdomain or custom domain
  const host = request.headers.get('host') || '';
  const subdomain = extractSubdomain(host);
  
  // Handle tenant resolution
  let tenantId: string | null = null;
  
  if (subdomain && subdomain !== 'www') {
    // This is a subdomain request - resolve tenant
    tenantId = await resolveTenantFromDomain(subdomain);
    
    if (!tenantId) {
      // Invalid subdomain - redirect to main site
      return NextResponse.redirect(new URL('https://newsletter.com', request.url));
    }
  }

  // Get session from BetterAuth
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  // Create response with tenant context
  const response = NextResponse.next();
  
  // Add tenant context to headers for use in components
  if (tenantId) {
    response.headers.set('x-tenant-id', tenantId);
  }
  
  // Add session context
  if (session?.user) {
    response.headers.set('x-user-id', session.user.id);
    response.headers.set('x-user-role', session.user.role || 'viewer');
  }

  // Protect authenticated routes
  const isAuthRoute = pathname.startsWith('/auth');
  const isProtectedRoute = !isAuthRoute && pathname !== '/';
  
  if (isProtectedRoute && !session?.user) {
    const loginUrl = new URL('/auth/signin', request.url);
    loginUrl.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && session?.user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

function extractSubdomain(host: string): string | null {
  // Remove port if present
  const hostname = host.split(':')[0];
  
  // Split by dots
  const parts = hostname.split('.');
  
  // For localhost development
  if (hostname === 'localhost' || hostname.startsWith('127.0.0.1')) {
    return null;
  }
  
  // For production: subdomain.newsletter.com
  if (parts.length >= 3 && parts[parts.length - 2] === 'newsletter' && parts[parts.length - 1] === 'com') {
    return parts[0];
  }
  
  // For custom domains, we'll need to check against database
  // For now, return null to indicate custom domain handling needed
  return null;
}

async function resolveTenantFromDomain(domain: string): Promise<string | null> {
  try {
    // Import here to avoid circular dependencies
    const { db } = await import('@/lib/db');
    const { tenants } = await import('@/lib/db/schema');
    const { eq, or } = await import('drizzle-orm');
    
    const tenant = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(
        or(
          eq(tenants.domain, domain),
          eq(tenants.customDomain, domain)
        )
      )
      .limit(1);
    
    return tenant[0]?.id || null;
  } catch (error) {
    console.error('Error resolving tenant:', error);
    return null;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};