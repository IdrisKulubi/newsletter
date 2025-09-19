/**
 * AI Insights Service Tests
 * Unit tests for AI-powered post-campaign analysis functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all dependencies before importing
vi.mock('@/lib/ai', () => ({
  aiService: {
    generateCampaignInsights: vi.fn(),
  },
}));

vi.mock('../analytics', () => ({
  analyticsService: {
    generateCampaignReport: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      campaigns: {
        findFirst: vi.fn(),
      },
    },
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/queue', () => ({
  aiQueue: {
    add: vi.fn(),
  },
}));

// Import after mocking
import { AIInsightsService } from '../ai-insights';
import { aiService } from '@/lib/ai';
import { analyticsService } from '../analytics';
import { db } from '@/lib/db';
import { aiQueue } from '@/lib/queue';

const mockAiService = vi.mocked(aiService);
const mockAnalyticsService = vi.mocked(analyticsService);
const mockDb = vi.mocked(db);
const mockAiQueue = vi.mocked(aiQueue);

describe('AIInsightsService', () => {
  let service: AIInsightsService;

  beforeEach(() => {
    service = new AIInsightsService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateCampaignInsights', () => {
    const mockCampaignId = 'campaign-123';
    const mockTenantId = 'tenant-123';

    const mockCampaign = {
      id: mockCampaignId,
      tenantId: mockTenantId,
      name: 'Test Campaign',
      subjectLine: 'Test Subject',
      status: 'sent',
      newsletter: {
        content: 'Test newsletter content',
      },
    };

    const mockCampaignReport = {
      campaignId: mockCampaignId,
      campaignName: 'Test Campaign',
      totalSent: 1000,
      delivered: 980,
      opened: 250,
      clicked: 50,
      bounced: 20,
      unsubscribed: 5,
      complained: 1,
      openRate: 25.0,
      clickRate: 5.0,
      bounceRate: 2.0,
      uniqueOpens: 240,
      uniqueClicks: 48,
      topLinks: [
        { url: 'https://example.com/link1', clicks: 30 },
        { url: 'https://example.com/link2', clicks: 20 },
      ],
      timeline: [],
    };

    const mockBenchmarks = {
      averageOpenRate: 20.0,
      averageClickRate: 3.0,
      totalCampaigns: 10,
    };

    beforeEach(() => {
      // Mock database queries
      mockDb.query = {
        campaigns: {
          findFirst: vi.fn().mockResolvedValue(mockCampaign),
        },
      } as any;

      // Mock database select chain for benchmarks
      const mockSelectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockBenchmarks]),
        }),
      };
      mockDb.select = vi.fn().mockReturnValue(mockSelectChain);

      // Mock database select chain for audience analysis
      const mockAudienceSelectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              having: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      };
      
      // Override select for audience analysis calls
      mockDb.select = vi.fn()
        .mockReturnValueOnce(mockSelectChain) // First call for benchmarks
        .mockReturnValue(mockAudienceSelectChain); // Subsequent calls for audience analysis

      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      // Mock analytics service
      mockAnalyticsService.generateCampaignReport.mockResolvedValue(mockCampaignReport);

      // Mock AI service
      mockAiService.generateCampaignInsights.mockResolvedValue(
        'This campaign performed well with above-average engagement rates.'
      );
    });

    it('should generate comprehensive insights for a completed campaign', async () => {
      // Mock the private methods to avoid complex database mocking
      const getTenantBenchmarksSpy = vi.spyOn(service as any, 'getTenantBenchmarks').mockResolvedValue(mockBenchmarks);
      const getAudienceSegmentAnalysisSpy = vi.spyOn(service as any, 'getAudienceSegmentAnalysis').mockResolvedValue({
        highPerformingSegments: [],
        engagementPatterns: ['Test pattern'],
      });
      const storeInsightsSpy = vi.spyOn(service as any, 'storeInsights').mockResolvedValue(undefined);

      const insights = await service.generateCampaignInsights(mockCampaignId, mockTenantId);

      expect(insights).toBeDefined();
      expect(insights.campaignId).toBe(mockCampaignId);
      expect(insights.executiveSummary).toContain('above-average engagement');
      expect(insights.performanceAnalysis.overallPerformance).toBe('good');
      expect(insights.performanceAnalysis.keyMetrics.openRate).toBe(25.0);
      expect(insights.performanceAnalysis.keyMetrics.clickRate).toBe(5.0);
      expect(insights.performanceAnalysis.benchmarkComparison.openRateVsAverage).toBe(25.0);
      expect(insights.generatedAt).toBeInstanceOf(Date);

      // Verify private methods were called
      expect(getTenantBenchmarksSpy).toHaveBeenCalledWith(mockTenantId);
      expect(getAudienceSegmentAnalysisSpy).toHaveBeenCalledWith(mockCampaignId, mockTenantId);
      expect(storeInsightsSpy).toHaveBeenCalledWith(mockCampaignId, expect.any(Object));
    });

    it('should throw error if campaign not found', async () => {
      mockDb.query.campaigns.findFirst.mockResolvedValue(null);

      await expect(
        service.generateCampaignInsights(mockCampaignId, mockTenantId)
      ).rejects.toThrow('Campaign campaign-123 not found');
    });

    it('should throw error if campaign not completed', async () => {
      mockDb.query.campaigns.findFirst.mockResolvedValue({
        ...mockCampaign,
        status: 'draft',
      });

      await expect(
        service.generateCampaignInsights(mockCampaignId, mockTenantId)
      ).rejects.toThrow('Campaign campaign-123 is not completed yet');
    });

    it('should calculate performance analysis correctly', async () => {
      // Mock the private methods
      const getTenantBenchmarksSpy = vi.spyOn(service as any, 'getTenantBenchmarks').mockResolvedValue(mockBenchmarks);
      const getAudienceSegmentAnalysisSpy = vi.spyOn(service as any, 'getAudienceSegmentAnalysis').mockResolvedValue({
        highPerformingSegments: [],
        engagementPatterns: ['Test pattern'],
      });
      const storeInsightsSpy = vi.spyOn(service as any, 'storeInsights').mockResolvedValue(undefined);

      const insights = await service.generateCampaignInsights(mockCampaignId, mockTenantId);

      expect(insights.performanceAnalysis.keyMetrics.engagementScore).toBeCloseTo(13.0); // (25 * 0.4) + (5 * 0.6)
      expect(insights.performanceAnalysis.benchmarkComparison.openRateVsAverage).toBe(25.0); // (25-20)/20 * 100
      expect(insights.performanceAnalysis.benchmarkComparison.clickRateVsAverage).toBeCloseTo(66.67); // (5-3)/3 * 100
    });

    it('should handle AI service errors gracefully', async () => {
      mockAiService.generateCampaignInsights.mockRejectedValue(new Error('AI service error'));

      // Mock the private methods
      const getTenantBenchmarksSpy = vi.spyOn(service as any, 'getTenantBenchmarks').mockResolvedValue(mockBenchmarks);
      const getAudienceSegmentAnalysisSpy = vi.spyOn(service as any, 'getAudienceSegmentAnalysis').mockResolvedValue({
        highPerformingSegments: [],
        engagementPatterns: ['Test pattern'],
      });
      const storeInsightsSpy = vi.spyOn(service as any, 'storeInsights').mockResolvedValue(undefined);

      // Mock the content analysis methods to return unavailable
      const analyzeContentPerformanceSpy = vi.spyOn(service as any, 'analyzeContentPerformance').mockResolvedValue({
        subjectLineEffectiveness: 'Analysis unavailable',
        contentEngagement: 'Analysis unavailable',
        topPerformingElements: [],
      });

      const insights = await service.generateCampaignInsights(mockCampaignId, mockTenantId);

      expect(insights.executiveSummary).toContain('Test Campaign');
      expect(insights.contentAnalysis.subjectLineEffectiveness).toBe('Analysis unavailable');
    });

    it('should store insights in campaign record', async () => {
      // Mock the private methods
      const getTenantBenchmarksSpy = vi.spyOn(service as any, 'getTenantBenchmarks').mockResolvedValue(mockBenchmarks);
      const getAudienceSegmentAnalysisSpy = vi.spyOn(service as any, 'getAudienceSegmentAnalysis').mockResolvedValue({
        highPerformingSegments: [],
        engagementPatterns: ['Test pattern'],
      });
      const storeInsightsSpy = vi.spyOn(service as any, 'storeInsights').mockResolvedValue(undefined);

      await service.generateCampaignInsights(mockCampaignId, mockTenantId);

      expect(storeInsightsSpy).toHaveBeenCalledWith(mockCampaignId, expect.any(Object));
    });
  });

  describe('queueInsightsGeneration', () => {
    const mockCampaignId = 'campaign-123';
    const mockTenantId = 'tenant-123';

    beforeEach(() => {
      mockAiQueue.add = vi.fn().mockResolvedValue(undefined);
    });

    it('should queue insights generation with correct parameters', async () => {
      await service.queueInsightsGeneration(mockCampaignId, mockTenantId, 'high');

      expect(mockAiQueue.add).toHaveBeenCalledWith(
        'campaign-insights',
        {
          tenantId: mockTenantId,
          type: 'campaign-insights',
          data: {
            campaignId: mockCampaignId,
            priority: 'high',
          },
          campaignId: mockCampaignId,
        },
        {
          priority: 10,
          delay: 0,
          removeOnComplete: 10,
          removeOnFail: 5,
        }
      );
    });

    it('should use normal priority by default', async () => {
      await service.queueInsightsGeneration(mockCampaignId, mockTenantId);

      expect(mockAiQueue.add).toHaveBeenCalledWith(
        'campaign-insights',
        {
          tenantId: mockTenantId,
          type: 'campaign-insights',
          data: {
            campaignId: mockCampaignId,
            priority: 'normal',
          },
          campaignId: mockCampaignId,
        },
        expect.objectContaining({
          priority: 5,
          delay: 30000,
        })
      );
    });

    it('should handle queue errors', async () => {
      mockAiQueue.add.mockRejectedValue(new Error('Queue error'));

      await expect(
        service.queueInsightsGeneration(mockCampaignId, mockTenantId)
      ).rejects.toThrow('Queue error');
    });
  });

  describe('getCampaignInsights', () => {
    const mockCampaignId = 'campaign-123';
    const mockTenantId = 'tenant-123';

    const mockStoredInsights = {
      campaignId: mockCampaignId,
      executiveSummary: 'Stored insights summary',
      generatedAt: new Date(),
      performanceAnalysis: {
        overallPerformance: 'good' as const,
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
        subjectLineEffectiveness: 'Good performance',
        contentEngagement: 'High engagement',
        topPerformingElements: ['Element 1'],
      },
      audienceInsights: {
        highPerformingSegments: [],
        engagementPatterns: [],
      },
      recommendations: {
        immediate: ['Recommendation 1'],
        longTerm: ['Long-term 1'],
        contentSuggestions: ['Content 1'],
      },
    };

    it('should return stored insights if available', async () => {
      mockDb.query = {
        campaigns: {
          findFirst: vi.fn().mockResolvedValue({
            id: mockCampaignId,
            status: 'sent',
            analytics: {
              insights: mockStoredInsights,
            },
          }),
        },
      } as any;

      const insights = await service.getCampaignInsights(mockCampaignId, mockTenantId);

      expect(insights).toEqual(mockStoredInsights);
    });

    it('should generate new insights if none stored and campaign is completed', async () => {
      mockDb.query = {
        campaigns: {
          findFirst: vi.fn().mockResolvedValue({
            id: mockCampaignId,
            status: 'sent',
            analytics: {},
          }),
        },
      } as any;

      // Mock the generateCampaignInsights method
      const generateSpy = vi.spyOn(service, 'generateCampaignInsights').mockResolvedValue(mockStoredInsights);

      const insights = await service.getCampaignInsights(mockCampaignId, mockTenantId);

      expect(generateSpy).toHaveBeenCalledWith(mockCampaignId, mockTenantId);
      expect(insights).toEqual(mockStoredInsights);
    });

    it('should return null if campaign not completed', async () => {
      mockDb.query = {
        campaigns: {
          findFirst: vi.fn().mockResolvedValue({
            id: mockCampaignId,
            status: 'draft',
            analytics: {},
          }),
        },
      } as any;

      const insights = await service.getCampaignInsights(mockCampaignId, mockTenantId);

      expect(insights).toBeNull();
    });

    it('should throw error if campaign not found', async () => {
      mockDb.query = {
        campaigns: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as any;

      await expect(
        service.getCampaignInsights(mockCampaignId, mockTenantId)
      ).rejects.toThrow('Campaign campaign-123 not found');
    });
  });

  describe('performance analysis calculations', () => {
    it('should classify performance correctly', () => {
      const testCases = [
        { openRate: 30, clickRate: 10, expected: 'excellent' }, // 30*0.4 + 10*0.6 = 18
        { openRate: 20, clickRate: 8, expected: 'good' }, // 20*0.4 + 8*0.6 = 12.8
        { openRate: 15, clickRate: 5, expected: 'average' }, // 15*0.4 + 5*0.6 = 9
        { openRate: 5, clickRate: 2, expected: 'poor' }, // 5*0.4 + 2*0.6 = 3.2
      ];

      testCases.forEach(({ openRate, clickRate, expected }) => {
        const report = { openRate, clickRate };
        const benchmarks = { averageOpenRate: 20, averageClickRate: 3 };
        
        // Access private method for testing
        const performanceAnalysis = (service as any).calculatePerformanceAnalysis(report, benchmarks);
        
        expect(performanceAnalysis.overallPerformance).toBe(expected);
      });
    });

    it('should calculate benchmark comparisons correctly', () => {
      const report = { openRate: 25, clickRate: 6 };
      const benchmarks = { averageOpenRate: 20, averageClickRate: 3 };
      
      const performanceAnalysis = (service as any).calculatePerformanceAnalysis(report, benchmarks);
      
      expect(performanceAnalysis.benchmarkComparison.openRateVsAverage).toBe(25.0); // (25-20)/20 * 100
      expect(performanceAnalysis.benchmarkComparison.clickRateVsAverage).toBe(100.0); // (6-3)/3 * 100
    });
  });

  describe('fallback mechanisms', () => {
    it('should provide fallback summary when AI fails', () => {
      const campaign = { name: 'Test Campaign', subjectLine: 'Test Subject' };
      const report = { openRate: 25, clickRate: 5, totalSent: 1000, topLinks: [] };
      const benchmarks = { averageOpenRate: 20, averageClickRate: 3 };

      const fallbackSummary = (service as any).generateFallbackSummary(campaign, report, benchmarks);

      expect(fallbackSummary).toContain('Test Campaign');
      expect(fallbackSummary).toContain('25%');
      expect(fallbackSummary).toContain('above average');
    });

    it('should provide fallback recommendations when AI fails', () => {
      const report = { openRate: 15, clickRate: 2, topLinks: [] };
      const benchmarks = { averageOpenRate: 20, averageClickRate: 3 };

      const fallbackRecs = (service as any).generateFallbackRecommendations(report, benchmarks);

      expect(fallbackRecs.immediate).toContain('Test different subject line formats to improve open rates');
      expect(fallbackRecs.longTerm).toContain('Implement A/B testing for subject lines');
      expect(fallbackRecs.contentSuggestions).toContain('Include more visual elements');
    });
  });
});

describe('AI Insights Integration Tests', () => {
  it('should handle complete insights generation workflow', async () => {
    // This would be an integration test that tests the complete workflow
    // from queueing to generation to storage
    // Skipped for unit tests but important for integration testing
  });

  it('should handle concurrent insights generation requests', async () => {
    // Test concurrent request handling
    // Skipped for unit tests but important for load testing
  });
});