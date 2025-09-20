# Multi-Tenant Architecture

This document describes the multi-tenant architecture implemented for the Newsletter SaaS Platform.

## Overview

The platform supports multiple tenants (companies) with complete data isolation, subdomain routing, and custom domain support. Each tenant has their own isolated workspace while sharing the same application infrastructure.

## Architecture Components

### 1. Database Schema (`src/lib/db/schema/tenants.ts`)

The tenant schema includes:

- **Basic Information**: ID, name, domain, custom domain
- **Settings**: Branding, email configuration, AI settings, analytics preferences
- **Subscription**: Plan type, status, billing information
- **Indexes**: Optimized for domain lookups and tenant queries

```typescript
interface Tenant {
  id: string;
  name: string;
  domain: string; // e.g., "company.newsletter.com"
  customDomain?: string; // e.g., "news.company.com"
  settings: TenantSettings;
  subscription: SubscriptionPlan;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. Tenant Service (`src/lib/services/tenant.ts`)

Provides comprehensive CRUD operations and domain management:

- **Domain Resolution**: Resolves tenants by subdomain or custom domain
- **CRUD Operations**: Create, read, update, delete tenants
- **Domain Validation**: Ensures domain uniqueness
- **Settings Management**: Handles tenant-specific configurations
- **Access Control**: Validates user access to tenants

Key methods:

```typescript
class TenantService {
  createTenant(data: CreateTenantData): Promise<Tenant>;
  getTenantByDomain(domain: string): Promise<Tenant | null>;
  updateTenant(
    tenantId: string,
    data: UpdateTenantData
  ): Promise<Tenant | null>;
  validateTenantAccess(userId: string, tenantId: string): Promise<boolean>;
  getTenantSettings(tenantId: string): Promise<TenantSettings>;
}
```

### 3. Middleware (`src/middleware.ts`)

Handles tenant resolution and routing:

- **Domain Extraction**: Extracts clean domain from request hostname
- **Tenant Resolution**: Looks up tenant by domain
- **Context Setting**: Adds tenant information to request headers and cookies
- **Error Handling**: Graceful fallback for missing tenants
- **Performance**: Skips processing for API routes and static files

Flow:

1. Extract domain from request hostname
2. Skip processing for main domains, localhost, API routes, and static files
3. Resolve tenant by domain using TenantService
4. Set tenant context in headers and cookies
5. Continue to application or redirect if tenant not found

### 4. React Context (`src/contexts/tenant-context.tsx`)

Provides tenant information throughout the React application:

- **TenantProvider**: Wraps the application to provide tenant context
- **useTenant**: Hook to access tenant information with loading states
- **useRequiredTenant**: Hook that throws if no tenant is available
- **Event Handling**: Listens for tenant changes and refreshes data

Usage:

```typescript
// In your component
const { tenant, isLoading, error } = useTenant();

// For components that require a tenant
const tenant = useRequiredTenant();
```

### 5. Database Context (`src/lib/db/tenant-context.ts`)

Manages Row-Level Security (RLS) for database operations:

- **Context Setting**: Sets current tenant ID for database session
- **Isolation**: Ensures queries only access tenant-specific data
- **Transaction Support**: Maintains tenant context within transactions
- **Cleanup**: Automatically clears context after operations

```typescript
// Execute operation within tenant context
await withTenantContext(tenantId, async () => {
  // All database operations here are scoped to the tenant
  return await db.select().from(newsletters);
});
```

## Domain Routing

### Subdomain Support

- Format: `{tenant}.newsletter.com`
- Example: `acme.newsletter.com` → Acme Corp tenant
- Automatic extraction and resolution

### Custom Domain Support

- Format: Any custom domain (e.g., `news.company.com`)
- Requires DNS configuration by tenant
- Full SSL/TLS support through platform

### Domain Resolution Priority

1. Exact custom domain match
2. Subdomain pattern match
3. Fallback to main domain or 404

## Security & Isolation

### Data Isolation

- **Row-Level Security**: Database-level tenant isolation
- **Application-Level**: Service-layer tenant validation
- **Context Enforcement**: Automatic tenant context in all operations

### Access Control

- **Tenant Validation**: Users can only access their tenant's data
- **Role-Based**: Admin, Editor, Viewer roles within tenants
- **Session Management**: Tenant-scoped authentication

### Security Headers

- **CSRF Protection**: Built into authentication system
- **Secure Cookies**: HTTPOnly, Secure, SameSite configuration
- **Rate Limiting**: Per-tenant API rate limiting

## Performance Optimizations

### Database

- **Indexes**: Optimized for tenant and domain lookups
- **Connection Pooling**: Efficient database connection management
- **Query Optimization**: Tenant-scoped queries with proper indexing

### Caching

- **Tenant Data**: Redis caching for frequently accessed tenant information
- **Domain Resolution**: Cached domain-to-tenant mappings
- **Settings**: Cached tenant settings with TTL

### Middleware

- **Early Exit**: Skips processing for static files and API routes
- **Efficient Lookups**: Optimized database queries for tenant resolution
- **Error Handling**: Graceful degradation without blocking requests

## Usage Examples

### Basic Tenant Access

```typescript
import { useTenant } from "@/contexts/tenant-context";

