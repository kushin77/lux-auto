# Service Level Objectives (SLOs)

This document defines reliability targets and monitoring for Lux-Auto services.

## Overview

**Without SLOs, you're not engineering — you're gambling.**

SLOs define:
- **SLI** (Service Level Indicator): What we measure
- **SLO** (Service Level Objective): What we target
- **Error Budget**: How much failure is acceptable

## Backend API Service (FastAPI)

### Service Level Indicators (SLIs)

| SLI | Measurement | Query |
|-----|-------------|-------|
| **Availability** | % of requests returning 2xx/3xx | `(requests_total - requests_5xx) / requests_total` |
| **Latency (p95)** | 95th percentile response time | `histogram_quantile(0.95, request_duration_seconds)` |
| **Latency (p99)** | 99th percentile response time | `histogram_quantile(0.99, request_duration_seconds)` |
| **Error Rate** | % of requests returning 5xx | `requests_5xx / requests_total` |

### SLO Targets

```
Availability:  99.5% (2.16 hours downtime/month)
Latency p95:   < 200ms
Latency p99:   < 500ms
Error Rate:    < 0.1%
```

### Error Budget

Monthly budget (30 days = 43,200 minutes):

```
Availability SLO: 99.5%
  Allowed downtime: 0.5% × 43,200 = 216 minutes (3.6 hours)

Error Rate SLO: 0.1%
  Out of 1,000,000 requests:
    Allowed errors: 1,000
    Budget used: ALL (monitoring only, not hard limit)
```

### Monitoring

#### Prometheus Metrics

```yaml
# Emitted by FastAPI middleware
http_requests_total{
  method,
  endpoint,
  status,           # 200, 404, 500, etc.
  service="backend"
}

http_request_duration_seconds{
  method,
  endpoint,
  service="backend"
}  # Histogram for p50, p95, p99

database_query_duration_seconds{
  operation,        # SELECT, INSERT, UPDATE, DELETE
  table,
  service="backend"
}

active_database_connections{
  service="backend"
}
```

#### Grafana Dashboards

Dashboard: `Backend Service Health`
- Availability % (last hour)
- Error rate trend
- Latency heatmap (p50, p95, p99)
- Active connections
- Request throughput (req/sec)

### Alerts

```yaml
# alert_rules.yml

# High Error Rate
- alert: HighErrorRate
  expr: |
    (increase(http_requests_total{status=~"5.."}[5m])
    / increase(http_requests_total[5m])) > 0.05
  for: 5m
  severity: critical
  annotations:
    summary: "Error rate >5% for 5 minutes"
    action: "Page on-call, check logs for 5xx errors"

# High Latency
- alert: HighLatency
  expr: |
    histogram_quantile(0.95, http_request_duration_seconds) > 0.5
  for: 10m
  severity: warning
  annotations:
    summary: "p95 latency >500ms for 10 minutes"
    action: "Investigate slow queries, check database load"

# Database Connection Pool Exhausted
- alert: DBConnectionPoolExhausted
  expr: |
    active_database_connections{service="backend"} > 18
  for: 2m
  severity: critical
  annotations:
    summary: "Database connection pool >90% full"
    action: "Scale backend instances, investigate long-running queries"
```

### Incident Response

#### Runbook: High Error Rate

```
1. Check logs for 5xx errors
   kubectl logs -f deployment/backend --tail=100 | grep ERROR

2. Check database health
   SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

3. Check dependencies (OAuth, GSM)
   curl -s https://accounts.google.com/o/oauth2/token -m 5
   gcloud secrets list --project lux-auto

4. If:
   - Database unhealthy → Failover to replica
   - Dependencies down → Degrade gracefully, return cached data
   - Backend bug → Rollback previous deploy

5. Postmortem:
   - Root cause?
   - Could monitoring have caught this?
   - Preventive measures?
```

#### Runbook: High Latency

```
1. Check slow query logs
   SELECT query, mean_time FROM pg_stat_statements
   ORDER BY mean_time DESC LIMIT 5;

2. Check connection pool usage
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;

3. Check backend resource usage
   kubectl top node, kubectl top pod

4. If:
   - Slow query → Optimize query, add index, split into async job
   - Connection exhausted → Scale backend instances
   - Resource constrained → Increase BPU limits, scale cluster

5. Postmortem:
   - Query pattern change? (new feature?)
   - Load spike? (cache-miss cascading?)
   - Dependency latency? (OAuth, GSM)
```

---

