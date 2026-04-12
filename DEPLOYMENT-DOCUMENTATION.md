# Lux-Auto Portal: Complete Documentation

## Table of Contents

1. [API Documentation](#api-documentation)
2. [Deployment Guide](#deployment-guide)
3. [Operational Runbooks](#operational-runbooks)
4. [Troubleshooting Guide](#troubleshooting-guide)
5. [Architecture Overview](#architecture-overview)

---

## API Documentation

### Authentication

All API endpoints (except `/health` and `/metrics`) require OAuth2 bearer token authentication.

```bash
# Get token via OAuth proxy
curl -H "Authorization: $TOKEN" https://api.example.com/api/v2/deals
```

### Core Endpoints

#### Deal Management

**List Deals**
```http
GET /api/v2/deals
Authorization: Bearer {token}

Query Parameters:
  - status: scanning|scored|matched|bidding|won|closed
  - buyer_id: integer (optional)
  - min_score: float 0-100 (optional)
  - max_score: float 0-100 (optional)
  - skip: integer ≥0 (default: 0)
  - limit: integer 1-100 (default: 50)

Response:
{
  "deals": [
    {
      "deal_id": 1001,
      "vehicle_make": "Toyota",
      "vehicle_model": "Camry",
      "vehicle_year": 2020,
      "vehicle_mileage": 45000,
      "deal_score": 87.5,
      "status": "matched",
      "estimated_price": 18500,
      "created_at": "2024-01-15T10:30:00Z",
      "approved_by": "admin@example.com"
    }
  ],
  "total": 1250,
  "skip": 0,
  "limit": 50
}
```

**Create Deal**
```http
POST /api/v2/deals
Authorization: Bearer {token}
Content-Type: application/json

{
  "vehicle_make": "Honda",
  "vehicle_model": "Civic",
  "vehicle_year": 2021,
  "vehicle_mileage": 30000,
  "vehicle_condition": "excellent|good|fair|poor",
  "buyer_name": "Metro Auto Group",
  "buyer_email": "buyer@metro.local",
  "buyer_location": "New York, NY",
  "estimated_price": 20000,
  "notes": "Clean title, one owner"
}

Response: 201 Created
{
  "deal_id": 1002,
  "status": "scanning",
  "created_at": "2024-01-15T11:00:00Z"
}
```

**Get Deal Details**
```http
GET /api/v2/deals/{deal_id}
Authorization: Bearer {token}

Response: 200 OK
{
  "deal_id": 1001,
  "vehicle_make": "Toyota",
  "vehicle_model": "Camry",
  "vehicle_year": 2020,
  "vehicle_mileage": 45000,
  "deal_score": 87.5,
  "status": "matched",
  "estimated_price": 18500,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T11:45:00Z",
  "approved_by": "admin@example.com",
  "matched_buyers": 5,
  "history": [
    {
      "status": "scanning",
      "timestamp": "2024-01-15T10:30:00Z"
    },
    {
      "status": "scored",
      "timestamp": "2024-01-15T10:35:00Z",
      "score": 87.5
    }
  ]
}
```

**Update Deal Status**
```http
PATCH /api/v2/deals/{deal_id}/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "bidding|won|closed"
}

Response: 200 OK
{
  "deal_id": 1001,
  "status": "bidding",
  "updated_at": "2024-01-15T12:00:00Z"
}
```

**Approve Deal**
```http
POST /api/v2/deals/{deal_id}/approve
Authorization: Bearer {token}
Content-Type: application/json

{
  "approved_by_notes": "Meets all criteria"
}

Response: 200 OK
{
  "deal_id": 1001,
  "status": "approved",
  "approved_at": "2024-01-15T12:00:00Z"
}
```

#### Analytics

**Deal Summary Statistics**
```http
GET /api/v2/analytics/deals/summary
Authorization: Bearer {token}

Query Parameters:
  - period: day|week|month|year
  - start_date: ISO8601 (optional)
  - end_date: ISO8601 (optional)

Response: 200 OK
{
  "period": "month",
  "total_deals": 250,
  "deals_won": 180,
  "avg_margin_percent": 12.5,
  "total_revenue": 4500000,
  "win_rate_percent": 72,
  "avg_days_to_close": 4.2,
  "top_make": "Toyota",
  "top_buyer": "Metro Auto Group"
}
```

**Buyer Performance**
```http
GET /api/v2/analytics/buyers/top
Authorization: Bearer {token}

Query Parameters:
  - limit: 1-50 (default: 10)
  - metric: deals|revenue|margin (default: deals)

Response: 200 OK
{
  "buyers": [
    {
      "buyer_id": 1001,
      "name": "Metro Auto Group",
      "deals_count": 145,
      "total_revenue": 2100000,
      "avg_margin": 13.2,
      "win_rate": 92
    }
  ]
}
```

#### Real-Time Updates (WebSocket)

**Subscribe to All Deal Updates**
```
WebSocket wss://api.example.com/ws/deals
Authorization: Bearer {token}

Message Types:
- deal_created: New deal added
- deal_scored: Deal received score
- deal_status_changed: Status update
- deal_approved: Deal approved
- deal_rejected: Deal rejected
- deal_matched: Buyers matched

Example Message:
{
  "type": "deal_scored",
  "deal_id": 1001,
  "score": 87.5,
  "timestamp": "2024-01-15T10:35:00Z"
}
```

---

## Deployment Guide

### Prerequisites

- Docker & Docker Compose 20.10+
- PostgreSQL 16 (or use Docker image)
- Redis 7.0+ (or use Docker image)
- Python 3.11+
- Caddy reverse proxy
- Google OAuth credentials
- SSL certificates

### Environment Setup

1. **Clone Repository**
```bash
git clone https://github.com/yourorg/lux-auto.git
cd lux-auto
```

2. **Create Environment Files**
```bash
# Copy example to actual
cp .env.example .env

# Fill in secrets
# GOOGLE_CLIENT_ID
# GOOGLE_CLIENT_SECRET
# DB_PASSWORD
# REDIS_PASSWORD
# SESSION_SECRET
```

3. **Generate SSL Certificates**
```bash
# For development
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365

# For production with Let's Encrypt via Caddy (automatic)
# Just enable auto_https in Caddyfile
```

### Docker Deployment

**Start All Services**
```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Check logs
docker-compose logs -f fastapi
docker-compose logs -f postgres
```

**Verify Deployment**
```bash
# Check health
curl https://api.example.com/health

# Should return:
{
  "status": "healthy",
  "timestamp": "2024-01-15T12:00:00Z",
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "api_response_time": "healthy: 0.150s"
  }
}
```

### Initial Configuration

1. **Database Migrations**
```bash
# Already handled by docker-compose (init-db.sql + portal-schema.sql)
# To manually run:
docker-compose exec postgres psql -U lux_admin -d lux_prod -f scripts/init-db.sql
docker-compose exec postgres psql -U lux_admin -d lux_prod -f scripts/portal-schema.sql
```

2. **Create Admin User**
```bash
docker-compose exec fastapi python << 'EOF'
from backend.auth.user_service import UserService
from backend.main import get_db

service = UserService(next(get_db()))
service.create_admin_user(
    email="admin@company.com",
    name="Admin User"
)
EOF
```

3. **Setup Appsmith**
```bash
# Access Appsmith at http://localhost:8080
# 1. Create admin account
# 2. Add PostgreSQL datasource (lux_prod_portal)
# 3. Import provided app templates
# 4. Configure deal pipeline dashboard
# 5. Configure buyer management interface
# 6. Configure analytics dashboard
```

4. **Setup Backstage**
```bash
# Access Backstage at http://localhost:3000
# 1. Link GitHub organization
# 2. Import service catalog
# 3. Configure TechDocs
# 4. Setup monitoring integrations
```

### Scaling Considerations

**Horizontal Scaling**
```yaml
# docker-compose.yml - scale FastAPI
services:
  fastapi:
    deploy:
      replicas: 3  # Run 3 instances
      
  caddy:
    # Already load balances across replicas
```

**Database Optimization**
```sql
-- Connection pooling (via docker-compose env)
# DB_POOL_SIZE=20
# DB_POOL_RECYCLE=3600

-- Indexes for performance
CREATE INDEX idx_active_deals ON deals(status) 
  WHERE status IN ('new', 'scoring', 'matched');
CREATE INDEX idx_deal_score ON deals(deal_score DESC) 
  WHERE deal_score > 0;
```

**Redis Caching**
```bash
# Configure max memory policy
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET maxmemory 2gb
```

---

## Operational Runbooks

### Scenario 1: High Error Rate Alert

**Problem**: Error rate exceeds 5% threshold

**Diagnosis**
```bash
# Check recent error logs
docker-compose logs fastapi | grep ERROR | tail -20

# Check database health
docker-compose exec postgres pg_isready

# Check Redis connectivity
docker-compose exec cache redis-cli ping

# Check API response time
curl -w "@curl-format.txt" https://api.example.com/health
```

**Resolution**

1. **If Database Issue**
   ```bash
   # Restart database
   docker-compose restart postgres
   
   # Or if corrupted
   docker-compose exec postgres pg_dump -Fc > backup.dump
   docker-compose down
   # Fix storage issue
   docker-compose up -d postgres
   ```

2. **If Memory Issue**
   ```bash
   # Check container memory
   docker stats fastapi
   
   # Increase if needed
   # Edit docker-compose.yml:
   #   deploy:
   #     resources:
   #       limits:
   #         memory: 4G
   ```

3. **If Cache Issue**
   ```bash
   # Flush Redis and restart
   docker-compose exec cache redis-cli FLUSHALL
   docker-compose restart cache
   ```

### Scenario 2: Deal Processing Backlog

**Problem**: Bulk deal operation taking too long

**Symptoms**
```bash
# Check ongoing batch jobs
curl https://api.example.com/api/v2/batch/active

# Monitor FastAPI queue depth
docker-compose logs fastapi | grep "queue_size"
```

**Resolution**

1. **Increase Worker Threads**
   ```python
   # In backend/main.py
   app = FastAPI(
       # ... other config
   )
   
   # Use UvicornSettings with more workers
   # workers=4 → workers=8
   ```

2. **Check Database Connections**
   ```bash
   # If pool exhausted
   docker-compose exec postgres psql -U lux_admin -d lux_prod << 'SQL'
   SELECT count(*) FROM pg_stat_activity;
   SQL
   
   # Increase pool
   # In docker-compose.yml: DB_POOL_SIZE=50
   ```

3. **Break Large Batches**
   ```bash
   # Max 100 deals per request, not 1000
   curl -X POST https://api.example.com/api/v2/deals/bulk/approve \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"deal_ids": [1,2,3,...100]}'  # Max 100
   ```

### Scenario 3: WebSocket Connection Leak

**Problem**: WebSocket connections accumulate over time

**Diagnosis**
```bash
# Check active connections
curl https://api.example.com/metrics | grep websocket_connections_active

# Monitor if climbs indefinitely
watch 'curl -s https://api.example.com/metrics | grep websocket'
```

**Resolution**

1. **Check for abandoned client connections**
   ```python
   # In backend/routers/websocket.py
   # Add connection timeout
   if websocket not in active_connections:
       # Client disconnected
       return
   ```

2. **Implement ping/pong heartbeat**
   ```python
   # Send heartbeat every 30 seconds
   async def heartbeat_loop():
       while True:
           await asyncio.sleep(30)
           for connection in active_connections:
               await connection.send_json({"type": "ping"})
   ```

3. **Force cleanup**
   ```bash
   # Restart WebSocket service
   docker-compose restart fastapi
   # Reconn ect client
   ```

### Scenario 4: Database Replication Lag

**Problem**: Read replicas falling behind writes

**Diagnosis**
```bash
# Check replication lag
docker-compose exec postgres psql -U lux_admin -d lux_prod << 'SQL'
SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;
SQL

# Expected: < 10 seconds
# Warning: > 1 minute
# Critical: > 5 minutes
```

**Resolution**

1. **Increase WAL buffer**
   ```bash
   # In postgresql.conf
   shared_buffers = 512MB  # Increase from 128MB
   wal_buffers = 16MB      # Increase from 4MB
   ```

2. **Scale read replicas**
   ```yaml
   # docker-compose.yml
   postgres-replica-1:
     image: postgres:16-alpine
     environment:
       PGDATA: /var/lib/postgresql/data/replica
     depends_on:
       postgres:
         condition: service_healthy
   ```

3. **Temporarily decrease write load**
   ```bash
   # Rate limit bulk imports
   # POSTing deals: 100/minute → 50/minute
   # In backend/security.py: RateLimitConfig
   ```

### Scenario 5: SSL Certificate Renewal Failure

**Problem**: Certificate expiring soon or renewal failed

**Resolution**

```bash
# Check cert expiration
openssl s_client -connect api.example.com:443 -dates

# Force renewal (Caddy auto-renews)
docker-compose restart caddy

# If manual cert:
certbot renew --force-renewal
docker-compose exec caddy caddy reload
```

---

## Troubleshooting Guide

### Common Issues

| Issue | Symptoms | Fix |
|-------|----------|-----|
| **OAuth not working** | 401 Unauthorized on all endpoints | Check GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET in .env |
| **Deals not scoring** | Status stays "scanning" | Check `backend/routers/deals.py` scoring logic |
| **Slow list queries** | `/api/v2/deals` takes > 2s | Add database indexes from `backend/caching.py:INDEX_RECOMMENDATIONS` |
| **WebSocket disconnect** | Clients drop after 10min | Increase nginx proxy_read_timeout to 1h |
| **Out of memory** | Container OOMKilled | Increase in docker-compose.yml: memory: 4G |
| **Redis keys growing** | Cache memory increasing | Implement key expiration: `redis-cli EXPIRE key 3600` |

### Check Logs

```bash
# FastAPI exceptions
docker-compose logs fastapi | grep -i exception

# Database errors
docker-compose logs postgres | grep ERROR

# Redis issues
docker-compose logs cache | grep -i error

# All errors in last hour
docker-compose logs fastapi --since 1h | grep ERROR
```

### Performance Troubleshooting

```bash
# Find slow queries (> 1 second)
docker-compose exec postgres psql -U lux_admin -d lux_prod << 'SQL'
SELECT query, mean_exec_time, max_exec_time 
FROM pg_stat_statements 
WHERE mean_exec_time > 1000 
ORDER BY mean_exec_time DESC;
SQL

# Check index usage
SELECT schemaname, tablename FROM pg_tables 
WHERE schemaname NOT IN ('pg_catalog', 'information_schema');
```

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│  (Browser, Mobile, Appsmith Portal, Backstage Catalog)      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                   HTTPS/TLS Layer                            │
│  (Caddy Reverse Proxy - Auto SSL w/ Let's Encrypt)          │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│          OAuth2 Authentication Layer                         │
│  (oauth2-proxy - Google OAuth flow enforcement)             │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│         FastAPI Application Layer (Python 3.11+)            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Routers:                                               │ │
│  │ - /api/v2/deals (CRUD + bulk ops)                     │ │
│  │ - /api/v2/analytics (metrics & reporting)            │ │
│  │ - /api/v2/audit (compliance logging)                 │ │
│  │ - /ws/deals (WebSocket real-time)                    │ │
│  │ - /api/v2/advanced (AI scoring, routing)             │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ Services Layer:                                        │ │
│  │ - RBAC permission checking                            │ │
│  │ - Request validation & sanitization                   │ │
│  │ - Audit event logging                                 │ │
│  │ - Cache management                                    │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────┬──────────────────────────────────────────────────┘
           │
    ┌──────┴──────┬──────────────┬───────────────┐
    │             │              │               │
┌───▼────┐   ┌───▼───┐   ┌─────▼────┐    ┌────▼───┐
│PostgreSQL  │ Redis  │   │Appsmith  │    │Backstage│
│ (lux_prod) │(cache) │   │(portal)  │    │(catalog)│
└──────────┘ └────────┘   └──────────┘    └─────────┘

Database: PostgreSQL 16
  - Main application DB (lux_prod)
  - Appsmith DB (appsmith_db)
  - Backstage DB (backstage_db)
  
Cache: Redis 7
  - Session storage
  - Query result caching
  - WebSocket pub/sub
  - Rate limiting
  
Portal: Appsmith v3+
  - Deal pipeline Kanban
  - Buyer management
  - Analytics dashboards
  - Admin panel
  
Catalog: Backstage 1.13+
  - Service catalog
  - TechDocs
  - Operational tools
```

### Data Flow

1. **Create Deal**
   ```
   Client → Caddy → oauth2-proxy → FastAPI → RBAC check → 
   → Database insert → Audit log → Cache invalidate → WebSocket notify
   ```

2. **List Deals with Filtering**
   ```
   Client → Cache check → 
   [HIT] Return cached → Client
   [MISS] → Database query with indexes → Cache store → Return → Client
   ```

3. **Real-time Update**
   ```
   Admin approves deal → FastAPI → Database update → 
   → Redis pub/sub event → WebSocket broadcast → Client updates UI
   ```

### SLA & Performance Targets

- **Uptime**: 99.9% (9 hours downtime/month)
- **Deal Creation**: < 500ms
- **Deal List (50 items)**: < 500ms (cached)
- **Analytics**: < 2 seconds
- **WebSocket latency**: < 100ms
- **Error rate**: < 1%

---

**Last Updated**: 2024-01-15
**Version**: 1.0
**Contact**: devops@company.com

