"""
Monitoring, metrics, and alerting for Lux-Auto portal.

Implements:
- Application metrics (request latency, throughput, errors)
- Database performance monitoring
- WebSocket connection tracking
- Alert thresholds and notifications
- Health check endpoints
- SLA tracking (99.9% uptime target)
"""

import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from collections import defaultdict
import threading

import prometheus_client
from prometheus_client import Counter, Histogram, Gauge
import structlog

logger = logging.getLogger(__name__)

# ============================================================================
# PROMETHEUS METRICS
# ============================================================================

# Request metrics
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.5, 5.0]
)

REQUEST_SIZE = Histogram(
    'http_request_size_bytes',
    'HTTP request body size',
    ['method', 'endpoint'],
    buckets=[100, 1000, 10000, 100000]
)

RESPONSE_SIZE = Histogram(
    'http_response_size_bytes',
    'HTTP response size',
    ['method', 'endpoint', 'status'],
    buckets=[100, 1000, 10000, 100000]
)

# Error metrics
ERROR_COUNT = Counter(
    'errors_total',
    'Total errors by type',
    ['error_type', 'endpoint']
)

EXCEPTION_COUNT = Counter(
    'exceptions_total',
    'Total exceptions',
    ['exception_type']
)

# Database metrics
DB_QUERY_DURATION = Histogram(
    'db_query_duration_seconds',
    'Database query duration',
    ['query_type'],
    buckets=[0.001, 0.01, 0.05, 0.1, 0.5]
)

DB_CONNECTION_POOL = Gauge(
    'db_connection_pool_size',
    'Database connection pool size'
)

DB_ACTIVE_CONNECTIONS = Gauge(
    'db_active_connections',
    'Active database connections'
)

# WebSocket metrics
WEBSOCKET_CONNECTIONS = Gauge(
    'websocket_connections_active',
    'Active WebSocket connections'
)

WEBSOCKET_MESSAGE_COUNT = Counter(
    'websocket_messages_total',
    'Total WebSocket messages',
    ['message_type']
)

# Cache metrics
CACHE_HIT_RATE = Gauge(
    'cache_hit_rate',
    'Cache hit rate percentage'
)

CACHE_MEMORY_USAGE = Gauge(
    'cache_memory_usage_bytes',
    'Redis memory usage'
)

# Business metrics
DEALS_CREATED = Counter(
    'deals_created_total',
    'Total deals created',
    ['source']
)

DEALS_APPROVED = Counter(
    'deals_approved_total',
    'Total deals approved'
)

DEALS_WON = Counter(
    'deals_won_total',
    'Total deals won'
)

DEAL_REVENUE = Counter(
    'deal_revenue_total',
    'Total deal revenue',
    ['currency']
)

AVERAGE_DEAL_MARGIN = Gauge(
    'average_deal_margin_percent',
    'Average deal margin percentage'
)

# ============================================================================
# HEALTH CHECK
# ============================================================================

@dataclass
class HealthStatus:
    """Health status snapshot."""
    status: str = "healthy"  # healthy, degraded, unhealthy
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    checks: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        """Convert to dict for JSON response."""
        return {
            "status": self.status,
            "timestamp": self.timestamp.isoformat(),
            "checks": self.checks,
            "uptime_hours": self._get_uptime()
        }
    
    def _get_uptime(self) -> float:
        """Get service uptime in hours."""
        # TODO: Track start time and calculate uptime
        return 24.0


