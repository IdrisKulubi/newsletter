import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { securityMiddleware, getClientIP } from '@/lib/security/headers';
import { checkRateLimit } from '@/lib/security/rate-limiting';

export async function middleware(request: NextRequest) {
  const { pathname, method } = request.nextUrl;
  
  // Apply security headers and CSRF protection first
  const securityResponse = securityMiddleware(request);
  if (securityResponse.status !== 200) {
    return securityResponse;
  }
  
  // Skip middleware for static files and certain API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') ||
    pathname.startsWith('/favicon')
  ) {
    return securityResponse;
  }

  // Rate limiting for API routes and sensitive actions
  const clientIP = getClientIP(request);
  
  if (pathname.startsWith('/api/')) {
    const rateLimitResult = await checkRateLimit(clientIP, 'API_REQUESTS');
    
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { 
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter 
        },
        { status: 429 }
      );
      
      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', '100');
      response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
      response.headers.set('X-RateLimit-Reset', Math.ceil(rateLimitResult.resetTime / 1000).toString());
      
      if (rateLimitResult.retryAfter) {
        response.headers.set('Retry-After', rateLimitResult.retryAfter.toString());
      }
      
      return response;
    }
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

  // Additional rate limiting for authenticated users
  if (session?.user) {
    const userRateLimitResult = await checkRateLimit(session.user.id, 'API_REQUESTS');
    
    if (!userRateLimitResult.allowed) {
      const response = NextResponse.json(
        { 
          error: 'Too Many Requests',
          message: 'User rate limit exceeded',
          retryAfter: userRateLimitResult.retryAfter 
        },
        { status: 429 }
      );
      
      if (userRateLimitResult.retryAfter) {
        response.headers.set('Retry-After', userRateLimitResult.retryAfter.toString());
      }
      
      return response;
    }
  }

  // Create response with security headers and tenant context
  const response = NextResponse.next();
  
  // Copy security headers from the security middleware response
  securityResponse.headers.forEach((value, key) => {
    response.headers.set(key, value);
  });
  
  // Add tenant context to headers for use in components
  if (tenantId) {
    response.headers.set('x-tenant-id', tenantId);
  }
  
  // Add session context
  if (session?.user) {
    response.headers.set('x-user-id', session.user.id);
    response.headers.set('x-user-role', session.user.role || 'viewer');
  }
  
  // Add client IP for logging and security
  response.headers.set('x-client-ip', clientIP);

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