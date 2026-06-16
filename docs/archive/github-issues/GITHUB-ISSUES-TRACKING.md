# GitHub Issues Tracking - Appsmith & Backstage Enhancement

This document tracks all GitHub issues to be created for the Appsmith and Backstage portal enhancement project.

---

## EPIC: Appsmith + Backstage Portal Enhancement

**Repository**: kushin77/lux-auto (to be confirmed)

### Epic Description
Transform Lux-Auto into a comprehensive low-code portal platform by integrating Appsmith for UI and Backstage for operational visibility. Achieve full-featured deal management, analytics, and developer portal capabilities with enterprise-grade security and observability.

### Epic Goals
- [ ] Integrate Appsmith low-code platform for deal management portal
- [ ] Deploy Backstage for service catalog and operational visibility
- [ ] Implement comprehensive RBAC and audit logging
- [ ] Build real-time WebSocket updates for deal status
- [ ] Establish 99.9% uptime SLA with monitoring/alerting

### Expected Duration: 12 weeks (3 phases × 4 weeks)

---

## PHASE 1: Infrastructure & Setup (Weeks 1-4)

### Issue #1: [Infrastructure] Add Appsmith to Docker Compose

**Description**: Integrate Appsmith service into docker-compose.yml with proper configuration, health checks, and OAuth2 authentication.

**Acceptance Criteria**:
- [ ] Appsmith service defined in docker-compose.yml
- [ ] Separate PostgreSQL database for Appsmith (appsmith_db)
- [ ] OAuth2 authentication configured
- [ ] Health check endpoint responding
- [ ] Accessible at appsmith.lux.kushnir.cloud
- [ ] All environment variables documented

**Estimated effort**: 5 points
**Dependencies**: None
**Labels**: infrastructure, appsmith, docker

---

### Issue #2: [Infrastructure] Add Backstage to Docker Compose

**Description**: Integrate Backstage service into docker-compose.yml with PostgreSQL database, GitHub integration, and OAuth2 authentication.

**Acceptance Criteria**:
- [ ] Backstage service defined in docker-compose.yml
- [ ] Separate PostgreSQL database for Backstage (backstage_db)
- [ ] GitHub OAuth app credentials integrated
- [ ] Health check endpoint responding
- [ ] Accessible at backstage.lux.kushnir.cloud
- [ ] All environment variables documented

**Estimated effort**: 5 points
**Dependencies**: Issue #1
**Labels**: infrastructure, backstage, docker

---

### Issue #3: [Database] Portal Schema: Audit Logs & User Preferences

**Description**: Create database tables for portal audit logging, user preferences, API keys, and session management.

**Acceptance Criteria**:
- [ ] `portal_audit_logs` table created with proper indexes
- [ ] `portal_user_preferences` table with user-specific settings
- [ ] `api_keys` table for external integrations
- [ ] `portal_sessions` table for session tracking
- [ ] Cleanup functions for expired data
- [ ] All tables have audit timestamps
- [ ] Foreign keys properly constrained
- [ ] Test data insertion successful

**Estimated effort**: 5 points
**Dependencies**: None
**Labels**: database, schema, portal

---

### Issue #4: [Database] User Roles & Permissions Schema

**Description**: Implement RBAC schema with roles (VIEWER, ANALYST, ADMIN, SUPER_ADMIN) and permission matrix.

**Acceptance Criteria**:
- [ ] `user_roles` table created
- [ ] Role check constraints (VIEWER, ANALYST, ADMIN, SUPER_ADMIN)
- [ ] `user_permissions` view showing role-based permissions
- [ ] Permission matrix defined:
  - VIEWER: read:deals, read:analytics, read:buyers
  - ANALYST: above + write:deals, write:buyers
  - ADMIN: above + approve:deals, manage:users, read:audit
  - SUPER_ADMIN: all permissions
- [ ] Test role assignments working
- [ ] Expiration logic working

**Estimated effort**: 5 points
**Dependencies**: Issue #3
**Labels**: database, rbac, security

---

### Issue #5: [API] Deals Management Endpoints (v2)

**Description**: Implement comprehensive `/api/v2/deals` endpoints for CRUD operations, filtering, and pagination.

