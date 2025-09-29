import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config";
import * as tenants from "./schema/tenants";
import * as users from "./schema/users";
import * as newsletters from "./schema/newsletters";
import * as campaigns from "./schema/campaigns";
import * as analytics from "./schema/analytics";
import * as assets from "./schema/assets";

// Combine all schema modules
const schema = {
  ...tenants,
  ...users,
  ...newsletters,
  ...campaigns,
  ...analytics,
  ...assets,
};

// Create connection with pooling configuration
const connectionString = config.database.url;

// Configure postgres client with connection pooling
const client = postgres(connectionString, {
  max: 20, // Maximum number of connections in the pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
  prepare: false, // Disable prepared statements for better compatibility
});

// Create Drizzle instance with schema
export const db = drizzle(client, { schema });

// Export types for use throughout the application
export type Database = typeof db;
export * from "./schema/tenants";
export * from "./schema/users";
export * from "./schema/newsletters";
export * from "./schema/campaigns";
export * from "./schema/analytics";
export * from "./schema/assets";
export * from "./tenant-context";
export * from "./tenant-resolver";
export * from "./utils";
