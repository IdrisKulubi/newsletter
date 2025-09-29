'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  User, 
  Shield, 
  Bell, 
  Building, 
  Users, 
  CreditCard,
  Settings as SettingsIcon
} from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  description: string;
}

interface SettingsLayoutProps {
  tabs: Tab[];
  activeTab: string;
  userRole: string;
  children: React.ReactNode;
}

const tabIcons = {
  profile: User,
  security: Shield,
  notifications: Bell,
  tenant: Building,
  users: Users,
  billing: CreditCard,
};

export function SettingsLayout({ tabs, activeTab, userRole, children }: SettingsLayoutProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tabId);
    router.push(`/dashboard/settings?${params.toString()}`);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'editor':
        return 'secondary';
      case 'viewer':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar Navigation */}
      <div className="lg:w-72 space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <SettingsIcon className="h-5 w-5" />
              <span className="font-medium">Settings</span>
              <Badge variant={getRoleBadgeVariant(userRole)} className="ml-auto">
                {userRole}
              </Badge>
            </div>
            
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tabIcons[tab.id as keyof typeof tabIcons] || SettingsIcon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={cn(
                      'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors',
                      isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{tab.label}</div>
                      <div className={cn(
                        'text-xs mt-1 line-clamp-2',
                        isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      )}>
                        {tab.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </CardContent>
        </Card>

        {/* Role Information Card */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium mb-2">Your Access Level</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              {userRole === 'admin' && (
                <div>
                  <Badge variant="default" className="mb-2">Administrator</Badge>
                  <p>Full access to all settings, user management, and billing.</p>
                </div>
              )}
              {userRole === 'editor' && (
                <div>
                  <Badge variant="secondary" className="mb-2">Editor</Badge>
                  <p>Can manage content and view organization settings.</p>
                </div>
              )}
              {userRole === 'viewer' && (
                <div>
                  <Badge variant="outline" className="mb-2">Viewer</Badge>
                  <p>Can view content and manage personal settings only.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <Card>
          <CardContent className="p-6">
            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}