'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Tenant } from '@/lib/db/schema';

interface TenantContextType {
  tenant: Tenant | null;
  isLoading: boolean;
  error: string | null;
  refetchTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

interface TenantProviderProps {
  children: React.ReactNode;
  initialTenant?: Tenant | null;
}

export function TenantProvider({ children, initialTenant }: TenantProviderProps) {
  const [tenant, setTenant] = useState<Tenant | null>(initialTenant || null);
  const [isLoading, setIsLoading] = useState(!initialTenant);
  const [error, setError] = useState<string | null>(null);

  const fetchTenant = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/tenant/current');
      if (!response.ok) {
        throw new Error('Failed to fetch tenant');
      }
      
      const tenantData = await response.json();
      setTenant(tenantData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setTenant(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refetchTenant = async () => {
    await fetchTenant();
  };

  useEffect(() => {
    if (!initialTenant) {
      fetchTenant();
    }
  }, [initialTenant]);

  const value: TenantContextType = {
    tenant,
    isLoading,
    error,
    refetchTenant,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

// Hook for getting tenant-aware API endpoints
export function useTenantApi() {
  const { tenant } = useTenant();
  
  const getApiUrl = (path: string) => {
    if (!tenant) return path;
    return path.startsWith('/api') ? path : `/api${path}`;
  };

  return { getApiUrl, tenantId: tenant?.id };
}