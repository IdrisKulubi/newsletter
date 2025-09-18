'use client';

import React from 'react';
import { useTenant, useRequiredTenant } from '@/contexts/tenant-context';

/**
 * Example component showing how to use tenant context
 */
export function TenantAwareComponent() {
  const { tenant, isLoading, error } = useTenant();

  if (isLoading) {
    return <div>Loading tenant information...</div>;
  }

  if (error) {
    return <div>Error loading tenant: {error}</div>;
  }

  if (!tenant) {
    return <div>No tenant found</div>;
  }

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-xl font-bold mb-2">Tenant Information</h2>
      <div className="space-y-2">
        <p><strong>Name:</strong> {tenant.name}</p>
        <p><strong>Domain:</strong> {tenant.domain}</p>
        {tenant.customDomain && (
          <p><strong>Custom Domain:</strong> {tenant.customDomain}</p>
        )}
        <p><strong>Plan:</strong> {tenant.subscription?.plan}</p>
        <p><strong>Status:</strong> {tenant.subscription?.status}</p>
      </div>
    </div>
  );
}

/**
 * Example component that requires a tenant (throws if none)
 */
export function RequiredTenantComponent() {
  const tenant = useRequiredTenant();

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <h3 className="text-lg font-semibold text-blue-800">
        Welcome to {tenant.name}!
      </h3>
      <p className="text-blue-600">
        You are accessing the tenant dashboard for {tenant.domain}
      </p>
    </div>
  );
}

/**
 * Example of tenant-specific styling
 */
export function TenantBrandedComponent() {
  const { tenant } = useTenant();

  const primaryColor = tenant?.settings?.branding?.primaryColor || '#3b82f6';
  const secondaryColor = tenant?.settings?.branding?.secondaryColor || '#64748b';

  return (
    <div 
      className="p-6 rounded-lg"
      style={{ 
        backgroundColor: `${primaryColor}10`,
        borderColor: primaryColor,
        borderWidth: '2px'
      }}
    >
      <h2 
        className="text-2xl font-bold mb-4"
        style={{ color: primaryColor }}
      >
        {tenant?.name || 'Newsletter Platform'}
      </h2>
      <p style={{ color: secondaryColor }}>
        This component adapts its styling based on the tenant's branding settings.
      </p>
    </div>
  );
}

/**
 * Example server action that uses tenant context
 */
export async function createTenantSpecificContent(formData: FormData) {
  'use server';
  
  // In a real server action, you would get tenant ID from headers
  // const tenantId = headers().get('x-tenant-id');
  
  const title = formData.get('title') as string;
  const content = formData.get('content') as string;
  
  // Here you would use the tenant service to create content
  // within the tenant's context
  console.log('Creating content for tenant:', { title, content });
  
  return { success: true };
}

/**
 * Example usage in a page component
 */
export default function ExamplePage() {
  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">Multi-Tenant Example</h1>
      
      <TenantAwareComponent />
      
      <RequiredTenantComponent />
      
      <TenantBrandedComponent />
      
      <form action={createTenantSpecificContent} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium">
            Title
          </label>
          <input
            type="text"
            id="title"
            name="title"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            required
          />
        </div>
        
        <div>
          <label htmlFor="content" className="block text-sm font-medium">
            Content
          </label>
          <textarea
            id="content"
            name="content"
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            required
          />
        </div>
        
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Create Content
        </button>
      </form>
    </div>
  );
}