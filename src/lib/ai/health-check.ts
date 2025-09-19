/**
 * AI Service Health Check Utility
 * Provides health monitoring for the AI service
 */

import { aiService } from './index';

export interface AIHealthStatus {
  isHealthy: boolean;
  lastChecked: Date;
  error?: string;
  rateLimitStatus?: {
    remaining: number;
    resetTime: number;
  };
}

let lastHealthCheck: AIHealthStatus | null = null;
const HEALTH_CHECK_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Check AI service health with caching
 */
export async function checkAIHealth(tenantId?: string): Promise<AIHealthStatus> {
  const now = new Date();
  
  // Return cached result if still valid
  if (lastHealthCheck && 
      (now.getTime() - lastHealthCheck.lastChecked.getTime()) < HEALTH_CHECK_CACHE_DURATION) {
    return lastHealthCheck;
  }

  try {
    const isHealthy = await aiService.healthCheck();
    const rateLimitStatus = tenantId ? aiService.getRateLimitStatus(tenantId) : undefined;

    lastHealthCheck = {
      isHealthy,
      lastChecked: now,
      rateLimitStatus
    };

    return lastHealthCheck;
  } catch (error) {
    lastHealthCheck = {
      isHealthy: false,
      lastChecked: now,
      error: error instanceof Error ? error.message : 'Unknown error'
    };

    return lastHealthCheck;
  }
}

/**
 * Get cached health status without making a new request
 */
export function getCachedAIHealth(): AIHealthStatus | null {
  return lastHealthCheck;
}

/**
 * Clear health check cache
 */
export function clearHealthCache(): void {
  lastHealthCheck = null;
}