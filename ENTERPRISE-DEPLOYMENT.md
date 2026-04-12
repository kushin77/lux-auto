# Lux-Auto Enterprise Deployment Standards

## Overview

**This is an ENTERPRISE deployment.** NOT suitable for casual/local-only development.

Requirements:
- All testing MUST happen in isolated environments (Docker, VirtualBox, or Kubernetes)
- ZERO tolerance for loose deployments to workstations
- All code must pass security scanning before production
- All infrastructure defined as Code (Terraform/Kubernetes)
- Immutable infrastructure (no manual changes post-deploy)
- Full audit trails and compliance logging

---

## Local Testing Environment (REQUIRED)

### Option 1: Docker Desktop (Recommended for Development)

**Requirements**:
- Docker Desktop 4.x+ with Compose v2
- 8GB RAM minimum, 4 CPU cores
- 50GB disk space for images/volumes
- VirtualBox or Hyper-V backend

**Setup**:
```bash
# 1. Verify Docker installation
docker --version
docker compose --version

# 2. Start Docker daemon
# (GUI: Docker Desktop app, or systemctl start docker)

# 3. Validate docker-compose.yml
docker compose config

# 4. Fetch secrets locally (for testing only)
source scripts/fetch-gsm-secrets.sh

# 5. Start test environment
docker compose up -d --build

# 6. Wait for health (max 2 min)
bash scripts/validate-config.sh

# 7. Run test suite
pytest --cov=backend tests/
```

**Expected Output**:
```
✓ All services healthy (FastAPI, oauth2-proxy, Caddy, PostgreSQL)
✓ All tests passing (unit, integration, E2E, security)
✓ No hardcoded secrets found
✓ Coverage 90%+ on auth module
```

### Option 2: VirtualBox VM (Recommended for Staging)

**Requirements**:
- VirtualBox 7.x
- Ubuntu 22.04 LTS base image
- Vagrant for automated setup (optional)

**Setup**:
```bash
# Using Vagrant (recommended)
vagrant up
vagrant ssh

# Inside VM:
cd /vagrant
docker compose up -d --build
bash scripts/validate-config.sh
pytest tests/
```

**Vagrantfile** (create this):
```ruby
Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/jammy64"
  config.vm.provider "virtualbox" do |vb|
    vb.memory = 8192
    vb.cpus = 4
  end
  config.vm.provision "shell", inline: <<-SHELL
    apt-get update
    apt-get install -y docker.io docker-compose git curl
    usermod -aG docker vagrant
  SHELL
end
```

### Environment Parity Matrix

| Aspect | Development (Docker) | Staging (VBox) | Production (K8s) |
|--------|---|---|---|
| Database | PostgreSQL 16 | PostgreSQL 16 | PostgreSQL 16 (cloud) |
| Auth | oauth2-proxy 7.6.0 | oauth2-proxy 7.6.0 | oauth2-proxy 7.6.0 |
| Reverse Proxy | Caddy 2.7 | Caddy 2.7 | Ingress Controller |
| App | FastAPI (same image) | FastAPI (same image) | FastAPI (same image) |
| Networking | Bridge | NAT+host-only | ClusterIP+NodePort |
| Storage | docker volumes | local VM storage | PersistentVolumes |
| Logging | JSON stdout | JSON file | ELK/Stackdriver |
| Monitoring | Manual (curl) | Prometheus | Prometheus+Grafana |

---

## Security Scanning (REQUIRED Before Each Deploy)

### 1. Credential Scanning

**Tool**: `git-secrets` or `rusty-hog`

```bash
# Scan for hardcoded credentials
git secrets --scan

# Scan for patterns (API keys, AWS keys, etc)
rusty-hog entropy --path .

# Scan Python code
bandit -r backend/
```

**Failure Criteria**:
- Any hardcoded OAuth credentials → BLOCK
- Any hardcoded database password → BLOCK  
- Any AWS/GCP keys in code → BLOCK
- Any private keys (RSA/Ed25519) → BLOCK

### 2. Container Image Scanning

**Tool**: `Trivy` (free) or `Snyk` (paid)

```bash
# Scan Docker image for vulnerabilities
trivy image kushin77/lux-auto:latest

# Scan with fail thresholds
trivy image --exit-code 1 --severity HIGH,CRITICAL kushin77/lux-auto:latest
```

**Failure Criteria**:
- CRITICAL vulnerabilities → BLOCK
- HIGH vulnerabilities in auth module → BLOCK
- Known vulnerabilities in dependencies → REVIEW

### 3. Dependency Scanning

**Tool**: `pip-audit` (Python)

