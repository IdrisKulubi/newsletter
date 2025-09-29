import { auth } from '@/lib/auth/config';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { UserManagement } from '@/components/auth/user-management';
import { AuthProvider } from '@/contexts/auth-context';
import { TenantProvider } from '@/contexts/tenant-context';

export default async function UsersPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect('/auth/signin');
  }

  // Check if user is admin
  const currentUser = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!currentUser[0] || currentUser[0].role !== 'admin') {
    redirect('/dashboard');
  }

  // Get all users in the same tenant
  const tenantUsers = await db
    .select()
    .from(users)
    .where(eq(users.tenantId, currentUser[0].tenantId!))
    .orderBy(users.createdAt);

  return (
    <AuthProvider initialUser={session.user}>
      <TenantProvider>
          <UserManagement users={tenantUsers} currentUserId={session.user.id} />
      </TenantProvider>
    </AuthProvider>
  );
}