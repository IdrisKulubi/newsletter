'use client';

import { useState } from 'react';
import { NewsletterBlock } from '@/lib/db/schema/newsletters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { AssetUpload } from './asset-upload';

interface BlockEditorProps {
  block: NewsletterBlock;
  onUpdate: (updates: Partial<NewsletterBlock>) => void;
  tenantId: string;
}

export function BlockEditor({ block, onUpdate, tenantId }: BlockEditorProps) {
  const [activeTab, setActiveTab] = useState('content');

  const updateContent = (updates: Record<string, any>) => {
    onUpdate({
      content: { ...block.content, ...updates }
    });
  };

  const updateStyling = (updates: Record<string, any>) => {
    onUpdate({
      styling: { ...block.styling, ...updates }
    });
  };

  const renderContentEditor = () => {
    switch (block.type) {
      case 'text':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="text-content">Text Content</Label>
              <Textarea
                id="text-content"
                value={block.content.text || ''}
                onChange={(e) => updateContent({ text: e.target.value })}
                placeholder="Enter your text here..."
                rows={6}
              />
            </div>
          </div>
        );

      case 'heading':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="heading-text">Heading Text</Label>
              <Input
                id="heading-text"
                value={block.content.text || ''}
                onChange={(e) => updateContent({ text: e.target.value })}
                placeholder="Your heading"
              />
            </div>
            <div>
              <Label htmlFor="heading-level">Heading Level</Label>
              <Select
                value={String(block.content.level || 2)}
                onValueChange={(value) => updateContent({ level: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">H1</SelectItem>
                  <SelectItem value="2">H2</SelectItem>
                  <SelectItem value="3">H3</SelectItem>
                  <SelectItem value="4">H4</SelectItem>
                  <SelectItem value="5">H5</SelectItem>
                  <SelectItem value="6">H6</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-4">
            <div>
              <Label>Image Upload</Label>
              <AssetUpload
                tenantId={tenantId}
                onUploadComplete={(url: string) => updateContent({ src: url })}
                accept="image/*"
                maxSize={5 * 1024 * 1024} // 5MB
              />
            </div>
            {block.content.src && (
              <>
                <div>
                  <Label htmlFor="image-alt">Alt Text</Label>
                  <Input
                    id="image-alt"
                    value={block.content.alt || ''}
                    onChange={(e) => updateContent({ alt: e.target.value })}
                    placeholder="Describe the image"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="image-width">Width (px)</Label>
                    <Input
                      id="image-width"
                      type="number"
                      value={block.content.width || ''}
                      onChange={(e) => updateContent({ width: parseInt(e.target.value) || undefined })}
                      placeholder="600"
                    />
                  </div>
                  <div>
                    <Label htmlFor="image-height">Height (px)</Label>
                    <Input
                      id="image-height"
                      type="number"
                      value={block.content.height || ''}
                      onChange={(e) => updateContent({ height: parseInt(e.target.value) || undefined })}
                      placeholder="400"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="image-link">Link URL (optional)</Label>
                  <Input
                    id="image-link"
                    type="url"
                    value={block.content.link || ''}
                    onChange={(e) => updateContent({ link: e.target.value })}
                    placeholder="https://example.com"
                  />
                </div>
              </>
            )}
          </div>
        );

      case 'button':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="button-text">Button Text</Label>
              <Input
                id="button-text"
                value={block.content.text || ''}
                onChange={(e) => updateContent({ text: e.target.value })}
                placeholder="Click Here"
              />
            </div>
            <div>
              <Label htmlFor="button-url">Button URL</Label>
              <Input
                id="button-url"
                type="url"
                value={block.content.url || ''}
                onChange={(e) => updateContent({ url: e.target.value })}
                placeholder="https://example.com"
              />
            </div>
            <div>
              <Label htmlFor="button-variant">Button Style</Label>
              <Select
                value={block.content.variant || 'primary'}
                onValueChange={(value) => updateContent({ variant: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="outline">Outline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'social':
        return (
          <div className="space-y-4">
            <div>
              <Label>Social Media Links</Label>
              <div className="space-y-2">
                {(block.content.platforms || []).map((platform: any, index: number) => (
                  <div key={index} className="flex gap-2">
                    <Select
                      value={platform.name}
                      onValueChange={(value) => {
                        const newPlatforms = [...(block.content.platforms || [])];
                        newPlatforms[index] = { ...platform, name: value };
                        updateContent({ platforms: newPlatforms });
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="twitter">Twitter</SelectItem>
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="youtube">YouTube</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={platform.url}
                      onChange={(e) => {
                        const newPlatforms = [...(block.content.platforms || [])];
                        newPlatforms[index] = { ...platform, url: e.target.value };
                        updateContent({ platforms: newPlatforms });
                      }}
                      placeholder="https://..."
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newPlatforms = (block.content.platforms || []).filter((_: any, i: number) => i !== index);
                        updateContent({ platforms: newPlatforms });
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newPlatforms = [...(block.content.platforms || []), { name: 'twitter', url: '' }];
                    updateContent({ platforms: newPlatforms });
                  }}
                >
                  Add Platform
                </Button>
              </div>
            </div>
          </div>
        );

      case 'divider':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="divider-style">Style</Label>
              <Select
                value={block.content.style || 'solid'}
                onValueChange={(value) => updateContent({ style: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Solid</SelectItem>
                  <SelectItem value="dashed">Dashed</SelectItem>
                  <SelectItem value="dotted">Dotted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="divider-color">Color</Label>
              <Input
                id="divider-color"
                type="color"
                value={block.content.color || '#e5e7eb'}
                onChange={(e) => updateContent({ color: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="divider-thickness">Thickness (px)</Label>
              <Input
                id="divider-thickness"
                type="number"
                min="1"
                max="10"
                value={block.content.thickness || 1}
                onChange={(e) => updateContent({ thickness: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>
        );

      case 'spacer':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="spacer-height">Height (px)</Label>
              <Input
                id="spacer-height"
                type="number"
                min="1"
                max="200"
                value={block.content.height || 20}
                onChange={(e) => updateContent({ height: parseInt(e.target.value) || 20 })}
              />
            </div>
          </div>
        );

      default:
        return <div>No editor available for this block type</div>;
    }
  };

  const renderStylingEditor = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="bg-color">Background Color</Label>
          <Input
            id="bg-color"
            type="color"
            value={block.styling?.backgroundColor || '#ffffff'}
            onChange={(e) => updateStyling({ backgroundColor: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="text-color">Text Color</Label>
          <Input
            id="text-color"
            type="color"
            value={block.styling?.textColor || '#000000'}
            onChange={(e) => updateStyling({ textColor: e.target.value })}
          />
        </div>
      </div>
      
      <div>
        <Label htmlFor="text-align">Text Alignment</Label>
        <Select
          value={block.styling?.textAlign || 'left'}
          onValueChange={(value) => updateStyling({ textAlign: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="font-size">Font Size</Label>
          <Input
            id="font-size"
            value={block.styling?.fontSize || ''}
            onChange={(e) => updateStyling({ fontSize: e.target.value })}
            placeholder="16px"
          />
        </div>
        <div>
          <Label htmlFor="font-weight">Font Weight</Label>
          <Select
            value={block.styling?.fontWeight || 'normal'}
            onValueChange={(value) => updateStyling({ fontWeight: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="bold">Bold</SelectItem>
              <SelectItem value="lighter">Lighter</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="padding">Padding</Label>
          <Input
            id="padding"
            value={block.styling?.padding || ''}
            onChange={(e) => updateStyling({ padding: e.target.value })}
            placeholder="16px"
          />
        </div>
        <div>
          <Label htmlFor="margin">Margin</Label>
          <Input
            id="margin"
            value={block.styling?.margin || ''}
            onChange={(e) => updateStyling({ margin: e.target.value })}
            placeholder="8px"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="border-radius">Border Radius</Label>
          <Input
            id="border-radius"
            value={block.styling?.borderRadius || ''}
            onChange={(e) => updateStyling({ borderRadius: e.target.value })}
            placeholder="4px"
          />
        </div>
        <div>
          <Label htmlFor="border">Border</Label>
          <Input
            id="border"
            value={block.styling?.border || ''}
            onChange={(e) => updateStyling({ border: e.target.value })}
            placeholder="1px solid #ccc"
          />
        </div>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg capitalize">{block.type} Block</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="styling">Styling</TabsTrigger>
          </TabsList>
          <TabsContent value="content" className="mt-4">
            {renderContentEditor()}
          </TabsContent>
          <TabsContent value="styling" className="mt-4">
            {renderStylingEditor()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}