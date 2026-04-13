# Monitoring Stack Setup Guide

This guide covers deploying and using the enterprise monitoring stack for Lux-Auto.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Services                               │
├─────────────────────────────────────────────────────────────┤
│ Backend API (FastAPI)     PostgreSQL      Redis Cache       │
│     │                         │               │             │
│     └─────────────────────┬───┴───────────────┴─────────────┘
│                           │
│                    ┌──────▼───────┐
│                    │  Prometheus  │  (metrics collection)
│                    └──────┬────────┘
│                          │
│         ┌────────────────┼────────────────┐
│         │                │                │
│    ┌────▼──────┐   ┌─────▼──────┐   ┌───▼────────┐
│    │ AlertMgr  │   │  Grafana   │   │ Prometheus │
│    │           │   │            │   │   (Web UI) │
│    └──────┬─────┘   └────────────┘   └────────────┘
│           │
│    ┌──────▼───────────┬─────────────┐
│    │                  │             │
│  Slack            PagerDuty      Teams
│ (#alerts)      (on-call team)  (notifications)
```

## Quick Start

### 1. Prerequisites

- Docker and Docker Compose installed
- Environment variables configured
- Backend API running and exposing `/metrics` endpoint

### 2. Deploy Monitoring Stack

```bash
# Navigate to monitoring directory
cd monitoring

# Set environment variables for AlertManager
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
export PAGERDUTY_SERVICE_KEY="YOUR_PAGERDUTY_KEY"

# Start all services
docker-compose -f docker-compose.monitoring.yml up -d

# Verify services are running
docker-compose -f docker-compose.monitoring.yml ps
```

### 3. Access Monitoring UIs

- **Prometheus**: https://lux.kushnir.cloud/monitoring/prometheus
- **AlertManager**: https://lux.kushnir.cloud/monitoring/alertmanager
- **Grafana**: https://lux.kushnir.cloud (default: admin/admin)

### 4. Verify Data Collection

Check Prometheus targets:
1. Go to https://lux.kushnir.cloud/monitoring/prometheus/targets
2. Verify all endpoints show "UP" (may take 30-60 seconds)
3. If any show "DOWN", check logs: `docker-compose logs prometheus`

## Service Configuration

### Prometheus (`prometheus/prometheus.yml`)

**Scrape Jobs Configured:**
- `prometheus` - Prometheus itself
- `backend-api` - Your FastAPI application
- `postgres` - PostgreSQL database (via postgres_exporter)
- `redis` - Redis cache (via redis_exporter)
- `docker` - Container metrics (via cAdvisor)
- `node-exporter` - System metrics

**Key Settings:**
- **Scrape Interval**: 15 seconds (configurable)
- **Evaluation Interval**: 15 seconds (for alert rules)
- **Retention**: 15 days (change in `docker-compose.monitoring.yml`)
- **Alert Rules File**: `prometheus/alert_rules.yml`

### AlertManager (`alertmanager/config.yml`)

**Alert Routes:**
- **Critical** → PagerDuty (immediate escalation)
- **Warning** → Slack #alerts (grouped, 30s wait)
- **Info** → Slack #general (silent resolution)

**Requires Environment Variables:**
```bash
SLACK_WEBHOOK_URL       # Slack incoming webhook URL
PAGERDUTY_SERVICE_KEY   # PagerDuty integration key
```

### Grafana

**Available After First Login:**
- Default credentials: `admin / admin`
- Data source: Prometheus (pre-configured)
- Dashboards can be imported from Grafana.com or created manually

**Create Custom Dashboard:**
1. Login to https://lux.kushnir.cloud
2. Click "+" → "Dashboard" → "New dashboard"
3. Add panels with PromQL queries
4. Example query: `rate(http_requests_total[5m])`

## Alerting Rules (`prometheus/alert_rules.yml`)

### Active Alerts

**HighErrorRate** (Critical)
- Triggers when error rate > 5% over 5 minutes
- Alert conditions monitored per service
- Routes to PagerDuty for immediate response

**HighLatency** (Warning)
- Triggers when p95 latency > 1000ms
- Indicates performance degradation
- Routes to Slack #alerts

**HighDatabaseConnections** (Warning)
- Triggers when connection pool usage > 80%
- May indicate resource exhaustion or leaked connections
- Monitor via PostgreSQL metrics

**OAuthFailureRate** (Critical)
- Triggers when OAuth authentication fails > 1%
- Authentication issues affect all users
- Routes to PagerDuty immediately

## Monitoring Backend API

### Required Instrumentation

Backend must expose Prometheus metrics at `/metrics` endpoint:

```python
# In backend/main.py
from prometheus_client import Counter, Histogram, Gauge
from prometheus_client import REGISTRY
from fastapi import FastAPI
from fastapi.responses import Response

app = FastAPI()

# Metrics
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_DURATION = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint']
)

@app.get('/metrics')
async def metrics():
    """Prometheus metrics endpoint"""
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    return Response(generate_latest(REGISTRY), media_type=CONTENT_TYPE_LATEST)

