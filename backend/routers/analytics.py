"""
Buyers + Analytics API v2 Router.

- Buyer network: list, get, CSV import (RBAC + audit)
- Analytics: dashboard summary and grouped deal performance, aggregated from
  the deals table. Grouping is done in Python after a filtered fetch so the same
  code runs on Postgres and SQLite without dialect-specific date functions.
"""

from __future__ import annotations

import csv
import io
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from backend.auth.audit import AuditEventType, AuditStatus
from backend.auth.deps import audit_logger, client_ip, require
from backend.database import get_db

router = APIRouter(prefix="/api/v2", tags=["Buyers", "Analytics"])

WON_STATUSES = ("won", "routed", "closed")
_BUYER_SORT = {"name", "location_city", "last_contacted_at", "max_price"}


def _f(value) -> float:
    return float(value) if value is not None else 0.0


def _range_start(date_range: str, now: datetime) -> Optional[datetime]:
    if date_range == "7d":
        return now - timedelta(days=7)
    if date_range == "30d":
        return now - timedelta(days=30)
    if date_range == "90d":
        return now - timedelta(days=90)
    if date_range == "ytd":
        return now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    return None  # custom / all-time handled by caller


# ===== Pydantic Models =====


class BuyerProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    location: str
    contact_email: str
    contact_phone: Optional[str] = None
    max_price: float
    preferred_makes: List[str] = []
    recent_purchase: Optional[datetime] = None
    total_purchases: int = 0
    response_rate: float = 0.0


class BuyerListResponse(BaseModel):
    items: List[BuyerProfile]
    total: int
    skip: int
    limit: int


class BuyerImportResponse(BaseModel):
    imported: int
    updated: int
    failed: int
    errors: List[dict] = []


class DashboardMetrics(BaseModel):
    deals_scanned: int
    deals_won: int
    win_rate: float
    total_volume: float
    total_margin: float
    avg_margin_per_deal: float
    roi: float


class DashboardTrends(BaseModel):
    win_rate_vs_previous: float
    margin_vs_previous: float


class TopMakeMetric(BaseModel):
    make: str
    deals_won: int
    avg_margin: float


class DashboardResponse(BaseModel):
    period: str
    metrics: DashboardMetrics
    trends: DashboardTrends
    top_makes: List[TopMakeMetric] = []


class DealMetricPoint(BaseModel):
    group: str
    value: float
    deals_total: int = 0
    deals_won: int = 0
    trend: float = 0.0


class DealAnalyticsResponse(BaseModel):
    metric: str
    group_by: str
    data: List[DealMetricPoint]


# ===== Buyer helpers =====


def _buyer_profile(b) -> BuyerProfile:
    loc = ", ".join(p for p in [b.location_city, b.location_state] if p)
    rate = (b.success_count / b.contact_count * 100) if b.contact_count else 0.0
    return BuyerProfile(
        id=b.id,
        name=b.name,
        location=loc or "—",
        contact_email=b.email,
        contact_phone=b.phone,
        max_price=_f(b.max_price),
        preferred_makes=b.make_preferences or [],
        recent_purchase=b.last_contacted_at,
        total_purchases=b.success_count or 0,
        response_rate=round(rate, 1),
    )


# ===== Buyer Endpoints =====


