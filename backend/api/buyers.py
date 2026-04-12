"""
Buyers API v2 endpoints

REST API for buyer management and matching.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend.database.models import Buyer, AuditLog
from backend.auth.audit import AuditLogger, AuditEventType, AuditStatus
from backend.api.rbac import Permission, check_permission

router = APIRouter(
    prefix="/api/v2/buyers",
    tags=["buyers"],
)


@router.get("", response_model=dict)
async def list_buyers(
    request: Request,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    sort_by: str = Query("created_at"),
    order: str = Query("desc", regex="^(asc|desc)$"),
):
    """List buyers with pagination."""
    if not hasattr(request.state, "user"):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = request.state.user
    if not check_permission(db, user.id, Permission.READ_BUYERS):
        raise HTTPException(status_code=403, detail=f"Permission '{Permission.READ_BUYERS}' required")
    
    query = db.query(Buyer)
    total = query.count()
    
    sort_column = getattr(Buyer, sort_by, Buyer.created_at)
    if order.lower() == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())
    
    items = query.offset(skip).limit(limit).all()
    
    return {
        "items": [b.to_dict() for b in items],
        "total": total,
        "skip": skip,
        "limit": limit,
        "hasMore": (skip + limit) < total,
    }


@router.get("/{buyer_id}", response_model=dict)
async def get_buyer(
    buyer_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Get buyer details."""
    if not hasattr(request.state, "user"):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = request.state.user
    if not check_permission(db, user.id, Permission.READ_BUYERS):
        raise HTTPException(status_code=403, detail=f"Permission '{Permission.READ_BUYERS}' required")
    
    buyer = db.query(Buyer).filter(Buyer.id == buyer_id).first()
    if not buyer:
        raise HTTPException(status_code=404, detail=f"Buyer {buyer_id} not found")
    
    return buyer.to_dict()


@router.post("", response_model=dict, status_code=201)
async def create_buyer(
    buyer_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    audit_logger: AuditLogger = Depends(lambda: None),
):
    """Create buyer."""
    if not hasattr(request.state, "user"):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = request.state.user
    if not check_permission(db, user.id, Permission.WRITE_BUYERS):
        raise HTTPException(status_code=403, detail=f"Permission '{Permission.WRITE_BUYERS}' required")
    
    try:
        buyer = Buyer(**buyer_data)
        db.add(buyer)
        db.commit()
        db.refresh(buyer)
        
        if audit_logger:
            audit_logger.log_event(
                event_type=AuditEventType.DATA_MODIFICATION,
                user_id=user.id,
                email=user.email,
                action=f"Created buyer {buyer.id}",
                resource_type="buyer",
                resource_id=buyer.id,
                new_values={"id": buyer.id, "name": buyer.name},
                status=AuditStatus.SUCCESS,
                ip_address=request.client.host if request.client else None,
            )
        
        return buyer.to_dict()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create buyer: {str(e)}")


@router.put("/{buyer_id}", response_model=dict)
async def update_buyer(
    buyer_id: str,
    update_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    audit_logger: AuditLogger = Depends(lambda: None),
):
    """Update buyer."""
    if not hasattr(request.state, "user"):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = request.state.user
    if not check_permission(db, user.id, Permission.WRITE_BUYERS):
        raise HTTPException(status_code=403, detail=f"Permission '{Permission.WRITE_BUYERS}' required")
    
    buyer = db.query(Buyer).filter(Buyer.id == buyer_id).first()
    if not buyer:
        raise HTTPException(status_code=404, detail=f"Buyer {buyer_id} not found")
    
    try:
        for key, value in update_data.items():
            if hasattr(buyer, key):
                setattr(buyer, key, value)
        
        db.commit()
        db.refresh(buyer)
        
        if audit_logger:
            audit_logger.log_event(
                event_type=AuditEventType.DATA_MODIFICATION,
                user_id=user.id,
                email=user.email,
                action=f"Updated buyer {buyer.id}",
                resource_type="buyer",
                resource_id=buyer.id,
                new_values=update_data,
                status=AuditStatus.SUCCESS,
                ip_address=request.client.host if request.client else None,
            )
        
        return buyer.to_dict()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to update buyer: {str(e)}")


@router.delete("/{buyer_id}", status_code=204)
async def delete_buyer(
    buyer_id: str,
    request: Request,
    db: Session = Depends(get_db),
    audit_logger: AuditLogger = Depends(lambda: None),
):
    """Delete buyer."""
    if not hasattr(request.state, "user"):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = request.state.user
    if not check_permission(db, user.id, Permission.DELETE_BUYERS):
        raise HTTPException(status_code=403, detail=f"Permission '{Permission.DELETE_BUYERS}' required")
    
    buyer = db.query(Buyer).filter(Buyer.id == buyer_id).first()
    if not buyer:
        raise HTTPException(status_code=404, detail=f"Buyer {buyer_id} not found")
    
    try:
        db.delete(buyer)
        db.commit()
        
        if audit_logger:
            audit_logger.log_event(
                event_type=AuditEventType.DATA_MODIFICATION,
                user_id=user.id,
                email=user.email,
                action=f"Deleted buyer {buyer_id}",
                resource_type="buyer",
                resource_id=buyer_id,
                status=AuditStatus.SUCCESS,
                ip_address=request.client.host if request.client else None,
            )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete buyer: {str(e)}")
