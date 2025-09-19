import { db } from "@/lib/db";
import { emailEvents, dailyAnalytics, campaigns } from "@/lib/db/schema";
import { eq, and, gte, lte, sql, desc, asc } from "drizzle-orm";
import { EmailEvent } from "@/lib/email";

export interface CampaignReport {
  campaignId: string;
  campaignName: string;
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
  uniqueOpens: number;
  uniqueClicks: number;
  topLinks: Array<{
    url: string;
    clicks: number;
  }>;
  timeline: Array<{
    date: string;
    opens: number;
    clicks: number;
  }>;
}

export interface DashboardData {
  totalCampaigns: number;
  totalSent: number;
  averageOpenRate: number;
  averageClickRate: number;
  recentCampaigns: Array<{
    id: string;
    name: string;
    sentAt: Date;
    openRate: number;
    clickRate: number;
  }>;
  performanceChart: Array<{
    date: string;
    sent: number;
    opened: number;
    clicked: number;
  }>;
  topPerformingCampaigns: Array<{
    id: string;
    name: string;
    openRate: number;
    clickRate: number;
  }>;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export class AnalyticsService {
  /**
   * Record an email event with batch processing support
   */
  async recordEmailEvent(event: EmailEvent): Promise<void> {
    try {
      // Only record events that have a campaignId
      if (!event.campaignId) {
        console.warn("Skipping email event without campaignId:", event);
        return;
      }

      await db.insert(emailEvents).values({
        tenantId: event.tenantId,
        campaignId: event.campaignId,
        recipientEmail: event.recipientEmail,
        eventType: event.eventType,
        eventData: event.eventData,
        timestamp: event.timestamp,
      });

      // Update campaign analytics in real-time for immediate events
      await this.updateCampaignAnalytics(event.campaignId, event.eventType);
    } catch (error) {
      console.error("Failed to record email event:", error);
      throw error;
    }
  }

  /**
   * Record multiple email events in a batch
   */
  async recordEmailEventsBatch(events: EmailEvent[]): Promise<void> {
    if (events.length === 0) return;

    try {
      // Insert all events in a single transaction
      await db.transaction(async (tx) => {
        // Filter out events without campaignId and batch insert events
        const validEvents = events.filter((event) => event.campaignId);

        if (validEvents.length > 0) {
          await tx.insert(emailEvents).values(
            validEvents.map((event) => ({
              tenantId: event.tenantId,
              campaignId: event.campaignId!, // We know it's not null due to filter
              recipientEmail: event.recipientEmail,
              eventType: event.eventType,
              eventData: event.eventData,
              timestamp: event.timestamp,
            }))
          );
        }

        // Update campaign analytics for each unique campaign
        const campaignIds = [
          ...new Set(validEvents.map((e) => e.campaignId!)),
        ] as string[];

        for (const campaignId of campaignIds) {
          const campaignEvents = validEvents.filter(
            (e) => e.campaignId === campaignId
          );
          await this.updateCampaignAnalyticsBatch(
            tx,
            campaignId,
            campaignEvents
          );
        }
      });
    } catch (error) {
      console.error("Failed to record email events batch:", error);
      throw error;
    }
  }

  /**
   * Generate comprehensive campaign report
   */
  async generateCampaignReport(campaignId: string): Promise<CampaignReport> {
    try {
      // Get campaign details
      const campaign = await db.query.campaigns.findFirst({
        where: eq(campaigns.id, campaignId),
      });

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // Get event counts
      const eventCounts = await db
        .select({
          eventType: emailEvents.eventType,
          count: sql<number>`count(*)::int`,
        })
        .from(emailEvents)
        .where(eq(emailEvents.campaignId, campaignId))
        .groupBy(emailEvents.eventType);

      // Get unique opens and clicks
      const uniqueOpens = await db
        .select({
          count: sql<number>`count(distinct ${emailEvents.recipientEmail})::int`,
        })
        .from(emailEvents)
        .where(
          and(
            eq(emailEvents.campaignId, campaignId),
            eq(emailEvents.eventType, "opened")
          )
        );

      const uniqueClicks = await db
        .select({
          count: sql<number>`count(distinct ${emailEvents.recipientEmail})::int`,
        })
        .from(emailEvents)
        .where(
          and(
            eq(emailEvents.campaignId, campaignId),
            eq(emailEvents.eventType, "clicked")
          )
        );

      // Get top links
      const topLinks = await db
        .select({
          url: sql<string>`${emailEvents.eventData}->>'linkUrl'`,
          clicks: sql<number>`count(*)::int`,
        })
        .from(emailEvents)
        .where(
          and(
            eq(emailEvents.campaignId, campaignId),
            eq(emailEvents.eventType, "clicked"),
            sql`${emailEvents.eventData}->>'linkUrl' IS NOT NULL`
          )
        )
        .groupBy(sql`${emailEvents.eventData}->>'linkUrl'`)
        .orderBy(desc(sql`count(*)`))
        .limit(10);

      // Get timeline data (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const timeline = await db
        .select({
          date: sql<string>`date(${emailEvents.timestamp})`,
          opens: sql<number>`count(case when ${emailEvents.eventType} = 'opened' then 1 end)::int`,
          clicks: sql<number>`count(case when ${emailEvents.eventType} = 'clicked' then 1 end)::int`,
        })
        .from(emailEvents)
        .where(
          and(
            eq(emailEvents.campaignId, campaignId),
            gte(emailEvents.timestamp, thirtyDaysAgo)
          )
        )
        .groupBy(sql`date(${emailEvents.timestamp})`)
        .orderBy(asc(sql`date(${emailEvents.timestamp})`));

      // Calculate metrics
      const metrics = eventCounts.reduce(
        (acc, { eventType, count }) => {
          acc[eventType] = count;
          return acc;
        },
        {
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          unsubscribed: 0,
          complained: 0,
        }
      );

      const totalSent = campaign.analytics?.totalSent || 0;
      const openRate = totalSent > 0 ? (metrics.opened / totalSent) * 100 : 0;
      const clickRate = totalSent > 0 ? (metrics.clicked / totalSent) * 100 : 0;
      const bounceRate =
        totalSent > 0 ? (metrics.bounced / totalSent) * 100 : 0;

      return {
        campaignId,
        campaignName: campaign.name,
        totalSent,
        delivered: metrics.delivered,
        opened: metrics.opened,
        clicked: metrics.clicked,
        bounced: metrics.bounced,
        unsubscribed: metrics.unsubscribed,
        complained: metrics.complained,
        openRate: Math.round(openRate * 100) / 100,
        clickRate: Math.round(clickRate * 100) / 100,
        bounceRate: Math.round(bounceRate * 100) / 100,
        uniqueOpens: uniqueOpens[0]?.count || 0,
        uniqueClicks: uniqueClicks[0]?.count || 0,
        topLinks: topLinks.map((link) => ({
          url: link.url || "",
          clicks: link.clicks,
        })),
        timeline: timeline.map((t) => ({
          date: t.date,
          opens: t.opens,
          clicks: t.clicks,
        })),
      };
    } catch (error) {
      console.error("Failed to generate campaign report:", error);
      throw error;
    }
  }

  /**
   * Get analytics dashboard data for a tenant
   */
  async getAnalyticsDashboard(
    tenantId: string,
    dateRange: DateRange
  ): Promise<DashboardData> {
    try {
      // Get total campaigns in date range
      const totalCampaigns = await db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(campaigns)
        .where(
          and(
            eq(campaigns.tenantId, tenantId),
            gte(campaigns.createdAt, dateRange.startDate),
            lte(campaigns.createdAt, dateRange.endDate)
          )
        );

      // Get total sent emails
      const totalSentResult = await db
        .select({
          total: sql<number>`sum((${campaigns.analytics}->>'totalSent')::int)::int`,
        })
        .from(campaigns)
        .where(
          and(
            eq(campaigns.tenantId, tenantId),
            gte(campaigns.createdAt, dateRange.startDate),
            lte(campaigns.createdAt, dateRange.endDate)
          )
        );

      // Get average rates
      const averageRates = await db
        .select({
          avgOpenRate: sql<number>`avg((${campaigns.analytics}->>'openRate')::float)`,
          avgClickRate: sql<number>`avg((${campaigns.analytics}->>'clickRate')::float)`,
        })
        .from(campaigns)
        .where(
          and(
            eq(campaigns.tenantId, tenantId),
            gte(campaigns.createdAt, dateRange.startDate),
            lte(campaigns.createdAt, dateRange.endDate),
            sql`(${campaigns.analytics}->>'totalSent')::int > 0`
          )
        );

      // Get recent campaigns
      const recentCampaigns = await db
        .select({
          id: campaigns.id,
          name: campaigns.name,
          sentAt: campaigns.sentAt,
          openRate: sql<number>`(${campaigns.analytics}->>'openRate')::float`,
          clickRate: sql<number>`(${campaigns.analytics}->>'clickRate')::float`,
        })
        .from(campaigns)
        .where(
          and(
            eq(campaigns.tenantId, tenantId),
            eq(campaigns.status, "sent"),
            gte(campaigns.createdAt, dateRange.startDate),
            lte(campaigns.createdAt, dateRange.endDate)
          )
        )
        .orderBy(desc(campaigns.sentAt))
        .limit(5);

      // Get performance chart data (daily aggregates)
      const performanceChart = await db
        .select({
          date: sql<string>`date(${emailEvents.timestamp})`,
          sent: sql<number>`count(case when ${emailEvents.eventType} = 'delivered' then 1 end)::int`,
          opened: sql<number>`count(case when ${emailEvents.eventType} = 'opened' then 1 end)::int`,
          clicked: sql<number>`count(case when ${emailEvents.eventType} = 'clicked' then 1 end)::int`,
        })
        .from(emailEvents)
        .where(
          and(
            eq(emailEvents.tenantId, tenantId),
            gte(emailEvents.timestamp, dateRange.startDate),
            lte(emailEvents.timestamp, dateRange.endDate)
          )
        )
        .groupBy(sql`date(${emailEvents.timestamp})`)
        .orderBy(asc(sql`date(${emailEvents.timestamp})`));

      // Get top performing campaigns
      const topPerformingCampaigns = await db
        .select({
          id: campaigns.id,
          name: campaigns.name,
          openRate: sql<number>`(${campaigns.analytics}->>'openRate')::float`,
          clickRate: sql<number>`(${campaigns.analytics}->>'clickRate')::float`,
        })
        .from(campaigns)
        .where(
          and(
            eq(campaigns.tenantId, tenantId),
            eq(campaigns.status, "sent"),
            gte(campaigns.createdAt, dateRange.startDate),
            lte(campaigns.createdAt, dateRange.endDate),
            sql`(${campaigns.analytics}->>'totalSent')::int > 0`
          )
        )
        .orderBy(desc(sql`(${campaigns.analytics}->>'openRate')::float`))
        .limit(5);

      return {
        totalCampaigns: totalCampaigns[0]?.count || 0,
        totalSent: totalSentResult[0]?.total || 0,
        averageOpenRate:
          Math.round((averageRates[0]?.avgOpenRate || 0) * 100) / 100,
        averageClickRate:
          Math.round((averageRates[0]?.avgClickRate || 0) * 100) / 100,
        recentCampaigns: recentCampaigns.map((c) => ({
          id: c.id,
          name: c.name,
          sentAt: c.sentAt || new Date(),
          openRate: Math.round((c.openRate || 0) * 100) / 100,
          clickRate: Math.round((c.clickRate || 0) * 100) / 100,
        })),
        performanceChart: performanceChart.map((p) => ({
          date: p.date,
          sent: p.sent,
          opened: p.opened,
          clicked: p.clicked,
        })),
        topPerformingCampaigns: topPerformingCampaigns.map((c) => ({
          id: c.id,
          name: c.name,
          openRate: Math.round((c.openRate || 0) * 100) / 100,
          clickRate: Math.round((c.clickRate || 0) * 100) / 100,
        })),
      };
    } catch (error) {
      console.error("Failed to get analytics dashboard:", error);
      throw error;
    }
  }

  /**
   * Aggregate nightly metrics for performance optimization
   */
  async aggregateNightlyMetrics(): Promise<void> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date(yesterday);
      today.setDate(today.getDate() + 1);

      // Get all campaigns that had events yesterday
      const campaignsWithEvents = await db
        .select({
          tenantId: emailEvents.tenantId,
          campaignId: emailEvents.campaignId,
        })
        .from(emailEvents)
        .where(
          and(
            gte(emailEvents.timestamp, yesterday),
            lte(emailEvents.timestamp, today),
            sql`${emailEvents.campaignId} IS NOT NULL`
          )
        )
        .groupBy(emailEvents.tenantId, emailEvents.campaignId);

      // Aggregate metrics for each campaign
      for (const { tenantId, campaignId } of campaignsWithEvents) {
        if (!campaignId) continue;

        const metrics = await db
          .select({
            totalSent: sql<number>`count(case when ${emailEvents.eventType} = 'delivered' then 1 end)::int`,
            delivered: sql<number>`count(case when ${emailEvents.eventType} = 'delivered' then 1 end)::int`,
            opened: sql<number>`count(case when ${emailEvents.eventType} = 'opened' then 1 end)::int`,
            clicked: sql<number>`count(case when ${emailEvents.eventType} = 'clicked' then 1 end)::int`,
            bounced: sql<number>`count(case when ${emailEvents.eventType} = 'bounced' then 1 end)::int`,
            unsubscribed: sql<number>`count(case when ${emailEvents.eventType} = 'unsubscribed' then 1 end)::int`,
            complained: sql<number>`count(case when ${emailEvents.eventType} = 'complained' then 1 end)::int`,
            uniqueOpens: sql<number>`count(distinct case when ${emailEvents.eventType} = 'opened' then ${emailEvents.recipientEmail} end)::int`,
            uniqueClicks: sql<number>`count(distinct case when ${emailEvents.eventType} = 'clicked' then ${emailEvents.recipientEmail} end)::int`,
          })
          .from(emailEvents)
          .where(
            and(
              eq(emailEvents.tenantId, tenantId),
              eq(emailEvents.campaignId, campaignId),
              gte(emailEvents.timestamp, yesterday),
              lte(emailEvents.timestamp, today)
            )
          );

        if (metrics.length > 0) {
          const metric = metrics[0];

          // Insert or update daily analytics
          await db
            .insert(dailyAnalytics)
            .values({
              tenantId,
              campaignId,
              date: yesterday,
              metrics: {
                totalSent: metric.totalSent,
                delivered: metric.delivered,
                opened: metric.opened,
                clicked: metric.clicked,
                bounced: metric.bounced,
                unsubscribed: metric.unsubscribed,
                complained: metric.complained,
                uniqueOpens: metric.uniqueOpens,
                uniqueClicks: metric.uniqueClicks,
              },
            })
            .onConflictDoUpdate({
              target: [
                dailyAnalytics.tenantId,
                dailyAnalytics.campaignId,
                dailyAnalytics.date,
              ],
              set: {
                metrics: sql`excluded.metrics`,
                updatedAt: sql`now()`,
              },
            });
        }
      }

      console.log(
        `Aggregated metrics for ${campaignsWithEvents.length} campaigns`
      );
    } catch (error) {
      console.error("Failed to aggregate nightly metrics:", error);
      throw error;
    }
  }

  /**
   * Update campaign analytics in real-time
   */
  private async updateCampaignAnalytics(
    campaignId: string,
    eventType: EmailEvent["eventType"]
  ): Promise<void> {
    try {
      // Get current analytics
      const campaign = await db.query.campaigns.findFirst({
        where: eq(campaigns.id, campaignId),
        columns: { analytics: true },
      });

      if (!campaign) return;

      const currentAnalytics = campaign.analytics || {
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
      };

      // Increment the appropriate counter
      const updatedAnalytics = { ...currentAnalytics };
      updatedAnalytics[eventType]++;
      updatedAnalytics.lastUpdated = new Date();

      // Recalculate rates
      const totalSent = updatedAnalytics.totalSent;
      if (totalSent > 0) {
        updatedAnalytics.openRate = (updatedAnalytics.opened / totalSent) * 100;
        updatedAnalytics.clickRate =
          (updatedAnalytics.clicked / totalSent) * 100;
        updatedAnalytics.bounceRate =
          (updatedAnalytics.bounced / totalSent) * 100;
      }

      // Update campaign
      await db
        .update(campaigns)
        .set({ analytics: updatedAnalytics })
        .where(eq(campaigns.id, campaignId));
    } catch (error) {
      console.error("Failed to update campaign analytics:", error);
      // Don't throw here to avoid breaking the main flow
    }
  }

  /**
   * Update campaign analytics for multiple events in a batch
   */
  private async updateCampaignAnalyticsBatch(
    tx: any,
    campaignId: string,
    events: EmailEvent[]
  ): Promise<void> {
    try {
      // Get current analytics
      const campaign = await tx.query.campaigns.findFirst({
        where: eq(campaigns.id, campaignId),
        columns: { analytics: true },
      });

      if (!campaign) return;

      const currentAnalytics = campaign.analytics || {
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
      };

      // Count events by type
      const eventCounts = events.reduce((acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Update analytics
      const updatedAnalytics = { ...currentAnalytics };
      Object.entries(eventCounts).forEach(([eventType, count]) => {
        if (eventType in updatedAnalytics) {
          (updatedAnalytics as any)[eventType] += count;
        }
      });
      updatedAnalytics.lastUpdated = new Date();

      // Recalculate rates
      const totalSent = updatedAnalytics.totalSent;
      if (totalSent > 0) {
        updatedAnalytics.openRate = (updatedAnalytics.opened / totalSent) * 100;
        updatedAnalytics.clickRate =
          (updatedAnalytics.clicked / totalSent) * 100;
        updatedAnalytics.bounceRate =
          (updatedAnalytics.bounced / totalSent) * 100;
      }

      // Update campaign
      await tx
        .update(campaigns)
        .set({ analytics: updatedAnalytics })
        .where(eq(campaigns.id, campaignId));
    } catch (error) {
      console.error("Failed to update campaign analytics batch:", error);
      // Don't throw here to avoid breaking the transaction
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
