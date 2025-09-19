/**
 * Email Queue Service
 * Specialized service for email campaign processing
 */

import { Job } from 'bullmq';
import { queueManager, EmailJobData } from './queue-manager';
import { processCampaignSending } from '@/lib/actions/email/send-campaign';

export class EmailQueueService {
  /**
   * Send email campaign immediately
   */
  async sendEmailCampaign(campaignId: string): Promise<string> {
    const job = await queueManager.scheduleEmailJob(
      `send-campaign-${campaignId}`,
      {
        campaignId,
        tenantId: '', // Will be populated by the worker
        recipients: [], // Will be populated by the worker
      },
      {
        priority: 10, // High priority for immediate sending
      }
    );

    return job.id || '';
  }

  /**
   * Schedule email campaign for future sending
   */
  async scheduleEmailCampaign(campaignId: string, scheduledAt: Date): Promise<string> {
    const delay = scheduledAt.getTime() - Date.now();
    
    if (delay <= 0) {
      throw new Error('Scheduled time must be in the future');
    }

    const job = await queueManager.scheduleEmailJob(
      `scheduled-campaign-${campaignId}`,
      {
        campaignId,
        tenantId: '', // Will be populated by the worker
        recipients: [], // Will be populated by the worker
      },
      {
        delay,
        priority: 5, // Medium priority for scheduled sending
      }
    );

    return job.id || '';
  }

  /**
   * Cancel a scheduled email campaign
   */
  async cancelScheduledJob(campaignId: string): Promise<void> {
    // Find and remove the scheduled job
    const jobs = await queueManager.queues.email.getDelayed();
    
    for (const job of jobs) {
      if (job.name === `scheduled-campaign-${campaignId}`) {
        await job.remove();
        break;
      }
    }
  }

  /**
   * Process email campaign job (called by worker)
   */
  async processEmailCampaignJob(job: Job<EmailJobData>): Promise<void> {
    const { campaignId } = job.data;
    
    try {
      await processCampaignSending(campaignId);
      console.log(`Successfully processed email campaign: ${campaignId}`);
    } catch (error) {
      console.error(`Failed to process email campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Get campaign job status
   */
  async getCampaignJobStatus(campaignId: string): Promise<{
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'not_found';
    progress?: number;
    error?: string;
  }> {
    // Check all possible job names for this campaign
    const jobNames = [
      `send-campaign-${campaignId}`,
      `scheduled-campaign-${campaignId}`,
    ];

    for (const jobName of jobNames) {
      // Check in different states
      const states = ['waiting', 'active', 'completed', 'failed', 'delayed'] as const;
      
      for (const state of states) {
        const jobs = await queueManager.queues.email.getJobs([state]);
        const job = jobs.find(j => j.name === jobName);
        
        if (job) {
          return {
            status: state,
            progress: job.progress,
            error: job.failedReason,
          };
        }
      }
    }

    return { status: 'not_found' };
  }

  /**
   * Retry failed campaign
   */
  async retryCampaign(campaignId: string): Promise<string> {
    // Find the failed job
    const failedJobs = await queueManager.getFailedJobs('email');
    const campaignJob = failedJobs.find(job => 
      job.name === `send-campaign-${campaignId}` || 
      job.name === `scheduled-campaign-${campaignId}`
    );

    if (campaignJob) {
      await campaignJob.retry();
      return campaignJob.id || '';
    }

    // If no failed job found, create a new one
    return await this.sendEmailCampaign(campaignId);
  }

  /**
   * Get email queue statistics
   */
  async getEmailQueueStats() {
    return await queueManager.getQueueStats('email');
  }

  /**
   * Clean old email jobs
   */
  async cleanEmailQueue(gracePeriod: number = 24 * 60 * 60 * 1000): Promise<void> {
    await queueManager.cleanQueue('email', gracePeriod);
  }
}

// Export singleton instance
export const emailQueueService = new EmailQueueService();