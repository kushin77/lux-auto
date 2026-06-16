"""
Deals Management API v2 Router.

Full deal lifecycle backed by the database, with RBAC enforcement and audit
logging on every mutation:
- List deals with filtering, sorting, and pagination
- Get deal details
- Approve / reject deals
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from backend.auth.audit import AuditEventType, AuditStatus
from backend.auth.deps import audit_logger, client_ip, require
from backend.database import get_db

router = APIRouter(prefix="/api/v2/deals", tags=["Deals"])

# Sort columns we allow (prevents arbitrary attribute injection).
_SORTABLE = {
    "created_at",
    "updated_at",
    "score",
    "mmr_value",
    "estimated_margin",
    "year",
}


def _f(value) -> float:
    """Coerce Decimal/None to float."""
    return float(value) if value is not None else 0.0


# ===== Pydantic Models =====


class DealCard(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    vin: str
    year: int
    make: str
    model: str
    photo_url: Optional[str] = None
    mmr_value: float
    estimated_margin: float
    score: float
    status: str
    created_at: datetime
    updated_at: datetime


class DealDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    vin: str
    year: int
    make: str
    model: str
    trim: Optional[str] = None
    body_style: Optional[str] = None
    mileage: int = 0
    transmission: Optional[str] = None
    color: Optional[str] = None
    interior_color: Optional[str] = None
    fuel_type: Optional[str] = None
    engine: Optional[str] = None
    photo_urls: List[str] = []
    mmr_value: float
    condition_report: Optional[dict] = None
    score: float
    score_breakdown: Optional[dict] = None
    status: str
    bid_history: List[dict] = []
    matched_buyers: List[dict] = []
    created_at: datetime
    updated_at: datetime


class DealListResponse(BaseModel):
    items: List[DealCard]
    total: int
    skip: int
    limit: int
    hasMore: bool


class DealApproveRequest(BaseModel):
    reason: Optional[str] = None
    notify_agent: bool = True


class DealRejectRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=500)


class DealApproveResponse(BaseModel):
    id: str
    status: str
    approved_at: datetime
    approved_by: str


class DealRejectResponse(BaseModel):
    id: str
    status: str
    rejected_at: datetime
    rejected_by: str
    rejection_reason: str


# ===== Helpers =====


def _card(d) -> DealCard:
    photos = d.photo_urls or []
    return DealCard(
        id=d.id,
        vin=d.vin,
        year=d.year,
        make=d.make,
        model=d.model,
        photo_url=photos[0] if photos else None,
        mmr_value=_f(d.mmr_value),
        estimated_margin=_f(d.estimated_margin),
        score=_f(d.score),
        status=d.status,
        created_at=d.created_at,
        updated_at=d.updated_at,
    )


def _get_or_404(db: Session, deal_id: str):
    from backend.database.models import Deal

    deal = db.get(Deal, deal_id)
    if deal is None:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


# ===== Endpoints =====


@router.get("", response_model=DealListResponse)
async def list_deals(
    db: Session = Depends(get_db),
    user=Depends(require("read:deals")),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    deal_status: Optional[str] = Query(None, alias="status"),
    make: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None, ge=0, le=100),
    max_price: Optional[float] = Query(None, gt=0),
    sort_by: str = Query("created_at"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
) -> DealListResponse:
    """List deals with filtering, sorting, and pagination. Requires read:deals."""
    from backend.database.models import Deal

    q = db.query(Deal)
    if deal_status:
        q = q.filter(Deal.status == deal_status)
    if make:
        q = q.filter(Deal.make.ilike(make))
    if model:
        q = q.filter(Deal.model.ilike(model))
    if min_score is not None:
        q = q.filter(Deal.score >= min_score)
    if max_price is not None:
        q = q.filter(Deal.mmr_value <= max_price)

    total = q.count()

    col = getattr(Deal, sort_by if sort_by in _SORTABLE else "created_at")
    q = q.order_by(col.asc() if order == "asc" else col.desc())

    rows = q.offset(skip).limit(limit).all()
    return DealListResponse(
        items=[_card(d) for d in rows],
        total=total,
        skip=skip,
        limit=limit,
        hasMore=skip + len(rows) < total,
    )


@router.get("/{deal_id}", response_model=DealDetail)
async def get_deal(
    deal_id: str,
    db: Session = Depends(get_db),
    user=Depends(require("read:deals")),
) -> DealDetail:
    """Get complete deal information. Requires read:deals."""
    deal = _get_or_404(db, deal_id)
    return DealDetail(
        id=deal.id,
        vin=deal.vin,
        year=deal.year,
        make=deal.make,
        model=deal.model,
        trim=deal.trim,
        body_style=deal.body_style,
        mileage=deal.mileage or 0,
        transmission=deal.transmission,
        color=deal.color,
        interior_color=deal.interior_color,
        fuel_type=deal.fuel_type,
        engine=deal.engine,
        photo_urls=deal.photo_urls or [],
        mmr_value=_f(deal.mmr_value),
        condition_report=deal.condition_report or {},
        score=_f(deal.score),
        score_breakdown=deal.score_breakdown or {},
        status=deal.status,
        created_at=deal.created_at,
        updated_at=deal.updated_at,
    )


@router.post("/{deal_id}/approve", response_model=DealApproveResponse)
async def approve_deal(
    deal_id: str,
    approval: DealApproveRequest,
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(require("approve:deals")),
) -> DealApproveResponse:
    """Approve a deal for autonomous bidding. Requires approve:deals."""
    deal = _get_or_404(db, deal_id)
    prev = deal.status
    deal.status = "approved"
    deal.updated_at = datetime.now(timezone.utc)
    db.commit()

    audit_logger.log_event(
        AuditEventType.DEAL_APPROVED,
        action=f"Approved deal {deal_id}",
        user_id=user.id,
        email=user.email,
        resource_type="deal",
        resource_id=deal_id,
        old_values={"status": prev},
        new_values={"status": "approved", "reason": approval.reason},
        status=AuditStatus.SUCCESS,
        ip_address=client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    return DealApproveResponse(
        id=deal_id,
        status="approved",
        approved_at=datetime.now(timezone.utc),
        approved_by=user.email,
    )


@router.post("/{deal_id}/reject", response_model=DealRejectResponse)
async def reject_deal(
    deal_id: str,
    rejection: DealRejectRequest,
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(require("reject:deals")),
) -> DealRejectResponse:
    """Reject a deal with a reason. Requires reject:deals."""
    deal = _get_or_404(db, deal_id)
    prev = deal.status
    deal.status = "rejected"
    deal.updated_at = datetime.now(timezone.utc)
    db.commit()

    audit_logger.log_event(
        AuditEventType.DEAL_REJECTED,
        action=f"Rejected deal {deal_id}",
        user_id=user.id,
        email=user.email,
        resource_type="deal",
        resource_id=deal_id,
        old_values={"status": prev},
        new_values={"status": "rejected", "reason": rejection.reason},
        status=AuditStatus.SUCCESS,
        ip_address=client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    return DealRejectResponse(
        id=deal_id,
        status="rejected",
        rejected_at=datetime.now(timezone.utc),
        rejected_by=user.email,
        rejection_reason=rejection.reason,
    )
