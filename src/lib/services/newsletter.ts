import { eq, and, desc, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { newsletters, type Newsletter, type NewNewsletter, type UpdateNewsletter } from '@/lib/db/schema/newsletters';
import { getTenantContext } from '@/lib/db/tenant-context';

export interface NewsletterFilters {
  status?: 'draft' | 'review' | 'approved';
  createdBy?: string;
  search?: string;
  tags?: string[];
}

export interface NewsletterListOptions {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  filters?: NewsletterFilters;
}

export class NewsletterService {
  /**
   * Create a new newsletter with tenant isolation
   */
  static async create(data: Omit<NewNewsletter, 'tenantId'>): Promise<Newsletter> {
    const tenantContext = await getTenantContext();
    if (!tenantContext) {
      throw new Error('Tenant context not found');
    }

    const [newsletter] = await db
      .insert(newsletters)
      .values({
        ...data,
        tenantId: tenantContext.id,
      })
      .returning();

    return newsletter;
  }

  /**
   * Get newsletter by ID with tenant isolation
   */
  static async getById(id: string): Promise<Newsletter | null> {
    const tenantContext = await getTenantContext();
    if (!tenantContext) {
      throw new Error('Tenant context not found');
    }

    const [newsletter] = await db
      .select()
      .from(newsletters)
      .where(
        and(
          eq(newsletters.id, id),
          eq(newsletters.tenantId, tenantContext.id)
        )
      )
      .limit(1);

    return newsletter || null;
  }

  /**
   * Update newsletter with tenant isolation
   */
  static async update(id: string, data: UpdateNewsletter): Promise<Newsletter> {
    const tenantContext = await getTenantContext();
    if (!tenantContext) {
      throw new Error('Tenant context not found');
    }

    const [newsletter] = await db
      .update(newsletters)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(newsletters.id, id),
          eq(newsletters.tenantId, tenantContext.id)
        )
      )
      .returning();

    if (!newsletter) {
      throw new Error('Newsletter not found or access denied');
    }

    return newsletter;
  }

  /**
   * Delete newsletter with tenant isolation
   */
  static async delete(id: string): Promise<void> {
    const tenantContext = await getTenantContext();
    if (!tenantContext) {
      throw new Error('Tenant context not found');
    }

    const result = await db
      .delete(newsletters)
      .where(
        and(
          eq(newsletters.id, id),
          eq(newsletters.tenantId, tenantContext.id)
        )
      );

    if (result.rowCount === 0) {
      throw new Error('Newsletter not found or access denied');
    }
  }

  /**
   * List newsletters with pagination and filtering
   */
  static async list(options: NewsletterListOptions = {}): Promise<{
    newsletters: Newsletter[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const tenantContext = await getTenantContext();
    if (!tenantContext) {
      throw new Error('Tenant context not found');
    }

    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      filters = {},
    } = options;

    const offset = (page - 1) * limit;

    // Build where conditions
    const whereConditions = [eq(newsletters.tenantId, tenantContext.id)];

    if (filters.status) {
      whereConditions.push(eq(newsletters.status, filters.status));
    }

    if (filters.createdBy) {
      whereConditions.push(eq(newsletters.createdBy, filters.createdBy));
    }

    // Build sort order
    const sortColumn = newsletters[sortBy];
    const orderBy = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Get newsletters
    const newsletterList = await db
      .select()
      .from(newsletters)
      .where(and(...whereConditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(newsletters)
      .where(and(...whereConditions));

    const totalPages = Math.ceil(count / limit);

    return {
      newsletters: newsletterList,
      total: count,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Duplicate a newsletter
   */
  static async duplicate(id: string, title?: string): Promise<Newsletter> {
    const original = await this.getById(id);
    if (!original) {
      throw new Error('Newsletter not found');
    }

    const duplicatedData: Omit<NewNewsletter, 'tenantId'> = {
      title: title || `${original.title} (Copy)`,
      content: original.content,
      template: original.template,
      metadata: original.metadata,
      status: 'draft',
      createdBy: original.createdBy,
    };

    return this.create(duplicatedData);
  }

  /**
   * Get newsletters by status
   */
  static async getByStatus(status: 'draft' | 'review' | 'approved'): Promise<Newsletter[]> {
    const tenantContext = await getTenantContext();
    if (!tenantContext) {
      throw new Error('Tenant context not found');
    }

    return db
      .select()
      .from(newsletters)
      .where(
        and(
          eq(newsletters.tenantId, tenantContext.id),
          eq(newsletters.status, status)
        )
      )
      .orderBy(desc(newsletters.updatedAt));
  }

  /**
   * Update newsletter status
   */
  static async updateStatus(
    id: string, 
    status: 'draft' | 'review' | 'approved'
  ): Promise<Newsletter> {
    return this.update(id, { status });
  }

  /**
   * Get newsletter statistics for tenant
   */
  static async getStats(): Promise<{
    total: number;
    draft: number;
    review: number;
    approved: number;
  }> {
    const tenantContext = await getTenantContext();
    if (!tenantContext) {
      throw new Error('Tenant context not found');
    }

    const stats = await db
      .select({
        status: newsletters.status,
        count: sql<number>`count(*)`,
      })
      .from(newsletters)
      .where(eq(newsletters.tenantId, tenantContext.id))
      .groupBy(newsletters.status);

    const result = {
      total: 0,
      draft: 0,
      review: 0,
      approved: 0,
    };

    stats.forEach(stat => {
      result.total += stat.count;
      result[stat.status as keyof typeof result] = stat.count;
    });

    return result;
  }
}

// Import sql function
import { sql } from 'drizzle-orm';