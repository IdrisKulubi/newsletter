"use server";

import { analyticsService } from "@/lib/services/analytics";
import { EmailEvent } from "@/lib/email";

/**
 * Record a single email event
 * This is typically called from webhook processing
 */
export async function recordEmailEvent(event: EmailEvent) {
  try {
    await analyticsService.recordEmailEvent(event);

    return {
      success: true,
      message: "Event recorded successfully",
    };
  } catch (error) {
    console.error("Failed to record email event:", error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to record event",
    };
  }
}

/**
 * Record multiple email events in a batch
 * This is useful for bulk processing or catch-up scenarios
 */
export async function recordEmailEventsBatch(events: EmailEvent[]) {
  try {
    if (events.length === 0) {
      return {
        success: true,
        message: "No events to process",
      };
    }

    await analyticsService.recordEmailEventsBatch(events);

    return {
      success: true,
      message: `Successfully recorded ${events.length} events`,
    };
  } catch (error) {
    console.error("Failed to record email events batch:", error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to record events batch",
    };
  }
}