/**
 * Integration tests for AI Server Actions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateContentAction } from '@/lib/actions/ai/generate-content';
import { optimizeSubjectLinesAction } from '@/lib/actions/ai/optimize-subject-lines';
import { adjustToneAction } from '@/lib/actions/ai/adjust-tone';
import { generateInsightsAction } from '@/lib/actions/ai/generate-insights';

// Mock the AI service
vi.mock('@/lib/ai', () => ({
  aiService: {
    generateContent: vi.fn(),
    optimizeSubjectLines: vi.fn(),
    adjustToneAndStyle: vi.fn(),
    generateCampaignInsights: vi.fn()
  }
}));

// Mock tenant service
vi.mock('@/lib/tenant/server', () => ({
  getTenantFromHeaders: vi.fn()
}));

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([]))
        }))
      }))
    }))
  }
}));

import { aiService } from '@/lib/ai';
import { getTenantFromHeaders } from '@/lib/tenant/server';
import { db } from '@/lib/db';

describe('AI Server Actions', () => {
  const mockTenant = {
    id: 'tenant-123',
    name: 'Test Company',
    domain: 'test.newsletter.com'
  };

  beforeEach(() => {
    vi.mocked(getTenantFromHeaders).mockResolvedValue(mockTenant);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateContentAction', () => {
    it('should generate content successfully', async () => {
      const mockContent = {
        title: 'AI Trends Newsletter',
        content: 'Artificial intelligence is transforming businesses...',
        tone: 'professional',
        key_points: ['AI adoption is growing', 'Automation benefits'],
        call_to_action: 'Learn more about our AI consulting services'
      };

      vi.mocked(aiService.generateContent).mockResolvedValue(mockContent);

      const formData = new FormData();
      formData.append('prompt', 'Create a newsletter about AI trends in business');
      formData.append('company', 'Tech Consulting Inc');
      formData.append('audience', 'Business executives');
      formData.append('tone', 'professional');
      formData.append('length', 'medium');

      const result = await generateContentAction(formData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockContent);
      expect(aiService.generateContent).toHaveBeenCalledWith(
        'Create a newsletter about AI trends in business',
        {
          company: 'Tech Consulting Inc',
          audience: 'Business executives',
          tone: 'professional',
          length: 'medium'
        },
        'tenant-123'
      );
    });

    it('should handle validation errors', async () => {
      const formData = new FormData();
      formData.append('prompt', 'short'); // Too short

      const result = await generateContentAction(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid input data');
      expect(result.details).toBeDefined();
    });

    it('should handle missing tenant', async () => {
      vi.mocked(getTenantFromHeaders).mockResolvedValue(null);

      const formData = new FormData();
      formData.append('prompt', 'Create a newsletter about AI trends');

      const result = await generateContentAction(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tenant not found');
    });

    it('should handle AI service errors', async () => {
      vi.mocked(aiService.generateContent).mockRejectedValue(
        new Error('Rate limit exceeded')
      );

      const formData = new FormData();
      formData.append('prompt', 'Create a newsletter about AI trends');

      const result = await generateContentAction(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
    });
  });

  describe('optimizeSubjectLinesAction', () => {
    it('should optimize subject lines successfully', async () => {
      const mockVariations = [
        {
          text: 'AI Trends That Will Transform Your Business',
          tone: 'professional' as const,
          predicted_performance: 'high' as const,
          reasoning: 'Strong value proposition with transformation promise'
        },
        {
          text: 'Your Weekly AI Update',
          tone: 'casual' as const,
          predicted_performance: 'medium' as const,
          reasoning: 'Simple and direct but may lack urgency'
        }
      ];

      vi.mocked(aiService.optimizeSubjectLines).mockResolvedValue(mockVariations);

      const formData = new FormData();
      formData.append('content', 'This newsletter discusses the latest AI trends and their impact on business operations. We cover machine learning, automation, and digital transformation strategies.');
      formData.append('company', 'Tech Consulting Inc');
      formData.append('audience', 'Business leaders');
      formData.append('campaign_type', 'Weekly Newsletter');

      const result = await optimizeSubjectLinesAction(formData);

      expect(result.success).toBe(true);
      expect(result.data?.variations).toEqual(mockVariations);
      expect(aiService.optimizeSubjectLines).toHaveBeenCalledWith(
        expect.stringContaining('This newsletter discusses the latest AI trends'),
        {
          company: 'Tech Consulting Inc',
          audience: 'Business leaders',
          campaign_type: 'Weekly Newsletter'
        },
        'tenant-123'
      );
    });

    it('should handle content too short error', async () => {
      const formData = new FormData();
      formData.append('content', 'Short content'); // Too short

      const result = await optimizeSubjectLinesAction(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid input data');
    });
  });

  describe('adjustToneAction', () => {
    it('should adjust tone successfully', async () => {
      const mockAdjustment = {
        adjusted_content: 'Hey there! Check out these amazing AI trends that are totally changing how we do business!',
        changes_made: [
          'Changed formal greeting to casual "Hey there!"',
          'Added enthusiasm with "amazing" and "totally"',
          'Simplified technical language'
        ],
        tone_achieved: 'casual and enthusiastic'
      };

      vi.mocked(aiService.adjustToneAndStyle).mockResolvedValue(mockAdjustment);

      const formData = new FormData();
      formData.append('content', 'Please review these artificial intelligence trends that are significantly impacting business operations and strategic planning initiatives.');
      formData.append('target_tone', 'casual and enthusiastic');
      formData.append('target_style', 'conversational');

      const result = await adjustToneAction(formData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAdjustment);
      expect(aiService.adjustToneAndStyle).toHaveBeenCalledWith(
        expect.stringContaining('Please review these artificial intelligence trends'),
        'casual and enthusiastic',
        'conversational',
        'tenant-123'
      );
    });

    it('should handle missing target tone', async () => {
      const formData = new FormData();
      formData.append('content', 'This is some content that needs tone adjustment.');
      // Missing target_tone

      const result = await adjustToneAction(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid input data');
    });
  });

  describe('generateInsightsAction', () => {
    it('should generate insights for completed campaign', async () => {
      const campaignId = '550e8400-e29b-41d4-a716-446655440000';
      const mockCampaign = {
        id: campaignId,
        tenantId: 'tenant-123',
        subjectLine: 'AI Trends Newsletter',
        content: 'This newsletter covers AI trends...',
        status: 'sent',
        analytics: {
          openRate: 25.5,
          clickRate: 4.2,
          totalSent: 1000
        }
      };

      const mockInsights = 'This campaign performed well with a 25.5% open rate, which is above the industry average of 20%. The subject line effectively created curiosity about AI trends. Consider testing shorter subject lines for mobile optimization.';

      // Mock database query
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([mockCampaign]))
          }))
        }))
      } as any);

      vi.mocked(aiService.generateCampaignInsights).mockResolvedValue(mockInsights);

      const formData = new FormData();
      formData.append('campaign_id', campaignId);

      const result = await generateInsightsAction(formData);

      expect(result.success).toBe(true);
      expect(result.data?.insights).toBe(mockInsights);
      expect(aiService.generateCampaignInsights).toHaveBeenCalledWith(
        {
          subject_line: 'AI Trends Newsletter',
          content: 'This newsletter covers AI trends...',
          open_rate: 25.5,
          click_rate: 4.2,
          total_sent: 1000
        },
        'tenant-123'
      );
    });

    it('should handle campaign not found', async () => {
      // Mock empty database result
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([]))
          }))
        }))
      } as any);

      const formData = new FormData();
      formData.append('campaign_id', '550e8400-e29b-41d4-a716-446655440001');

      const result = await generateInsightsAction(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Campaign not found');
    });

    it('should handle incomplete campaign', async () => {
      const campaignId = '550e8400-e29b-41d4-a716-446655440002';
      const mockCampaign = {
        id: campaignId,
        tenantId: 'tenant-123',
        subjectLine: 'AI Trends Newsletter',
        content: 'This newsletter covers AI trends...',
        status: 'draft', // Not completed
        analytics: null
      };

      // Mock database query
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([mockCampaign]))
          }))
        }))
      } as any);

      const formData = new FormData();
      formData.append('campaign_id', campaignId);

      const result = await generateInsightsAction(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Campaign must be completed to generate insights');
    });

    it('should handle invalid campaign ID format', async () => {
      const formData = new FormData();
      formData.append('campaign_id', 'invalid-uuid');

      const result = await generateInsightsAction(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid input data');
    });
  });

  describe('error handling across all actions', () => {
    it('should handle tenant service failures', async () => {
      vi.mocked(getTenantFromHeaders).mockRejectedValue(new Error('Tenant service error'));

      const formData = new FormData();
      formData.append('prompt', 'Create a newsletter about AI trends');

      const result = await generateContentAction(formData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tenant service error');
    });

    it('should handle unexpected errors gracefully', async () => {
      vi.mocked(aiService.generateContent).mockRejectedValue(new Error('Unexpected error'));

      const formData = new FormData();
      formData.append('prompt', 'Create a newsletter about AI trends');

      const result = await generateContentAction(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
    });
  });
});