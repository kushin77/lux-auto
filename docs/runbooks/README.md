# Operational Runbooks

Quick reference guides for responding to production incidents. Each runbook follows a standard format:

1. **Detection:** How you notice the problem
2. **Assessment:** How bad is it?
3. **Immediate Actions:** Stop the bleeding
4. **Root Cause:** Why did it happen?
5. **Resolution:** Fix it
6. **Verification:** Confirm it's fixed
7. **Postmortem:** Prevent recurrence

---

## Runbook 1: High Error Rate (5xx Errors)

### Detection

**Alert:** `HighErrorRate` fires (error rate > 0.1% for 5+ minutes)

**Or:** Manual observation in Slack #incidents channel

### Assessment

```bash
# Check error rate
curl -s http://prometheus:9090/api/v1/query \
  'expression=rate(http_requests_total{status=~"5.."}[5m])'
# Response: value = 0.015 (1.5% error rate) ❌ CRITICAL

# Check error budget
# SLO: 0.1% allowed
# Actual: 1.5%
# Budget impact: High (burning 15x normal rate)
```

### Immediate Actions

**Step 1: Declare incident**
```
Slack #incidents:
🚨 INCIDENT: Backend API high error rate (1.5%)
Time: 2024-01-15 14:32 UTC
Duration: ~5 minutes
Services affected: api.lux.kushnir.cloud
On-call: @on-call
```

**Step 2: Gather logs**
```bash
# Last 100 errors from backend
kubectl logs -f deployment/backend --tail=100 | grep ERROR

# Look for pattern:
#   - Connection pool exhausted?
#   - Timeout to database?
#   - Timeout to OAuth provider?
#   - Memory error?
#   - Crash loop?
```

**Step 3: Check dependencies**
```bash
# Database health
psql -h postgres.default.svc.cluster.local -c "SELECT 1;"
# If hangs: Database is unresponsive

# OAuth Google endpoints
curl -s -m 5 https://accounts.google.com/o/oauth2/token
# If timeout: Google is slow/down

# Check Kubernetes
kubectl top nodes
kubectl top pods
# If resources exhausted: Scale up or kill memory hogs
```

**Step 4: Quick remediation**
```bash
# Option A: Restart backend service
kubectl rollout restart deployment/backend
kubectl rollout status deployment/backend -w

# Option B: Scale down/up to force restart
kubectl scale deployment/backend --replicas=0
sleep 2
kubectl scale deployment/backend --replicas=3
kubectl rollout status deployment/backend -w

# Option C: Rollback to previous version
kubectl rollout undo deployment/backend
kubectl rollout status deployment/backend -w
```

### Root Cause

**Most common causes (in order of probability):**

1. **N+1 Query Pattern** (common)
   ```
   Request loop:
   for user in users:
       query database for user.profile  # 1000 queries instead of 1 join
   ```
   Fix: Optimize query with join or batch fetch

2. **Connection Pool Exhausted** (common)
   ```
   Every request opens connection, doesn't close
   Max connections = 20, requests pending = 200
   New requests get connection timeout
   ```
   Fix: Check connection pooling code, increase pool size, kill idle connections

3. **Slow Query** (common)
   ```
   SELECT * FROM large_table  -- missing index
   ```
   Fix: Add index, optimize query with EXPLAIN ANALYZE

4. **Database Down** (occasional)
   ```
   Replica node crashed
   Or: Disk full, won't accept queries
   ```
   Fix: Failover to second node, increase disk

5. **OAuth Slow/Down** (occasional)
   ```
   Google APIs timing out
   All auth requests hang, cascade failures
   ```
   Fix: Increase timeout, add circuit breaker, cache tokens longer

6. **Memory Leak** (rare but critical)
   ```
   Memory usage growing unbounded
   Garbage collection can't keep up
   Service crashes
   ```
   Fix: Profile code, find memory leak, release new version

**To identify cause:**

```bash
# Check recent deployments
git log --oneline -10
# New code since issue started? Likely culprit.

# Check slow query logs
kubectl logs deployment/backend | grep "Query took"
# Look for queries > 100ms

# Check connection stats
psql -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
# If many "idle in transaction": Connection not being returned

# Check memory
kubectl top pod -l app=backend
# If memory > 80% of limit: Scale up or find leak

# Check Google API status
curl -s https://status.google.com/status
# If page red: Google is down, not our problem (but we need circuit breaker)
```

### Resolution

**If root cause identified:**

#### N+1 Query Pattern
```python
# ❌ Bad
users = await db.execute(select(User))
for user in users.scalars():
    profile = await db.execute(select(Profile).where(Profile.user_id == user.id))
    # 1000 queries!

# ✅ Good
users = await db.execute(
    select(User).options(joinedload(User.profile))
)
# 1 query with join
```

