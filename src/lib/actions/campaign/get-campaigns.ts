"use server";

import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema/campaigns";
import { newsletters } from "@/lib/db/schema/newsletters";
import { users } from "@/lib/db/schema/users";
import { eq, and, desc, asc, count, sql } from "drizzle-orm";
import { getTenantContext } from "@/lib/tenant/context";
import { z } from "zod";

export const getCampaignsSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  status: z
    .enum(["draft", "scheduled", "sending", "sent", "paused", "cancelled"])
    .optional(),
  sortBy: z
    .enum(["createdAt", "updatedAt", "scheduledAt", "sentAt", "name"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type GetCampaignsParams = z.infer<typeof getCampaignsSchema>;

export interface CampaignWithDetails {
  id: string;
  tenantId: string;
  newsletterId: string;
  name: string;
  subjectLine: string;
  previewText: string | null;
  recipients: {
    list: Array<{
      email: string;
      name?: string;
      metadata?: Record<string, any>;
    }>;
    segmentId?: string;
  };
  status: "draft" | "scheduled" | "sending" | "sent" | "paused" | "cancelled";
  scheduledAt: Date | null;
  sentAt: Date | null;
  analytics: {
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
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  newsletter: {
    id: string;
    title: string;
    status: string;
  };
  createdByUser: {
    id: string;
    email: string;
    name: string | null;
  };
}

export interface GetCampaignsResult {
  success: boolean;
  message: string;
  campaigns?: CampaignWithDetails[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Get campaigns with pagination and filtering
 */
export async function getCampaigns(
  params: GetCampaignsParams = {
    page: 0,
    limit: 0,
    sortBy: "createdAt",
    sortOrder: "asc",
  }
): Promise<GetCampaignsResult> {
  try {
    // Validate input
    const validatedParams = getCampaignsSchema.parse(params);

    // Get tenant context
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, message: "Tenant context not found" };
    }

    // Build where conditions
    const whereConditions = [eq(campaigns.tenantId, tenant.id)];

    if (validatedParams.status) {
      whereConditions.push(eq(campaigns.status, validatedParams.status));
    }

    // Build order by clause
    const orderByColumn = campaigns[validatedParams.sortBy];
    const orderBy =
      validatedParams.sortOrder === "asc"
        ? asc(orderByColumn)
        : desc(orderByColumn);

    // Calculate offset
    const offset = (validatedParams.page - 1) * validatedParams.limit;

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(and(...whereConditions));

    const total = totalResult.count;

    // Get campaigns with related data
    const campaignResults = await db
      .select({
        campaign: campaigns,
        newsletter: {
          id: newsletters.id,
          title: newsletters.title,
          status: newsletters.status,
        },
        createdByUser: {
          id: users.id,
          email: users.email,
          name: users.name,
        },
      })
      .from(campaigns)
      .innerJoin(newsletters, eq(campaigns.newsletterId, newsletters.id))
      .innerJoin(users, eq(campaigns.createdBy, users.id))
      .where(and(...whereConditions))
      .orderBy(orderBy)
      .limit(validatedParams.limit)
      .offset(offset);

    // Transform results
    const campaignsWithDetails: CampaignWithDetails[] = campaignResults.map(
      (result) => ({
        ...result.campaign,
        analytics: result.campaign.analytics || {
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
        },
        newsletter: result.newsletter,
        createdByUser: result.createdByUser,
      })
    );

    const totalPages = Math.ceil(total / validatedParams.limit);

    return {
      success: true,
      message: "Campaigns retrieved successfully",
      campaigns: campaignsWithDetails,
      pagination: {
        page: validatedParams.page,
        limit: validatedParams.limit,
        total,
        totalPages,
      },
    };
  } catch (error) {
    console.error("Failed to get campaigns:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: `Validation error: ${error.issues
          .map((e) => e.message)
          .join(", ")}`,
      };
    }

    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to get campaigns",
    };
  }
}

/**
 * Get a single campaign by ID
 */
export async function getCampaignById(campaignId: string): Promise<{
  success: boolean;
  message: string;
  campaign?: CampaignWithDetails;
}> {
  try {
    // Get tenant context
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, message: "Tenant context not found" };
    }

    // Get campaign with related data
    const campaignResults = await db
      .select({
        campaign: campaigns,
        newsletter: {
          id: newsletters.id,
          title: newsletters.title,
          status: newsletters.status,
        },
        createdByUser: {
          id: users.id,
          email: users.email,
          name: users.name,
        },
      })
      .from(campaigns)
      .innerJoin(newsletters, eq(campaigns.newsletterId, newsletters.id))
      .innerJoin(users, eq(campaigns.createdBy, users.id))
      .where(
        and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenant.id))
      )
      .limit(1);

    if (campaignResults.length === 0) {
      return { success: false, message: "Campaign not found" };
    }

    const result = campaignResults[0];
    const campaignWithDetails: CampaignWithDetails = {
      ...result.campaign,
      analytics: result.campaign.analytics || {
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
      },
      newsletter: result.newsletter,
      createdByUser: result.createdByUser,
    };

    return {
      success: true,
      message: "Campaign retrieved successfully",
      campaign: campaignWithDetails,
    };
  } catch (error) {
    console.error("Failed to get campaign:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to get campaign",
    };
  }
}

/**
 * Get campaign statistics for dashboard
 */
export async function getCampaignStats(): Promise<{
  success: boolean;
  message: string;
  stats?: {
    total: number;
    draft: number;
    scheduled: number;
    sent: number;
    totalEmailsSent: number;
    averageOpenRate: number;
    averageClickRate: number;
  };
}> {
  try {
    // Get tenant context
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, message: "Tenant context not found" };
    }

    // Get campaign counts by status
    const statusCounts = await db
      .select({
        status: campaigns.status,
        count: count(),
      })
      .from(campaigns)
      .where(eq(campaigns.tenantId, tenant.id))
      .groupBy(campaigns.status);

    // Get analytics aggregates
    const analyticsResult = await db
      .select({
        totalEmailsSent: sql<number>`sum((analytics->>'totalSent')::int)`,
        totalOpened: sql<number>`sum((analytics->>'opened')::int)`,
        totalClicked: sql<number>`sum((analytics->>'clicked')::int)`,
        campaignCount: count(),
      })
      .from(campaigns)
      .where(
        and(eq(campaigns.tenantId, tenant.id), eq(campaigns.status, "sent"))
      );

    // Process status counts
    const stats = {
      total: 0,
      draft: 0,
      scheduled: 0,
      sent: 0,
      totalEmailsSent: 0,
      averageOpenRate: 0,
      averageClickRate: 0,
    };

    statusCounts.forEach(({ status, count }) => {
      stats.total += count;
      if (status === "draft") stats.draft = count;
      if (status === "scheduled") stats.scheduled = count;
      if (status === "sent") stats.sent = count;
    });

    // Process analytics
    if (analyticsResult.length > 0) {
      const analytics = analyticsResult[0];
      stats.totalEmailsSent = analytics.totalEmailsSent || 0;

      if (stats.totalEmailsSent > 0) {
        stats.averageOpenRate =
          ((analytics.totalOpened || 0) / stats.totalEmailsSent) * 100;
        stats.averageClickRate =
          ((analytics.totalClicked || 0) / stats.totalEmailsSent) * 100;
      }
    }

    return {
      success: true,
      message: "Campaign statistics retrieved successfully",
      stats,
    };
  } catch (error) {
    console.error("Failed to get campaign stats:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to get campaign statistics",
    };
  }
}
