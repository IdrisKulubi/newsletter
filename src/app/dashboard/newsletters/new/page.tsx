import { auth } from '@/lib/auth/config';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthProvider } from '@/contexts/auth-context';
import { TenantProvider } from '@/contexts/tenant-context';
import { NewsletterEditorPage } from '@/components/newsletter/newsletter-editor-page';

export default async function NewNewsletterPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect('/auth/signin');
  }

  // Check if user has editor permissions
  if (session.user.role === 'viewer') {
    redirect('/dashboard');
  }

  return (
    <AuthProvider initialUser={session.user}>
      <TenantProvider>
          <NewsletterEditorPage />
      </TenantProvider>
    </AuthProvider>
  );
}