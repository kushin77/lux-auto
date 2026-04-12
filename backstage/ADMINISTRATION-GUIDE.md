# Backstage Configuration & Administration Guide

## System Overview

Backstage is your centralized development platform providing:
- **Service Catalog** - Discover, manage, and own services
- **API Catalog** - Browse and consume APIs
- **Scaffolder** - Create standardized services
- **Tech Docs** - Centralized documentation
- **Operational Dashboards** - Monitor system health

---

## Architecture

```
┌──────────────────────────────────────────┐
│    Backstage Frontend (React)            │
└──────────────────┬───────────────────────┘
                   │
┌──────────────────────────────────────────┐
│    Backstage Backend (Node.js)          │
│  ├─ Catalog Service                     │
│  ├─ Scaffolder                          │
│  ├─ Authentication                      │
│  ├─ Search & Indexing                   │
│  └─ Tech Docs Generator                 │
└──────────────────┬───────────────────────┘
                   │
┌──────────────────────────────────────────┐
│  Data & External Services                │
│  ├─ PostgreSQL Database                 │
│  ├─ GitHub Integration                  │
│  ├─ Grafana Dashboards                  │
│  └─ Datadog Monitoring                  │
└──────────────────────────────────────────┘
```

---

## Quick Start

### Step 1: Start Backstage

```bash
cd /path/to/lux-auto
docker-compose up -d backstage
docker-compose logs -f backstage
```

Wait for: "Backend loaded successfully in X ms"

### Step 2: Access Backstage

1. Open: `https://backstage.lux.kushnir.cloud`
2. Click **Sign in** → **Continue with Google**
3. Approve Google OAuth
4. You're authenticated

### Step 3: Register First Service

1. Click **Create** → **Register Existing Component**
2. Enter GitHub URL: `https://github.com/kushin77/lux-auto`
3. Click **Analyze** then **Import**
4. Service is registered in catalog

### Step 4: Explore Catalog

- **Catalog**: Browse all services
- **APIs**: View available APIs
- **Systems**: See logical groupings
- **Teams**: View team ownership

---

## Configuration

### Environment Variables

Required in `docker-compose.yml`:

```yaml
environment:
  BACKSTAGE_PG_DBNAME: backstage_db
  BACKSTAGE_PG_USER: backstage
  BACKSTAGE_PG_PASSWORD: ${BACKSTAGE_DB_PASSWORD}
  BACKSTAGE_PG_HOST: postgres
  BACKSTAGE_PG_PORT: 5432
  BACKSTAGE_GITHUB_TOKEN: ${BACKSTAGE_GITHUB_TOKEN}
  BACKSTAGE_AUTH_GITHUB_CLIENT_ID: ${BACKSTAGE_GITHUB_CLIENT_ID}
  BACKSTAGE_AUTH_GITHUB_CLIENT_SECRET: ${BACKSTAGE_AUTH_GITHUB_CLIENT_SECRET}
  BACKSTAGE_BASE_URL: https://backstage.lux.kushnir.cloud
  BACKSTAGE_AUTH_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
  BACKSTAGE_AUTH_GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
  NODE_ENV: production
  LOG_LEVEL: info
```

### Authentication Methods

Backstage supports multiple auth providers:

1. **Google OAuth** (Default):
   - Users sign in with Google account
   - Email used as identity

2. **GitHub OAuth**:
   - Users sign in with GitHub account
   - Team membership from GitHub

3. **Service Account** (for automation):
   - Generate token for CI/CD pipelines
   - Use in scripts and webhooks

---

## Adding Users & Teams

### User Access

All users with a valid Google account can sign in.

**To manage users**:
1. Go to **Settings** → **User Management**
2. View all signed-in users
3. Disable access if needed
4. Assign roles (Admin, Maintainer, User)

### Team Setup

Teams own services and drive decisions.

**Create a team**:
1. Go to **Catalog** → **Teams**
2. Click **+ Create Team**
3. Enter team name (e.g., "backend-team")
4. Add members
5. Click **Create**

**Assign team ownership**:
```yaml
# In service catalog-info.yaml
spec:
  owner: backend-team  # References team
  system: lux-auto-platform
```

---

## Entity Management

### Registering Entities

Three ways to register services:

#### 1. Static YAML (Recommended)

