/**
 * AI Insights Server Actions Tests
 * Unit tests for AI insights server actions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateCampaignInsights,
  queueInsightsGeneration,
  getCampaignInsights,
  regenerateCampaignInsights,
} from "../ai-insights";
import { aiInsightsService } from "@/lib/services/ai-insights";
import { getCurrentUser } from "@/lib/auth";
import { getTenantContext } from "@/lib/auth/tenant-context";

// Mock dependencies
vi.mock("@/lib/services/ai-insights");
vi.mock("@/lib/auth");
vi.mock("@/lib/auth/tenant-context");
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockAiInsightsService = vi.mocked(aiInsightsService);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockGetTenantContext = vi.mocked(getTenantContext);

describe("AI Insights Server Actions", () => {
  const VALID_CAMPAIGN_ID = "550e8400-e29b-41d4-a716-446655440000";
  const VALID_TENANT_ID = "550e8400-e29b-41d4-a716-446655440001";
  const VALID_USER_ID = "550e8400-e29b-41d4-a716-446655440002";

  const mockUser = {
    id: VALID_USER_ID,
    email: "test@example.com",
    role: "editor" as const,
    tenantId: VALID_TENANT_ID,
  };

  const mockTenantContext = {
    id: VALID_TENANT_ID,
    name: "Test Tenant",
    domain: "test.example.com",
  };

  const mockInsights = {
    campaignId: VALID_CAMPAIGN_ID,
    executiveSummary: "Test summary",
    performanceAnalysis: {
      overallPerformance: "good" as const,
      keyMetrics: {
        openRate: 25.0,
        clickRate: 5.0,
        engagementScore: 13.0,
      },
      benchmarkComparison: {
        openRateVsAverage: 25.0,
        clickRateVsAverage: 66.67,
      },
    },
    contentAnalysis: {
      subjectLineEffectiveness: "Good performance",
      contentEngagement: "High engagement",
      topPerformingElements: ["Element 1"],
    },
    audienceInsights: {
      highPerformingSegments: [],
      engagementPatterns: [],
    },
    recommendations: {
      immediate: ["Recommendation 1"],
      longTerm: ["Long-term 1"],
      contentSuggestions: ["Content 1"],
    },
    generatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockGetTenantContext.mockResolvedValue(mockTenantContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("generateCampaignInsights", () => {
    it("should generate insights successfully", async () => {
      const formData = new FormData();
      formData.append("campaignId", VALID_CAMPAIGN_ID);
      formData.append("priority", "normal");

      mockAiInsightsService.generateCampaignInsights.mockResolvedValue(
        mockInsights
      );

      const result = await generateCampaignInsights(formData);

      expect(result.success).toBe(true);
      expect(result.insights).toEqual(mockInsights);
      expect(
        mockAiInsightsService.generateCampaignInsights
      ).toHaveBeenCalledWith(VALID_CAMPAIGN_ID, VALID_TENANT_ID);
    });

    it("should return error if user not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const formData = new FormData();
      formData.append("campaignId", VALID_CAMPAIGN_ID);

      const result = await generateCampaignInsights(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication required");
    });

    it("should return error if tenant context missing", async () => {
      mockGetTenantContext.mockResolvedValue(null);

      const formData = new FormData();
      formData.append("campaignId", VALID_CAMPAIGN_ID);

      const result = await generateCampaignInsights(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Tenant context required");
    });

    it("should return error if user is viewer", async () => {
      mockGetCurrentUser.mockResolvedValue({
        ...mockUser,
        role: "viewer",
      });

      const formData = new FormData();
      formData.append("campaignId", VALID_CAMPAIGN_ID);

      const result = await generateCampaignInsights(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Insufficient permissions");
    });

    it("should return validation error for invalid campaign ID", async () => {
      const formData = new FormData();
      formData.append("campaignId", "invalid-id");

      const result = await generateCampaignInsights(formData);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation error");
      expect(result.error).toContain("Invalid campaign ID");
    });

    it("should handle service errors", async () => {
      const formData = new FormData();
      formData.append("campaignId", VALID_CAMPAIGN_ID);

      mockAiInsightsService.generateCampaignInsights.mockRejectedValue(
        new Error("Service error")
      );

      const result = await generateCampaignInsights(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Service error");
    });
  });

  describe("queueInsightsGeneration", () => {
    it("should queue insights generation successfully", async () => {
      const formData = new FormData();
      formData.append("campaignId", VALID_CAMPAIGN_ID);
      formData.append("priority", "high");

      mockAiInsightsService.queueInsightsGeneration.mockResolvedValue();

      const result = await queueInsightsGeneration(formData);

      expect(result.success).toBe(true);
      expect(result.message).toContain("queued successfully");
      expect(
        mockAiInsightsService.queueInsightsGeneration
      ).toHaveBeenCalledWith(VALID_CAMPAIGN_ID, VALID_TENANT_ID, "high");
    });

    it("should use normal priority by default", async () => {
      const formData = new FormData();
      formData.append("campaignId", VALID_CAMPAIGN_ID);

      mockAiInsightsService.queueInsightsGeneration.mockResolvedValue();

      const result = await queueInsightsGeneration(formData);

      expect(result.success).toBe(true);
      expect(
        mockAiInsightsService.queueInsightsGeneration
      ).toHaveBeenCalledWith(VALID_CAMPAIGN_ID, VALID_TENANT_ID, "normal");
    });

    it("should return error if user not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const formData = new FormData();
      formData.append("campaignId", VALID_CAMPAIGN_ID);

      const result = await queueInsightsGeneration(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication required");
    });

    it("should return error if user is viewer", async () => {
      mockGetCurrentUser.mockResolvedValue({
        ...mockUser,
        role: "viewer",
      });

      const formData = new FormData();
      formData.append("campaignId", VALID_CAMPAIGN_ID);

      const result = await queueInsightsGeneration(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Insufficient permissions");
    });
  });

  describe("getCampaignInsights", () => {
    it("should get insights successfully", async () => {
      mockAiInsightsService.getCampaignInsights.mockResolvedValue(mockInsights);

      const result = await getCampaignInsights(VALID_CAMPAIGN_ID);

      expect(result.success).toBe(true);
      expect(result.insights).toEqual(mockInsights);
      expect(mockAiInsightsService.getCampaignInsights).toHaveBeenCalledWith(
        VALID_CAMPAIGN_ID,
        VALID_TENANT_ID
      );
    });

    it("should return null insights if none exist", async () => {
      mockAiInsightsService.getCampaignInsights.mockResolvedValue(null);

      const result = await getCampaignInsights(VALID_CAMPAIGN_ID);

      expect(result.success).toBe(true);
      expect(result.insights).toBeNull();
    });

    it("should return error if user not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getCampaignInsights(VALID_CAMPAIGN_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication required");
    });

    it("should return validation error for invalid campaign ID", async () => {
      const result = await getCampaignInsights("invalid-id");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation error");
    });

    it("should handle service errors", async () => {
      mockAiInsightsService.getCampaignInsights.mockRejectedValue(
        new Error("Service error")
      );

      const result = await getCampaignInsights(VALID_CAMPAIGN_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Service error");
    });
  });

  describe("regenerateCampaignInsights", () => {
    it("should regenerate insights successfully", async () => {
      const formData = new FormData();
      formData.append("campaignId", VALID_CAMPAIGN_ID);

      mockAiInsightsService.generateCampaignInsights.mockResolvedValue(
        mockInsights
      );

      const result = await regenerateCampaignInsights(formData);

      expect(result.success).toBe(true);
      expect(result.insights).toEqual(mockInsights);
      expect(
        mockAiInsightsService.generateCampaignInsights
      ).toHaveBeenCalledWith(VALID_CAMPAIGN_ID, VALID_TENANT_ID);
    });

    it("should return error if user not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const formData = new FormData();
      formData.append("campaignId", VALID_CAMPAIGN_ID);

      const result = await regenerateCampaignInsights(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication required");
    });

    it("should return error if user is viewer", async () => {
      mockGetCurrentUser.mockResolvedValue({
        ...mockUser,
        role: "viewer",
      });

      const formData = new FormData();
      formData.append("campaignId", VALID_CAMPAIGN_ID);

      const result = await regenerateCampaignInsights(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Insufficient permissions");
    });

    it("should return validation error for invalid campaign ID", async () => {
      const formData = new FormData();
      formData.append("campaignId", "invalid-id");

      const result = await regenerateCampaignInsights(formData);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation error");
    });

    it("should handle service errors", async () => {
      const formData = new FormData();
      formData.append("campaignId", VALID_CAMPAIGN_ID);

      mockAiInsightsService.generateCampaignInsights.mockRejectedValue(
        new Error("Service error")
      );

      const result = await regenerateCampaignInsights(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Service error");
    });
  });

  describe("permission checks", () => {
    it("should allow admin users to generate insights", async () => {
      mockGetCurrentUser.mockResolvedValue({
        ...mockUser,
        role: "admin",
      });

      const formData = new FormData();
      formData.append("campaignId", VALID_CAMPAIGN_ID);

      mockAiInsightsService.generateCampaignInsights.mockResolvedValue(
        mockInsights
      );

      const result = await generateCampaignInsights(formData);

      expect(result.success).toBe(true);
    });

    it("should allow editor users to generate insights", async () => {
      mockGetCurrentUser.mockResolvedValue({
        ...mockUser,
        role: "editor",
      });

      const formData = new FormData();
      formData.append("campaignId", VALID_CAMPAIGN_ID);

      mockAiInsightsService.generateCampaignInsights.mockResolvedValue(
        mockInsights
      );

      const result = await generateCampaignInsights(formData);

      expect(result.success).toBe(true);
    });

    it("should allow viewer users to get insights", async () => {
      mockGetCurrentUser.mockResolvedValue({
        ...mockUser,
        role: "viewer",
      });

      mockAiInsightsService.getCampaignInsights.mockResolvedValue(mockInsights);

      const result = await getCampaignInsights(VALID_CAMPAIGN_ID);

      expect(result.success).toBe(true);
    });
  });
});
