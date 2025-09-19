#!/usr/bin/env tsx

/**
 * Production database seeding script
 * Seeds essential data for production deployment
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../src/lib/config";
import { tenants, users } from "../src/lib/db/schema";
import bcrypt from "bcryptjs";

async function seedProduction() {
  console.log("🌱 Starting production database seeding...");

  try {
    // Create connection
    const connection = postgres(config.database.url, {
      max: 1,
      ssl: config.database.ssl ? "require" : false,
    });

    const db = drizzle(connection);

    // Check if already seeded
    const existingTenants = await db.select().from(tenants).limit(1);
    if (existingTenants.length > 0) {
      console.log("⚠️  Database already contains data, skipping seed");
      await connection.end();
      return;
    }

    console.log("📦 Creating default tenant...");

    // Create default tenant for the platform
    const [defaultTenant] = await db
      .insert(tenants)
      .values({
        name: "Newsletter Platform",
        domain: "app",
        customDomain: null,
        settings: {
          branding: {
            logo: undefined,
            primaryColor: "#3b82f6",
            secondaryColor: "#1e40af",
          },
          emailSettings: {
            fromName: "Newsletter Platform",
            fromEmail: "noreply@newsletter-platform.com",
            replyTo: "support@newsletter-platform.com",
          },
          aiSettings: {
            enabled: true,
            model: "gpt-4",
          },
          analyticsSettings: {
            retentionDays: 365,
          },
        },
        subscription: {
          plan: "enterprise",
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        },
        isActive: true,
      })
      .returning();

    console.log("👤 Creating admin user...");

    // Create default admin user
    await db.insert(users).values({
      tenantId: defaultTenant.id,
      email: "admin@newsletter-platform.com",
      name: "Platform Admin",
      role: "admin",
      emailVerified: true,
      isActive: true,
    });

    console.log("✅ Production seeding completed successfully");
    console.log("📧 Admin user created: admin@newsletter-platform.com");
    console.log("⚠️  Configure authentication provider for login");

    await connection.end();
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

// Validate environment
if (!config.database.url) {
  console.error("❌ DATABASE_URL is required");
  process.exit(1);
}

// Run seeding
seedProduction();
