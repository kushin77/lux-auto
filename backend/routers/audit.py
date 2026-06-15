"""
Audit log API v2 router.

Read-only access to the append-only audit trail. Requires the ``read:audit``
permission (ANALYST and above).
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from backend.auth.deps import require
from backend.database import get_db

router = APIRouter(prefix="/api/v2/audit", tags=["Audit"])


class AuditLogEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)
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


class AuditLogResponse(BaseModel):
    items: List[AuditLogEntry]
    total: int
    skip: int
    limit: int
    hasMore: bool


@router.get("", response_model=AuditLogResponse)
async def list_audit_logs(
    db: Session = Depends(get_db),
    user=Depends(require("read:audit")),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    event_type: Optional[str] = Query(None),
    email: Optional[str] = Query(None),
) -> AuditLogResponse:
    """List audit events, newest first, with optional filters and pagination. Requires read:audit."""
    from backend.database.models import AuditLog

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
