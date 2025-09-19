/**
 * AI Service Integration
 * Provides OpenAI-powered features for newsletter content generation and optimization
 */

import { openai } from '@ai-sdk/openai';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import { config } from '@/lib/config';

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// Schemas for structured AI responses
const SubjectLineVariationsSchema = z.object({
  variations: z.array(z.object({
    text: z.string(),
    tone: z.enum(['professional', 'casual', 'urgent', 'friendly', 'formal']),
    predicted_performance: z.enum(['high', 'medium', 'low']),
    reasoning: z.string()
  }))
});

const ContentGenerationSchema = z.object({
  title: z.string(),
  content: z.string(),
  tone: z.string(),
  key_points: z.array(z.string()),
  call_to_action: z.string().optional()
});

const ToneAdjustmentSchema = z.object({
  adjusted_content: z.string(),
  changes_made: z.array(z.string()),
  tone_achieved: z.string()
});

export type SubjectLineVariation = z.infer<typeof SubjectLineVariationsSchema>['variations'][0];
export type ContentGeneration = z.infer<typeof ContentGenerationSchema>;
export type ToneAdjustment = z.infer<typeof ToneAdjustmentSchema>;

/**
 * Rate limiting for AI requests
 */
function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const userLimit = requestCounts.get(identifier);

  if (!userLimit || now > userLimit.resetTime) {
    requestCounts.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
    return true;
  }

  if (userLimit.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  userLimit.count++;
  return true;
}

/**
 * AI Service class for OpenAI integration
 */
export class AIService {
  private model = openai('gpt-4o-mini');

  /**
   * Generate newsletter content from a prompt or document
   */
  async generateContent(
    prompt: string,
    context?: {
      company?: string;
      audience?: string;
      tone?: string;
      length?: 'short' | 'medium' | 'long';
    },
    tenantId?: string
  ): Promise<ContentGeneration> {
    // Rate limiting check
    const identifier = tenantId || 'anonymous';
    if (!checkRateLimit(`content-${identifier}`)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      const systemPrompt = `You are an expert newsletter writer for consulting companies. 
      Generate engaging, professional newsletter content based on the provided prompt.
      
      Context:
      - Company: ${context?.company || 'Professional Services Firm'}
      - Target Audience: ${context?.audience || 'Business professionals and clients'}
      - Desired Tone: ${context?.tone || 'professional yet approachable'}
      - Content Length: ${context?.length || 'medium'} (short: 200-400 words, medium: 400-800 words, long: 800-1200 words)
      
      Requirements:
      - Create compelling, value-driven content
      - Include actionable insights or takeaways
      - Maintain the specified tone throughout
      - Structure content with clear sections
      - Include a relevant call-to-action if appropriate`;

      const result = await generateObject({
        model: this.model,
        schema: ContentGenerationSchema,
        system: systemPrompt,
        prompt: `Generate newsletter content based on this prompt: ${prompt}`,
        temperature: 0.7,
      });

      // Validate the result matches our schema
      const validatedResult = ContentGenerationSchema.parse(result.object);
      return validatedResult;
    } catch (error) {
      console.error('AI content generation error:', error);
      throw new Error('Failed to generate content. Please try again.');
    }
  }

  /**
   * Generate multiple subject line variations with performance predictions
   */
  async optimizeSubjectLines(
    content: string,
    context?: {
      company?: string;
      audience?: string;
      campaign_type?: string;
    },
    tenantId?: string
  ): Promise<SubjectLineVariation[]> {
    // Rate limiting check
    const identifier = tenantId || 'anonymous';
    if (!checkRateLimit(`subject-${identifier}`)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      const systemPrompt = `You are an expert email marketing specialist. 
      Generate 5 different subject line variations for a newsletter based on the provided content.
      
      Context:
      - Company: ${context?.company || 'Professional Services Firm'}
      - Target Audience: ${context?.audience || 'Business professionals'}
      - Campaign Type: ${context?.campaign_type || 'Newsletter'}
      
      For each subject line, predict its performance based on:
      - Length (optimal: 30-50 characters)
      - Emotional appeal
      - Clarity and relevance
      - Urgency or curiosity factors
      - Personalization potential
      
      Provide reasoning for each performance prediction.`;

      const result = await generateObject({
        model: this.model,
        schema: SubjectLineVariationsSchema,
        system: systemPrompt,
        prompt: `Generate subject line variations for this newsletter content: ${content.substring(0, 1000)}...`,
        temperature: 0.8,
      });

      return result.object.variations;
    } catch (error) {
      console.error('AI subject line optimization error:', error);
      throw new Error('Failed to optimize subject lines. Please try again.');
    }
  }

