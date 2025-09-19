import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';
import { getDashboardData } from '@/lib/actions/analytics/get-dashboard-data';
import { DashboardData } from '@/lib/services/analytics';

// Mock the analytics actions
vi.mock('@/lib/actions/analytics/get-dashboard-data');

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn((date, formatStr) => {
    if (formatStr === 'LLL dd, y') return 'Jan 01, 2024';
    if (formatStr === 'MMM dd') return 'Jan 01';
    return date.toISOString();
  }),
}));

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => ({ type: 'div', props: { 'data-testid': 'chart-container', children } }),
  AreaChart: ({ children }: any) => ({ type: 'div', props: { 'data-testid': 'area-chart', children } }),
  Area: () => ({ type: 'div', props: { 'data-testid': 'area' } }),
  BarChart: ({ children }: any) => ({ type: 'div', props: { 'data-testid': 'bar-chart', children } }),
  Bar: () => ({ type: 'div', props: { 'data-testid': 'bar' } }),
  LineChart: ({ children }: any) => ({ type: 'div', props: { 'data-testid': 'line-chart', children } }),
  Line: () => ({ type: 'div', props: { 'data-testid': 'line' } }),
  XAxis: () => ({ type: 'div', props: { 'data-testid': 'x-axis' } }),
  YAxis: () => ({ type: 'div', props: { 'data-testid': 'y-axis' } }),
  CartesianGrid: () => ({ type: 'div', props: { 'data-testid': 'cartesian-grid' } }),
  Tooltip: () => ({ type: 'div', props: { 'data-testid': 'tooltip' } }),
}));

const mockDashboardData: DashboardData = {
  totalCampaigns: 25,
  totalSent: 125000,
  averageOpenRate: 28.5,
  averageClickRate: 4.2,
  recentCampaigns: [
    {
      id: 'campaign-1',
      name: 'Weekly Newsletter #1',
      sentAt: new Date('2024-01-15'),
      openRate: 32.1,
      clickRate: 5.8,
    },
    {
      id: 'campaign-2',
      name: 'Product Update',
      sentAt: new Date('2024-01-10'),
      openRate: 25.3,
      clickRate: 3.7,
    },
  ],
  performanceChart: [
    { date: '2024-01-01', sent: 5000, opened: 1400, clicked: 210 },
    { date: '2024-01-02', sent: 4800, opened: 1344, clicked: 192 },
    { date: '2024-01-03', sent: 5200, opened: 1508, clicked: 234 },
  ],
  topPerformingCampaigns: [
    {
      id: 'campaign-1',
      name: 'Weekly Newsletter #1',
      openRate: 32.1,
      clickRate: 5.8,
    },
    {
      id: 'campaign-3',
      name: 'Special Offer',
      openRate: 29.7,
      clickRate: 4.9,
    },
  ],
};

