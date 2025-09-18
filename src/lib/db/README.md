# Database Setup

This directory contains the database configuration, schema, and utilities for the Newsletter SaaS Platform.

## Overview

The database is built with:
- **PostgreSQL** as the primary database
- **Drizzle ORM** for type-safe database operations
- **Row-Level Security (RLS)** for multi-tenant data isolation
- **Connection pooling** for optimal performance

## Structure

```
src/lib/db/
├── index.ts              # Main database connection and exports
├── schema/               # Database schema definitions
│   ├── index.ts         # Schema exports
│   ├── tenants.ts       # Tenant table and types
│   ├── users.ts         # Users table and types
│   ├── newsletters.ts   # Newsletters table and types
│   ├── campaigns.ts     # Campaigns table and types
│   ├── analytics.ts     # Analytics tables and types
│   └── assets.ts        # Assets table and types
├── migrations/          # Database migration files
├── tenant-context.ts    # RLS tenant context utilities
├── utils.ts            # Database utility functions
├── seed.ts             # Development data seeding
├── test-connection.ts  # Connection testing utilities
└── README.md           # This file
```

## Key Features

### Multi-Tenant Architecture
- Complete data isolation using Row-Level Security (RLS)
- Tenant context management for secure operations
- Automatic tenant filtering on all queries

### Schema Design
- **Tenants**: Company workspaces with settings and subscriptions
- **Users**: Tenant-scoped users with role-based access
- **Newsletters**: Content management with block-based structure
- **Campaigns**: Email campaign lifecycle management
- **Analytics**: Event tracking and performance metrics
- **Assets**: File storage metadata with tenant isolation

### Performance Optimizations
- Strategic database indexes for multi-tenant queries
- Connection pooling with configurable limits
- Partitioned analytics tables for time-series data
- Pre-aggregated metrics for dashboard performance

## Usage

### Basic Database Operations

```typescript
import { db, withTenantContext } from '@/lib/db';
import { tenants, users } from '@/lib/db/schema';

// Set tenant context for RLS
await withTenantContext('tenant-id', async () => {
  // All queries within this block are automatically filtered by tenant
  const tenantUsers = await db.select().from(users);
  return tenantUsers;
});
```

### Schema Validation

```typescript
import { insertUserSchema, selectUserSchema } from '@/lib/db/schema';

// Validate input data
const userData = insertUserSchema.parse({
  tenantId: 'tenant-id',
  email: 'user@example.com',
  name: 'John Doe',
  role: 'editor'
});

// Insert with validation
const newUser = await db.insert(users).values(userData).returning();
```

## Scripts

### Generate Migrations
```bash
pnpm db:generate
```

### Run Migrations
```bash
pnpm db:migrate
```

### Push Schema Changes (Development)
```bash
pnpm db:push
```

### Open Drizzle Studio
```bash
pnpm db:studio
```

### Seed Development Data
```bash
pnpm db:seed
```

## Environment Variables

Required environment variables:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/newsletter_db
```

## Row-Level Security (RLS)

The database implements comprehensive RLS policies to ensure complete tenant isolation:

1. **Tenant Context**: Set using `set_current_tenant_id()` function
2. **Automatic Filtering**: All queries automatically filter by tenant
3. **Security**: Prevents cross-tenant data access at the database level

### RLS Functions

- `get_current_tenant_id()`: Returns the current tenant ID from session
- `set_current_tenant_id(uuid)`: Sets the tenant context for the session

### Usage Example

```typescript
import { setTenantContext, clearTenantContext } from '@/lib/db';

// Set tenant context
await setTenantContext('tenant-uuid');

// All database operations are now tenant-scoped
const users = await db.select().from(users); // Only returns users for this tenant

// Clear context when done
await clearTenantContext();
```

## Testing

Test the database connection:

```bash
npx tsx src/lib/db/test-connection.ts
```

## Migration Strategy

1. **Schema Changes**: Use `pnpm db:generate` to create migrations
2. **Custom Migrations**: Add SQL files to `migrations/` directory
3. **Production**: Always run migrations before deployment
4. **Rollback**: Keep migration rollback scripts for critical changes

## Performance Considerations

- Use connection pooling (configured for max 20 connections)
- Leverage database indexes for tenant-scoped queries
- Pre-aggregate analytics data for dashboard performance
- Use prepared statements for repeated queries
- Monitor query performance with `EXPLAIN ANALYZE`

## Security Best Practices

- All tables have RLS enabled
- Tenant isolation enforced at database level
- Input validation using Zod schemas
- Secure connection string handling
- Regular security audits of RLS policies