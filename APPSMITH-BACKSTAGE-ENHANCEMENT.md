# Appsmith + Backstage Portal Enhancement

## Overview
Enhance Lux-Auto with low-code Appsmith portal for UI and Backstage developer portal for operational visibility and service management.

## Epic Goals
1. **Appsmith Portal**: Deal management dashboard, buyer network UI, analytics, admin panel
2. **Backstage Integration**: Service catalog, infrastructure dashboard, operational tools
3. **Full Portal Features**: User authentication, RBAC, real-time data sync
4. **Enterprise CI/CD**: Automated deployments, monitoring integration

## Timeline
- Phase 1 (Weeks 1-4): Portal infrastructure & Appsmith setup
- Phase 2 (Weeks 5-8): Core portal features & Backstage integration
- Phase 3 (Weeks 9-12): Advanced features & production hardening

---

## GitHub Issues to Create

### Epic Parent Issue
- **#1001**: [Epic] Appsmith + Backstage Portal Enhancement
  - Integrate Appsmith for low-code portal UI
  - Deploy Backstage for service catalog and ops visibility
  - Achieve full-featured deal management platform

### Phase 1: Infrastructure & Setup (Weeks 1-4)

#### Issue #1: Appsmith Infrastructure Setup
- [ ] Add Appsmith to docker-compose.yml
- [ ] Configure Appsmith PostgreSQL database
- [ ] Setup OAuth2 authentication with oauth2-proxy
- [ ] Configure Appsmith environment variables
- [ ] Health checks and startup verification
- [ ] Caddy routing to Appsmith (separate subdomain: appsmith.lux.kushnir.cloud)

#### Issue #2: Backstage Infrastructure Setup
- [ ] Add Backstage to docker-compose.yml
- [ ] Configure Backstage PostgreSQL database
- [ ] Setup Backstage GitHub integration
- [ ] Configure OAuth2 authentication
- [ ] Backstage entity config for Lux-Auto services
- [ ] Caddy routing to Backstage (separate subdomain: backstage.lux.kushnir.cloud)

#### Issue #3: Portal API Enhancements
- [ ] Create `/api/v2/deals` endpoints (list, get, create, update, delete)
- [ ] Create `/api/v2/buyers` endpoints with pagination and filtering
- [ ] Create `/api/v2/analytics` endpoints (win rate, margins, ROI by make/model)
- [ ] Create `/api/v2/bids` endpoints (history, audit trail)
- [ ] Add request/response logging for Appsmith API calls
- [ ] Implement rate limiting for API endpoints
- [ ] Add API documentation (OpenAPI/Swagger)

#### Issue #4: Authentication & Authorization Layer
- [ ] Extend user_service.py with role-based access control (RBAC)
- [ ] Define roles: VIEWER, ANALYST, ADMIN, SUPER_ADMIN
- [ ] Create permission matrix for portal features
- [ ] Implement permission middleware in FastAPI
- [ ] Add audit logging for all portal actions
- [ ] Export RBAC config to Appsmith via API

#### Issue #5: Real-time Data Sync Layer
- [ ] Setup WebSocket support in FastAPI for deal updates
- [ ] Implement Redis pub/sub for real-time deal status changes
- [ ] Create WebSocket endpoint for dashboard live updates
- [ ] Configure Appsmith WebSocket listener
- [ ] Test real-time bid updates and notifications
- [ ] Document WebSocket message format

### Phase 2: Core Portal Features (Weeks 5-8)

#### Issue #6: Deal Management Dashboard (Appsmith)
- [ ] Build deal pipeline board (Kanban: Scanning → Scored → Bidding → Won → Routed → Closed)
- [ ] Create deal card component with VIN, photo, score, margin
- [ ] Implement one-click approve/reject workflow
- [ ] Build deal detail modal with full deal context
- [ ] Create deal search/filter sidebar
- [ ] Add deal assignment to agent
- [ ] Implement batch operations (approve multiple, bulk tags)

#### Issue #7: Buyer Network Management (Appsmith)
- [ ] Build buyer list table with sorting/filtering
- [ ] Create buyer upload form (CSV import)
- [ ] Implement buyer profile edit modal
- [ ] Create buyer preference builder UI
- [ ] Build buyer match scoring breakdown view
- [ ] Add buyer outreach history tracking UI
- [ ] Create bulk buyer operations panel

#### Issue #8: Analytics & Reporting (Appsmith)
- [ ] Build win rate analytics chart (by time period, make/model)
- [ ] Create margin distribution analysis (histogram, box plot)
- [ ] Implement ROI by make/model dashboard
- [ ] Build agent accuracy metrics dashboard
- [ ] Create deal velocity chart (deals per day)
- [ ] Implement buyer performance metrics
- [ ] Add custom report builder
- [ ] Export analytics to PDF/CSV

#### Issue #9: Admin & Settings Panel (Appsmith)
- [ ] Build user management interface
- [ ] Create role assignment UI
- [ ] Implement audit log viewer
- [ ] Build system configuration editor
- [ ] Create API key management panel
- [ ] Implement database backup trigger UI
- [ ] Add system health check dashboard

#### Issue #10: Backstage Service Catalog
- [ ] Create Lux-Auto service entity definition
- [ ] Add API service entity for FastAPI backend
- [ ] Create PostgreSQL database entity
- [ ] Add Redis cache entity
- [ ] Create Appsmith portal service entity
- [ ] Build service dependency graph
- [ ] Implement service health status display
- [ ] Add runbook links and documentation

#### Issue #11: Backstage Operational Tools
- [ ] Build deployment history viewer
- [ ] Create service logs viewer (tail FastAPI, Appsmith, Backstage)
- [ ] Implement database query playground
- [ ] Build API endpoint tester
- [ ] Create Redis cache inspector
- [ ] Add environment variable viewer (non-secrets)
- [ ] Implement disk usage monitor
- [ ] Create performance metrics dashboard

#### Issue #12: Backstage Templates for Portal Security
- [ ] Create "New Portal Feature" scaffolder template
- [ ] Create "Database Migration" template
- [ ] Create "API Endpoint" template
- [ ] Create "Backstage Plugin" template
- [ ] Add security checklist to each template

### Phase 3: Advanced Features & Hardening (Weeks 9-12)

#### Issue #13: Portal Advanced Features
- [ ] Implement dark mode / light mode toggle
- [ ] Build custom dashboard builder (drag-drop widgets)
- [ ] Create saved search/filter presets
- [ ] Implement deal notifications and webhooks
- [ ] Build mobile-responsive dashboard
- [ ] Add keyboard shortcuts for power users
- [ ] Implement undo/redo functionality
- [ ] Create user preference persistence

#### Issue #14: Performance & Caching
- [ ] Implement Redis caching for dashboard queries
- [ ] Add database query optimization (indexes, pagination)
- [ ] Optimize Appsmith database queries
- [ ] Implement pagination for all list endpoints
- [ ] Add request response caching headers
- [ ] Build performance monitoring dashboard
- [ ] Document cache invalidation strategy

#### Issue #15: Security Hardening
- [ ] Implement CORS restrictions for Appsmith
- [ ] Add request signing for internal APIs
- [ ] Implement API endpoint rate limiting per role
- [ ] Add SQL injection prevention validation
- [ ] Implement XSS protection headers
- [ ] Add CSRF token validation
- [ ] Create security scanning in CI/CD

#### Issue #16: Portal Testing & QA
- [ ] Write E2E tests for deal management flow
- [ ] Add Appsmith component unit tests
- [ ] Create performance benchmarks for dashboard
- [ ] Add load testing (500+ concurrent users)
- [ ] Implement security penetration testing
- [ ] Create UAT testing guide
- [ ] Document known limitations

#### Issue #17: Monitoring & Observability
- [ ] Add Prometheus metrics for portal endpoints
- [ ] Implement Grafana dashboard for portal metrics
- [ ] Create alert rules for portal performance
- [ ] Add liveness probes for Appsmith/Backstage
- [ ] Implement request tracing (OpenTelemetry)
- [ ] Create SLA monitoring dashboard
- [ ] Build incident response runbook

#### Issue #18: Documentation & Training
- [ ] Write Appsmith portal user guide
- [ ] Create Backstage operator guide
- [ ] Document API endpoints and schemas
- [ ] Create portal architecture diagram
- [ ] Write troubleshooting guide
- [ ] Record demo videos
- [ ] Create admin onboarding guide

---

## Technology Stack

### Appsmith
- Version: Latest (v1.x LTS)
- Database: PostgreSQL (appsmith_db)
- Authentication: OAuth2 via oauth2-proxy
- Deployment: Docker container in docker-compose

### Backstage
- Version: Latest (1.x)
- Database: PostgreSQL (backstage_db)
- GitHub Integration: OAuth App credentials
- Deployment: Docker container in docker-compose

### API Layer
- FastAPI with new v2 endpoints
- WebSocket for real-time updates
- Redis pub/sub for event streaming
- Request logging and tracing

### Frontend
- Appsmith low-code components
- Custom JS plugins for advanced features
- Responsive mobile-first design
- Dark mode support

---

## Database Schema Extensions

### New Tables Required
```sql
-- Portal audit log
CREATE TABLE portal_audit_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  timestamp TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);
CREATE INDEX ix_portal_audit_logs_user_id ON portal_audit_logs(user_id);
CREATE INDEX ix_portal_audit_logs_timestamp ON portal_audit_logs(timestamp);

-- Portal user preferences
CREATE TABLE portal_user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  theme VARCHAR(20) DEFAULT 'light',
  dashboard_layout JSONB,
  saved_filters JSONB,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- API keys for external integrations
CREATE TABLE api_keys (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  key_prefix VARCHAR(8) NOT NULL,
  name VARCHAR(255) NOT NULL,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  scopes TEXT[] NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX ix_api_keys_key_hash ON api_keys(key_hash);
```

---

## Configuration Files

### docker-compose.yml additions
- appsmith service with PostgreSQL
- backstage service with PostgreSQL
- Network configuration for inter-service communication
- Volume mounts for persistence

### Environment Variables
```bash
# Appsmith
APPSMITH_PG_DBNAME=appsmith_db
APPSMITH_PG_USER=appsmith_admin
APPSMITH_PG_PASSWORD={from GSM}
APPSMITH_OAUTH_CLIENT_ID={from GSM}
APPSMITH_OAUTH_CLIENT_SECRET={from GSM}

# Backstage
BACKSTAGE_PG_DBNAME=backstage_db
BACKSTAGE_PG_USER=backstage_admin
BACKSTAGE_PG_PASSWORD={from GSM}
BACKSTAGE_GITHUB_TOKEN={from GSM}
BACKSTAGE_GITHUB_CLIENT_ID={from GSM}
BACKSTAGE_GITHUB_CLIENT_SECRET={from GSM}
```

---

## Success Criteria

- [ ] Appsmith portal accessible at appsmith.lux.kushnir.cloud
- [ ] Backstage accessible at backstage.lux.kushnir.cloud
- [ ] All portal endpoints tested and documented
- [ ] 95%+ test coverage for new API endpoints
- [ ] Performance: Dashboard load <2s, API response <500ms p99
- [ ] Security: Passed penetration testing, zero critical vulns
- [ ] RBAC fully implemented with audit logging
- [ ] Real-time updates working for deal status changes
- [ ] Documentation complete for all portal features
- [ ] Production deployment tested on staging

---

## Dependencies
- Appsmith latest version
- Backstage latest version
- PostgreSQL 13+
- Redis 6.0+
- Node.js 16+ (for Backstage)

## Risks & Mitigations
- **Risk**: Appsmith performance at scale → Mitigate with caching layer
- **Risk**: OAuth2 token sync → Mitigate with token refresh logic
- **Risk**: Database schema conflicts → Mitigate with migration testing
- **Risk**: Real-time WebSocket stability → Mitigate with fallback polling
