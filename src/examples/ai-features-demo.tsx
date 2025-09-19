/**
 * AI Features Demo Component
 * Demonstrates the AI-powered features for newsletter creation
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Target, Palette } from 'lucide-react';
import { generateContentAction } from '@/lib/actions/ai/generate-content';
import { optimizeSubjectLinesAction } from '@/lib/actions/ai/optimize-subject-lines';
import { adjustToneAction } from '@/lib/actions/ai/adjust-tone';

export function AIFeaturesDemo() {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('content');

  // Content Generation State
  const [contentPrompt, setContentPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState<any>(null);

  // Subject Line Optimization State
  const [subjectContent, setSubjectContent] = useState('');
  const [subjectVariations, setSubjectVariations] = useState<any[]>([]);

  // Tone Adjustment State
  const [originalText, setOriginalText] = useState('');
  const [targetTone, setTargetTone] = useState('');
  const [adjustedContent, setAdjustedContent] = useState<any>(null);

  const handleGenerateContent = async () => {
    if (!contentPrompt.trim()) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('prompt', contentPrompt);
      formData.append('company', 'Demo Company');
      formData.append('audience', 'Business professionals');
      formData.append('tone', 'professional');
      formData.append('length', 'medium');

      const result = await generateContentAction(formData);
      
      if (result.success) {
        setGeneratedContent(result.data);
      } else {
        console.error('Content generation failed:', result.error);
      }
    } catch (error) {
      console.error('Error generating content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptimizeSubjectLines = async () => {
    if (!subjectContent.trim()) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('content', subjectContent);
      formData.append('company', 'Demo Company');
      formData.append('audience', 'Business professionals');
      formData.append('campaign_type', 'Newsletter');

      const result = await optimizeSubjectLinesAction(formData);
      
      if (result.success) {
        setSubjectVariations(result.data?.variations || []);
      } else {
        console.error('Subject line optimization failed:', result.error);
      }
    } catch (error) {
      console.error('Error optimizing subject lines:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdjustTone = async () => {
    if (!originalText.trim() || !targetTone.trim()) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('content', originalText);
      formData.append('target_tone', targetTone);
      formData.append('target_style', 'conversational');

      const result = await adjustToneAction(formData);
      
      if (result.success) {
        setAdjustedContent(result.data);
      } else {
        console.error('Tone adjustment failed:', result.error);
      }
    } catch (error) {
      console.error('Error adjusting tone:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPerformanceBadgeColor = (performance: string) => {
    switch (performance) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Sparkles className="h-8 w-8 text-blue-600" />
          AI-Powered Newsletter Features
        </h1>
        <p className="text-gray-600">
          Explore the AI capabilities for content generation, subject line optimization, and tone adjustment
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="content" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Content Generation
          </TabsTrigger>
          <TabsTrigger value="subject" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Subject Lines
          </TabsTrigger>
          <TabsTrigger value="tone" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Tone Adjustment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Content Generation</CardTitle>
              <CardDescription>
                Generate newsletter content from a simple prompt
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Content Prompt</label>
                <Textarea
                  placeholder="e.g., Create a newsletter about the latest AI trends in business automation..."
                  value={contentPrompt}
                  onChange={(e) => setContentPrompt(e.target.value)}
                  rows={3}
                />
              </div>
              
              <Button 
                onClick={handleGenerateContent}
                disabled={isLoading || !contentPrompt.trim()}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Content...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Content
                  </>
                )}
              </Button>

              {generatedContent && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="font-semibold text-lg">{generatedContent.title}</h3>
                    <Badge variant="outline" className="mt-1">
                      Tone: {generatedContent.tone}
                    </Badge>
                  </div>
                  
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap">{generatedContent.content}</p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Key Points:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {generatedContent.key_points?.map((point: string, index: number) => (
                        <li key={index} className="text-sm">{point}</li>
                      ))}
                    </ul>
                  </div>

                  {generatedContent.call_to_action && (
                    <div className="p-3 bg-blue-50 rounded border-l-4 border-blue-400">
                      <strong>Call to Action:</strong> {generatedContent.call_to_action}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subject" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Subject Line Optimization</CardTitle>
              <CardDescription>
                Generate multiple subject line variations with performance predictions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Newsletter Content</label>
                <Textarea
                  placeholder="Paste your newsletter content here to generate optimized subject lines..."
                  value={subjectContent}
                  onChange={(e) => setSubjectContent(e.target.value)}
                  rows={4}
                />
              </div>
              
              <Button 
                onClick={handleOptimizeSubjectLines}
                disabled={isLoading || !subjectContent.trim()}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Optimizing Subject Lines...
                  </>
                ) : (
                  <>
                    <Target className="mr-2 h-4 w-4" />
                    Generate Subject Lines
                  </>
                )}
              </Button>

              {subjectVariations.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">Subject Line Variations:</h3>
                  {subjectVariations.map((variation, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-start justify-between">
                        <h4 className="font-medium flex-1">{variation.text}</h4>
                        <div className="flex gap-2 ml-4">
                          <Badge variant="outline">{variation.tone}</Badge>
                          <Badge className={getPerformanceBadgeColor(variation.predicted_performance)}>
                            {variation.predicted_performance} performance
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{variation.reasoning}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tone" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tone & Style Adjustment</CardTitle>
              <CardDescription>
                Adjust the tone and style of your content while preserving the message
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Original Content</label>
                  <Textarea
                    placeholder="Enter the content you want to adjust..."
                    value={originalText}
                    onChange={(e) => setOriginalText(e.target.value)}
                    rows={4}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target Tone</label>
                  <Input
                    placeholder="e.g., casual and friendly, formal and professional..."
                    value={targetTone}
                    onChange={(e) => setTargetTone(e.target.value)}
                  />
                </div>
              </div>
              
              <Button 
                onClick={handleAdjustTone}
                disabled={isLoading || !originalText.trim() || !targetTone.trim()}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adjusting Tone...
                  </>
                ) : (
                  <>
                    <Palette className="mr-2 h-4 w-4" />
                    Adjust Tone
                  </>
                )}
              </Button>

              {adjustedContent && (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold mb-2">Adjusted Content:</h3>
                    <p className="whitespace-pre-wrap">{adjustedContent.adjusted_content}</p>
                    <Badge variant="outline" className="mt-2">
                      Achieved tone: {adjustedContent.tone_achieved}
                    </Badge>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Changes Made:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {adjustedContent.changes_made?.map((change: string, index: number) => (
                        <li key={index} className="text-sm">{change}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}