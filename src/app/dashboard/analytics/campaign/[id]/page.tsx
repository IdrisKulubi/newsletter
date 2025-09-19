import { auth } from '@/lib/auth/config';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthProvider } from '@/contexts/auth-context';
import { TenantProvider } from '@/contexts/tenant-context';
import { CampaignReportComponent } from '@/components/analytics/campaign-report';
import { getCampaignReport } from '@/lib/actions/analytics/get-campaign-report';

interface CampaignReportPageProps {
  params: {
    id: string;
  };
}

export default async function CampaignReportPage({ params }: CampaignReportPageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect('/auth/signin');
  }

  // Pre-load campaign report data
  const reportResult = await getCampaignReport(params.id);
  const initialData = reportResult.success ? reportResult.data : undefined;

  return (
    <AuthProvider initialUser={session.user}>
      <TenantProvider>
        <div className="min-h-screen bg-background">
          <div className="container mx-auto py-6">
            <CampaignReportComponent 
              campaignId={params.id} 
              initialData={initialData} 
            />
          </div>
        </div>
      </TenantProvider>
    </AuthProvider>
  );
}