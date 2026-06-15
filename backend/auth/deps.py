"""
Shared FastAPI auth dependencies.

``current_user`` resolves the oauth2-proxy identity into a DB user (provisioning
on first sight). ``require(permission)`` builds a dependency that additionally
enforces RBAC. Both share the request-scoped session from ``get_db`` (FastAPI
caches sub-dependencies), so a handler and its guards use one transaction.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.auth.audit import AuditLogger
from backend.auth.rbac_service import RBACService
from backend.auth.user_service import UserService
from backend.database import get_db, get_session_local

_users = UserService()
_rbac = RBACService()

# Audit logger uses its own short-lived session per event (never the request's).
audit_logger = AuditLogger(session_factory=lambda: get_session_local()())


def current_user(request: Request, db: Session = Depends(get_db)):
    """Resolve and provision the authenticated user, or 401."""
    email = request.headers.get("X-Auth-Request-Email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication headers",
        )
    return _users.get_or_create_user(email=email, session=db)


def require(permission: str):
    """Return a dependency that requires ``permission`` and yields the user."""

    def _guard(user=Depends(current_user)):
        _rbac.require_permission(user.role, permission)
        return user

    return _guard


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None
