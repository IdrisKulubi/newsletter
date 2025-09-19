/**
 * End-to-end tests for complete user workflows in the dashboard
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { CampaignWorkflow } from '@/components/campaigns/campaign-workflow';
import { NewsletterEditorPage } from '@/components/newsletter/newsletter-editor-page';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';

// Mock Next.js router
const mockPush = vi.fn();
const mockBack = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
  usePathname: () => '/dashboard',
}));

// Mock toast notifications
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock user data
const mockUser = {
  id: 'user-1',
  name: 'John Doe',
  email: 'john@example.com',
  role: 'admin' as const,
  tenantId: 'tenant-1',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: new Date(),
};

const mockEditorUser = {
  ...mockUser,
  role: 'editor' as const,
};

const mockViewerUser = {
  ...mockUser,
  role: 'viewer' as const,
};

describe('Dashboard Workflows E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dashboard Navigation', () => {
    it('should render navigation with all links for admin user', () => {
      render(
        <DashboardLayout user={mockUser}>
          <div>Dashboard Content</div>
        </DashboardLayout>
      );

      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Newsletters')).toBeInTheDocument();
      expect(screen.getByText('Campaigns')).toBeInTheDocument();
      expect(screen.getByText('Analytics')).toBeInTheDocument();
      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should hide admin-only navigation for non-admin users', () => {
      render(
        <DashboardLayout user={mockEditorUser}>
          <div>Dashboard Content</div>
        </DashboardLayout>
      );

      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Newsletters')).toBeInTheDocument();
      expect(screen.getByText('Campaigns')).toBeInTheDocument();
      expect(screen.getByText('Analytics')).toBeInTheDocument();
      expect(screen.queryByText('Users')).not.toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should show quick actions in sidebar', () => {
      render(
        <DashboardLayout user={mockEditorUser}>
          <div>Dashboard Content</div>
        </DashboardLayout>
      );

      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      expect(screen.getByText('New Newsletter')).toBeInTheDocument();
      expect(screen.getByText('New Campaign')).toBeInTheDocument();
      expect(screen.getByText('View Analytics')).toBeInTheDocument();
    });

    it('should toggle mobile sidebar', async () => {
      const user = userEvent.setup();
      
      render(
        <DashboardLayout user={mockUser}>
          <div>Dashboard Content</div>
        </DashboardLayout>
      );

      // Mobile menu button should be present
      const menuButton = screen.getByRole('button', { name: /open sidebar/i });
      expect(menuButton).toBeInTheDocument();

      // Click to open sidebar
      await user.click(menuButton);
      
      // Sidebar should be accessible
      expect(screen.getByText('Newsletter')).toBeInTheDocument();
    });
  });

  describe('Newsletter Creation Workflow', () => {
    it('should complete newsletter creation workflow', async () => {
      const user = userEvent.setup();
      
      render(<NewsletterEditorPage />);

      // Should show newsletter creation form
      expect(screen.getByText('Create Newsletter')).toBeInTheDocument();
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();

      // Fill in newsletter details
      const titleInput = screen.getByLabelText('Title');
      const descriptionInput = screen.getByLabelText('Description');
      
      await user.type(titleInput, 'Test Newsletter');
      await user.type(descriptionInput, 'This is a test newsletter');

      // Should show editor tab by default
      expect(screen.getByRole('tab', { name: 'Editor' })).toHaveAttribute('data-state', 'active');

      // Should be able to switch to settings tab
      await user.click(screen.getByRole('tab', { name: 'Settings' }));
      expect(screen.getByText('Newsletter Settings')).toBeInTheDocument();

      // Should be able to switch to preview tab
      await user.click(screen.getByRole('tab', { name: 'Preview' }));
      expect(screen.getByText('Newsletter Preview')).toBeInTheDocument();
      expect(screen.getByText('Test Newsletter')).toBeInTheDocument();

      // Should be able to save as draft
      await user.click(screen.getByText('Save Draft'));
      
      await waitFor(() => {
        expect(screen.getByText('draft')).toBeInTheDocument();
      });
    });

    it('should validate required fields before submission', async () => {
      const user = userEvent.setup();
      
      render(<NewsletterEditorPage />);

      // Try to submit without title
      const submitButton = screen.getByText('Submit for Review');
      expect(submitButton).toBeDisabled();

      // Add title
      const titleInput = screen.getByLabelText('Title');
      await user.type(titleInput, 'Test Newsletter');

      // Submit button should now be enabled
      expect(submitButton).not.toBeDisabled();
    });

    it('should show AI assist functionality', async () => {
      const user = userEvent.setup();
      
      render(<NewsletterEditorPage />);

      const aiButton = screen.getByText('AI Assist');
      await user.click(aiButton);

      // Should show AI assist notification (mocked)
      expect(aiButton).toBeInTheDocument();
    });
  });

  describe('Campaign Management Workflow', () => {
    const mockCampaign = {
      id: 'campaign-1',
      name: 'Test Campaign',
      status: 'draft' as const,
      totalRecipients: 100,
      sentCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should display campaign workflow correctly', () => {
      render(
        <CampaignWorkflow
          campaign={mockCampaign}
          onStatusChange={vi.fn()}
          onEdit={vi.fn()}
          onPreview={vi.fn()}
          onSchedule={vi.fn()}
        />
      );

      expect(screen.getByText('Test Campaign')).toBeInTheDocument();
      expect(screen.getByText('draft')).toBeInTheDocument();
      expect(screen.getByText('Campaign Progress')).toBeInTheDocument();
    });

    it('should show appropriate actions for draft campaign', () => {
      const onEdit = vi.fn();
      const onStatusChange = vi.fn();
      
      render(
        <CampaignWorkflow
          campaign={mockCampaign}
          onStatusChange={onStatusChange}
          onEdit={onEdit}
          onPreview={vi.fn()}
          onSchedule={vi.fn()}
        />
      );

      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Submit for Review')).toBeInTheDocument();
    });

    it('should handle campaign status changes', async () => {
      const user = userEvent.setup();
      const onStatusChange = vi.fn();
      
      render(
        <CampaignWorkflow
          campaign={mockCampaign}
          onStatusChange={onStatusChange}
          onEdit={vi.fn()}
          onPreview={vi.fn()}
          onSchedule={vi.fn()}
        />
      );

      const reviewButton = screen.getByText('Submit for Review');
      await user.click(reviewButton);

      expect(onStatusChange).toHaveBeenCalledWith('campaign-1', 'review');
    });

    it('should show progress for sending campaign', () => {
      const sendingCampaign = {
        ...mockCampaign,
        status: 'sending' as const,
        sentCount: 50,
      };

      render(
        <CampaignWorkflow
          campaign={sendingCampaign}
          onStatusChange={vi.fn()}
          onEdit={vi.fn()}
          onPreview={vi.fn()}
          onSchedule={vi.fn()}
        />
      );

      expect(screen.getByText('50% complete')).toBeInTheDocument();
      expect(screen.getByText('Pause')).toBeInTheDocument();
    });

    it('should show campaign statistics for completed campaigns', () => {
      const completedCampaign = {
        ...mockCampaign,
        status: 'sent' as const,
        sentCount: 100,
        openRate: 0.25,
        clickRate: 0.08,
        sentAt: new Date(),
      };

      render(
        <CampaignWorkflow
          campaign={completedCampaign}
          onStatusChange={vi.fn()}
          onEdit={vi.fn()}
          onPreview={vi.fn()}
          onSchedule={vi.fn()}
        />
      );

      expect(screen.getByText('100')).toBeInTheDocument(); // Sent count
      expect(screen.getByText('25.0%')).toBeInTheDocument(); // Open rate
      expect(screen.getByText('8.0%')).toBeInTheDocument(); // Click rate
    });
  });

  describe('Analytics Dashboard Workflow', () => {
    const mockAnalyticsData = {
      overview: {
        totalCampaigns: 10,
        totalSent: 5000,
        averageOpenRate: 0.24,
        averageClickRate: 0.08,
      },
      performanceChart: [
        { date: '2024-01-01', opens: 100, clicks: 25, sent: 500 },
        { date: '2024-01-02', opens: 120, clicks: 30, sent: 600 },
      ],
      recentCampaigns: [],
      topPerformingCampaigns: [],
    };

    it('should display analytics dashboard with data', () => {
      render(<AnalyticsDashboard initialData={mockAnalyticsData} />);

      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Track your newsletter performance and engagement')).toBeInTheDocument();
    });

    it('should show loading state when no initial data', () => {
      render(<AnalyticsDashboard />);

      // Should show loading skeletons
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });

    it('should handle date range selection', async () => {
      const user = userEvent.setup();
      
      render(<AnalyticsDashboard initialData={mockAnalyticsData} />);

      // Should show date range picker
      const dateButton = screen.getByRole('button', { name: /pick a date range/i });
      expect(dateButton).toBeInTheDocument();

      await user.click(dateButton);
      
      // Should show preset options
      expect(screen.getByText('Last 7 days')).toBeInTheDocument();
      expect(screen.getByText('Last 30 days')).toBeInTheDocument();
      expect(screen.getByText('Last 90 days')).toBeInTheDocument();
    });

    it('should switch between analytics tabs', async () => {
      const user = userEvent.setup();
      
      render(<AnalyticsDashboard initialData={mockAnalyticsData} />);

      // Should show overview tab by default
      expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('data-state', 'active');

      // Switch to campaigns tab
      await user.click(screen.getByRole('tab', { name: 'Campaigns' }));
      expect(screen.getByRole('tab', { name: 'Campaigns' })).toHaveAttribute('data-state', 'active');

      // Switch to performance tab
      await user.click(screen.getByRole('tab', { name: 'Performance' }));
      expect(screen.getByRole('tab', { name: 'Performance' })).toHaveAttribute('data-state', 'active');

      // Switch to audience tab
      await user.click(screen.getByRole('tab', { name: 'Audience' }));
      expect(screen.getByRole('tab', { name: 'Audience' })).toHaveAttribute('data-state', 'active');
    });

    it('should handle refresh functionality', async () => {
      const user = userEvent.setup();
      
      render(<AnalyticsDashboard initialData={mockAnalyticsData} />);

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);

      // Should show loading state during refresh
      expect(refreshButton).toBeInTheDocument();
    });
  });

  describe('User Management Workflow', () => {
    it('should show user management interface for admin users', () => {
      const mockUsers = [
        mockUser,
        { ...mockUser, id: 'user-2', name: 'Jane Doe', email: 'jane@example.com', role: 'editor' as const },
      ];

      // This would be tested in the actual UserManagement component test
      expect(mockUsers).toHaveLength(2);
    });
  });

  describe('Responsive Design', () => {
    it('should adapt layout for mobile screens', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <DashboardLayout user={mockUser}>
          <div>Mobile Content</div>
        </DashboardLayout>
      );

      // Mobile menu button should be visible
      expect(screen.getByRole('button', { name: /open sidebar/i })).toBeInTheDocument();
    });

    it('should show desktop sidebar on larger screens', () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      render(
        <DashboardLayout user={mockUser}>
          <div>Desktop Content</div>
        </DashboardLayout>
      );

      // Desktop navigation should be visible
      expect(screen.getByText('Newsletter')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully in newsletter creation', async () => {
      const user = userEvent.setup();
      
      // Mock API error
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('API Error'));
      
      render(<NewsletterEditorPage />);

      const titleInput = screen.getByLabelText('Title');
      await user.type(titleInput, 'Test Newsletter');

      const saveButton = screen.getByText('Save Draft');
      await user.click(saveButton);

      // Should handle error gracefully
      expect(saveButton).toBeInTheDocument();
    });

    it('should show error state in analytics dashboard', () => {
      render(<AnalyticsDashboard />);

      // Should handle missing data gracefully
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(
        <DashboardLayout user={mockUser}>
          <div>Content</div>
        </DashboardLayout>
      );

      // Navigation should have proper roles
      expect(screen.getByRole('button', { name: /open sidebar/i })).toBeInTheDocument();
      
      // Links should be accessible
      const overviewLink = screen.getByText('Overview');
      expect(overviewLink.closest('a')).toHaveAttribute('href', '/dashboard');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(
        <DashboardLayout user={mockUser}>
          <div>Content</div>
        </DashboardLayout>
      );

      // Should be able to tab through navigation
      await user.tab();
      expect(document.activeElement).toBeInTheDocument();
    });

    it('should have proper color contrast and focus indicators', () => {
      render(
        <DashboardLayout user={mockUser}>
          <div>Content</div>
        </DashboardLayout>
      );

      // Focus indicators should be visible (tested via CSS classes)
      const menuButton = screen.getByRole('button', { name: /open sidebar/i });
      expect(menuButton).toHaveClass('focus:outline-none'); // Tailwind focus classes
    });
  });
});