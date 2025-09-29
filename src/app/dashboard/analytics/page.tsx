import { auth } from '@/lib/auth/config';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthProvider } from '@/contexts/auth-context';
import { TenantProvider } from '@/contexts/tenant-context';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';
import { getDashboardData } from '@/lib/actions/analytics/get-dashboard-data';

export default async function AnalyticsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect('/auth/signin');
  }

  // Pre-load dashboard data for better performance
  const dashboardResult = await getDashboardData();
  const initialData = dashboardResult.success ? dashboardResult.data : undefined;

  return (
    <AuthProvider initialUser={session.user}>
      <TenantProvider>
          <AnalyticsDashboard initialData={initialData} />
      </TenantProvider>
    </AuthProvider>
  );
}