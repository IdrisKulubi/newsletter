/**
 * Unit tests for DashboardLayout component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

// Mock theme components
vi.mock('@/components/themes/mode-toggle', () => ({
  ModeToggle: () => <button>Toggle Theme</button>,
}));

vi.mock('@/components/auth/user-menu', () => ({
  UserMenu: ({ user }: { user: any }) => <div>User: {user.name}</div>,
}));

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

describe('DashboardLayout', () => {
  it('should render the layout with navigation', () => {
    render(
      <DashboardLayout user={mockUser}>
        <div>Test Content</div>
      </DashboardLayout>
    );

    expect(screen.getByText('Newsletter')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Newsletters')).toBeInTheDocument();
    expect(screen.getByText('Campaigns')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should show admin-only navigation for admin users', () => {
    render(
      <DashboardLayout user={mockUser}>
        <div>Content</div>
      </DashboardLayout>
    );

    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('should hide admin-only navigation for non-admin users', () => {
    const editorUser = { ...mockUser, role: 'editor' as const };
    
    render(
      <DashboardLayout user={editorUser}>
        <div>Content</div>
      </DashboardLayout>
    );

    expect(screen.queryByText('Users')).not.toBeInTheDocument();
  });

  it('should render quick actions section', () => {
    render(
      <DashboardLayout user={mockUser}>
        <div>Content</div>
      </DashboardLayout>
    );

    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('New Newsletter')).toBeInTheDocument();
    expect(screen.getByText('New Campaign')).toBeInTheDocument();
    expect(screen.getByText('View Analytics')).toBeInTheDocument();
  });

  it('should render user menu and theme toggle', () => {
    render(
      <DashboardLayout user={mockUser}>
        <div>Content</div>
      </DashboardLayout>
    );

    expect(screen.getByText('User: John Doe')).toBeInTheDocument();
    expect(screen.getByText('Toggle Theme')).toBeInTheDocument();
  });

  it('should have proper navigation links', () => {
    render(
      <DashboardLayout user={mockUser}>
        <div>Content</div>
      </DashboardLayout>
    );

    const overviewLink = screen.getByText('Overview').closest('a');
    expect(overviewLink).toHaveAttribute('href', '/dashboard');

    const newslettersLink = screen.getByText('Newsletters').closest('a');
    expect(newslettersLink).toHaveAttribute('href', '/dashboard/newsletters');

    const campaignsLink = screen.getByText('Campaigns').closest('a');
    expect(campaignsLink).toHaveAttribute('href', '/dashboard/campaigns');

    const analyticsLink = screen.getByText('Analytics').closest('a');
    expect(analyticsLink).toHaveAttribute('href', '/dashboard/analytics');
  });

  it('should handle mobile sidebar toggle', async () => {
    const user = userEvent.setup();
    
    render(
      <DashboardLayout user={mockUser}>
        <div>Content</div>
      </DashboardLayout>
    );

    const menuButton = screen.getByRole('button', { name: /open sidebar/i });
    expect(menuButton).toBeInTheDocument();

    await user.click(menuButton);
    
    // Sidebar should be accessible after opening
    expect(screen.getAllByText('Newsletter')).toHaveLength(2); // One in desktop, one in mobile
  });

  it('should apply active state to current navigation item', () => {
    render(
      <DashboardLayout user={mockUser}>
        <div>Content</div>
      </DashboardLayout>
    );

    // Overview should be active for /dashboard path
    const overviewLink = screen.getByText('Overview').closest('a');
    expect(overviewLink).toHaveClass('bg-primary', 'text-primary-foreground');
  });

  it('should render with proper accessibility attributes', () => {
    render(
      <DashboardLayout user={mockUser}>
        <div>Content</div>
      </DashboardLayout>
    );

    // Navigation should have proper roles
    const navigations = screen.getAllByRole('list');
    expect(navigations.length).toBeGreaterThan(0);

    // Menu button should have proper aria-label
    const menuButton = screen.getByRole('button', { name: /open sidebar/i });
    expect(menuButton).toBeInTheDocument();
  });

  it('should render main content area', () => {
    render(
      <DashboardLayout user={mockUser}>
        <div data-testid="main-content">Main Content</div>
      </DashboardLayout>
    );

    const mainContent = screen.getByTestId('main-content');
    expect(mainContent).toBeInTheDocument();
    expect(mainContent.closest('main')).toBeInTheDocument();
  });

  it('should have responsive design classes', () => {
    render(
      <DashboardLayout user={mockUser}>
        <div>Content</div>
      </DashboardLayout>
    );

    // Should have responsive classes for desktop sidebar container
    const sidebarContainer = document.querySelector('.lg\\:fixed');
    expect(sidebarContainer).toBeInTheDocument();
    expect(sidebarContainer).toHaveClass('lg:fixed', 'lg:inset-y-0');

    // Should have responsive classes for main content
    const mainArea = document.querySelector('.lg\\:pl-64');
    expect(mainArea).toBeInTheDocument();
    expect(mainArea).toHaveClass('lg:pl-64');
  });
});