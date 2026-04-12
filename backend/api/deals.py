"""
Deals API v2 endpoints

Comprehensive REST API for deal management.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from backend.database import get_db
from backend.database.models import Deal, AuditLog
from backend.auth.audit import AuditLogger, AuditEventType, AuditStatus
from backend.api.rbac import Permission, check_permission

router = APIRouter(
    prefix="/api/v2/deals",
    tags=["deals"],
    responses={401: {"description": "Unauthorized"}, 403: {"description": "Forbidden"}},
)


class DealResponse:
    """Deal response schema."""
    @staticmethod
    def from_model(deal: Deal) -> dict:
        return {
            "id": deal.id,
            "vin": deal.vin,
            "year": deal.year,
            "make": deal.make,
            "model": deal.model,
            "trim": deal.trim,
            "body_style": deal.body_style,
            "mileage": deal.mileage,
            "transmission": deal.transmission,
            "color": deal.color,
            "interior_color": deal.interior_color,
            "fuel_type": deal.fuel_type,
            "engine": deal.engine,
            "photo_urls": deal.photo_urls,
            "mmr_value": float(deal.mmr_value) if deal.mmr_value else None,
            "estimated_margin": float(deal.estimated_margin) if deal.estimated_margin else None,
            "score": float(deal.score) if deal.score else None,
            "score_breakdown": deal.score_breakdown,
            "status": deal.status,
            "bid_count": deal.bid_count,
            "highest_bid": float(deal.highest_bid) if deal.highest_bid else None,
            "condition_report": deal.condition_report,
            "created_at": deal.created_at.isoformat(),
            "updated_at": deal.updated_at.isoformat(),
        }


@router.get("", response_model=dict)
async def list_deals(
    request: Request,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    status_filter: Optional[str] = Query(None, alias="status"),
    make: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None, ge=0, le=100),
    max_price: Optional[float] = Query(None, ge=0),
    sort_by: str = Query("created_at"),
    order: str = Query("desc", regex="^(asc|desc)$"),
    audit_logger: AuditLogger = Depends(lambda: None),
):
    """List deals with pagination, filtering, and sorting.
    
    Permissions: read:deals
    """
    if not hasattr(request.state, "user"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    user = request.state.user
    if not check_permission(db, user.id, Permission.READ_DEALS):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{Permission.READ_DEALS}' required"
        )
    
    # Build query
    query = db.query(Deal)
    
    # Apply filters
    if status_filter:
        valid_statuses = ['scanning', 'scored', 'bidding', 'won', 'routed', 'closed']
        if status_filter not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            )
        query = query.filter(Deal.status == status_filter)
    
    if make:
        query = query.filter(Deal.make.ilike(f"%{make}%"))
    
    if model:
        query = query.filter(Deal.model.ilike(f"%{model}%"))
    
    if min_score:
        query = query.filter(Deal.score >= min_score)
    
    if max_price:
        query = query.filter(Deal.mmr_value <= max_price)
    
    # Sorting
    sort_column = getattr(Deal, sort_by, Deal.created_at)
    if order.lower() == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    items = query.offset(skip).limit(limit).all()
    
    return {
        "items": [DealResponse.from_model(item) for item in items],
        "total": total,
        "skip": skip,
        "limit": limit,
        "hasMore": (skip + limit) < total,
    }


@router.get("/{deal_id}", response_model=dict)
async def get_deal(
    deal_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Get single deal details.
    
    Permissions: read:deals
    """
    if not hasattr(request.state, "user"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    user = request.state.user
    if not check_permission(db, user.id, Permission.READ_DEALS):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{Permission.READ_DEALS}' required"
        )
    
    deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deal {deal_id} not found"
        )
    
    return DealResponse.from_model(deal)


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_deal(
    deal_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    audit_logger: AuditLogger = Depends(lambda: None),
):
    """Create new deal.
    
    Permissions: write:deals
    """
    if not hasattr(request.state, "user"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    user = request.state.user
    if not check_permission(db, user.id, Permission.WRITE_DEALS):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{Permission.WRITE_DEALS}' required"
        )
    
    # Validate required fields
    required_fields = ["id", "vin", "year", "make", "model"]
    for field in required_fields:
        if field not in deal_data:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Missing required field: {field}"
            )
    
    # Create deal
    try:
        deal = Deal(**deal_data)
        db.add(deal)
        db.commit()
        db.refresh(deal)
        
        # Log the action
        if audit_logger:
            audit_logger.log_event(
                event_type=AuditEventType.API_CALL,
                user_id=user.id,
                email=user.email,
                action=f"Created deal {deal.id}",
                resource_type="deal",
                resource_id=deal.id,
                new_values={"id": deal.id, "vin": deal.vin},
                status=AuditStatus.SUCCESS,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("User-Agent"),
            )
        
        return DealResponse.from_model(deal)
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create deal: {str(e)}"
        )


@router.put("/{deal_id}", response_model=dict)
async def update_deal(
    deal_id: str,
    update_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    audit_logger: AuditLogger = Depends(lambda: None),
):
    """Update deal.
    
    Permissions: write:deals
    """
    if not hasattr(request.state, "user"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    user = request.state.user
    if not check_permission(db, user.id, Permission.WRITE_DEALS):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{Permission.WRITE_DEALS}' required"
        )
    
    deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deal {deal_id} not found"
        )
    
    try:
        # Store old values for audit
        old_values = {col.name: getattr(deal, col.name) for col in deal.__table__.columns}
        
        # Update fields
        for key, value in update_data.items():
            if hasattr(deal, key):
                setattr(deal, key, value)
        
        deal.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(deal)
        
        # Log the action
        if audit_logger:
            audit_logger.log_event(
                event_type=AuditEventType.DATA_MODIFICATION,
                user_id=user.id,
                email=user.email,
                action=f"Updated deal {deal.id}",
                resource_type="deal",
                resource_id=deal.id,
                old_values=old_values,
                new_values=update_data,
                status=AuditStatus.SUCCESS,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("User-Agent"),
            )
        
        return DealResponse.from_model(deal)
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update deal: {str(e)}"
        )


@router.delete("/{deal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deal(
    deal_id: str,
    request: Request,
    db: Session = Depends(get_db),
    audit_logger: AuditLogger = Depends(lambda: None),
):
    """Delete deal (admin only).
    
    Permissions: delete:deals
    """
    if not hasattr(request.state, "user"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    user = request.state.user
    if not check_permission(db, user.id, Permission.DELETE_DEALS):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{Permission.DELETE_DEALS}' required"
        )
    
    deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deal {deal_id} not found"
        )
    
    try:
        db.delete(deal)
        db.commit()
        
        # Log the action
        if audit_logger:
            audit_logger.log_event(
                event_type=AuditEventType.DATA_MODIFICATION,
                user_id=user.id,
                email=user.email,
                action=f"Deleted deal {deal.id}",
                resource_type="deal",
                resource_id=deal.id,
                status=AuditStatus.SUCCESS,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("User-Agent"),
            )
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete deal: {str(e)}"
        )
