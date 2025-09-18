import { render } from '@react-email/render';
import { Newsletter } from '@/lib/db/schema/newsletters';
import { NewsletterTemplate } from './templates/newsletter-template';

export interface RenderOptions {
  previewText?: string;
  unsubscribeUrl?: string;
  webViewUrl?: string;
  personalizations?: Record<string, string>;
}

export interface RenderedNewsletter {
  html: string;
  text: string;
  subject: string;
}

export class NewsletterRenderer {
  /**
   * Render newsletter to HTML and text formats
   */
  static async render(
    newsletter: Newsletter,
    options: RenderOptions = {}
  ): Promise<RenderedNewsletter> {
    try {
      // Apply personalizations to content
      const personalizedNewsletter = this.applyPersonalizations(newsletter, options.personalizations);

      // Render HTML
      const html = await render(
        NewsletterTemplate({
          newsletter: personalizedNewsletter,
          previewText: options.previewText || newsletter.metadata?.previewText,
          unsubscribeUrl: options.unsubscribeUrl,
          webViewUrl: options.webViewUrl,
        })
      );

      // Generate text version
      const text = this.generateTextVersion(personalizedNewsletter);

      // Generate subject line
      const subject = this.generateSubject(newsletter, options.personalizations);

      return {
        html,
        text,
        subject,
      };
    } catch (error) {
      console.error('Failed to render newsletter:', error);
      throw new Error('Failed to render newsletter template');
    }
  }

  /**
   * Apply personalizations to newsletter content
   */
  private static applyPersonalizations(
    newsletter: Newsletter,
    personalizations: Record<string, string> = {}
  ): Newsletter {
    if (Object.keys(personalizations).length === 0) {
      return newsletter;
    }

    // Clone the newsletter to avoid mutations
    const personalizedNewsletter = JSON.parse(JSON.stringify(newsletter));

    // Apply personalizations to blocks
    personalizedNewsletter.content.blocks = personalizedNewsletter.content.blocks.map((block: any) => {
      const personalizedBlock = { ...block };

      // Apply personalizations to text content
      if (block.type === 'text' || block.type === 'heading') {
        if (personalizedBlock.content.text) {
          personalizedBlock.content.text = this.replacePlaceholders(
            personalizedBlock.content.text,
            personalizations
          );
        }
        if (personalizedBlock.content.html) {
          personalizedBlock.content.html = this.replacePlaceholders(
            personalizedBlock.content.html,
            personalizations
          );
        }
      }

      // Apply personalizations to button text
      if (block.type === 'button' && personalizedBlock.content.text) {
        personalizedBlock.content.text = this.replacePlaceholders(
          personalizedBlock.content.text,
          personalizations
        );
      }

      return personalizedBlock;
    });

    return personalizedNewsletter;
  }

  /**
   * Replace placeholders in text with personalizations
   */
  private static replacePlaceholders(
    text: string,
    personalizations: Record<string, string>
  ): string {
    let result = text;
    
    Object.entries(personalizations).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      result = result.replace(placeholder, value);
    });

    return result;
  }

  /**
   * Generate text version of newsletter
   */
  private static generateTextVersion(newsletter: Newsletter): string {
    const lines: string[] = [];

    // Add title
    if (newsletter.title) {
      lines.push(newsletter.title.toUpperCase());
      lines.push('='.repeat(newsletter.title.length));
      lines.push('');
    }

    // Process blocks
    newsletter.content?.blocks?.forEach((block) => {
      switch (block.type) {
        case 'text':
          if (block.content.text) {
            lines.push(this.stripHtml(block.content.text));
            lines.push('');
          }
          break;

        case 'heading':
          if (block.content.text) {
            lines.push(block.content.text.toUpperCase());
            lines.push('-'.repeat(block.content.text.length));
            lines.push('');
          }
          break;

        case 'button':
          if (block.content.text && block.content.url) {
            lines.push(`${block.content.text}: ${block.content.url}`);
            lines.push('');
          }
          break;

        case 'social':
          if (block.content.platforms && block.content.platforms.length > 0) {
            lines.push('Follow us:');
            block.content.platforms.forEach((platform: any) => {
              lines.push(`${platform.name}: ${platform.url}`);
            });
            lines.push('');
          }
          break;

        case 'divider':
          lines.push('---');
          lines.push('');
          break;

        case 'spacer':
          lines.push('');
          break;
      }
    });

    return lines.join('\n');
  }

  /**
   * Generate subject line with personalizations
   */
  private static generateSubject(
    newsletter: Newsletter,
    personalizations: Record<string, string> = {}
  ): string {
    let subject = newsletter.title;

    if (personalizations && Object.keys(personalizations).length > 0) {
      subject = this.replacePlaceholders(subject, personalizations);
    }

    return subject;
  }

  /**
   * Strip HTML tags from text
   */
  private static stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  /**
   * Preview newsletter in browser format
   */
  static async renderPreview(newsletter: Newsletter): Promise<string> {
    const { html } = await this.render(newsletter, {
      previewText: 'This is a preview of your newsletter',
    });

    return html;
  }

  /**
   * Validate newsletter content for rendering
   */
  static validateNewsletter(newsletter: Newsletter): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!newsletter.title || newsletter.title.trim().length === 0) {
      errors.push('Newsletter title is required');
    }

    if (!newsletter.content || !newsletter.content.blocks || newsletter.content.blocks.length === 0) {
      warnings.push('Newsletter has no content blocks');
    }

    // Validate blocks
    newsletter.content?.blocks?.forEach((block, index) => {
      switch (block.type) {
        case 'text':
        case 'heading':
          if (!block.content.text || block.content.text.trim().length === 0) {
            warnings.push(`Block ${index + 1} (${block.type}) has no text content`);
          }
          break;

        case 'image':
          if (!block.content.src) {
            errors.push(`Block ${index + 1} (image) has no source URL`);
          }
          if (!block.content.alt) {
            warnings.push(`Block ${index + 1} (image) has no alt text`);
          }
          break;

        case 'button':
          if (!block.content.text) {
            errors.push(`Block ${index + 1} (button) has no text`);
          }
          if (!block.content.url) {
            errors.push(`Block ${index + 1} (button) has no URL`);
          }
          break;

        case 'social':
          if (!block.content.platforms || block.content.platforms.length === 0) {
            warnings.push(`Block ${index + 1} (social) has no platforms configured`);
          }
          break;
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}