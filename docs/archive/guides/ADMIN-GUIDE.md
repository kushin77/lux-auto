# Lux-Auto Administrator Guide

## System Overview

Lux-Auto is a comprehensive deal management platform with three main components:

1. **FastAPI Backend** (`lux.kushnir.cloud`): REST API with RBAC and audit logging
2. **Appsmith Portal** (`appsmith.lux.kushnir.cloud`): Low-code UI for deal/buyer management
3. **Backstage Portal** (`backstage.lux.kushnir.cloud`): Service catalog and operational tools

---

## User Management

### Adding Users

1. Navigate to **Settings** → **User Management**
2. Click **+ Add User**
3. Enter email address (must be valid company Google account)
4. Select initial role:
   - **VIEWER**: Read-only access
   - **ANALYST**: Read/write access to deals and buyers
   - **ADMIN**: Full access including user management
   - **SUPER_ADMIN**: Unrestricted access
5. Click **Create**
6. User receives email notification and can login immediately

### Assigning Roles

Users can have multiple roles (e.g., both ANALYST and ADMIN). To assign:

1. Go to **Settings** → **User Management**
2. Click the user row
3. In **Roles** section, click **+ Add Role**
4. Select role and optional expiration date
5. Click **Save**

### Removing User Access

1. Go to **Settings** → **User Management**
2. Find user to remove
3. Click **Deactivate** button
4. Confirm action
5. User can no longer login (access is revoked immediately)

To reactive later:
1. Go to **Settings** → **Deactivated Users**
2. Find user and click **Reactivate**

---

## System Configuration

### Database Backups

Automatic backups run every 6 hours. To manually backup:

1. Go to **Settings** → **System** → **Backups**
2. Click **Run Backup Now**
3. Backup appears in list with timestamp
4. To restore: Select backup and click **Restore** (⚠️ Warning: This overwrites current data)

### Performance Tuning

#### Database Indexing
All critical queries are indexed for <500ms response time. Indexes applied to:
- deals(status, created_at)
- deals(make, model)
- buyers(match_score)
- audit_logs(event_type, created_at)

To view index usage:
```sql
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

#### Redis Caching Configuration
Cache TTLs by data type:
- Deals list: 5 minutes
- Analytics metrics: 15 minutes
- Buyer match scores: 30 minutes
- User roles: 1 hour

To flush cache:
1. Go to **Settings** → **Advanced**
2. Click **Clear Redis Cache**
3. Confirm action

### API Rate Limiting

Limits per role per hour:
- VIEWER: 1,000 requests/hour
- ANALYST: 5,000 requests/hour
- ADMIN: 10,000 requests/hour
- SUPER_ADMIN: Unlimited

To modify limits:
1. Go to **Settings** → **API** → **Rate Limits**
2. Adjust per-role limits
3. Click **Save**

---

## Monitoring & Health

### System Health Dashboard

Go to **Settings** → **System Health** to view:
- API response time (p50, p95, p99)
- Database connection pool status
- Redis memory usage
- Error rate (5xx responses)
- Authentication failures
- WebSocket connection count

### Real-Time Metrics

Metrics  are collected in Prometheus and visualized in Grafana:
- Dashboard: https://lux.kushnir.cloud/grafana
- Login with admin credentials
- Key dashboards:
  - API Health (response times, error rates)
  - Database Health (connection pool, query performance)
  - Business Metrics (deals/day, avg margin, win rate)

### Alerting

Alerts are configured for:
- API response time > 1 second
- Error rate > 5%
- Database connection pool > 80% utilization
- Redis memory > 80%
- WebSocket connections > 500

When triggered, alerts are sent to:
- #alerts Slack channel
- ops-team@lux-auto.com
- PagerDuty (for critical alerts)

---

## Audit & Compliance

### Audit Logs

All user actions are logged for compliance. To view:

1. Go to **Settings** → **Audit Logs**
2. Filter by date range, user, action type
3. View details for each action:
   - User email and IP address
   - Action (create/update/delete)
   - Resource affected
   - Old and new values
   - Timestamp

Example actions logged:
- User login/logout
- Deal created/updated/deleted
- Buyer imported/modified
- Role assigned/revoked
- Settings changed
- API key created/rotated

### Data Retention

- Audit logs: Retained for 7 years for compliance
- Deal history: Kept indefinitely
- User sessions: Purged after 90 days of inactivity
- Backups: Kept for 30 days

### Compliance Reports

1. Go to **Settings** → **Compliance**
2. Select report type:
   - **RBAC Audit**: User access and role changes
   - **Data Access**: Who accessed what data
   - **API Usage**: API endpoint call patterns
   - **Authentication**: Login attempts and failures
3. Set date range
4. Click **Generate Report**
5. Download as PDF/CSV

---

## Security Management

### API Keys

Admin users can manage API keys for programmatic access.

#### Creating an API Key

1. Go to **Settings** → **API Keys**
2. Click **+ Generate Key**
3. Enter key name (e.g., "Analytics Pipeline")
4. Select scopes (permissions):
   - `read:deals`
   - `write:deals`
   - `approve:deals`
   - `read:buyers`
   - `write:buyers`
   - `read:analytics`
5. Set expiration (recommended: 90 days)
6. Click **Create**
7. **Save the key** (only shown once!)

#### Using API Keys

```bash
curl -H "Authorization: Bearer lux_key_abc123xyz" \
  https://lux.kushnir.cloud/api/v2/deals
