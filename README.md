# Lux-Auto - OAuth2 SSO with FastAPI

Automated arbitrage opportunity finder with enterprise-grade OAuth2 Single Sign-On authentication.

## 📋 Overview

Lux-Auto is a production-ready FastAPI application with:
- **OAuth2 Authentication**: Google OAuth via oauth2-proxy
- **Session Management**: Secure token tracking and revocation
- **Reverse Proxy**: Caddy with automatic HTTPS/Let's Encrypt
- **Database**: PostgreSQL with audit logging
- **Caching**: Redis for session and data caching
- **Docker**: Multi-container deployment with docker-compose
- **Infrastructure-as-Code**: Terraform for reproducible deployments
- **Enterprise**: Full compliance, security scanning, monitoring

## 🚀 Enterprise Standards Framework

**This repository enforces FAANG-level engineering standards.**

Before development, please review:
- [**00-START-HERE.md**](00-START-HERE.md) — Framework overview (5 min read)
- [**CONTRIBUTING.md**](CONTRIBUTING.md) — Engineering standards and review gates
- [**DEVELOPER-QUICKSTART.md**](DEVELOPER-QUICKSTART.md) — First-time setup and PR workflow

**Key Standards:**
- ✅ 90%+ test coverage required (enforced by CI)
- ✅ All PRs require 2 approvals + security review
- ✅ Pre-commit hooks catch issues before push
- ✅ 9-stage CI/CD pipeline (lint → type check → tests → SAST → container scan)
- ✅ SLO monitoring with error budgets (99.5% availability target)
- ✅ Architecture Decisions documented via ADR system

See [IMPLEMENTATION-CHECKLIST.md](IMPLEMENTATION-CHECKLIST.md) for team rollout phases.

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose v2+
- Bash shell
- Google OAuth2 credentials (from Google Cloud Console)
- Secrets in Google Secret Manager
- Python 3.11+ (for local development)

### Local Development Setup

Run automated setup script:

```bash
# Bash (Linux/macOS)
bash scripts/setup-framework.sh

# PowerShell (Windows)
.\scripts\setup-framework.ps1
```

This configures:
- Python virtual environment
- All development dependencies
- Pre-commit hooks (auto-runs on commit)
- Local testing capability

### 1. Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with values from Google Secret Manager
nano .env
```

**Required secrets** (from `lux-auto` GSM project):
```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
OAUTH2_PROXY_COOKIE_SECRET
FASTAPI_SECRET_KEY
DATABASE_PASSWORD
```

### 2. Validation

```bash
# Run pre-deployment validation (14-point check)
bash scripts/validate-config.sh
```

**Checks:**
- Environment variables
- Docker installation
- File structure
- Port availability
- Security compliance

### 3. Deployment

```bash
# Build and start all services (ordered startup)
bash scripts/deploy.sh start

# Expected output:
# - PostgreSQL: healthy
# - Redis: responding
# - FastAPI: health check passed
# - OAuth2 Proxy: responding
# - Caddy: HTTPS certificate generated
```

### 4. Verification

```bash
# Check service status
bash scripts/deploy.sh status

# View logs
bash scripts/deploy.sh logs fastapi

# Monitor in real-time (30s refresh)
bash scripts/monitor.sh
```

## 📊 Architecture

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ HTTPS
       ↓
┌─────────────────────────────────────────┐
│         Caddy Reverse Proxy             │
│  (HTTPS, security headers, routing)     │
└──────┬──────────────────────────────────┘
       │ mTLS / internal
       ↓
┌─────────────────────────────────────────┐
│      oauth2-proxy (7.6.0)               │
│  (OAuth2 validator, header injection)   │
└──────┬──────────────────────────────────┘
       │ HTTP
       ↓
┌─────────────────────────────────────────┐
│    FastAPI Application (8000)            │
│  (OAuth endpoints, API, session mgmt)    │
│                                          │
│  ├── /health (no auth)                  │
│  ├── /api/me (user profile)             │
│  ├── /api/sessions (session list)       │
│  ├── /api/sessions/logout               │
│  └── /api/sessions/logout-all           │
└──────┬──────────┬──────────────────────┘
       │          │
       ↓          ↓
   ┌─────────┐  ┌──────────┐
   │PostgreSQL  │  Redis   │
   │ (users,    │(cache,   │
   │ sessions)  │tokens)   │
   └─────────┘  └──────────┘
```