**Acceptance Criteria**:
- [ ] `GET /api/v2/deals` - List deals with pagination, sorting, filtering
- [ ] `GET /api/v2/deals/{deal_id}` - Get single deal details
- [ ] `POST /api/v2/deals` - Create new deal (admin only)
- [ ] `PUT /api/v2/deals/{deal_id}` - Update deal
- [ ] `DELETE /api/v2/deals/{deal_id}` - Delete deal (admin only)
- [ ] `POST /api/v2/deals/{deal_id}/approve` - Approve for bidding
- [ ] `POST /api/v2/deals/{deal_id}/reject` - Reject with reason
- [ ] OpenAPI documentation generated
- [ ] Request validation working
- [ ] RBAC enforced on all endpoints
- [ ] Response times < 500ms p99

**Estimated effort**: 8 points
**Dependencies**: Issue #4
**Labels**: api, deals, backend

---

### Issue #6: [API] Buyers & Analytics Endpoints (v2)

**Description**: Implement `/api/v2/buyers` and `/api/v2/analytics` endpoints for portal UI data.

**Acceptance Criteria**:
- [ ] `GET /api/v2/buyers` - List buyer network with pagination
- [ ] `POST /api/v2/buyers/import` - CSV import with validation
- [ ] `GET /api/v2/buyers/{buyer_id}` - Get buyer preferences
- [ ] `PUT /api/v2/buyers/{buyer_id}` - Update buyer profile
- [ ] `DELETE /api/v2/buyers/{buyer_id}` - Delete buyer
- [ ] `GET /api/v2/analytics/dashboard` - Dashboard summary metrics
- [ ] `GET /api/v2/analytics/deals` - Deal performance analytics
- [ ] `GET /api/v2/analytics/buyers` - Buyer performance metrics
- [ ] CSV export support
- [ ] RBAC enforced (ANALYST+ required)
- [ ] Unit tests for all endpoints

**Estimated effort**: 8 points
**Dependencies**: Issue #5
**Labels**: api, analytics, backend

---

### Issue #7: [API] RBAC Middleware & Audit Logging

**Description**: Implement authentication middleware for RBAC enforcement and comprehensive audit logging for portal actions.

**Acceptance Criteria**:
- [ ] Permission middleware in FastAPI app
- [ ] RBAC checks on all protected endpoints
- [ ] Audit logging for create/update/delete operations
- [ ] IP address and user-agent tracking
- [ ] Audit log queryable via `/api/v2/audit-logs`
- [ ] 401 Unauthorized for auth failures
- [ ] 403 Forbidden for permission failures
- [ ] Audit logs persisted to database
- [ ] No sensitive data logged
- [ ] E2E tests for RBAC enforcement

**Estimated effort**: 8 points
**Dependencies**: Issue #4, #5
**Labels**: security, rbac, backend

---

### Issue #8: [API] WebSocket Real-time Updates

**Description**: Implement WebSocket support for real-time deal status updates and live dashboard.

**Acceptance Criteria**:
- [ ] `/ws/deals` endpoint for deal updates
- [ ] Redis pub/sub for event streaming
- [ ] Deal status changes broadcast to connected clients
- [ ] Client auto-reconnect with exponential backoff
- [ ] Heartbeat mechanism to detect stale connections
- [ ] Message format documented (JSON schema)
- [ ] Load testing: 500+ concurrent connections
- [ ] Fallback to polling if WebSocket unavailable
- [ ] Unit tests for pub/sub logic
- [ ] Connection limits enforced per user

**Estimated effort**: 8 points
**Dependencies**: Issue #6, #7
**Labels**: api, realtime, websocket, backend

---

## PHASE 2: Core Portal Features (Weeks 5-8)

### Issue #9: [Portal] Deal Management Dashboard (Appsmith)

**Description**: Build comprehensive deal management UI in Appsmith with Kanban board, filtering, and bulk operations.

**Acceptance Criteria**:
- [ ] Appsmith app created and connected to FastAPI API
- [ ] Deal pipeline Kanban board (Scanning → Scored → Bidding → Won → Routed → Closed)
- [ ] Deal cards with VIN, photo, score, margin, buyer count
- [ ] Deal detail modal with full context
- [ ] Advanced search sidebar with filters
- [ ] One-click approve/reject workflow
- [ ] Bulk operations (approve multiple, assign, tag)
- [ ] Responsive design (desktop + tablet)
- [ ] Dark mode support
- [ ] Real-time updates via WebSocket
- [ ] Performance: Load <2s, interactions <500ms

