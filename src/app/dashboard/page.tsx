import { auth } from '@/lib/auth/config';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { UserMenu } from '@/components/auth/user-menu';
import { AdminOnly, EditorOnly } from '@/components/auth/role-guard';
import { AuthProvider } from '@/contexts/auth-context';
import { TenantProvider } from '@/contexts/tenant-context';

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect('/auth/signin');
  }

  return (
    <AuthProvider initialUser={session.user}>
      <TenantProvider>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white shadow">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-6">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Newsletter Dashboard
                  </h1>
                  <p className="text-gray-600">Welcome back, {session.user.name}</p>
                </div>
                <UserMenu user={session.user} />
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Admin Only Section */}
                <AdminOnly>
                  <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold">A</span>
                          </div>
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">
                              Admin Features
                            </dt>
                            <dd className="text-lg font-medium text-gray-900">
                              User Management
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>
                </AdminOnly>

                {/* Editor and above */}
                <EditorOnly>
                  <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold">E</span>
                          </div>
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">
                              Editor Features
                            </dt>
                            <dd className="text-lg font-medium text-gray-900">
                              Create Campaigns
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>
                </EditorOnly>

                {/* All users */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold">V</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Viewer Features
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            View Analytics
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <div className="bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      User Information
                    </h3>
                    <div className="mt-5">
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Name</dt>
                          <dd className="mt-1 text-sm text-gray-900">{session.user.name}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Email</dt>
                          <dd className="mt-1 text-sm text-gray-900">{session.user.email}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Role</dt>
                          <dd className="mt-1 text-sm text-gray-900 capitalize">{session.user.role}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">User ID</dt>
                          <dd className="mt-1 text-sm text-gray-900 font-mono">{session.user.id}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </TenantProvider>
    </AuthProvider>
  );
}