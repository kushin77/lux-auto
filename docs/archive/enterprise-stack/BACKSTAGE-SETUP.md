# Backstage Service Catalog & Configuration

## Overview

Backstage provides service discovery, ownership, and operational visibility for Lux-Auto infrastructure.

## Service Catalog Entities

### Backend Service
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: lux-auto-backend
  title: Lux-Auto FastAPI Backend
  description: Core FastAPI application for deal management and autonomous bidding
  labels:
    team: platform
    component-type: service
    tier: critical
tags:
  - python
  - fastapi
  - api
  - production
links:
  - title: GitHub
    url: https://github.com/kushin77/lux-auto
  - title: API Docs
    url: https://lux.kushnir.cloud/api/v2/docs
  - title: Health Check
    url: https://lux.kushnir.cloud/health
spec:
  type: service
  lifecycle: production
  owner: team-platform
  dependsOn:
    - resource:lux-postgres-primary
    - resource:lux-redis-cache
  providesApis:
    - lux-deals-api
    - lux-buyers-api
    - lux-analytics-api
    - lux-audit-api
  system: lux-auto
  domain: platform
```

### Appsmith Portal Service
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: lux-auto-appsmith
  title: Lux-Auto Appsmith Portal
  description: Low-code deal management and analytics portal
  labels:
    team: platform
    component-type: portal
tags:
  - appsmith
  - low-code
  - portal
  - ui
links:
  - title: Portal URL
    url: https://appsmith.lux.kushnir.cloud
spec:
  type: service
  lifecycle: production
  owner: team-platform
  dependsOn:
    - component:lux-auto-backend
    - resource:lux-postgres-appsmith
  system: lux-auto
  domain: platform
```

### Backstage Developer Portal
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: lux-auto-backstage
  title: Lux-Auto Backstage Portal
  description: Developer and operational portal with service catalog
  labels:
    team: platform
    component-type: portal
tags:
  - backstage
  - developer-portal
  - operations
links:
  - title: Portal URL
    url: https://backstage.lux.kushnir.cloud
spec:
  type: service
  lifecycle: production
  owner: team-platform
  system: lux-auto
  domain: platform
```

### PostgreSQL Database
```yaml
apiVersion: backstage.io/v1alpha1
kind: Resource
metadata:
  name: lux-postgres-primary
  title: PostgreSQL Primary Database
  description: Primary PostgreSQL database for Lux-Auto services
  labels:
    tier: critical
    data-classification: confidential
tags:
  - database
  - postgresql
  - production
spec:
  type: database
  owner: team-platform
  system: lux-auto
```

### Redis Cache
```yaml
apiVersion: backstage.io/v1alpha1
kind: Resource
metadata:
  name: lux-redis-cache
  title: Redis Cache
  description: In-memory cache for sessions, portal data, and real-time events
  labels:
    tier: critical
tags:
  - cache
  - redis
  - production
spec:
  type: cache
  owner: team-platform
  system: lux-auto
```

### API Specifications

#### Deals API
```yaml
apiVersion: backstage.io/v1alpha1
kind: API
metadata:
  name: lux-deals-api
  title: Deals Management API
  description: API for managing wholesale vehicle deals
  labels:
    api-version: v2
spec:
  type: openapi
  lifecycle: production
  owner: team-platform
  system: lux-auto
  definition:
    $text: https://lux.kushnir.cloud/api/v2/openapi.json#/paths/~1deals
```

#### Analytics API
```yaml
apiVersion: backstage.io/v1alpha1
kind: API
metadata:
  name: lux-analytics-api
  title: Analytics API
  description: API for analytics and reporting
  labels:
    api-version: v2
spec:
  type: openapi
  lifecycle: production
  owner: team-platform
  system: lux-auto
  definition:
    $text: https://lux.kushnir.cloud/api/v2/openapi.json#/paths/~1analytics