**Estimated effort**: 13 points
**Dependencies**: Issue #5, #8
**Labels**: portal, appsmith, ui

---

### Issue #10: [Portal] Buyer Network Management (Appsmith)

**Description**: Build buyer profile management interface with CSV import, preference editor, and match scoring.

**Acceptance Criteria**:
- [ ] Buyer list table with search/filter/sort
- [ ] CSV import modal with validation feedback
- [ ] Buyer profile editor modal
- [ ] Make/model preference builder (multi-select)
- [ ] Price range picker
- [ ] Location/territory selector
- [ ] Buyer match scoring breakdown
- [ ] Outreach history viewer
- [ ] Bulk operations (delete, tag, export)
- [ ] Responsive design
- [ ] Real-time updates

**Estimated effort**: 10 points
**Dependencies**: Issue #6, #8
**Labels**: portal, appsmith, ui

---

### Issue #11: [Portal] Analytics & Reporting Dashboard (Appsmith)

**Description**: Build comprehensive analytics dashboard with charts, metrics, and custom reporting capabilities.

**Acceptance Criteria**:
- [ ] Win rate analytics chart (line, time series)
- [ ] Margin distribution histogram
- [ ] ROI by make/model bar chart
- [ ] Agent accuracy metrics dashboard
- [ ] Deal velocity trend (deals/day)
- [ ] Buyer performance leaderboard
- [ ] Custom report builder UI
- [ ] Date range picker
- [ ] CSV/PDF export support
- [ ] Filter by make, model, date range
- [ ] Responsive charts (mobile-friendly)
- [ ] Performance: Dashboard load <2s

**Estimated effort**: 10 points
**Dependencies**: Issue #6
**Labels**: portal, appsmith, analytics

---

### Issue #12: [Portal] Admin Settings Panel (Appsmith)

**Description**: Build admin interface for user management, system config, and compliance.

**Acceptance Criteria**:
- [ ] User management table (list, edit, delete)
- [ ] Role assignment interface (VIEWER/ANALYST/ADMIN/SUPER_ADMIN)
- [ ] Permission matrix visualization
- [ ] Audit log viewer with filtering
- [ ] System configuration editor
- [ ] API key management interface
- [ ] Database backup trigger button
- [ ] System health check dashboard
- [ ] RBAC: SUPER_ADMIN only access
- [ ] Action confirmation dialogs
- [ ] Comprehensive logging of admin actions

**Estimated effort**: 10 points
**Dependencies**: Issue #9, #11
**Labels**: portal, appsmith, admin

---

### Issue #13: [Backstage] Service Catalog Setup

**Description**: Configure Backstage service entities for Lux-Auto infrastructure and services.

**Acceptance Criteria**:
- [ ] Backstage app initialized and running
- [ ] Service entity for FastAPI backend
- [ ] Service entity for Appsmith portal
- [ ] Database entity (PostgreSQL)
- [ ] Cache entity (Redis)
- [ ] Service dependency graph rendered
- [ ] Health status checks implemented
- [ ] Service ownership defined
- [ ] Documentation links configured
- [ ] GitHub integration synced
- [ ] Runbook links added

**Estimated effort**: 8 points
**Dependencies**: Issue #2
**Labels**: backstage, catalog, infrastructure

---

### Issue #14: [Backstage] Operational Tools & Dashboards

**Description**: Build operational dashboards for deployment history, logs, metrics, and alerting.

**Acceptance Criteria**:
- [ ] Deployment history viewer
- [ ] Service logs viewer (tail last 1000 lines)
- [ ] Database query playground (read-only)
- [ ] API endpoint tester UI
- [ ] Redis cache inspector
- [ ] Environment variable viewer (non-secrets)
- [ ] Disk usage monitor
- [ ] Performance metrics dashboard
- [ ] Health check dashboard
- [ ] RBAC: ADMIN+ required

**Estimated effort**: 10 points
**Dependencies**: Issue #13
**Labels**: backstage, operations, observability

---

### Issue #15: [Backstage] Scaffolder Templates

**Description**: Create Backstage scaffolder templates for common operational tasks.

**Acceptance Criteria**:
- [ ] "New Portal Feature" template with boilerplate
- [ ] "Database Migration" template
- [ ] "API Endpoint" template with CRUD stubs
- [ ] "Backstage Plugin" template
- [ ] Each template includes security checklist
- [ ] Templates generate in correct directories
- [ ] Template variables properly substituted
- [ ] Documentation generated
- [ ] Test scaffolding successful

