import { describe, it, expect } from "vitest";

// Test webhook payload processing logic
interface WebhookPayload {
  type: string;
  data: {
    email_id?: string;
    to?: Array<{ email: string }>;
    created_at?: string;
    tags?: string[];
    link?: string;
    user_agent?: string;
    ip?: string;
  };
}

interface ProcessedEmailEvent {
  id: string;
  tenantId: string;
  campaignId?: string | null;
  recipientEmail: string;
  eventType: "delivered" | "opened" | "clicked" | "bounced" | "unsubscribed" | "complained";
  eventData: Record<string, any>;
  timestamp: Date;
}

// Webhook processing functions
function mapEventType(webhookType: string): ProcessedEmailEvent["eventType"] | null {
  const eventTypeMap: Record<string, ProcessedEmailEvent["eventType"]> = {
    "email.delivered": "delivered",
    "email.opened": "opened",
    "email.clicked": "clicked",
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.unsubscribed": "unsubscribed",
  };

  return eventTypeMap[webhookType] || null;
}

function extractTenantId(data: WebhookPayload["data"]): string | null {
  if (data.tags && Array.isArray(data.tags)) {
    const tenantTag = data.tags.find((tag: string) => tag.startsWith("tenant:"));
    if (tenantTag) {
      return tenantTag.replace("tenant:", "");
    }
  }
  return null;
}

function extractCampaignId(data: WebhookPayload["data"]): string | null {
  if (data.tags && Array.isArray(data.tags)) {
    const campaignTag = data.tags.find((tag: string) => tag.startsWith("campaign:"));
    if (campaignTag) {
      return campaignTag.replace("campaign:", "");
    }
  }
  return null;
}

function processWebhookPayload(payload: WebhookPayload): ProcessedEmailEvent | null {
  const eventType = mapEventType(payload.type);
  if (!eventType) {
    return null;
  }

  const tenantId = extractTenantId(payload.data);
  if (!tenantId) {
    return null;
  }

  const recipientEmail = payload.data.to?.[0]?.email || "";
  if (!recipientEmail) {
    return null;
  }

  return {
    id: payload.data.email_id || crypto.randomUUID(),
    tenantId,
    campaignId: extractCampaignId(payload.data),
    recipientEmail,
    eventType,
    eventData: {
      messageId: payload.data.email_id,
      timestamp: payload.data.created_at,
      userAgent: payload.data.user_agent,
      ip: payload.data.ip,
      link: payload.data.link,
    },
    timestamp: new Date(payload.data.created_at || Date.now()),
  };
}

