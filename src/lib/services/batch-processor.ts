/**
 * Batch Processing Service
 * Handles large-scale email campaign processing with batching, retry logic, and monitoring
 */

import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema/campaigns';
import { subscribers } from '@/lib/db/schema/subscribers';
import { newsletters } from '@/lib/db/schema/newsletters';
import { emailService, EmailBatch, EmailRecipient } from '@/lib/email';
import { queueManager } from '@/lib/queue/queue-manager';
import { eq, and, inArray } from 'drizzle-orm';

export interface BatchProcessingOptions {
  batchSize: number;
  delayBetweenBatches: number; // milliseconds
  maxRetries: number;
  retryDelay: number; // milliseconds
}

export interface BatchProcessingResult {
  totalRecipients: number;
  totalBatches: number;
  successfulBatches: number;
  failedBatches: number;
  totalEmailsSent: number;
  totalEmailsFailed: number;
  processingTimeMs: number;
}

export interface BatchStatus {
  batchId: string;
  campaignId: string;
  batchNumber: number;
  totalBatches: number;
  recipients: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  attempts: number;
  lastError?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export class BatchProcessor {
  private readonly defaultOptions: BatchProcessingOptions = {
    batchSize: 100,
    delayBetweenBatches: 1000, // 1 second
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
  };

  /**
   * Process a campaign in batches
   */
  async processCampaignInBatches(
    campaignId: string,
    options: Partial<BatchProcessingOptions> = {}
  ): Promise<BatchProcessingResult> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };

