/**
 * Generate Insights Button Component
 * Allows users to generate or queue AI insights for campaigns
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Brain, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { generateCampaignInsights, queueInsightsGeneration } from '@/lib/actions/ai-insights';
import { toast } from 'sonner';

interface GenerateInsightsButtonProps {
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  hasExistingInsights?: boolean;
  onInsightsGenerated?: () => void;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export function GenerateInsightsButton({
  campaignId,
  campaignName,
  campaignStatus,
  hasExistingInsights = false,
  onInsightsGenerated,
  variant = 'default',
  size = 'default',
}: GenerateInsightsButtonProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [priority, setPriority] = useState<'high' | 'normal' | 'low'>('normal');

  const canGenerateInsights = campaignStatus === 'sent';

  const handleGenerateNow = async () => {
    if (!canGenerateInsights) return;

    setGenerating(true);

    try {
      const formData = new FormData();
      formData.append('campaignId', campaignId);
      formData.append('priority', priority);

      const result = await generateCampaignInsights(formData);

      if (result.success) {
        toast.success('AI insights generated successfully!');
        setOpen(false);
        onInsightsGenerated?.();
      } else {
        toast.error(result.error || 'Failed to generate insights');
      }
    } catch (error) {
      toast.error('Failed to generate insights');
    } finally {
      setGenerating(false);
    }
  };

  const handleQueueGeneration = async () => {
    if (!canGenerateInsights) return;

    setQueueing(true);

    try {
      const formData = new FormData();
      formData.append('campaignId', campaignId);
      formData.append('priority', priority);

      const result = await queueInsightsGeneration(formData);

      if (result.success) {
        toast.success(result.message || 'Insights generation queued successfully!');
        setOpen(false);
      } else {
        toast.error(result.error || 'Failed to queue insights generation');
      }
    } catch (error) {
      toast.error('Failed to queue insights generation');
    } finally {
      setQueueing(false);
    }
  };

  const getButtonText = () => {
    if (hasExistingInsights) {
      return 'Regenerate Insights';
    }
    return 'Generate AI Insights';
  };

  const getButtonIcon = () => {
    if (generating || queueing) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    return <Brain className="h-4 w-4" />;
  };

  if (!canGenerateInsights) {
    return (
      <Button variant="outline" size={size} disabled>
        <AlertCircle className="h-4 w-4 mr-2" />
        Campaign Not Complete
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          {getButtonIcon()}
          {getButtonText()}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Generate AI Insights
          </DialogTitle>
          <DialogDescription>
            Generate AI-powered analysis and recommendations for "{campaignName}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority} onValueChange={(value: 'high' | 'normal' | 'low') => setPriority(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High - Generate immediately</SelectItem>
                <SelectItem value="normal">Normal - Generate within 30 seconds</SelectItem>
                <SelectItem value="low">Low - Generate when resources available</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-muted p-3 rounded-lg text-sm">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="font-medium">What you'll get:</span>
            </div>
            <ul className="space-y-1 text-muted-foreground ml-6">
              <li>• Executive summary of campaign performance</li>
              <li>• Content and subject line analysis</li>
              <li>• Audience segment insights</li>
              <li>• Actionable recommendations</li>
              <li>• Performance benchmarking</li>
            </ul>
          </div>

          {hasExistingInsights && (
            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Note:</span>
              </div>
              <p className="text-yellow-700 mt-1">
                This campaign already has AI insights. Generating new insights will replace the existing ones.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleQueueGeneration}
            disabled={generating || queueing}
          >
            {queueing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Brain className="h-4 w-4 mr-2" />
            )}
            Queue Generation
          </Button>
          <Button
            onClick={handleGenerateNow}
            disabled={generating || queueing}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Brain className="h-4 w-4 mr-2" />
            )}
            Generate Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}