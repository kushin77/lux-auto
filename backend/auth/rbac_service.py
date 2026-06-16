"""
Role-based access control.

A small, explicit permission matrix keyed by ``UserRole``. Permissions use the
``verb:resource`` convention (e.g. ``approve:deals``). Higher roles inherit the
permissions of the roles below them.
"""

from __future__ import annotations

import structlog

from backend.auth.user_service import UserRole

log = structlog.get_logger(__name__)

# Permissions granted directly to each role (before inheritance).
_DIRECT: dict[UserRole, set[str]] = {
    UserRole.VIEWER: {"read:deals", "read:analytics"},
    UserRole.USER: {"read:deals", "read:analytics", "read:buyers"},
    UserRole.ANALYST: {"write:buyers", "export:analytics", "read:audit"},
    UserRole.ADMIN: {"approve:deals", "reject:deals", "write:config", "manage:users"},
    UserRole.SUPER_ADMIN: {"manage:roles", "manage:api_keys", "delete:any"},
}

# Inheritance chain (each role also gets everything from the previous one).
_CHAIN = [
    UserRole.VIEWER,
    UserRole.USER,
    UserRole.ANALYST,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
]


def _effective(role: UserRole) -> set[str]:
    perms: set[str] = set()
    for r in _CHAIN:
        perms |= _DIRECT.get(r, set())
        if r == role:
            break
    return perms


# Pre-compute the effective permission set for every role.
ROLE_PERMISSIONS: dict[UserRole, set[str]] = {r: _effective(r) for r in _CHAIN}


class RBACService:
    """Stateless permission checks against ``ROLE_PERMISSIONS``."""

    @staticmethod
    def _coerce(role) -> UserRole:
        return role if isinstance(role, UserRole) else UserRole(str(role))

    def permissions_for(self, role) -> set[str]:
        return ROLE_PERMISSIONS.get(self._coerce(role), set())

    def has_permission(self, role, permission: str) -> bool:
        return permission in self.permissions_for(role)

    def require_permission(self, role, permission: str) -> None:
        """Raise 403 if ``role`` lacks ``permission``."""
        if not self.has_permission(role, permission):
            from fastapi import HTTPException, status

            log.warning("rbac.denied", role=str(role), permission=permission)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: requires '{permission}'",
            )