```

#### Rotating Keys

1. Go to **Settings** → **API Keys**
2. Find key and click **Rotate**
3. Old key is immediately revoked
4. New key is generated
5. Update applications using the key

#### Revoking Keys

1. Go to **Settings** → **API Keys**
2. Find key and click **Revoke**
3. Key is immediately disabled
4. All applications using the key will fail

### OAuth2 Configuration

Google OAuth is configured for SSO. To update credentials:

1. Go to **Settings** → **OAuth2**
2. Update client ID/secret if changed in Google Cloud Console
3. Click **Test Connection** to verify
4. Click **Save**

### Session Management

View active sessions and terminate suspicious ones:

1. Go to **Settings** → **Sessions**
2. View all active user sessions with:
   - User email
   - Login time and IP address
   - User-Agent (browser/app)
   - Last activity time
3. Click **X** next to any session to terminate immediately
4. User will be logged out

---

## Operational Runbooks

### Recovering from Database Failure

If database is unreachable:

1. Check database status:
   ```bash
   docker-compose ps postgres
   ```

2. If container is down, restart:
   ```bash
   docker-compose up -d postgres
   ```

3. Verify connectivity:
   ```bash
   docker-compose exec postgres pg_isready
   ```

4. If data is corrupted, restore from backup:
   - Go to **Settings** → **System** → **Backups**
   - Select most recent backup before corruption occurred
   - Click **Restore**
   - Confirm (this overwrites current data)

### Clearing Cache

If analytics metrics are showing stale data:

1. Go to **Settings** → **Advanced**
2. Click **Clear Redis Cache**
3. Confirm action
4. Cache is purged, queries will rebuild next access
5. This may cause temporary slowness as data is recomputed

### Scaling Recommendations

#### API Performance
- Current capacity: 500 concurrent users
- Response time target: <500ms p99
- If hitting limits, scale horizontally:
  1. Add additional FastAPI replicas
  2. Use load balancer (Caddy already configured)
  3. Monitor via Grafana dashboard

#### Database
- Current capacity: 50GB storage
- Backup/restoration takes ~2 hours
- To optimize:
  1. Archive old deals (> 6 months)
  2. Vacuum analyze: `VACUUM ANALYZE;`
  3. Rebuild indexes: `REINDEX;`

#### WebSocket Connections
- Current capacity: 1,000 concurrent connections
- To scale:
  1. Use Redis pub/sub (already configured)
  2. Add additional WebSocket servers behind load balancer

---

## Troubleshooting

### API Endpoint Returning 403 Forbidden

**Cause**: User lacks required permission

**Solution**:
1. Check user's role: **Settings** → **Users** → Click user
2. Verify role has required permission
3. If not, add role with appropriate permissions
4. User must logout/login for changes to take effect

### Audit Logs Not Appearing

**Cause**: Audit logging is disabled or database is full

**Solution**:
1. Verify audit logging is enabled: **Settings** → **System** → "Enable Audit Logging" = ON
2. Check disk space: `df -h`  
3. Archive old logs: `Settings` → `Audit Logs` → `Archive Older Than 1 Year`

### WebSocket Connections Failing

**Cause**: Firewall/proxy blocking WebSocket upgrades

**Solution**:
1. Check proxy/firewall allows WebSocket: `wss://` protocol on port 443
2. Verify Redis is running: `docker-compose ps`
3. Check logs: `docker-compose logs backstage`
4. Fallback to polling is automatic if WebSocket fails

### High API Response Times

**Cause**: Database slow queries or cache misses

**Solution**:
1. Check Grafana dashboard for slow queries
2. Review indexes: Look for sequential scans
3. Clear cache to rebuild: **Settings** → **Advanced** → **Clear Redis Cache**
4. Check database connection pool: **Settings** → **System Health**

---

## Maintenance Schedule

### Daily
- Monitor system health metrics (Grafana)
- Check error rates and alerts
- Review audit logs for suspicious activity

### Weekly
- Review user access and deactivate inactive users
- Rotate sensitive credentials (API keys, OAuth secrets)
- Check backup success in logs

### Monthly
- Archive old audit logs (>90 days)
- Review performance metrics and optimize if needed
- Update security patches for dependencies
- Test disaster recovery (backup restoration)

### Quarterly
- Schedule security audit
- Review and update access controls
- Performance baseline testing with load tools

---

## Support Escalation

For issues you cannot resolve:

1. Collect information:
   - Error message and stack trace
   - Affected user(s)
   - When did it start
   - Steps to reproduce
   - System health metrics (screenshot from Grafana)

2. Check logs:
   ```bash
   docker-compose logs -f fastapi
   docker-compose logs -f postgres
   docker-compose logs -f appsmith
   ```

3. Contact:
   - **On-call Engineer**: Check PagerDuty
   - **Email**: ops@lux-auto.com
   - **Slack**: #incidents channel

---

Last Updated: April 12, 2026
Document Version: 1.0
