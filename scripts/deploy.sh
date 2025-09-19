#!/bin/bash

# Production deployment script
# Usage: ./scripts/deploy.sh [environment]

set -e

ENVIRONMENT=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 Starting deployment to $ENVIRONMENT environment..."

# Load environment-specific variables
if [ -f "$PROJECT_DIR/.env.$ENVIRONMENT.local" ]; then
    source "$PROJECT_DIR/.env.$ENVIRONMENT.local"
    echo "✅ Loaded environment variables from .env.$ENVIRONMENT.local"
else
    echo "⚠️  No .env.$ENVIRONMENT.local file found, using system environment variables"
fi

# Validate required environment variables
required_vars=(
    "DATABASE_URL"
    "BETTER_AUTH_SECRET"
    "RESEND_API_KEY"
    "OPENAI_API_KEY"
    "R2_ACCESS_KEY_ID"
    "R2_SECRET_ACCESS_KEY"
    "R2_ACCOUNT_ID"
    "R2_BUCKET_NAME"
    "REDIS_URL"
)

echo "🔍 Validating environment variables..."
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Missing required environment variable: $var"
        exit 1
    fi
done
echo "✅ All required environment variables are set"

# Build and deploy with Docker Compose
echo "🏗️  Building application..."
docker-compose -f docker-compose.yml build --no-cache

echo "📦 Running database migrations..."
docker-compose run --rm newsletter-app pnpm tsx scripts/migrate-production.ts

# Only seed in staging or if explicitly requested
if [ "$ENVIRONMENT" = "staging" ] || [ "$2" = "--seed" ]; then
    echo "🌱 Seeding database..."
    docker-compose run --rm newsletter-app pnpm tsx scripts/seed-production.ts
fi

echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
timeout=300
counter=0

while [ $counter -lt $timeout ]; do
    if docker-compose ps | grep -q "healthy"; then
        echo "✅ Services are healthy"
        break
    fi
    
    if [ $counter -eq $timeout ]; then
        echo "❌ Services failed to become healthy within $timeout seconds"
        docker-compose logs
        exit 1
    fi
    
    sleep 5
    counter=$((counter + 5))
    echo "⏳ Waiting... ($counter/$timeout seconds)"
done

# Run post-deployment health checks
echo "🔍 Running post-deployment health checks..."
curl -f http://localhost:3000/api/health || {
    echo "❌ Health check failed"
    docker-compose logs newsletter-app
    exit 1
}

echo "✅ Deployment to $ENVIRONMENT completed successfully!"
echo "🌐 Application is running at: ${APP_URL:-http://localhost:3000}"

# Show running services
echo "📊 Running services:"
docker-compose ps