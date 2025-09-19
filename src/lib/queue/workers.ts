/**
 * Queue Workers
 * Implements job processors for email, analytics, and AI queues
 */

import { Worker, Job } from "bullmq";
import {
  redisConnection,
  EmailJobData,
  AnalyticsJobData,
  AIJobData,
} from "./index";

// Define queue names locally to avoid circular imports
const QUEUE_NAMES = {
  EMAIL: "email-processing",
  ANALYTICS: "analytics-processing",
  AI: "ai-processing",
} as const;

/**
 * Email processing worker
 * Handles batch email sending and delivery
 */
export const emailWorker = new Worker<EmailJobData>(
  QUEUE_NAMES.EMAIL,
  async (job: Job<EmailJobData>) => {
    const { campaignId } = job.data;

    console.log(`Processing email job ${job.id} for campaign ${campaignId}`);

    try {
      // Update job progress
      await job.updateProgress(10);

      // Import the email queue service to avoid circular dependencies
      const { emailQueueService } = await import("./email-service");

      // Process the campaign sending
      await emailQueueService.processEmailCampaignJob(job);

      await job.updateProgress(100);

      console.log(`Email job ${job.id} completed for campaign ${campaignId}`);

      return {
        campaignId,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Email job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 3, // Process up to 3 email campaigns concurrently
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  }
);

/**
 * Analytics processing worker
 * Handles analytics aggregation and reporting
 */
export const analyticsWorker = new Worker<AnalyticsJobData>(
  QUEUE_NAMES.ANALYTICS,
  async (job: Job<AnalyticsJobData>) => {
    const { campaignId, tenantId, eventType, data } = job.data;

    console.log(`Processing analytics job ${job.id} for tenant ${tenantId}`);

    try {
      await job.updateProgress(20);

      switch (eventType) {
        case "campaign-complete":
          // Process campaign completion analytics
          console.log(
            `Processing campaign completion analytics for ${campaignId}`
          );

          // Simulate analytics processing
          await new Promise((resolve) => setTimeout(resolve, 500));
          await job.updateProgress(60);

          // In real implementation, this would:
          // - Aggregate email events from database
          // - Calculate metrics (open rate, click rate, etc.)
          // - Update campaign analytics record
          // - Generate insights

          await job.updateProgress(100);

          return {
            campaignId,
            metrics: {
              totalSent: data?.totalSent || 0,
              opened: data?.opened || 0,
              clicked: data?.clicked || 0,
              openRate: data?.totalSent
                ? (data.opened / data.totalSent) * 100
                : 0,
            },
            processedAt: new Date().toISOString(),
          };

        case "daily-aggregation":
          // Process daily analytics aggregation
          console.log(`Processing daily aggregation for tenant ${tenantId}`);

          await job.updateProgress(20);

          // Import analytics service to avoid circular dependencies
          const { analyticsService } = await import("../services/analytics");

          // Run nightly metrics aggregation
          await analyticsService.aggregateNightlyMetrics();

          await job.updateProgress(100);

          return {
            tenantId,
            aggregationType: "daily",
            processedAt: new Date().toISOString(),
          };

        default:
          throw new Error(`Unknown analytics event type: ${eventType}`);
      }
    } catch (error) {
      console.error(`Analytics job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 3, // Process up to 3 analytics jobs concurrently
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 25 },
  }
);

/**
 * AI processing worker
 * Handles AI-powered content generation and optimization
 */
export const aiWorker = new Worker<AIJobData>(
  QUEUE_NAMES.AI,
  async (job: Job<AIJobData>) => {
    const { tenantId, type, data } = job.data;

    console.log(`Processing AI job ${job.id} for tenant ${tenantId}`);

    try {
      await job.updateProgress(10);

      switch (type) {
        case "content-generation":
          console.log(`Generating content with prompt: ${data.prompt}`);

          // Simulate AI processing delay
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await job.updateProgress(50);

          // In real implementation, this would use OpenAI API:
          // const response = await openai.chat.completions.create({
          //   model: "gpt-4",
          //   messages: [{ role: "user", content: data.prompt }],
          // });

          const generatedContent = `Generated newsletter content based on: ${data.prompt}`;

          await job.updateProgress(100);

          return {
            type: "content-generation",
            content: generatedContent,
            prompt: data.prompt,
            generatedAt: new Date().toISOString(),
          };

        case "subject-optimization":
          console.log(`Optimizing subject line for content`);

          await new Promise((resolve) => setTimeout(resolve, 1500));
          await job.updateProgress(60);

          // In real implementation, this would generate multiple subject line variations
          const variations = [
            `${data.currentSubject} - Optimized Version 1`,
            `${data.currentSubject} - Optimized Version 2`,
            `${data.currentSubject} - Optimized Version 3`,
          ];

          await job.updateProgress(100);

          return {
            type: "subject-optimization",
            originalSubject: data.currentSubject,
            variations,
            optimizedAt: new Date().toISOString(),
          };

        case "campaign-insights":
          const campaignId = job.data.campaignId || data.campaignId;
          console.log(`Generating AI campaign insights for campaign ${campaignId}`);

          await job.updateProgress(20);

          // Import AI insights service to avoid circular dependencies
          const { aiInsightsService } = await import("../services/ai-insights");

          // Generate comprehensive AI insights
          const insights = await aiInsightsService.generateCampaignInsights(
            campaignId,
            tenantId
          );

          await job.updateProgress(100);

          return {
            type: "campaign-insights",
            campaignId,
            insights,
            generatedAt: new Date().toISOString(),
          };

        default:
          throw new Error(`Unknown AI job type: ${type}`);
      }
    } catch (error) {
      console.error(`AI job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 2, // Process up to 2 AI jobs concurrently (to respect API limits)
    removeOnComplete: { count: 25 },
    removeOnFail: { count: 10 },
  }
);

/**
 * Worker event handlers for monitoring and logging
 */
export function setupWorkerEventHandlers(): void {
  // Email worker events
  emailWorker.on("completed", (job, result) => {
    console.log(`✅ Email worker completed job ${job.id}:`, result);
  });

  emailWorker.on("failed", (job, err) => {
    console.error(`❌ Email worker failed job ${job?.id}:`, err.message);
  });

  emailWorker.on("error", (err) => {
    console.error("🚨 Email worker error:", err);
  });

  // Analytics worker events
  analyticsWorker.on("completed", (job, result) => {
    console.log(`✅ Analytics worker completed job ${job.id}:`, result);
  });

  analyticsWorker.on("failed", (job, err) => {
    console.error(`❌ Analytics worker failed job ${job?.id}:`, err.message);
  });

  analyticsWorker.on("error", (err) => {
    console.error("🚨 Analytics worker error:", err);
  });

  // AI worker events
  aiWorker.on("completed", (job, result) => {
    console.log(`✅ AI worker completed job ${job.id}:`, result);
  });

  aiWorker.on("failed", (job, err) => {
    console.error(`❌ AI worker failed job ${job?.id}:`, err.message);
  });

  aiWorker.on("error", (err) => {
    console.error("🚨 AI worker error:", err);
  });
}

/**
 * Start all workers
 */
export function startWorkers(): void {
  console.log("Starting queue workers...");

  // Workers are automatically started when created
  // But we can set up event handlers
  setupWorkerEventHandlers();

  console.log("Queue workers started:");
  console.log("- Email worker (concurrency: 5)");
  console.log("- Analytics worker (concurrency: 3)");
  console.log("- AI worker (concurrency: 2)");
}

/**
 * Stop all workers gracefully
 */
export async function stopWorkers(): Promise<void> {
  console.log("Stopping queue workers...");

  await Promise.all([
    emailWorker.close(),
    analyticsWorker.close(),
    aiWorker.close(),
  ]);

  console.log("All queue workers stopped");
}

/**
 * Export workers for external access
 */
export const workers = {
  email: emailWorker,
  analytics: analyticsWorker,
  ai: aiWorker,
} as const;