```

## Scaffolder Templates

### New Portal Feature Template
```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: new-portal-feature
  title: New Portal Feature
  description: Create a new feature in the Appsmith portal
  tags:
    - portal
    - appsmith
    - feature
spec:
  owner: team-platform
  type: service
  
  parameters:
    - title: Feature Information
      required:
        - featureName
        - description
      properties:
        featureName:
          title: Feature Name
          type: string
          description: Name of the new feature (e.g., "Deal Scoring Dashboard")
        description:
          title: Description
          type: string
          description: Feature description and requirements
        pageType:
          title: Page Type
          type: string
          enum:
            - dashboard
            - table-view
            - detail-view
            - modal
            - panel
          description: Type of Appsmith page

  steps:
    - id: fetch-base
      name: Fetch Base
      action: fetch:template
      input:
        url: ./templates/portal-feature
        values:
          name: ${{ parameters.featureName }}
    
    - id: publish
      name: Publish
      action: publish:github
      input:
        allowedHosts:
          - github.com
        description: Add new portal feature
        repoUrl: github.com?owner=kushin77&repo=lux-auto
        branchName: feature/portal-${{ parameters.featureName | lower | replace(' ', '-') }}
    
    - id: register
      name: Register in Catalog
      action: catalog:register
      input:
        repoContentsUrl: ${{ steps.publish.output.repoContentsUrl }}
        catalogInfoPath: '/APPSMITH-FEATURES.md'
  
  output:
    links:
      - title: Repository
        url: ${{ steps.publish.output.remoteUrl }}
      - title: Pull Request
        url: ${{ steps.publish.output.pullRequestUrl }}
```

### Database Migration Template
```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: database-migration
  title: Database Migration
  description: Create a new database schema migration
  tags:
    - database
    - postgres
    - migration
spec:
  owner: team-platform
  type: service
  
  parameters:
    - title: Migration Details
      required:
        - migrationName
        - migrationDescription
      properties:
        migrationName:
          title: Migration Name
          type: string
          description: Name of migration
        migrationDescription:
          title: Description
          type: string
          description: What this migration does

  steps:
    - id: create-migration
      name: Create Migration File
      action: debug:log
      input:
        message: Migration file created for ${{ parameters.migrationName }}
    
    - id: publish
      name: Publish
      action: publish:github
      input:
        allowedHosts:
          - github.com
        description: Add database migration
        repoUrl: github.com?owner=kushin77&repo=lux-auto
        branchName: migration/${{ parameters.migrationName | lower | replace(' ', '-') }}
```

### API Endpoint Template
```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: new-api-endpoint
  title: New API Endpoint
  description: Create a new FastAPI v2 endpoint with RBAC
  tags:
    - api
    - fastapi
    - backend
spec:
  owner: team-platform
  type: service
  
  parameters:
    - title: Endpoint Details
      required:
        - endpointPath
        - httpMethod
        - description
      properties:
        endpointPath:
          title: Endpoint Path
          type: string
          description: API path (e.g., /api/v2/deals/stats)
        httpMethod:
          title: HTTP Method
          type: string
          enum:
            - GET
            - POST
            - PUT
            - DELETE
            - PATCH
        description:
          title: Description
          type: string
        requiredPermission:
          title: Required Permission
          type: string
          enum:
            - read:deals
            - write:deals
            - approve:deals
            - read:analytics
            - read:buyers
            - write:buyers
            - read:audit
            - manage:users
            - manage:settings

  steps:
    - id: create-endpoint
      name: Create Endpoint
      action: debug:log
      input:
        message: Creating endpoint ${{ parameters.httpMethod }} ${{ parameters.endpointPath }}
    
    - id: publish
      name: Publish PR
      action: publish:github
      input:
        allowedHosts:
          - github.com
        description: Add ${{ parameters.httpMethod }} ${{ parameters.endpointPath }} endpoint
        repoUrl: github.com?owner=kushin77&repo=lux-auto
        branchName: api/${{ parameters.endpointPath | lower | replace('/', '-') }}
  
  output:
    links:
      - title: API Documentation
        url: https://lux.kushnir.cloud/api/v2/docs
