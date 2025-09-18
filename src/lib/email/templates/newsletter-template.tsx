import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Img,
  Link,
  Button,
  Hr,
  Preview,
} from '@react-email/components';
import { Newsletter, NewsletterBlock } from '@/lib/db/schema/newsletters';

interface NewsletterTemplateProps {
  newsletter: Newsletter;
  previewText?: string;
  unsubscribeUrl?: string;
  webViewUrl?: string;
}

export function NewsletterTemplate({
  newsletter,
  previewText,
  unsubscribeUrl,
  webViewUrl,
}: NewsletterTemplateProps) {
  const { content, template } = newsletter;
  const globalStyling = content?.globalStyling || {};

  const containerStyle = {
    fontFamily: globalStyling.fontFamily || 'Arial, sans-serif',
    backgroundColor: globalStyling.backgroundColor || '#ffffff',
    color: globalStyling.primaryColor || '#000000',
  };

  return (
    <Html>
      <Head />
      {previewText && <Preview>{previewText}</Preview>}
      <Body style={{ margin: 0, padding: 0, backgroundColor: '#f6f6f6' }}>
        <Container
          style={{
            ...containerStyle,
            maxWidth: '600px',
            margin: '0 auto',
            padding: '20px',
          }}
        >
          {/* Header */}
          {template?.config.headerStyle !== 'minimal' && (
            <Section style={{ marginBottom: '20px', textAlign: 'center' }}>
              {webViewUrl && (
                <Text style={{ fontSize: '12px', color: '#666666', marginBottom: '10px' }}>
                  Having trouble viewing this email?{' '}
                  <Link href={webViewUrl} style={{ color: globalStyling.primaryColor || '#007bff' }}>
                    View in browser
                  </Link>
                </Text>
              )}
            </Section>
          )}

          {/* Newsletter Content */}
          <Section>
            {content?.blocks?.map((block, index) => (
              <div key={block.id || index}>
                {renderBlock(block, globalStyling)}
              </div>
            )) || null}
          </Section>

          {/* Footer */}
          <Section style={{ marginTop: '40px', borderTop: '1px solid #e6e6e6', paddingTop: '20px' }}>
            <Text style={{ fontSize: '12px', color: '#666666', textAlign: 'center' }}>
              You received this email because you subscribed to our newsletter.
            </Text>
            {unsubscribeUrl && (
              <Text style={{ fontSize: '12px', color: '#666666', textAlign: 'center', marginTop: '10px' }}>
                <Link href={unsubscribeUrl} style={{ color: '#666666' }}>
                  Unsubscribe
                </Link>
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function renderBlock(block: NewsletterBlock, globalStyling: any) {
  const blockStyle = {
    backgroundColor: block.styling?.backgroundColor,
    color: block.styling?.textColor,
    fontSize: block.styling?.fontSize,
    fontWeight: block.styling?.fontWeight,
    textAlign: block.styling?.textAlign as any,
    padding: block.styling?.padding || '10px 0',
    margin: block.styling?.margin,
    borderRadius: block.styling?.borderRadius,
    border: block.styling?.border,
  };

  switch (block.type) {
    case 'text':
      return (
        <Text style={blockStyle}>
          {block.content.html ? (
            <div dangerouslySetInnerHTML={{ __html: block.content.html }} />
          ) : (
            block.content.text || ''
          )}
        </Text>
      );

    case 'heading':
      const HeadingComponent = block.content.level === 1 ? 'h1' : 
                              block.content.level === 3 ? 'h3' : 
                              block.content.level === 4 ? 'h4' : 
                              block.content.level === 5 ? 'h5' : 
                              block.content.level === 6 ? 'h6' : 'h2';
      
      return (
        <Text
          style={{
            ...blockStyle,
            fontSize: block.content.level === 1 ? '32px' : 
                     block.content.level === 2 ? '28px' : 
                     block.content.level === 3 ? '24px' : 
                     block.content.level === 4 ? '20px' : 
                     block.content.level === 5 ? '18px' : '16px',
            fontWeight: 'bold',
            margin: '20px 0 10px 0',
          }}
        >
          {block.content.text || ''}
        </Text>
      );

    case 'image':
      if (!block.content.src) return null;
      
      const imageElement = (
        <Img
          src={block.content.src}
          alt={block.content.alt || ''}
          width={block.content.width || 600}
          height={block.content.height || 400}
          style={{
            maxWidth: '100%',
            height: 'auto',
            borderRadius: block.styling?.borderRadius,
            border: block.styling?.border,
          }}
        />
      );

      return (
        <Section style={{ ...blockStyle, textAlign: 'center' }}>
          {block.content.link ? (
            <Link href={block.content.link}>
              {imageElement}
            </Link>
          ) : (
            imageElement
          )}
        </Section>
      );

    case 'button':
      return (
        <Section style={{ ...blockStyle, textAlign: 'center' }}>
          <Button
            href={block.content.url || '#'}
            style={{
              backgroundColor: getButtonColor(block.content.variant, globalStyling),
              color: getButtonTextColor(block.content.variant),
              padding: '12px 24px',
              borderRadius: '4px',
              textDecoration: 'none',
              fontWeight: 'bold',
              display: 'inline-block',
              border: block.content.variant === 'outline' ? '2px solid ' + (globalStyling.primaryColor || '#007bff') : 'none',
            }}
          >
            {block.content.text || 'Click Here'}
          </Button>
        </Section>
      );

    case 'social':
      if (!block.content.platforms || block.content.platforms.length === 0) return null;
      
      return (
        <Section style={{ ...blockStyle, textAlign: 'center' }}>
          {block.content.platforms.map((platform: any, index: number) => (
            <Link
              key={index}
              href={platform.url}
              style={{
                color: globalStyling.primaryColor || '#007bff',
                textDecoration: 'none',
                margin: '0 10px',
                textTransform: 'capitalize',
              }}
            >
              {platform.name}
            </Link>
          ))}
        </Section>
      );

    case 'divider':
      return (
        <Hr
          style={{
            ...blockStyle,
            borderColor: block.content.color || '#e6e6e6',
            borderWidth: `${block.content.thickness || 1}px`,
            borderStyle: block.content.style || 'solid',
            margin: '20px 0',
          }}
        />
      );

    case 'spacer':
      return (
        <Section
          style={{
            height: `${block.content.height || 20}px`,
            lineHeight: `${block.content.height || 20}px`,
          }}
        >
          &nbsp;
        </Section>
      );

    default:
      return null;
  }
}

function getButtonColor(variant: string | undefined, globalStyling: any): string {
  switch (variant) {
    case 'secondary':
      return globalStyling.secondaryColor || '#6c757d';
    case 'outline':
      return 'transparent';
    default:
      return globalStyling.primaryColor || '#007bff';
  }
}

function getButtonTextColor(variant: string | undefined): string {
  switch (variant) {
    case 'outline':
      return '#007bff';
    default:
      return '#ffffff';
  }
}