"""
Audit Logging for Lux-Auto

Provides structured audit logging for security events, user actions, and compliance tracking.
Integrates with FastAPI middleware to log all security-relevant events.
"""

import json
import logging
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any

import structlog
from sqlalchemy.orm import Session

from backend.database.models import AuditLog


class AuditEventType(str, Enum):
    """Types of events to audit"""
    
    # Authentication events
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"
    USER_CREATED = "user_created"
    USER_ROLE_CHANGED = "user_role_changed"
    
    # Session events
    SESSION_CREATED = "session_created"
    SESSION_REVOKED = "session_revoked"
    SESSION_EXPIRED = "session_expired"
    
    # Security events
    AUTH_FAILED = "auth_failed"
    PERMISSION_DENIED = "permission_denied"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    
    # API events
    API_CALL = "api_call"
    DATA_ACCESS = "data_access"
    DATA_MODIFICATION = "data_modification"
    
    # Administrative events
    CONFIG_CHANGED = "config_changed"
    ADMIN_ACTION = "admin_action"
    
    # Compliance events
    COMPLIANCE_CHECK = "compliance_check"


class AuditStatus(str, Enum):
    """Status of audited events"""
    SUCCESS = "success"
    FAILURE = "failure"
    PARTIAL = "partial"
    BLOCKED = "blocked"


