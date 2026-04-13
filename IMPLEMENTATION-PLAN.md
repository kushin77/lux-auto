# Appsmith & Backstage Implementation Plan

## Phase 1: Infrastructure & Setup (Weeks 1-4)

### Week 1: Docker Composition & Service Setup

#### 1.1 Appsmith Service Integration
**File**: `docker-compose.yml`
```yaml
appsmith:
  image: appsmith/appsmith:latest
  container_name: lux-appsmith
  ports:
    - "8080:80"
  environment:
    APPSMITH_DB_NAME: appsmith_db
    APPSMITH_DB_USER: appsmith_admin
    APPSMITH_DB_PASSWORD: ${APPSMITH_DB_PASSWORD}
    APPSMITH_PG_DBHOST: postgres
    APPSMITH_PG_PORT: 5432
    APPSMITH_OAUTH_ENABLED: "true"
    APPSMITH_OAUTH_GOOGLE_CLIENT_ID: ${APPSMITH_OAUTH_CLIENT_ID}
    APPSMITH_OAUTH_GOOGLE_CLIENT_SECRET: ${APPSMITH_OAUTH_CLIENT_SECRET}
    APPSMITH_MAIL_ENABLED: "false"
  depends_on:
    - postgres
    - redis
  networks:
    - lux-network
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:80/api/v1/health"]
    interval: 10s
    timeout: 5s
    retries: 5
  labels:
    - "traefik.http.routers.appsmith.rule=Host(`appsmith.lux.kushnir.cloud`)"
```

#### 1.2 Backstage Service Integration
**File**: `docker-compose.yml`
```yaml
backstage:
  image: backstage/backstage:latest
  container_name: lux-backstage
  ports:
    - "3000:3000"
  environment:
    BACKSTAGE_PG_DBNAME: backstage_db
    BACKSTAGE_PG_USER: backstage_admin
    BACKSTAGE_PG_PASSWORD: ${BACKSTAGE_DB_PASSWORD}
    BACKSTAGE_GITHUB_TOKEN: ${BACKSTAGE_GITHUB_TOKEN}
    BACKSTAGE_AUTH_GITHUB_CLIENT_ID: ${BACKSTAGE_GITHUB_CLIENT_ID}
    BACKSTAGE_AUTH_GITHUB_CLIENT_SECRET: ${BACKSTAGE_GITHUB_CLIENT_SECRET}
  depends_on:
    - postgres
    - redis
  networks:
    - lux-network
  healthcheck:
    test: ["CMD", "curl", "-f", "https://lux.kushnir.cloud/health"]
    interval: 10s
    timeout: 5s
    retries: 5
  labels:
    - "traefik.http.routers.backstage.rule=Host(`backstage.lux.kushnir.cloud`)"
```

### Week 2: Database Schema Extensions

#### 2.1 Portal Tables
**File**: `scripts/init-db.sql` (additions)
```sql
-- Portal audit logs table
CREATE TABLE IF NOT EXISTS portal_audit_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_portal_audit_logs_user_id 
  ON portal_audit_logs(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_portal_audit_logs_timestamp 
  ON portal_audit_logs(timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_portal_audit_logs_entity 
  ON portal_audit_logs(entity_type, entity_id);

-- Portal user preferences
CREATE TABLE IF NOT EXISTS portal_user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
  dashboard_layout JSONB DEFAULT '{}',
  saved_filters JSONB DEFAULT '{}',
  notifications_enabled BOOLEAN DEFAULT TRUE,
  auto_refresh_interval INTEGER DEFAULT 30,
  items_per_page INTEGER DEFAULT 50,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API keys for portal and external integrations
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  key_prefix VARCHAR(8) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  scopes TEXT[] NOT NULL DEFAULT '{"read:deals", "read:analytics"}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_api_keys_user_id ON api_keys(user_id);

-- User roles and permissions
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('VIEWER', 'ANALYST', 'ADMIN', 'SUPER_ADMIN')),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by UUID REFERENCES users(id),
  expires_at TIMESTAMP,
  UNIQUE(user_id, role)
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_user_roles_user_id ON user_roles(user_id);

-- Portal real-time events
CREATE TABLE IF NOT EXISTS portal_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '7 days'
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_portal_events_created_at ON portal_events(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_portal_events_type ON portal_events(event_type);
```

