-- Initialize database for production deployment
-- This script runs when the PostgreSQL container starts

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE newsletter'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'newsletter');

-- Connect to the newsletter database
\c newsletter;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create a dedicated user for the application (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'newsletter_app') THEN
        CREATE USER newsletter_app WITH PASSWORD 'secure_password_change_in_production';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT CONNECT ON DATABASE newsletter TO newsletter_app;
GRANT USAGE ON SCHEMA public TO newsletter_app;
GRANT CREATE ON SCHEMA public TO newsletter_app;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO newsletter_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO newsletter_app;