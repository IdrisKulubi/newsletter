'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { UserMenu } from '@/components/auth/user-menu';
import { ModeToggle } from '@/components/themes/mode-toggle';
import { 
  BarChart3, 
  FileText, 
  Send, 
  Users, 
  Settings, 
  Menu,
  Home,
  PlusCircle,
  TrendingUp
} from 'lucide-react';
import { User } from '@/lib/db/schema';

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: User;
}

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: Home },
  { name: 'Newsletters', href: '/dashboard/newsletters', icon: FileText },
  { name: 'Campaigns', href: '/dashboard/campaigns', icon: Send },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Users', href: '/dashboard/users', icon: Users, adminOnly: true },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

const quickActions = [
  { name: 'New Newsletter', href: '/dashboard/newsletters/new', icon: PlusCircle },
  { name: 'New Campaign', href: '/dashboard/campaigns/new', icon: Send },
  { name: 'View Analytics', href: '/dashboard/analytics', icon: TrendingUp },
];

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const filteredNavigation = navigation.filter(item => 
    !item.adminOnly || user.role === 'admin'
  );

  return (
    <div className="min-h-screen bg-background">
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        {/* Mobile sidebar */}
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center border-b px-6">
              <Link href="/dashboard" className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">N</span>
                </div>
                <span className="font-semibold">Newsletter</span>
              </Link>
            </div>
            <nav className="flex-1 space-y-1 px-3 py-4">
              {filteredNavigation.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="mr-3 h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            
            {/* Quick Actions */}
            <div className="border-t px-3 py-4">
              <h3 className="mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Quick Actions
              </h3>
              <div className="space-y-1">
                {quickActions.map((action) => (
                  <Link
                    key={action.name}
                    href={action.href}
                    className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <action.icon className="mr-3 h-4 w-4" />
                    {action.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </SheetContent>

        {/* Desktop sidebar */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
          <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r bg-card px-6">
            <div className="flex h-16 shrink-0 items-center">
              <Link href="/dashboard" className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">N</span>
                </div>
                <span className="font-semibold">Newsletter</span>
              </Link>
            </div>
            <nav className="flex flex-1 flex-col">
              <ul role="list" className="flex flex-1 flex-col gap-y-7">
                <li>
                  <ul role="list" className="-mx-2 space-y-1">
                    {filteredNavigation.map((item) => {
                      const isActive = pathname === item.href || 
                        (item.href !== '/dashboard' && pathname.startsWith(item.href));
                      
                      return (
                        <li key={item.name}>
                          <Link
                            href={item.href}
                            className={cn(
                              'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors',
                              isActive
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            )}
                          >
                            <item.icon className="h-5 w-5 shrink-0" />
                            {item.name}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
                
                {/* Quick Actions */}
                <li>
                  <div className="text-xs font-semibold leading-6 text-muted-foreground">
                    Quick Actions
                  </div>
                  <ul role="list" className="-mx-2 mt-2 space-y-1">
                    {quickActions.map((action) => (
                      <li key={action.name}>
                        <Link
                          href={action.href}
                          className="group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          <action.icon className="h-5 w-5 shrink-0" />
                          {action.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:pl-64">
          {/* Top navigation */}
          <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b bg-background px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="lg:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open sidebar</span>
              </Button>
            </SheetTrigger>

            {/* Separator */}
            <div className="h-6 w-px bg-border lg:hidden" />

            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
              <div className="flex flex-1 items-center">
                {/* Breadcrumb or page title could go here */}
              </div>
              <div className="flex items-center gap-x-4 lg:gap-x-6">
                <ModeToggle />
                <UserMenu user={user} />
              </div>
            </div>
          </div>

          {/* Page content */}
          <main className="py-6">
            <div className="px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </Sheet>
    </div>
  );
}