class AuditLogger:
    """
    Audit logging service for Lux-Auto
    
    Logs all security-relevant events for compliance and forensic analysis.
    Events are stored in database and can be queried for compliance reports.
    """
    
    def __init__(self, session_factory, logger: Optional[logging.Logger] = None):
        """
        Initialize audit logger
        
        Args:
            session_factory: SQLAlchemy session factory
            logger: Optional structured logger instance
        """
        self.session_factory = session_factory
        self.logger = logger or structlog.get_logger(__name__)
    
    def log_event(
        self,
        event_type: AuditEventType,
        user_id: Optional[int] = None,
        email: Optional[str] = None,
        action: str = "",
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        status: AuditStatus = AuditStatus.SUCCESS,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> Optional[int]:
        """
        Log an audit event
        
        Args:
            event_type: Type of event being logged
            user_id: ID of user performing action
            email: Email of user performing action
            action: Description of action taken
            resource_type: Type of resource affected (e.g., 'user', 'session')
            resource_id: ID of affected resource
            old_values: Previous values (for change tracking)
            new_values: New values (for change tracking)
            status: Status of the event
            ip_address: IP address of request
            user_agent: User agent string
            error_message: Error message if applicable
        
        Returns:
            ID of created audit log entry
        """
        try:
            session = self.session_factory()
            
            # Create audit log entry
            audit_log = AuditLog(
                event_type=event_type.value,
                user_id=user_id,
                email=email or f"user_{user_id}" if user_id else None,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                old_values=json.dumps(old_values) if old_values else None,
                new_values=json.dumps(new_values) if new_values else None,
                status=status.value,
                ip_address=ip_address,
                user_agent=user_agent,
                error_message=error_message,
                created_at=datetime.utcnow(),
            )
            
            session.add(audit_log)
            session.commit()
            
            # Also log to structured logger
            self.logger.info(
                event_type.value,
                user_id=user_id,
                email=email,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                status=status.value,
                ip_address=ip_address,
                audit_id=audit_log.id,
            )
            
            session.close()
            return audit_log.id
            
        except Exception as e:
            self.logger.error(
                "Failed to log audit event",
                event_type=event_type.value,
                error=str(e),
            )
            return None
    
    def log_authentication(
        self,
        email: str,
        status: AuditStatus,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> Optional[int]:
        """Log authentication event"""
        return self.log_event(
            event_type=AuditEventType.USER_LOGIN,
            email=email,
            action=f"User login: {email}",
            status=status,
            ip_address=ip_address,
            user_agent=user_agent,
            error_message=error_message,
        )
    
    def log_session_created(
        self,
        user_id: int,
        email: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Optional[int]:
        """Log session creation"""
        return self.log_event(
            event_type=AuditEventType.SESSION_CREATED,
            user_id=user_id,
            email=email,
            action="Session created",
            resource_type="session",
            status=AuditStatus.SUCCESS,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    
    def log_session_revoked(
        self,
        user_id: int,
        session_id: int,
        email: Optional[str] = None,
    ) -> Optional[int]:
        """Log session revocation"""
        return self.log_event(
            event_type=AuditEventType.SESSION_REVOKED,
            user_id=user_id,
            email=email,
            action=f"Session revoked: {session_id}",
            resource_type="session",
            resource_id=str(session_id),
            status=AuditStatus.SUCCESS,
        )
    
    def log_permission_denied(
        self,
        user_id: Optional[int],
        email: Optional[str],
        action: str,
        resource_type: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> Optional[int]:
        """Log permission denied event"""
        return self.log_event(
            event_type=AuditEventType.PERMISSION_DENIED,
            user_id=user_id,
            email=email,
            action=action,
            resource_type=resource_type,
            status=AuditStatus.BLOCKED,
            ip_address=ip_address,
        )
    
    def log_api_call(
        self,
        user_id: Optional[int],
        email: Optional[str],
        method: str,
        path: str,
        status_code: int,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Optional[int]:
        """Log API call"""
        return self.log_event(
            event_type=AuditEventType.API_CALL,
            user_id=user_id,
            email=email,
            action=f"{method} {path}",
            resource_type="api",
            resource_id=path,
            status=AuditStatus.SUCCESS if 200 <= status_code < 300 else AuditStatus.FAILURE,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    
    def log_suspicious_activity(
        self,
        user_id: Optional[int],
        email: Optional[str],
        activity: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Optional[int]:
        """Log suspicious activity (multiple failed logins, etc.)"""
        return self.log_event(
            event_type=AuditEventType.SUSPICIOUS_ACTIVITY,
            user_id=user_id,
            email=email,
            action=activity,
            status=AuditStatus.PARTIAL,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    
    def get_user_audit_log(
        self,
        user_id: int,
        limit: int = 100,
    ) -> list:
        """
        Get audit log for a specific user
        
        Args:
            user_id: User ID to query
            limit: Maximum number of records to return
        
        Returns:
            List of audit log entries
        """
        session = self.session_factory()
        try:
            logs = session.query(AuditLog)\
                .filter(AuditLog.user_id == user_id)\
                .order_by(AuditLog.created_at.desc())\
                .limit(limit)\
                .all()
            return logs
        finally:
            session.close()
    
    def get_event_audit_log(
        self,
        event_type: AuditEventType,
        limit: int = 100,
    ) -> list:
        """
        Get audit log for a specific event type
        
        Args:
            event_type: Event type to query
            limit: Maximum number of records to return
        
        Returns:
            List of audit log entries
        """
        session = self.session_factory()
        try:
            logs = session.query(AuditLog)\
                .filter(AuditLog.event_type == event_type.value)\
                .order_by(AuditLog.created_at.desc())\
                .limit(limit)\
                .all()
            return logs
        finally:
            session.close()
    
    def generate_compliance_report(
        self,
        start_date: datetime,
        end_date: datetime,
    ) -> Dict[str, Any]:
        """
        Generate compliance report for date range
        
        Args:
            start_date: Start date for report
            end_date: End date for report
        
        Returns:
            Dictionary containing compliance metrics
        """
        session = self.session_factory()
        try:
            logs = session.query(AuditLog)\
                .filter(
                    AuditLog.created_at >= start_date,
                    AuditLog.created_at <= end_date,
                )\
                .all()
            
            # Count events by type
            event_counts = {}
            success_count = 0
            failure_count = 0
            blocked_count = 0
            
            for log in logs:
                event_counts[log.event_type] = event_counts.get(log.event_type, 0) + 1
                
                if log.status == AuditStatus.SUCCESS.value:
                    success_count += 1
                elif log.status == AuditStatus.FAILURE.value:
                    failure_count += 1
                elif log.status == AuditStatus.BLOCKED.value:
                    blocked_count += 1
            
            return {
                "period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat(),
                },
                "total_events": len(logs),
                "success_count": success_count,
                "failure_count": failure_count,
                "blocked_count": blocked_count,
                "event_breakdown": event_counts,
                "generated_at": datetime.utcnow().isoformat(),
            }
        finally:
            session.close()
