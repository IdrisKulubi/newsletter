import { Resend } from "resend";
import { config } from "@/lib/config";
import { NewsletterRenderer, RenderOptions } from "./renderer";
import { Newsletter } from "@/lib/db/schema/newsletters";

export interface EmailRecipient {
  email: string;
  name?: string;
  personalizations?: Record<string, string>;
}

export interface EmailBatch {
  recipients: EmailRecipient[];
  newsletter: Newsletter;
  from: string;
  replyTo?: string;
  tags?: string[];
  headers?: Record<string, string>;
}

export interface SendResult {
  id: string;
  recipient: string;
  status: "sent" | "failed";
  error?: string;
}

export interface DomainConfig {
  domain: string;
  dkimRecord: string;
  spfRecord: string;
  dmarcRecord: string;
  status: "pending" | "verified" | "failed";
}

export interface DeliverabilityReport {
  domain: string;
  dkimValid: boolean;
  spfValid: boolean;
  dmarcValid: boolean;
  reputation: "good" | "neutral" | "poor";
  recommendations: string[];
}

export interface EmailEvent {
  id: string;
  campaignId?: string;
  recipientEmail: string;
  eventType:
    | "delivered"
    | "opened"
    | "clicked"
    | "bounced"
    | "unsubscribed"
    | "complained";
  eventData: Record<string, any>;
  timestamp: Date;
  tenantId: string;
}

export class EmailService {
  private resend: Resend;
  private readonly maxBatchSize = 100; // Resend's batch limit

  constructor() {
    this.resend = new Resend(config.email.resendApiKey);
  }

  /**
   * Send emails in batches with retry logic
   */
  async sendBatch(batch: EmailBatch): Promise<SendResult[]> {
    const results: SendResult[] = [];

    try {
      // Split recipients into smaller batches if needed
      const batches = this.chunkRecipients(batch.recipients, this.maxBatchSize);

      for (const recipientBatch of batches) {
        const batchResults = await this.sendSingleBatch({
          ...batch,
          recipients: recipientBatch,
        });
        results.push(...batchResults);
      }

      return results;
    } catch (error) {
      console.error("Failed to send email batch:", error);

      // Return failed results for all recipients
      return batch.recipients.map((recipient) => ({
        id: "",
        recipient: recipient.email,
        status: "failed" as const,
        error: error instanceof Error ? error.message : "Unknown error",
      }));
    }
  }

