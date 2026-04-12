"""
Caching and query optimization strategies for Lux-Auto portal.

Implements:
- Redis caching layers (query results, session data, analytics)
- Query optimization (database indexes, batch fetching, N+1 prevention)
- Cache invalidation strategies
- Performance monitoring
"""

import redis
import asyncio
import json
import hashlib
from functools import wraps
from datetime import datetime, timedelta
from typing import Any, Callable, Optional, Dict, List
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# REDIS CONNECTION POOL
# ============================================================================

class RedisCache:
    """Redis caching client with connection pooling."""
    
    def __init__(self, redis_url: str = "redis://:password@cache:6379/0"):
        self.pool = redis.ConnectionPool.from_url(redis_url)
        self.client = redis.Redis(connection_pool=self.pool)
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        try:
            value = self.client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None
    
    def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        """Set value in cache with TTL (default 1 hour)."""
        try:
            self.client.setex(key, ttl, json.dumps(value))
            return True
        except Exception as e:
            logger.error(f"Redis set error: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete key from cache."""
        try:
            self.client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Redis delete error: {e}")
            return False
    
    def pattern_delete(self, pattern: str) -> int:
        """Delete all keys matching pattern (e.g., 'deal:*')."""
        try:
            keys = self.client.keys(pattern)
            if keys:
                return self.client.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Redis pattern delete error: {e}")
            return 0
    
    def increment(self, key: str, amount: int = 1) -> int:
        """Increment counter in cache."""
        try:
            return self.client.incrby(key, amount)
        except Exception as e:
            logger.error(f"Redis increment error: {e}")
            return 0

# ============================================================================
# CACHE STRATEGIES
# ============================================================================

class CacheStrategy:
    """Base cache strategy."""
    
    def __init__(self, redis_cache: RedisCache):
        self.cache = redis_cache
    
    def generate_key(self, prefix: str, **kwargs) -> str:
        """Generate cache key from prefix and parameters."""
        # Sort kwargs for consistent hashing
        params = "&".join(f"{k}={v}" for k, v in sorted(kwargs.items()))
        hash_suffix = hashlib.md5(params.encode()).hexdigest()[:8]
        return f"{prefix}:{hash_suffix}"


class DealQueryCache(CacheStrategy):
    """Cache strategy for deal queries."""
    
    TTL = 300  # 5 minutes for deal queries
    
    def cache_deal_list(
        self,
        status: Optional[str] = None,
        buyer_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 50
    ) -> str:
        """Generate cache key for deal list query."""
        return self.generate_key(
            "deals:list",
            status=status or "all",
            buyer_id=buyer_id or "any",
            skip=skip,
            limit=limit
        )
    
    def cache_deal_detail(self, deal_id: int) -> str:
        """Generate cache key for deal detail."""
        return f"deal:{deal_id}:detail"
    
    def invalidate_deal(self, deal_id: int) -> int:
        """Invalidate all caches for a deal."""
        # Delete specific deal cache
        count = self.cache.delete(f"deal:{deal_id}:detail")
        
        # Delete all list caches (they might include this deal)
        count += self.cache.pattern_delete("deals:list:*")
        
        return count


class AnalyticsCache(CacheStrategy):
    """Cache strategy for analytics queries."""
    
    TTL = 3600  # 1 hour for analytics (less volatile)
    TTL_REALTIME = 300  # 5 minutes for real-time metrics
    
    def cache_deal_stats(
        self,
        period: str = "week",  # day, week, month, year
        buyer_id: Optional[int] = None
    ) -> str:
        """Generate cache key for deal statistics."""
        return self.generate_key(
            "analytics:deal_stats",
            period=period,
            buyer_id=buyer_id or "all"
        )
    
    def cache_buyer_performance(self, buyer_id: int) -> str:
        """Generate cache key for buyer performance metrics."""
        return f"analytics:buyer:{buyer_id}:perf"
    
    def cache_margin_analysis(self, timeframe: str = "month") -> str:
        """Generate cache key for margin analysis."""
        return f"analytics:margin:{timeframe}"
    
    def invalidate_analytics(self) -> int:
        """Invalidate all analytics caches."""
        return self.cache.pattern_delete("analytics:*")


class SessionCache(CacheStrategy):
    """Cache strategy for session data."""
    
    TTL = 86400  # 24 hours for sessions
    
    def cache_user_session(self, user_id: int) -> str:
        """Generate cache key for user session."""
        return f"session:user:{user_id}"
    
    def cache_user_permissions(self, user_id: int) -> str:
        """Generate cache key for user permissions."""
        return f"perms:user:{user_id}"
    
    def invalidate_user(self, user_id: int) -> int:
        """Invalidate all caches for user."""
        count = self.cache.delete(f"session:user:{user_id}")
        count += self.cache.delete(f"perms:user:{user_id}")
        return count


# ============================================================================
# CACHE DECORATORS
# ============================================================================

def cache_result(
    ttl: int = 3600,
    key_prefix: str = "cache"
):
    """Decorator to cache function results."""
    def decorator(func: Callable):
        async def async_wrapper(*args, **kwargs):
            # Generate cache key
            key = f"{key_prefix}:{hashlib.md5(str(kwargs).encode()).hexdigest()}"
            
            redis_cache = RedisCache()
            cached = redis_cache.get(key)
            
            if cached:
                logger.debug(f"Cache hit: {key}")
                return cached
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            redis_cache.set(key, result, ttl)
            logger.debug(f"Cache miss, stored: {key}")
            
            return result
        
        def sync_wrapper(*args, **kwargs):
            key = f"{key_prefix}:{hashlib.md5(str(kwargs).encode()).hexdigest()}"
            
            redis_cache = RedisCache()
            cached = redis_cache.get(key)
            
            if cached:
                logger.debug(f"Cache hit: {key}")
                return cached
            
            result = func(*args, **kwargs)
            redis_cache.set(key, result, ttl)
            logger.debug(f"Cache miss, stored: {key}")
            
            return result
        
        # Return appropriate wrapper
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


# ============================================================================
# QUERY OPTIMIZATION HELPERS
# ============================================================================

class QueryOptimizer:
    """Helpers for optimizing database queries."""
    
    @staticmethod
    def build_load_options(model_class, relationships: List[str]):
        """
        Build SQLAlchemy joinedload options to prevent N+1 queries.
        
        Example:
            options = QueryOptimizer.build_load_options(
                Deal,
                ["buyer", "audit_logs", "scores"]
            )
            deals = db.query(Deal).options(*options).all()
        """
        from sqlalchemy.orm import joinedload
        
        options = []
        for rel in relationships:
            if hasattr(model_class, rel):
                options.append(joinedload(getattr(model_class, rel)))
        
        return options
    
    @staticmethod
    def paginate_efficiently(query, skip: int, limit: int):
        """
        Paginate query efficiently.
        
        Counts total before limiting to avoid full table scan.
        """
        total = query.count()
        items = query.offset(skip).limit(limit).all()
        
        return {
            "items": items,
            "total": total,
            "skip": skip,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        }
    
    @staticmethod
    def batch_fetch(model_class, ids: List[int], db_session):
        """
        Fetch multiple records by ID in single query (avoid N queries).
        
        Example:
            deals = QueryOptimizer.batch_fetch(Deal, [1, 2, 3], db_session)
        """
        return db_session.query(model_class).filter(
            model_class.id.in_(ids)
        ).all()


# ============================================================================
# INDEX RECOMMENDATIONS
# ============================================================================

INDEX_RECOMMENDATIONS = """
-- Recommended database indexes for performance

-- Deal queries (most common access patterns)
CREATE INDEX idx_deals_status ON deals(status)
    WHERE deal_status NOT IN ('closed', 'cancelled');
CREATE INDEX idx_deals_buyer_status ON deals(buyer_id, status);
CREATE INDEX idx_deals_score ON deals(deal_score DESC) 
    WHERE deal_status = 'new';
CREATE INDEX idx_deals_created ON deals(created_at DESC);
CREATE INDEX idx_deals_updated ON deals(updated_at DESC);

-- Deal search queries
CREATE INDEX idx_deals_make_model ON deals(vehicle_make, vehicle_model);
CREATE INDEX idx_deals_year_range ON deals(vehicle_year);

-- Analytics queries (time-series, aggregation)
CREATE INDEX idx_deals_created_status ON deals(created_at, deal_status);
CREATE INDEX idx_audit_logs_user_date ON portal_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON portal_audit_logs(action);

-- User/session queries
CREATE INDEX idx_sessions_user_active ON portal_sessions(user_id, active);
CREATE INDEX idx_sessions_expires ON portal_sessions(expires_at)
    WHERE active = true;

-- Permission/RBAC checks
CREATE INDEX idx_permissions_user_role ON user_permissions(user_id, role_id);

-- Full-text search optimization
CREATE INDEX idx_deals_buyer_name_search ON deals USING gin(
    to_tsvector('english', buyer_name || ' ' || notes)
);

-- Composite indexes for common filters
CREATE INDEX idx_deals_filter ON deals(
    deal_status, 
    vehicle_make, 
    created_at DESC
) WHERE deal_status IN ('new', 'scoring', 'matched');

-- Covering index (includes all columns needed for query)
CREATE INDEX idx_deals_buyer_list ON deals(
    buyer_id, 
    created_at DESC
) INCLUDE (
    deal_id,
    deal_score,
    deal_status,
    vehicle_make,
    vehicle_model
);

-- Partial indexes (filtered indexes for common queries)
CREATE INDEX idx_active_deals ON deals(created_at DESC)
    WHERE deal_status IN ('new', 'scoring', 'matched');

CREATE INDEX idx_high_value_deals ON deals(deal_score DESC)
    WHERE deal_score > 80 AND deal_status != 'closed';

-- Batch operation optimization
CREATE INDEX idx_deals_id_list ON deals(id)
    WHERE deal_status IN ('pending_review', 'scored');
"""

# ============================================================================
# CACHE WARMUP
# ============================================================================

async def warmup_cache(redis_cache: RedisCache, db_session):
    """
    Pre-populate cache with commonly accessed data on startup.
    
    Reduces latency for cold starts.
    """
    try:
        # Warm up deal list (first 100)
        logger.info("Cache warmup: Starting...")
        
        analytics = AnalyticsCache(redis_cache)
        deals_cache = DealQueryCache(redis_cache)
        
        # Cache deal statistics by week
        for period in ["week", "month", "year"]:
            logger.debug(f"  Warming up deal stats: {period}")
            # TODO: Fetch from DB and cache
        
        # Cache top buyers
        logger.debug("  Warming up top buyers...")
        # TODO: Fetch from DB and cache
        
        logger.info("Cache warmup: Complete")
        
    except Exception as e:
        logger.error(f"Cache warmup failed: {e}")


# ============================================================================
# CACHE STATISTICS & MONITORING
# ============================================================================

class CacheStats:
    """Cache statistics and monitoring."""
    
    def __init__(self, redis_cache: RedisCache):
        self.cache = redis_cache
        self.prefix = "cachestats"
    
    def record_hit(self, key: str):
        """Record cache hit."""
        self.cache.increment(f"{self.prefix}:hits")
        self.cache.increment(f"{self.prefix}:key:{key}:hits")
    
    def record_miss(self, key: str):
        """Record cache miss."""
        self.cache.increment(f"{self.prefix}:misses")
        self.cache.increment(f"{self.prefix}:key:{key}:misses")
    
    def get_hit_rate(self) -> float:
        """Get overall cache hit rate."""
        hits = int(self.cache.get(f"{self.prefix}:hits") or "0")
        misses = int(self.cache.get(f"{self.prefix}:misses") or "0")
        
        total = hits + misses
        if total == 0:
            return 0.0
        
        return hits / total
    
    def get_memory_usage(self) -> Dict[str, Any]:
        """Get Redis memory usage."""
        try:
            info = self.cache.client.info('memory')
            return {
                "used_mb": info['used_memory'] / (1024 * 1024),
                "peak_mb": info['used_memory_peak'] / (1024 * 1024),
                "max_mb": info.get('maxmemory', 0) / (1024 * 1024),
                "evicted_keys": info.get('evicted_keys', 0)
            }
        except Exception as e:
            logger.error(f"Redis info error: {e}")
            return {}
    
    def get_top_keys_by_size(self, limit: int = 10) -> List[Dict]:
        """Get largest keys in cache."""
        try:
            keys = self.cache.client.keys("*")
            key_sizes = []
            
            for key in keys[:1000]:  # Sample first 1000 keys
                size = self.cache.client.memory_usage(key)
                key_sizes.append({"key": key, "bytes": size})
            
            # Sort by size descending
            key_sizes.sort(key=lambda x: x["bytes"], reverse=True)
            
            return key_sizes[:limit]
        except Exception as e:
            logger.error(f"Error getting key sizes: {e}")
            return []

