import { pgTable, text, timestamp, jsonb, uuid, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { tenants } from './tenants';
import { campaigns } from './campaigns';

export const emailEvents = pgTable('email_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'cascade' }).notNull(),
  recipientEmail: text('recipient_email').notNull(),
  eventType: text('event_type', { 
    enum: ['delivered', 'opened', 'clicked', 'bounced', 'unsubscribed', 'complained'] 
  }).notNull(),
  eventData: jsonb('event_data').$type<{
    messageId?: string;
    linkUrl?: string;
    userAgent?: string;
    ipAddress?: string;
    bounceReason?: string;
    complaintType?: string;
  }>().default({}),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => ({
  // Indexes for efficient querying
  tenantIdIdx: index('email_events_tenant_id_idx').on(table.tenantId),
  campaignIdIdx: index('email_events_campaign_id_idx').on(table.campaignId),
  timestampIdx: index('email_events_timestamp_idx').on(table.timestamp),
  eventTypeIdx: index('email_events_event_type_idx').on(table.eventType),
  // Composite index for analytics queries
  tenantTimestampIdx: index('email_events_tenant_timestamp_idx').on(table.tenantId, table.timestamp),
}));

// Daily aggregated analytics for performance
export const dailyAnalytics = pgTable('daily_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'cascade' }),
  date: timestamp('date').notNull(),
  metrics: jsonb('metrics').$type<{
    totalSent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    complained: number;
    uniqueOpens: number;
    uniqueClicks: number;
  }>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Unique constraint on tenant, campaign, and date
  tenantCampaignDateIdx: index('daily_analytics_tenant_campaign_date_idx').on(table.tenantId, table.campaignId, table.date),
  dateIdx: index('daily_analytics_date_idx').on(table.date),
}));

// Relations
export const emailEventsRelations = relations(emailEvents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [emailEvents.tenantId],
    references: [tenants.id],
  }),
  campaign: one(campaigns, {
    fields: [emailEvents.campaignId],
    references: [campaigns.id],
  }),
}));

export const dailyAnalyticsRelations = relations(dailyAnalytics, ({ one }) => ({
  tenant: one(tenants, {
    fields: [dailyAnalytics.tenantId],
    references: [tenants.id],
  }),
  campaign: one(campaigns, {
    fields: [dailyAnalytics.campaignId],
    references: [campaigns.id],
  }),
}));

// Zod schemas for validation
export const insertEmailEventSchema = createInsertSchema(emailEvents);
export const selectEmailEventSchema = createSelectSchema(emailEvents);
export const insertDailyAnalyticsSchema = createInsertSchema(dailyAnalytics);
export const selectDailyAnalyticsSchema = createSelectSchema(dailyAnalytics);

export type EmailEvent = typeof emailEvents.$inferSelect;
export type NewEmailEvent = typeof emailEvents.$inferInsert;
export type DailyAnalytics = typeof dailyAnalytics.$inferSelect;
export type NewDailyAnalytics = typeof dailyAnalytics.$inferInsert;