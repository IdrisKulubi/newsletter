'use client';

import Link from 'next/link';
import { Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CampaignWorkflow, CampaignStatus } from '@/components/campaigns/campaign-workflow';

// Mock data - in real app this would come from database
const mockCampaigns = [
  {
    id: '1',
    name: 'Weekly Newsletter #42',
    status: 'sent' as CampaignStatus,
    scheduledAt: new Date('2024-01-15T10:00:00'),
    sentAt: new Date('2024-01-15T10:05:00'),
    totalRecipients: 1250,
    sentCount: 1250,
    openRate: 0.24,
    clickRate: 0.08,
    createdAt: new Date('2024-01-14T14:30:00'),
    updatedAt: new Date('2024-01-15T10:05:00'),
  },
  {
    id: '2',
    name: 'Product Update Announcement',
    status: 'scheduled' as CampaignStatus,
    scheduledAt: new Date('2024-01-20T09:00:00'),
    totalRecipients: 2100,
    sentCount: 0,
    createdAt: new Date('2024-01-18T16:20:00'),
    updatedAt: new Date('2024-01-19T11:15:00'),
  },
  {
    id: '3',
    name: 'Monthly Insights Report',
    status: 'review' as CampaignStatus,
    totalRecipients: 1800,
    sentCount: 0,
    createdAt: new Date('2024-01-19T09:45:00'),
    updatedAt: new Date('2024-01-19T15:30:00'),
  },
  {
    id: '4',
    name: 'Welcome Series - Part 1',
    status: 'sending' as CampaignStatus,
    totalRecipients: 450,
    sentCount: 320,
    createdAt: new Date('2024-01-19T13:00:00'),
    updatedAt: new Date('2024-01-20T08:30:00'),
  },
];

export function CampaignsList() {
  const handleStatusChange = async (campaignId: string, newStatus: CampaignStatus) => {
    // In real app, this would call a server action
    console.log(`Changing campaign ${campaignId} to status ${newStatus}`);
  };

  const handleEdit = (campaignId: string) => {
    // Navigate to edit page
    console.log(`Editing campaign ${campaignId}`);
  };

  const handlePreview = (campaignId: string) => {
    // Show preview modal
    console.log(`Previewing campaign ${campaignId}`);
  };

  const handleSchedule = (campaignId: string) => {
    // Show scheduling modal
    console.log(`Scheduling campaign ${campaignId}`);
  };

  return (
    <div className="space-y-6">
      {mockCampaigns.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Send className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
            <p className="text-muted-foreground mb-4">
              Get started by creating your first email campaign
            </p>
            <Link href="/dashboard/campaigns/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {mockCampaigns.map((campaign) => (
            <CampaignWorkflow
              key={campaign.id}
              campaign={campaign}
              onStatusChange={handleStatusChange}
              onEdit={handleEdit}
              onPreview={handlePreview}
              onSchedule={handleSchedule}
            />
          ))}
        </div>
      )}
    </div>
  );
}