## Database (PostgreSQL)

### Service Level Indicators

| SLI | Measurement |
|-----|-------------|
| **Availability** | Seconds since last successful query / window |
| **Replication Lag** | Bytes behind primary replica (seconds) |
| **Disk Space** | % of storage used |
| **Connection Count** | Active connections / max_connections |

### SLO Targets

```
Availability:      99.9% (43 minutes downtime/month)
Replication Lag:   < 100ms (streaming replication)
Disk Space:        < 80% used
Connection Limit:  < 80% of max_connections
```

### Monitoring

Prometheus exporter: `postgres_exporter`

```yaml
pg_up{instance}                    # 1 = up, 0 = down
pg_replication_lag_bytes           # Replication lag
pg_database_size_bytes{datname}    # Database size
pg_stat_activity_count             # Active connections
```

### Alerts

```yaml
- alert: DatabaseDown
  expr: pg_up == 0
  for: 1m
  severity: critical

- alert: HighReplicationLag
  expr: pg_replication_lag_bytes > 100_000_000  # 100MB
  for: 5m
  severity: warning

- alert: DiskFull
  expr: (pg_database_size_bytes / pg_database_size_bytes_max) > 0.9
  for: 10m
  severity: critical
```

---

## OAuth2 / Google Integration

### Service Level Indicators

| SLI | Measurement |
|-----|-------------|
| **Auth Success Rate** | % of OAuth redirects completing successfully |
| **Google API Latency** | Seconds for token exchange |
| **Session Valid** | % of sessions still valid (not revoked) |

### SLO Targets (External Dependency)

```
Google Availability:    99.99% (Google's own SLO)
Token Exchange:         < 500ms (p95)
Session Validity:       > 99% (our controls)
```

### Monitoring

```python
# Emit in auth/session_service.py
oauth_token_exchange_duration_seconds  # Histogram
oauth_token_exchange_failures_total    # Counter
active_sessions_count                  # Gauge
session_invalidation_duration_seconds  # Histogram
```

### Alerts

```yaml
- alert: HighOAuthFailureRate
  expr: |
    (increase(oauth_token_exchange_failures_total[5m])
    / increase(oauth_token_exchange_attempts_total[5m])) > 0.1
  for: 5m
  severity: critical
  annotations:
    summary: "OAuth failure rate >10%"
    action: "Check Google status page, verify client credentials"

- alert: SessionValidationError
  expr: increase(session_validation_errors_total[5m]) > 100
  for: 2m
  severity: warning
```

---

## Compliance & Audit

### Data Retention SLO

```
Audit logs:        365 days (immutable)
Session logs:      90 days
Error logs:        30 days (or until analyzed)
Performance data:  7 days (archived to S3 weekly)
```

### Audit SLI

```
All state changes logged:     100%
Audit logs immutable:         100%
Audit logs encrypted at rest: 100%
```

---

## Monthly Review

Every month (first Monday):

1. **Calculate error budget burn**
   - Availability: 99.5% goal, actual X%, burned Y%
   - Error rate: 0.1% goal, actual Z%, full budget?

2. **Review incidents**
   - What failed us this month?
   - Which SLI kept us honest?
   - What prevented worse outcomes?

3. **Adjust alerts**
   - False positives? (lower threshold or extend window)
   - Missed issues? (add new alert)
   - New patterns? (update runbooks)

4. **Publish SLO report**
   - Share with team
   - Link in README
   - Use for on-call rotation planning

### SLO Report Template

```markdown
# SLO Review [Month, Year]

## Availability
- Target: 99.5%
- Actual: 99.6% ✅
- Incidents: 0
- Error budget remaining: 100%

## Latency (p95)
- Target: < 200ms
- Actual: 156ms ✅
- Degradation periods: None

## Error Rate
- Target: < 0.1%
- Actual: 0.08% ✅
- High-error hours: None

## Database Replication
- Lag target: < 100ms
- Actual: 12ms ✅
- Failures: 0

## Incidents This Month
1. None

## Improvements Deployed
- Added latency histogram for slow query detection
- Optimized session lookup query (35% faster)

## Next Month Goals
- Reduce p99 latency below 300ms
- Add distributed tracing (correlation IDs)
```

---

## References

- Google SRE Book: Site Reliability Engineering (Chapter 4: Service Level Objectives)
- Prometheus Queries: [prometheus.io/docs/querying](https://prometheus.io/docs/querying)
- OpenSLO Standard: [openslo.com](https://openslo.com)
