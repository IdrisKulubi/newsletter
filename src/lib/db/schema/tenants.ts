import { pgTable, text, timestamp, jsonb, uuid, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  domain: text('domain').notNull().unique(),
  customDomain: text('custom_domain'),
  settings: jsonb('settings').$type<{
    branding?: {
      logo?: string;
      primaryColor?: string;
      secondaryColor?: string;
    };
    emailSettings?: {
      fromName: string;
      fromEmail: string;
      replyTo?: string;
    };
    aiSettings?: {
      enabled: boolean;
      model?: string;
    };
    analyticsSettings?: {
      retentionDays: number;
    };
  }>().default({}),
  subscription: jsonb('subscription').$type<{
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'cancelled' | 'past_due';
    currentPeriodEnd?: Date;
  }>().default({ plan: 'free', status: 'active' }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Zod schemas for validation
export const insertTenantSchema = createInsertSchema(tenants);
export const selectTenantSchema = createSelectSchema(tenants);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;