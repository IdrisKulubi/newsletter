'use client';

import { useState } from 'react';
import { User } from '@/lib/auth/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  CreditCard, 
  Download, 
  Calendar, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Zap,
  Users,
  Mail
} from 'lucide-react';
import { toast } from 'sonner';

interface BillingSettingsProps {
  user: User;
}

interface Subscription {
  plan: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'cancelled' | 'past_due';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  price: number;
  currency: string;
}

interface Usage {
  emailsSent: number;
  emailsLimit: number;
  subscribers: number;
  subscribersLimit: number;
  teamMembers: number;
  teamMembersLimit: number;
}

interface Invoice {
  id: string;
  date: Date;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  downloadUrl: string;
}

export function BillingSettings({ user }: BillingSettingsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);

  // Mock subscription data
  const [subscription] = useState<Subscription>({
    plan: 'professional',
    status: 'active',
    currentPeriodStart: new Date('2024-01-01'),
    currentPeriodEnd: new Date('2024-02-01'),
    cancelAtPeriodEnd: false,
    price: 49,
    currency: 'USD',
  });

  // Mock usage data
  const [usage] = useState<Usage>({
    emailsSent: 12500,
    emailsLimit: 25000,
    subscribers: 1850,
    subscribersLimit: 5000,
    teamMembers: 3,
    teamMembersLimit: 10,
  });

  // Mock invoices data
  const [invoices] = useState<Invoice[]>([
    {
      id: 'inv_001',
      date: new Date('2024-01-01'),
      amount: 49,
      status: 'paid',
      downloadUrl: '#',
    },
    {
      id: 'inv_002',
      date: new Date('2023-12-01'),
      amount: 49,
      status: 'paid',
      downloadUrl: '#',
    },
    {
      id: 'inv_003',
      date: new Date('2023-11-01'),
      amount: 49,
      status: 'paid',
      downloadUrl: '#',
    },
  ]);

  const plans = [
    {
      name: 'Starter',
      price: 19,
      features: [
        '5,000 emails/month',
        '1,000 subscribers',
        '3 team members',
        'Basic analytics',
        'Email support',
      ],
    },
    {
      name: 'Professional',
      price: 49,
      features: [
        '25,000 emails/month',
        '5,000 subscribers',
        '10 team members',
        'Advanced analytics',
        'AI features',
        'Priority support',
      ],
    },
    {
      name: 'Enterprise',
      price: 149,
      features: [
        'Unlimited emails',
        'Unlimited subscribers',
        'Unlimited team members',
        'Custom integrations',
        'Dedicated support',
        'SLA guarantee',
      ],
    },
  ];

  const handleCancelSubscription = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement subscription cancellation API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Subscription will be cancelled at the end of the billing period');
    } catch (error) {
      toast.error('Failed to cancel subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgradePlan = async (planName: string) => {
    setIsLoading(true);
    try {
      // TODO: Implement plan upgrade API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success(`Successfully upgraded to ${planName} plan`);
      setIsUpgradeDialogOpen(false);
    } catch (error) {
      toast.error('Failed to upgrade plan');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      case 'past_due':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Past Due</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getUsagePercentage = (used: number, limit: number) => {
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Billing & Subscription</h2>
        <p className="text-muted-foreground">
          Manage your subscription, billing, and usage
        </p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan
          </CardTitle>
          <CardDescription>
            Your current subscription details and status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold capitalize">{subscription.plan}</span>
                {getStatusBadge(subscription.status)}
              </div>
              <p className="text-muted-foreground">
                ${subscription.price}/{subscription.currency} per month
              </p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-sm text-muted-foreground">Next billing date</p>
              <p className="font-medium">{subscription.currentPeriodEnd.toLocaleDateString()}</p>
            </div>
          </div>

          <Separator />

          <div className="flex gap-2">
            <Dialog open={isUpgradeDialogOpen} onOpenChange={setIsUpgradeDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Zap className="h-4 w-4 mr-2" />
                  Upgrade Plan
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Choose Your Plan</DialogTitle>
                  <DialogDescription>
                    Select the plan that best fits your needs
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {plans.map((plan) => (
                    <Card key={plan.name} className={plan.name.toLowerCase() === subscription.plan ? 'border-primary' : ''}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          {plan.name}
                          {plan.name.toLowerCase() === subscription.plan && (
                            <Badge>Current</Badge>
                          )}
                        </CardTitle>
                        <div className="text-3xl font-bold">${plan.price}<span className="text-sm font-normal">/month</span></div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <ul className="space-y-2">
                          {plan.features.map((feature, index) => (
                            <li key={index} className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                        <Button 
                          className="w-full" 
                          variant={plan.name.toLowerCase() === subscription.plan ? 'outline' : 'default'}
                          disabled={plan.name.toLowerCase() === subscription.plan || isLoading}
                          onClick={() => handleUpgradePlan(plan.name)}
                        >
                          {plan.name.toLowerCase() === subscription.plan ? 'Current Plan' : 'Select Plan'}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsUpgradeDialogOpen(false)}>
                    Cancel
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <Button variant="outline" onClick={handleCancelSubscription} disabled={isLoading}>
              Cancel Subscription
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Usage Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Usage Overview
          </CardTitle>
          <CardDescription>
            Your current usage for this billing period
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span className="font-medium">Emails Sent</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usage.emailsSent.toLocaleString()} / {usage.emailsLimit.toLocaleString()}
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(usage.emailsSent, usage.emailsLimit)} 
                className="h-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">Subscribers</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usage.subscribers.toLocaleString()} / {usage.subscribersLimit.toLocaleString()}
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(usage.subscribers, usage.subscribersLimit)} 
                className="h-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">Team Members</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usage.teamMembers} / {usage.teamMembersLimit}
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(usage.teamMembers, usage.teamMembersLimit)} 
                className="h-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
          <CardDescription>
            Manage your payment information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-6 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">VISA</span>
              </div>
              <div>
                <p className="font-medium">•••• •••• •••• 4242</p>
                <p className="text-sm text-muted-foreground">Expires 12/25</p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Update
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Billing History
          </CardTitle>
          <CardDescription>
            Download your invoices and view payment history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Invoice #{invoice.id}</span>
                    <Badge variant={invoice.status === 'paid' ? 'default' : 'destructive'}>
                      {invoice.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {invoice.date.toLocaleDateString()} • ${invoice.amount}
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}