class HealthChecker:
    """Check service health."""
    
    def __init__(self):
        self.start_time = datetime.utcnow()
        self.checks = {}
    
    def check_database(self, db_session) -> bool:
        """Check database connectivity."""
        try:
            # Run simple query
            db_session.execute("SELECT 1")
            self.checks["database"] = "healthy"
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            self.checks["database"] = f"unhealthy: {str(e)}"
            return False
    
    def check_redis(self, redis_client) -> bool:
        """Check Redis connectivity."""
        try:
            redis_client.ping()
            self.checks["redis"] = "healthy"
            return True
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
            self.checks["redis"] = f"unhealthy: {str(e)}"
            return False
    
    def check_api_response_time(self) -> bool:
        """Check API response time."""
        # This would be based on recent request metrics
        avg_latency = 0.15  # Example value
        threshold = 1.0  # 1 second
        
        if avg_latency < threshold:
            self.checks["api_response_time"] = f"healthy: {avg_latency:.3f}s"
            return True
        else:
            self.checks["api_response_time"] = f"degraded: {avg_latency:.3f}s"
            return False
    
    def check_error_rate(self) -> bool:
        """Check error rate."""
        # This would be based on recent error metrics
        error_rate = 0.001  # 0.1%
        threshold = 0.05  # 5%
        
        if error_rate < threshold:
            self.checks["error_rate"] = f"healthy: {error_rate*100:.2f}%"
            return True
        else:
            self.checks["error_rate"] = f"degraded: {error_rate*100:.2f}%"
            return False
    
    def get_status(self, db_session, redis_client) -> HealthStatus:
        """Get overall health status."""
        db_ok = self.check_database(db_session)
        redis_ok = self.check_redis(redis_client)
        api_ok = self.check_api_response_time()
        error_rate_ok = self.check_error_rate()
        
        critical_services_ok = db_ok and redis_ok
        
        if not critical_services_ok:
            overall = "unhealthy"
        elif not (api_ok and error_rate_ok):
            overall = "degraded"
        else:
            overall = "healthy"
        
        return HealthStatus(
            status=overall,
            checks=self.checks
        )


# ============================================================================
# ALERT THRESHOLDS
# ============================================================================

@dataclass
class AlertThreshold:
    """Alert threshold configuration."""
    name: str
    metric: str
    threshold: float
    comparison: str  # gt (>), lt (<), eq (==)
    severity: str  # critical, warning, info
    duration: int = 300  # How long condition must persist (seconds)
    cooldown: int = 600  # Minimum time between alerts (seconds)


ALERT_THRESHOLDS = [
    AlertThreshold(
        name="High Error Rate",
        metric="error_rate",
        threshold=0.05,  # 5%
        comparison="gt",
        severity="critical"
    ),
    AlertThreshold(
        name="High Request Latency",
        metric="request_latency_p95",
        threshold=2.0,  # 2 seconds
        comparison="gt",
        severity="warning"
    ),
    AlertThreshold(
        name="Database Connection Pool Full",
        metric="db_available_connections",
        threshold=1,
        comparison="lt",
        severity="critical"
    ),
    AlertThreshold(
        name="High Memory Usage",
        metric="memory_usage_percent",
        threshold=85,
        comparison="gt",
        severity="warning"
    ),
    AlertThreshold(
        name="Redis Connection Loss",
        metric="redis_connected",
        threshold=1,
        comparison="lt",
        severity="critical"
    ),
    AlertThreshold(
        name="WebSocket Connection Spike",
        metric="websocket_connections",
        threshold=1000,
        comparison="gt",
        severity="warning"
    ),
]


# ============================================================================
# ALERTING ENGINE
# ============================================================================

