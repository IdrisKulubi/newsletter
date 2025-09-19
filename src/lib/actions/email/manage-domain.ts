'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { tenants } from '@/lib/db/schema/tenants';
import { emailService, DomainConfig, DeliverabilityReport } from '@/lib/email';
import { eq } from 'drizzle-orm';
import { getTenantContext } from '@/lib/tenant/context';
import { z } from 'zod';

const domainSchema = z.object({
  domain: z.string().min(1, 'Domain is required').regex(
    /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/,
    'Invalid domain format'
  ),
});

export interface SetupDomainResult {
  success: boolean;
  message: string;
  domainConfig?: DomainConfig;
}

export interface ValidateDomainResult {
  success: boolean;
  message: string;
  report?: DeliverabilityReport;
}

/**
 * Set up domain authentication for email sending
 */
export async function setupDomainAuthentication(formData: FormData): Promise<SetupDomainResult> {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, message: 'Tenant context not found' };
    }

    // Validate input
    const domain = formData.get('domain') as string;
    const validation = domainSchema.safeParse({ domain });
    
    if (!validation.success) {
      return { 
        success: false, 
        message: validation.error.issues[0]?.message || 'Invalid domain' 
      };
    }

    // Set up domain with Resend
    const domainConfig = await emailService.setupDomainAuthentication(validation.data.domain);

    // Update tenant with domain configuration
    const currentTenant = tenant;
    const updatedSettings = {
      ...currentTenant.settings,
      emailSettings: {
        ...currentTenant.settings?.emailSettings,
        customDomain: validation.data.domain,
        domainConfig,
        domainSetupAt: new Date(),
      },
    };

    await db
      .update(tenants)
      .set({
        settings: updatedSettings,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, currentTenant.id));

    revalidatePath('/dashboard/settings/email');
    
    return {
      success: true,
      message: 'Domain authentication setup initiated. Please configure the DNS records.',
      domainConfig,
    };
  } catch (error) {
    console.error('Failed to setup domain authentication:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to setup domain authentication',
    };
  }
}

/**
 * Validate domain deliverability configuration
 */
export async function validateDomainDeliverability(domain?: string): Promise<ValidateDomainResult> {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, message: 'Tenant context not found' };
    }

    // Use provided domain or get from tenant settings
    const targetDomain = domain || tenant.settings?.emailSettings?.customDomain;
    
    if (!targetDomain) {
      return { success: false, message: 'No domain configured for validation' };
    }

    // Validate domain with Resend
    const report = await emailService.validateDeliverability(targetDomain);

    // Update tenant with validation results
    const currentTenant = tenant;
    const updatedSettings = {
      ...currentTenant.settings,
      emailSettings: {
        ...currentTenant.settings?.emailSettings,
        lastValidation: new Date(),
        validationReport: report,
      },
    };

    await db
      .update(tenants)
      .set({
        settings: updatedSettings,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, currentTenant.id));

    revalidatePath('/dashboard/settings/email');

    return {
      success: true,
      message: 'Domain validation completed',
      report,
    };
  } catch (error) {
    console.error('Failed to validate domain deliverability:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to validate domain',
    };
  }
}

/**
 * Remove domain configuration
 */
export async function removeDomainConfiguration(): Promise<SetupDomainResult> {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, message: 'Tenant context not found' };
    }

    // Update tenant settings to remove domain configuration
    const currentTenant = tenant;
    const updatedSettings = {
      ...currentTenant.settings,
      emailSettings: {
        ...currentTenant.settings?.emailSettings,
        customDomain: undefined,
        domainConfig: undefined,
        domainSetupAt: undefined,
        lastValidation: undefined,
        validationReport: undefined,
      },
    };

    await db
      .update(tenants)
      .set({
        settings: updatedSettings,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, currentTenant.id));

    revalidatePath('/dashboard/settings/email');

    return {
      success: true,
      message: 'Domain configuration removed successfully',
    };
  } catch (error) {
    console.error('Failed to remove domain configuration:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to remove domain configuration',
    };
  }
}

/**
 * Test email sending with current configuration
 */
export async function sendTestEmail(formData: FormData): Promise<SetupDomainResult> {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return { success: false, message: 'Tenant context not found' };
    }

    const testEmail = formData.get('testEmail') as string;
    
    if (!testEmail || !testEmail.includes('@')) {
      return { success: false, message: 'Valid email address is required' };
    }

    // Create a simple test newsletter
    const testNewsletter = {
      id: 'test',
      tenantId: tenant.id,
      title: 'Test Email',
      content: {
        blocks: [
          {
            id: 'test-block',
            type: 'text' as const,
            content: {
              text: 'This is a test email to verify your email configuration is working correctly.',
            },
            styling: {},
          },
        ],
        globalStyling: {},
      },
      template: {
        id: 'default',
        name: 'Default Template',
        config: {
          layout: 'single-column' as const,
          headerStyle: 'minimal' as const,
        },
      },
      metadata: {},
      status: 'draft' as const,
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Send test email
    const results = await emailService.sendBatch({
      recipients: [{ email: testEmail, name: 'Test Recipient' }],
      newsletter: testNewsletter,
      from: tenant.settings?.emailSettings?.customDomain 
        ? `test@${tenant.settings.emailSettings.customDomain}`
        : 'test@newsletter.com',
      tags: [`tenant:${tenant.id}`, 'test-email'],
      headers: {
        'X-Tenant-ID': tenant.id,
        'X-Test-Email': 'true',
      },
    });

    const successful = results.filter(r => r.status === 'sent').length;
    
    if (successful > 0) {
      return {
        success: true,
        message: `Test email sent successfully to ${testEmail}`,
      };
    } else {
      const error = results[0]?.error || 'Unknown error';
      return {
        success: false,
        message: `Failed to send test email: ${error}`,
      };
    }
  } catch (error) {
    console.error('Failed to send test email:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send test email',
    };
  }
}