/**
 * Server Action for AI campaign insights generation
 */

"use server";

import { z } from "zod";
import { aiService } from "@/lib/ai";
import { getTenantFromHeaders } from "../../tenant/server";
import { db } from "@/lib/db";
import { campaigns, newsletters } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { NewsletterContent } from "@/lib/db/schema/newsletters";

const GenerateInsightsSchema = z.object({
  campaign_id: z.string().uuid("Invalid campaign ID"),
});

/**
 * Extract readable text from NewsletterContent for AI analysis
 */
function extractTextFromNewsletterContent(content: NewsletterContent | null | undefined): string {
  if (!content || !content.blocks) {
    return "";
  }

  const textParts: string[] = [];

  for (const block of content.blocks) {
    switch (block.type) {
      case 'text':
      case 'heading':
        // Extract text from text and heading blocks
        if (block.content.text) {
          textParts.push(block.content.text);
        } else if (block.content.html) {
          // Strip HTML tags for plain text
          const plainText = block.content.html.replace(/<[^>]*>/g, '');
          textParts.push(plainText);
        }
        break;
      
      case 'button':
        // Include button text
        if (block.content.text) {
          textParts.push(`[Button: ${block.content.text}]`);
        }
        break;
      
      case 'image':
        // Include image alt text
        if (block.content.alt) {
          textParts.push(`[Image: ${block.content.alt}]`);
        }
        break;
      
      case 'social':
        // Include social platform information
        if (block.content.platforms && Array.isArray(block.content.platforms)) {
          const platforms = block.content.platforms.map((p: any) => p.name).join(', ');
          textParts.push(`[Social Links: ${platforms}]`);
        }
        break;
      
      // Skip divider and spacer blocks as they don't contain meaningful text
      case 'divider':
      case 'spacer':
      default:
        break;
    }
  }

  return textParts.join('\n\n').trim();
}

export async function generateInsightsAction(formData: FormData) {
  try {
    // Get tenant context
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return {
        success: false,
        error: "Tenant not found",
      };
    }

    // Parse and validate form data
    const data = {
      campaign_id: formData.get("campaign_id") as string,
    };

    const validatedData = GenerateInsightsSchema.parse(data);

    // Fetch campaign data
    const campaign = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, validatedData.campaign_id),
          eq(campaigns.tenantId, tenant.id)
        )
      )
      .limit(1);

    if (!campaign.length) {
      return {
        success: false,
        error: "Campaign not found",
      };
    }

    const campaignData = campaign[0];

    // Ensure campaign is completed
    if (campaignData.status !== "sent") {
      return {
        success: false,
        error: "Campaign must be completed to generate insights",
      };
    }

    // Try to fetch newsletter content separately
    let newsletterContent: NewsletterContent | null = null;
    try {
      const newsletter = await db
        .select({ content: newsletters.content })
        .from(newsletters)
        .where(eq(newsletters.id, campaignData.newsletterId))
        .limit(1);
      
      if (newsletter.length > 0) {
        newsletterContent = newsletter[0].content;
      }
    } catch (error) {
      console.warn('Could not fetch newsletter content:', error);
    }

    // Convert newsletter content to text for AI analysis
    const contentText = extractTextFromNewsletterContent(newsletterContent);

    // Prepare data for AI analysis
    const analysisData = {
      subject_line: campaignData.subjectLine,
      content: contentText || "No content available for analysis",
      open_rate: campaignData.analytics?.openRate || 0,
      click_rate: campaignData.analytics?.clickRate || 0,
      total_sent: campaignData.analytics?.totalSent || 0,
      // TODO: Add top links data when analytics are fully implemented
    };

    // Generate insights using AI service
    const insights = await aiService.generateCampaignInsights(
      analysisData,
      tenant.id
    );

    return {
      success: true,
      data: { insights },
    };
  } catch (error) {
    console.error("Generate insights action error:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid input data",
        details: error.issues,
      };
    }

    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate insights",
    };
  }
}

// Alternative function-based approach for programmatic use
export async function generateCampaignInsights(
  campaignData: {
    subject_line: string;
    content: string;
    open_rate: number;
    click_rate: number;
    total_sent: number;
    top_links?: Array<{ url: string; clicks: number }>;
  },
  tenantId?: string
) {
  return aiService.generateCampaignInsights(campaignData, tenantId);
}
