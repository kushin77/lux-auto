# Monitoring, Alerting & Observability Setup Guide

## Overview

Production observability requires instrumentation across metrics, logs, and traces.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  FastAPI (Prometheus metrics) | Appsmith | Backstage       │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼─────┐  ┌────▼─────┐  ┌────▼─────┐
   │Prometheus│  │  Loki    │  │  Jaeger  │
   │ Metrics  │  │   Logs   │  │  Traces  │
   └────┬─────┘  └────┬─────┘  └────┬─────┘
        │             │             │
   ┌────▼─────────────▼─────────────▼─────┐
   │        Grafana Dashboard               │
   │  (Single pane of glass monitoring)    │
   └──────────────────────────────────────┘
        │
   ┌────▼─────────────────────────────┐
   │   Alert Manager / Slack / Email   │
   └────────────────────────────────────┘
```

---

## Prometheus Setup

### prometheus.yml

```yaml
# docker-compose volume: ./monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'lux-production'
    environment: 'prod'

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

rule_files:
  - '/etc/prometheus/rules/*.yml'

scrape_configs:
  # FastAPI application
  - job_name: 'fastapi'
    static_configs:
      - targets: ['fastapi:8000']
    metrics_path: '/metrics'
    scrape_interval: 5s

  # PostgreSQL (via postgres_exporter)
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  # Redis (via redis_exporter)
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  # Docker containers
  - job_name: 'docker'
    static_configs:
      - targets: ['cadvisor:8080']

  # Node exporter (host metrics)
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
```

### Alert Rules

```yaml
# monitoring/rules/alert_rules.yml
groups:
  - name: application
    interval: 30s
    rules:
      # API response time
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High HTTP response time ({{ $value }}s)"
          description: "95th percentile response time exceeds 1.5s"

      # High error rate
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate ({{ $value }}%)"
          description: "Error rate exceeds 5%"

      # Authentication failures
      - alert: HighAuthFailures
        expr: rate(auth_failures_total[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High auth failure rate"

  - name: database
    interval: 30s
    rules:
      # Database connections
      - alert: HighDatabaseConnections
        expr: pg_stat_activity_count > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database connection count ({{ $value }})"

      # Slow queries
      - alert: SlowQueries
        expr: rate(pg_slow_queries_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High rate of slow queries"

      # Disk space
      - alert: HighDiskUsage
        expr: pg_disk_usage_percentage > 80
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "High database disk usage ({{ $value }}%)"

  - name: redis
    interval: 30s
    rules:
      # Memory usage
      - alert: HighRedisMemory
        expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High Redis memory usage ({{ $value }}%)"

      # Evictions
      - alert: RedisEvictions
        expr: rate(redis_evicted_keys_total[5m]) > 10
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Keys being evicted from Redis"

  - name: infrastructure
    interval: 60s
    rules:
      # CPU usage
      - alert: HighCPUUsage
        expr: rate(node_cpu_seconds_total[5m]) > 0.85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage ({{ $value }}%)"

      # Memory usage
      - alert: HighMemoryUsage
        expr: node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes < 0.15
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low available memory ({{ $value }}%)"

      # Disk I/O
      - alert: HighDiskIOUtilization
        expr: rate(node_disk_io_time_seconds_total[5m]) > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High disk I/O utilization"
```

---

## Grafana Configuration

### Docker Compose Addition

```yaml
grafana:
  image: grafana/grafana:10.0
  ports:
    - "3000:3000"
  environment:
    GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD}
    GF_INSTALL_PLUGINS: grafana-piechart-panel
    GF_SECURITY_DISABLE_INITIAL_ADMIN_CHANGE: "true"
  volumes:
    - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
    - grafana_storage:/var/lib/grafana
  depends_on:
    - prometheus
```

### Grafana Dashboard Examples

```json
{
  "dashboard": {
    "title": "Lux Auto - Application Performance",
    "tags": ["application", "performance"],
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{path}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Response Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "{{path}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "{{status}}"
          }
        ],
        "type": "stat",
        "fieldConfig": {
          "defaults": {
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {"color": "green", "value": null},
                {"color": "yellow", "value": 0.01},
                {"color": "red", "value": 0.05}
              ]
            }
          }
        }
      },
      {
        "title": "Database Connections",
        "targets": [
          {
            "expr": "pg_stat_activity_count",
            "legendFormat": "Active"
          }
        ],
        "type": "gauge",
        "fieldConfig": {
          "defaults": {
            "max": 100,
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {"color": "green", "value": null},
                {"color": "yellow", "value": 70},
                {"color": "red", "value": 90}
              ]
            }
          }
        }
      },
      {
        "title": "Redis Memory Usage",
        "targets": [
          {
            "expr": "redis_memory_used_bytes / redis_memory_max_bytes * 100",
            "legendFormat": "Usage %"
          }
        ],
        "type": "gauge"
      }
    ]
  }
}
```

---

## Distributed Tracing with Jaeger

### Docker Compose Addition

```yaml
jaeger:
  image: jaegertracing/all-in-one:1.48
  ports:
    - "16686:16686"  # UI
    - "6831:6831/udp"  # Thrift compact
  environment:
    COLLECTOR_ZIPKIN_HOST_PORT: ":9411"
  volumes:
    - jaeger_storage:/badger/data