  /**
   * Send a single batch (up to 100 recipients)
   */
  private async sendSingleBatch(batch: EmailBatch): Promise<SendResult[]> {
    const results: SendResult[] = [];

    try {
      // Render newsletter for each recipient with personalizations
      const emailPromises = batch.recipients.map(async (recipient) => {
        try {
          const renderOptions: RenderOptions = {
            personalizations: recipient.personalizations,
            unsubscribeUrl: this.generateUnsubscribeUrl(
              recipient.email,
              batch.newsletter.tenantId
            ),
            webViewUrl: this.generateWebViewUrl(batch.newsletter.id),
          };

          const rendered = await NewsletterRenderer.render(
            batch.newsletter,
            renderOptions
          );

          return {
            to: recipient.email,
            from: batch.from,
            reply_to: batch.replyTo,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            tags: batch.tags
              ? batch.tags.map((tag) => ({ name: tag, value: "" }))
              : [],
            headers: batch.headers || {},
          };
        } catch (error) {
          console.error(
            `Failed to render email for ${recipient.email}:`,
            error
          );
          results.push({
            id: "",
            recipient: recipient.email,
            status: "failed",
            error: `Rendering failed: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          });
          return null;
        }
      });

      // Await all render operations then filter out nulls with a type guard so TypeScript
      // knows the array contains only valid email options.
      const emailResults = await Promise.all(emailPromises);
      const emails = emailResults.filter(
        (e): e is Exclude<(typeof emailResults)[number], null> => e !== null
      );

      if (emails.length === 0) {
        return results;
      }

      // Send batch to Resend
      const response = await this.resend.batch.send(emails);

      // Process response
      if (response.error) {
        console.error("Resend batch send error:", response.error);

        // Mark all as failed
        batch.recipients.forEach((recipient) => {
          results.push({
            id: "",
            recipient: recipient.email,
            status: "failed",
            error: response.error?.message || "Batch send failed",
          });
        });
      } else if (Array.isArray(response.data)) {
        // Map successful sends
        response.data.forEach((result, index) => {
          const recipient = batch.recipients[index];
          if (recipient) {
            results.push({
              id: (result as { id?: string }).id ?? "",
              recipient: recipient.email,
              status: "sent",
            });
          }
        });
      }

      return results;
    } catch (error) {
      console.error("Single batch send error:", error);

      // Mark all recipients as failed
      return batch.recipients.map((recipient) => ({
        id: "",
        recipient: recipient.email,
        status: "failed" as const,
        error: error instanceof Error ? error.message : "Unknown error",
      }));
    }
  }

  /**
   * Set up domain authentication (DKIM/SPF)
   */
  async setupDomainAuthentication(domain: string): Promise<DomainConfig> {
    try {
      const response = await this.resend.domains.create({ name: domain });

      if (response.error) {
        throw new Error(`Failed to create domain: ${response.error.message}`);
      }

      const domainData = response.data;

      return {
        domain,
        dkimRecord:
          domainData?.records?.find((r) => r.record === "DKIM")?.value || "",
        spfRecord: "v=spf1 include:_spf.resend.com ~all",
        dmarcRecord: "v=DMARC1; p=none; rua=mailto:dmarc@" + domain,
        status: domainData?.status === "verified" ? "verified" : "pending",
      };
    } catch (error) {
      console.error("Failed to setup domain authentication:", error);
      throw error;
    }
  }

  /**
   * Validate domain deliverability
   */
  async validateDeliverability(domain: string): Promise<DeliverabilityReport> {
    try {
      const response = await this.resend.domains.get(domain);

      if (response.error) {
        throw new Error(`Failed to get domain info: ${response.error.message}`);
      }

      const domainData = response.data;
      const recommendations: string[] = [];

      // Check DKIM
      const dkimValid = domainData?.status === "verified";
      if (!dkimValid) {
        recommendations.push("Configure DKIM record to improve deliverability");
      }

      // For SPF and DMARC, we'd need to do DNS lookups
      // For now, we'll assume they're configured if DKIM is valid
      const spfValid = dkimValid;
      const dmarcValid = dkimValid;

      if (!spfValid) {
        recommendations.push(
          "Configure SPF record: v=spf1 include:_spf.resend.com ~all"
        );
      }

      if (!dmarcValid) {
        recommendations.push(
          `Configure DMARC record: v=DMARC1; p=none; rua=mailto:dmarc@${domain}`
        );
      }

      // Determine reputation based on configuration
      let reputation: "good" | "neutral" | "poor" = "neutral";
      if (dkimValid && spfValid && dmarcValid) {
        reputation = "good";
      } else if (!dkimValid) {
        reputation = "poor";
      }

      return {
        domain,
        dkimValid,
        spfValid,
        dmarcValid,
        reputation,
        recommendations,
      };
    } catch (error) {
      console.error("Failed to validate deliverability:", error);

      return {
        domain,
        dkimValid: false,
        spfValid: false,
        dmarcValid: false,
        reputation: "poor",
        recommendations: ["Unable to validate domain configuration"],
      };
    }
  }

  /**
   * Process webhook events from Resend
   */
  async processWebhook(payload: any): Promise<EmailEvent | null> {
    try {
      const { type, data } = payload;

      // Map Resend event types to our event types
      const eventTypeMap: Record<string, EmailEvent["eventType"]> = {
        "email.delivered": "delivered",
        "email.opened": "opened",
        "email.clicked": "clicked",
        "email.bounced": "bounced",
        "email.complained": "complained",
        "email.unsubscribed": "unsubscribed",
      };

      const eventType = eventTypeMap[type];
      if (!eventType) {
        console.warn(`Unknown webhook event type: ${type}`);
        return null;
      }

      // Extract tenant ID from tags or headers
      const tenantId = this.extractTenantId(data);
      if (!tenantId) {
        console.warn("No tenant ID found in webhook data");
        return null;
      }

      return {
        id: data.email_id || crypto.randomUUID(),
        campaignId: this.extractCampaignId(data) || undefined,
        recipientEmail: data.to?.[0]?.email || data.email || "",
        eventType,
        eventData: {
          messageId: data.email_id,
          timestamp: data.created_at,
          userAgent: data.user_agent,
          ip: data.ip,
          link: data.link,
          ...data,
        },
        timestamp: new Date(data.created_at || Date.now()),
        tenantId,
      };
    } catch (error) {
      console.error("Failed to process webhook:", error);
      return null;
    }
  }

  /**
   * Get email sending statistics
   */
  async getStats(domain?: string): Promise<any> {
    try {
      // Resend doesn't have a direct stats API yet
      // This would be implemented when available
      return {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        complained: 0,
      };
    } catch (error) {
      console.error("Failed to get email stats:", error);
      return null;
    }
  }

  /**
   * Split recipients into chunks
   */
  private chunkRecipients(
    recipients: EmailRecipient[],
    chunkSize: number
  ): EmailRecipient[][] {
    const chunks: EmailRecipient[][] = [];

    for (let i = 0; i < recipients.length; i += chunkSize) {
      chunks.push(recipients.slice(i, i + chunkSize));
    }

    return chunks;
  }

  /**
   * Generate unsubscribe URL
   */
  private generateUnsubscribeUrl(email: string, tenantId: string): string {
    const token = Buffer.from(`${email}:${tenantId}`).toString("base64");
    return `${config.app.url}/unsubscribe?token=${token}`;
  }

  /**
   * Generate web view URL
   */
  private generateWebViewUrl(newsletterId: string): string {
    return `${config.app.url}/newsletter/${newsletterId}/view`;
  }

  /**
   * Extract tenant ID from webhook data
   */
  private extractTenantId(data: any): string | null {
    // Try to get from tags first
    if (data.tags && Array.isArray(data.tags)) {
      const tenantTag = data.tags.find((tag: string) =>
        tag.startsWith("tenant:")
      );
      if (tenantTag) {
        return tenantTag.replace("tenant:", "");
      }
    }

    // Try to get from headers
    if (data.headers && data.headers["X-Tenant-ID"]) {
      return data.headers["X-Tenant-ID"];
    }

    return null;
  }

  /**
   * Extract campaign ID from webhook data
   */
  private extractCampaignId(data: any): string | null {
    // Try to get from tags first
    if (data.tags && Array.isArray(data.tags)) {
      const campaignTag = data.tags.find((tag: string) =>
        tag.startsWith("campaign:")
      );
      if (campaignTag) {
        return campaignTag.replace("campaign:", "");
      }
    }

    // Try to get from headers
    if (data.headers && data.headers["X-Campaign-ID"]) {
      return data.headers["X-Campaign-ID"];
    }

    return null;
  }
}

// Export singleton instance
export const emailService = new EmailService();