@router.get("/buyers", response_model=BuyerListResponse)
async def list_buyers(
    db: Session = Depends(get_db),
    user=Depends(require("read:buyers")),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    sort_by: str = Query("name"),
    order: str = Query("asc", pattern="^(asc|desc)$"),
) -> BuyerListResponse:
    """List the buyer network. Requires read:buyers."""
    from backend.database.models import Buyer

    q = db.query(Buyer)
    total = q.count()
    col = getattr(Buyer, sort_by if sort_by in _BUYER_SORT else "name")
    q = q.order_by(col.asc() if order == "asc" else col.desc())
    rows = q.offset(skip).limit(limit).all()
    return BuyerListResponse(
        items=[_buyer_profile(b) for b in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/buyers/{buyer_id}", response_model=BuyerProfile)
async def get_buyer(
    buyer_id: str,
    db: Session = Depends(get_db),
    user=Depends(require("read:buyers")),
) -> BuyerProfile:
    """Get a buyer profile. Requires read:buyers."""
    from backend.database.models import Buyer

    b = db.get(Buyer, buyer_id)
    if b is None:
        raise HTTPException(status_code=404, detail="Buyer not found")
    return _buyer_profile(b)


@router.post("/buyers/import", response_model=BuyerImportResponse)
async def import_buyers(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(require("write:buyers")),
) -> BuyerImportResponse:
    """Import/upsert buyers from CSV (by email). Requires write:buyers.

    Columns: name, email, phone, max_price, preferred_makes (comma-sep), location.
    """
    from backend.database.models import Buyer

    if file.filename and not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File must be CSV format",
        )

    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large (max 10MB)",
        )

    reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
    imported = updated = failed = 0
    errors: List[dict] = []

    for i, row in enumerate(reader, start=2):  # row 1 is the header
        try:
            email = (row.get("email") or "").strip().lower()
            name = (row.get("name") or "").strip()
            if not email or not name:
                raise ValueError("name and email are required")

            makes = [
                m.strip()
                for m in (row.get("preferred_makes") or "").split(",")
                if m.strip()
            ]
            max_price = float(row["max_price"]) if row.get("max_price") else None
            location = (row.get("location") or "").strip()
            city, _, state = location.partition(",")

            existing = db.query(Buyer).filter(Buyer.email == email).one_or_none()
            if existing:
                existing.name = name
                existing.phone = (row.get("phone") or "").strip() or existing.phone
                existing.max_price = (
                    max_price if max_price is not None else existing.max_price
                )
                existing.make_preferences = makes or existing.make_preferences
                existing.location_city = city.strip() or existing.location_city
                existing.location_state = state.strip()[:2] or existing.location_state
                updated += 1
            else:
                db.add(
                    Buyer(
                        id=uuid.uuid4().hex,
                        name=name,
                        email=email,
                        phone=(row.get("phone") or "").strip() or None,
                        max_price=max_price,
                        make_preferences=makes,
                        location_city=city.strip() or None,
                        location_state=(state.strip()[:2] or None),
                    )
                )
                imported += 1
        except Exception as exc:
            failed += 1
            errors.append({"row": i, "error": str(exc)})

    db.commit()
    audit_logger.log_event(
        AuditEventType.CONFIG_CHANGED,
        action="Buyer CSV import",
        user_id=user.id,
        email=user.email,
        resource_type="buyer",
        new_values={"imported": imported, "updated": updated, "failed": failed},
        status=AuditStatus.SUCCESS if failed == 0 else AuditStatus.FAILURE,
        ip_address=client_ip(request),
    )
    return BuyerImportResponse(
        imported=imported, updated=updated, failed=failed, errors=errors
    )


# ===== Analytics Endpoints =====


def _metrics_for(rows) -> DashboardMetrics:
    scanned = len(rows)
    won = [d for d in rows if d.status in WON_STATUSES]
    n_won = len(won)
    volume = sum(_f(d.mmr_value) for d in won)
    margin = sum(_f(d.estimated_margin) for d in won)
    return DashboardMetrics(
        deals_scanned=scanned,
        deals_won=n_won,
        win_rate=round(n_won / scanned * 100, 1) if scanned else 0.0,
        total_volume=round(volume, 2),
        total_margin=round(margin, 2),
        avg_margin_per_deal=round(margin / n_won, 2) if n_won else 0.0,
        roi=round(margin / volume * 100, 1) if volume else 0.0,
    )


