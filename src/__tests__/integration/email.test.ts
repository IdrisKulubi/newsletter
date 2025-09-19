import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmailService, emailService } from '@/lib/email';
import { NewsletterRenderer } from '@/lib/email/renderer';
import { Newsletter } from '@/lib/db/schema/newsletters';

// Mock Resend
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    batch: {
      send: vi.fn(),
    },
    domains: {
      create: vi.fn(),
      get: vi.fn(),
    },
  })),
}));

// Mock config
vi.mock('@/lib/config', () => ({
  config: {
    email: {
      resendApiKey: 'test-api-key',
    },
    app: {
      url: 'http://localhost:3000',
    },
  },
}));

describe('EmailService Integration Tests', () => {
  let mockNewsletter: Newsletter;

  beforeEach(() => {
    mockNewsletter = {
      id: 'test-newsletter-id',
      tenantId: 'test-tenant-id',
      title: 'Test Newsletter',
      content: {
        blocks: [
          {
            id: 'block-1',
            type: 'text',
            content: {
              text: 'Hello {{firstName}}, this is a test newsletter!',
            },
            styling: {},
          },
          {
            id: 'block-2',
            type: 'button',
            content: {
              text: 'Click Here',
              url: 'https://example.com',
            },
            styling: {},
          },
        ],
        globalStyling: {
          fontFamily: 'Arial, sans-serif',
          primaryColor: '#007bff',
        },
      },
      template: {
        id: 'default',
        config: {
          headerStyle: 'minimal',
        },
      },
      metadata: {
        previewText: 'Test newsletter preview',
      },
      status: 'draft',
      createdBy: 'test-user',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendBatch', () => {
    it('should send emails to multiple recipients with personalizations', async () => {
      const mockResendResponse = {
        data: [
          { id: 'email-1' },
          { id: 'email-2' },
        ],
        error: null,
      };

      const mockResend = emailService['resend'];
      vi.mocked(mockResend.batch.send).mockResolvedValue(mockResendResponse);

      const recipients = [
        {
          email: 'user1@example.com',
          name: 'John Doe',
          personalizations: { firstName: 'John' },
        },
        {
          email: 'user2@example.com',
          name: 'Jane Smith',
          personalizations: { firstName: 'Jane' },
        },
      ];

      const batch = {
        recipients,
        newsletter: mockNewsletter,
        from: 'test@example.com',
        tags: ['test-campaign'],
      };

      const results = await emailService.sendBatch(batch);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        id: 'email-1',
        recipient: 'user1@example.com',
        status: 'sent',
      });
      expect(results[1]).toEqual({
        id: 'email-2',
        recipient: 'user2@example.com',
        status: 'sent',
      });

      expect(mockResend.batch.send).toHaveBeenCalledTimes(1);
    });

    it('should handle batch sending errors gracefully', async () => {
      const mockResendResponse = {
        data: null,
        error: {
          message: 'API rate limit exceeded',
        },
      };

      const mockResend = emailService['resend'];
      vi.mocked(mockResend.batch.send).mockResolvedValue(mockResendResponse);

      const recipients = [
        {
          email: 'user1@example.com',
          name: 'John Doe',
        },
      ];

      const batch = {
        recipients,
        newsletter: mockNewsletter,
        from: 'test@example.com',
      };

      const results = await emailService.sendBatch(batch);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: '',
        recipient: 'user1@example.com',
        status: 'failed',
        error: 'API rate limit exceeded',
      });
    });

    it('should split large batches into smaller chunks', async () => {
      // Mock responses for both batches
      const mockResendResponse1 = {
        data: Array.from({ length: 100 }, (_, i) => ({ id: `email-${i}` })),
        error: null,
      };
      const mockResendResponse2 = {
        data: Array.from({ length: 50 }, (_, i) => ({ id: `email-${i + 100}` })),
        error: null,
      };

      const mockResend = emailService['resend'];
      vi.mocked(mockResend.batch.send)
        .mockResolvedValueOnce(mockResendResponse1)
        .mockResolvedValueOnce(mockResendResponse2);

      // Create 150 recipients (should be split into 2 batches of 100 and 50)
      const recipients = Array.from({ length: 150 }, (_, i) => ({
        email: `user${i}@example.com`,
        name: `User ${i}`,
      }));

      const batch = {
        recipients,
        newsletter: mockNewsletter,
        from: 'test@example.com',
      };

      const results = await emailService.sendBatch(batch);

      expect(results).toHaveLength(150);
      expect(mockResend.batch.send).toHaveBeenCalledTimes(2); // Split into 2 batches
    });
  });

  describe('setupDomainAuthentication', () => {
    it('should setup domain authentication with Resend', async () => {
      const mockDomainResponse = {
        data: {
          id: 'domain-id',
          name: 'example.com',
          status: 'pending',
          records: [
            { record: 'CNAME', value: 'dkim-record-value' }
          ],
        },
        error: null,
      };

      const mockResend = emailService['resend'];
      vi.mocked(mockResend.domains.create).mockResolvedValue(mockDomainResponse);

      const result = await emailService.setupDomainAuthentication('example.com');

      expect(result).toEqual({
        domain: 'example.com',
        dkimRecord: 'dkim-record-value',
        spfRecord: 'v=spf1 include:_spf.resend.com ~all',
        dmarcRecord: 'v=DMARC1; p=none; rua=mailto:dmarc@example.com',
        status: 'pending',
      });

      expect(mockResend.domains.create).toHaveBeenCalledWith({
        name: 'example.com',
      });
    });

    it('should handle domain setup errors', async () => {
      const mockDomainResponse = {
        data: null,
        error: {
          message: 'Domain already exists',
        },
      };

      const mockResend = emailService['resend'];
      vi.mocked(mockResend.domains.create).mockResolvedValue(mockDomainResponse);

      await expect(
        emailService.setupDomainAuthentication('example.com')
      ).rejects.toThrow('Failed to create domain: Domain already exists');
    });
  });

  describe('validateDeliverability', () => {
    it('should validate domain deliverability', async () => {
      const mockDomainResponse = {
        data: {
          id: 'domain-id',
          name: 'example.com',
          status: 'verified',
        },
        error: null,
      };

      const mockResend = emailService['resend'];
      vi.mocked(mockResend.domains.get).mockResolvedValue(mockDomainResponse);

      const result = await emailService.validateDeliverability('example.com');

      expect(result).toEqual({
        domain: 'example.com',
        dkimValid: true,
        spfValid: true,
        dmarcValid: true,
        reputation: 'good',
        recommendations: [],
      });

      expect(mockResend.domains.get).toHaveBeenCalledWith('example.com');
    });

    it('should provide recommendations for unverified domains', async () => {
      const mockDomainResponse = {
        data: {
          id: 'domain-id',
          name: 'example.com',
          status: 'pending',
        },
        error: null,
      };

      const mockResend = emailService['resend'];
      vi.mocked(mockResend.domains.get).mockResolvedValue(mockDomainResponse);

      const result = await emailService.validateDeliverability('example.com');

      expect(result.reputation).toBe('poor');
      expect(result.recommendations).toContain('Configure DKIM record to improve deliverability');
      expect(result.recommendations).toContain('Configure SPF record: v=spf1 include:_spf.resend.com ~all');
    });
  });

  describe('processWebhook', () => {
    it('should process email delivered webhook', async () => {
      const webhookPayload = {
        type: 'email.delivered',
        data: {
          email_id: 'email-123',
          to: [{ email: 'user@example.com' }],
          created_at: '2024-01-01T12:00:00Z',
          tags: ['tenant:test-tenant-id', 'campaign:test-campaign-id'],
        },
      };

      const result = await emailService.processWebhook(webhookPayload);

      expect(result).toEqual({
        id: 'email-123',
        campaignId: 'test-campaign-id',
        recipientEmail: 'user@example.com',
        eventType: 'delivered',
        eventData: expect.objectContaining({
          messageId: 'email-123',
          timestamp: '2024-01-01T12:00:00Z',
        }),
        timestamp: new Date('2024-01-01T12:00:00Z'),
        tenantId: 'test-tenant-id',
      });
    });

    it('should process email opened webhook', async () => {
      const webhookPayload = {
        type: 'email.opened',
        data: {
          email_id: 'email-123',
          to: [{ email: 'user@example.com' }],
          created_at: '2024-01-01T12:00:00Z',
          user_agent: 'Mozilla/5.0...',
          ip: '192.168.1.1',
          tags: ['tenant:test-tenant-id'],
        },
      };

      const result = await emailService.processWebhook(webhookPayload);

      expect(result?.eventType).toBe('opened');
      expect(result?.eventData.userAgent).toBe('Mozilla/5.0...');
      expect(result?.eventData.ip).toBe('192.168.1.1');
    });

    it('should process email clicked webhook', async () => {
      const webhookPayload = {
        type: 'email.clicked',
        data: {
          email_id: 'email-123',
          to: [{ email: 'user@example.com' }],
          created_at: '2024-01-01T12:00:00Z',
          link: 'https://example.com/clicked-link',
          tags: ['tenant:test-tenant-id'],
        },
      };

      const result = await emailService.processWebhook(webhookPayload);

      expect(result?.eventType).toBe('clicked');
      expect(result?.eventData.link).toBe('https://example.com/clicked-link');
    });

    it('should return null for unknown webhook types', async () => {
      const webhookPayload = {
        type: 'unknown.event',
        data: {
          email_id: 'email-123',
        },
      };

      const result = await emailService.processWebhook(webhookPayload);

      expect(result).toBeNull();
    });

    it('should return null when tenant ID is missing', async () => {
      const webhookPayload = {
        type: 'email.delivered',
        data: {
          email_id: 'email-123',
          to: [{ email: 'user@example.com' }],
          created_at: '2024-01-01T12:00:00Z',
          // No tenant ID in tags or headers
        },
      };

      const result = await emailService.processWebhook(webhookPayload);

      expect(result).toBeNull();
    });
  });

  describe('URL generation', () => {
    it('should generate correct unsubscribe URLs', () => {
      const email = 'user@example.com';
      const tenantId = 'test-tenant-id';
      
      const url = emailService['generateUnsubscribeUrl'](email, tenantId);
      
      expect(url).toMatch(/^http:\/\/localhost:3000\/unsubscribe\?token=/);
      
      // Decode the token to verify it contains the email and tenant ID
      const token = url.split('token=')[1];
      const decoded = Buffer.from(token, 'base64').toString();
      expect(decoded).toBe(`${email}:${tenantId}`);
    });

    it('should generate correct web view URLs', () => {
      const newsletterId = 'test-newsletter-id';
      
      const url = emailService['generateWebViewUrl'](newsletterId);
      
      expect(url).toBe('http://localhost:3000/newsletter/test-newsletter-id/view');
    });
  });

  describe('tenant and campaign ID extraction', () => {
    it('should extract tenant ID from tags', () => {
      const data = {
        tags: ['tenant:test-tenant-id', 'campaign:test-campaign-id'],
      };

      const tenantId = emailService['extractTenantId'](data);
      const campaignId = emailService['extractCampaignId'](data);

      expect(tenantId).toBe('test-tenant-id');
      expect(campaignId).toBe('test-campaign-id');
    });

    it('should extract tenant ID from headers', () => {
      const data = {
        headers: {
          'X-Tenant-ID': 'test-tenant-id',
          'X-Campaign-ID': 'test-campaign-id',
        },
      };

      const tenantId = emailService['extractTenantId'](data);
      const campaignId = emailService['extractCampaignId'](data);

      expect(tenantId).toBe('test-tenant-id');
      expect(campaignId).toBe('test-campaign-id');
    });

    it('should return null when IDs are not found', () => {
      const data = {
        tags: ['other-tag'],
        headers: {},
      };

      const tenantId = emailService['extractTenantId'](data);
      const campaignId = emailService['extractCampaignId'](data);

      expect(tenantId).toBeNull();
      expect(campaignId).toBeNull();
    });
  });
});