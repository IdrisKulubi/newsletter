import { pgTable, text, timestamp, jsonb, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { tenants } from './tenants';
import { users } from './users';

export const newsletters = pgTable('newsletters', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  content: jsonb('content').$type<{
    blocks: Array<{
      id: string;
      type: 'text' | 'image' | 'button' | 'divider' | 'social';
      content: Record<string, any>;
      styling?: Record<string, any>;
    }>;
  }>().default({ blocks: [] }),
  template: jsonb('template').$type<{
    id: string;
    name: string;
    config: Record<string, any>;
  }>(),
  metadata: jsonb('metadata').$type<{
    description?: string;
    tags?: string[];
    estimatedReadTime?: number;
  }>().default({}),
  status: text('status', { enum: ['draft', 'review', 'approved'] }).default('draft').notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const newslettersRelations = relations(newsletters, ({ one }) => ({
  tenant: one(tenants, {
    fields: [newsletters.tenantId],
    references: [tenants.id],
  }),
  createdByUser: one(users, {
    fields: [newsletters.createdBy],
    references: [users.id],
  }),
}));

// Zod schemas for validation
export const insertNewsletterSchema = createInsertSchema(newsletters);
export const selectNewsletterSchema = createSelectSchema(newsletters);

export type Newsletter = typeof newsletters.$inferSelect;
export type NewNewsletter = typeof newsletters.$inferInsert;