```bash
# Scan Python dependencies
pip-audit --requirements requirements.txt

# Fail on known vulnerabilities
pip-audit --strict
```

**Failure Criteria**:
- Any known CVEs in dependencies → BLOCK
- Outdated security patches → REVIEW

### 4. Code Quality & SAST

**Tool**: `Pylint`, `Bandit`, `SoundCloud`

```bash
# Security issues
bandit -r backend/ -ll

# Code quality
pylint backend/ --fail-under=8.0

# Type checking
mypy backend/ --strict
```

**Failure Criteria**:
- Type checking errors → BLOCK
- Bandit security issues (medium+) → REVIEW
- Code quality score <8.0 → REVIEW

### 5. Configuration Validation

**Critical Checks**:
```bash
# 1. No secrets in .env (should be empty placeholders)
grep -i "password\|secret\|token" .env.example | grep -v "change-me" && echo "FAIL: Secrets in .env" || echo "PASS"

# 2. .env file in .gitignore
grep "^\.env$" .gitignore && echo "PASS" || echo "FAIL: .env not in gitignore"

# 3. No hardcoded domains (except templates)
grep -r "lux.kushnir.cloud" backend/ | grep -v "test\|config" && echo "WARN: Domain hardcoded" || echo "PASS"

# 4. All Docker images pinned to specific versions
grep "image:.*:latest" docker-compose.yml && echo "FAIL: Latest tag used" || echo "PASS"

# 5. All services have health checks
grep -c "healthcheck:" docker-compose.yml | awk '{if ($1<4) print "FAIL: Missing healthchecks"; else print "PASS"}'
```

---

## Testing Strategy (ENTERPRISE)

### Local Test Environment (Docker)

**Test Levels**:
1. **Unit Tests** - Fast, isolated business logic
2. **Integration Tests** - Service interactions
3. **E2E Tests** - Full OAuth flow
4. **Security Tests** - Injection, spoofing, credential leaks
5. **Load Tests** - Throughput > 10 req/sec

**Test Execution**:
```bash
# Full test suite with coverage (must pass before moving to staging)
pytest --cov=backend --cov-fail-under=90 --cov-report=html tests/

# Generate coverage report
open htmlcov/index.html

# Security-specific tests
pytest -m security tests/ -v

# Load testing
pytest tests/load -v --tb=short
```

**Pass Criteria**:
- ✅ 90%+ code coverage (auth module: 95%+)
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ All E2E tests pass (OAuth flow complete)
- ✅ All security tests pass (no injection, no spoofing)
- ✅ Load test shows >10 req/sec throughput
- ✅ No flaky tests (run 3x)

### Staging Test Environment (VirtualBox VM)

**Additional Tests**:
```bash
# 1. Full deployment from git clone
cd /tmp && git clone https://github.com/kushin77/lux-auto.git
cd lux-auto
bash scripts/validate-config.sh  # Should PASS
bash scripts/deploy.sh           # Full deployment

# 2. Smoke tests
curl https://localhost/health
curl -H "X-Auth-Request-Email: test@example.com" https://localhost/api/me

# 3. Persistence test (stop/start containers)
docker compose stop fastapi
docker compose start fastapi
# Verify data still exists

# 4. Rollback test
bash scripts/rollback.sh
# Verify previous version works

# 5. Network isolation
# Verify oauth2-proxy handles offline Google OAuth gracefully

# 6. Database backup/restore
bash scripts/backup.sh
docker compose down -v  # Remove volumes
bash scripts/restore.sh
# Verify data recovered
```

---

## Infrastructure as Code (REQUIRED)

### Docker Compose (Development/Staging)

**File**: `docker-compose.yml`
- ✅ All services defined
- ✅ All healthchecks defined
- ✅ All volumes persist data
- ✅ All environment variables externalized
- ✅ No hardcoded secrets
- ✅ Logging configured (json-file, 10MB limit)
- ✅ Restart policies set

**Validation**:
```bash
docker compose config  # Validate syntax
docker compose up -d --build  # Build and start
docker compose ps  # Verify all services running
```

### Terraform (All Infrastructure)

**Files**:
- `terraform/main.tf` - Resource definitions
- `terraform/variables.tf` - Input variables
- `terraform/terraform.tfvars` - Environment-specific values (gitignored)
- `terraform/outputs.tf` - Outputs (URLs, IPs, etc)

**Validation**:
```bash
cd terraform
terraform init
terraform fmt  # Auto-format
terraform validate  # Syntax check
terraform plan -var-file="terraform.tfvars"  # Preview changes
terraform apply -var-file="terraform.tfvars"  # Apply changes
```

