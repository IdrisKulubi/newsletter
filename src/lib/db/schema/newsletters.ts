import { pgTable, text, timestamp, jsonb, uuid, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { tenants } from './tenants';
import { users } from './users';

// Newsletter block types and interfaces
export interface NewsletterBlock {
  id: string;
  type: 'text' | 'image' | 'button' | 'divider' | 'social' | 'spacer' | 'heading';
  content: Record<string, any>;
  styling?: BlockStyling;
}

export interface BlockStyling {
  backgroundColor?: string;
  textColor?: string;
  fontSize?: string;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  padding?: string;
  margin?: string;
  borderRadius?: string;
  border?: string;
}

export interface TextBlockContent {
  text: string;
  html?: string;
}

export interface ImageBlockContent {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  link?: string;
}

export interface ButtonBlockContent {
  text: string;
  url: string;
  variant?: 'primary' | 'secondary' | 'outline';
}

export interface SocialBlockContent {
  platforms: Array<{
    name: 'twitter' | 'facebook' | 'linkedin' | 'instagram' | 'youtube';
    url: string;
  }>;
}

export interface NewsletterContent {
  blocks: NewsletterBlock[];
  globalStyling?: {
    fontFamily?: string;
    primaryColor?: string;
    secondaryColor?: string;
    backgroundColor?: string;
  };
}

export interface TemplateConfig {
  id: string;
  name: string;
  config: {
    layout: 'single-column' | 'two-column' | 'three-column';
    headerStyle?: 'minimal' | 'branded' | 'image';
    footerStyle?: 'minimal' | 'social' | 'detailed';
    colorScheme?: 'light' | 'dark' | 'custom';
  };
}

export interface NewsletterMetadata {
  description?: string;
  tags?: string[];
  estimatedReadTime?: number;
  previewText?: string;
  seoTitle?: string;
  language?: string;
}

export const newsletters = pgTable('newsletters', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  content: jsonb('content').$type<NewsletterContent>().default({ blocks: [] }),
  template: jsonb('template').$type<TemplateConfig>(),
  metadata: jsonb('metadata').$type<NewsletterMetadata>().default({}),
  status: text('status', { enum: ['draft', 'review', 'approved'] }).default('draft').notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Indexes for efficient queries
  tenantIdIdx: index('newsletters_tenant_id_idx').on(table.tenantId),
  statusIdx: index('newsletters_status_idx').on(table.status),
  createdByIdx: index('newsletters_created_by_idx').on(table.createdBy),
  createdAtIdx: index('newsletters_created_at_idx').on(table.createdAt),
  tenantStatusIdx: index('newsletters_tenant_status_idx').on(table.tenantId, table.status),
}));

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
export const blockStylingSchema = z.object({
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  fontSize: z.string().optional(),
  fontWeight: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  padding: z.string().optional(),
  margin: z.string().optional(),
  borderRadius: z.string().optional(),
  border: z.string().optional(),
});

export const textBlockContentSchema = z.object({
  text: z.string(),
  html: z.string().optional(),
});

export const imageBlockContentSchema = z.object({
  src: z.string().url(),
  alt: z.string(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  link: z.string().url().optional(),
});

export const buttonBlockContentSchema = z.object({
  text: z.string().min(1),
  url: z.string().url(),
  variant: z.enum(['primary', 'secondary', 'outline']).optional(),
});

export const socialBlockContentSchema = z.object({
  platforms: z.array(z.object({
    name: z.enum(['twitter', 'facebook', 'linkedin', 'instagram', 'youtube']),
    url: z.string().url(),
  })),
});

export const newsletterBlockSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'image', 'button', 'divider', 'social', 'spacer', 'heading']),
  content: z.record(z.string(), z.any()),
  styling: blockStylingSchema.optional(),
});

export const newsletterContentSchema = z.object({
  blocks: z.array(newsletterBlockSchema),
  globalStyling: z.object({
    fontFamily: z.string().optional(),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    backgroundColor: z.string().optional(),
  }).optional(),
});

export const templateConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  config: z.object({
    layout: z.enum(['single-column', 'two-column', 'three-column']),
    headerStyle: z.enum(['minimal', 'branded', 'image']).optional(),
    footerStyle: z.enum(['minimal', 'social', 'detailed']).optional(),
    colorScheme: z.enum(['light', 'dark', 'custom']).optional(),
  }),
});

export const newsletterMetadataSchema = z.object({
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  estimatedReadTime: z.number().positive().optional(),
  previewText: z.string().optional(),
  seoTitle: z.string().optional(),
  language: z.string().optional(),
});

export const insertNewsletterSchema = createInsertSchema(newsletters, {
  content: newsletterContentSchema,
  template: templateConfigSchema.optional(),
  metadata: newsletterMetadataSchema,
});

export const selectNewsletterSchema = createSelectSchema(newsletters);

export const updateNewsletterSchema = insertNewsletterSchema.partial().omit({
  id: true,
  tenantId: true,
  createdAt: true,
});

export type Newsletter = typeof newsletters.$inferSelect;
export type NewNewsletter = typeof newsletters.$inferInsert;
export type UpdateNewsletter = z.infer<typeof updateNewsletterSchema>;