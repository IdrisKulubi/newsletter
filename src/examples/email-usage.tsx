/**
 * Example usage of the Resend email service integration
 * This file demonstrates how to use the email service for sending campaigns
 */

import { emailService } from '@/lib/email';
import { sendCampaign } from '@/lib/actions/email/send-campaign';
import { setupDomainAuthentication, validateDomainDeliverability } from '@/lib/actions/email/manage-domain';

// Example newsletter data structure
const exampleNewsletter = {
  id: 'newsletter-123',
  tenantId: 'tenant-123',
  title: 'Weekly Newsletter - AI Updates',
  content: {
    blocks: [
      {
        id: 'heading-1',
        type: 'heading' as const,
        content: {
          text: 'This Week in AI',
          level: 1,
        },
        styling: {
          textAlign: 'center',
          color: '#2563eb',
        },
      },
      {
        id: 'text-1',
        type: 'text' as const,
        content: {
          text: 'Hello {{firstName}}, here are the latest updates in artificial intelligence...',
        },
        styling: {},
      },
      {
        id: 'button-1',
        type: 'button' as const,
        content: {
          text: 'Read Full Article',
          url: 'https://example.com/article',
          variant: 'primary',
        },
        styling: {},
      },
    ],
    globalStyling: {
      fontFamily: 'Arial, sans-serif',
      primaryColor: '#2563eb',
      backgroundColor: '#ffffff',
    },
  },
  template: {
    id: 'default',
    config: {
      headerStyle: 'minimal' as const,
    },
  },
  metadata: {
    previewText: 'Latest AI updates and insights',
  },
  status: 'draft' as const,
  createdBy: 'user-123',
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Example 1: Send a batch of emails directly using the email service
 */
export async function sendNewsletterBatch() {
  try {
    const recipients = [
      {
        email: 'john@example.com',
        name: 'John Doe',
        personalizations: {
          firstName: 'John',
          lastName: 'Doe',
        },
      },
      {
        email: 'jane@example.com',
        name: 'Jane Smith',
        personalizations: {
          firstName: 'Jane',
          lastName: 'Smith',
        },
      },
    ];

    const batch = {
      recipients,
      newsletter: exampleNewsletter,
      from: 'newsletter@yourcompany.com',
      replyTo: 'support@yourcompany.com',
      tags: [
        'tenant:tenant-123',
        'campaign:campaign-123',
        'newsletter:newsletter-123',
      ],
      headers: {
        'X-Tenant-ID': 'tenant-123',
        'X-Campaign-ID': 'campaign-123',
      },
    };

    const results = await emailService.sendBatch(batch);
    
    console.log('Email batch results:', results);
    
    // Check for failures
    const failed = results.filter(r => r.status === 'failed');
    if (failed.length > 0) {
      console.error('Failed sends:', failed);
    }
    
    return results;
  } catch (error) {
    console.error('Failed to send newsletter batch:', error);
    throw error;
  }
}

/**
 * Example 2: Send a campaign using Server Actions (recommended approach)
 */
export async function sendCampaignExample() {
  try {
    // Send campaign immediately
    const result = await sendCampaign({
      campaignId: 'campaign-123',
    });

    if (result.success) {
      console.log('Campaign sent successfully:', result.message);
      console.log('Job ID:', result.jobId);
    } else {
      console.error('Failed to send campaign:', result.message);
    }

    return result;
  } catch (error) {
    console.error('Campaign sending error:', error);
    throw error;
  }
}

/**
 * Example 3: Schedule a campaign for future sending
 */
export async function scheduleCampaignExample() {
  try {
    // Schedule for tomorrow at 9 AM
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + 1);
    scheduledAt.setHours(9, 0, 0, 0);

    const result = await sendCampaign({
      campaignId: 'campaign-123',
      scheduledAt,
    });

    if (result.success) {
      console.log('Campaign scheduled successfully:', result.message);
      console.log('Job ID:', result.jobId);
    } else {
      console.error('Failed to schedule campaign:', result.message);
    }

    return result;
  } catch (error) {
    console.error('Campaign scheduling error:', error);
    throw error;
  }
}

/**
 * Example 4: Set up domain authentication
 */
