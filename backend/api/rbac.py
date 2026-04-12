"""
RBAC (Role-Based Access Control) utilities for Lux-Auto

Provides permission checking and authorization decorators.
"""

from fastapi import HTTPException, Request, status
from functools import wraps
from sqlalchemy.orm import Session
from typing import List, Callable, Any

from backend.database.models import User, UserRole as UserRoleModel


class Permission:
    """Permission constants for API endpoints."""
    # Deal permissions
    READ_DEALS = "read:deals"
    WRITE_DEALS = "write:deals"
    APPROVE_DEALS = "approve:deals"
    DELETE_DEALS = "delete:deals"
    
    # Buyer permissions
    READ_BUYERS = "read:buyers"
    WRITE_BUYERS = "write:buyers"
    DELETE_BUYERS = "delete:buyers"
    
    # Analytics permissions
    READ_ANALYTICS = "read:analytics"
    EXPORT_ANALYTICS = "export:analytics"
    
    # Audit permissions
    READ_AUDIT = "read:audit"
    
    # Admin permissions
    MANAGE_USERS = "manage:users"
    MANAGE_ROLES = "manage:roles"
    MANAGE_SYSTEM = "manage:system"


class RolePermissionMatrix:
    """Define what permissions each role has."""
    
    ROLES = {
        "VIEWER": [
            Permission.READ_DEALS,
            Permission.READ_BUYERS,
            Permission.READ_ANALYTICS,
        ],
        "ANALYST": [
            Permission.READ_DEALS,
            Permission.WRITE_DEALS,
            Permission.READ_BUYERS,
            Permission.WRITE_BUYERS,
            Permission.READ_ANALYTICS,
            Permission.EXPORT_ANALYTICS,
            Permission.READ_AUDIT,
        ],
        "ADMIN": [
            Permission.READ_DEALS,
            Permission.WRITE_DEALS,
            Permission.APPROVE_DEALS,
            Permission.DELETE_DEALS,
            Permission.READ_BUYERS,
            Permission.WRITE_BUYERS,
            Permission.DELETE_BUYERS,
            Permission.READ_ANALYTICS,
            Permission.EXPORT_ANALYTICS,
            Permission.READ_AUDIT,
            Permission.MANAGE_USERS,
            Permission.MANAGE_ROLES,
        ],
        "SUPER_ADMIN": [
            # SUPER_ADMIN has all permissions
            Permission.READ_DEALS,
            Permission.WRITE_DEALS,
            Permission.APPROVE_DEALS,
            Permission.DELETE_DEALS,
            Permission.READ_BUYERS,
            Permission.WRITE_BUYERS,
            Permission.DELETE_BUYERS,
            Permission.READ_ANALYTICS,
            Permission.EXPORT_ANALYTICS,
            Permission.READ_AUDIT,
            Permission.MANAGE_USERS,
            Permission.MANAGE_ROLES,
            Permission.MANAGE_SYSTEM,
        ],
    }

    @classmethod
    def get_permissions(cls, role: str) -> List[str]:
        """Get list of permissions for a role."""
        return cls.ROLES.get(role, [])

    @classmethod
    def has_permission(cls, role: str, permission: str) -> bool:
        """Check if a role has a specific permission."""
        permissions = cls.get_permissions(role)
        return permission in permissions

    @classmethod
    def get_highest_role(cls, roles: List[str]) -> str:
        """Get the highest privilege role from a list."""
        role_hierarchy = ["VIEWER", "ANALYST", "ADMIN", "SUPER_ADMIN"]
        highest = "VIEWER"
        for role in roles:
            if role in role_hierarchy:
                if role_hierarchy.index(role) > role_hierarchy.index(highest):
                    highest = role
        return highest


def get_user_role(db: Session, user_id: int) -> str:
    """Get the highest role assigned to a user."""
    user_roles = db.query(UserRoleModel).filter(
        UserRoleModel.user_id == user_id
    ).all()
    
    if not user_roles:
        return "VIEWER"  # Default role
    
    role_names = [ur.role for ur in user_roles]
    return RolePermissionMatrix.get_highest_role(role_names)


def check_permission(db: Session, user_id: int, permission: str) -> bool:
    """Check if a user has a specific permission."""
    role = get_user_role(db, user_id)
    return RolePermissionMatrix.has_permission(role, permission)


def require_permission(permission: str):
    """Decorator to require a specific permission on an endpoint."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            # Get request and db from args/kwargs
            request = kwargs.get("request") or (args[0] if args else None)
            db = kwargs.get("db") or next((arg for arg in args if isinstance(arg, Session)), None)
            
            if not request or not db:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Invalid request context"
                )
            
            # Get user from request state (set by middleware)
            user = getattr(request.state, "user", None)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Not authenticated"
                )
            
            # Check permission
            if not check_permission(db, user.id, permission):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission '{permission}' required"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def require_any_permission(*permissions: str):
    """Decorator to require at least one of the specified permissions."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            request = kwargs.get("request") or (args[0] if args else None)
            db = kwargs.get("db") or next((arg for arg in args if isinstance(arg, Session)), None)
            
            if not request or not db:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Invalid request context"
                )
            
            user = getattr(request.state, "user", None)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Not authenticated"
                )
            
            # Check if user has any of the required permissions
            has_any = any(check_permission(db, user.id, perm) for perm in permissions)
            if not has_any:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"One of these permissions required: {', '.join(permissions)}"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator
