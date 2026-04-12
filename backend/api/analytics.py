"""
Analytics API v2 endpoints

REST API for analytics and reporting.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from backend.database import get_db
from backend.database.models import Deal, Buyer
from backend.api.rbac import Permission, check_permission

router = APIRouter(
    prefix="/api/v2/analytics",
    tags=["analytics"],
)


@router.get("/dashboard", response_model=dict)
async def get_dashboard_metrics(
    request: Request,
    db: Session = Depends(get_db),
    days: int = Query(30, ge=1, le=365),
):
    """Get dashboard summary metrics."""
    if not hasattr(request.state, "user"):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = request.state.user
    if not check_permission(db, user.id, Permission.READ_ANALYTICS):
        raise HTTPException(status_code=403, detail=f"Permission '{Permission.READ_ANALYTICS}' required")
    
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Total deals
    total_deals = db.query(func.count(Deal.id)).scalar() or 0
    recent_deals = db.query(func.count(Deal.id)).filter(Deal.created_at >= cutoff_date).scalar() or 0
    
    # Deals by status
    status_breakdown = {}
    for status in ['scanning', 'scored', 'bidding', 'won', 'routed', 'closed']:
        count = db.query(func.count(Deal.id)).filter(Deal.status == status).scalar() or 0
        status_breakdown[status] = count
    
    # Average score
    avg_score = db.query(func.avg(Deal.score)).scalar() or 0
    
    # Total buyers
    total_buyers = db.query(func.count(Buyer.id)).scalar() or 0
    
    # Average margin
    avg_margin = db.query(func.avg(Deal.estimated_margin)).scalar() or 0
    
    return {
        "total_deals": total_deals,
        "recent_deals": recent_deals,
        "status_breakdown": status_breakdown,
        "avg_score": float(avg_score) if avg_score else 0,
        "total_buyers": total_buyers,
        "avg_margin": float(avg_margin) if avg_margin else 0,
        "period_days": days,
    }


@router.get("/deals", response_model=dict)
async def get_deals_analytics(
    request: Request,
    db: Session = Depends(get_db),
    days: int = Query(30, ge=1, le=365),
):
    """Get deal performance analytics."""
    if not hasattr(request.state, "user"):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = request.state.user
    if not check_permission(db, user.id, Permission.READ_ANALYTICS):
        raise HTTPException(status_code=403, detail=f"Permission '{Permission.READ_ANALYTICS}' required")
    
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Get deals within period
    deals = db.query(Deal).filter(Deal.created_at >= cutoff_date).all()
    
    # Calculate metrics
    total = len(deals)
    won = len([d for d in deals if d.status == 'won'])
    avg_margin = sum([float(d.estimated_margin or 0) for d in deals]) / total if total > 0 else 0
    
    # Make/model breakdown
    make_breakdown = {}
    for deal in deals:
        key = f"{deal.year} {deal.make}"
        if key not in make_breakdown:
            make_breakdown[key] = {"count": 0, "avg_score": 0, "total_score": 0}
        make_breakdown[key]["count"] += 1
        make_breakdown[key]["total_score"] += float(deal.score or 0)
    
    for key in make_breakdown:
        make_breakdown[key]["avg_score"] = make_breakdown[key]["total_score"] / make_breakdown[key]["count"]
    
    return {
        "total_deals": total,
        "won_deals": won,
        "win_rate": (won / total * 100) if total > 0 else 0,
        "avg_margin": avg_margin,
        "make_breakdown": make_breakdown,
        "period_days": days,
    }


@router.get("/buyers", response_model=dict)
async def get_buyers_analytics(
    request: Request,
    db: Session = Depends(get_db),
):
    """Get buyer performance metrics."""
    if not hasattr(request.state, "user"):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = request.state.user
    if not check_permission(db, user.id, Permission.READ_ANALYTICS):
        raise HTTPException(status_code=403, detail=f"Permission '{Permission.READ_ANALYTICS}' required")
    
    buyers = db.query(Buyer).all()
    
    # Sort by success rate
    buyer_metrics = []
    for buyer in buyers:
        success_rate = (buyer.success_count / buyer.contact_count * 100) if buyer.contact_count > 0 else 0
        buyer_metrics.append({
            "id": buyer.id,
            "name": buyer.name,
            "contact_count": buyer.contact_count,
            "success_count": buyer.success_count,
            "success_rate": success_rate,
            "match_score": float(buyer.match_score or 0),
        })
    
    buyer_metrics.sort(key=lambda x: x['success_rate'], reverse=True)
    
    return {
        "top_buyers": buyer_metrics[:10],
        "total_buyers": len(buyers),
        "avg_success_rate": sum([b['success_rate'] for b in buyer_metrics]) / len(buyer_metrics) if buyer_metrics else 0,
    }
