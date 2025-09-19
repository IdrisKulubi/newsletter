"use server";

import { analyticsService } from "@/lib/services/analytics";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function getCampaignReport(campaignId: string) {
  try {
    const tenantContext = await getTenantContext();
    
    if (!tenantContext) {
      throw new Error("No tenant context available");
    }

    // Verify campaign belongs to tenant
    const campaign = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, campaignId),
        eq(campaigns.tenantId, tenantContext.tenant.id)
      ),
    });

    if (!campaign) {
      throw new Error("Campaign not found or access denied");
    }

    // Generate comprehensive report
    const report = await analyticsService.generateCampaignReport(campaignId);

    return {
      success: true,
      data: report,
    };
  } catch (error) {
    console.error("Failed to get campaign report:", error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get campaign report",
    };
  }
}