import { pgTable, text, timestamp, jsonb, uuid, boolean, index } from 'drizzle-orm/pg-core';
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
}, (table) => ({
  // Indexes for efficient domain lookups
  domainIdx: index('tenants_domain_idx').on(table.domain),
  customDomainIdx: index('tenants_custom_domain_idx').on(table.customDomain),
  isActiveIdx: index('tenants_is_active_idx').on(table.isActive),
  createdAtIdx: index('tenants_created_at_idx').on(table.createdAt),
}));

// TypeScript interfaces for better type safety
export interface TenantSettings {
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
}

export interface SubscriptionPlan {
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'cancelled' | 'past_due';
  currentPeriodEnd?: Date;
}

export interface CreateTenantData {
  name: string;
  domain: string;
  customDomain?: string;
  settings?: TenantSettings;
  subscription?: SubscriptionPlan;
}

export interface UpdateTenantData {
  name?: string;
  domain?: string;
  customDomain?: string;
  settings?: TenantSettings;
  subscription?: SubscriptionPlan;
  isActive?: boolean;
}

// Zod schemas for validation
export const insertTenantSchema = createInsertSchema(tenants);
export const selectTenantSchema = createSelectSchema(tenants);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;