**Estimated effort**: 8 points
**Dependencies**: Issue #13
**Labels**: backstage, templates, automation

---

## PHASE 3: Advanced Features & Hardening (Weeks 9-12)

### Issue #16: [Portal] Advanced Features & Customization

**Description**: Add advanced portal features for power users and customization.

**Acceptance Criteria**:
- [ ] Dark mode / light mode toggle with persistence
- [ ] Custom dashboard builder (drag-drop widgets)
- [ ] Saved search/filter presets (name + save/load)
- [ ] Deal notifications (new, approved, won, lost)
- [ ] Webhook support for external integrations
- [ ] Keyboard shortcuts for power users
- [ ] Undo/redo functionality for actions
- [ ] User preference persistence
- [ ] Export deals to Excel
- [ ] Bulk tagging interface

**Estimated effort**: 10 points
**Dependencies**: Issue #9, #10, #11
**Labels**: portal, features, ux

---

### Issue #17: [Performance] Caching & Query Optimization

**Description**: Implement Redis caching layer and database query optimization for performance.

**Acceptance Criteria**:
- [ ] Redis caching for dashboard queries
- [ ] Cache TTL strategy defined (5-30 min based on type)
- [ ] Database indexes optimized for common queries
- [ ] Pagination implemented on all list endpoints
- [ ] API response caching headers set
- [ ] Query N+1 problems identified and fixed
- [ ] Connection pooling configured
- [ ] Performance metrics: <500ms p99
- [ ] Load testing: 1000 concurrent users
- [ ] Cache invalidation tested

**Estimated effort**: 10 points
**Dependencies**: Issue #5, #6
**Labels**: performance, backend, database

---

### Issue #18: [Security] Portal Security Hardening

**Description**: Implement comprehensive security controls for production readiness.

**Acceptance Criteria**:
- [ ] CORS restrictions configured (appsmith.*, backstage.*, lux.kushnir.cloud)
- [ ] Request signing for internal APIs
- [ ] API rate limiting per role (VIEWER: 100/hr, ANALYST: 500/hr, ADMIN: 1000/hr)
- [ ] SQL injection prevention validation
- [ ] XSS protection headers (Content-Security-Policy)
- [ ] CSRF token validation
- [ ] JWT token refresh logic
- [ ] Password policy enforced
- [ ] Secret rotation documented
- [ ] Penetration testing completed (zero critical findings)

**Estimated effort**: 10 points
**Dependencies**: Issue #7, #17
**Labels**: security, hardening, production

---

### Issue #19: [Testing] Portal E2E Tests & QA

**Description**: Comprehensive testing for portal functionality and performance.

**Acceptance Criteria**:
- [ ] E2E tests for complete deal approval workflow
- [ ] E2E tests for buyer import and matching
- [ ] E2E tests for analytics dashboard loading
- [ ] E2E tests for real-time deal updates
- [ ] E2E tests for RBAC enforcement
- [ ] Performance benchmarks documented
- [ ] Load testing: 500+ concurrent users
- [ ] Security penetration testing completed
- [ ] UAT testing guide created
- [ ] Known limitations documented

**Estimated effort**: 13 points
**Dependencies**: All Phase 2 issues
**Labels**: testing, qa, e2e

---

### Issue #20: [Observability] Monitoring & Alerting

**Description**: Setup comprehensive monitoring, metrics, and alerting for portal health.

**Acceptance Criteria**:
- [ ] Prometheus metrics for all portal endpoints
- [ ] Grafana dashboard for portal health
- [ ] Alert rules: response time >1s, error rate >5%
- [ ] Liveness probes for Appsmith and Backstage
- [ ] OpenTelemetry request tracing
- [ ] SLA monitoring dashboard (99.9% target)
- [ ] Incident alerting configured
- [ ] Runbook for common issues
- [ ] Weekly metrics review process
- [ ] Log aggregation and search

**Estimated effort**: 10 points
**Dependencies**: Issue #1, #2
**Labels**: observability, monitoring, operations

---

### Issue #21: [Documentation] Portal User & Admin Guides

**Description**: Comprehensive documentation for portal users and administrators.

