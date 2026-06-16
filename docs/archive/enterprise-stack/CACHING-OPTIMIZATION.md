# Caching & Query Optimization Guide

## Caching Strategy

Effective caching improves performance and reduces database load.

---

## Redis Caching Configuration

### Cache Layer Architecture

```
┌──────────────┐
│   Client     │
│ (Appsmith)   │
└──────┬───────┘
       │
┌──────────────────────────────────┐
│    Application Cache Layer       │
│  (Redis)                         │
│  - 5-15 min TTL for lists        │
│  - 30-60 min TTL for analytics   │
│  - 1 hour TTL for configs        │
└──────┬───────────────────────────┘
       │ (Cache miss)
┌──────────────────────────────────┐
│    Database Query Layer          │
│  (PostgreSQL)                    │
│  - Indexes on hot columns        │
│  - Query optimization            │
└──────────────────────────────────┘
```

### Redis Configuration

```yaml
# In docker-compose.yml
redis:
  image: redis:7-alpine
  command: >
    redis-server
    --appendonly yes
    --max-memory 2gb
    --maxmemory-policy allkeys-lru
    --requirepass ${REDIS_PASSWORD}
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
```

### Cache TTLs by Data Type

| Data Type | TTL | Use Case |
|-----------|-----|----------|
| Deals List | 5 min | Frequently accessed, changes often |
| Buyers List | 10 min | Less frequent changes |
| Analytics Metrics | 30 min | Aggregations can be stale |
| User Roles/Permissions | 1 hour | Changes rarely, can tolerate staleness |
| System Config | 24 hours | Static data, very infrequent changes |
| API Responses | 5-15 min | Dynamic content |

### Cache Key Naming Convention

```python
# Standard format: namespace:resource:identifier:variant
# Examples:
deals:list:all:approved          # All approved deals
deals:list:status:new:page:1     # Page 1 of new deals
buyers:list:region:northeast     # Northeastern buyers
analytics:metrics:deals:monthly   # Monthly deal metrics
user:roles:akushnir@bio.com      # User roles/permissions
config:system:api_rate_limit     # System config
```

### Cache Warming

Pre-load frequently accessed data:

```python
# backend/tasks/cache_warming.py
from celery import shared_task
from backend.caching import cache

@shared_task
def warm_cache():
    """Pre-load hot data into cache"""
    # Warm deals cache
    deals = Deals.query.filter_by(status='approved').all()
    cache.set('deals:list:approved', deals, ttl=300)
    
    # Warm buyers cache
    buyers = Buyers.query.all()
    cache.set('buyers:list:all', buyers, ttl=600)
    
    # Warm analytics cache
    metrics = calculate_monthly_metrics()
    cache.set('analytics:metrics:monthly', metrics, ttl=1800)
    
    logger.info("Cache warming completed")

# Schedule in background
from celery.schedules import crontab
CELERY_BEAT_SCHEDULE = {
    'warm-cache-every-5-mins': {
        'task': 'backend.tasks.cache_warming.warm_cache',
        'schedule': crontab(minute='*/5'),
    },
}
```

### Cache Invalidation

Invalidate caches when data changes:

```python
# backend/handlers/cache_invalidation.py
from backend.caching import cache

def on_deal_updated(deal):
    """Invalidate related caches when deal is updated"""
    # Invalidate specific deal
    cache.delete(f'deals:detail:{deal.id}')
    
    # Invalidate list caches
    cache.delete('deals:list:all')
    cache.delete(f'deals:list:status:{deal.status}')
    
    # Invalidate analytics (stale deals data)
    cache.delete('analytics:metrics:*', pattern=True)

def on_buyer_created(buyer):
    """Invalidate buyer caches"""
    cache.delete('buyers:list:all')
    cache.delete(f'buyers:list:region:{buyer.region}')
    
    # Recalculate analytics
    cache.delete('analytics:metrics:*', pattern=True)
```

---

## Database Query Optimization

### Index Strategy

Critical indexes for Lux-Auto:

```sql
-- Deals table indexes
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_status_created ON deals(status, created_at DESC);
CREATE INDEX idx_deals_make_model ON deals(make, model);
CREATE INDEX idx_deals_created_at ON deals(created_at DESC);
CREATE INDEX idx_deals_vin ON deals(vin);  -- Unique constraint
CREATE INDEX idx_deals_margin ON deals(estimated_profit_margin);

-- Buyers table indexes
CREATE INDEX idx_buyers_status ON buyers(status);
CREATE INDEX idx_buyers_region ON buyers(region);
CREATE INDEX idx_buyers_match_score ON buyers(match_score DESC);
CREATE INDEX idx_buyers_email ON buyers(email);
CREATE INDEX idx_buyers_created_at ON buyers(created_at DESC);

-- Audit logs table indexes
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);

-- User preferences table indexes
CREATE INDEX idx_user_preferences_pref_key ON user_preferences(preference_key);

-- API keys table indexes
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);
```

