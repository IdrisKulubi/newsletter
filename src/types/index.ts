// Global type definitions

// User roles
export type UserRole = 'admin' | 'editor' | 'viewer';

// Extended user type that includes our custom fields
export interface ExtendedUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null;
  role: UserRole;
  tenantId?: string | null;
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Campaign status types
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';

// Email event types
export type EmailEventType = 'delivered' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed' | 'complained';

// Newsletter block types
export type NewsletterBlockType = 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'social' | 'header' | 'footer';

// Tenant subscription status
export type SubscriptionStatus = 'active' | 'inactive' | 'suspended' | 'cancelled';

// API response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}