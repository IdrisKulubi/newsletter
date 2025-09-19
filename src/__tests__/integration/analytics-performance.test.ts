import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnalyticsPerformanceService } from '@/lib/services/analytics-performance';
import { db } from '@/lib/db';
import { emailEvents, campaigns, dailyAnalytics } from '@/lib/db/schema';
import { EmailEvent } from '@/lib/email';

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
    query: {
      campaigns: {
        findFirst: vi.fn(),
      },
    },
  },
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  sql: vi.fn(),
  desc: vi.fn(),
  asc: vi.fn(),
}));

describe('Analytics Performance Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear cache before each test
    AnalyticsPerformanceService.clearCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Caching', () => {
    it('should cache dashboard data', async () => {
      const mockDbSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 10 }]),
        }),
      });
      
      vi.mocked(db.select).mockImplementation(mockDbSelect);

      const tenantId = 'tenant-1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      // First call should hit database
      await AnalyticsPerformanceService.getOptimizedDashboardData(tenantId, startDate, endDate);
      
      // Second call should use cache
      await AnalyticsPerformanceService.getOptimizedDashboardData(tenantId, startDate, endDate);

      // Database should only be called once due to caching
      expect(mockDbSelect).toHaveBeenCalledTimes(6); // 6 parallel queries in the first call
    });

    it('should clear cache for specific tenant', async () => {
      const tenantId = 'tenant-1';
      
      // Set some cached data
      AnalyticsPerformanceService['setCachedData'](`dashboard:${tenantId}:test`, { test: 'data' });
      AnalyticsPerformanceService['setCachedData']('dashboard:other-tenant:test', { test: 'data' });
      
      // Clear cache for specific tenant
      AnalyticsPerformanceService.clearCache(tenantId);
      
      // Tenant-specific cache should be cleared
      expect(AnalyticsPerformanceService['getCachedData'](`dashboard:${tenantId}:test`)).toBeNull();
      
      // Other tenant cache should remain
      expect(AnalyticsPerformanceService['getCachedData']('dashboard:other-tenant:test')).toBeTruthy();
    });

    it('should expire cache after TTL', async () => {
      const cacheKey = 'test-key';
      const testData = { test: 'data' };
      
      // Set cached data
      AnalyticsPerformanceService['setCachedData'](cacheKey, testData);
      
      // Should return cached data immediately
      expect(AnalyticsPerformanceService['getCachedData'](cacheKey)).toEqual(testData);
      
      // Mock time passage beyond TTL (5 minutes)
      const originalNow = Date.now;
      Date.now = vi.fn(() => originalNow() + 6 * 60 * 1000);
      
      // Should return null after TTL
      expect(AnalyticsPerformanceService['getCachedData'](cacheKey)).toBeNull();
      
      // Restore Date.now
      Date.now = originalNow;
    });
  });

  describe('Batch Processing', () => {
    it('should process email events in batches', async () => {
      const mockTransaction = vi.fn().mockImplementation((callback) => callback({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        query: {
          campaigns: {
            findFirst: vi.fn().mockResolvedValue({
              analytics: {
                totalSent: 1000,
                delivered: 950,
                opened: 300,
                clicked: 50,
                bounced: 20,
                unsubscribed: 5,
                complained: 1,
                openRate: 30,
                clickRate: 5,
                bounceRate: 2,
                lastUpdated: new Date(),
              },
            }),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      }));

      vi.mocked(db.transaction).mockImplementation(mockTransaction);

      // Create 2500 events (more than batch size of 1000)
      const events: EmailEvent[] = Array.from({ length: 2500 }, (_, i) => ({
        tenantId: 'tenant-1',
        campaignId: 'campaign-1',
        recipientEmail: `user${i}@example.com`,
        eventType: 'opened' as const,
        eventData: {},
        timestamp: new Date(),
      }));

      await AnalyticsPerformanceService.batchProcessEmailEvents(events);

      // Should call transaction 3 times (3 batches of 1000, 1000, 500)
      expect(mockTransaction).toHaveBeenCalledTimes(3);
    });

    it('should handle empty events array', async () => {
      const mockTransaction = vi.fn();
      vi.mocked(db.transaction).mockImplementation(mockTransaction);

      await AnalyticsPerformanceService.batchProcessEmailEvents([]);

      // Should not call transaction for empty array
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should handle batch processing errors gracefully', async () => {
      const mockTransaction = vi.fn().mockRejectedValue(new Error('Database error'));
      vi.mocked(db.transaction).mockImplementation(mockTransaction);

      const events: EmailEvent[] = [{
        tenantId: 'tenant-1',
        campaignId: 'campaign-1',
        recipientEmail: 'user@example.com',
        eventType: 'opened',
        eventData: {},
        timestamp: new Date(),
      }];

      await expect(AnalyticsPerformanceService.batchProcessEmailEvents(events))
        .rejects.toThrow('Database error');
    });
  });

  describe('Performance Optimizations', () => {
    it('should use daily aggregates when available', async () => {
      const mockDailyAggregates = [
        { date: '2024-01-01', sent: 1000, opened: 300, clicked: 50 },
        { date: '2024-01-02', sent: 1200, opened: 360, clicked: 60 },
      ];

      const mockDbSelect = vi.fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockDailyAggregates),
              }),
            }),
          }),
        });

      vi.mocked(db.select).mockImplementation(mockDbSelect);

      const tenantId = 'tenant-1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');

      const result = await AnalyticsPerformanceService['getPerformanceChartData'](
        tenantId,
        startDate,
        endDate
      );

      expect(result).toEqual([
        { date: '2024-01-01', sent: 1000, opened: 300, clicked: 50 },
        { date: '2024-01-02', sent: 1200, opened: 360, clicked: 60 },
      ]);
    });

    it('should fallback to real-time data when aggregates are insufficient', async () => {
      // Mock insufficient daily aggregates (less than 80% coverage)
      const mockDailyAggregates: any[] = [];
      
      const mockRealTimeData = [
        { date: '2024-01-01', sent: 1000, opened: 300, clicked: 50 },
        { date: '2024-01-02', sent: 1200, opened: 360, clicked: 60 },
      ];

      const mockDbSelect = vi.fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockDailyAggregates),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockRealTimeData),
              }),
            }),
          }),
        });

      vi.mocked(db.select).mockImplementation(mockDbSelect);

      const tenantId = 'tenant-1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-30'); // 30 days

      const result = await AnalyticsPerformanceService['getPerformanceChartData'](
        tenantId,
        startDate,
        endDate
      );

      expect(result).toEqual(mockRealTimeData);
      expect(mockDbSelect).toHaveBeenCalledTimes(2); // Once for aggregates, once for real-time
    });

    it('should handle large dataset queries efficiently', async () => {
      const startTime = performance.now();

      // Mock large dataset response
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        count: i,
        total: i * 100,
        avgOpenRate: Math.random() * 50,
        avgClickRate: Math.random() * 10,
      }));

      const mockDbSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(largeDataset),
        }),
      });

      vi.mocked(db.select).mockImplementation(mockDbSelect);

      await AnalyticsPerformanceService.getOptimizedDashboardData(
        'tenant-1',
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should complete within reasonable time (less than 1 second)
      expect(executionTime).toBeLessThan(1000);
    });
  });

  describe('Campaign Report Optimization', () => {
    it('should generate optimized campaign report', async () => {
      const campaignId = 'campaign-1';
      
      const mockCampaign = {
        id: campaignId,
        name: 'Test Campaign',
        analytics: {
          totalSent: 1000,
          delivered: 950,
          opened: 300,
          clicked: 50,
          bounced: 20,
          unsubscribed: 5,
          complained: 1,
          openRate: 30,
          clickRate: 5,
          bounceRate: 2,
          lastUpdated: new Date(),
        },
      };

      const mockEventCounts = [
        { eventType: 'delivered', count: 950 },
        { eventType: 'opened', count: 300 },
        { eventType: 'clicked', count: 50 },
      ];

      const mockUniqueOpens = [{ count: 280 }];
      const mockUniqueClicks = [{ count: 45 }];
      const mockTopLinks = [
        { url: 'https://example.com/link1', clicks: 25 },
        { url: 'https://example.com/link2', clicks: 15 },
      ];
      const mockTimeline = [
        { date: '2024-01-01', opens: 150, clicks: 25 },
        { date: '2024-01-02', opens: 150, clicks: 25 },
      ];

      vi.mocked(db.query.campaigns.findFirst).mockResolvedValue(mockCampaign);

      const mockDbSelect = vi.fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue(mockEventCounts),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockUniqueOpens),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockUniqueClicks),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue(mockTopLinks),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockTimeline),
              }),
            }),
          }),
        });

      vi.mocked(db.select).mockImplementation(mockDbSelect);

      const result = await AnalyticsPerformanceService.getOptimizedCampaignReport(campaignId);

      expect(result).toEqual({
        campaignId,
        campaignName: 'Test Campaign',
        totalSent: 1000,
        delivered: 950,
        opened: 300,
        clicked: 50,
        bounced: 0,
        unsubscribed: 0,
        complained: 0,
        openRate: 30,
        clickRate: 5,
        bounceRate: 0,
        uniqueOpens: 280,
        uniqueClicks: 45,
        topLinks: [
          { url: 'https://example.com/link1', clicks: 25 },
          { url: 'https://example.com/link2', clicks: 15 },
        ],
        timeline: [
          { date: '2024-01-01', opens: 150, clicks: 25 },
          { date: '2024-01-02', opens: 150, clicks: 25 },
        ],
      });
    });

    it('should cache campaign report results', async () => {
      const campaignId = 'campaign-1';
      
      const mockCampaign = {
        id: campaignId,
        name: 'Test Campaign',
        analytics: { totalSent: 1000 },
      };

      vi.mocked(db.query.campaigns.findFirst).mockResolvedValue(mockCampaign);

      const mockDbSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      vi.mocked(db.select).mockImplementation(mockDbSelect);

      // First call
      await AnalyticsPerformanceService.getOptimizedCampaignReport(campaignId);
      
      // Second call should use cache
      await AnalyticsPerformanceService.getOptimizedCampaignReport(campaignId);

      // Database should only be queried once due to caching
      expect(vi.mocked(db.query.campaigns.findFirst)).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      vi.mocked(db.select).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(
        AnalyticsPerformanceService.getOptimizedDashboardData(
          'tenant-1',
          new Date(),
          new Date()
        )
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle missing campaign gracefully', async () => {
      vi.mocked(db.query.campaigns.findFirst).mockResolvedValue(null);

      await expect(
        AnalyticsPerformanceService.getOptimizedCampaignReport('non-existent-campaign')
      ).rejects.toThrow('Campaign non-existent-campaign not found');
    });

    it('should handle partial data gracefully', async () => {
      const mockCampaign = {
        id: 'campaign-1',
        name: 'Test Campaign',
        analytics: null, // No analytics data
      };

      vi.mocked(db.query.campaigns.findFirst).mockResolvedValue(mockCampaign);

      const mockDbSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      vi.mocked(db.select).mockImplementation(mockDbSelect);

      const result = await AnalyticsPerformanceService.getOptimizedCampaignReport('campaign-1');

      expect(result.totalSent).toBe(0);
      expect(result.openRate).toBe(0);
      expect(result.clickRate).toBe(0);
    });
  });
});