@router.get("/analytics/dashboard", response_model=DashboardResponse)
async def get_analytics_dashboard(
    db: Session = Depends(get_db),
    user=Depends(require("read:analytics")),
    date_range: str = Query("30d", pattern="^(7d|30d|90d|ytd|custom)$"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
) -> DashboardResponse:
    """Dashboard metrics, period-over-period trends, and top makes. Requires read:analytics."""
    from backend.database.models import Deal

    if date_range == "custom" and (not start_date or not end_date):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="start_date and end_date required when date_range=custom",
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    start = _range_start(date_range, now)

    all_rows = db.query(Deal).all()
    current = [d for d in all_rows if start is None or d.created_at >= start]
    metrics = _metrics_for(current)

    # Previous equal-length window for trends.
    trends = DashboardTrends(win_rate_vs_previous=0.0, margin_vs_previous=0.0)
    if start is not None:
        window = now - start
        prev = [d for d in all_rows if (start - window) <= d.created_at < start]
        prev_m = _metrics_for(prev)
        trends = DashboardTrends(
            win_rate_vs_previous=round(metrics.win_rate - prev_m.win_rate, 1),
            margin_vs_previous=round(metrics.total_margin - prev_m.total_margin, 2),
        )

    by_make: dict[str, list] = defaultdict(list)
    for d in current:
        if d.status in WON_STATUSES:
            by_make[d.make].append(_f(d.estimated_margin))
    top = sorted(
        (
            TopMakeMetric(
                make=mk, deals_won=len(v), avg_margin=round(sum(v) / len(v), 2)
            )
            for mk, v in by_make.items()
        ),
        key=lambda t: t.deals_won,
        reverse=True,
    )[:5]

    return DashboardResponse(
        period=date_range, metrics=metrics, trends=trends, top_makes=top
    )


@router.get("/analytics/deals", response_model=DealAnalyticsResponse)
async def get_deal_analytics(
    db: Session = Depends(get_db),
    user=Depends(require("read:analytics")),
    metric: str = Query("win_rate", pattern="^(win_rate|margin|velocity|accuracy)$"),
    group_by: Optional[str] = Query("make", pattern="^(make|model|month|week|day)?$"),
    date_range: str = Query("30d", pattern="^(7d|30d|90d|ytd)$"),
) -> DealAnalyticsResponse:
    """Grouped deal performance for a metric. Requires read:analytics."""
    from backend.database.models import Deal

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    start = _range_start(date_range, now)
    rows = [d for d in db.query(Deal).all() if start is None or d.created_at >= start]

    dim = group_by or "make"

    def key(d) -> str:
        if dim == "make":
            return d.make
        if dim == "model":
            return d.model
        if dim == "month":
            return d.created_at.strftime("%Y-%m")
        if dim == "week":
            return d.created_at.strftime("%Y-W%V")
        return d.created_at.strftime("%Y-%m-%d")

    groups: dict[str, list] = defaultdict(list)
    for d in rows:
        groups[key(d)].append(d)

    data: List[DealMetricPoint] = []
    for g, items in groups.items():
        total = len(items)
        won = [d for d in items if d.status in WON_STATUSES]
        if metric == "win_rate":
            value = round(len(won) / total * 100, 1) if total else 0.0
        elif metric == "margin":
            value = (
                round(sum(_f(d.estimated_margin) for d in won) / len(won), 2)
                if won
                else 0.0
            )
        elif metric == "velocity":
            spans = [(d.updated_at - d.created_at).days for d in won]
            value = round(sum(spans) / len(spans), 1) if spans else 0.0
        else:  # accuracy → average score as a proxy
            value = round(sum(_f(d.score) for d in items) / total, 1) if total else 0.0
        data.append(
            DealMetricPoint(group=g, value=value, deals_total=total, deals_won=len(won))
        )

    data.sort(key=lambda p: p.value, reverse=True)
    return DealAnalyticsResponse(metric=metric, group_by=dim, data=data)
