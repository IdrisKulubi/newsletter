import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { headers } from 'next/headers';
import { SettingsLayout } from '@/components/settings/settings-layout';
import { ProfileSettings } from '@/components/settings/profile-settings';
import { SecuritySettings } from '@/components/settings/security-settings';
import { NotificationSettings } from '@/components/settings/notification-settings';
import { TenantSettings } from '@/components/settings/tenant-settings';
import { UserManagement } from '@/components/settings/user-management';
import { BillingSettings } from '@/components/settings/billing-settings';

async function getUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session) {
    redirect('/auth/sign-in');
  }
  
  return session.user;
}

interface SettingsPageProps {
  searchParams: {
    tab?: string;
  };
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const user = await getUser();
  const activeTab = searchParams.tab || 'profile';
  
  // Role-based tab access
  const getAvailableTabs = (userRole: string) => {
    const baseTabs = [
      { id: 'profile', label: 'Profile', description: 'Manage your personal information' },
      { id: 'security', label: 'Security', description: 'Password and authentication settings' },
      { id: 'notifications', label: 'Notifications', description: 'Email and push notification preferences' },
    ];
    
    if (userRole === 'admin') {
      return [
        ...baseTabs,
        { id: 'tenant', label: 'Organization', description: 'Manage organization settings and branding' },
        { id: 'users', label: 'User Management', description: 'Manage team members and permissions' },
        { id: 'billing', label: 'Billing', description: 'Subscription and payment settings' },
      ];
    }
    
    if (userRole === 'editor') {
      return [
        ...baseTabs,
        { id: 'tenant', label: 'Organization', description: 'View organization settings' },
      ];
    }
    
    // Viewer role gets only basic tabs
    return baseTabs;
  };

  const availableTabs = getAvailableTabs(user.role);
  const isValidTab = availableTabs.some(tab => tab.id === activeTab);
  
  if (!isValidTab) {
    redirect('/dashboard/settings?tab=profile');
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileSettings user={user} />;
      case 'security':
        return <SecuritySettings user={user} />;
      case 'notifications':
        return <NotificationSettings user={user} />;
      case 'tenant':
        return <TenantSettings user={user} canEdit={user.role === 'admin'} />;
      case 'users':
        return user.role === 'admin' ? <UserManagement user={user} /> : null;
      case 'billing':
        return user.role === 'admin' ? <BillingSettings user={user} /> : null;
      default:
        return <ProfileSettings user={user} />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <SettingsLayout 
        tabs={availableTabs} 
        activeTab={activeTab}
        userRole={user.role}
      >
        <Suspense fallback={<div>Loading settings...</div>}>
          {renderTabContent()}
        </Suspense>
      </SettingsLayout>
    </div>
  );
}