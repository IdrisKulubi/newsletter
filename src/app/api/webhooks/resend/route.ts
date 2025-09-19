import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { emailService } from "@/lib/email";
import { analyticsService } from "@/lib/services/analytics";
import { config } from "@/lib/config";

/**
 * Webhook endpoint for Resend email events
 * Handles delivery, open, click, bounce, unsubscribe, and complaint events
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature if configured
    const headersList = headers();
    const signature = headersList.get("resend-signature");
    
    if (config.email.webhookSecret && signature) {
      // TODO: Implement signature verification when Resend provides it
      // For now, we'll rely on the webhook URL being secret
    }

    // Parse webhook payload
    const payload = await request.json();
    
    if (!payload || !payload.type) {
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 }
      );
    }

    // Process the webhook event
    const emailEvent = await emailService.processWebhook(payload);
    
    if (!emailEvent) {
      // Event was not processable (unknown type, missing data, etc.)
      return NextResponse.json(
        { message: "Event ignored" },
        { status: 200 }
      );
    }

    // Record the event in analytics
    await analyticsService.recordEmailEvent(emailEvent);

    // Log successful processing
    console.log(`Processed ${emailEvent.eventType} event for ${emailEvent.recipientEmail}`);

    return NextResponse.json(
      { message: "Event processed successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Webhook processing error:", error);
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Handle GET requests for webhook verification
 */
export async function GET() {
  return NextResponse.json(
    { message: "Resend webhook endpoint is active" },
    { status: 200 }
  );
}