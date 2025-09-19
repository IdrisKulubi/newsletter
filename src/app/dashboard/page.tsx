import { auth } from '@/lib/auth/config';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminOnly, EditorOnly } from '@/components/auth/role-guard';
import { AuthProvider } from '@/contexts/auth-context';
import { TenantProvider } from '@/contexts/tenant-context';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Send, 
  BarChart3, 
  Users, 
  TrendingUp, 
  Plus,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect('/auth/signin');
  }

  // Mock data - in real app this would come from database
  const stats = {
    newsletters: { total: 12, draft: 3 },
    campaigns: { total: 8, scheduled: 2, sent: 5 },
    analytics: { openRate: 24.5, clickRate: 8.2 },
    users: { total: 15, active: 12 }
  };

  const recentActivity = [
    { type: 'campaign', title: 'Weekly Newsletter #42', status: 'sent', time: '2 hours ago' },
    { type: 'newsletter', title: 'Product Update Draft', status: 'draft', time: '4 hours ago' },
    { type: 'user', title: 'New user invited', status: 'pending', time: '1 day ago' },
    { type: 'campaign', title: 'Monthly Report', status: 'scheduled', time: '2 days ago' },
  ];

  return (
    <AuthProvider initialUser={session.user}>
      <TenantProvider>
        <DashboardLayout
          user={{
            ...session.user,
            tenantId: session.user.tenantId ?? null,
            image: session.user.image ?? null,
            lastLoginAt: session.user.lastLoginAt ?? null,
          } as any}
        >
          <div className="space-y-6">
            {/* Welcome Section */}
            <div>
              <h1 className="text-3xl font-bold">Welcome back, {session.user.name}!</h1>
              <p className="text-muted-foreground">
                Here's what's happening with your newsletter platform today.
              </p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Newsletters</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.newsletters.total}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.newsletters.draft} in draft
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Campaigns</CardTitle>
                  <Send className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.campaigns.total}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.campaigns.scheduled} scheduled
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.analytics.openRate}%</div>
                  <p className="text-xs text-muted-foreground">
                    +2.1% from last month
                  </p>
                </CardContent>
              </Card>

              <AdminOnly>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Team Members</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.users.total}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.users.active} active
                    </p>
                  </CardContent>
                </Card>
              </AdminOnly>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>
                    Common tasks to get you started
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <EditorOnly>
                    <Link href="/dashboard/newsletters/new">
                      <Button className="w-full justify-start" variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        Create New Newsletter
                        <ArrowRight className="ml-auto h-4 w-4" />
                      </Button>
                    </Link>
                  </EditorOnly>
                  
                  <EditorOnly>
                    <Link href="/dashboard/campaigns/new">
                      <Button className="w-full justify-start" variant="outline">
                        <Send className="mr-2 h-4 w-4" />
                        Start New Campaign
                        <ArrowRight className="ml-auto h-4 w-4" />
                      </Button>
                    </Link>
                  </EditorOnly>

                  <Link href="/dashboard/analytics">
                    <Button className="w-full justify-start" variant="outline">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      View Analytics
                      <ArrowRight className="ml-auto h-4 w-4" />
                    </Button>
                  </Link>

                  <AdminOnly>
                    <Link href="/dashboard/users">
                      <Button className="w-full justify-start" variant="outline">
                        <Users className="mr-2 h-4 w-4" />
                        Manage Users
                        <ArrowRight className="ml-auto h-4 w-4" />
                      </Button>
                    </Link>
                  </AdminOnly>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>
                    Latest updates across your workspace
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          {activity.type === 'campaign' && <Send className="h-4 w-4 text-blue-500" />}
                          {activity.type === 'newsletter' && <FileText className="h-4 w-4 text-green-500" />}
                          {activity.type === 'user' && <Users className="h-4 w-4 text-purple-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {activity.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {activity.time}
                          </p>
                        </div>
                        <Badge variant={
                          activity.status === 'sent' ? 'default' :
                          activity.status === 'scheduled' ? 'secondary' :
                          activity.status === 'draft' ? 'outline' : 'secondary'
                        }>
                          {activity.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Role-specific sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <AdminOnly>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Users className="mr-2 h-5 w-5" />
                      Admin Panel
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Manage users, settings, and workspace configuration.
                    </p>
                    <Link href="/dashboard/users">
                      <Button size="sm">
                        Manage Users
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </AdminOnly>

              <EditorOnly>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <FileText className="mr-2 h-5 w-5" />
                      Content Creation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create and manage newsletter content and campaigns.
                    </p>
                    <div className="flex gap-2">
                      <Link href="/dashboard/newsletters">
                        <Button size="sm" variant="outline">
                          Newsletters
                        </Button>
                      </Link>
                      <Link href="/dashboard/campaigns">
                        <Button size="sm" variant="outline">
                          Campaigns
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </EditorOnly>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="mr-2 h-5 w-5" />
                    Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Track engagement and campaign performance.
                  </p>
                  <Link href="/dashboard/analytics">
                    <Button size="sm">
                      View Analytics
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </DashboardLayout>
      </TenantProvider>
    </AuthProvider>
  );
}