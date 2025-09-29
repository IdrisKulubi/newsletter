import { db } from "./index";
import { tenants } from "./schema/tenants";
import { users } from "./schema/users";
import { newsletters } from "./schema/newsletters";
import { campaigns } from "./schema/campaigns";
import { assets } from "./schema/assets";
import { setTenantContext, clearTenantContext } from "./tenant-context";

/**
 * Seed script for development and testing
 * Creates sample data for multiple tenants
 */
async function seed() {
  console.log("🌱 Starting database seeding...");

  try {
    // Clear existing data (be careful in production!)
    if (process.env.NODE_ENV === "development") {
      console.log("🧹 Clearing existing data...");
      await db.delete(assets);
      await db.delete(campaigns);
      await db.delete(newsletters);
      await db.delete(users);
      await db.delete(tenants);
    }

    // Create sample tenants
    console.log("🏢 Creating sample tenants...");
    const sampleTenants = await db
      .insert(tenants)
      .values([
        {
          name: "Acme Consulting",
          domain: "acme",
          settings: {
            branding: {
              primaryColor: "#3b82f6",
              secondaryColor: "#1e40af",
            },
            emailSettings: {
              fromName: "Acme Newsletter",
              fromEmail: "newsletter@acme.com",
              replyTo: "support@acme.com",
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
            plan: "pro",
            status: "active",
          },
        },
        {
          name: "TechCorp Solutions",
          domain: "techcorp",
          settings: {
            branding: {
              primaryColor: "#10b981",
              secondaryColor: "#059669",
            },
            emailSettings: {
              fromName: "TechCorp Updates",
              fromEmail: "updates@techcorp.com",
            },
            aiSettings: {
              enabled: true,
            },
            analyticsSettings: {
              retentionDays: 180,
            },
          },
          subscription: {
            plan: "enterprise",
            status: "active",
          },
        },
        {
          name: "StartupXYZ",
          domain: "startupxyz",
          customDomain: "news.startupxyz.com",
          settings: {
            branding: {
              primaryColor: "#f59e0b",
              secondaryColor: "#d97706",
            },
            emailSettings: {
              fromName: "StartupXYZ News",
              fromEmail: "news@startupxyz.com",
            },
            aiSettings: {
              enabled: false,
            },
            analyticsSettings: {
              retentionDays: 90,
            },
          },
          subscription: {
            plan: "free",
            status: "active",
          },
        },
      ])
      .returning();

    console.log(`✅ Created ${sampleTenants.length} tenants`);

    // Create sample users for each tenant
    console.log("👥 Creating sample users...");
    const sampleUsers = [];

    for (const tenant of sampleTenants) {
      await setTenantContext(db, tenant.id);

      const tenantUsers = await db
        .insert(users)
        .values([
          {
            tenantId: tenant.id,
            email: `admin@${tenant.domain}.com`,
            name: `${tenant.name} Admin`,
            role: "admin",
          },
          {
            tenantId: tenant.id,
            email: `editor@${tenant.domain}.com`,
            name: `${tenant.name} Editor`,
            role: "editor",
          },
          {
            tenantId: tenant.id,
            email: `viewer@${tenant.domain}.com`,
            name: `${tenant.name} Viewer`,
            role: "viewer",
          },
        ])
        .returning();

      sampleUsers.push(...tenantUsers);
      await clearTenantContext(db);
    }

    console.log(`✅ Created ${sampleUsers.length} users`);

    // Create sample newsletters for each tenant
    console.log("📰 Creating sample newsletters...");
    const sampleNewsletters = [];

    for (const tenant of sampleTenants) {
      await setTenantContext(db, tenant.id);

      const tenantUsers = sampleUsers.filter((u) => u.tenantId === tenant.id);
      const editor = tenantUsers.find((u) => u.role === "editor");

      if (editor) {
        const tenantNewsletters = await db
          .insert(newsletters)
          .values([
            {
              tenantId: tenant.id,
              title: "Welcome to Our Newsletter",
              content: {
                blocks: [
                  {
                    id: "1",
                    type: "text",
                    content: {
                      text: `<h1>Welcome to ${tenant.name}!</h1><p>We're excited to share our latest updates with you.</p>`,
                    },
                  },
                  {
                    id: "2",
                    type: "text",
                    content: {
                      text: "<p>This is our inaugural newsletter. Stay tuned for more exciting content!</p>",
                    },
                  },
                ],
              },
              metadata: {
                description: "Our first newsletter",
                tags: ["welcome", "introduction"],
                estimatedReadTime: 2,
              },
              status: "approved",
              createdBy: editor.id,
            },
            {
              tenantId: tenant.id,
              title: "Monthly Update - Draft",
              content: {
                blocks: [
                  {
                    id: "1",
                    type: "text",
                    content: {
                      text: "<h1>Monthly Update</h1><p>Here are the highlights from this month...</p>",
                    },
                  },
                ],
              },
              metadata: {
                description: "Monthly company updates",
                tags: ["monthly", "updates"],
                estimatedReadTime: 5,
              },
              status: "draft",
              createdBy: editor.id,
            },
          ])
          .returning();

        sampleNewsletters.push(...tenantNewsletters);
      }

      await clearTenantContext(db);
    }

    console.log(`✅ Created ${sampleNewsletters.length} newsletters`);

    // Create sample campaigns
    console.log("📧 Creating sample campaigns...");
    let totalCampaigns = 0;

    for (const tenant of sampleTenants) {
      await setTenantContext(db, tenant.id);

      const tenantUsers = sampleUsers.filter((u) => u.tenantId === tenant.id);
      const tenantNewsletters = sampleNewsletters.filter(
        (n) => n.tenantId === tenant.id
      );
      const editor = tenantUsers.find((u) => u.role === "editor");

      if (editor && tenantNewsletters.length > 0) {
        const approvedNewsletter = tenantNewsletters.find(
          (n) => n.status === "approved"
        );

        if (approvedNewsletter) {
          await db.insert(campaigns).values([
            {
              tenantId: tenant.id,
              newsletterId: approvedNewsletter.id,
              name: "Welcome Campaign",
              subjectLine: `Welcome to ${tenant.name}!`,
              previewText: "Get started with our newsletter",
              recipients: {
                list: [
                  { email: "subscriber1@example.com", name: "John Doe" },
                  { email: "subscriber2@example.com", name: "Jane Smith" },
                  { email: "subscriber3@example.com", name: "Bob Johnson" },
                ],
              },
              status: "sent",
              sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
              analytics: {
                totalSent: 3,
                delivered: 3,
                opened: 2,
                clicked: 1,
                bounced: 0,
                unsubscribed: 0,
                complained: 0,
                openRate: 66.67,
                clickRate: 33.33,
                bounceRate: 0,
                lastUpdated: new Date(),
              },
              createdBy: editor.id,
            },
          ]);
          totalCampaigns++;
        }
      }

      await clearTenantContext(db);
    }

    console.log(`✅ Created ${totalCampaigns} campaigns`);

    console.log("🎉 Database seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`- Tenants: ${sampleTenants.length}`);
    console.log(`- Users: ${sampleUsers.length}`);
    console.log(`- Newsletters: ${sampleNewsletters.length}`);
    console.log(`- Campaigns: ${totalCampaigns}`);
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    throw error;
  }
}

// Run the seed function if this file is executed directly
if (require.main === module) {
  seed()
    .then(() => {
      console.log("✅ Seeding completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Seeding failed:", error);
      process.exit(1);
    });
}

export { seed };
