'use client';

import React from 'react';
import { NewsletterBlock } from '@/lib/db/schema/newsletters';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';

interface BlockRendererProps {
  block: NewsletterBlock;
  isPreview?: boolean;
}

export function BlockRenderer({ block, isPreview = false }: BlockRendererProps) {
  const style = block.styling ? {
    backgroundColor: block.styling.backgroundColor,
    color: block.styling.textColor,
    fontSize: block.styling.fontSize,
    fontWeight: block.styling.fontWeight,
    textAlign: block.styling.textAlign as any,
    padding: block.styling.padding,
    margin: block.styling.margin,
    borderRadius: block.styling.borderRadius,
    border: block.styling.border,
  } : {};

  switch (block.type) {
    case 'text':
      return (
        <div style={style} className="prose max-w-none">
          {block.content.html ? (
            <div dangerouslySetInnerHTML={{ __html: block.content.html }} />
          ) : (
            <p>{block.content.text || 'Enter your text here...'}</p>
          )}
        </div>
      );

    case 'heading':
      const level = block.content.level || 2;
      const HeadingComponent = level === 1 ? 'h1' : 
                              level === 2 ? 'h2' : 
                              level === 3 ? 'h3' : 
                              level === 4 ? 'h4' : 
                              level === 5 ? 'h5' : 'h6';
      
      return React.createElement(HeadingComponent, {
        style,
        className: "font-bold"
      }, block.content.text || 'Your Heading');

    case 'image':
      if (!block.content.src) {
        return (
          <div 
            style={style}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500"
          >
            Click to add an image
          </div>
        );
      }
      return (
        <div style={style} className="text-center">
          <Image
            src={block.content.src}
            alt={block.content.alt || ''}
            width={block.content.width || 600}
            height={block.content.height || 400}
            className="mx-auto rounded-lg"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        </div>
      );

    case 'button':
      return (
        <div style={style} className="text-center">
          <Button
            variant={block.content.variant || 'default'}
            asChild={isPreview}
            className="inline-block"
          >
            {isPreview ? (
              <a href={block.content.url} target="_blank" rel="noopener noreferrer">
                {block.content.text || 'Click Here'}
              </a>
            ) : (
              <span>{block.content.text || 'Click Here'}</span>
            )}
          </Button>
        </div>
      );

    case 'social':
      if (!block.content.platforms || block.content.platforms.length === 0) {
        return (
          <div style={style} className="text-center text-gray-500">
            Add social media links
          </div>
        );
      }
      return (
        <div style={style} className="flex justify-center gap-4">
          {block.content.platforms.map((platform: any, index: number) => (
            <a
              key={index}
              href={platform.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 capitalize"
            >
              {platform.name}
            </a>
          ))}
        </div>
      );

    case 'divider':
      return (
        <div style={style}>
          <Separator 
            className="my-4"
            style={{
              backgroundColor: block.content.color || '#e5e7eb',
              height: `${block.content.thickness || 1}px`,
              borderStyle: block.content.style || 'solid',
            }}
          />
        </div>
      );

    case 'spacer':
      return (
        <div 
          style={{
            ...style,
            height: `${block.content.height || 20}px`,
          }}
          className="w-full"
        />
      );

    default:
      return (
        <div style={style} className="text-gray-500 italic">
          Unknown block type: {block.type}
        </div>
      );
  }
}