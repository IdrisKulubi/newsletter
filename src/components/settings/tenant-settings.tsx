'use client';

import { useState } from 'react';
import { User } from '@/lib/auth/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Building, 
  Globe, 
  Palette, 
  Upload, 
  Save,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface TenantSettingsProps {
  user: User;
  canEdit: boolean;
}

interface TenantData {
  name: string;
  domain: string;
  customDomain: string;
  description: string;
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  timezone: string;
  language: string;
  emailFromName: string;
  emailFromAddress: string;
  emailReplyTo: string;
  customFooter: string;
  analyticsEnabled: boolean;
  aiEnabled: boolean;
}

export function TenantSettings({ user, canEdit }: TenantSettingsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [tenantData, setTenantData] = useState<TenantData>({
    name: 'Acme Corporation',
    domain: 'acme.newsletter.com',
    customDomain: 'news.acme.com',
    description: 'Leading provider of innovative solutions for modern businesses.',
    logo: '',
    primaryColor: '#3b82f6',
    secondaryColor: '#64748b',
    timezone: 'America/New_York',
    language: 'en',
    emailFromName: 'Acme Newsletter',
    emailFromAddress: 'newsletter@acme.com',
    emailReplyTo: 'support@acme.com',
    customFooter: '© 2024 Acme Corporation. All rights reserved.',
    analyticsEnabled: true,
    aiEnabled: true,
  });

  const handleInputChange = (field: keyof TenantData, value: string | boolean) => {
    setTenantData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement tenant settings update API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Organization settings updated successfully');
    } catch (error) {
      toast.error('Failed to update organization settings');
    } finally {
      setIsLoading(false);
    }
  };

  const timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
  ];

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'zh', name: 'Chinese' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Organization Settings</h2>
          <p className="text-muted-foreground">
            {canEdit ? 'Manage your organization settings and branding' : 'View organization settings'}
          </p>
        </div>
        {!canEdit && (
          <Badge variant="outline" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Read Only
          </Badge>
        )}
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Basic Information
          </CardTitle>
          <CardDescription>
            Update your organization's basic details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={tenantData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter organization name"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain">Subdomain</Label>
              <div className="flex">
                <Input
                  id="domain"
                  value={tenantData.domain.split('.')[0]}
                  onChange={(e) => handleInputChange('domain', `${e.target.value}.newsletter.com`)}
                  placeholder="your-org"
                  disabled={!canEdit}
                />
                <span className="flex items-center px-3 text-sm text-muted-foreground bg-muted border border-l-0 rounded-r-md">
                  .newsletter.com
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-domain">Custom Domain (Optional)</Label>
            <Input
              id="custom-domain"
              value={tenantData.customDomain}
              onChange={(e) => handleInputChange('customDomain', e.target.value)}
              placeholder="news.yourcompany.com"
              disabled={!canEdit}
            />
            <p className="text-sm text-muted-foreground">
              Use your own domain for white-label branding
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={tenantData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe your organization..."
              rows={3}
              disabled={!canEdit}
            />
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Branding
          </CardTitle>
          <CardDescription>
            Customize your organization's visual identity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                {tenantData.logo ? (
                  <img src={tenantData.logo} alt="Logo" className="w-full h-full object-contain rounded-lg" />
                ) : (
                  <Building className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-2">
                <Button variant="outline" size="sm" disabled={!canEdit}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Logo
                </Button>
                <p className="text-sm text-muted-foreground">
                  PNG, JPG or SVG. Max size 2MB.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primary-color">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primary-color"
                  type="color"
                  value={tenantData.primaryColor}
                  onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                  className="w-16 h-10 p-1 border rounded"
                  disabled={!canEdit}
                />
                <Input
                  value={tenantData.primaryColor}
                  onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                  placeholder="#3b82f6"
                  disabled={!canEdit}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary-color">Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="secondary-color"
                  type="color"
                  value={tenantData.secondaryColor}
                  onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                  className="w-16 h-10 p-1 border rounded"
                  disabled={!canEdit}
                />
                <Input
                  value={tenantData.secondaryColor}
                  onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                  placeholder="#64748b"
                  disabled={!canEdit}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Localization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Localization
          </CardTitle>
          <CardDescription>
            Set your organization's timezone and language preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select 
                value={tenantData.timezone} 
                onValueChange={(value) => handleInputChange('timezone', value)}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select 
                value={tenantData.language} 
                onValueChange={(value) => handleInputChange('language', value)}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Email Configuration</CardTitle>
          <CardDescription>
            Configure how emails are sent from your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="from-name">From Name</Label>
              <Input
                id="from-name"
                value={tenantData.emailFromName}
                onChange={(e) => handleInputChange('emailFromName', e.target.value)}
                placeholder="Your Newsletter"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="from-address">From Address</Label>
              <Input
                id="from-address"
                type="email"
                value={tenantData.emailFromAddress}
                onChange={(e) => handleInputChange('emailFromAddress', e.target.value)}
                placeholder="newsletter@yourcompany.com"
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reply-to">Reply-To Address</Label>
            <Input
              id="reply-to"
              type="email"
              value={tenantData.emailReplyTo}
              onChange={(e) => handleInputChange('emailReplyTo', e.target.value)}
              placeholder="support@yourcompany.com"
              disabled={!canEdit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-footer">Custom Footer</Label>
            <Textarea
              id="custom-footer"
              value={tenantData.customFooter}
              onChange={(e) => handleInputChange('customFooter', e.target.value)}
              placeholder="Add custom footer text for your emails..."
              rows={3}
              disabled={!canEdit}
            />
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
          <CardDescription>
            Enable or disable features for your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="font-medium">Analytics</Label>
              <p className="text-sm text-muted-foreground">
                Track email opens, clicks, and engagement metrics
              </p>
            </div>
            <Switch
              checked={tenantData.analyticsEnabled}
              onCheckedChange={(value) => handleInputChange('analyticsEnabled', value)}
              disabled={!canEdit}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="font-medium">AI Features</Label>
              <p className="text-sm text-muted-foreground">
                Enable AI-powered content generation and optimization
              </p>
            </div>
            <Switch
              checked={tenantData.aiEnabled}
              onCheckedChange={(value) => handleInputChange('aiEnabled', value)}
              disabled={!canEdit}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isLoading}>
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  );
}