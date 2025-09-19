import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnalyticsService } from '@/lib/services/analytics';
import { AnalyticsPerformanceService } from '@/lib/services/analytics-performance';
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
  relations: vi.fn(),
}));

// Mock drizzle-zod
vi.mock('drizzle-zod', () => ({
  createInsertSchema: vi.fn(),
  createSelectSchema: vi.fn(),
}));

// Mock drizzle-orm/pg-core
vi.mock('drizzle-orm/pg-core', () => ({
  pgTable: vi.fn(),
  text: vi.fn(),
  timestamp: vi.fn(),
  jsonb: vi.fn(),
  uuid: vi.fn(),
  index: vi.fn(),
}));

describe('Analytics Service Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Email Event Recording', () => {
    it('should record single email event', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const { db } = await import('@/lib/db');
      vi.mocked(db.insert).mockImplementation(mockInsert);

      const analyticsService = new AnalyticsService();
      const event: EmailEvent = {
        tenantId: 'tenant-1',
        campaignId: 'campaign-1',
        recipientEmail: 'user@example.com',
        eventType: 'opened',
        eventData: { messageId: 'msg-123' },
        timestamp: new Date(),
      };

      await analyticsService.recordEmailEvent(event);

      expect(mockInsert).toHaveBeenCalledOnce();
    });

    it('should record batch of email events', async () => {
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

      const { db } = await import('@/lib/db');
      vi.mocked(db.transaction).mockImplementation(mockTransaction);

      const analyticsService = new AnalyticsService();
      const events: EmailEvent[] = [
        {
          tenantId: 'tenant-1',
          campaignId: 'campaign-1',
          recipientEmail: 'user1@example.com',
          eventType: 'opened',
          eventData: {},
          timestamp: new Date(),
        },
        {
          tenantId: 'tenant-1',
          campaignId: 'campaign-1',
          recipientEmail: 'user2@example.com',
          eventType: 'clicked',
          eventData: { linkUrl: 'https://example.com' },
          timestamp: new Date(),
        },
      ];

      await analyticsService.recordEmailEventsBatch(events);

      expect(mockTransaction).toHaveBeenCalledOnce();
    });

    it('should handle errors gracefully', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const { db } = await import('@/lib/db');
      vi.mocked(db.insert).mockImplementation(mockInsert);

      const analyticsService = new AnalyticsService();
      const event: EmailEvent = {
        tenantId: 'tenant-1',
        campaignId: 'campaign-1',
        recipientEmail: 'user@example.com',
        eventType: 'opened',
        eventData: {},
        timestamp: new Date(),
      };

      await expect(analyticsService.recordEmailEvent(event))
        .rejects.toThrow('Database error');
    });
  });

  describe('Dashboard Data Generation', () => {
    it('should generate dashboard data for tenant', async () => {
      const mockDbSelect = vi.fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 10 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 50000 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ avgOpenRate: 25.5, avgClickRate: 3.8 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 'campaign-1',
                    name: 'Test Campaign',
                    sentAt: new Date(),
                    openRate: 30,
                    clickRate: 5,
                  },
                ]),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([
                  { date: '2024-01-01', sent: 1000, opened: 300, clicked: 50 },
                ]),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 'campaign-1',
                    name: 'Top Campaign',
                    openRate: 35,
                    clickRate: 6,
                  },
                ]),
              }),
            }),
          }),
        });

      const { db } = await import('@/lib/db');
      vi.mocked(db.select).mockImplementation(mockDbSelect);

      const analyticsService = new AnalyticsService();
      const dateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await analyticsService.getAnalyticsDashboard('tenant-1', dateRange);

      expect(result).toEqual({
        totalCampaigns: 10,
        totalSent: 50000,
        averageOpenRate: 25.5,
        averageClickRate: 3.8,
        recentCampaigns: [
          {
            id: 'campaign-1',
            name: 'Test Campaign',
            sentAt: expect.any(Date),
            openRate: 30,
            clickRate: 5,
          },
        ],
        performanceChart: [
          { date: '2024-01-01', sent: 1000, opened: 300, clicked: 50 },
        ],
        topPerformingCampaigns: [
          {
            id: 'campaign-1',
            name: 'Top Campaign',
            openRate: 35,
            clickRate: 6,
          },
        ],
      });
    });
  });

  describe('Campaign Report Generation', () => {
    it('should generate comprehensive campaign report', async () => {
      const campaignId = 'campaign-1';
      
      const mockCampaign = {
        id: campaignId,
        name: 'Test Campaign',
        analytics: {
          totalSent: 1000,
        },
      };

      const mockEventCounts = [
        { eventType: 'delivered', count: 950 },
        { eventType: 'opened', count: 300 },
        { eventType: 'clicked', count: 50 },
      ];

      const { db } = await import('@/lib/db');
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
            where: vi.fn().mockResolvedValue([{ count: 280 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 45 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

      vi.mocked(db.select).mockImplementation(mockDbSelect);

      const analyticsService = new AnalyticsService();
      const result = await analyticsService.generateCampaignReport(campaignId);

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
        topLinks: [],
        timeline: [],
      });
    });

    it('should handle missing campaign', async () => {
      const { db } = await import('@/lib/db');
      vi.mocked(db.query.campaigns.findFirst).mockResolvedValue(null);

      const analyticsService = new AnalyticsService();
      
      await expect(analyticsService.generateCampaignReport('non-existent'))
        .rejects.toThrow('Campaign non-existent not found');
    });
  });

  describe('Performance Optimizations', () => {
    it('should handle large datasets efficiently', async () => {
      const startTime = performance.now();

      // Create large batch of events
      const largeEventBatch: EmailEvent[] = Array.from({ length: 5000 }, (_, i) => ({
        tenantId: 'tenant-1',
        campaignId: 'campaign-1',
        recipientEmail: `user${i}@example.com`,
        eventType: 'opened' as const,
        eventData: {},
        timestamp: new Date(),
      }));

      await AnalyticsPerformanceService.batchProcessEmailEvents(largeEventBatch);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should complete within reasonable time
      expect(executionTime).toBeLessThan(5000); // 5 seconds max
    });

    it('should use caching effectively', async () => {
      const tenantId = 'tenant-1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      // Mock database calls
      const mockDbSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 10 }]),
        }),
      });

      const { db } = await import('@/lib/db');
      vi.mocked(db.select).mockImplementation(mockDbSelect);

      // First call should hit database
      await AnalyticsPerformanceService.getOptimizedDashboardData(tenantId, startDate, endDate);
      
      // Second call should use cache
      await AnalyticsPerformanceService.getOptimizedDashboardData(tenantId, startDate, endDate);

      // Database should only be called once due to caching
      expect(mockDbSelect).toHaveBeenCalledTimes(6); // 6 parallel queries in the first call
    });

    it('should clear cache when needed', () => {
      const tenantId = 'tenant-1';
      
      // Set some cached data
      AnalyticsPerformanceService['setCachedData'](`dashboard:${tenantId}:test`, { test: 'data' });
      
      // Verify data is cached
      expect(AnalyticsPerformanceService['getCachedData'](`dashboard:${tenantId}:test`)).toBeTruthy();
      
      // Clear cache
      AnalyticsPerformanceService.clearCache(tenantId);
      
      // Verify cache is cleared
      expect(AnalyticsPerformanceService['getCachedData'](`dashboard:${tenantId}:test`)).toBeNull();
    });
  });

  describe('Nightly Aggregation', () => {
    it('should aggregate metrics for previous day', async () => {
      const mockDbSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([
              { tenantId: 'tenant-1', campaignId: 'campaign-1' },
            ]),
          }),
        }),
      });

      const mockDbInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const { db } = await import('@/lib/db');
      vi.mocked(db.select).mockImplementation(mockDbSelect);
      vi.mocked(db.insert).mockImplementation(mockDbInsert);

      const analyticsService = new AnalyticsService();
      await analyticsService.aggregateNightlyMetrics();

      expect(mockDbSelect).toHaveBeenCalled();
      expect(mockDbInsert).toHaveBeenCalled();
    });
  });
});