### Week 3: API Layer Enhancements

#### 3.1 New FastAPI Endpoints
**File**: `backend/main.py` (additions)

```python
# Deal Management API
@router.get("/api/v2/deals")
async def list_deals(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    sort_by: str = "created_at",
    order: str = "desc"
):
    """List all deals with filtering and pagination"""

@router.get("/api/v2/deals/{deal_id}")
async def get_deal(deal_id: str):
    """Get detailed deal information"""

@router.post("/api/v2/deals/{deal_id}/approve")
async def approve_deal(deal_id: str):
    """Approve a deal for autonomous bidding"""

@router.post("/api/v2/deals/{deal_id}/reject")
async def reject_deal(deal_id: str, reason: str):
    """Reject a deal with reason"""

# Buyer Management API
@router.get("/api/v2/buyers")
async def list_buyers(skip: int = 0, limit: int = 50):
    """List buyer network"""

@router.post("/api/v2/buyers/import")
async def import_buyers(file: UploadFile):
    """Import buyers from CSV"""

# Analytics API
@router.get("/api/v2/analytics/dashboard")
async def get_analytics_dashboard(date_range: str = "30d"):
    """Get dashboard summary metrics"""

@router.get("/api/v2/analytics/deals")
async def get_deal_analytics(
    metric: str = "win_rate",
    group_by: Optional[str] = None
):
    """Get deal performance analytics"""

# Audit Log API
@router.get("/api/v2/audit-logs")
async def get_audit_logs(skip: int = 0, limit: int = 100):
    """Get portal audit logs"""
```

### Week 4: Authentication & RBAC Implementation

#### 4.1 RBAC Service
**File**: `backend/auth/rbac_service.py`

```python
from enum import Enum
from typing import Set

class PortalRole(Enum):
    VIEWER = "VIEWER"
    ANALYST = "ANALYST"
    ADMIN = "ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"

class PortalPermission(Enum):
    READ_DEALS = "read:deals"
    WRITE_DEALS = "write:deals"
    APPROVE_DEALS = "approve:deals"
    READ_ANALYTICS = "read:analytics"
    READ_BUYERS = "read:buyers"
    WRITE_BUYERS = "write:buyers"
    READ_AUDIT = "read:audit"
    MANAGE_USERS = "manage:users"
    MANAGE_SETTINGS = "manage:settings"

ROLE_PERMISSIONS: Dict[PortalRole, Set[PortalPermission]] = {
    PortalRole.VIEWER: {
        PortalPermission.READ_DEALS,
        PortalPermission.READ_ANALYTICS,
        PortalPermission.READ_BUYERS,
    },
    PortalRole.ANALYST: {
        PortalPermission.READ_DEALS,
        PortalPermission.WRITE_DEALS,
        PortalPermission.READ_ANALYTICS,
        PortalPermission.READ_BUYERS,
        PortalPermission.WRITE_BUYERS,
    },
    PortalRole.ADMIN: {
        PortalPermission.READ_DEALS,
        PortalPermission.WRITE_DEALS,
        PortalPermission.APPROVE_DEALS,
        PortalPermission.READ_ANALYTICS,
        PortalPermission.READ_BUYERS,
        PortalPermission.WRITE_BUYERS,
        PortalPermission.READ_AUDIT,
        PortalPermission.MANAGE_USERS,
    },
    PortalRole.SUPER_ADMIN: {
        PortalPermission.READ_DEALS,
        PortalPermission.WRITE_DEALS,
        PortalPermission.APPROVE_DEALS,
        PortalPermission.READ_ANALYTICS,
        PortalPermission.READ_BUYERS,
        PortalPermission.WRITE_BUYERS,
        PortalPermission.READ_AUDIT,
        PortalPermission.MANAGE_USERS,
        PortalPermission.MANAGE_SETTINGS,
    },
}

async def get_user_roles(user_id: UUID) -> List[PortalRole]:
    """Get all roles assigned to user"""

async def has_permission(user_id: UUID, permission: PortalPermission) -> bool:
    """Check if user has specific permission"""

async def assign_role(user_id: UUID, role: PortalRole, assigned_by: UUID) -> bool:
    """Assign role to user with audit logging"""
```

