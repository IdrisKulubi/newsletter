/**
 * AI Insights Service
 * Provides AI-powered post-campaign analysis and insights generation
 */

import { aiService } from "@/lib/ai";
import { analyticsService } from "./analytics";
import { db } from "@/lib/db";
import { campaigns, emailEvents } from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { aiQueue } from "@/lib/queue";

export interface CampaignInsights {
  campaignId: string;
  executiveSummary: string;
  performanceAnalysis: {
    overallPerformance: "excellent" | "good" | "average" | "poor";
    keyMetrics: {
      openRate: number;
      clickRate: number;
      engagementScore: number;
    };
    benchmarkComparison: {
      openRateVsAverage: number;
      clickRateVsAverage: number;
    };
  };
  contentAnalysis: {
    subjectLineEffectiveness: string;
    contentEngagement: string;
    topPerformingElements: string[];
  };
  audienceInsights: {
    highPerformingSegments: Array<{
      segment: string;
      openRate: number;
      clickRate: number;
      description: string;
    }>;
    engagementPatterns: string[];
  };
  recommendations: {
    immediate: string[];
    longTerm: string[];
    contentSuggestions: string[];
  };
  generatedAt: Date;
}

export interface AIInsightsJobData {
  tenantId: string;
  type: "campaign-insights";
  data: {
    campaignId: string;
    priority?: "high" | "normal" | "low";
  };
  campaignId: string; // For backward compatibility with the worker
}

export class AIInsightsService {
  /**
   * Generate comprehensive AI insights for a completed campaign
   */
  async generateCampaignInsights(
    campaignId: string,
    tenantId: string
  ): Promise<CampaignInsights> {
    try {
      // Get campaign data and analytics
      const campaign = await db.query.campaigns.findFirst({
        where: and(
          eq(campaigns.id, campaignId),
          eq(campaigns.tenantId, tenantId)
        ),
        with: {
          newsletter: true,
        },
      });

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      if (campaign.status !== "sent") {
        throw new Error(`Campaign ${campaignId} is not completed yet`);
      }

      // Get detailed campaign report
      const campaignReport = await analyticsService.generateCampaignReport(
        campaignId
      );

      // Get tenant's historical performance for benchmarking
      const tenantBenchmarks = await this.getTenantBenchmarks(tenantId);

      // Get audience segment analysis
      const audienceAnalysis = await this.getAudienceSegmentAnalysis(
        campaignId,
        tenantId
      );

      // Generate AI-powered executive summary
      const executiveSummary = await this.generateExecutiveSummary(
        campaign,
        campaignReport,
        tenantBenchmarks
      );

      // Analyze content performance
      const contentAnalysis = await this.analyzeContentPerformance(
        campaign,
        campaignReport
      );

      // Generate recommendations
      const recommendations = await this.generateRecommendations(
        campaign,
        campaignReport,
        tenantBenchmarks,
        audienceAnalysis
      );

      // Calculate performance metrics
      const performanceAnalysis = this.calculatePerformanceAnalysis(
        campaignReport,
        tenantBenchmarks
      );

      const insights: CampaignInsights = {
        campaignId,
        executiveSummary,
        performanceAnalysis,
        contentAnalysis,
        audienceInsights: audienceAnalysis,
        recommendations,
        generatedAt: new Date(),
      };

      // Store insights in campaign record
      await this.storeInsights(campaignId, insights);

      return insights;
    } catch (error) {
      console.error("Failed to generate campaign insights:", error);
      throw error;
    }
  }

  /**
   * Queue AI insights generation as a background job
   */
  async queueInsightsGeneration(
    campaignId: string,
    tenantId: string,
    priority: "high" | "normal" | "low" = "normal"
  ): Promise<void> {
    try {
      await aiQueue.add(
        "campaign-insights",
        {
          tenantId,
          type: "campaign-insights",
          data: {
            campaignId,
            priority,
          },
          campaignId, // Add this for backward compatibility with the worker
        },
        {
          priority: priority === "high" ? 10 : priority === "normal" ? 5 : 1,
          delay: priority === "high" ? 0 : 30000, // 30 second delay for normal/low priority
          removeOnComplete: 10,
          removeOnFail: 5,
        }
      );

      console.log(`Queued AI insights generation for campaign ${campaignId}`);
    } catch (error) {
      console.error("Failed to queue insights generation:", error);
      throw error;
    }
  }