**Idempotency**: All resources must be safe to redeploy:
```bash
terraform apply -var-file="terraform.tfvars"  # Safe to run multiple times
terraform apply -var-file="terraform.tfvars"  # No unexpected changes
```

### Kubernetes (Production - Future)

**Files** (to be created):
- `k8s/namespace.yaml` - Isolated namespace
- `k8s/secrets.yaml` - ConfigMaps for non-secrets, Secrets for passwords
- `k8s/database.yaml` - StatefulSet for PostgreSQL
- `k8s/fastapi.yaml` - Deployment for FastAPI
- `k8s/oauth2-proxy.yaml` - DaemonSet or sidecar pattern
- `k8s/ingress.yaml` - Ingress for Caddy replacement
- `k8s/hpa.yaml` - Horizontal Pod Autoscaler

---

## Deployment Checklist (ENTERPRISE GATES)

### Pre-Deployment (Must All Pass)

- [ ] Code merged to main branch
- [ ] All tests passing (unit, integration, E2E, security)
- [ ] Code coverage 90%+
- [ ] No hardcoded secrets found (git-secrets, bandit)
- [ ] Dependencies scanned (pip-audit, Snyk)
- [ ] Container image scanned (Trivy)
- [ ] Code quality score 8.0+
- [ ] Configuration validated (.env, docker-compose.yml, Caddyfile)
- [ ] All Docker images have specific version tags (not :latest)
- [ ] Changelog updated with deployment notes
- [ ] Rollback procedure documented and tested
- [ ] Database backup created and verified

### Deployment Approval

- [ ] Change request approved (if enterprise policy requires)
- [ ] Stakeholders notified
- [ ] Maintenance window scheduled (if needed)
- [ ] Incident response team on standby

### Deployment Execution

1. **Pre-Deploy Snapshot**:
   ```bash
   bash scripts/backup.sh
   git log --oneline -5 > deployment-record.txt
   docker compose ps >> deployment-record.txt
   ```

2. **Deploy**:
   ```bash
   bash scripts/deploy.sh 2>&1 | tee deployment.log
   ```

3. **Post-Deploy Validation**:
   ```bash
   bash scripts/validate-config.sh
   bash scripts/monitor.sh  # Interactive health dashboard
   curl https://lux.kushnir.cloud/health
   ```

4. **Smoke Tests**:
   ```bash
   # Test OAuth flow manually
   curl -L https://lux.kushnir.cloud/ 2>&1 | grep -i "google\|oauth" && echo "PASS: OAuth redirect works"
   
   # Test authenticated access
   # (Requires manual login via browser)
   
   # Test admin endpoint
   curl https://lux.kushnir.cloud/api/admin/users 2>&1 | grep "Unauthorized\|403\|401" && echo "PASS: Auth working"
   ```

5. **Monitoring (24h)**:
   ```bash
   # Watch logs for errors
   docker compose logs -f --tail=100 fastapi | grep -i "error\|exception" && echo "ISSUES FOUND"
   
   # Check CPU/Memory usage
   docker stats
   ```

### Rollback Procedure (If Needed)

```bash
# 1. STOP - No more traffic
# (In prod, use load balancer to drain connections)

# 2. Identify issue
docker compose logs fastapi | tail -100

# 3. Rollback to previous version
bash scripts/rollback.sh

# 4. Verify previous version works
curl https://lux.kushnir.cloud/health

# 5. Investigate root cause
# (Don't deploy again until fixed)

# 6. Document incident
# (For post-mortem)
```

---

## Compliance & Audit Logging

### Audit Events (All Logged)

All events tagged with `[SECURITY]` or `[AUDIT]`:

```python
logger.warning(f"[SECURITY] Admin user created: {email}")
logger.info(f"[AUDIT] User login: {email}")
logger.warning(f"[SECURITY] Session revoked for user_id={user_id}")
logger.warning(f"[SECURITY] User promoted to admin: {email}")
```

### Log Aggregation (Required)

**Format**: JSON with structured fields
```json
{
  "timestamp": "2026-04-12T20:30:00Z",
  "level": "WARNING",
  "tag": "[SECURITY]",
  "message": "Admin user created",
  "email": "admin@example.com",
  "service": "fastapi",
  "container": "lux-fastapi",
  "request_id": "uuid-123"
}
```

**Storage**:
- Development: Console (docker compose logs)
- Staging: Local file storage with rotation (10MB, 7 days)
- Production: Centralized logging (Stackdriver, ELK, DataDog)

