import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, FileText, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NewsletterService } from '@/lib/services/newsletter';
import { auth } from '@/lib/auth/config';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthProvider } from '@/contexts/auth-context';
import { TenantProvider } from '@/contexts/tenant-context';
async function NewsletterList() {
  const { newsletters, total } = await NewsletterService.list({
    limit: 20,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });

  const stats = await NewsletterService.getStats();

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Newsletters</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draft}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Review</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.review}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approved}</div>
          </CardContent>
        </Card>
      </div>

      {/* Newsletter List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Newsletters</CardTitle>
              <CardDescription>
                Manage your newsletter content and campaigns
              </CardDescription>
            </div>
            <Link href="/dashboard/newsletters/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Newsletter
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {newsletters.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No newsletters yet</h3>
              <p className="text-muted-foreground mb-4">
                Get started by creating your first newsletter
              </p>
              <Link href="/dashboard/newsletters/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Newsletter
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {newsletters.map((newsletter) => (
                <div
                  key={newsletter.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">{newsletter.title}</h3>
                      <Badge
                        variant={
                          newsletter.status === 'approved'
                            ? 'default'
                            : newsletter.status === 'review'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {newsletter.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {newsletter.metadata?.description || 'No description'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Updated {newsletter.updatedAt.toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/newsletters/${newsletter.id}`}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                    <Link href={`/dashboard/newsletters/${newsletter.id}/edit`}>
                      <Button size="sm">
                        Edit
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default async function NewslettersPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect('/auth/signin');
  }

  return (
    <AuthProvider initialUser={session.user}>
      <TenantProvider>
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold">Newsletters</h1>
              <p className="text-muted-foreground">
                Create and manage your newsletter content
              </p>
            </div>

            <Suspense fallback={<div>Loading newsletters...</div>}>
              <NewsletterList />
            </Suspense>
          </div>
      </TenantProvider>
    </AuthProvider>
  );
}