  /**
   * Get insights for a campaign (from stored data or generate if not exists)
   */
  async getCampaignInsights(
    campaignId: string,
    tenantId: string
  ): Promise<CampaignInsights | null> {
    try {
      // First, try to get stored insights
      const campaign = await db.query.campaigns.findFirst({
        where: and(
          eq(campaigns.id, campaignId),
          eq(campaigns.tenantId, tenantId)
        ),
      });

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // Check if insights exist in campaign analytics
      const storedInsights = (campaign.analytics as any)?.insights;
      if (storedInsights && storedInsights.generatedAt) {
        return storedInsights as CampaignInsights;
      }

      // If no stored insights and campaign is completed, generate them
      if (campaign.status === "sent") {
        return await this.generateCampaignInsights(campaignId, tenantId);
      }

      return null;
    } catch (error) {
      console.error("Failed to get campaign insights:", error);
      throw error;
    }
  }

  /**
   * Generate executive summary using AI
   */
  private async generateExecutiveSummary(
    campaign: any,
    report: any,
    benchmarks: any
  ): Promise<string> {
    const prompt = `Generate an executive summary for this email campaign:

Campaign: ${campaign.name}
Subject Line: ${campaign.subjectLine}
Total Sent: ${report.totalSent}
Open Rate: ${report.openRate}% (Benchmark: ${benchmarks.averageOpenRate}%)
Click Rate: ${report.clickRate}% (Benchmark: ${benchmarks.averageClickRate}%)
Bounce Rate: ${report.bounceRate}%

Top performing links:
${report.topLinks
  .slice(0, 3)
  .map((link: any) => `- ${link.url}: ${link.clicks} clicks`)
  .join("\n")}

Provide a concise executive summary highlighting:
1. Overall performance assessment
2. Key achievements or concerns
3. Most significant insights
4. Brief comparison to historical performance

Keep it professional and actionable, maximum 150 words.`;

    try {
      const summary = await aiService.generateCampaignInsights(
        {
          subject_line: campaign.subjectLine,
          content: campaign.newsletter?.content || "",
          open_rate: report.openRate,
          click_rate: report.clickRate,
          total_sent: report.totalSent,
          top_links: report.topLinks,
        },
        campaign.tenantId
      );

      return summary;
    } catch (error) {
      console.error("Failed to generate executive summary:", error);
      // Fallback to template-based summary
      return this.generateFallbackSummary(campaign, report, benchmarks);
    }
  }

  /**
   * Analyze content performance using AI
   */
  private async analyzeContentPerformance(
    campaign: any,
    report: any
  ): Promise<CampaignInsights["contentAnalysis"]> {
    try {
      const subjectLineAnalysis = await this.analyzeSubjectLinePerformance(
        campaign.subjectLine,
        report.openRate
      );

      const contentEngagement = await this.analyzeContentEngagement(
        campaign.newsletter?.content || "",
        report.clickRate,
        report.topLinks
      );

      const topElements = await this.identifyTopPerformingElements(
        campaign.newsletter?.content || "",
        report.topLinks
      );

      return {
        subjectLineEffectiveness: subjectLineAnalysis,
        contentEngagement,
        topPerformingElements: topElements,
      };
    } catch (error) {
      console.error("Failed to analyze content performance:", error);
      return {
        subjectLineEffectiveness: "Analysis unavailable",
        contentEngagement: "Analysis unavailable",
        topPerformingElements: [],
      };
    }
  }