**Acceptance Criteria**:
- [ ] User guide: portal features and workflows
- [ ] Admin guide: user management, settings, troubleshooting
- [ ] Operator guide: Backstage usage and runbooks
- [ ] API documentation: endpoints, auth, examples
- [ ] Portal architecture diagram
- [ ] Security best practices guide
- [ ] Troubleshooting FAQ
- [ ] Video tutorials (3-5 short clips)
- [ ] Admin onboarding checklist
- [ ] Knowledge base in Backstage

**Estimated effort**: 8 points
**Dependencies**: All feature issues
**Labels**: documentation, training

---

## Summary Table

| Issue # | Title | Phase | Type | Points | Status |
|---------|-------|-------|------|--------|--------|
| #1 | Appsmith Docker Compose | 1 | Infrastructure | 5 | To Do |
| #2 | Backstage Docker Compose | 1 | Infrastructure | 5 | To Do |
| #3 | Portal Audit & Preferences Schema | 1 | Database | 5 | To Do |
| #4 | User Roles & RBAC Schema | 1 | Database | 5 | To Do |
| #5 | Deals API Endpoints (v2) | 1 | API | 8 | To Do |
| #6 | Buyers & Analytics APIs (v2) | 1 | API | 8 | To Do |
| #7 | RBAC Middleware & Audit | 1 | Security | 8 | To Do |
| #8 | WebSocket Real-time Updates | 1 | API | 8 | To Do |
| #9 | Deal Management Dashboard | 2 | Portal | 13 | To Do |
| #10 | Buyer Network Management | 2 | Portal | 10 | To Do |
| #11 | Analytics & Reporting | 2 | Portal | 10 | To Do |
| #12 | Admin Settings Panel | 2 | Portal | 10 | To Do |
| #13 | Backstage Service Catalog | 2 | Backstage | 8 | To Do |
| #14 | Backstage Operational Tools | 2 | Backstage | 10 | To Do |
| #15 | Backstage Scaffolder Templates | 2 | Backstage | 8 | To Do |
| #16 | Advanced Portal Features | 3 | Portal | 10 | To Do |
| #17 | Caching & Query Optimization | 3 | Performance | 10 | To Do |
| #18 | Security Hardening | 3 | Security | 10 | To Do |
| #19 | Portal E2E Tests | 3 | Testing | 13 | To Do |
| #20 | Monitoring & Alerting | 3 | Observability | 10 | To Do |
| #21 | Documentation | 3 | Documentation | 8 | To Do |

**Total Points**: 176
**Estimated Duration**: 12 weeks (3 Sprints × 4 weeks)

---

## Creation Order & Dependencies

### Wave 1 (Weeks 1-2): Infrastructure & Database
1. #1 - Appsmith Docker (no dependencies)
2. #2 - Backstage Docker (depends on #1)
3. #3 - Portal Schema (no dependencies)
4. #4 - RBAC Schema (depends on #3)

### Wave 2 (Weeks 2-4): API Layer
5. #5 - Deals API (depends on #4)
6. #6 - Buyers/Analytics API (depends on #5)
7. #7 - RBAC Middleware (depends on #4, #5)
8. #8 - WebSocket (depends on #6, #7)

### Wave 3 (Weeks 5-6): Core Portal UI
9. #9 - Deal Dashboard (depends on #5, #8)
10. #10 - Buyer Management (depends on #6, #8)
11. #11 - Analytics Dashboard (depends on #6)
12. #12 - Admin Panel (depends on #9, #11)

### Wave 4 (Weeks 6-8): Backstage & Advanced
13. #13 - Service Catalog (depends on #2)
14. #14 - Operational Tools (depends on #13)
15. #15 - Scaffolder Templates (depends on #13)

### Wave 5 (Weeks 9-12): Hardening & Production
16. #16 - Advanced Portal Features (depends on #9-#12)
17. #17 - Performance & Caching (depends on #5, #6)
18. #18 - Security Hardening (depends on #7, #17)
19. #19 - Testing & QA (depends on all Phase 2)
20. #20 - Monitoring & Alerting (depends on #1, #2)
21. #21 - Documentation (depends on all)

---

## Notes

- All issues assume repository: `kushin77/lux-auto`
- All issues follow repository conventions from repo memory
- Team should assign one issue per sprint to avoid bottlenecks
- Database migrations should be tested in staging first
- Security testing must be done before production deployment
- Performance testing should start in Week 8
- Documentation should be started in Week 6 (not waiting until Week 12)

