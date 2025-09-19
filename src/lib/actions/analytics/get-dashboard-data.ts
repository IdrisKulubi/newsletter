"use server";

import { analyticsService, DateRange } from "@/lib/services/analytics";
import { getTenantContext } from "@/lib/auth/tenant-context";

export async function getDashboardData(dateRange?: DateRange) {
  try {
    const tenantContext = await getTenantContext();
    
    if (!tenantContext) {
      throw new Error("No tenant context available");
    }

    // Default to last 30 days if no date range provided
    const defaultDateRange: DateRange = {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    };

    const effectiveDateRange = dateRange || defaultDateRange;

    // Get dashboard data for tenant
    const dashboardData = await analyticsService.getAnalyticsDashboard(
      tenantContext.tenant.id,
      effectiveDateRange
    );

    return {
      success: true,
      data: dashboardData,
    };
  } catch (error) {
    console.error("Failed to get dashboard data:", error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get dashboard data",
    };
  }
}