    try {
      // Get campaign with newsletter and tenant info
      const campaignData = await db
        .select({
          campaign: campaigns,
          newsletter: newsletters,
        })
        .from(campaigns)
        .innerJoin(newsletters, eq(campaigns.newsletterId, newsletters.id))
        .where(eq(campaigns.id, campaignId))
        .limit(1);

      if (campaignData.length === 0) {
        throw new Error('Campaign not found');
      }

      const { campaign, newsletter } = campaignData[0];

      // Get all active subscribers for this tenant
      const allSubscribers = await db
        .select()
        .from(subscribers)
        .where(
          and(
            eq(subscribers.tenantId, campaign.tenantId),
            eq(subscribers.status, 'active')
          )
        );

      if (allSubscribers.length === 0) {
        throw new Error('No active subscribers found');
      }

      // Filter recipients based on campaign recipient list if specified
      let targetRecipients = allSubscribers;
      if (campaign.recipients.list && campaign.recipients.list.length > 0) {
        const campaignEmails = campaign.recipients.list.map(r => r.email);
        targetRecipients = allSubscribers.filter(sub => 
          campaignEmails.includes(sub.email)
        );
      }

      // Split recipients into batches
      const batches = this.createBatches(targetRecipients, opts.batchSize);
      const totalBatches = batches.length;

      console.log(`Processing campaign ${campaignId} in ${totalBatches} batches`);

      // Update campaign status to sending
      await db
        .update(campaigns)
        .set({
          status: 'sending',
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaignId));

      // Process batches
      const results = await this.processBatches(
        campaignId,
        batches,
        newsletter,
        campaign,
        opts
      );

      // Calculate final statistics
      const result: BatchProcessingResult = {
        totalRecipients: targetRecipients.length,
        totalBatches,
        successfulBatches: results.filter(r => r.success).length,
        failedBatches: results.filter(r => !r.success).length,
        totalEmailsSent: results.reduce((sum, r) => sum + (r.emailsSent || 0), 0),
        totalEmailsFailed: results.reduce((sum, r) => sum + (r.emailsFailed || 0), 0),
        processingTimeMs: Date.now() - startTime,
      };

      // Update campaign with final results
      const analytics = {
        totalSent: result.totalEmailsSent,
        delivered: 0, // Will be updated by webhooks
        opened: 0,
        clicked: 0,
        bounced: 0,
        unsubscribed: 0,
        complained: 0,
        openRate: 0,
        clickRate: 0,
        bounceRate: 0,
        lastUpdated: new Date(),
      };

      await db
        .update(campaigns)
        .set({
          status: result.failedBatches === 0 ? 'sent' : 'sent', // Mark as sent even with some failures
          sentAt: new Date(),
          analytics,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaignId));

      console.log(`Campaign ${campaignId} processing completed:`, result);
      return result;

    } catch (error) {
      console.error(`Failed to process campaign ${campaignId}:`, error);
      
      // Update campaign status to cancelled on error
      await db
        .update(campaigns)
        .set({
          status: 'cancelled',
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaignId));

      throw error;
    }
  }

  /**
   * Create batches from recipients
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process all batches with retry logic
   */
  private async processBatches(
    campaignId: string,
    batches: any[][],
    newsletter: any,
    campaign: any,
    options: BatchProcessingOptions
  ): Promise<Array<{
    batchNumber: number;
    success: boolean;
    emailsSent?: number;
    emailsFailed?: number;
    error?: string;
  }>> {
    const results = [];

    for (let i = 0; i < batches.length; i++) {
      const batchNumber = i + 1;
      const batch = batches[i];

      console.log(`Processing batch ${batchNumber}/${batches.length} for campaign ${campaignId}`);

      try {
        const result = await this.processBatchWithRetry(
          campaignId,
          batchNumber,
          batch,
          newsletter,
          campaign,
          options
        );

        results.push({
          batchNumber,
          success: true,
          emailsSent: result.successful,
          emailsFailed: result.failed,
        });

        // Delay between batches to avoid overwhelming the email service
        if (i < batches.length - 1 && options.delayBetweenBatches > 0) {
          await this.delay(options.delayBetweenBatches);
        }

      } catch (error) {
        console.error(`Batch ${batchNumber} failed after all retries:`, error);
        results.push({
          batchNumber,
          success: false,
          emailsSent: 0,
          emailsFailed: batch.length,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Process a single batch with retry logic
   */
  private async processBatchWithRetry(
    campaignId: string,
    batchNumber: number,
    batch: any[],
    newsletter: any,
    campaign: any,
    options: BatchProcessingOptions
  ): Promise<{ successful: number; failed: number }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
      try {
        console.log(`Batch ${batchNumber} attempt ${attempt}/${options.maxRetries}`);

        const result = await this.processSingleBatch(
          campaignId,
          batch,
          newsletter,
          campaign
        );

        console.log(`Batch ${batchNumber} completed: ${result.successful}/${batch.length} successful`);
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`Batch ${batchNumber} attempt ${attempt} failed:`, lastError.message);

        // Wait before retry (except on last attempt)
        if (attempt < options.maxRetries) {
          await this.delay(options.retryDelay * attempt); // Exponential backoff
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Process a single batch of emails
   */
  private async processSingleBatch(
    campaignId: string,
    batch: any[],
    newsletter: any,
    campaign: any
  ): Promise<{ successful: number; failed: number }> {
    // Prepare email recipients
    const recipients: EmailRecipient[] = batch.map(subscriber => ({
      email: subscriber.email,
      name: subscriber.firstName && subscriber.lastName 
        ? `${subscriber.firstName} ${subscriber.lastName}` 
        : subscriber.firstName || undefined,
      personalizations: {
        firstName: subscriber.firstName || '',
        lastName: subscriber.lastName || '',
        email: subscriber.email,
      },
    }));

    // Create email batch
    const emailBatch: EmailBatch = {
      recipients,
      newsletter,
      from: `newsletter@${campaign.tenantId}.com`,
      replyTo: `support@${campaign.tenantId}.com`,
      tags: [
        `tenant:${campaign.tenantId}`,
        `campaign:${campaign.id}`,
        `newsletter:${newsletter.id}`,
      ],
      headers: {
        'X-Tenant-ID': campaign.tenantId,
        'X-Campaign-ID': campaign.id,
        'X-Newsletter-ID': newsletter.id,
      },
    };

    // Send the batch
    const results = await emailService.sendBatch(emailBatch);

    // Count successful and failed sends
    const successful = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;

    // Log any failures
    if (failed > 0) {
      const failedResults = results.filter(r => r.status === 'failed');
      console.warn(`Batch had ${failed} failures:`, failedResults.map(r => ({
        email: r.email,
        error: r.error,
      })));
    }

    return { successful, failed };
  }

  /**
   * Schedule batch processing as background jobs
   */
  async scheduleBatchProcessing(
    campaignId: string,
    options: Partial<BatchProcessingOptions> = {}
  ): Promise<string[]> {
    const opts = { ...this.defaultOptions, ...options };

    // Get campaign info
    const campaignData = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (campaignData.length === 0) {
      throw new Error('Campaign not found');
    }

    const campaign = campaignData[0];

    // Get subscribers
    const allSubscribers = await db
      .select()
      .from(subscribers)
      .where(
        and(
          eq(subscribers.tenantId, campaign.tenantId),
          eq(subscribers.status, 'active')
        )
      );

    // Create batches
    const batches = this.createBatches(allSubscribers, opts.batchSize);
    const jobIds: string[] = [];

    // Schedule each batch as a separate job
    for (let i = 0; i < batches.length; i++) {
      const batchRecipients = batches[i].map(sub => ({
        email: sub.email,
        name: sub.firstName && sub.lastName 
          ? `${sub.firstName} ${sub.lastName}` 
          : sub.firstName || undefined,
        personalizations: {
          firstName: sub.firstName || '',
          lastName: sub.lastName || '',
          email: sub.email,
        },
      }));

      const job = await queueManager.scheduleEmailJob(
        `campaign-batch-${campaignId}-${i + 1}`,
        {
          campaignId,
          tenantId: campaign.tenantId,
          recipients: batchRecipients,
          batchSize: opts.batchSize,
        },
        {
          delay: i * opts.delayBetweenBatches, // Stagger batch processing
          priority: 10,
        }
      );

      jobIds.push(job.id || '');
    }

    return jobIds;
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get batch processing status for a campaign
   */
  async getBatchStatus(campaignId: string): Promise<{
    totalBatches: number;
    completedBatches: number;
    failedBatches: number;
    inProgressBatches: number;
    overallStatus: 'pending' | 'processing' | 'completed' | 'failed';
  }> {
    // This would typically query job status from the queue
    // For now, return a basic implementation
    const jobs = await queueManager.queues.email.getJobs(['waiting', 'active', 'completed', 'failed']);
    const campaignJobs = jobs.filter(job => 
      job.name.startsWith(`campaign-batch-${campaignId}-`)
    );

    const totalBatches = campaignJobs.length;
    const completedBatches = campaignJobs.filter(job => job.finishedOn).length;
    const failedBatches = campaignJobs.filter(job => job.failedReason).length;
    const inProgressBatches = campaignJobs.filter(job => job.processedOn && !job.finishedOn).length;

    let overallStatus: 'pending' | 'processing' | 'completed' | 'failed';
    if (failedBatches === totalBatches) {
      overallStatus = 'failed';
    } else if (completedBatches === totalBatches) {
      overallStatus = 'completed';
    } else if (inProgressBatches > 0 || completedBatches > 0) {
      overallStatus = 'processing';
    } else {
      overallStatus = 'pending';
    }

    return {
      totalBatches,
      completedBatches,
      failedBatches,
      inProgressBatches,
      overallStatus,
    };
  }
}

// Export singleton instance
export const batchProcessor = new BatchProcessor();