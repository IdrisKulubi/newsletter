'use client';

import Link from 'next/link';
import { UserMenu } from '@/components/auth/user-menu';
import { ModeToggle } from '@/components/themes/mode-toggle';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import type { User as AuthUser } from '@/lib/auth/config';

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: AuthUser;
}

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar user={user as any} />
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b bg-background px-4 shadow-sm sm:gap-x-6 sm:px-6">
          <SidebarTrigger />
          <div className="h-6 w-px bg-border" />
          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1 items-center">
              {/* Breadcrumb or page title could go here */}
            </div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <ModeToggle />
              <UserMenu user={user as any} />
            </div>
          </div>
        </header>
        <main className="py-6">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
