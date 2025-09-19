'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Play, 
  Pause, 
  Send,
  Eye,
  Edit,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type CampaignStatus = 'draft' | 'review' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled';

interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  scheduledAt?: Date;
  sentAt?: Date;
  totalRecipients: number;
  sentCount: number;
  openRate?: number;
  clickRate?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CampaignWorkflowProps {
  campaign: Campaign;
  onStatusChange?: (campaignId: string, newStatus: CampaignStatus) => void;
  onEdit?: (campaignId: string) => void;
  onPreview?: (campaignId: string) => void;
  onSchedule?: (campaignId: string) => void;
}

const workflowSteps = [
  { key: 'draft', label: 'Draft', icon: Edit },
  { key: 'review', label: 'Review', icon: Eye },
  { key: 'scheduled', label: 'Scheduled', icon: Calendar },
  { key: 'sending', label: 'Sending', icon: Send },
  { key: 'sent', label: 'Sent', icon: CheckCircle },
];

const statusConfig = {
  draft: { color: 'bg-gray-500', variant: 'secondary' as const },
  review: { color: 'bg-yellow-500', variant: 'outline' as const },
  scheduled: { color: 'bg-blue-500', variant: 'default' as const },
  sending: { color: 'bg-orange-500', variant: 'default' as const },
  sent: { color: 'bg-green-500', variant: 'default' as const },
  paused: { color: 'bg-red-500', variant: 'destructive' as const },
  cancelled: { color: 'bg-gray-500', variant: 'destructive' as const },
};

export function CampaignWorkflow({ 
  campaign, 
  onStatusChange, 
  onEdit, 
  onPreview, 
  onSchedule 
}: CampaignWorkflowProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);

  const getCurrentStepIndex = () => {
    const stepIndex = workflowSteps.findIndex(step => step.key === campaign.status);
    return stepIndex >= 0 ? stepIndex : 0;
  };

  const getProgressPercentage = () => {
    if (campaign.status === 'sending' && campaign.totalRecipients > 0) {
      return (campaign.sentCount / campaign.totalRecipients) * 100;
    }
    
    const currentStep = getCurrentStepIndex();
    return ((currentStep + 1) / workflowSteps.length) * 100;
  };

  const handleStatusChange = async (newStatus: CampaignStatus) => {
    if (!onStatusChange) return;
    
    setIsTransitioning(true);
    try {
      await onStatusChange(campaign.id, newStatus);
    } finally {
      setIsTransitioning(false);
    }
  };

  const getAvailableActions = () => {
    const actions = [];
    
    switch (campaign.status) {
      case 'draft':
        actions.push(
          { label: 'Edit', action: () => onEdit?.(campaign.id), icon: Edit },
          { label: 'Submit for Review', action: () => handleStatusChange('review'), icon: Eye }
        );
        break;
      case 'review':
        actions.push(
          { label: 'Edit', action: () => onEdit?.(campaign.id), icon: Edit },
          { label: 'Preview', action: () => onPreview?.(campaign.id), icon: Eye },
          { label: 'Schedule', action: () => onSchedule?.(campaign.id), icon: Calendar }
        );
        break;
      case 'scheduled':
        actions.push(
          { label: 'Send Now', action: () => handleStatusChange('sending'), icon: Play },
          { label: 'Cancel', action: () => handleStatusChange('cancelled'), icon: AlertCircle }
        );
        break;
      case 'sending':
        actions.push(
          { label: 'Pause', action: () => handleStatusChange('paused'), icon: Pause }
        );
        break;
      case 'paused':
        actions.push(
          { label: 'Resume', action: () => handleStatusChange('sending'), icon: Play },
          { label: 'Cancel', action: () => handleStatusChange('cancelled'), icon: AlertCircle }
        );
        break;
    }
    
    return actions;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {campaign.name}
              <Badge variant={statusConfig[campaign.status]?.variant || 'secondary'}>
                {campaign.status}
              </Badge>
            </CardTitle>
            <CardDescription>
              {campaign.status === 'scheduled' && campaign.scheduledAt && (
                <>Scheduled for {campaign.scheduledAt.toLocaleString()}</>
              )}
              {campaign.status === 'sent' && campaign.sentAt && (
                <>Sent on {campaign.sentAt.toLocaleString()}</>
              )}
              {campaign.status === 'sending' && (
                <>Sending to {campaign.totalRecipients} recipients</>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {getAvailableActions().map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={action.action}
                disabled={isTransitioning}
              >
                <action.icon className="h-4 w-4 mr-1" />
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Workflow Progress */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Campaign Progress</h4>
            <span className="text-sm text-muted-foreground">
              {Math.round(getProgressPercentage())}% complete
            </span>
          </div>
          
          <Progress value={getProgressPercentage()} className="h-2" />
          
          <div className="flex justify-between">
            {workflowSteps.map((step, index) => {
              const currentStep = getCurrentStepIndex();
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;
              const isUpcoming = index > currentStep;
              
              return (
                <div key={step.key} className="flex flex-col items-center space-y-2">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
                      isCompleted && 'bg-primary border-primary text-primary-foreground',
                      isCurrent && 'border-primary bg-background text-primary',
                      isUpcoming && 'border-muted-foreground/30 bg-background text-muted-foreground'
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <step.icon className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium',
                      (isCompleted || isCurrent) && 'text-foreground',
                      isUpcoming && 'text-muted-foreground'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Campaign Stats */}
        {(campaign.status === 'sending' || campaign.status === 'sent') && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{campaign.sentCount}</div>
              <div className="text-sm text-muted-foreground">Sent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{campaign.totalRecipients}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
            {campaign.openRate !== undefined && (
              <div className="text-center">
                <div className="text-2xl font-bold">{(campaign.openRate * 100).toFixed(1)}%</div>
                <div className="text-sm text-muted-foreground">Open Rate</div>
              </div>
            )}
            {campaign.clickRate !== undefined && (
              <div className="text-center">
                <div className="text-2xl font-bold">{(campaign.clickRate * 100).toFixed(1)}%</div>
                <div className="text-sm text-muted-foreground">Click Rate</div>
              </div>
            )}
          </div>
        )}

        {/* Timeline */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Timeline</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Created</span>
              <span>{campaign.createdAt.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Last Updated</span>
              <span>{campaign.updatedAt.toLocaleString()}</span>
            </div>
            {campaign.scheduledAt && (
              <div className="flex justify-between">
                <span>Scheduled</span>
                <span>{campaign.scheduledAt.toLocaleString()}</span>
              </div>
            )}
            {campaign.sentAt && (
              <div className="flex justify-between">
                <span>Sent</span>
                <span>{campaign.sentAt.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}