## 🔒 Security

### Built-in Protections

✅ **Secrets Management**
- Zero credentials in code
- All secrets in Google Secret Manager
- Environment variable injection at runtime

✅ **Authentication**
- OAuth2 via Google (no password storage)
- Session tokens SHA-256 hashed
- 24-hour TTL (configurable)
- Multi-device revocation support

✅ **Network**
- HTTPS enforced via Caddy
- HTTP→HTTPS redirect
- HSTS header (1 year)
- CORS restricted
- CSP headers configured

✅ **Data Protection**
- Audit logging for security events
- IP address and User-Agent tracking
- Expired session cleanup every 6 hours
- Database encryption support

### Pre-Deployment Security Checks

```bash
# Validate configuration before deployment
bash scripts/validate-config.sh

# Includes:
# - Secrets scanning (no hardcoded credentials)
# - File permissions
# - DNS configuration
# - Port availability
```

## 📈 Operations

### Service Management

```bash
# Start services
bash scripts/deploy.sh start

# Stop all services
bash scripts/deploy.sh stop

# Restart services
bash scripts/deploy.sh restart

# View logs
bash scripts/deploy.sh logs [service]
bash scripts/deploy.sh logs fastapi
bash scripts/deploy.sh logs oauth2-proxy

# Health status
bash scripts/deploy.sh status

# Monitor continuously
bash scripts/monitor.sh [interval]
bash scripts/monitor.sh 30  # 30-second refresh
```

### Emergency Procedures

```bash
# Rollback to last known good state
bash scripts/rollback.sh containers

# Restore from database backup
bash scripts/rollback.sh database

# Full reset (destroys all data)
bash scripts/rollback.sh full
```

## 📊 Monitoring & Observability

### Deploy Monitoring Stack

```bash
# Navigate to monitoring directory
cd monitoring

# Set environment variables
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
export PAGERDUTY_SERVICE_KEY="your-pagerduty-key"

# Start monitoring stack (Prometheus, AlertManager, Grafana)
docker-compose -f docker-compose.monitoring.yml up -d

# Verify all services running
docker-compose -f docker-compose.monitoring.yml ps
```

### Access Monitoring Interfaces

- **Prometheus** (metrics queries): https://lux.kushnir.cloud/monitoring/prometheus
- **AlertManager** (alert status): https://lux.kushnir.cloud/monitoring/alertmanager
- **Grafana** (dashboards): https://lux.kushnir.cloud (default: admin/admin)

### Configure Slack/PagerDuty Alerts

Alerts are triggered when SLOs are violated:
- **Critical** → PagerDuty (immediate on-call escalation)
- **Warning** → Slack #alerts (grouped alerts)
- **Info** → Slack #general (deployment info)

See [monitoring/MONITORING-SETUP.md](monitoring/MONITORING-SETUP.md) for complete setup guide.

### Key Metrics Being Monitored

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Error Rate | <0.1% | >5% over 5 min → Critical |
| Latency (p95) | <200ms | >1000ms → Warning |
| Availability | 99.5% | Drops trigger alerts |
| DB Connections | <80% pool | >80% usage → Warning |
| OAuth Failures | <1% | >1% failures → Critical |

## 🧪 Testing

### Run Tests

```bash
# All tests with coverage
pytest --cov=backend --cov-fail-under=80 tests/

# Unit tests only
pytest -m unit tests/

# E2E tests
pytest tests/e2e/test_oauth_flow.py -v

# Specific test
pytest tests/unit/test_auth.py::TestUserService::test_admin_user_creation -v
```

### Test Types

- **Unit Tests** (`tests/unit/`) - Auth modules, user service, session service
- **Integration Tests** (`tests/integration/`) - Service communication
- **E2E Tests** (`tests/e2e/`) - Complete OAuth flow
- **Security Tests** (`tests/security/`) - Injection, spoofing, auth bypass