export async function setupDomainExample() {
  try {
    const formData = new FormData();
    formData.append('domain', 'newsletter.yourcompany.com');

    const result = await setupDomainAuthentication(formData);

    if (result.success && result.domainConfig) {
      console.log('Domain setup initiated:', result.message);
      console.log('DKIM Record:', result.domainConfig.dkimRecord);
      console.log('SPF Record:', result.domainConfig.spfRecord);
      console.log('DMARC Record:', result.domainConfig.dmarcRecord);
      
      // You would need to add these DNS records to your domain
      console.log('\nPlease add these DNS records to your domain:');
      console.log(`DKIM: ${result.domainConfig.dkimRecord}`);
      console.log(`SPF: ${result.domainConfig.spfRecord}`);
      console.log(`DMARC: ${result.domainConfig.dmarcRecord}`);
    } else {
      console.error('Failed to setup domain:', result.message);
    }

    return result;
  } catch (error) {
    console.error('Domain setup error:', error);
    throw error;
  }
}

/**
 * Example 5: Validate domain deliverability
 */
export async function validateDomainExample() {
  try {
    const result = await validateDomainDeliverability('newsletter.yourcompany.com');

    if (result.success && result.report) {
      console.log('Domain validation completed:', result.message);
      console.log('DKIM Valid:', result.report.dkimValid);
      console.log('SPF Valid:', result.report.spfValid);
      console.log('DMARC Valid:', result.report.dmarcValid);
      console.log('Reputation:', result.report.reputation);
      
      if (result.report.recommendations.length > 0) {
        console.log('Recommendations:');
        result.report.recommendations.forEach(rec => console.log(`- ${rec}`));
      }
    } else {
      console.error('Failed to validate domain:', result.message);
    }

    return result;
  } catch (error) {
    console.error('Domain validation error:', error);
    throw error;
  }
}

/**
 * Example 6: Handle webhook events (this would be called by the webhook endpoint)
 */
export async function handleWebhookExample() {
  // Example webhook payload from Resend
  const webhookPayload = {
    type: 'email.opened',
    data: {
      email_id: 'email-123',
      to: [{ email: 'user@example.com' }],
      created_at: '2024-01-01T12:00:00Z',
      user_agent: 'Mozilla/5.0...',
      ip: '192.168.1.1',
      tags: ['tenant:tenant-123', 'campaign:campaign-123'],
    },
  };

  try {
    const emailEvent = await emailService.processWebhook(webhookPayload);
    
    if (emailEvent) {
      console.log('Processed webhook event:', emailEvent);
      
      // The webhook endpoint would store this in the database
      // and update campaign analytics automatically
      
      return emailEvent;
    } else {
      console.warn('Webhook event could not be processed');
      return null;
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    throw error;
  }
}

/**
 * Example 7: Monitor email queue status
 */
export async function monitorEmailQueue() {
  try {
    const { emailQueueService } = await import('@/lib/queue/email-service');
    
    // Get queue statistics
    const stats = await emailQueueService.getEmailQueueStats();
    
    console.log('Email Queue Statistics:');
    console.log(`- Waiting: ${stats.waiting}`);
    console.log(`- Active: ${stats.active}`);
    console.log(`- Completed: ${stats.completed}`);
    console.log(`- Failed: ${stats.failed}`);
    console.log(`- Delayed: ${stats.delayed}`);
    console.log(`- Paused: ${stats.paused}`);
    
    return stats;
  } catch (error) {
    console.error('Queue monitoring error:', error);
    throw error;
  }
}

/**
 * Example usage in a React component
 */
export function EmailServiceExample() {
  const handleSendNewsletter = async () => {
    try {
      await sendNewsletterBatch();
      alert('Newsletter sent successfully!');
    } catch (error) {
      alert('Failed to send newsletter');
    }
  };

  const handleScheduleCampaign = async () => {
    try {
      await scheduleCampaignExample();
      alert('Campaign scheduled successfully!');
    } catch (error) {
      alert('Failed to schedule campaign');
    }
  };

  const handleSetupDomain = async () => {
    try {
      await setupDomainExample();
      alert('Domain setup initiated! Check console for DNS records.');
    } catch (error) {
      alert('Failed to setup domain');
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Email Service Examples</h2>
      
      <div className="space-y-2">
        <button
          onClick={handleSendNewsletter}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Send Newsletter Batch
        </button>
        
        <button
          onClick={handleScheduleCampaign}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Schedule Campaign
        </button>
        
        <button
          onClick={handleSetupDomain}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Setup Domain Authentication
        </button>
      </div>
      
      <div className="mt-6 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold mb-2">Key Features Implemented:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>✅ Resend API integration with batch sending</li>
          <li>✅ Email template rendering with personalization</li>
          <li>✅ Domain authentication setup (DKIM/SPF/DMARC)</li>
          <li>✅ Webhook processing for email events</li>
          <li>✅ Campaign scheduling and management</li>
          <li>✅ Queue-based background processing</li>
          <li>✅ Comprehensive error handling and retry logic</li>
          <li>✅ Integration tests for all major functionality</li>
        </ul>
      </div>
    </div>
  );
}