describe('Analytics Dashboard Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render dashboard with initial data', async () => {
    render(<AnalyticsDashboard initialData={mockDashboardData} />);

    // Check if main title is rendered
    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Track your newsletter performance and engagement')).toBeInTheDocument();

    // Check if metrics are displayed
    expect(screen.getByText('25')).toBeInTheDocument(); // Total campaigns
    expect(screen.getByText('125,000')).toBeInTheDocument(); // Total sent
    expect(screen.getByText('28.5%')).toBeInTheDocument(); // Average open rate
    expect(screen.getByText('4.2%')).toBeInTheDocument(); // Average click rate
  });

  it('should load data when no initial data provided', async () => {
    const mockGetDashboardData = vi.mocked(getDashboardData);
    mockGetDashboardData.mockResolvedValue({
      success: true,
      data: mockDashboardData,
    });

    render(<AnalyticsDashboard />);

    // Should show loading state initially
    expect(screen.getAllByText(/animate-pulse/)).toBeTruthy();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    expect(mockGetDashboardData).toHaveBeenCalledOnce();
  });

  it('should handle error state', async () => {
    const mockGetDashboardData = vi.mocked(getDashboardData);
    mockGetDashboardData.mockResolvedValue({
      success: false,
      error: 'Failed to load data',
    });

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  it('should refresh data when refresh button is clicked', async () => {
    const mockGetDashboardData = vi.mocked(getDashboardData);
    mockGetDashboardData.mockResolvedValue({
      success: true,
      data: mockDashboardData,
    });

    render(<AnalyticsDashboard initialData={mockDashboardData} />);

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockGetDashboardData).toHaveBeenCalledOnce();
    });
  });

  it('should switch between tabs', async () => {
    render(<AnalyticsDashboard initialData={mockDashboardData} />);

    // Check default tab
    expect(screen.getByText('Performance Overview')).toBeInTheDocument();

    // Switch to campaigns tab
    const campaignsTab = screen.getByText('Campaigns');
    fireEvent.click(campaignsTab);

    await waitFor(() => {
      expect(screen.getByText('Recent Campaigns')).toBeInTheDocument();
      expect(screen.getByText('Weekly Newsletter #1')).toBeInTheDocument();
    });

    // Switch to performance tab
    const performanceTab = screen.getByText('Performance');
    fireEvent.click(performanceTab);

    await waitFor(() => {
      expect(screen.getByText('Detailed Performance Metrics')).toBeInTheDocument();
    });
  });

  it('should handle date range changes', async () => {
    const mockGetDashboardData = vi.mocked(getDashboardData);
    mockGetDashboardData.mockResolvedValue({
      success: true,
      data: mockDashboardData,
    });

    render(<AnalyticsDashboard initialData={mockDashboardData} />);

    // Click on date range picker
    const dateRangePicker = screen.getByText(/Pick a date range|Jan 01, 2024/);
    fireEvent.click(dateRangePicker);

    // Should show preset options
    await waitFor(() => {
      expect(screen.getByText('Last 7 days')).toBeInTheDocument();
      expect(screen.getByText('Last 30 days')).toBeInTheDocument();
      expect(screen.getByText('Last 90 days')).toBeInTheDocument();
    });

    // Click on a preset
    const last7Days = screen.getByText('Last 7 days');
    fireEvent.click(last7Days);

    await waitFor(() => {
      expect(mockGetDashboardData).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        })
      );
    });
  });

  it('should auto-refresh data every 5 minutes', async () => {
    const mockGetDashboardData = vi.mocked(getDashboardData);
    mockGetDashboardData.mockResolvedValue({
      success: true,
      data: mockDashboardData,
    });

    // Mock timers
    vi.useFakeTimers();

    render(<AnalyticsDashboard initialData={mockDashboardData} />);

    // Fast-forward 5 minutes
    vi.advanceTimersByTime(5 * 60 * 1000);

    await waitFor(() => {
      expect(mockGetDashboardData).toHaveBeenCalledOnce();
    });

    vi.useRealTimers();
  });

  it('should display performance metrics correctly', async () => {
    render(<AnalyticsDashboard initialData={mockDashboardData} />);

    // Check metrics overview
    expect(screen.getByText('Total Campaigns')).toBeInTheDocument();
    expect(screen.getByText('Total Sent')).toBeInTheDocument();
    expect(screen.getByText('Average Open Rate')).toBeInTheDocument();
    expect(screen.getByText('Average Click Rate')).toBeInTheDocument();

    // Check if charts are rendered
    expect(screen.getByTestId('chart-container')).toBeInTheDocument();
  });

  it('should handle empty data gracefully', async () => {
    const emptyData: DashboardData = {
      totalCampaigns: 0,
      totalSent: 0,
      averageOpenRate: 0,
      averageClickRate: 0,
      recentCampaigns: [],
      performanceChart: [],
      topPerformingCampaigns: [],
    };

    render(<AnalyticsDashboard initialData={emptyData} />);

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('should show loading state for campaigns list', async () => {
    const mockGetDashboardData = vi.mocked(getDashboardData);
    mockGetDashboardData.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        success: true,
        data: mockDashboardData,
      }), 100))
    );

    render(<AnalyticsDashboard />);

    // Switch to campaigns tab while loading
    const campaignsTab = screen.getByText('Campaigns');
    fireEvent.click(campaignsTab);

    // Should show loading state
    expect(screen.getAllByText(/animate-pulse/)).toBeTruthy();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Recent Campaigns')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should handle network errors gracefully', async () => {
    const mockGetDashboardData = vi.mocked(getDashboardData);
    mockGetDashboardData.mockRejectedValue(new Error('Network error'));

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('An error occurred')).toBeInTheDocument();
    });
  });
});

describe('Analytics Dashboard Performance', () => {
  it('should handle large datasets efficiently', async () => {
    // Create large dataset
    const largePerformanceChart = Array.from({ length: 100 }, (_, i) => ({
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      sent: Math.floor(Math.random() * 10000),
      opened: Math.floor(Math.random() * 3000),
      clicked: Math.floor(Math.random() * 500),
    }));

    const largeCampaignsList = Array.from({ length: 50 }, (_, i) => ({
      id: `campaign-${i}`,
      name: `Campaign ${i}`,
      sentAt: new Date(`2024-01-${String((i % 30) + 1).padStart(2, '0')}`),
      openRate: Math.random() * 50,
      clickRate: Math.random() * 10,
    }));

    const largeData: DashboardData = {
      ...mockDashboardData,
      performanceChart: largePerformanceChart,
      recentCampaigns: largeCampaignsList,
    };

    const startTime = performance.now();
    render(<AnalyticsDashboard initialData={largeData} />);
    const endTime = performance.now();

    // Should render within reasonable time (less than 1 second)
    expect(endTime - startTime).toBeLessThan(1000);

    // Should still display data correctly
    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
  });

  it('should debounce rapid refresh requests', async () => {
    const mockGetDashboardData = vi.mocked(getDashboardData);
    mockGetDashboardData.mockResolvedValue({
      success: true,
      data: mockDashboardData,
    });

    render(<AnalyticsDashboard initialData={mockDashboardData} />);

    const refreshButton = screen.getByText('Refresh');

    // Click refresh multiple times rapidly
    fireEvent.click(refreshButton);
    fireEvent.click(refreshButton);
    fireEvent.click(refreshButton);

    await waitFor(() => {
      // Should only call the API once due to loading state
      expect(mockGetDashboardData).toHaveBeenCalledTimes(1);
    });
  });
});