### Query Optimization Examples

Bad ❌ vs Good ✅:

```python
# ❌ BAD: N+1 Query Problem
deals = session.query(Deals).all()
for deal in deals:
    print(deal.buyer.name)  # Separate query for each deal!

# ✅ GOOD: Use join to fetch in single query
deals = session.query(Deals).join(Buyers).options(
    joinedload(Deals.buyer)
).all()

# ❌ BAD: Full table scan with multiple filters
deals = session.query(Deals).filter(
    Deals.status == 'approved',
    Deals.created_at > datetime.now() - timedelta(days=30)
).all()  # Uses index on status only

# ✅ GOOD: Combined index for multiple filters
deals = session.query(Deals).filter(
    Deals.status == 'approved',
    Deals.created_at > datetime.now() - timedelta(days=30)
).options(
    selectinload(Deals.audit_logs)
).all()  # Uses better index

# ❌ BAD: Aggregate without proper indexing
result = session.query(
    func.avg(Deals.estimated_profit_margin),
    func.count(Deals.id)
).filter(Deals.status == 'approved').all()
# Slow: full scan of approved deals

# ✅ GOOD: Aggregate with pre-calculated views or cache
# OR use materialized view for common aggregates
SELECT * FROM deals_approved_metrics;  -- Pre-calculated
```

### Query Performance Analysis

```sql
-- Find slow queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_statements
WHERE mean_time > 1000  -- Queries taking >1 second
ORDER BY mean_time DESC
LIMIT 20;

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Find unused indexes
SELECT 
    schemaname,
    tablename,
    indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- Find sequential scans (slow)
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    ROUND(seq_scan * 100.0 / (seq_scan + idx_scan), 2) AS seq_percent
FROM pg_stat_user_tables
WHERE idx_scan > 0
ORDER BY seq_percent DESC;
```

---

## Appsmith Query Caching

### Enable Query Caching

In Appsmith datasources:

1. **Open Query Editor**
2. **Advanced Settings** tab
3. Enable **Cache Response**
4. Set **TTL (seconds)**:
   - Lists: 300-900 (5-15 min)
   - Analytics: 1800-3600 (30-60 min)
   - Reference data: 3600+ (1+ hour)

### Cache Configuration Examples

```json
{
  "dealsQuery": {
    "cache": {
      "enabled": true,
      "ttl": 300,  // 5 minutes
      "invalidateOn": ["createDealMutation", "updateDealMutation"],
      "key": "deals:list:{{ statusFilter.value }}"
    }
  },
  "analyticsQuery": {
    "cache": {
      "enabled": true,
      "ttl": 1800,  // 30 minutes
      "invalidateOn": [],  // Stale data acceptable
      "key": "analytics:{{ dateRange.start }}-{{ dateRange.end }}"
    }
  },
  "configQuery": {
    "cache": {
      "enabled": true,
      "ttl": 86400,  // 1 day
      "invalidateOn": ["updateSettingsMutation"],
      "key": "config:system"
    }
  }
}
```

### Manual Cache Management

```javascript
// Clear specific cache
{{ dealsQuery.clearCache() }}

// Clear all caches
{{ appsmith.getAllWigets().forEach(w => w.clearCache && w.clearCache()) }}

// Refresh with fresh data
{{ dealsQuery.clearCache(); dealsQuery.trigger() }}

// Cache check
{{ dealsQuery.isCached ? 'Using cached data' : 'Fresh from DB' }}
```

---

## Application-Level Optimizations

### Connection Pooling

```python
# backend/database/__init__.py
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

DATABASE_URL = os.getenv("DATABASE_URL")

# Configure connection pool
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,           # Connections to maintain
    max_overflow=10,        # Extra connections when needed
    pool_recycle=3600,      # Recycle connections hourly
    pool_pre_ping=True,     # Verify connections before use
    echo=False
)
```

### Query Result Pagination

```python
# backend/routers/deals.py
@router.get("/deals")
async def list_deals(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    status: Optional[str] = None
):
    query = session.query(Deals)
    
    if status:
        query = query.filter(Deals.status == status)
    
    total = query.count()
    deals = query.offset((page - 1) * per_page).limit(per_page).all()
    
    return {
        "data": deals,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": (total + per_page - 1) // per_page
        }
    }
```

