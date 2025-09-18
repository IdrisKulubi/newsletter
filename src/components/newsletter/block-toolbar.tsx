'use client';

import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Link,
  Image,
  Type,
  Palette
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface BlockToolbarProps {
  onFormatText?: (format: string) => void;
  onAlignText?: (alignment: 'left' | 'center' | 'right') => void;
  onInsertLink?: () => void;
  onInsertImage?: () => void;
  onChangeColor?: () => void;
}

export function BlockToolbar({
  onFormatText,
  onAlignText,
  onInsertLink,
  onInsertImage,
  onChangeColor,
}: BlockToolbarProps) {
  return (
    <div className="flex items-center gap-1 p-2 border rounded-md bg-white shadow-sm">
      {/* Text Formatting */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFormatText?.('bold')}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFormatText?.('italic')}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFormatText?.('underline')}
        >
          <Underline className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Text Alignment */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAlignText?.('left')}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAlignText?.('center')}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAlignText?.('right')}
        >
          <AlignRight className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Insert Elements */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onInsertLink}
        >
          <Link className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onInsertImage}
        >
          <Image className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Styling */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onChangeColor}
        >
          <Palette className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}