Deployment:
```bash
git commit -m "[HOTFIX] Fix N+1 query in user list endpoint"
git push
# Automatic staging deploy
# Smoke tests pass
# Manual approval for prod
# Deploy
```

#### Connection Pool Exhausted
```python
# .env or config
DATABASE_POOL_SIZE = 20  # Increase from 10
DATABASE_POOL_RECYCLE = 3600  # Recycle connections hourly
DATABASE_POOL_TIMEOUT = 30  # Timeout idle connections faster
```

Deployment: Same as above

#### Slow Query
```bash
# Analyze slow query
EXPLAIN ANALYZE SELECT * FROM large_table WHERE status='active';
# Without index: Seq Scan Cost=1000
# With index: Index Scan Cost=10

# Create index
ALTER TABLE large_table ADD INDEX ix_status(status);
```

Deployment: Via database migration + code deployment

#### Memory Leak
```bash
# Profile code
pip install py-spy

# Run with profiler
py-spy top -- python -m uvicorn backend.main:app

# Look for growing memory on same function
# Usually: circular references, global dictionaries, cache not cleaning

# Fix code, deploy new version
```

### Verification

**After fix deployed:**

```bash
# 1. Check error rate drop
kubectl logs -f deployment/backend | grep "error_rate"
# Should drop back to 0.01% within 2 minutes

# 2. Check latency recovery
curl http://localhost:8000/health
# Should respond sub-100ms

# 3. Check database
psql -c "SELECT 1;" # Should instant
psql -c "SELECT count(*) FROM users;" # Should not hang

# 4. Check Grafana dashboard
# Open: https://grafana.lux.kushnir.cloud/d/backend-health
# Error rate: ✓ < 0.1%
# Latency p95: ✓ < 200ms
# Connections: ✓ < 18/20
```

### Postmortem

**Next day, schedule 30-min meeting:**

**Questions to answer:**
1. What was the root cause?
2. When did it start? How long did it run?
3. How much error budget was burned?
4. Could monitoring have detected earlier?
5. Could code review have prevented?
6. Action items to prevent recurrence?

**Action items (examples):**

```
Cause: Missing index on `status` column
Prevention: 
- [ ] Add to database migration checklist
- [ ] Query analyzer in CI (detect unindexed queries?)
- [ ] Add performance test at scale

Cause: Connection pool exhausted
Prevention:
- [ ] Add connection pool saturation alert
- [ ] Load test before deploying
- [ ] Document pool sizing strategy in ADR

Cause: Code review missed this
Prevention:
- [ ] Reviewer should ask: "What happens at 10x load?"
- [ ] Require EXPLAIN ANALYZE for database changes
- [ ] Run load tests before merge
```

**Document in:** Issue + ADR (if architectural) + runbook update

---

## Runbook 2: Database Replication Lag > 100MB

### Detection

**Alert:** `HighReplicationLag` fires (lag > 100MB for 5+ minutes)

### Assessment

```bash
# Check replication status
psql -c "SELECT pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn();" 
# Large gap = high lag

# Check replica status
psql -h replica.db.svc -c "SELECT pg_last_wal_replay_lsn();"
# If query hangs: Replica is stuck/crashed
```

### Immediate Actions

```bash
# Check replica server
ssh replica-server
top  # Is it CPU-bound? I/O-bound?
df -h  # Disk full?
ps aux | grep postgres  # Any long-running queries?

# Escalating actions:
# 1. Check for long-running transaction on primary
psql -c "SELECT pid, query, query_start FROM pg_stat_activity WHERE state = 'active'"

# 2. Cancel blocking query (carefully)
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE ... ;"

# 3. Restart replica PostgreSQL
sudo systemctl restart postgresql

# 4. Failover if replica is permanently broken
# (Contact AWS RDS support or your DB admin)
```

### Root Cause