Commit `catalog-info.yaml` to your repo:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: inventory-api
  title: Inventory API
  description: Manages product inventory
spec:
  type: service
  owner: backend-team
  lifecycle: production
  system: commerce-platform
  providesApis:
    - inventory-api
  dependsOn:
    - resource:default/postgres-db
```

Backstage auto-discovers and registers when committed.

#### 2. Dynamic Registration

```bash
curl -X POST https://backstage.lux.kushnir.cloud/api/catalog/entities \
  -H "Content-Type: application/yaml" \
  -d @entity.yaml
```

#### 3. GitHub Integration

Backstage scans GitHub for `catalog-info.yaml` files.

**Setup**:
1. Configure GitHub token in Settings
2. Add organization in Catalog Settings
3. Backstage auto-discovers repos with `catalog-info.yaml`

### Entity Types

```yaml
# Service - Deployable component
kind: Component
type: service

# Website - Web UI
kind: Component
type: website

# Library - Reusable code
kind: Component
type: library

# API - Consumable interface
kind: API
type: openapi|graphql|grpc

# Resource - Infrastructure
kind: Resource
type: database|storage|queue

# System - Logical grouping
kind: System

# Group - Team/Department
kind: Group
```

---

## Scaffolder Templates

Create standardized services with templates.

### Using Templates

1. Click **Create** (top nav)
2. Select template (e.g., "Python API Service")
3. Fill parameters
4. Review generated files
5. Click **Create**

Scaffolder will:
- Generate project files
- Create GitHub repo
- Register in catalog
- Setup basic CI/CD

### Available Templates

- **Python API Service** - FastAPI/Flask with DB
- **Node API Service** - Express with tests
- **React App** - Frontend with TypeScript
- **Database Migration** - Alembic migration
- **Docker Config** - Dockerfile + docker-compose
- **Monitoring** - Grafana dashboard
- **Integration Tests** - Pytest/Jest suite

See `backstage/scaffolder-templates.yaml` for details.

---

## Tech Documentation

Every service should have documentation.

### Writing Docs

1. Create `docs/` directory in repo
2. Create `docs/index.md` (overview)
3. Create additional docs:
   - `getting-started.md`
   - `api.md`
   - `deployment.md`
   - `troubleshooting.md`
4. Create `mkdocs.yml`:
   ```yaml
   site_name: Service Name
   docs_dir: docs
   nav:
     - Home: index.md
     - Getting Started: getting-started.md
     - API: api.md
   ```
5. Add to `catalog-info.yaml`:
   ```yaml
   metadata:
     annotations:
       backstage.io/techdocs-ref: dir:.
   ```

### Doc Structure

```
docs/
├── index.md              # Overview & features
├── getting-started.md    # Quick start guide
├── api.md                # API reference
├── deployment.md         # Deploy procedures
├── troubleshooting.md    # FAQ & issues
└── images/               # Screenshots
```

---

## API Catalog

Browse and consume available APIs.

### Registering APIs

```yaml
apiVersion: backstage.io/v1alpha1
kind: API
metadata:
  name: deals-api
  title: Deals API
  description: Manages vehicle deals
spec:
  type: openapi
  owner: backend-team
  lifecycle: production
  definition: |
    openapi: 3.0.0
    info:
      title: Deals API v2
      version: 2.0.0
    servers:
      - url: https://lux.kushnir.cloud/api/v2
    paths:
      /deals:
        get: ...
        post: ...
