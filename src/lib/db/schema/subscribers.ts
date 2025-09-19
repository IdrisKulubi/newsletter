import { pgTable, text, timestamp, uuid, index, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { tenants } from './tenants';

export const subscribers = pgTable('subscribers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  email: text('email').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  status: text('status', { 
    enum: ['active', 'unsubscribed', 'bounced', 'complained'] 
  }).default('active').notNull(),
  subscriptionSource: text('subscription_source'), // 'website', 'import', 'api', etc.
  tags: text('tags').array(), // For segmentation
  metadata: text('metadata'), // JSON string for additional data
  subscribedAt: timestamp('subscribed_at').defaultNow().notNull(),
  unsubscribedAt: timestamp('unsubscribed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Unique constraint on tenant and email
  tenantEmailIdx: index('subscribers_tenant_email_idx').on(table.tenantId, table.email),
  // Index for status queries
  statusIdx: index('subscribers_status_idx').on(table.status),
  // Index for tenant queries
  tenantIdIdx: index('subscribers_tenant_id_idx').on(table.tenantId),
}));

// Relations
export const subscribersRelations = relations(subscribers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [subscribers.tenantId],
    references: [tenants.id],
  }),
}));

// Zod schemas for validation
export const insertSubscriberSchema = createInsertSchema(subscribers);
export const selectSubscriberSchema = createSelectSchema(subscribers);

export type Subscriber = typeof subscribers.$inferSelect;
export type NewSubscriber = typeof subscribers.$inferInsert;