import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email';
import { db } from '@/lib/db';
import { emailEvents } from '@/lib/db/schema/analytics';
import { campaigns } from '@/lib/db/schema/campaigns';
import { eq } from 'drizzle-orm';

/**
 * Webhook endpoint for Resend email events
 * Processes delivery, open, click, bounce, and unsubscribe events
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature (if configured)
    const signature = request.headers.get('resend-signature');
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    
    if (webhookSecret && signature) {
      // TODO: Implement signature verification when Resend supports it
      // For now, we'll skip verification but log the signature
      console.log('Webhook signature received:', signature);
    }

    // Parse webhook payload
    const payload = await request.json();
    
    // Process the webhook event
    const emailEvent = await emailService.processWebhook(payload);
    
    if (!emailEvent) {
      console.warn('Webhook event could not be processed:', payload);
      return NextResponse.json({ success: false, error: 'Invalid event' }, { status: 400 });
    }

    // Store the event in database
    await db.insert(emailEvents).values({
      id: emailEvent.id,
      campaignId: emailEvent.campaignId || '',
      recipientEmail: emailEvent.recipientEmail,
      eventType: emailEvent.eventType,
      eventData: emailEvent.eventData,
      timestamp: emailEvent.timestamp,
      tenantId: emailEvent.tenantId,
    });

    // Update campaign analytics if campaign ID is available
    if (emailEvent.campaignId) {
      await updateCampaignAnalytics(emailEvent.campaignId, emailEvent.eventType);
    }

    console.log(`Processed ${emailEvent.eventType} event for ${emailEvent.recipientEmail}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

/**
 * Update campaign analytics based on email events
 */
async function updateCampaignAnalytics(campaignId: string, eventType: string) {
  try {
    // Get current campaign
    const campaign = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (campaign.length === 0) {
      console.warn(`Campaign not found: ${campaignId}`);
      return;
    }

    const currentCampaign = campaign[0];
    const analytics = currentCampaign.analytics || {
      totalSent: 0,
      delivered: 0,
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

    // Increment the appropriate counter
    switch (eventType) {
      case 'delivered':
        analytics.delivered += 1;
        break;
      case 'opened':
        analytics.opened += 1;
        break;
      case 'clicked':
        analytics.clicked += 1;
        break;
      case 'bounced':
        analytics.bounced += 1;
        break;
      case 'unsubscribed':
        analytics.unsubscribed += 1;
        break;
      case 'complained':
        analytics.complained += 1;
        break;
    }

    // Recalculate rates
    const delivered = analytics.delivered || 1; // Avoid division by zero
    analytics.openRate = (analytics.opened / delivered) * 100;
    analytics.clickRate = (analytics.clicked / delivered) * 100;
    analytics.bounceRate = (analytics.bounced / analytics.totalSent) * 100;
    analytics.lastUpdated = new Date();

    // Update campaign
    await db
      .update(campaigns)
      .set({ 
        analytics,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));

    console.log(`Updated analytics for campaign ${campaignId}: ${eventType}`);
  } catch (error) {
    console.error(`Failed to update campaign analytics for ${campaignId}:`, error);
  }
}

/**
 * Handle GET requests (for webhook verification if needed)
 */
export async function GET(request: NextRequest) {
  // Some webhook services require GET endpoint for verification
  const challenge = request.nextUrl.searchParams.get('challenge');
  
  if (challenge) {
    return NextResponse.json({ challenge });
  }
  
  return NextResponse.json({ status: 'Webhook endpoint active' });
}