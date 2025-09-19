import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Send, Calendar, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

async function CampaignStats() {
  // Mock stats - in real app this would be calculated from database
  const stats = {
    total: mockCampaigns.length,
    draft: mockCampaigns.filter(c => c.status === 'draft').length,
    scheduled: mockCampaigns.filter(c => c.status === 'scheduled').length,
    sent: mockCampaigns.filter(c => c.status === 'sent').length,
    sending: mockCampaigns.filter(c => c.status === 'sending').length,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
          <Send className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.scheduled}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Sending</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.sending}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Sent</CardTitle>
          <Send className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.sent}</div>
        </CardContent>
      </Card>
    </div>
  );
}

async function CampaignsList() {
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

export default function CampaignsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">
            Manage your email campaigns from creation to delivery
          </p>
        </div>
        <Link href="/dashboard/campaigns/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </Link>
      </div>

      <Suspense fallback={<div>Loading campaign stats...</div>}>
        <CampaignStats />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle>All Campaigns</CardTitle>
          <CardDescription>
            Track the progress and performance of your email campaigns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div>Loading campaigns...</div>}>
            <CampaignsList />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}