### Secrets Management Compliance

**Golden Rule**: NEVER commit secrets to git, NEVER embed in Docker images

**Allowed**:
- ✅ Environment variables from GSM/Vault
- ✅ ConfigMaps (non-secrets)
- ✅ Mounted files from secret store

**NOT Allowed**:
- ❌ Hardcoded passwords
- ❌ Secrets in .env (git tracked)
- ❌ API keys in code comments
- ❌ Private keys in container images

**Enforcement**:
```bash
# Pre-commit hook (required)
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
git secrets --scan || exit 1
EOF
chmod +x .git/hooks/pre-commit
```

---

## Enterprise Network Architecture

```
┌─────────────────────────────────────────────────┐
│          External Internet (HTTPS)               │
│              lux.kushnir.cloud                  │
└──────────────────────┬──────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │  Load Balancer / WAF        │
        │  (Cloud Armor / CloudFlare) │
        └──────────────┬──────────────┘
                       │
        ┌──────────────┴──────────────┐
        │   Caddy Reverse Proxy       │
        │   (HTTPS termination)       │
        │   (Security headers)        │
        └──────────────┬──────────────┘
                       │
        ┌──────────────┴──────────────┐
        │   oauth2-proxy              │
        │   (Authentication)          │
        │   (Authorization)           │
        └──────────────┬──────────────┘
                       │
        ┌──────────────┴──────────────┐
        │   FastAPI Backend           │
        │   (Application logic)       │
        │   (REST API)                │
        └──────────────┬──────────────┘
                       │
        ┌──────────────┴──────────────┐
        │   PostgreSQL Database       │
        │   (Persistent data)         │
        │   (Encrypted at rest)       │
        └──────────────────────────────┘

Network Isolation:
- Development: Docker bridge (172.28.0.0/16)
- Staging: VirtualBox NAT + Host-only
- Production: Kubernetes network policies
```

---

## Local Testing Validation Steps

Run BEFORE any commit:

```bash
# Step 1: Clean environment
docker compose down -v
rm -rf .venv __pycache__ htmlcov

# Step 2: Build fresh
docker compose build --no-cache

# Step 3: Configuration validation
bash scripts/validate-config.sh

# Step 4: Start services
docker compose up -d

# Step 5: Database migrations
docker compose exec -T fastapi alembic upgrade head

# Step 6: Wait for health
sleep 10
bash scripts/monitor.sh &

# Step 7: Run all tests
pytest --cov=backend --cov-fail-under=90 tests/ -v

# Step 8: Security scanning
bandit -r backend/
git secrets --scan
pip-audit

# Step 9: Manual smoke test
curl https://localhost/health

# Step 10: Cleanup
docker compose down
```

**Expected Result**: ALL PASS  
**If ANY FAIL**: DO NOT COMMIT, DO NOT DEPLOY

---

## GitOps & CI/CD (Future)

When setting up CI/CD pipeline:

**GitHub Actions Workflow** (`./github/workflows/deploy.yml`):
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: pytest --cov=backend --cov-fail-under=90 tests/
      - name: Scan for secrets
        run: git secrets --scan
      - name: Scan image
        run: trivy image kushin77/lux-auto:${{ github.sha }}
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        run: kubectl apply -f k8s/
      - name: Wait for rollout
        run: kubectl rollout status deployment/lux-fastapi -n lux-auto
      - name: Smoke tests
        run: curl https://lux.kushnir.cloud/health
```

---

## Enterprise Support Matrix

| Component | Supported | Tested | Production Ready |
|-----------|-----------|--------|------------------|
| Docker Desktop | ✅ | ✅ | ✅ (dev/staging) |
| VirtualBox | ✅ | ✅ | ❌ (for testing only) |
| Kubernetes | 🚧 | 🚧 | 🚧 (future) |
| PostgreSQL 16 | ✅ | ✅ | ✅ |
| OAuth2-proxy 7.6 | ✅ | ✅ | ✅ |
| Caddy 2.7 | ✅ | ✅ | ✅ |
| FastAPI 0.104+ | ✅ | ✅ | ✅ |

---

## Emergency Contacts

| Role | Contact | Escalation |
|------|---------|-----------|
| Project Owner | kushin77 | GitHub Issues |
| DevOps Lead | TBD | On-call rotation |
| Security Contact | TBD | CISO @ company |
| Incident Response | TBD | 24/7 PagerDuty |

---

**Last Updated**: 2026-04-12  
**Status**: ENTERPRISE MODE - NO LOOSE DEPLOYMENTS  
**Maintained by**: GitHub Copilot with kushin77