  /**
   * Adjust content tone and style
   */
  async adjustToneAndStyle(
    content: string,
    targetTone: string,
    targetStyle?: string,
    tenantId?: string
  ): Promise<ToneAdjustment> {
    // Rate limiting check
    const identifier = tenantId || 'anonymous';
    if (!checkRateLimit(`tone-${identifier}`)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      const systemPrompt = `You are an expert content editor specializing in tone and style adjustments.
      Rewrite the provided content to match the specified tone and style while preserving the core message and key information.
      
      Target Tone: ${targetTone}
      Target Style: ${targetStyle || 'professional'}
      
      Guidelines:
      - Maintain all factual information and key points
      - Adjust vocabulary, sentence structure, and phrasing to match the target tone
      - Ensure the content flows naturally
      - Keep the same approximate length
      - Document what specific changes were made`;

      const result = await generateObject({
        model: this.model,
        schema: ToneAdjustmentSchema,
        system: systemPrompt,
        prompt: `Adjust this content to match the target tone and style: ${content}`,
        temperature: 0.6,
      });

      return result.object;
    } catch (error) {
      console.error('AI tone adjustment error:', error);
      throw new Error('Failed to adjust tone and style. Please try again.');
    }
  }

  /**
   * Generate AI insights for completed campaigns
   */
  async generateCampaignInsights(
    campaignData: {
      subject_line: string;
      content: string;
      open_rate: number;
      click_rate: number;
      total_sent: number;
      top_links?: Array<{ url: string; clicks: number }>;
    },
    tenantId?: string
  ): Promise<string> {
    // Rate limiting check
    const identifier = tenantId || 'anonymous';
    if (!checkRateLimit(`insights-${identifier}`)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      const systemPrompt = `You are an expert email marketing analyst. 
      Analyze the provided campaign data and generate actionable insights and recommendations.
      
      Focus on:
      - Performance analysis (open rates, click rates)
      - Content effectiveness
      - Subject line performance
      - Audience engagement patterns
      - Specific recommendations for improvement
      - Identification of high-performing elements
      
      Provide a comprehensive but concise analysis that helps improve future campaigns.`;

      const prompt = `Analyze this campaign performance:
      
      Subject Line: ${campaignData.subject_line}
      Content Preview: ${campaignData.content.substring(0, 500)}...
      
      Performance Metrics:
      - Total Sent: ${campaignData.total_sent}
      - Open Rate: ${campaignData.open_rate}%
      - Click Rate: ${campaignData.click_rate}%
      
      ${campaignData.top_links ? `Top Performing Links:
      ${campaignData.top_links.map(link => `- ${link.url}: ${link.clicks} clicks`).join('\n')}` : ''}`;

      const result = await generateText({
        model: this.model,
        system: systemPrompt,
        prompt,
        temperature: 0.5,
      });

      return result.text;
    } catch (error) {
      console.error('AI campaign insights error:', error);
      throw new Error('Failed to generate campaign insights. Please try again.');
    }
  }

  /**
   * Health check for AI service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await generateText({
        model: this.model,
        prompt: 'Respond with "OK" if you can process this request.',
      });
      
      return result.text.trim().toLowerCase().includes('ok');
    } catch (error) {
      console.error('AI service health check failed:', error);
      return false;
    }
  }

  /**
   * Get current rate limit status for a tenant
   */
  getRateLimitStatus(tenantId: string): { remaining: number; resetTime: number } {
    const now = Date.now();
    const userLimit = requestCounts.get(tenantId);

    if (!userLimit || now > userLimit.resetTime) {
      return { remaining: MAX_REQUESTS_PER_WINDOW, resetTime: now + RATE_LIMIT_WINDOW };
    }

    return {
      remaining: Math.max(0, MAX_REQUESTS_PER_WINDOW - userLimit.count),
      resetTime: userLimit.resetTime
    };
  }
}

// Export singleton instance
export const aiService = new AIService();

// Export types and schemas
export { SubjectLineVariationsSchema, ContentGenerationSchema, ToneAdjustmentSchema };