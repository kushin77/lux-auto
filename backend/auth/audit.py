"""
Audit logging — append-only compliance/forensics trail.

``AuditLogger`` owns its own DB session (from a session factory) so a logging
failure can never corrupt the caller's transaction, and audit writes never
raise into request handlers.
"""

from __future__ import annotations

import enum
import json

from backend.clock import utcnow

import structlog

log = structlog.get_logger(__name__)


class AuditEventType(str, enum.Enum):
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"
    SESSION_CREATED = "session_created"
    SESSION_REVOKED = "session_revoked"
    ACCESS_DENIED = "access_denied"
    DEAL_VIEWED = "deal_viewed"
    DEAL_APPROVED = "deal_approved"
    DEAL_REJECTED = "deal_rejected"
    ROLE_CHANGED = "role_changed"
    API_KEY_CREATED = "api_key_created"
    CONFIG_CHANGED = "config_changed"


class AuditStatus(str, enum.Enum):
    SUCCESS = "success"
    FAILURE = "failure"
    DENIED = "denied"


def _json(value) -> str | None:
    if value is None:
        return None
    try:
        return json.dumps(value, default=str)
    except (TypeError, ValueError):
        return str(value)


class AuditLogger:
    """Writes ``AuditLog`` rows using an isolated session per event."""

    def __init__(self, session_factory):
        self._session_factory = session_factory

    def log_event(
        self,
        event_type: "AuditEventType | str",
        action: str,
        *,
        user_id: int | None = None,
        email: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        old_values=None,
        new_values=None,
        status: "AuditStatus | str" = AuditStatus.SUCCESS,
        ip_address: str | None = None,
        user_agent: str | None = None,
        error_message: str | None = None,
    ) -> None:
        from backend.database.models import AuditLog

        et = event_type.value if isinstance(event_type, AuditEventType) else str(event_type)
        st = status.value if isinstance(status, AuditStatus) else str(status)

        session = self._session_factory()
        try:
            session.add(
                AuditLog(
                    event_type=et,
                    user_id=user_id,
                    email=email,
                    action=action,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    old_values=_json(old_values),
                    new_values=_json(new_values),
                    status=st,
                    ip_address=ip_address,
                    user_agent=(user_agent or "")[:512] or None,
                    error_message=error_message,
                    created_at=utcnow(),
                )
            )
            session.commit()
        except Exception as exc:  # never let audit failures break the request
            session.rollback()
            log.error("audit.write_failed", event_type=et, error=str(exc))
        finally:
            session.close()
