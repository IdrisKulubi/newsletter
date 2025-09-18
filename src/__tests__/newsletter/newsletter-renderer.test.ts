import { describe, it, expect, vi } from 'vitest';
import { NewsletterRenderer } from '@/lib/email/renderer';
import { Newsletter } from '@/lib/db/schema/newsletters';

// Mock react-email render function
vi.mock('@react-email/render', () => ({
  render: vi.fn((component) => '<html>Mocked HTML</html>'),
}));

const mockNewsletter: Newsletter = {
  id: 'newsletter-123',
  tenantId: 'tenant-123',
  title: 'Test Newsletter',
  content: {
    blocks: [
      {
        id: 'block-1',
        type: 'heading',
        content: { text: 'Welcome to Our Newsletter', level: 1 },
        styling: {},
      },
      {
        id: 'block-2',
        type: 'text',
        content: { text: 'This is a test newsletter with {{firstName}} personalization.' },
        styling: {},
      },
      {
        id: 'block-3',
        type: 'button',
        content: { text: 'Click Here', url: 'https://example.com' },
        styling: {},
      },
      {
        id: 'block-4',
        type: 'image',
        content: { src: 'https://example.com/image.jpg', alt: 'Test Image' },
        styling: {},
      },
    ],
  },
  template: null,
  metadata: { previewText: 'Test preview' },
  status: 'draft',
  createdBy: 'user-123',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('NewsletterRenderer', () => {
  describe('render', () => {
    it('should render newsletter to HTML and text', async () => {
      const result = await NewsletterRenderer.render(mockNewsletter);

      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('subject');
      expect(result.html).toBe('<html>Mocked HTML</html>');
      expect(result.subject).toBe('Test Newsletter');
    });

    it('should apply personalizations', async () => {
      const personalizations = {
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = await NewsletterRenderer.render(mockNewsletter, {
        personalizations,
      });

      expect(result.text).toContain('John');
      expect(result.text).not.toContain('{{firstName}}');
    });

    it('should include preview text and URLs in options', async () => {
      const options = {
        previewText: 'Custom preview',
        unsubscribeUrl: 'https://example.com/unsubscribe',
        webViewUrl: 'https://example.com/view',
      };

      const result = await NewsletterRenderer.render(mockNewsletter, options);

      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('text');
    });
  });

  describe('generateTextVersion', () => {
    it('should generate proper text version', async () => {
      const result = await NewsletterRenderer.render(mockNewsletter);

      expect(result.text).toContain('TEST NEWSLETTER');
      expect(result.text).toContain('WELCOME TO OUR NEWSLETTER');
      expect(result.text).toContain('This is a test newsletter');
      expect(result.text).toContain('Click Here: https://example.com');
    });

    it('should handle different block types in text version', async () => {
      const newsletterWithDivider: Newsletter = {
        ...mockNewsletter,
        content: {
          blocks: [
            {
              id: 'block-1',
              type: 'text',
              content: { text: 'First paragraph' },
              styling: {},
            },
            {
              id: 'block-2',
              type: 'divider',
              content: {},
              styling: {},
            },
            {
              id: 'block-3',
              type: 'text',
              content: { text: 'Second paragraph' },
              styling: {},
            },
            {
              id: 'block-4',
              type: 'social',
              content: {
                platforms: [
                  { name: 'twitter', url: 'https://twitter.com/example' },
                  { name: 'facebook', url: 'https://facebook.com/example' },
                ],
              },
              styling: {},
            },
          ],
        },
      };

      const result = await NewsletterRenderer.render(newsletterWithDivider);

      expect(result.text).toContain('First paragraph');
      expect(result.text).toContain('---');
      expect(result.text).toContain('Second paragraph');
      expect(result.text).toContain('Follow us:');
      expect(result.text).toContain('twitter: https://twitter.com/example');
    });
  });

  describe('replacePlaceholders', () => {
    it('should replace placeholders with personalizations', async () => {
      const newsletterWithPlaceholders: Newsletter = {
        ...mockNewsletter,
        title: 'Hello {{firstName}} {{lastName}}',
        content: {
          blocks: [
            {
              id: 'block-1',
              type: 'text',
              content: { text: 'Dear {{firstName}}, welcome to {{companyName}}!' },
              styling: {},
            },
          ],
        },
      };

      const personalizations = {
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Acme Corp',
      };

      const result = await NewsletterRenderer.render(newsletterWithPlaceholders, {
        personalizations,
      });

      expect(result.subject).toBe('Hello John Doe');
      expect(result.text).toContain('Dear John, welcome to Acme Corp!');
    });

    it('should handle case-insensitive placeholders', async () => {
      const newsletterWithPlaceholders: Newsletter = {
        ...mockNewsletter,
        content: {
          blocks: [
            {
              id: 'block-1',
              type: 'text',
              content: { text: 'Hello {{FIRSTNAME}} and {{ lastName }}!' },
              styling: {},
            },
          ],
        },
      };

      const personalizations = {
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = await NewsletterRenderer.render(newsletterWithPlaceholders, {
        personalizations,
      });

      expect(result.text).toContain('Hello John and Doe!');
    });
  });

  describe('stripHtml', () => {
    it('should strip HTML tags from text', async () => {
      const newsletterWithHtml: Newsletter = {
        ...mockNewsletter,
        content: {
          blocks: [
            {
              id: 'block-1',
              type: 'text',
              content: { 
                text: '<p>This is <strong>bold</strong> and <em>italic</em> text with <a href="#">a link</a>.</p>' 
              },
              styling: {},
            },
          ],
        },
      };

      const result = await NewsletterRenderer.render(newsletterWithHtml);

      expect(result.text).toContain('This is bold and italic text with a link.');
      expect(result.text).not.toContain('<p>');
      expect(result.text).not.toContain('<strong>');
      expect(result.text).not.toContain('<a href="#">');
    });

    it('should decode HTML entities', async () => {
      const newsletterWithEntities: Newsletter = {
        ...mockNewsletter,
        content: {
          blocks: [
            {
              id: 'block-1',
              type: 'text',
              content: { text: 'AT&amp;T &lt;Company&gt; &quot;Quote&quot; &#39;Apostrophe&#39;' },
              styling: {},
            },
          ],
        },
      };

      const result = await NewsletterRenderer.render(newsletterWithEntities);

      expect(result.text).toContain('AT&T <Company> "Quote" \'Apostrophe\'');
    });
  });

  describe('validateNewsletter', () => {
    it('should validate a valid newsletter', () => {
      const result = NewsletterRenderer.validateNewsletter(mockNewsletter);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing title', () => {
      const invalidNewsletter: Newsletter = {
        ...mockNewsletter,
        title: '',
      };

      const result = NewsletterRenderer.validateNewsletter(invalidNewsletter);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Newsletter title is required');
    });

    it('should detect empty content', () => {
      const emptyNewsletter: Newsletter = {
        ...mockNewsletter,
        content: { blocks: [] },
      };

      const result = NewsletterRenderer.validateNewsletter(emptyNewsletter);

      expect(result.warnings).toContain('Newsletter has no content blocks');
    });

    it('should validate block content', () => {
      const invalidNewsletter: Newsletter = {
        ...mockNewsletter,
        content: {
          blocks: [
            {
              id: 'block-1',
              type: 'text',
              content: { text: '' },
              styling: {},
            },
            {
              id: 'block-2',
              type: 'image',
              content: { src: '', alt: '' },
              styling: {},
            },
            {
              id: 'block-3',
              type: 'button',
              content: { text: '', url: '' },
              styling: {},
            },
          ],
        },
      };

      const result = NewsletterRenderer.validateNewsletter(invalidNewsletter);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Block 2 (image) has no source URL');
      expect(result.errors).toContain('Block 3 (button) has no text');
      expect(result.errors).toContain('Block 3 (button) has no URL');
      expect(result.warnings).toContain('Block 1 (text) has no text content');
      expect(result.warnings).toContain('Block 2 (image) has no alt text');
    });
  });

  describe('renderPreview', () => {
    it('should render preview with default preview text', async () => {
      const result = await NewsletterRenderer.renderPreview(mockNewsletter);

      expect(result).toBe('<html>Mocked HTML</html>');
    });
  });
});