### Batch Operations

```python
# backend/services/deals.py
from sqlalchemy import insert

def batch_create_deals(deals_data: List[Dict]):
    """Create multiple deals efficiently"""
    stmt = insert(Deals).values(deals_data)
    session.execute(stmt)
    session.commit()
    
# Usage: 100 deals insert in single transaction
batch_create_deals([{...}, {...}, ...])
```

---

## Monitoring Cache Performance

### Cache Metrics

```sql
-- Redis cache statistics
INFO stats

-- Output includes:
-- total_connections_received
-- total_commands_processed
-- instantaneous_ops_per_sec
-- keyspace_hits
-- keyspace_misses

-- Hit rate calculation
hit_rate = keyspace_hits / (keyspace_hits + keyspace_misses) * 100
```

### Expected Hit Rates by Cache Type

| Cache Type | Target Hit Rate |
|-----------|-----------------|
| List caches | 70-80% |
| Lookup/Reference | 85-95% |
| Analytics | 50-70% (can tolerate misses) |
| API responses | 60-75% |

### Monitoring Setup

```json
{
  "metrics": {
    "redis": {
      "metrics": [
        {
          "name": "cache_hit_rate",
          "query": "keyspace_hits / (keyspace_hits + keyspace_misses)",
          "alertOnBelow": 0.70
        },
        {
          "name": "cache_memory_usage",
          "query": "INFO memory | used_memory",
          "alertOnAbove": 1.5e9  // > 1.5GB
        },
        {
          "name": "cache_evictions",
          "query": "INFO stats | evicted_keys",
          "alertOnAbove": 1000
        }
      ]
    },
    "database": {
      "metrics": [
        {
          "name": "slow_query_count",
          "query": "SELECT COUNT(*) FROM pg_stat_statements WHERE mean_time > 1000",
          "alertOnAbove": 5
        },
        {
          "name": "connection_pool_usage",
          "query": "SELECT count(*) FROM pg_stat_activity",
          "alertOnAbove": 18  // out of 20
        }
      ]
    }
  }
}
```

---

## Performance Tuning Checklist

- [ ] **Indexing**: All frequently filtered columns indexed
- [ ] **Caching**: Redis configured with appropriate TTLs
- [ ] **Connection Pool**: Sized appropriately for workload
- [ ] **Query Optimization**: N+1 problems resolved
- [ ] **Pagination**: Large datasets paginated
- [ ] **Appsmith Caching**: Enabled for appropriate queries
- [ ] **Cache Invalidation**: Proper invalidation on mutations
- [ ] **Monitoring**: Cache hit rates and query performance monitored
- [ ] **Load Testing**: Performance validated under load
- [ ] **Documentation**: Cache strategy documented per endpoint

---

## Troubleshooting

### Low Cache Hit Rates

**Problem**: Cache hit rate < 50%

**Causes** and solutions:
1. Check TTL is appropriate
   - Too low? Increase TTL
   - Too high? Can tolerate stale data?
2. Check cache is being used
   - Verify cache enabled in Appsmith
   - Check Redis connection
3. Check invalidation isn't overly aggressive
   - Review cache invalidation logic
   - Ensure only relevant mutations invalidate

### Slow Queries Despite Indexing

**Problem**: Queries still slow despite indexes

**Solutions**:
1. Check index is being used: `EXPLAIN ANALYZE`
2. Update statistics: `ANALYZE table_name;`
3. Check index bloat: `SELECT pg_size_pretty(pg_relation_size('index_name'));`
4. Rebuild if bloated: `REINDEX INDEX index_name;`

### Memory Exhaustion

**Problem**: Redis or database running out of memory

**Solutions**:
1. Reduce cache TTL
2. Implement cache eviction: `maxmemory-policy allkeys-lru`
3. Archive old audit logs
4. Increase memory allocation
5. Scale horizontally

---

## Best Practices Summary

✅ **DO**:
- Cache at multiple levels (app, database, Redis)
- Set appropriate TTLs based on data freshness needs
- Monitor cache performance and hit rates
- Test cache under realistic load
- Document caching strategy per endpoint
- Invalidate proactively on mutations

❌ **DON'T**:
- Cache everything indefinitely
- Ignore cache invalidation
- Rely solely on caching for performance
- Cache sensitive/private user data without encryption
- Set extremely long TTLs without validation

---

Last Updated: April 12, 2026
Version: 1.0