  /**
   * Generate AI-powered recommendations
   */
  private async generateRecommendations(
    campaign: any,
    report: any,
    benchmarks: any,
    audienceAnalysis: any
  ): Promise<CampaignInsights["recommendations"]> {
    const prompt = `Based on this campaign analysis, provide specific recommendations:

Campaign Performance:
- Open Rate: ${report.openRate}% (vs ${benchmarks.averageOpenRate}% average)
- Click Rate: ${report.clickRate}% (vs ${benchmarks.averageClickRate}% average)
- Subject Line: "${campaign.subjectLine}"

Top Links:
${report.topLinks
  .slice(0, 5)
  .map((link: any) => `- ${link.url}: ${link.clicks} clicks`)
  .join("\n")}

Audience Segments:
${audienceAnalysis.highPerformingSegments
  .map(
    (seg: any) =>
      `- ${seg.segment}: ${seg.openRate}% open, ${seg.clickRate}% click`
  )
  .join("\n")}

Provide:
1. 3 immediate actionable recommendations
2. 2 long-term strategic recommendations  
3. 3 specific content suggestions for future campaigns

Be specific and actionable.`;

    try {
      // Use AI to generate recommendations
      const aiRecommendations = await aiService.generateCampaignInsights(
        {
          subject_line: campaign.subjectLine,
          content: campaign.newsletter?.content || "",
          open_rate: report.openRate,
          click_rate: report.clickRate,
          total_sent: report.totalSent,
          top_links: report.topLinks,
        },
        campaign.tenantId
      );

      // Parse AI response into structured recommendations
      return this.parseRecommendations(aiRecommendations);
    } catch (error) {
      console.error("Failed to generate AI recommendations:", error);
      return this.generateFallbackRecommendations(report, benchmarks);
    }
  }

  /**
   * Get tenant's historical performance benchmarks
   */
  private async getTenantBenchmarks(tenantId: string): Promise<{
    averageOpenRate: number;
    averageClickRate: number;
    totalCampaigns: number;
  }> {
    try {
      const benchmarks = await db
        .select({
          avgOpenRate: sql<number>`avg((${campaigns.analytics}->>'openRate')::float)`,
          avgClickRate: sql<number>`avg((${campaigns.analytics}->>'clickRate')::float)`,
          totalCampaigns: sql<number>`count(*)::int`,
        })
        .from(campaigns)
        .where(
          and(
            eq(campaigns.tenantId, tenantId),
            eq(campaigns.status, "sent"),
            sql`(${campaigns.analytics}->>'totalSent')::int > 0`
          )
        );

      return {
        averageOpenRate: benchmarks[0]?.avgOpenRate || 0,
        averageClickRate: benchmarks[0]?.avgClickRate || 0,
        totalCampaigns: benchmarks[0]?.totalCampaigns || 0,
      };
    } catch (error) {
      console.error("Failed to get tenant benchmarks:", error);
      return {
        averageOpenRate: 20, // Industry average fallback
        averageClickRate: 3,
        totalCampaigns: 0,
      };
    }
  }

  /**
   * Analyze audience segments performance
   */
  private async getAudienceSegmentAnalysis(
    campaignId: string,
    tenantId: string
  ): Promise<CampaignInsights["audienceInsights"]> {
    try {
      // Get email events grouped by recipient domain for segment analysis
      const segmentData = await db
        .select({
          domain: sql<string>`split_part(${emailEvents.recipientEmail}, '@', 2)`,
          totalSent: sql<number>`count(distinct ${emailEvents.recipientEmail})::int`,
          opened: sql<number>`count(case when ${emailEvents.eventType} = 'opened' then 1 end)::int`,
          clicked: sql<number>`count(case when ${emailEvents.eventType} = 'clicked' then 1 end)::int`,
        })
        .from(emailEvents)
        .where(
          and(
            eq(emailEvents.campaignId, campaignId),
            eq(emailEvents.tenantId, tenantId)
          )
        )
        .groupBy(sql`split_part(${emailEvents.recipientEmail}, '@', 2)`)
        .having(sql`count(distinct ${emailEvents.recipientEmail}) >= 5`) // Only segments with 5+ recipients
        .orderBy(
          desc(
            sql`count(case when ${emailEvents.eventType} = 'opened' then 1 end)::float / count(distinct ${emailEvents.recipientEmail})`
          )
        )
        .limit(10);

      const highPerformingSegments = segmentData.map((segment) => ({
        segment: segment.domain,
        openRate:
          segment.totalSent > 0
            ? (segment.opened / segment.totalSent) * 100
            : 0,
        clickRate:
          segment.totalSent > 0
            ? (segment.clicked / segment.totalSent) * 100
            : 0,
        description: `${segment.totalSent} recipients from ${segment.domain}`,
      }));

      const engagementPatterns = this.identifyEngagementPatterns(segmentData);

      return {
        highPerformingSegments,
        engagementPatterns,
      };
    } catch (error) {
      console.error("Failed to analyze audience segments:", error);
      return {
        highPerformingSegments: [],
        engagementPatterns: ["Audience analysis unavailable"],
      };
    }
  }

