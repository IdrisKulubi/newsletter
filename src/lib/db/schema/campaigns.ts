import { pgTable, text, timestamp, jsonb, uuid, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { tenants } from './tenants';
import { users } from './users';
import { newsletters } from './newsletters';

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  newsletterId: uuid('newsletter_id').references(() => newsletters.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  subjectLine: text('subject_line').notNull(),
  previewText: text('preview_text'),
  recipients: jsonb('recipients').$type<{
    list: Array<{
      email: string;
      name?: string;
      metadata?: Record<string, any>;
    }>;
    segmentId?: string;
  }>().notNull(),
  status: text('status', { 
    enum: ['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'] 
  }).default('draft').notNull(),
  scheduledAt: timestamp('scheduled_at'),
  sentAt: timestamp('sent_at'),
  analytics: jsonb('analytics').$type<{
    totalSent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    complained: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
    lastUpdated: Date;
  }>().default({
    totalSent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    unsubscribed: 0,
    complained: 0,
    openRate: 0,
    clickRate: 0,
    bounceRate: 0,
    lastUpdated: new Date(),
  }),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const campaignsRelations = relations(campaigns, ({ one }) => ({
  tenant: one(tenants, {
    fields: [campaigns.tenantId],
    references: [tenants.id],
  }),
  newsletter: one(newsletters, {
    fields: [campaigns.newsletterId],
    references: [newsletters.id],
  }),
  createdByUser: one(users, {
    fields: [campaigns.createdBy],
    references: [users.id],
  }),
}));

// Zod schemas for validation
export const insertCampaignSchema = createInsertSchema(campaigns);
export const selectCampaignSchema = createSelectSchema(campaigns);

export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;