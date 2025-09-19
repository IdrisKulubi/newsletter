# Newsletter SaaS Platform - Deployment

This document provides a quick start guide for deploying the Newsletter SaaS Platform.

## Quick Start

### Prerequisites

- Docker and Docker Compose
- PostgreSQL database
- Redis instance
- Cloudflare R2 bucket
- Resend API key
- OpenAI API key

### 1. Environment Setup

```bash
# Copy environment template
cp .env.production .env.production.local

# Edit with your actual values
nano .env.production.local
```

### 2. Deploy with Docker Compose

```bash
# Deploy to production
./scripts/deploy.sh production

# Or deploy to staging
./scripts/deploy.sh staging
```

### 3. Verify Deployment

```bash
# Check health
curl http://localhost:3000/api/health

# Check services
docker-compose ps
```

## Monitoring

Start the monitoring stack:

```bash
docker-compose -f docker-compose.yml -f monitoring/docker-compose.monitoring.yml up -d
```

Access monitoring tools:
- **Grafana**: http://localhost:3001 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093

## Documentation

- [Full Deployment Guide](docs/DEPLOYMENT.md)
- [Operations Runbook](docs/RUNBOOK.md)

## Support

For issues and support, refer to the troubleshooting section in the runbook or contact the operations team.