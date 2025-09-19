/**
 * Unit tests for AI service integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIService } from '@/lib/ai';

// Mock the AI SDK
vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => 'mocked-model')
}));

vi.mock('ai', () => ({
  generateText: vi.fn(),
  generateObject: vi.fn()
}));

import { generateText, generateObject } from 'ai';

describe('AIService', () => {
  let aiService: AIService;

  beforeEach(() => {
    aiService = new AIService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateContent', () => {
    it('should generate newsletter content successfully', async () => {
      const mockResponse = {
        object: {
          title: 'Test Newsletter',
          content: 'This is test content for the newsletter.',
          tone: 'professional',
          key_points: ['Point 1', 'Point 2'],
          call_to_action: 'Contact us today'
        }
      };

      vi.mocked(generateObject).mockResolvedValue(mockResponse);

      const result = await aiService.generateContent(
        'Create a newsletter about AI trends',
        {
          company: 'Tech Consulting',
          audience: 'Business leaders',
          tone: 'professional',
          length: 'medium'
        },
        'tenant-123'
      );

      expect(result).toEqual(mockResponse.object);
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Generate newsletter content based on this prompt: Create a newsletter about AI trends',
          temperature: 0.7
        })
      );
    });

    it('should handle AI service errors gracefully', async () => {
      vi.mocked(generateObject).mockRejectedValue(new Error('API Error'));

      await expect(
        aiService.generateContent('Test prompt', {}, 'tenant-123')
      ).rejects.toThrow('Failed to generate content. Please try again.');
    });

    it('should enforce rate limiting', async () => {
      const mockResponse = {
        object: {
          title: 'Test',
          content: 'Test content',
          tone: 'professional',
          key_points: ['Point 1'],
        }
      };

      vi.mocked(generateObject).mockResolvedValue(mockResponse);

      // Make requests up to the limit
      for (let i = 0; i < 10; i++) {
        await aiService.generateContent('Test prompt', {}, 'tenant-rate-limit');
      }

      // The 11th request should be rate limited
      await expect(
        aiService.generateContent('Test prompt', {}, 'tenant-rate-limit')
      ).rejects.toThrow('Rate limit exceeded. Please try again later.');
    });
  });

  describe('optimizeSubjectLines', () => {
    it('should generate subject line variations successfully', async () => {
      const mockResponse = {
        object: {
          variations: [
            {
              text: 'Amazing AI Trends You Need to Know',
              tone: 'professional' as const,
              predicted_performance: 'high' as const,
              reasoning: 'Clear value proposition with urgency'
            },
            {
              text: 'Weekly AI Update',
              tone: 'casual' as const,
              predicted_performance: 'medium' as const,
              reasoning: 'Simple but may lack engagement'
            }
          ]
        }
      };

      vi.mocked(generateObject).mockResolvedValue(mockResponse);

      const result = await aiService.optimizeSubjectLines(
        'This newsletter covers the latest AI trends and their impact on business.',
        {
          company: 'Tech Consulting',
          audience: 'Business leaders',
          campaign_type: 'Newsletter'
        },
        'tenant-123'
      );

      expect(result).toEqual(mockResponse.object.variations);
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.8
        })
      );
    });

    it('should handle subject line optimization errors', async () => {
      vi.mocked(generateObject).mockRejectedValue(new Error('API Error'));

      await expect(
        aiService.optimizeSubjectLines('Test content', {}, 'tenant-123')
      ).rejects.toThrow('Failed to optimize subject lines. Please try again.');
    });
  });

  describe('adjustToneAndStyle', () => {
    it('should adjust content tone successfully', async () => {
      const mockResponse = {
        object: {
          adjusted_content: 'Hey there! Check out these awesome AI trends that are totally changing the game.',
          changes_made: ['Changed formal language to casual', 'Added enthusiasm markers'],
          tone_achieved: 'casual and enthusiastic'
        }
      };

      vi.mocked(generateObject).mockResolvedValue(mockResponse);

      const result = await aiService.adjustToneAndStyle(
        'Please review these artificial intelligence trends that are transforming business operations.',
        'casual and enthusiastic',
        'conversational',
        'tenant-123'
      );

      expect(result).toEqual(mockResponse.object);
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.6
        })
      );
    });

    it('should handle tone adjustment errors', async () => {
      vi.mocked(generateObject).mockRejectedValue(new Error('API Error'));

      await expect(
        aiService.adjustToneAndStyle('Test content', 'casual', undefined, 'tenant-123')
      ).rejects.toThrow('Failed to adjust tone and style. Please try again.');
    });
  });

  describe('generateCampaignInsights', () => {
    it('should generate campaign insights successfully', async () => {
      const mockResponse = {
        text: 'This campaign performed well with a 25% open rate, which is above industry average. The subject line was effective in creating curiosity. Consider testing shorter subject lines for even better performance.'
      };

      vi.mocked(generateText).mockResolvedValue(mockResponse);

      const campaignData = {
        subject_line: 'Amazing AI Trends You Need to Know',
        content: 'This newsletter covers AI trends...',
        open_rate: 25,
        click_rate: 5,
        total_sent: 1000,
        top_links: [
          { url: 'https://example.com/ai-trends', clicks: 50 }
        ]
      };

      const result = await aiService.generateCampaignInsights(campaignData, 'tenant-123');

      expect(result).toBe(mockResponse.text);
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.5
        })
      );
    });

    it('should handle campaign insights generation errors', async () => {
      vi.mocked(generateText).mockRejectedValue(new Error('API Error'));

      const campaignData = {
        subject_line: 'Test Subject',
        content: 'Test content',
        open_rate: 20,
        click_rate: 3,
        total_sent: 500
      };

      await expect(
        aiService.generateCampaignInsights(campaignData, 'tenant-123')
      ).rejects.toThrow('Failed to generate campaign insights. Please try again.');
    });
  });

  describe('healthCheck', () => {
    it('should return true when AI service is healthy', async () => {
      vi.mocked(generateText).mockResolvedValue({ text: 'OK' });

      const result = await aiService.healthCheck();

      expect(result).toBe(true);
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Respond with "OK" if you can process this request.'
        })
      );
    });

    it('should return false when AI service is unhealthy', async () => {
      vi.mocked(generateText).mockRejectedValue(new Error('Service unavailable'));

      const result = await aiService.healthCheck();

      expect(result).toBe(false);
    });

    it('should return true for case-insensitive OK response', async () => {
      vi.mocked(generateText).mockResolvedValue({ text: 'ok, ready to help' });

      const result = await aiService.healthCheck();

      expect(result).toBe(true);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return full limit for new tenant', () => {
      const status = aiService.getRateLimitStatus('new-tenant');

      expect(status.remaining).toBe(10);
      expect(status.resetTime).toBeGreaterThan(Date.now());
    });

    it('should track rate limit usage', async () => {
      const mockResponse = {
        object: {
          title: 'Test',
          content: 'Test content',
          tone: 'professional',
          key_points: ['Point 1'],
        }
      };

      vi.mocked(generateObject).mockResolvedValue(mockResponse);

      // Use a unique tenant ID for this test
      const testTenantId = 'tenant-limit-test-unique';
      
      // Make a few requests
      await aiService.generateContent('Test 1', {}, testTenantId);
      await aiService.generateContent('Test 2', {}, testTenantId);

      // Check the rate limit status - it should show the content requests made
      const status = aiService.getRateLimitStatus(`content-${testTenantId}`);

      expect(status.remaining).toBeLessThan(10); // Should be less than 10 after requests
    });
  });

  describe('error handling and fallbacks', () => {
    it('should handle network timeouts gracefully', async () => {
      vi.mocked(generateObject).mockRejectedValue(new Error('Request timeout'));

      await expect(
        aiService.generateContent('Test prompt', {}, 'tenant-123')
      ).rejects.toThrow('Failed to generate content. Please try again.');
    });

    it('should handle invalid API responses', async () => {
      // Mock an invalid response that would cause schema validation to fail
      vi.mocked(generateObject).mockResolvedValue({ 
        object: { 
          invalid: 'response' // This doesn't match ContentGenerationSchema
        } 
      });

      await expect(
        aiService.generateContent('Test prompt', {}, 'tenant-123')
      ).rejects.toThrow();
    });

    it('should handle rate limit errors from OpenAI', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.name = 'RateLimitError';
      vi.mocked(generateObject).mockRejectedValue(rateLimitError);

      await expect(
        aiService.generateContent('Test prompt', {}, 'tenant-123')
      ).rejects.toThrow('Failed to generate content. Please try again.');
    });
  });
});