1. **Long-running transaction on primary** (most common)
2. **Network saturation** (slow connection to replica)
3. **Replica hardware underpowered** (can't keep up)

### Resolution

See step above. Usually restarting replica fixes it.

### Postmortem

- Was there a long transaction running? Why?
- Can we detect this sooner (alarm at 50MB lag)?
- Do we need bigger replica resources?
- Does our backup strategy account for this?

---

## Runbook 3: Database Down

### Detection

**Alert:** `DatabaseDown` fires (pg_up == 0)

### Impact

**CRITICAL:** All API requests will fail instantly

### Immediate Actions

**Step 1:** Verify it's really down
```bash
psql -h postgres.default.svc.cluster.local -c "SELECT 1;" -m 5
# Timeout = down
```

**Step 2:** Check logs
```bash
# Kubernetes PostgreSQL pod logs
kubectl logs pod/postgres-0 --tail=50

# Common messages:
# "disk space low" = PRO PROBLEM (rollback not possible)
# "connection pool exhausted" = Too many connections
# "OOM killer" = Out of memory
# "max_connections exceeded" = Config issue
```

**Step 3:** Failover procedure
```bash
# Production setup: Primary + Replica

# If primary is down:
# 1. Promote replica to primary
kubectl patch statefulset postgres -p \
  '{"spec": {"template": {"spec": {"containers": [{"name":"postgres","env":[{"name":"POSTGRESQL_ROLE","value":"master"}]}]}}}}'

# 2. Point API to new primary
kubectl set env deployment/backend DATABASE_URL=postgresql://lux_admin:...@replica-now-primary:5432/lux_prod

# 3. Restart API
kubectl rollout restart deployment/backend

# 4. Verify health
kubectl logs -f deployment/backend | grep "Database connection"
```

**Step 4:** Communicate
```
#incidents: Database failover complete. API coming back online.
ETA: 2 minutes
```

### Verification

```bash
# Can API connect to new primary?
curl http://api.lux.kushnir.cloud/health
# { "status": "ok" }

# Check error rate dropped
kubectl logs deployment/backend | tail -20
```

### Postmortem

- Hardware failure? Plan replacement
- Disk full? Better monitoring needed
- Connection pool issue? Update configuration
- Was failover smooth? Test failover procedure monthly

---

## Runbook 4: OAuth Token Exchange Slow

### Detection

**Alert:** `SlowOAuthTokenExchange` fires (p95 > 500ms)

### Assessment

```bash
# Check Google status
curl -s https://status.google.com/status
# If red: Not our problem (but we need circuit breaker)

# Check latency
kubectl logs deployment/backend | grep "oauth_token_exchange_duration"
# Look for >500ms entries

# Check network
ping google.com -c 5
# High latency = network issue
```

### Immediate Actions

```python
# Temporary: Increase timeout
OAUTH_TIMEOUT_SECONDS = 10  # Was 5
OAUTH_CACHE_DURATION = 3600  # Cache tokens longer 

# Permanent improvements in code:
# 1. Add circuit breaker
# 2. Cache tokens (already do this)
# 3. Fallback to previous token if Google slow
# 4. Async token refresh (don't block request)
```

### Root Cause

1. **Network latency** (ISP slowness)
2. **Google API slow** (Google's problem)
3. **Token exchange not cached** (inefficient)

### Resolution

1. **Short-term:** Increase timeout, cache longer
2. **Long-term:** Add circuit breaker, async refresh, fallback strategy

---

## Runbook Template (For New Incidents)

Use this template for new incident types:

```markdown
# Runbook: [Problem Name]

## Detection
How you know there's an issue...

## Assessment
Is this critical/warning/info?

## Immediate Actions
Stop the bleeding (restart, scale, rollback)

## Root Cause
Why did this happen?

## Resolution
How to fix it properly

## Verification
How to confirm fix worked

## Postmortem
Prevent recurrence (monitoring, code review, testing)
```

---

## On-Call Responsibilities

**You paged? Responsibilities:**

1. **0-5 min:** Confirm incident, declare severity
2. **5-30 min:** Assess impact, take immediate action
3. **30-60 min:** Root cause analysis, implement fix
4. **60+ min:** Verify fix, communicate status updates
5. **Next day:** Write postmortem, action items

**Escalate if unsure:**
- @kushin77 (tech lead)
- Manager (business impact)
- Cloud vendor support (infrastructure issues)

---

## Quick Reference: Common Fixes

| Symptom | Likely Cause | Quick Fix |
|---------|-------------|----------|
| 500 errors | N+1 queries | Optimize query |
| Hang on request | Connection pool full | Restart service |
| Memory leak | Unbounded cache | Clear cache, profile |
| 503 Service Unavailable | Replica down | Failover |
| Slow auth | Google slow | Increase timeout |
| High disk usage | Logs filling disk | Archive logs, rotate |

---

## Avoiding 3 AM Pages

```
✅ Catch in code review      (No 3 AM page)
✅ Catch in staging          (No 3 AM page)
⚠️  Catch in production SLO  (Page, but fast to fix)
❌ Crash at 3 AM             (Worst case)
```

Our goal: Most issues caught before step 3.

---

## Additional Resources

- **SLOs:** docs/SLOs.md (targets & thresholds)
- **Alerts:** monitoring/prometheus/alert_rules.yml (what fires)
- **Deployment:** docs/DEPLOYMENT.md (how code gets to prod)
- **Standards:** CONTRIBUTING.md (how we prevent issues)
- **Team:** TEAM-TRAINING.md (how team understands this)

---

**Questions? Ask @on-call or @kushin77**

**Remember: Speed > Perfection in incident response. Fix first, optimize later.**
