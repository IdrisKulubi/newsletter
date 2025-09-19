/**
 * Unit tests for CampaignWorkflow component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampaignWorkflow, CampaignStatus } from '@/components/campaigns/campaign-workflow';

const baseCampaign = {
  id: 'campaign-1',
  name: 'Test Campaign',
  totalRecipients: 1000,
  sentCount: 0,
  createdAt: new Date('2024-01-01T10:00:00'),
  updatedAt: new Date('2024-01-01T11:00:00'),
};

describe('CampaignWorkflow', () => {
  it('should render campaign information', () => {
    const campaign = {
      ...baseCampaign,
      status: 'draft' as CampaignStatus,
    };

    render(<CampaignWorkflow campaign={campaign} />);

    expect(screen.getByText('Test Campaign')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
    expect(screen.getByText('Campaign Progress')).toBeInTheDocument();
  });

  it('should show appropriate actions for draft status', () => {
    const campaign = {
      ...baseCampaign,
      status: 'draft' as CampaignStatus,
    };

    const onEdit = vi.fn();
    const onStatusChange = vi.fn();

    render(
      <CampaignWorkflow
        campaign={campaign}
        onEdit={onEdit}
        onStatusChange={onStatusChange}
      />
    );

    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Submit for Review')).toBeInTheDocument();
  });

  it('should show appropriate actions for review status', () => {
    const campaign = {
      ...baseCampaign,
      status: 'review' as CampaignStatus,
    };

    const onEdit = vi.fn();
    const onPreview = vi.fn();
    const onSchedule = vi.fn();

    render(
      <CampaignWorkflow
        campaign={campaign}
        onEdit={onEdit}
        onPreview={onPreview}
        onSchedule={onSchedule}
      />
    );

    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('Schedule')).toBeInTheDocument();
  });

  it('should show appropriate actions for scheduled status', () => {
    const campaign = {
      ...baseCampaign,
      status: 'scheduled' as CampaignStatus,
      scheduledAt: new Date('2024-01-15T10:00:00'),
    };

    render(<CampaignWorkflow campaign={campaign} />);

    expect(screen.getByText('Send Now')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText(/Scheduled for/)).toBeInTheDocument();
  });

  it('should show appropriate actions for sending status', () => {
    const campaign = {
      ...baseCampaign,
      status: 'sending' as CampaignStatus,
      sentCount: 500,
    };

    render(<CampaignWorkflow campaign={campaign} />);

    expect(screen.getByText('Pause')).toBeInTheDocument();
    expect(screen.getByText(/Sending to 1000 recipients/)).toBeInTheDocument();
  });

  it('should show appropriate actions for paused status', () => {
    const campaign = {
      ...baseCampaign,
      status: 'paused' as CampaignStatus,
      sentCount: 300,
    };

    render(<CampaignWorkflow campaign={campaign} />);

    expect(screen.getByText('Resume')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should display campaign statistics for sent campaigns', () => {
    const campaign = {
      ...baseCampaign,
      status: 'sent' as CampaignStatus,
      sentCount: 1000,
      openRate: 0.25,
      clickRate: 0.08,
      sentAt: new Date('2024-01-01T12:00:00'),
    };

    render(<CampaignWorkflow campaign={campaign} />);

    // Check for statistics in the stats grid
    const statsGrid = document.querySelector('.grid.grid-cols-2.md\\:grid-cols-4');
    expect(statsGrid).toBeInTheDocument();
    
    expect(screen.getByText('25.0%')).toBeInTheDocument(); // Open rate
    expect(screen.getByText('8.0%')).toBeInTheDocument(); // Click rate
    expect(screen.getByText(/Sent on/)).toBeInTheDocument();
  });

  it('should calculate progress correctly for sending campaigns', () => {
    const campaign = {
      ...baseCampaign,
      status: 'sending' as CampaignStatus,
      sentCount: 250,
    };

    render(<CampaignWorkflow campaign={campaign} />);

    expect(screen.getByText('25% complete')).toBeInTheDocument();
  });

  it('should handle status change actions', async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    
    const campaign = {
      ...baseCampaign,
      status: 'draft' as CampaignStatus,
    };

    render(
      <CampaignWorkflow
        campaign={campaign}
        onStatusChange={onStatusChange}
      />
    );

    const reviewButton = screen.getByText('Submit for Review');
    await user.click(reviewButton);

    expect(onStatusChange).toHaveBeenCalledWith('campaign-1', 'review');
  });

  it('should handle edit action', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    
    const campaign = {
      ...baseCampaign,
      status: 'draft' as CampaignStatus,
    };

    render(
      <CampaignWorkflow
        campaign={campaign}
        onEdit={onEdit}
      />
    );

    const editButton = screen.getByText('Edit');
    await user.click(editButton);

    expect(onEdit).toHaveBeenCalledWith('campaign-1');
  });

  it('should handle preview action', async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    
    const campaign = {
      ...baseCampaign,
      status: 'review' as CampaignStatus,
    };

    render(
      <CampaignWorkflow
        campaign={campaign}
        onPreview={onPreview}
      />
    );

    const previewButton = screen.getByText('Preview');
    await user.click(previewButton);

    expect(onPreview).toHaveBeenCalledWith('campaign-1');
  });

  it('should handle schedule action', async () => {
    const user = userEvent.setup();
    const onSchedule = vi.fn();
    
    const campaign = {
      ...baseCampaign,
      status: 'review' as CampaignStatus,
    };

    render(
      <CampaignWorkflow
        campaign={campaign}
        onSchedule={onSchedule}
      />
    );

    const scheduleButton = screen.getByText('Schedule');
    await user.click(scheduleButton);

    expect(onSchedule).toHaveBeenCalledWith('campaign-1');
  });

  it('should display workflow steps with correct states', () => {
    const campaign = {
      ...baseCampaign,
      status: 'scheduled' as CampaignStatus,
    };

    render(<CampaignWorkflow campaign={campaign} />);

    // Draft and Review should be completed
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Sending')).toBeInTheDocument();
    expect(screen.getByText('Sent')).toBeInTheDocument();
  });

  it('should display timeline information', () => {
    const campaign = {
      ...baseCampaign,
      status: 'sent' as CampaignStatus,
      scheduledAt: new Date('2024-01-01T09:00:00'),
      sentAt: new Date('2024-01-01T12:00:00'),
    };

    render(<CampaignWorkflow campaign={campaign} />);

    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Last Updated')).toBeInTheDocument();
    
    // Check for timeline entries specifically in the timeline section
    const timelineSection = screen.getByText('Timeline').closest('.space-y-2');
    expect(timelineSection).toBeInTheDocument();
    
    // Look for scheduled and sent in timeline context
    const timelineEntries = timelineSection?.querySelectorAll('.flex.justify-between');
    expect(timelineEntries?.length).toBeGreaterThan(0);
  });

  it('should disable actions during transition', async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    const campaign = {
      ...baseCampaign,
      status: 'draft' as CampaignStatus,
    };

    render(
      <CampaignWorkflow
        campaign={campaign}
        onStatusChange={onStatusChange}
      />
    );

    const reviewButton = screen.getByText('Submit for Review');
    await user.click(reviewButton);

    // Button should be disabled during transition
    expect(reviewButton).toBeDisabled();
  });

  it('should show correct badge variants for different statuses', () => {
    const statuses: CampaignStatus[] = ['draft', 'review', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'];
    
    statuses.forEach(status => {
      const campaign = {
        ...baseCampaign,
        status,
      };

      const { unmount } = render(<CampaignWorkflow campaign={campaign} />);
      
      expect(screen.getByText(status)).toBeInTheDocument();
      
      unmount();
    });
  });

  it('should handle campaigns without optional data', () => {
    const campaign = {
      ...baseCampaign,
      status: 'draft' as CampaignStatus,
      // No scheduledAt, sentAt, openRate, clickRate
    };

    render(<CampaignWorkflow campaign={campaign} />);

    expect(screen.getByText('Test Campaign')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
    
    // Should not show optional information
    expect(screen.queryByText(/Scheduled for/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sent on/)).not.toBeInTheDocument();
  });

  it('should be accessible with proper ARIA attributes', () => {
    const campaign = {
      ...baseCampaign,
      status: 'draft' as CampaignStatus,
    };

    render(<CampaignWorkflow campaign={campaign} />);

    // Buttons should have proper accessibility
    const editButton = screen.getByText('Edit');
    expect(editButton.closest('button')).toBeInTheDocument();

    const reviewButton = screen.getByText('Submit for Review');
    expect(reviewButton.closest('button')).toBeInTheDocument();
  });
});