```

## Backstage Plugins & Extensions

### Health Check Plugin
**Purpose**: Display service health status
- Queries /health endpoint
- Shows response time
- Last check timestamp
- Historical uptime

### Logs Viewer Plugin
**Purpose**: Tail application logs
- Query recent logs
- Filter by level (INFO, WARNING, ERROR)
- Search by message
- Export logs

### Deployment Status Plugin
**Purpose**: Show deployment history
- Latest deployment timestamp
- Deployment status (success/failure)
- Rolled back versions
- Deployment timeline

### Performance Metrics Plugin
**Purpose**: Display service metrics
- Response time distribution
- Error rate trends
- Throughput (requests/second)
- Resource usage (CPU, memory)

## Setting Up Backstage

### 1. Initial Configuration
```bash
# In Backstage configuration
auth:
  providers:
    github:
      development:
        clientId: ${BACKSTAGE_GITHUB_CLIENT_ID}
        clientSecret: ${BACKSTAGE_GITHUB_CLIENT_SECRET}
    google:
      development:
        clientId: ${GOOGLE_CLIENT_ID}
        clientSecret: ${GOOGLE_CLIENT_SECRET}

catalog:
  locations:
    - type: github
      target: https://github.com/kushin77/lux-auto/blob/main/catalog-info.yaml
      rules:
        - allow: [Component, System, API, Resource]
```

### 2. Add Lux-Auto System
Create `catalog-info.yaml` in repo root:
```yaml
apiVersion: backstage.io/v1alpha1
kind: System
metadata:
  name: lux-auto
  title: Lux-Auto
  description: Automated wholesale vehicle arbitrage platform
  labels:
    company: kushin77
spec:
  owner: team-platform
```

### 3. Configure Scaffolder
```bash
scaffolder:
  defaultAuthor:
    name: 'Lux-Auto Scaffolder'
    email: 'platform@lux-auto.local'
```

## Operational Dashboards

### Service Health
- Displays health check status for all services
- Shows last check time
- Alert if down for >5 minutes

### Deployment Pipeline
- Shows current deployments in progress
- Deployment history (last 10)
- Rollback options
- Deployment logs

### Infrastructure Overview
- Lists all services, databases, APIs
- Shows relationships between components
- Displays resource utilization
- Links to detailed pages

## Runbooks

### Service Restart
**When**: Service health check failing for >10 minutes
**Steps**:
1. Check logs for errors
2. Verify database connectivity
3. Restart service container
4. Monitor health checks (5 min)
5. Escalate if still failing

### Database Recovery
**When**: Database unreachable/slow
**Steps**:
1. Check database service status
2. Verify disk space
3. Review slow query logs
4. Consider restart (maintenance window)
5. Review backups if needed

### Portal Deployment
**When**: Deploying new Appsmith changes
**Steps**:
1. Create new Appsmith version
2. Test in staging environment
3. Schedule deployment window
4. Deploy to production
5. Monitor for errors
6. Have rollback ready

## Monitoring & Alerting

### Prometheus Integration
```yaml
# Query services health
up{job="lux-auto-backend"} == 1

# API response time
histogram_quantile(0.95, http_request_duration_seconds)

# Error rate
rate(http_requests_total{status=~"5.."}[5m])
```

### Grafana Dashboards
- Service availability (99.9% SLA)
- API latency (p50, p95, p99)
- Error rates by endpoint
- Database query performance
- WebSocket connection count

## Documentation

Each service should include:
- README with setup instructions
- API documentation
- Architecture diagrams
- Runbooks for common operations
- Troubleshooting guide

## Next Steps

1. Import service entities into Backstage catalog
2. Configure GitHub integration
3. Create scaffolder templates
4. Setup Prometheus/Grafana
5. Create operational dashboards
6. Document runbooks
7. Train team on Backstage usage
8. Begin using for service management

