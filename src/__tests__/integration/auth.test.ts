import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/lib/db";
import { users, tenants, sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Mock BetterAuth for testing
const mockAuth = {
  api: {
    signInEmail: vi.fn(),
    signUpEmail: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
  },
};

vi.mock("@/lib/auth/config", () => ({
  auth: mockAuth,
}));

describe("Authentication Integration Tests", () => {
  let testTenant: any;
  let testUser: any;

  beforeEach(async () => {
    // Create test tenant
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: "Test Company",
        domain: "test-company",
        settings: {},
        subscription: { plan: "free", status: "active" },
      })
      .returning();

    testTenant = tenant;

    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        email: "test@example.com",
        name: "Test User",
        role: "admin",
        tenantId: testTenant.id,
        emailVerified: true,
        isActive: true,
      })
      .returning();

    testUser = user;
  });

  afterEach(async () => {
    // Clean up test data
    if (testUser) {
      await db.delete(users).where(eq(users.id, testUser.id));
    }
    if (testTenant) {
      await db.delete(tenants).where(eq(tenants.id, testTenant.id));
    }
  });

  describe("User Authentication", () => {
    it("should create user with correct tenant association", async () => {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, testUser.id))
        .limit(1);

      expect(user[0]).toBeDefined();
      expect(user[0].tenantId).toBe(testTenant.id);
      expect(user[0].email).toBe("test@example.com");
      expect(user[0].role).toBe("admin");
    });

    it("should enforce unique email per tenant", async () => {
      // Try to create another user with same email in same tenant
      await expect(
        db.insert(users).values({
          email: "test@example.com",
          name: "Another User",
          role: "viewer",
          tenantId: testTenant.id,
          emailVerified: true,
          isActive: true,
        })
      ).rejects.toThrow();
    });

    it("should allow same email in different tenants", async () => {
      // Create another tenant
      const [anotherTenant] = await db
        .insert(tenants)
        .values({
          name: "Another Company",
          domain: "another-company",
          settings: {},
          subscription: { plan: "free", status: "active" },
        })
        .returning();

      // Create user with same email in different tenant
      const [anotherUser] = await db
        .insert(users)
        .values({
          email: "test@example.com",
          name: "Another User",
          role: "viewer",
          tenantId: anotherTenant.id,
          emailVerified: true,
          isActive: true,
        })
        .returning();

      expect(anotherUser).toBeDefined();
      expect(anotherUser.tenantId).toBe(anotherTenant.id);

      // Clean up
      await db.delete(users).where(eq(users.id, anotherUser.id));
      await db.delete(tenants).where(eq(tenants.id, anotherTenant.id));
    });
  });

  describe("Role-Based Access Control", () => {
    it("should create users with correct default role", async () => {
      const [viewerUser] = await db
        .insert(users)
        .values({
          email: "viewer@example.com",
          name: "Viewer User",
          tenantId: testTenant.id,
          emailVerified: true,
          isActive: true,
        })
        .returning();

      expect(viewerUser.role).toBe("viewer");

      // Clean up
      await db.delete(users).where(eq(users.id, viewerUser.id));
    });

    it("should allow role updates within tenant", async () => {
      await db
        .update(users)
        .set({ role: "editor" })
        .where(eq(users.id, testUser.id));

      const [updatedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, testUser.id))
        .limit(1);

      expect(updatedUser.role).toBe("editor");
    });

    it("should track user activity timestamps", async () => {
      const now = new Date();

      await db
        .update(users)
        .set({ lastLoginAt: now })
        .where(eq(users.id, testUser.id));

      const [updatedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, testUser.id))
        .limit(1);

      expect(updatedUser.lastLoginAt).toBeDefined();
    });
  });

  describe("Session Management", () => {
    it("should create session with proper tenant context", async () => {
      const sessionToken = "test-session-token";
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const [session] = await db
        .insert(sessions)
        .values({
          userId: testUser.id,
          sessionToken,
          expiresAt,
          ipAddress: "127.0.0.1",
          userAgent: "test-agent",
        })
        .returning();

      expect(session).toBeDefined();
      expect(session.userId).toBe(testUser.id);
      expect(session.sessionToken).toBe(sessionToken);

      // Clean up
      await db.delete(sessions).where(eq(sessions.id, session.id));
    });

    it("should enforce unique session tokens", async () => {
      const sessionToken = "unique-session-token";
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Create first session
      const [session1] = await db
        .insert(sessions)
        .values({
          userId: testUser.id,
          sessionToken,
          expiresAt,
        })
        .returning();

      // Try to create another session with same token
      await expect(
        db.insert(sessions).values({
          userId: testUser.id,
          sessionToken,
          expiresAt,
        })
      ).rejects.toThrow();

      // Clean up
      await db.delete(sessions).where(eq(sessions.id, session1.id));
    });
  });

  describe("Multi-Tenant Isolation", () => {
    it("should isolate users by tenant", async () => {
      // Create another tenant and user
      const [anotherTenant] = await db
        .insert(tenants)
        .values({
          name: "Another Company",
          domain: "another-company",
          settings: {},
          subscription: { plan: "free", status: "active" },
        })
        .returning();

      const [anotherUser] = await db
        .insert(users)
        .values({
          email: "another@example.com",
          name: "Another User",
          role: "admin",
          tenantId: anotherTenant.id,
          emailVerified: true,
          isActive: true,
        })
        .returning();

      // Query users for first tenant
      const tenant1Users = await db
        .select()
        .from(users)
        .where(eq(users.tenantId, testTenant.id));

      // Query users for second tenant
      const tenant2Users = await db
        .select()
        .from(users)
        .where(eq(users.tenantId, anotherTenant.id));

      expect(tenant1Users).toHaveLength(1);
      expect(tenant1Users[0].id).toBe(testUser.id);

      expect(tenant2Users).toHaveLength(1);
      expect(tenant2Users[0].id).toBe(anotherUser.id);

      // Clean up
      await db.delete(users).where(eq(users.id, anotherUser.id));
      await db.delete(tenants).where(eq(tenants.id, anotherTenant.id));
    });
  });
});
