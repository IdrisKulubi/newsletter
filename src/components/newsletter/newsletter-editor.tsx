'use client';

import { useState, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, GripVertical, Trash2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { NewsletterBlock, NewsletterContent } from '@/lib/db/schema/newsletters';
import { BlockEditor } from './block-editor';
import { BlockToolbar } from './block-toolbar';
import { BlockRenderer } from './block-renderer';

interface NewsletterEditorProps {
  content: NewsletterContent;
  onChange: (content: NewsletterContent) => void;
  tenantId: string;
}

export function NewsletterEditor({ content, onChange, tenantId }: NewsletterEditorProps) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showBlockSelector, setShowBlockSelector] = useState(false);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;

    const newBlocks = Array.from(content.blocks);
    const [reorderedItem] = newBlocks.splice(result.source.index, 1);
    newBlocks.splice(result.destination.index, 0, reorderedItem);

    onChange({
      ...content,
      blocks: newBlocks,
    });
  }, [content, onChange]);

  const addBlock = useCallback((type: NewsletterBlock['type']) => {
    const newBlock: NewsletterBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content: getDefaultContent(type),
      styling: {},
    };

    onChange({
      ...content,
      blocks: [...content.blocks, newBlock],
    });
    setShowBlockSelector(false);
  }, [content, onChange]);

  const updateBlock = useCallback((blockId: string, updates: Partial<NewsletterBlock>) => {
    const newBlocks = content.blocks.map(block =>
      block.id === blockId ? { ...block, ...updates } : block
    );

    onChange({
      ...content,
      blocks: newBlocks,
    });
  }, [content, onChange]);

  const deleteBlock = useCallback((blockId: string) => {
    const newBlocks = content.blocks.filter(block => block.id !== blockId);
    onChange({
      ...content,
      blocks: newBlocks,
    });
    setSelectedBlockId(null);
  }, [content, onChange]);

  const duplicateBlock = useCallback((blockId: string) => {
    const blockToDuplicate = content.blocks.find(block => block.id === blockId);
    if (!blockToDuplicate) return;

    const duplicatedBlock: NewsletterBlock = {
      ...blockToDuplicate,
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    const blockIndex = content.blocks.findIndex(block => block.id === blockId);
    const newBlocks = [...content.blocks];
    newBlocks.splice(blockIndex + 1, 0, duplicatedBlock);

    onChange({
      ...content,
      blocks: newBlocks,
    });
  }, [content, onChange]);

  return (
    <div className="flex h-full">
      {/* Main Editor */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="newsletter-blocks">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-4"
                >
                  {content.blocks.map((block, index) => (
                    <Draggable key={block.id} draggableId={block.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`group relative ${
                            snapshot.isDragging ? 'opacity-50' : ''
                          } ${
                            selectedBlockId === block.id ? 'ring-2 ring-blue-500' : ''
                          }`}
                          onClick={() => setSelectedBlockId(block.id)}
                        >
                          <Card className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div
                                    {...provided.dragHandleProps}
                                    className="cursor-grab hover:cursor-grabbing"
                                  >
                                    <GripVertical className="h-4 w-4 text-gray-400" />
                                  </div>
                                  <span className="text-sm font-medium capitalize">
                                    {block.type}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      duplicateBlock(block.id);
                                    }}
                                  >
                                    Copy
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteBlock(block.id);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <BlockRenderer block={block} />
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {/* Add Block Button */}
          <div className="mt-8 text-center">
            <Dialog open={showBlockSelector} onOpenChange={setShowBlockSelector}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Block
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Block</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4">
                  {blockTypes.map((blockType) => (
                    <Button
                      key={blockType.type}
                      variant="outline"
                      className="h-20 flex-col"
                      onClick={() => addBlock(blockType.type)}
                    >
                      <div className="h-6 w-6 mb-2">{blockType.icon}</div>
                      {blockType.label}
                    </Button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Block Editor Sidebar */}
      {selectedBlockId && (
        <div className="w-80 border-l bg-gray-50 p-4 overflow-y-auto">
          <BlockEditor
            block={content.blocks.find(b => b.id === selectedBlockId)!}
            onUpdate={(updates) => updateBlock(selectedBlockId, updates)}
            tenantId={tenantId}
          />
        </div>
      )}
    </div>
  );
}

function getDefaultContent(type: NewsletterBlock['type']): Record<string, any> {
  switch (type) {
    case 'text':
      return { text: 'Enter your text here...' };
    case 'heading':
      return { text: 'Your Heading', level: 2 };
    case 'image':
      return { src: '', alt: 'Image description', width: 600, height: 400 };
    case 'button':
      return { text: 'Click Here', url: 'https://example.com', variant: 'primary' };
    case 'social':
      return { platforms: [] };
    case 'divider':
      return { style: 'solid', color: '#e5e7eb', thickness: 1 };
    case 'spacer':
      return { height: 20 };
    default:
      return {};
  }
}

const blockTypes = [
  { type: 'text' as const, label: 'Text', icon: <div className="w-6 h-6 bg-gray-300 rounded" /> },
  { type: 'heading' as const, label: 'Heading', icon: <div className="w-6 h-6 bg-gray-400 rounded" /> },
  { type: 'image' as const, label: 'Image', icon: <div className="w-6 h-6 bg-blue-300 rounded" /> },
  { type: 'button' as const, label: 'Button', icon: <div className="w-6 h-6 bg-green-300 rounded" /> },
  { type: 'social' as const, label: 'Social', icon: <div className="w-6 h-6 bg-purple-300 rounded" /> },
  { type: 'divider' as const, label: 'Divider', icon: <div className="w-6 h-1 bg-gray-300" /> },
  { type: 'spacer' as const, label: 'Spacer', icon: <div className="w-6 h-6 border-2 border-dashed border-gray-300 rounded" /> },
];