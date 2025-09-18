import { auth } from '@/lib/auth/config';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { UserManagement } from '@/components/auth/user-management';

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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                User Management
              </h1>
              <p className="text-gray-600">Manage users and their roles</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <UserManagement users={tenantUsers} currentUserId={session.user.id} />
        </div>
      </main>
    </div>
  );
}