```

### Viewing APIs

1. Click **Catalog** → **APIs**
2. Select API to view spec
3. Try endpoints from UI
4. View implementation details

---

## Operational Dashboards

Monitor system health and performance.

### Available Dashboards

1. **System Overview** - Service status, health
2. **Dependency Graph** - Service relationships
3. **API Health** - API availability & performance
4. **Resource Monitoring** - CPU, memory, disk
5. **Audit & Compliance** - Access logs, events
6. **Team & Ownership** - Team members, schedules

### Accessing Dashboards

- **System Overview**: `/dashboards/system-overview`
- **Dependency Graph**: `/dashboards/dependency-graph`
- **API Health**: `/dashboards/api-health`
- **Resource Monitoring**: `/dashboards/resource-monitoring`
- **Audit & Compliance**: `/dashboards/audit-compliance`
- **Team & Ownership**: `/dashboards/team-ownership`

See `backstage/operational-dashboards.json` for details.

---

## Administration

### User Management

**Access**: `Settings` → `User Management`

- View all authenticated users
- Disable/reactivate accounts
- Assign roles and permissions
- Configure allowed email domains

### Settings

**Access**: `Settings` → `General Settings`

Configure:
- Site name and branding
- Integrations (GitHub, Grafana, etc.)
- Authentication providers
- Rate limiting
- Visibility rules

### Service Ownership

Track who owns which services:

1. Click service in catalog
2. View **owner** field
3. See team members
4. Contact primary maintainer

### Modify Ownership

Edit `catalog-info.yaml`:

```yaml
spec:
  owner: new-team  # Change ownership
  maintainers:    # Add maintainers
    - user:lead@lux-auto.com
    - user:dev@lux-auto.com
```

---

## Integration with External Systems

### GitHub Integration

**Setup**:
1. Generate GitHub Personal Access Token
2. Go to `Settings` → `GitHub`
3. Paste token
4. Add organizations to sync

**Features**:
- Auto-discover `catalog-info.yaml`
- Link to PRs and issues
- GitHub insights
- Repository webhooks

### Grafana Integration

**Setup**:
1. Get Grafana API key
2. Go to `Settings` → `Grafana`
3. Configure URL and API key
4. Test connection

**Features**:
- Link dashboards to services
- View metrics in Backstage
- Alert notifications

### PagerDuty Integration

**Setup**:
1. Create PagerDuty API token
2. Go to `Settings` → `PagerDuty`
3. Configure token
4. Link teams to on-call schedules

**Features**:
- View on-call engineer
- Create incidents
- Escalation policies

---

## Backup & Recovery

### Backup Database

```bash
docker exec postgres pg_dump -U backstage backstage_db \
  > backstage_backup_$(date +%Y%m%d).sql
```

### Backup Configuration

```bash
tar czf backstage_config.tar.gz /backstage/
```

### Restore Database

```bash
docker exec -i postgres psql -U backstage backstage_db \
  < backstage_backup_20240412.sql
```

### Restore Configuration

```bash
tar xzf backstage_config.tar.gz -C /
```

---

## Troubleshooting

### "Entity registration failed"

**Cause**: Invalid YAML

**Fix**:
1. Validate YAML: `yamllint catalog-info.yaml`
2. Check required fields
3. Ensure references exist

### "Cannot connect to GitHub"

**Cause**: Invalid token

**Fix**:
1. Verify token in `Settings` → `GitHub`
2. Check permissions: repo, read:org
3. Regenerate if needed

### "Docs not showing"

**Cause**: TecDocs build failed

**Fix**:
1. Verify `docs/index.md` exists
2. Check `mkdocs.yml` is valid
3. View logs: `docker logs lux-backstage`

### "Services not appearing"

**Cause**: Catalog sync failed

**Fix**:
1. Check `catalog-info.yaml` exists in repo
2. Verify GitHub integration configured
3. Manually trigger sync in `Settings` → `Catalog`

---

## Best Practices

### Naming

- **Services**: `[team]-[function]-[type]`
  - Example: `backend-inventory-api`
  
- **References**: Use full path
  - Example: `component:default/my-service`

### Documentation

- Keep docs in sync with code
- Include examples and screenshots
- Document deployment process
- List known issues
- Link related services

### Entity Metadata

Always include:

```yaml
metadata:
  name: service-name        # Unique, required
  title: Display Name       # For UI
  description: What it does # For discovery
spec:
  owner: team-name          # Team responsibility
  lifecycle: production      # Current state
  system: larger-system     # Logical grouping
```

### Entity Relationships

Define dependencies:

```yaml
spec:
  owner: backend-team
  dependsOn:
    - component:default/auth-library
    - resource:default/postgres-db
  providesApis:
    - my-rest-api
  consumesApis:
    - auth-service
```

---

## Support & Help

- **Backstage Docs**: https://backstage.io/docs
- **Community Chat**: https://backstage.io/community
- **GitHub Issues**: https://github.com/backstage/backstage/issues

For Lux-Auto:
- **Slack**: #backstage
- **Email**: devops@lux-auto.com

---

Last Updated: April 12, 2026
Version: 1.0
