import { db } from "@/lib/db";
import { emailEvents, dailyAnalytics, campaigns } from "@/lib/db/schema";
import { eq, and, gte, lte, sql, desc, asc } from "drizzle-orm";
import { EmailEvent } from "@/lib/email";

/**
 * Performance-optimized analytics service for handling large datasets (100k+ events)
 */
export class AnalyticsPerformanceService {
  private static readonly BATCH_SIZE = 1000;
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private static cache = new Map<string, { data: any; timestamp: number }>();

  /**
   * Get cached data or fetch if expired
   */
  private static getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data as T;
    }
    return null;
  }

  /**
   * Set cached data
   */
  private static setCachedData<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Clear cache for a specific tenant or all cache
   */
  static clearCache(tenantId?: string): void {
    if (tenantId) {
      // Clear tenant-specific cache entries
      for (const [key] of this.cache) {
        if (key.includes(tenantId)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get optimized dashboard data using pre-aggregated metrics and caching
   */
  static async getOptimizedDashboardData(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ) {
    const cacheKey = `dashboard:${tenantId}:${startDate.getTime()}:${endDate.getTime()}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Use parallel queries for better performance
      const [
        totalCampaignsResult,
        totalSentResult,
        averageRatesResult,
        recentCampaignsResult,
        performanceChartResult,
        topPerformingResult,
      ] = await Promise.all([
        // Total campaigns
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(campaigns)
          .where(
            and(
              eq(campaigns.tenantId, tenantId),
              gte(campaigns.createdAt, startDate),
              lte(campaigns.createdAt, endDate)
            )
          ),

        // Total sent (from pre-aggregated data when possible)
        db
          .select({
            total: sql<number>`coalesce(sum((${campaigns.analytics}->>'totalSent')::int), 0)::int`,
          })
          .from(campaigns)
          .where(
            and(
              eq(campaigns.tenantId, tenantId),
              gte(campaigns.createdAt, startDate),
              lte(campaigns.createdAt, endDate)
            )
          ),

        // Average rates (from pre-aggregated campaign analytics)
        db
          .select({
            avgOpenRate: sql<number>`avg((${campaigns.analytics}->>'openRate')::float)`,
            avgClickRate: sql<number>`avg((${campaigns.analytics}->>'clickRate')::float)`,
          })
          .from(campaigns)
          .where(
            and(
              eq(campaigns.tenantId, tenantId),
              gte(campaigns.createdAt, startDate),
              lte(campaigns.createdAt, endDate),
              sql`(${campaigns.analytics}->>'totalSent')::int > 0`
            )
          ),

        // Recent campaigns (limited and optimized)
        db
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
              gte(campaigns.createdAt, startDate),
              lte(campaigns.createdAt, endDate)
            )
          )
          .orderBy(desc(campaigns.sentAt))
          .limit(10), // Limit for performance

        // Performance chart (use daily aggregates when available)
        this.getPerformanceChartData(tenantId, startDate, endDate),

        // Top performing campaigns
        db
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
              gte(campaigns.createdAt, startDate),
              lte(campaigns.createdAt, endDate),
              sql`(${campaigns.analytics}->>'totalSent')::int > 0`
            )
          )
          .orderBy(desc(sql`(${campaigns.analytics}->>'openRate')::float`))
          .limit(5),
      ]);

      const result = {
        totalCampaigns: totalCampaignsResult[0]?.count || 0,
        totalSent: totalSentResult[0]?.total || 0,
        averageOpenRate: Math.round((averageRatesResult[0]?.avgOpenRate || 0) * 100) / 100,
        averageClickRate: Math.round((averageRatesResult[0]?.avgClickRate || 0) * 100) / 100,
        recentCampaigns: recentCampaignsResult.map(c => ({
          id: c.id,
          name: c.name,
          sentAt: c.sentAt || new Date(),
          openRate: Math.round((c.openRate || 0) * 100) / 100,
          clickRate: Math.round((c.clickRate || 0) * 100) / 100,
        })),
        performanceChart: performanceChartResult,
        topPerformingCampaigns: topPerformingResult.map(c => ({
          id: c.id,
          name: c.name,
          openRate: Math.round((c.openRate || 0) * 100) / 100,
          clickRate: Math.round((c.clickRate || 0) * 100) / 100,
        })),
      };

      // Cache the result
      this.setCachedData(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error("Failed to get optimized dashboard data:", error);
      throw error;
    }
  }

  /**
   * Get performance chart data using daily aggregates when possible
   */
  private static async getPerformanceChartData(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ) {
    try {
      // First try to get data from daily aggregates
      const aggregatedData = await db
        .select({
          date: sql<string>`date(${dailyAnalytics.date})`,
          sent: sql<number>`sum((${dailyAnalytics.metrics}->>'delivered')::int)::int`,
          opened: sql<number>`sum((${dailyAnalytics.metrics}->>'opened')::int)::int`,
          clicked: sql<number>`sum((${dailyAnalytics.metrics}->>'clicked')::int)::int`,
        })
        .from(dailyAnalytics)
        .where(
          and(
            eq(dailyAnalytics.tenantId, tenantId),
            gte(dailyAnalytics.date, startDate),
            lte(dailyAnalytics.date, endDate)
          )
        )
        .groupBy(sql`date(${dailyAnalytics.date})`)
        .orderBy(asc(sql`date(${dailyAnalytics.date})`));

      // If we have aggregated data for the full range, use it
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (aggregatedData.length >= daysDiff * 0.8) { // If we have 80% coverage
        return aggregatedData.map(d => ({
          date: d.date,
          sent: d.sent,
          opened: d.opened,
          clicked: d.clicked,
        }));
      }

      // Fallback to real-time data with optimization
      return await this.getRealTimePerformanceData(tenantId, startDate, endDate);
    } catch (error) {
      console.error("Failed to get performance chart data:", error);
      return [];
    }
  }

  /**
   * Get real-time performance data with optimizations for large datasets
   */
  private static async getRealTimePerformanceData(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ) {
    // Use indexed query with date partitioning
    const performanceData = await db
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
          gte(emailEvents.timestamp, startDate),
          lte(emailEvents.timestamp, endDate)
        )
      )
      .groupBy(sql`date(${emailEvents.timestamp})`)
      .orderBy(asc(sql`date(${emailEvents.timestamp})`));

    return performanceData.map(p => ({
      date: p.date,
      sent: p.sent,
      opened: p.opened,
      clicked: p.clicked,
    }));
  }

  /**
   * Batch process email events for better performance
   */
  static async batchProcessEmailEvents(events: EmailEvent[]): Promise<void> {
    if (events.length === 0) return;

    try {
      // Process in batches to avoid memory issues
      for (let i = 0; i < events.length; i += this.BATCH_SIZE) {
        const batch = events.slice(i, i + this.BATCH_SIZE);
        
        await db.transaction(async (tx) => {
          // Insert events in batch
          await tx.insert(emailEvents).values(
            batch.map((event) => ({
              tenantId: event.tenantId,
              campaignId: event.campaignId || null,
              recipientEmail: event.recipientEmail,
              eventType: event.eventType,
              eventData: event.eventData,
              timestamp: event.timestamp,
            }))
          );

          // Update campaign analytics for unique campaigns in this batch
          const campaignIds = [...new Set(batch.map(e => e.campaignId).filter(Boolean))];
          
          for (const campaignId of campaignIds) {
            if (campaignId) {
              await this.updateCampaignAnalyticsBatch(tx, campaignId, batch.filter(e => e.campaignId === campaignId));
            }
          }
        });

        // Clear relevant cache entries after processing
        const tenantIds = [...new Set(batch.map(e => e.tenantId))];
        tenantIds.forEach(tenantId => this.clearCache(tenantId));
      }
    } catch (error) {
      console.error("Failed to batch process email events:", error);
      throw error;
    }
  }

  /**
   * Update campaign analytics in batch with optimized queries
   */
  private static async updateCampaignAnalyticsBatch(
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

      // Count events by type efficiently
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
        updatedAnalytics.clickRate = (updatedAnalytics.clicked / totalSent) * 100;
        updatedAnalytics.bounceRate = (updatedAnalytics.bounced / totalSent) * 100;
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

  /**
   * Get campaign report with performance optimizations
   */
  static async getOptimizedCampaignReport(campaignId: string) {
    const cacheKey = `campaign-report:${campaignId}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get campaign details
      const campaign = await db.query.campaigns.findFirst({
        where: eq(campaigns.id, campaignId),
      });

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // Use parallel queries for better performance
      const [eventCounts, uniqueOpens, uniqueClicks, topLinks, timeline] = await Promise.all([
        // Event counts
        db
          .select({
            eventType: emailEvents.eventType,
            count: sql<number>`count(*)::int`,
          })
          .from(emailEvents)
          .where(eq(emailEvents.campaignId, campaignId))
          .groupBy(emailEvents.eventType),

        // Unique opens
        db
          .select({
            count: sql<number>`count(distinct ${emailEvents.recipientEmail})::int`,
          })
          .from(emailEvents)
          .where(
            and(
              eq(emailEvents.campaignId, campaignId),
              eq(emailEvents.eventType, "opened")
            )
          ),

        // Unique clicks
        db
          .select({
            count: sql<number>`count(distinct ${emailEvents.recipientEmail})::int`,
          })
          .from(emailEvents)
          .where(
            and(
              eq(emailEvents.campaignId, campaignId),
              eq(emailEvents.eventType, "clicked")
            )
          ),

        // Top links (limited for performance)
        db
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
          .limit(10),

        // Timeline (last 30 days only for performance)
        db
          .select({
            date: sql<string>`date(${emailEvents.timestamp})`,
            opens: sql<number>`count(case when ${emailEvents.eventType} = 'opened' then 1 end)::int`,
            clicks: sql<number>`count(case when ${emailEvents.eventType} = 'clicked' then 1 end)::int`,
          })
          .from(emailEvents)
          .where(
            and(
              eq(emailEvents.campaignId, campaignId),
              gte(emailEvents.timestamp, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
            )
          )
          .groupBy(sql`date(${emailEvents.timestamp})`)
          .orderBy(asc(sql`date(${emailEvents.timestamp})`)),
      ]);

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
      const bounceRate = totalSent > 0 ? (metrics.bounced / totalSent) * 100 : 0;

      const result = {
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
        topLinks: topLinks.map(link => ({
          url: link.url || '',
          clicks: link.clicks,
        })),
        timeline: timeline.map(t => ({
          date: t.date,
          opens: t.opens,
          clicks: t.clicks,
        })),
      };

      // Cache the result
      this.setCachedData(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error("Failed to get optimized campaign report:", error);
      throw error;
    }
  }
}