class AlertManager:
    """Manage alerts and notifications."""
    
    def __init__(self):
        self.active_alerts: Dict[str, Dict] = {}
        self.last_alert_time: Dict[str, datetime] = {}
        self.alert_history: List[Dict] = []
        self.lock = threading.RLock()
    
    def check_thresholds(self, metrics: Dict[str, float]) -> List[Dict]:
        """Check all thresholds against current metrics."""
        triggered_alerts = []
        
        for threshold in ALERT_THRESHOLDS:
            if threshold.metric not in metrics:
                continue
            
            current_value = metrics[threshold.metric]
            is_triggered = self._evaluate_threshold(
                current_value,
                threshold.threshold,
                threshold.comparison
            )
            
            if is_triggered:
                alert = self._create_alert(
                    threshold,
                    current_value,
                    metrics
                )
                triggered_alerts.append(alert)
                self._send_alert(alert)
        
        return triggered_alerts
    
    def _evaluate_threshold(
        self,
        value: float,
        threshold: float,
        comparison: str
    ) -> bool:
        """Evaluate if threshold is exceeded."""
        if comparison == "gt":
            return value > threshold
        elif comparison == "lt":
            return value < threshold
        elif comparison == "eq":
            return value == threshold
        else:
            return False
    
    def _create_alert(
        self,
        threshold: AlertThreshold,
        current_value: float,
        metrics: Dict
    ) -> Dict:
        """Create alert object."""
        return {
            "id": f"{threshold.name}_{datetime.utcnow().timestamp()}",
            "name": threshold.name,
            "severity": threshold.severity,
            "metric": threshold.metric,
            "current_value": current_value,
            "threshold": threshold.threshold,
            "timestamp": datetime.utcnow().isoformat(),
            "description": f"{threshold.name}: {current_value:.2f} {threshold.comparison} {threshold.threshold:.2f}",
            "context": {k: v for k, v in metrics.items() if k in [
                "error_rate", "request_latency_p95", "db_available_connections",
                "memory_usage_percent", "websocket_connections"
            ]}
        }
    
    def _send_alert(self, alert: Dict):
        """Send alert to notification channels."""
        with self.lock:
            # Check cooldown
            last_time = self.last_alert_time.get(alert["name"])
            if last_time and (datetime.utcnow() - last_time).total_seconds() < 600:
                logger.debug(f"Alert on cooldown: {alert['name']}")
                return
            
            # Log alert
            severity_level = {
                "critical": logging.CRITICAL,
                "warning": logging.WARNING,
                "info": logging.INFO
            }.get(alert["severity"], logging.INFO)
            
            logger.log(
                severity_level,
                f"ALERT: {alert['description']}",
                extra={"alert": alert}
            )
            
            # TODO: Send to external services
            # - PagerDuty (critical alerts)
            # - Slack (all alerts)
            # - Email (critical)
            # - SMS (critical)
            
            self.active_alerts[alert["name"]] = alert
            self.last_alert_time[alert["name"]] = datetime.utcnow()
            self.alert_history.append(alert)
    
    def resolve_alert(self, alert_name: str):
        """Resolve/clear an alert."""
        with self.lock:
            if alert_name in self.active_alerts:
                del self.active_alerts[alert_name]
                logger.info(f"Alert resolved: {alert_name}")
    
    def get_active_alerts(self) -> List[Dict]:
        """Get all active alerts."""
        return list(self.active_alerts.values())
    
    def get_alert_history(self, limit: int = 100) -> List[Dict]:
        """Get recent alert history."""
        return self.alert_history[-limit:]


# ============================================================================
# SLA TRACKING
# ============================================================================