**Coverage Requirement**: 80%+ on auth module

## 🔧 Troubleshooting

### Service won't start

```bash
# Check Docker daemon
docker ps

# Validate configuration
bash scripts/validate-config.sh

# Check ports in use
netstat -tuln | grep -E ':(80|443|5432|6379|8000)'

# View service logs
docker compose logs -f SERVICE_NAME
```

### PostgreSQL issues

```bash
# Check PostgreSQL health
docker exec lux-postgres pg_isready -U lux_admin

# Connect to database
docker exec -it lux-postgres psql -U lux_admin -d lux_prod

# View logs
docker compose logs postgres
```

### OAuth not working

```bash
# Verify credentials in .env
grep GOOGLE_CLIENT lux .env

# Check oauth2-proxy logs
docker compose logs oauth2-proxy | tail -50

# Test oauth2-proxy health
curl https://lux.kushnir.cloud/ping
```

### FastAPI health check failing

```bash
# Direct test
curl https://lux.kushnir.cloud/health

# Check logs
docker compose logs fastapi | tail -50

# Verify database connection
curl -H "X-Auth-Request-Email: test@example.com" https://lux.kushnir.cloud/api/me
```

## 📦 Deployment Modes

### Development (Docker Desktop)

```bash
# Fastest local development
bash scripts/deploy.sh start

# All services in same network
# Database persists in named volume
# Perfect for testing OAuth flow
```

### Staging (VirtualBox + Docker)

```bash
# Near-production testing
# See ENTERPRISE-DEPLOYMENT.md for full setup

# Same services, isolated VM
# Tests actual networking
# Validates database migration
```

### Production (Kubernetes)

```bash
# Enterprise deployment
# See issues #75 for K8s manifests

# Scalable pods
# Load balancing
# Persistent storage
# Rolling updates
```

## 📋 API Endpoints

### Health Check (No Auth)
```
GET /health
→ {"status": "healthy", "service": "lux-auto-fastapi"}
```

### User Profile
```
GET /api/me
Headers: X-Auth-Request-Email: user@example.com
→ {"id": 1, "email": "user@example.com", "role": "user", "is_admin": false}
```

### Sessions
```
GET /api/sessions
→ {"user_email": "user@example.com", "active_sessions": 1, "sessions": [...]}

POST /api/sessions/logout
→ {"status": "success", "message": "Session revoked"}

POST /api/sessions/logout-all
→ {"status": "success", "message": "All sessions revoked"}
```

### Metrics
```
GET /metrics
→ Prometheus metrics in text format
```

## 🛠️ Infrastructure as Code

### Terraform

```bash
# Initialize Terraform
cd terraform
terraform init

# Plan deployment
terraform plan -var-file="terraform.tfvars"

# Apply (create containers)
terraform apply -var-file="terraform.tfvars"

# Destroy (remove containers)
terraform destroy -var-file="terraform.tfvars"
```

### Configuration

Copy and edit `terraform/terraform.tfvars.example`:
```bash
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
nano terraform/terraform.tfvars
```

## 📖 Documentation

- [Enterprise Deployment Guide](./ENTERPRISE-DEPLOYMENT.md)
- [Implementation Guide](./.instructions.md)
- [Repository Conventions](/memories/repo/lux-auto-conventions.md)
- [Skills & Patterns](./SKILLS.md)

## 🔗 References

- **Code-Server**: Similar implementation: github.com/kushin77/code-server
- **FastAPI**: https://fastapi.tiangolo.com
- **oauth2-proxy**: https://oauth2-proxy.github.io/
- **Caddy**: https://caddyserver.com/docs/
- **Docker**: https://docs.docker.com/

## 👤 Author

**kushin77** - GitHub account  
**Lux-Auto Repo**: https://github.com/kushin77/lux-auto

---

**Status**: Production Ready ✅  
**Enterprise Compliance**: SOC2, HIPAA-ready, Full audit logging