---

## Phase 2: Core Portal Features (Weeks 5-8)

### Week 5-6: Deal Management Dashboard (Appsmith)

#### Appsmith App Structure
```
Deal Management Portal
├── Dashboard Page
│   ├── Deal Pipeline Board (Kanban)
│   ├── Quick Stats Cards
│   └── Recent Activity Feed
├── Deal List Page
│   ├── Table with sorting/filtering
│   ├── Advanced search sidebar
│   └── Bulk operations toolbar
├── Deal Detail Page
│   ├── Deal overview section
│   ├── Bid history timeline
│   ├── Document viewer
│   └── Action buttons
└── Settings Pages
    ├── User preferences
    └── API keys
```

#### Appsmith Queries
```javascript
// List deals query
getDeals: {
  method: "GET",
  url: "{{appConfig.apiBase}}/api/v2/deals",
  params: {
    skip: {{dealTable.pageNo * dealTable.pageSize}},
    limit: {{dealTable.pageSize}},
    status: {{statusFilter.value}},
    sort_by: {{dealTable.sortedColumn}},
    order: {{dealTable.sortDirection}}
  }
}

// Get deal details
getDealDetail: {
  method: "GET",
  url: "{{appConfig.apiBase}}/api/v2/deals/{{dealModal.dealId}}"
}

// Approve deal
approveDeal: {
  method: "POST",
  url: "{{appConfig.apiBase}}/api/v2/deals/{{selectedDeal.id}}/approve"
}
```

### Week 7: Buyer Network & Analytics (Appsmith)

#### Buyer Management UI Components
- Buyer list table with customer profiles
- CSV import modal with validation
- Buyer profile editor
- Preference builder (drag-drop make/model selection)
- Match scoring breakdown visualization

#### Analytics Dashboard Components
- Win rate chart (line chart, time series)
- Margin distribution (histogram)
- ROI by make/model (bar chart)
- Agent accuracy metrics
- Buyer performance leaderboard
- Custom report builder

### Week 8: Backstage Integration

#### 8.1 Backstage Entity Configuration
**File**: `backstage/entities/lux-auto-services.yaml`

```yaml
---
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: lux-auto-backend
  description: FastAPI backend for deal management and autonomous bidding
  tags:
    - python
    - fastapi
    - api
spec:
  type: service
  lifecycle: production
  owner: team-autotrade
  dependsOn:
    - resource:lux-postgres-db
    - resource:lux-redis-cache
  providesApis:
    - lux-deals-api
    - lux-analytics-api
    - lux-buyers-api

---
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: lux-appsmith-portal
  description: Low-code portal for deal management and analytics
  tags:
    - appsmith
    - low-code
    - portal
spec:
  type: service
  lifecycle: production
  owner: team-autotrade
  dependsOn:
    - component:lux-auto-backend
    - resource:lux-postgres-appsmith

---
apiVersion: backstage.io/v1alpha1
kind: Resource
metadata:
  name: lux-postgres-db
  description: PostgreSQL database for Lux-Auto
spec:
  type: database
  owner: team-autotrade
  system: lux-auto

---
apiVersion: backstage.io/v1alpha1
kind: API
metadata:
  name: lux-deals-api
  description: Deals management API
spec:
  type: openapi
  lifecycle: production
  owner: team-autotrade
  definition:
    $text: https://lux.kushnir.cloud/api/v2/openapi.json
```

