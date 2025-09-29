import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { headers } from 'next/headers';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';

async function getUser() {
  const session = await auth.api.getSession({
    headers: headers(),
  });
  
  if (!session) {
    redirect('/auth/sign-in');
  }
  
  return session.user;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <DashboardHeader user={user} />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}