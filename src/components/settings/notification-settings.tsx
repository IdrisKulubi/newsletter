'use client';

import { useState } from 'react';
import { User } from '@/lib/auth/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Bell, Mail, Smartphone, Volume2 } from 'lucide-react';
import { toast } from 'sonner';

interface NotificationSettingsProps {
  user: User;
}

interface NotificationPreferences {
  email: {
    campaignUpdates: boolean;
    systemAlerts: boolean;
    weeklyReports: boolean;
    securityAlerts: boolean;
    teamInvites: boolean;
  };
  push: {
    campaignUpdates: boolean;
    systemAlerts: boolean;
    mentions: boolean;
  };
  frequency: 'immediate' | 'daily' | 'weekly' | 'never';
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export function NotificationSettings({ user }: NotificationSettingsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email: {
      campaignUpdates: true,
      systemAlerts: true,
      weeklyReports: true,
      securityAlerts: true,
      teamInvites: true,
    },
    push: {
      campaignUpdates: true,
      systemAlerts: true,
      mentions: true,
    },
    frequency: 'immediate',
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00',
    },
  });

  const handleEmailToggle = (key: keyof NotificationPreferences['email'], value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      email: { ...prev.email, [key]: value }
    }));
  };

  const handlePushToggle = (key: keyof NotificationPreferences['push'], value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      push: { ...prev.push, [key]: value }
    }));
  };

  const handleFrequencyChange = (frequency: NotificationPreferences['frequency']) => {
    setPreferences(prev => ({ ...prev, frequency }));
  };

  const handleQuietHoursToggle = (enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      quietHours: { ...prev.quietHours, enabled }
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement notification preferences API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Notification preferences updated successfully');
    } catch (error) {
      toast.error('Failed to update notification preferences');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Notification Settings</h2>
        <p className="text-muted-foreground">
          Manage how and when you receive notifications
        </p>
      </div>

      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Choose which email notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="font-medium">Campaign Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when campaigns are sent, scheduled, or completed
                </p>
              </div>
              <Switch
                checked={preferences.email.campaignUpdates}
                onCheckedChange={(value) => handleEmailToggle('campaignUpdates', value)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="font-medium">System Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Important system notifications and maintenance updates
                </p>
              </div>
              <Switch
                checked={preferences.email.systemAlerts}
                onCheckedChange={(value) => handleEmailToggle('systemAlerts', value)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="font-medium">Weekly Reports</Label>
                <p className="text-sm text-muted-foreground">
                  Weekly summary of your newsletter performance and analytics
                </p>
              </div>
              <Switch
                checked={preferences.email.weeklyReports}
                onCheckedChange={(value) => handleEmailToggle('weeklyReports', value)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="font-medium">Security Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Login attempts, password changes, and security-related notifications
                </p>
              </div>
              <Switch
                checked={preferences.email.securityAlerts}
                onCheckedChange={(value) => handleEmailToggle('securityAlerts', value)}
                disabled // Security alerts should always be enabled
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="font-medium">Team Invites</Label>
                <p className="text-sm text-muted-foreground">
                  Invitations to join teams and collaboration requests
                </p>
              </div>
              <Switch
                checked={preferences.email.teamInvites}
                onCheckedChange={(value) => handleEmailToggle('teamInvites', value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Manage push notifications for the mobile app and browser
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="font-medium">Campaign Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Real-time notifications for campaign status changes
                </p>
              </div>
              <Switch
                checked={preferences.push.campaignUpdates}
                onCheckedChange={(value) => handlePushToggle('campaignUpdates', value)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="font-medium">System Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Critical system notifications and urgent updates
                </p>
              </div>
              <Switch
                checked={preferences.push.systemAlerts}
                onCheckedChange={(value) => handlePushToggle('systemAlerts', value)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="font-medium">Mentions</Label>
                <p className="text-sm text-muted-foreground">
                  When someone mentions you in comments or discussions
                </p>
              </div>
              <Switch
                checked={preferences.push.mentions}
                onCheckedChange={(value) => handlePushToggle('mentions', value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Frequency */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Frequency
          </CardTitle>
          <CardDescription>
            Control how often you receive non-urgent notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email Digest Frequency</Label>
            <Select value={preferences.frequency} onValueChange={handleFrequencyChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate</SelectItem>
                <SelectItem value="daily">Daily Digest</SelectItem>
                <SelectItem value="weekly">Weekly Digest</SelectItem>
                <SelectItem value="never">Never</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Choose how often you want to receive non-urgent email notifications
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
          <CardDescription>
            Set times when you don't want to receive push notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="font-medium">Enable Quiet Hours</Label>
              <p className="text-sm text-muted-foreground">
                Pause non-urgent notifications during specified hours
              </p>
            </div>
            <Switch
              checked={preferences.quietHours.enabled}
              onCheckedChange={handleQuietHoursToggle}
            />
          </div>

          {preferences.quietHours.enabled && (
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Select value={preferences.quietHours.start} onValueChange={(value) => 
                  setPreferences(prev => ({
                    ...prev,
                    quietHours: { ...prev.quietHours, start: value }
                  }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0');
                      return (
                        <SelectItem key={`${hour}:00`} value={`${hour}:00`}>
                          {hour}:00
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Select value={preferences.quietHours.end} onValueChange={(value) => 
                  setPreferences(prev => ({
                    ...prev,
                    quietHours: { ...prev.quietHours, end: value }
                  }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0');
                      return (
                        <SelectItem key={`${hour}:00`} value={`${hour}:00`}>
                          {hour}:00
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}