describe("Webhook Processing", () => {
  describe("Event Type Mapping", () => {
    it("should map webhook event types correctly", () => {
      const testCases = [
        { input: "email.delivered", expected: "delivered" },
        { input: "email.opened", expected: "opened" },
        { input: "email.clicked", expected: "clicked" },
        { input: "email.bounced", expected: "bounced" },
        { input: "email.complained", expected: "complained" },
        { input: "email.unsubscribed", expected: "unsubscribed" },
        { input: "unknown.event", expected: null },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = mapEventType(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe("Tenant ID Extraction", () => {
    it("should extract tenant ID from tags", () => {
      const data = {
        tags: ["tenant:tenant-123", "campaign:campaign-456"],
      };

      const tenantId = extractTenantId(data);
      expect(tenantId).toBe("tenant-123");
    });

    it("should return null when no tenant tag found", () => {
      const data = {
        tags: ["campaign:campaign-456", "other:value"],
      };

      const tenantId = extractTenantId(data);
      expect(tenantId).toBeNull();
    });

    it("should handle missing tags", () => {
      const data = {};

      const tenantId = extractTenantId(data);
      expect(tenantId).toBeNull();
    });
  });

  describe("Campaign ID Extraction", () => {
    it("should extract campaign ID from tags", () => {
      const data = {
        tags: ["tenant:tenant-123", "campaign:campaign-456"],
      };

      const campaignId = extractCampaignId(data);
      expect(campaignId).toBe("campaign-456");
    });

    it("should return null when no campaign tag found", () => {
      const data = {
        tags: ["tenant:tenant-123", "other:value"],
      };

      const campaignId = extractCampaignId(data);
      expect(campaignId).toBeNull();
    });
  });

  describe("Webhook Payload Processing", () => {
    it("should process valid webhook payload", () => {
      const payload: WebhookPayload = {
        type: "email.opened",
        data: {
          email_id: "msg-123",
          to: [{ email: "test@example.com" }],
          created_at: "2024-01-15T10:00:00Z",
          tags: ["tenant:tenant-1", "campaign:campaign-1"],
          user_agent: "Mozilla/5.0",
          ip: "192.168.1.1",
        },
      };

      const result = processWebhookPayload(payload);

      expect(result).toEqual({
        id: "msg-123",
        tenantId: "tenant-1",
        campaignId: "campaign-1",
        recipientEmail: "test@example.com",
        eventType: "opened",
        eventData: {
          messageId: "msg-123",
          timestamp: "2024-01-15T10:00:00Z",
          userAgent: "Mozilla/5.0",
          ip: "192.168.1.1",
          link: undefined,
        },
        timestamp: new Date("2024-01-15T10:00:00Z"),
      });
    });

    it("should handle click events with link data", () => {
      const payload: WebhookPayload = {
        type: "email.clicked",
        data: {
          email_id: "msg-123",
          to: [{ email: "test@example.com" }],
          created_at: "2024-01-15T10:00:00Z",
          tags: ["tenant:tenant-1"],
          link: "https://example.com/link",
        },
      };

      const result = processWebhookPayload(payload);

      expect(result?.eventType).toBe("clicked");
      expect(result?.eventData.link).toBe("https://example.com/link");
    });

    it("should return null for unknown event types", () => {
      const payload: WebhookPayload = {
        type: "unknown.event",
        data: {
          email_id: "msg-123",
          to: [{ email: "test@example.com" }],
          tags: ["tenant:tenant-1"],
        },
      };

      const result = processWebhookPayload(payload);
      expect(result).toBeNull();
    });

    it("should return null when tenant ID is missing", () => {
      const payload: WebhookPayload = {
        type: "email.opened",
        data: {
          email_id: "msg-123",
          to: [{ email: "test@example.com" }],
          tags: ["other:value"],
        },
      };

      const result = processWebhookPayload(payload);
      expect(result).toBeNull();
    });

    it("should return null when recipient email is missing", () => {
      const payload: WebhookPayload = {
        type: "email.opened",
        data: {
          email_id: "msg-123",
          tags: ["tenant:tenant-1"],
        },
      };

      const result = processWebhookPayload(payload);
      expect(result).toBeNull();
    });

    it("should handle events without campaign ID", () => {
      const payload: WebhookPayload = {
        type: "email.delivered",
        data: {
          email_id: "msg-123",
          to: [{ email: "test@example.com" }],
          tags: ["tenant:tenant-1"],
        },
      };

      const result = processWebhookPayload(payload);

      expect(result?.campaignId).toBeNull();
      expect(result?.tenantId).toBe("tenant-1");
      expect(result?.eventType).toBe("delivered");
    });
  });
});

describe("Batch Event Processing", () => {
  it("should process multiple events efficiently", () => {
    const payloads: WebhookPayload[] = [
      {
        type: "email.delivered",
        data: {
          email_id: "msg-1",
          to: [{ email: "user1@example.com" }],
          tags: ["tenant:tenant-1", "campaign:campaign-1"],
        },
      },
      {
        type: "email.opened",
        data: {
          email_id: "msg-2",
          to: [{ email: "user2@example.com" }],
          tags: ["tenant:tenant-1", "campaign:campaign-1"],
        },
      },
      {
        type: "email.clicked",
        data: {
          email_id: "msg-3",
          to: [{ email: "user3@example.com" }],
          tags: ["tenant:tenant-1", "campaign:campaign-1"],
          link: "https://example.com",
        },
      },
    ];

    const results = payloads
      .map(processWebhookPayload)
      .filter((result): result is ProcessedEmailEvent => result !== null);

    expect(results).toHaveLength(3);
    expect(results[0].eventType).toBe("delivered");
    expect(results[1].eventType).toBe("opened");
    expect(results[2].eventType).toBe("clicked");
    expect(results[2].eventData.link).toBe("https://example.com");

    // All events should belong to the same tenant and campaign
    results.forEach((result) => {
      expect(result.tenantId).toBe("tenant-1");
      expect(result.campaignId).toBe("campaign-1");
    });
  });

  it("should filter out invalid events from batch", () => {
    const payloads: WebhookPayload[] = [
      {
        type: "email.delivered",
        data: {
          email_id: "msg-1",
          to: [{ email: "user1@example.com" }],
          tags: ["tenant:tenant-1"],
        },
      },
      {
        type: "unknown.event", // Invalid event type
        data: {
          email_id: "msg-2",
          to: [{ email: "user2@example.com" }],
          tags: ["tenant:tenant-1"],
        },
      },
      {
        type: "email.opened",
        data: {
          email_id: "msg-3",
          // Missing recipient email
          tags: ["tenant:tenant-1"],
        },
      },
      {
        type: "email.clicked",
        data: {
          email_id: "msg-4",
          to: [{ email: "user4@example.com" }],
          tags: ["tenant:tenant-1"],
        },
      },
    ];

    const results = payloads
      .map(processWebhookPayload)
      .filter((result): result is ProcessedEmailEvent => result !== null);

    // Only 2 valid events should be processed
    expect(results).toHaveLength(2);
    expect(results[0].eventType).toBe("delivered");
    expect(results[1].eventType).toBe("clicked");
  });
});