#### 8.2 Backstage Plugins
**File**: `backstage/plugins/lux-ops-plugin/`
- Service health status widget
- Log viewer component
- Performance metrics dashboard
- Deployment history viewer

---

## Phase 3: Advanced Features & Hardening (Weeks 9-12)

### Week 9: Performance & Caching

#### 9.1 Redis Caching Layer
**File**: `backend/cache/portal_cache.py`

```python
class PortalCache:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.ttl = {
            'deals_list': 300,  # 5 minutes
            'deal_detail': 600,  # 10 minutes
            'analytics': 1800,  # 30 minutes
            'buyers_list': 600,
        }
    
    async def get_deals_cache(self, user_id: UUID, filters: dict) -> Optional[dict]:
        key = f"deals:{user_id}:{hash(str(filters))}"
        return await self.redis.get(key)
    
    async def set_deals_cache(self, user_id: UUID, filters: dict, data: dict):
        key = f"deals:{user_id}:{hash(str(filters))}"
        await self.redis.setex(key, self.ttl['deals_list'], json.dumps(data))
    
    async def invalidate_deal_cache(self, deal_id: str):
        pattern = f"deal:{deal_id}:*"
        keys = await self.redis.keys(pattern)
        if keys:
            await self.redis.delete(*keys)
```

### Week 10: Security Hardening

#### 10.1 Security Middleware
**File**: `backend/auth/security_middleware.py`

```python
# CORS Configuration
CORS_ORIGINS = [
    "https://appsmith.lux.kushnir.cloud",
    "https://backstage.lux.kushnir.cloud",
    "https://lux.kushnir.cloud",
]

# Rate limiting per role
RATE_LIMITS = {
    "VIEWER": "100/hour",
    "ANALYST": "500/hour",
    "ADMIN": "1000/hour",
    "SUPER_ADMIN": "unlimited"
}

# API request signing
def generate_request_signature(
    user_id: UUID,
    timestamp: int,
    method: str,
    path: str,
    body: Optional[str] = None
) -> str:
    """Generate HMAC-SHA256 signature for request validation"""
```

### Week 11: Testing & Monitoring

#### 11.1 E2E Tests
**File**: `tests/e2e/test_portal_flows.py`

```python
@pytest.mark.asyncio
async def test_complete_deal_approval_flow():
    """Test: User logs in → Views deal → Approves → Receives confirmation"""
    
@pytest.mark.asyncio
async def test_analytics_dashboard_load():
    """Test: Dashboard loads in <2s, displays correct metrics"""

@pytest.mark.asyncio
async def test_buyer_import_and_match():
    """Test: Upload buyers CSV → System matches to deals"""

@pytest.mark.asyncio
async def test_real_time_deal_updates():
    """Test: WebSocket updates deal status in real-time"""

@pytest.mark.asyncio
async def test_rbac_enforcement():
    """Test: VIEWER cannot approve deals, only ADMIN can"""
```

#### 11.2 Monitoring & Alerting
**File**: `backend/monitoring/metrics.py`

```python
from prometheus_client import Counter, Histogram, Gauge

# Metrics
portal_requests = Counter(
    'portal_requests_total',
    'Total portal API requests',
    ['method', 'endpoint', 'status']
)

portal_request_duration = Histogram(
    'portal_request_duration_seconds',
    'Portal request latency',
    ['endpoint']
)

active_portal_users = Gauge(
    'portal_active_users',
    'Currently active portal users'
)

deal_approval_rate = Counter(
    'deal_approvals_total',
    'Total deal approvals',
    ['role', 'outcome']
)
```

### Week 12: Documentation & Deployment

