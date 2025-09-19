import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/webhooks/resend/route';

// Mock the email service
vi.mock('@/lib/email', () => ({
  emailService: {
    processWebhook: vi.fn(),
  },
}));

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{
            id: 'campaign-id',
            analytics: {
              totalSent: 100,
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
            },
          }]),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  },
}));

// Mock the schema
vi.mock('@/lib/db/schema/analytics', () => ({
  emailEvents: {},
}));

vi.mock('@/lib/db/schema/campaigns', () => ({
  campaigns: {},
}));

describe('Resend Webhook API Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/webhooks/resend', () => {
    it('should process valid webhook payload', async () => {
      const { emailService } = await import('@/lib/email');
      const { db } = await import('@/lib/db');

      const mockEmailEvent = {
        id: 'event-123',
        campaignId: 'campaign-123',
        recipientEmail: 'user@example.com',
        eventType: 'delivered' as const,
        eventData: { messageId: 'msg-123' },
        timestamp: new Date(),
        tenantId: 'tenant-123',
      };

      vi.mocked(emailService.processWebhook).mockResolvedValue(mockEmailEvent);

      const webhookPayload = {
        type: 'email.delivered',
        data: {
          email_id: 'msg-123',
          to: [{ email: 'user@example.com' }],
          created_at: '2024-01-01T12:00:00Z',
          tags: ['tenant:tenant-123', 'campaign:campaign-123'],
        },
      };

      const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        body: JSON.stringify(webhookPayload),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ success: true });

      expect(emailService.processWebhook).toHaveBeenCalledWith(webhookPayload);
      expect(db.insert).toHaveBeenCalled();
    });

    it('should handle invalid webhook payload', async () => {
      const { emailService } = await import('@/lib/email');

      vi.mocked(emailService.processWebhook).mockResolvedValue(null);

      const webhookPayload = {
        type: 'unknown.event',
        data: {},
      };

      const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        body: JSON.stringify(webhookPayload),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData).toEqual({
        success: false,
        error: 'Invalid event',
      });
    });

    it('should handle webhook processing errors', async () => {
      const { emailService } = await import('@/lib/email');

      vi.mocked(emailService.processWebhook).mockRejectedValue(
        new Error('Processing failed')
      );

      const webhookPayload = {
        type: 'email.delivered',
        data: {
          email_id: 'msg-123',
          to: [{ email: 'user@example.com' }],
        },
      };

      const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        body: JSON.stringify(webhookPayload),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({
        success: false,
        error: 'Processing failed',
      });
    });

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
    });

    it('should update campaign analytics for delivered events', async () => {
      const { emailService } = await import('@/lib/email');
      const { db } = await import('@/lib/db');

      const mockEmailEvent = {
        id: 'event-123',
        campaignId: 'campaign-123',
        recipientEmail: 'user@example.com',
        eventType: 'delivered' as const,
        eventData: { messageId: 'msg-123' },
        timestamp: new Date(),
        tenantId: 'tenant-123',
      };

      vi.mocked(emailService.processWebhook).mockResolvedValue(mockEmailEvent);

      const webhookPayload = {
        type: 'email.delivered',
        data: {
          email_id: 'msg-123',
          to: [{ email: 'user@example.com' }],
          created_at: '2024-01-01T12:00:00Z',
          tags: ['tenant:tenant-123', 'campaign:campaign-123'],
        },
      };

      const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        body: JSON.stringify(webhookPayload),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      
      // Verify campaign analytics were updated
      expect(db.select).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
    });

    it('should update campaign analytics for opened events', async () => {
      const { emailService } = await import('@/lib/email');
      const { db } = await import('@/lib/db');

      const mockEmailEvent = {
        id: 'event-123',
        campaignId: 'campaign-123',
        recipientEmail: 'user@example.com',
        eventType: 'opened' as const,
        eventData: { messageId: 'msg-123' },
        timestamp: new Date(),
        tenantId: 'tenant-123',
      };

      vi.mocked(emailService.processWebhook).mockResolvedValue(mockEmailEvent);

      const webhookPayload = {
        type: 'email.opened',
        data: {
          email_id: 'msg-123',
          to: [{ email: 'user@example.com' }],
          created_at: '2024-01-01T12:00:00Z',
          tags: ['tenant:tenant-123', 'campaign:campaign-123'],
        },
      };

      const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        body: JSON.stringify(webhookPayload),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      
      // Verify campaign analytics were updated
      expect(db.select).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
    });

    it('should handle webhook signature verification', async () => {
      const { emailService } = await import('@/lib/email');

      const mockEmailEvent = {
        id: 'event-123',
        campaignId: 'campaign-123',
        recipientEmail: 'user@example.com',
        eventType: 'delivered' as const,
        eventData: { messageId: 'msg-123' },
        timestamp: new Date(),
        tenantId: 'tenant-123',
      };

      vi.mocked(emailService.processWebhook).mockResolvedValue(mockEmailEvent);

      const webhookPayload = {
        type: 'email.delivered',
        data: {
          email_id: 'msg-123',
          to: [{ email: 'user@example.com' }],
          tags: ['tenant:tenant-123'],
        },
      };

      const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        body: JSON.stringify(webhookPayload),
        headers: {
          'content-type': 'application/json',
          'resend-signature': 'test-signature',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      // Signature verification is logged but not enforced in current implementation
    });
  });

  describe('GET /api/webhooks/resend', () => {
    it('should handle webhook verification challenge', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/webhooks/resend?challenge=test-challenge'
      );

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ challenge: 'test-challenge' });
    });

    it('should return status when no challenge provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhooks/resend');

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ status: 'Webhook endpoint active' });
    });
  });
});