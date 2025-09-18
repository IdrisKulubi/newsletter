import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { TenantProvider, useTenant, useRequiredTenant } from '../tenant-context';
import { Tenant } from '@/lib/db/schema/tenants';

// Mock fetch
global.fetch = vi.fn();

// Mock document.cookie
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: '',
});

// Test component that uses the tenant context
function TestComponent() {
  const { tenant, isLoading, error } = useTenant();
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!tenant) return <div>No tenant</div>;
  
  return <div>Tenant: {tenant.name}</div>;
}

function RequiredTenantTestComponent() {
  try {
    const tenant = useRequiredTenant();
    return <div>Required Tenant: {tenant.name}</div>;
  } catch (error) {
    return <div>Error: {(error as Error).message}</div>;
  }
}

describe('TenantContext', () => {
  const mockTenant: Tenant = {
    id: 'tenant-1',
    name: 'Test Company',
    domain: 'test.newsletter.com',
    customDomain: null,
    settings: {},
    subscription: { plan: 'free', status: 'active' },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = '';
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('TenantProvider with initial tenant', () => {
    it('should provide initial tenant data', () => {
      render(
        <TenantProvider initialTenant={mockTenant}>
          <TestComponent />
        </TenantProvider>
      );

      expect(screen.getByText('Tenant: Test Company')).toBeInTheDocument();
    });

    it('should not fetch tenant when initial tenant is provided', () => {
      render(
        <TenantProvider initialTenant={mockTenant}>
          <TestComponent />
        </TenantProvider>
      );

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('TenantProvider without initial tenant', () => {
    it('should show loading state initially', () => {
      // Mock cookie with tenant ID
      document.cookie = 'tenant-id=tenant-1';
      
      // Mock fetch to never resolve (simulate loading)
      (fetch as any).mockImplementation(() => new Promise(() => {}));

      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should fetch tenant data when tenant ID is in cookie', async () => {
      document.cookie = 'tenant-id=tenant-1';
      
      (fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTenant),
      });

      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Tenant: Test Company')).toBeInTheDocument();
      });

      expect(fetch).toHaveBeenCalledWith('/api/tenants/current', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should show no tenant when no tenant ID in cookie', async () => {
      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('No tenant')).toBeInTheDocument();
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should handle 404 error gracefully', async () => {
      document.cookie = 'tenant-id=tenant-1';
      
      (fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Error: Tenant not found')).toBeInTheDocument();
      });
    });

    it('should handle fetch errors', async () => {
      document.cookie = 'tenant-id=tenant-1';
      
      (fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Error: Failed to fetch tenant: Internal Server Error')).toBeInTheDocument();
      });
    });

    it('should handle network errors', async () => {
      document.cookie = 'tenant-id=tenant-1';
      
      (fetch as any).mockRejectedValue(new Error('Network error'));

      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Error: Network error')).toBeInTheDocument();
      });
    });
  });

  describe('useRequiredTenant hook', () => {
    it('should return tenant when available', () => {
      render(
        <TenantProvider initialTenant={mockTenant}>
          <RequiredTenantTestComponent />
        </TenantProvider>
      );

      expect(screen.getByText('Required Tenant: Test Company')).toBeInTheDocument();
    });

    it('should throw error when tenant is loading', () => {
      document.cookie = 'tenant-id=tenant-1';
      (fetch as any).mockImplementation(() => new Promise(() => {}));

      render(
        <TenantProvider>
          <RequiredTenantTestComponent />
        </TenantProvider>
      );

      expect(screen.getByText('Error: Tenant is still loading')).toBeInTheDocument();
    });

    it('should throw error when there is an error', async () => {
      document.cookie = 'tenant-id=tenant-1';
      (fetch as any).mockRejectedValue(new Error('Network error'));

      render(
        <TenantProvider>
          <RequiredTenantTestComponent />
        </TenantProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Error: Tenant error: Network error')).toBeInTheDocument();
      });
    });

    it('should throw error when no tenant found', async () => {
      render(
        <TenantProvider>
          <RequiredTenantTestComponent />
        </TenantProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Error: No tenant found')).toBeInTheDocument();
      });
    });
  });

  describe('tenant change events', () => {
    it('should refetch tenant when tenant-changed event is dispatched', async () => {
      document.cookie = 'tenant-id=tenant-1';
      
      (fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTenant),
      });

      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Tenant: Test Company')).toBeInTheDocument();
      });

      // Clear the mock and set up new response
      vi.clearAllMocks();
      const updatedTenant = { ...mockTenant, name: 'Updated Company' };
      (fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updatedTenant),
      });

      // Dispatch tenant change event
      act(() => {
        window.dispatchEvent(new CustomEvent('tenant-changed'));
      });

      await waitFor(() => {
        expect(screen.getByText('Tenant: Updated Company')).toBeInTheDocument();
      });

      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should throw error when useTenant is used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useTenant must be used within a TenantProvider');

      consoleSpy.mockRestore();
    });
  });
});