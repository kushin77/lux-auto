"""
RBAC Service - Role-Based Access Control

Manages user roles, permissions, and access control enforcement.
"""

from enum import Enum
from typing import Dict, Set, List, Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_

# Note: These would normally come from database models
# For now, we define them here for the service


class PortalRole(Enum):
    """Available user roles"""
    VIEWER = "VIEWER"
    ANALYST = "ANALYST"
    ADMIN = "ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"


class PortalPermission(Enum):
    """Available permissions"""
    READ_DEALS = "read:deals"
    WRITE_DEALS = "write:deals"
    APPROVE_DEALS = "approve:deals"
    READ_ANALYTICS = "read:analytics"
    READ_BUYERS = "read:buyers"
    WRITE_BUYERS = "write:buyers"
    READ_AUDIT = "read:audit"
    MANAGE_USERS = "manage:users"
    MANAGE_SETTINGS = "manage:settings"


# Permission matrix: Role -> Set of Permissions
ROLE_PERMISSIONS: Dict[PortalRole, Set[PortalPermission]] = {
    PortalRole.VIEWER: {
        PortalPermission.READ_DEALS,
        PortalPermission.READ_ANALYTICS,
        PortalPermission.READ_BUYERS,
    },
    PortalRole.ANALYST: {
        PortalPermission.READ_DEALS,
        PortalPermission.WRITE_DEALS,
        PortalPermission.READ_ANALYTICS,
        PortalPermission.READ_BUYERS,
        PortalPermission.WRITE_BUYERS,
    },
    PortalRole.ADMIN: {
        PortalPermission.READ_DEALS,
        PortalPermission.WRITE_DEALS,
        PortalPermission.APPROVE_DEALS,
        PortalPermission.READ_ANALYTICS,
        PortalPermission.READ_BUYERS,
        PortalPermission.WRITE_BUYERS,
        PortalPermission.READ_AUDIT,
        PortalPermission.MANAGE_USERS,
    },
    PortalRole.SUPER_ADMIN: {
        PortalPermission.READ_DEALS,
        PortalPermission.WRITE_DEALS,
        PortalPermission.APPROVE_DEALS,
        PortalPermission.READ_ANALYTICS,
        PortalPermission.READ_BUYERS,
        PortalPermission.WRITE_BUYERS,
        PortalPermission.READ_AUDIT,
        PortalPermission.MANAGE_USERS,
        PortalPermission.MANAGE_SETTINGS,
    },
}


class RBACService:
    """Role-Based Access Control Service"""
    
    def __init__(self, db_session_factory):
        """Initialize RBAC service"""
        self.db = db_session_factory
    
    async def get_user_roles(self, user_id: UUID) -> List[PortalRole]:
        """
        Get all roles assigned to a user.
        
        Args:
            user_id: The user's UUID
            
        Returns:
            List of PortalRole enums assigned to the user
        """
        # TODO: Query user_roles table
        # SELECT role FROM user_roles 
        # WHERE user_id = ? AND (expires_at IS NULL OR expires_at > NOW())
        return []
    
    async def get_user_permissions(self, user_id: UUID) -> Set[PortalPermission]:
        """
        Get all permissions for a user based on their roles.
        
        Args:
            user_id: The user's UUID
            
        Returns:
            Set of PortalPermission enums
        """
        roles = await self.get_user_roles(user_id)
        permissions: Set[PortalPermission] = set()
        
        for role in roles:
            permissions.update(ROLE_PERMISSIONS.get(PortalRole[role], set()))
        
        return permissions
    
    async def has_permission(
        self,
        user_id: UUID,
        permission: PortalPermission
    ) -> bool:
        """
        Check if user has specific permission.
        
        Args:
            user_id: The user's UUID
            permission: The PortalPermission to check
            
        Returns:
            True if user has permission, False otherwise
        """
        permissions = await self.get_user_permissions(user_id)
        return permission in permissions
    
    async def has_role(
        self,
        user_id: UUID,
        role: PortalRole
    ) -> bool:
        """
        Check if user has specific role.
        
        Args:
            user_id: The user's UUID
            role: The PortalRole to check
            
        Returns:
            True if user has role, False otherwise
        """
        roles = await self.get_user_roles(user_id)
        return role in roles
    
    async def assign_role(
        self,
        user_id: UUID,
        role: PortalRole,
        assigned_by: UUID,
        expires_at: Optional[datetime] = None,
    ) -> bool:
        """
        Assign a role to a user.
        
        Args:
            user_id: The user to assign role to
            role: The PortalRole to assign
            assigned_by: The admin user ID who is assigning the role
            expires_at: Optional expiration date for the role
            
        Returns:
            True if assignment successful, False if role already exists
        """
        # TODO: Insert into user_roles table
        # INSERT INTO user_roles (user_id, role, assigned_by, expires_at, assigned_at)
        # VALUES (?, ?, ?, ?, NOW())
        # ON CONFLICT (user_id, role) DO NOTHING
        return True
    
    async def revoke_role(
        self,
        user_id: UUID,
        role: PortalRole,
    ) -> bool:
        """
        Revoke a role from a user.
        
        Args:
            user_id: The user to revoke role from
            role: The PortalRole to revoke
            
        Returns:
            True if revocation successful, False if role not found
        """
        # TODO: Delete from user_roles table
        # DELETE FROM user_roles 
        # WHERE user_id = ? AND role = ?
        return True
    
    async def ensure_admin_role(
        self,
        admin_email: str,
    ) -> None:
        """
        Ensure at least one admin user has SUPER_ADMIN role.
        Called during initialization.
        
        Args:
            admin_email: Email of the admin user to ensure has SUPER_ADMIN role
        """
        # TODO: Find user by email
        # If not found, create  user
        # If found, ensure has SUPER_ADMIN role
        pass
    
    def get_permission_description(self, permission: PortalPermission) -> str:
        """Get human-readable description of a permission"""
        descriptions = {
            PortalPermission.READ_DEALS: "View deals in the system",
            PortalPermission.WRITE_DEALS: "Create and edit deals",
            PortalPermission.APPROVE_DEALS: "Approve/reject deals for bidding",
            PortalPermission.READ_ANALYTICS: "View analytics and reporting dashboards",
            PortalPermission.READ_BUYERS: "View buyer network",
            PortalPermission.WRITE_BUYERS: "Create and edit buyer profiles",
            PortalPermission.READ_AUDIT: "View audit logs and compliance data",
            PortalPermission.MANAGE_USERS: "Manage user accounts and roles",
            PortalPermission.MANAGE_SETTINGS: "Manage system settings and configuration",
        }
        return descriptions.get(permission, permission.value)
    
    def get_role_description(self, role: PortalRole) -> str:
        """Get human-readable description of a role"""
        descriptions = {
            PortalRole.VIEWER: "Read-only access to deals, analytics, and buyers",
            PortalRole.ANALYST: "Can score, bid, and manage buyer network",
            PortalRole.ADMIN: "Can approve deals, manage users, and view audit logs",
            PortalRole.SUPER_ADMIN: "Full system access including settings and configuration",
        }
        return descriptions.get(role, role.value)


def get_rbac_service(db_session_factory) -> RBACService:
    """Factory function to create RBACService instance"""
    return RBACService(db_session_factory)