  /**
   * Calculate performance analysis metrics
   */
  private calculatePerformanceAnalysis(
    report: any,
    benchmarks: any
  ): CampaignInsights["performanceAnalysis"] {
    const openRateVsAverage =
      benchmarks.averageOpenRate > 0
        ? ((report.openRate - benchmarks.averageOpenRate) /
            benchmarks.averageOpenRate) *
          100
        : 0;

    const clickRateVsAverage =
      benchmarks.averageClickRate > 0
        ? ((report.clickRate - benchmarks.averageClickRate) /
            benchmarks.averageClickRate) *
          100
        : 0;

    // Calculate engagement score (weighted combination of metrics)
    const engagementScore = report.openRate * 0.4 + report.clickRate * 0.6;

    // Determine overall performance
    let overallPerformance: "excellent" | "good" | "average" | "poor";
    if (engagementScore >= 15) overallPerformance = "excellent";
    else if (engagementScore >= 10) overallPerformance = "good";
    else if (engagementScore >= 5) overallPerformance = "average";
    else overallPerformance = "poor";

    return {
      overallPerformance,
      keyMetrics: {
        openRate: report.openRate,
        clickRate: report.clickRate,
        engagementScore: Math.round(engagementScore * 100) / 100,
      },
      benchmarkComparison: {
        openRateVsAverage: Math.round(openRateVsAverage * 100) / 100,
        clickRateVsAverage: Math.round(clickRateVsAverage * 100) / 100,
      },
    };
  }