class SLATracker:
    """Track Service Level Agreements."""
    
    # SLA targets
    TARGET_UPTIME = 0.999  # 99.9%
    TARGET_ERROR_RATE = 0.01  # 1%
    TARGET_P95_LATENCY = 1.0  # 1 second
    TARGET_AVAILABILITY = 0.999  # 99.9%
    
    def __init__(self):
        self.start_time = datetime.utcnow()
        self.downtime_events: List[Dict] = []
        self.daily_stats: Dict[str, Dict] = defaultdict(dict)
    
    def record_downtime(
        self,
        start: datetime,
        end: datetime,
        reason: str,
        component: str = "api"
    ):
        """Record downtime event."""
        duration = (end - start).total_seconds()
        
        self.downtime_events.append({
            "component": component,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "duration_seconds": duration,
            "reason": reason
        })
        
        logger.warning(
            f"Downtime recorded: {component} - {duration:.0f}s",
            extra={"reason": reason}
        )
    
    def get_uptime_percentage(self) -> float:
        """Calculate uptime percentage."""
        total_time = (datetime.utcnow() - self.start_time).total_seconds()
        
        downtime = sum(
            e["duration_seconds"] for e in self.downtime_events
        )
        
        uptime = (total_time - downtime) / total_time
        return uptime * 100
    
    def get_sla_compliance(self) -> Dict[str, Any]:
        """Check SLA compliance."""
        uptime = self.get_uptime_percentage()
        
        # Get recent error rate from metrics
        recent_errors = 0  # TODO: Get from metrics
        recent_requests = 1000  # TODO: Get from metrics
        error_rate = recent_errors / recent_requests if recent_requests > 0 else 0
        
        # Get recent latency
        recent_p95_latency = 0.5  # TODO: Get from metrics
        
        compliance = {
            "uptime": {
                "target": self.TARGET_UPTIME * 100,
                "actual": uptime,
                "compliant": uptime >= self.TARGET_UPTIME * 100
            },
            "error_rate": {
                "target": self.TARGET_ERROR_RATE * 100,
                "actual": error_rate * 100,
                "compliant": error_rate <= self.TARGET_ERROR_RATE
            },
            "p95_latency": {
                "target": self.TARGET_P95_LATENCY,
                "actual": recent_p95_latency,
                "compliant": recent_p95_latency <= self.TARGET_P95_LATENCY
            }
        }
        
        overall_compliant = all(
            m["compliant"] for m in compliance.values()
        )
        
        return {
            "period": f"{self.start_time.isoformat()} to {datetime.utcnow().isoformat()}",
            "metrics": compliance,
            "overall_compliant": overall_compliant,
            "downtime_events": len(self.downtime_events),
            "total_downtime_hours": sum(
                e["duration_seconds"] for e in self.downtime_events
            ) / 3600
        }
    
    def get_daily_stats(self, date: Optional[datetime] = None) -> Dict:
        """Get daily statistics."""
        if date is None:
            date = datetime.utcnow()
        
        date_str = date.strftime("%Y-%m-%d")
        
        return {
            "date": date_str,
            "uptime_percent": self.get_uptime_percentage(),
            "total_requests": 0,  # TODO
            "error_count": 0,  # TODO
            "error_rate": 0,  # TODO
            "p50_latency_ms": 0,  # TODO
            "p95_latency_ms": 0,  # TODO
            "p99_latency_ms": 0,  # TODO
        }


# ============================================================================
# METRICS AGGREGATOR
# ============================================================================

class MetricsAggregator:
    """Aggregate metrics for reporting."""
    
    def __init__(self):
        self.window_size = 300  # 5 minute windows
        self.windows: List[Dict] = []
    
    def get_current_metrics(self) -> Dict[str, float]:
        """Get current aggregated metrics."""
        return {
            "request_count": REQUEST_COUNT._value.get(),
            "error_rate": self._calculate_error_rate(),
            "request_latency_p95": self._get_percentile_latency(0.95),
            "db_available_connections": self._get_db_available_connections(),
            "memory_usage_percent": self._get_memory_usage_percent(),
            "websocket_connections": WEBSOCKET_CONNECTIONS._value.get(),
            "cache_hit_rate": CACHE_HIT_RATE._value.get(),
            "deals_created_today": DEALS_CREATED._value.get(),
            "deals_won_today": DEALS_WON._value.get(),
        }
    
    def _calculate_error_rate(self) -> float:
        """Calculate recent error rate."""
        # TODO: Get from prometheus metrics
        return 0.0
    
    def _get_percentile_latency(self, percentile: float) -> float:
        """Get latency percentile."""
        # TODO: Calculate from REQUEST_LATENCY histogram
        return 0.0
    
    def _get_db_available_connections(self) -> int:
        """Get available database connections."""
        # TODO: Get from connection pool
        return 10
    
    def _get_memory_usage_percent(self) -> float:
        """Get memory usage percentage."""
        # TODO: Get from system metrics
        return 45.0
    
    def get_daily_summary(self) -> Dict[str, Any]:
        """Get daily summary report."""
        return {
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "total_requests": 0,  # TODO
            "successful_requests": 0,  # TODO
            "error_count": 0,  # TODO
            "error_rate": 0.0,  # TODO
            "average_response_time_ms": 0,  # TODO
            "p95_response_time_ms": 0,  # TODO
            "deals_created": DEALS_CREATED._value.get(),
            "deals_approved": DEALS_APPROVED._value.get(),
            "deals_won": DEALS_WON._value.get(),
            "total_revenue": 0,  # TODO
            "uptime_percent": 100.0,  # TODO
        }

