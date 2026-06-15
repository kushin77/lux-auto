"""
Audit log API v2 router.

Read-only access to the append-only audit trail. Requires the ``read:audit``
permission (ANALYST and above).
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.auth.rbac_service import RBACService
from backend.auth.user_service import UserService
from backend.database import get_db

router = APIRouter(prefix="/api/v2/audit", tags=["Audit"])

_rbac = RBACService()
_users = UserService()


class AuditLogEntry(BaseModel):
    id: int
    event_type: str
    user_id: Optional[int] = None
    email: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    status: str
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    items: List[AuditLogEntry]
    total: int
    skip: int
    limit: int
    hasMore: bool


def _require_audit_read(request: Request, db: Session):
    email = request.headers.get("X-Auth-Request-Email")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user = _users.get_or_create_user(email=email, session=db)
    _rbac.require_permission(user.role, "read:audit")
    return user


@router.get("", response_model=AuditLogResponse)
async def list_audit_logs(
    request: Request,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    event_type: Optional[str] = Query(None),
    email: Optional[str] = Query(None),
) -> AuditLogResponse:
    """List audit events, newest first, with optional filters and pagination."""
    from backend.database.models import AuditLog

    _require_audit_read(request, db)

    q = db.query(AuditLog)
    if event_type:
        q = q.filter(AuditLog.event_type == event_type)
    if email:
        q = q.filter(AuditLog.email == email)

    total = q.count()
    rows = q.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()

    return AuditLogResponse(
        items=[AuditLogEntry.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
        hasMore=skip + len(rows) < total,
    )