  /**
   * Store insights in campaign record
   */
  private async storeInsights(
    campaignId: string,
    insights: CampaignInsights
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

      const updatedAnalytics = {
        ...currentAnalytics,
        insights,
        insightsGeneratedAt: new Date(),
      };

      await db
        .update(campaigns)
        .set({ analytics: updatedAnalytics })
        .where(eq(campaigns.id, campaignId));

      console.log(`Stored AI insights for campaign ${campaignId}`);
    } catch (error) {
      console.error("Failed to store insights:", error);
      // Don't throw here to avoid breaking the main flow
    }
  }

  // Helper methods for AI analysis
  private async analyzeSubjectLinePerformance(
    subjectLine: string,
    openRate: number
  ): Promise<string> {
    // Simple analysis based on subject line characteristics
    const length = subjectLine.length;
    const hasEmoji =
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(
        subjectLine
      );
    const hasNumbers = /\d/.test(subjectLine);
    const hasUrgency = /urgent|limited|now|today|deadline/i.test(subjectLine);

    let analysis = `Subject line "${subjectLine}" achieved ${openRate}% open rate. `;

    if (length < 30) analysis += "Good length for mobile visibility. ";
    else if (length > 50)
      analysis += "Consider shortening for better mobile display. ";

    if (hasEmoji) analysis += "Emoji usage may have helped with visibility. ";
    if (hasNumbers) analysis += "Numbers can increase credibility. ";
    if (hasUrgency)
      analysis += "Urgency words may have driven immediate action. ";

    return analysis;
  }

  private async analyzeContentEngagement(
    content: string,
    clickRate: number,
    topLinks: any[]
  ): Promise<string> {
    const linkCount = topLinks.length;
    const totalClicks = topLinks.reduce((sum, link) => sum + link.clicks, 0);

    let analysis = `Content achieved ${clickRate}% click rate with ${linkCount} clickable elements. `;

    if (linkCount > 5)
      analysis += "Consider reducing number of links to focus attention. ";
    else if (linkCount < 2)
      analysis += "Adding more relevant links could increase engagement. ";

    if (totalClicks > 0) {
      const topLink = topLinks[0];
      analysis += `Most engaging element: "${topLink.url}" with ${topLink.clicks} clicks. `;
    }

    return analysis;
  }

  private async identifyTopPerformingElements(
    content: string,
    topLinks: any[]
  ): Promise<string[]> {
    const elements: string[] = [];

    // Identify top performing links
    topLinks.slice(0, 3).forEach((link) => {
      elements.push(
        `High-performing link: ${link.url} (${link.clicks} clicks)`
      );
    });

    // Add content-based insights
    if (content.includes("call to action") || content.includes("CTA")) {
      elements.push("Clear call-to-action presence");
    }

    if (content.length > 1000) {
      elements.push("Comprehensive content length");
    } else if (content.length < 500) {
      elements.push("Concise content format");
    }

    return elements;
  }

  private identifyEngagementPatterns(segmentData: any[]): string[] {
    const patterns: string[] = [];

    if (segmentData.length > 0) {
      const topSegment = segmentData[0];
      patterns.push(`Highest engagement from ${topSegment.domain} domain`);

      const avgOpenRate =
        segmentData.reduce((sum, seg) => sum + seg.opened / seg.totalSent, 0) /
        segmentData.length;
      if (avgOpenRate > 0.25) {
        patterns.push("Above-average engagement across segments");
      } else if (avgOpenRate < 0.15) {
        patterns.push(
          "Below-average engagement suggests audience refinement needed"
        );
      }
    }

    return patterns;
  }

  private parseRecommendations(
    aiResponse: string
  ): CampaignInsights["recommendations"] {
    // Simple parsing of AI response - in production, you might use more sophisticated parsing
    const lines = aiResponse.split("\n").filter((line) => line.trim());

    return {
      immediate: lines
        .slice(0, 3)
        .map((line) => line.replace(/^\d+\.?\s*/, "")),
      longTerm: lines.slice(3, 5).map((line) => line.replace(/^\d+\.?\s*/, "")),
      contentSuggestions: lines
        .slice(5, 8)
        .map((line) => line.replace(/^\d+\.?\s*/, "")),
    };
  }

  private generateFallbackSummary(
    campaign: any,
    report: any,
    benchmarks: any
  ): string {
    const performance =
      report.openRate > benchmarks.averageOpenRate
        ? "above average"
        : "below average";
    return `Campaign "${campaign.name}" achieved ${report.openRate}% open rate and ${report.clickRate}% click rate, performing ${performance} compared to historical campaigns. ${report.totalSent} emails were sent with ${report.topLinks.length} clickable elements.`;
  }

  private generateFallbackRecommendations(
    report: any,
    benchmarks: any
  ): CampaignInsights["recommendations"] {
    const immediate: string[] = [];
    const longTerm: string[] = [];
    const contentSuggestions: string[] = [];

    if (report.openRate < benchmarks.averageOpenRate) {
      immediate.push(
        "Test different subject line formats to improve open rates"
      );
      immediate.push("Consider send time optimization");
    }

    if (report.clickRate < benchmarks.averageClickRate) {
      immediate.push("Review call-to-action placement and clarity");
      contentSuggestions.push("Add more compelling calls-to-action");
    }

    longTerm.push("Implement A/B testing for subject lines");
    longTerm.push("Develop audience segmentation strategy");

    contentSuggestions.push("Include more visual elements");
    contentSuggestions.push("Personalize content based on recipient data");

    return { immediate, longTerm, contentSuggestions };
  }
}

// Export singleton instance
export const aiInsightsService = new AIInsightsService();