#### 12.1 Deployment Script Enhancement
**File**: `scripts/deploy.sh` (additions)

```bash
# Deploy with portal services
deploy_with_portal() {
    export APPSMITH_DB_PASSWORD=$(gcloud secrets versions access latest --secret="appsmith-db-password")
    export BACKSTAGE_DB_PASSWORD=$(gcloud secrets versions access latest --secret="backstage-db-password")
    export BACKSTAGE_GITHUB_TOKEN=$(gcloud secrets versions access latest --secret="backstage-github-token")
    
    docker-compose up -d appsmith backstage
    wait_for_service "appsmith" "8080" "120"
    wait_for_service "backstage" "3000" "120"
    
    initialize_portal_db
    seed_backstage_entities
    
    echo "✓ Portal services initialized successfully"
}
```

#### 12.2 Documentation
**File**: `docs/PORTAL_USER_GUIDE.md`
- Portal overview and key features
- Deal management workflows
- Analytics reports guide
- Buyer network management
- RBAC and user administration
- Troubleshooting guide

---

## Implementation Checklist

### Infrastructure (Weeks 1-4)
- [ ] Add Appsmith to docker-compose.yml with health checks
- [ ] Add Backstage to docker-compose.yml with health checks
- [ ] Create Appsmith and Backstage PostgreSQL databases
- [ ] Setup OAuth2 authentication for both services
- [ ] Configure Caddy routing to portal services
- [ ] Create portal audit log tables
- [ ] Create portal user preferences tables
- [ ] Create API keys table
- [ ] Create user roles table
- [ ] Add database indexes for performance

### API Layer (Weeks 3-4)
- [ ] Implement `/api/v2/deals` endpoints (CRUD + approve/reject)
- [ ] Implement `/api/v2/buyers` endpoints (list, import, update)
- [ ] Implement `/api/v2/analytics` endpoints (dashboard, detailed metrics)
- [ ] Implement `/api/v2/audit-logs` endpoint
- [ ] Add request/response logging
- [ ] Implement RBAC middleware
- [ ] Generate OpenAPI documentation
- [ ] Add rate limiting

### Portal Features (Weeks 5-8)
- [ ] Build Appsmith deal management dashboard
- [ ] Build Appsmith buyer network interface
- [ ] Build Appsmith analytics dashboard
- [ ] Build Appsmith admin panel
- [ ] Setup Backstage service catalog
- [ ] Setup Backstage operational tools
- [ ] Configure Backstage scaffolder templates
- [ ] Setup WebSocket for real-time updates

### Advanced Features (Weeks 9-12)
- [ ] Implement Redis caching layer
- [ ] Add performance monitoring
- [ ] Implement security hardening (CORS, rate limiting, etc.)
- [ ] Write comprehensive E2E tests
- [ ] Setup Prometheus and Grafana
- [ ] Create monitoring dashboards
- [ ] Write user documentation
- [ ] Create training materials
- [ ] Deploy to production
- [ ] Run penetration testing

---

## Success Metrics

| Metric | Target | Verification |
|--------|--------|--------------|
| Portal Availability | 99.9% uptime | Monitoring dashboard |
| Dashboard Load Time | <2s p95 | Performance testing |
| API Response Time | <500ms p99 | Prometheus metrics |
| Test Coverage | 95%+ | Coverage report |
| Security Score | A+ | OWASP testing |
| User Adoption | >80% usage in 2 weeks | Analytics data |

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Appsmith performance degradation | Medium | High | Implement aggressive caching, load testing |
| OAuth2 token sync issues | Low | High | Token refresh logic, fallback to basic auth |
| Database schema migration conflicts | Low | Medium | Run migrations in test env first |
| WebSocket connection drops | Medium | Medium | Implement reconnection logic with exponential backoff |
| RBAC bugs exposing data | Low | Critical | Comprehensive security testing, code review |