function MyComponent() {
  const { tenant, isLoading, error } = useTenant();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!tenant) return <div>No tenant</div>;

  return <div>Welcome to {tenant.name}!</div>;
}
```

### Tenant-Specific Styling

```typescript
function BrandedComponent() {
  const { tenant } = useTenant();
  const primaryColor = tenant?.settings?.branding?.primaryColor || "#3b82f6";

  return <div style={{ color: primaryColor }}>{tenant?.name} Newsletter</div>;
}
```

### Server-Side Tenant Access

```typescript
import { headers } from "next/headers";
import { tenantService } from "@/lib/services/tenant";

export async function GET() {
  const tenantId = headers().get("x-tenant-id");
  if (!tenantId) {
    return Response.json({ error: "No tenant context" }, { status: 400 });
  }

  const tenant = await tenantService.getTenantById(tenantId);
  return Response.json(tenant);
}
```

## Testing

The architecture includes comprehensive tests:

### Unit Tests

- **Tenant Service**: CRUD operations, domain resolution, validation
- **Middleware**: Domain routing, tenant resolution, error handling
- **React Context**: Provider behavior, hooks, error states

### Integration Tests

- **End-to-End Workflows**: Tenant creation to domain resolution
- **Multi-Tenant Isolation**: Ensures proper data separation
- **Domain Utilities**: Subdomain extraction, custom domain detection

### Test Coverage

- 47 tests covering all major functionality
- Mocked database and external dependencies
- Error scenarios and edge cases

## Deployment Considerations

### Environment Variables

```env
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
APP_URL=https://newsletter.com
```

### DNS Configuration

- **Wildcard Subdomain**: `*.newsletter.com` → Application
- **Custom Domains**: Tenant-specific DNS setup
- **SSL Certificates**: Automatic certificate management

### Database Setup

- **RLS Policies**: Row-Level Security configuration
- **Indexes**: Performance optimization for multi-tenant queries
- **Migrations**: Tenant-aware database migrations

## Monitoring & Maintenance

### Metrics

- **Tenant Count**: Active tenant monitoring
- **Domain Resolution**: Performance metrics
- **Database Performance**: Query optimization tracking

### Maintenance

- **Tenant Cleanup**: Inactive tenant management
- **Domain Validation**: Regular domain health checks
- **Performance Monitoring**: Database and application metrics

## Future Enhancements

### Planned Features

- **Tenant Analytics**: Usage metrics per tenant
- **Billing Integration**: Subscription management
- **Advanced Branding**: Custom CSS/themes per tenant
- **API Rate Limiting**: Per-tenant API quotas

### Scalability

- **Horizontal Scaling**: Multi-instance deployment
- **Database Sharding**: Tenant-based data distribution
- **CDN Integration**: Global content delivery
- **Caching Layers**: Advanced caching strategies

This architecture provides a solid foundation for a scalable, secure, and maintainable multi-tenant SaaS platform.
