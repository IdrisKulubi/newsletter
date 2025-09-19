'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { NewsletterEditor } from './newsletter-editor';
import { NewsletterContent } from '@/lib/db/schema/newsletters';
import { Save, Eye, Send, ArrowLeft, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface NewsletterData {
  title: string;
  description: string;
  content: NewsletterContent;
  status: 'draft' | 'review' | 'approved';
}

export function NewsletterEditorPage() {
  const router = useRouter();
  const [newsletter, setNewsletter] = useState<NewsletterData>({
    title: '',
    description: '',
    content: {
      blocks: [],
      settings: {
        theme: 'default',
        layout: 'single-column',
      },
    },
    status: 'draft',
  });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('editor');

  const handleSave = async (status: 'draft' | 'review' = 'draft') => {
    if (!newsletter.title.trim()) {
      toast.error('Please enter a newsletter title');
      return;
    }

    setSaving(true);
    try {
      // In real app, this would call a server action
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      setNewsletter(prev => ({ ...prev, status }));
      toast.success(
        status === 'draft' 
          ? 'Newsletter saved as draft' 
          : 'Newsletter submitted for review'
      );
      
      if (status === 'review') {
        router.push('/dashboard/newsletters');
      }
    } catch (error) {
      toast.error('Failed to save newsletter');
    } finally {
      setSaving(false);
    }
  };

  const handleAIAssist = async () => {
    toast.info('AI content generation coming soon!');
  };

  const handlePreview = () => {
    setActiveTab('preview');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create Newsletter</h1>
            <p className="text-muted-foreground">
              Design and create your newsletter content
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline">{newsletter.status}</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAIAssist}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            AI Assist
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSave('draft')}
            disabled={saving}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button
            onClick={() => handleSave('review')}
            disabled={saving || !newsletter.title.trim()}
          >
            <Send className="h-4 w-4 mr-2" />
            Submit for Review
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Newsletter Settings */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Newsletter Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={newsletter.title}
                      onChange={(e) => setNewsletter(prev => ({ 
                        ...prev, 
                        title: e.target.value 
                      }))}
                      placeholder="Enter newsletter title..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newsletter.description}
                      onChange={(e) => setNewsletter(prev => ({ 
                        ...prev, 
                        description: e.target.value 
                      }))}
                      placeholder="Brief description of this newsletter..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Badge variant="outline">{newsletter.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Content Editor */}
            <div className="lg:col-span-3">
              <Card className="h-[800px]">
                <CardHeader>
                  <CardTitle>Content Editor</CardTitle>
                </CardHeader>
                <CardContent className="p-0 h-full">
                  <NewsletterEditor
                    content={newsletter.content}
                    onChange={(content) => setNewsletter(prev => ({ 
                      ...prev, 
                      content 
                    }))}
                    tenantId="current-tenant" // In real app, get from context
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Newsletter Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={newsletter.content.settings?.theme || 'default'}
                    onChange={(e) => setNewsletter(prev => ({
                      ...prev,
                      content: {
                        ...prev.content,
                        settings: {
                          ...prev.content.settings,
                          theme: e.target.value,
                        },
                      },
                    }))}
                  >
                    <option value="default">Default</option>
                    <option value="modern">Modern</option>
                    <option value="classic">Classic</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Layout</Label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={newsletter.content.settings?.layout || 'single-column'}
                    onChange={(e) => setNewsletter(prev => ({
                      ...prev,
                      content: {
                        ...prev.content,
                        settings: {
                          ...prev.content.settings,
                          layout: e.target.value,
                        },
                      },
                    }))}
                  >
                    <option value="single-column">Single Column</option>
                    <option value="two-column">Two Column</option>
                    <option value="three-column">Three Column</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Newsletter Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-6 bg-white">
                <div className="max-w-2xl mx-auto">
                  <h1 className="text-2xl font-bold mb-4">{newsletter.title || 'Untitled Newsletter'}</h1>
                  {newsletter.description && (
                    <p className="text-muted-foreground mb-6">{newsletter.description}</p>
                  )}
                  
                  {newsletter.content.blocks.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>No content blocks added yet.</p>
                      <p>Switch to the Editor tab to start building your newsletter.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {newsletter.content.blocks.map((block) => (
                        <div key={block.id} className="border rounded p-4">
                          <div className="text-sm text-muted-foreground mb-2 capitalize">
                            {block.type} Block
                          </div>
                          <div>
                            {block.type === 'text' && (
                              <p>{block.content.text || 'Empty text block'}</p>
                            )}
                            {block.type === 'heading' && (
                              <h2 className="text-xl font-semibold">
                                {block.content.text || 'Empty heading'}
                              </h2>
                            )}
                            {block.type === 'image' && (
                              <div className="bg-gray-100 p-4 rounded text-center">
                                {block.content.src ? (
                                  <img 
                                    src={block.content.src} 
                                    alt={block.content.alt || 'Newsletter image'} 
                                    className="max-w-full h-auto"
                                  />
                                ) : (
                                  <p className="text-muted-foreground">No image selected</p>
                                )}
                              </div>
                            )}
                            {block.type === 'button' && (
                              <button className="bg-blue-600 text-white px-4 py-2 rounded">
                                {block.content.text || 'Button'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}