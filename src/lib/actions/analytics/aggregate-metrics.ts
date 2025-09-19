"use server";

import { analyticsService } from "@/lib/services/analytics";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { analyticsQueue } from "@/lib/queue";

/**
 * Trigger nightly metrics aggregation
 * This can be called manually or scheduled via cron
 */
export async function aggregateNightlyMetrics() {
  try {
    const tenantContext = await getTenantContext();
    
    if (!tenantContext) {
      throw new Error("No tenant context available");
    }

    // Run aggregation directly
    await analyticsService.aggregateNightlyMetrics();

    return {
      success: true,
      message: "Nightly metrics aggregation completed successfully",
    };
  } catch (error) {
    console.error("Failed to aggregate nightly metrics:", error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to aggregate metrics",
    };
  }
}

/**
 * Queue nightly metrics aggregation job
 * This is the preferred method for scheduled aggregation
 */
export async function queueNightlyAggregation() {
  try {
    const tenantContext = await getTenantContext();
    
    if (!tenantContext) {
      throw new Error("No tenant context available");
    }

    // Add job to analytics queue
    const job = await analyticsQueue.add(
      "daily-aggregation",
      {
        tenantId: tenantContext.tenant.id,
        eventType: "daily-aggregation",
        data: {
          scheduledAt: new Date().toISOString(),
        },
      },
      {
        // Run at 2 AM daily
        repeat: {
          pattern: "0 2 * * *",
        },
        // Remove completed jobs after 7 days
        removeOnComplete: 7,
        removeOnFail: 3,
      }
    );

    return {
      success: true,
      message: "Nightly aggregation job queued successfully",
      jobId: job.id,
    };
  } catch (error) {
    console.error("Failed to queue nightly aggregation:", error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to queue aggregation job",
    };
  }
}