# Use in route handlers
@app.get('/deals')
async def get_deals():
    REQUEST_COUNT.labels(method='GET', endpoint='/deals', status=200).inc()
    # ... handler code
```

## Common Tasks

### View Real-Time Metrics

**Prometheus Query Interface**
1. Go to https://lux.kushnir.cloud/monitoring/prometheus
2. Search metrics panel
3. Examples:
   - `up` - Service up/down status
   - `http_requests_total` - Total requests
   - `http_request_duration_seconds` - Request latency
   - `pg_stat_activity_count` - Active DB connections

### Check Alert Status

```bash
# Get all alerts
curl https://lux.kushnir.cloud/monitoring/prometheus/api/v1/alerts

# Get specific alert rules
curl https://lux.kushnir.cloud/monitoring/prometheus/api/v1/rules

# Get alert group status
curl https://lux.kushnir.cloud/monitoring/alertmanager/api/v1/alerts
```

### Test AlertManager

```bash
# Send test alert
curl -X POST https://lux.kushnir.cloud/monitoring/alertmanager/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {
      "alertname": "TestAlert",
      "severity": "critical"
    },
    "annotations": {
      "summary": "This is a test alert",
      "description": "Test alert from monitoring stack"
    }
  }]'
```

### View Logs

```bash
# Prometheus logs
docker-compose logs -f prometheus

# AlertManager logs
docker-compose logs -f alertmanager

# Grafana logs
docker-compose logs -f grafana

# All services
docker-compose logs -f
```

### Scale Retention Period

Edit `docker-compose.monitoring.yml`:

```yaml
prometheus:
  command:
    - "--storage.tsdb.retention.time=30d"  # Change from 15d to 30d
```

Then restart:
```bash
docker-compose restart prometheus
```

## Production Deployment

### High Availability Setup

For production, consider:

1. **Multiple Prometheus Instances**
   - Federated Prometheus servers
   - Remote storage backend (Thanos, Cortex)
   - High availability architecture

2. **AlertManager Clustering**
   - Multiple AlertManager instances
   - Gossip protocol for state synchronization
   - Prevents duplicate alerts

3. **Persistent Storage**
   - Use cloud storage (S3, GCS)
   - Configure remote_write in prometheus.yml
   - Enable long-term retention

4. **Grafana Clustering**
   - Multiple Grafana instances
   - External database (PostgreSQL)
   - Load balancer in front

### Security Considerations

1. **Change Grafana Default Credentials**
   ```bash
   export GF_SECURITY_ADMIN_PASSWORD="strong-password"
   ```

2. **Restrict Network Access**
   ```yaml
   ports:
     - "127.0.0.1:9090:9090"  # Only localhost
   ```

3. **Enable Authentication**
   ```yaml
   environment:
     GF_AUTH_ENABLED: "true"
     GF_AUTH_BASIC_ENABLED: "true"
   ```

4. **Use Secrets Management**
   - Store webhook URLs in secrets manager
   - Use environment variable references
   - Never commit credentials to git

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs

# Verify network
docker network ls
docker network inspect lux-auto_monitoring

# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Prometheus Targets Down

1. Check service is running: `docker-compose ps`
2. Verify network connectivity: `docker exec prometheus ping backend`
3. Check firewall rules: `netstat -an | grep 9090`
4. Inspect logs: `docker-compose logs prometheus`

### No Metrics Data

1. Verify `/metrics` endpoint exists
2. Test endpoint: `curl https://lux.kushnir.cloud/metrics`
3. Check Prometheus scrape config
4. Wait 60+ seconds for data to appear

### AlertManager Can't Send Alerts

1. Verify Slack webhook URL: `echo $SLACK_WEBHOOK_URL`
2. Test webhook: 
   ```bash
   curl -X POST $SLACK_WEBHOOK_URL \
     -H "Content-Type: application/json" \
     -d '{"text":"Test message"}'
   ```
3. Check AlertManager logs: `docker-compose logs alertmanager`
4. Verify alert route configuration

## Next Steps

1. **Create Custom Dashboards**
   - Import from Grafana.com or create custom panels
   - Visualize SLO metrics
   - Setup dashboard sharing

2. **Configure Runbook Links**
   - Add `runbook_url` to alert annotations
   - Link to incident response procedures
   - Reference docs/runbooks/ guides

3. **Implement Custom Metrics**
   - Add business-level metrics
   - Track feature usage
   - Monitor deployment status

4. **Set Up Record Rules**
   - Pre-calculate expensive queries
   - Improve dashboard performance
   - Add to prometheus/prometheus.yml:
     ```yaml
     rule_files:
       - '/etc/prometheus/record_rules.yml'
     ```

## Related Documentation

- [docs/SLOs.md](../SLOs.md) - Service Level Objectives
- [docs/runbooks/README.md](../runbooks/README.md) - Incident Response
- [prometheus/alert_rules.yml](./prometheus/alert_rules.yml) - Alert Definitions
- [docs/ENFORCEMENT.md](../ENFORCEMENT.md) - Standards Enforcement