# In FastAPI service
environment:
  OTEL_EXPORTER_JAEGER_AGENT_HOST: jaeger
  OTEL_EXPORTER_JAEGER_AGENT_PORT: 6831
```

### FastAPI Instrumentation

```python
# backend/instrumentation.py
from opentelemetry import trace, metrics
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor

def setup_tracing():
    """Configure distributed tracing"""
    jaeger_exporter = JaegerExporter(
        agent_host_name=os.getenv("JAEGER_HOST", "localhost"),
        agent_port=int(os.getenv("JAEGER_PORT", 6831)),
    )
    
    trace.set_tracer_provider(TracerProvider())
    trace.get_tracer_provider().add_span_processor(
        BatchSpanProcessor(jaeger_exporter)
    )
    
    # Instrument libraries
    FastAPIInstrumentor.instrument_app(app)
    SQLAlchemyInstrumentor().instrument(engine=engine)
    RedisInstrumentor().instrument(client=redis_client)

# Call in main.py
setup_tracing()
```

---

## Error Tracking with Sentry

### Installation

```bash
pip install sentry-sdk[fastapi,sqlalchemy]
```

### FastAPI Integration

```python
# backend/main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    integrations=[
        FastApiIntegration(),
        SqlalchemyIntegration(),
    ],
    traces_sample_rate=0.1,
    environment=os.getenv("ENVIRONMENT", "development"),
    release=os.getenv("RELEASE_VERSION", "0.1.0"),
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch and report all exceptions to Sentry"""
    sentry_sdk.capture_exception(exc)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error"}
    )
```

---

## Logging with Loki

### Docker Compose Addition

```yaml
loki:
  image: grafana/loki:2.9.0
  ports:
    - "3100:3100"
  volumes:
    - ./monitoring/loki-config.yml:/etc/loki/local-config.yaml
    - loki_storage:/loki

promtail:
  image: grafana/promtail:2.9.0
  volumes:
    - /var/log:/var/log
    - ./monitoring/promtail-config.yml:/etc/promtail/config.yml
  command: -config.file=/etc/promtail/config.yml
  depends_on:
    - loki
```

### loki-config.yml

```yaml
auth_enabled: false

ingester:
  chunk_idle_period: 3m
  max_chunk_age: 1h
  max_streams_matcher_size: 10

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

schema_config:
  configs:
    - from: 2024-01-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

server:
  http_listen_port: 3100
  log_level: info
```

---

## SLOs & Error Budgets

### Service Level Objectives

```yaml
# monitoring/slos.yml
services:
  - name: api
    slos:
      # Availability: 99.9% uptime
      - name: availability
        target: 0.999
        window: 30d
        indicator: |
          sum(rate(http_requests_total{status!~"5.."}[5m]))
          /
          sum(rate(http_requests_total[5m]))

      # Latency: 95th percentile < 1s
      - name: latency
        target: 0.95
        window: 30d
        indicator: |
          histogram_quantile(0.95,
            rate(http_request_duration_seconds_bucket[5m])
          ) < 1.0

      # Error rate: < 0.1%
      - name: error_rate
        target: 0.999
        window: 30d
        indicator: |
          sum(rate(http_requests_total{status=~"5.."}[5m]))
          /
          sum(rate(http_requests_total[5m]))
          < 0.001
```

### Error Budget Tracking

```python
# Calculate error budget remaining
target_availability = 0.999  # 99.9%
window_hours = 30 * 24  # 30 days

# Allowed downtime
allowed_downtime = (1 - target_availability) * window_hours
# Result: 43.2 minutes per month

# Current usage
actual_downtime = 5  # minutes used
remaining_budget = allowed_downtime - actual_downtime
# Result: 38.2 minutes remaining

# Burn rate
burn_rate = actual_downtime / (window_hours / 24)
# If burn rate > 1.0, we're failing SLO
```

---

## Operational Procedures

### Incident Response

1. **Alert Triggers**
   - Critical: Page on-call engineer immediately
   - Warning: Create incident in system
   - Info: Log for review

2. **Response Steps**
   ```
   Detection → Triage → Mitigation → Recovery → Post-Mortem
   ```

3. **Escalation**
   - T+5 min: Page engineering lead if unresolved
   - T+15 min: Page platform team
   - T+30 min: Page CTO

### Runbooks

```markdown
## High Error Rate Response

**Symptoms**: Error rate > 5%

**Quick Checks**:
1. Check recent deployments
2. Review error logs in Loki
3. Check database connections
4. Review API metrics in Grafana

**Mitigation**:
- Roll back recent deployment
- Increase FastAPI worker count
- Clear Redis cache
- Scale database connections

**Resolution**:
1. Identify root cause from traces
2. Fix code/config
3. Deploy fix
4. Monitor for 15 minutes
5. Create post-mortem
```

---

## Monitoring Checklist

- [ ] Prometheus scraping all endpoints
- [ ] Grafana dashboards showing key metrics
- [ ] Alerting rules configured
- [ ] Alert routing to correct teams
- [ ] Distributed tracing working
- [ ] Error tracking capturing issues
- [ ] Log aggregation operational
- [ ] SLOs defined and tracking
- [ ] On-call rotations configured
- [ ] Runbooks documented

---

Last Updated: April 12, 2026
Version: 1.0
