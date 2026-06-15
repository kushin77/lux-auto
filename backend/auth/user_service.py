"""
User service — account provisioning and lookup.

Owns the canonical ``UserRole`` enum (imported by the ORM models). To avoid a
circular import, this module never imports ``backend.database.models`` at module
load time — models are imported lazily inside methods.
"""

from __future__ import annotations

import enum
import os
from datetime import datetime

import structlog

log = structlog.get_logger(__name__)

# Email that is auto-granted ADMIN on first login (Cloud Run env var).
ADMIN_USER_EMAIL = os.getenv("ADMIN_USER_EMAIL", "")


class UserRole(str, enum.Enum):
    """Role hierarchy. ``str`` mixin makes members compare equal to their value
    (e.g. ``UserRole.ADMIN == "admin"``) for ergonomic checks and JSON output."""

    VIEWER = "viewer"
    USER = "user"
    ANALYST = "analyst"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


class UserService:
    """Provision and look up users keyed by their SSO email."""

    def get_or_create_user(self, email: str, session):
        """Return the user for ``email``, creating the row on first sight.

        Updates ``last_login`` on every call. The first-ever user — or any user
        whose email matches ``ADMIN_USER_EMAIL`` — is granted ADMIN.
        """
        from backend.database.models import User  # lazy import avoids cycle

        email = (email or "").strip().lower()
        if not email:
            raise ValueError("email is required")

        user = session.query(User).filter(User.email == email).one_or_none()

        if user is None:
            is_first_user = session.query(User).count() == 0
            role = (
                UserRole.ADMIN
                if (email == ADMIN_USER_EMAIL.lower() or is_first_user)
                else UserRole.USER
            )
            user = User(
                email=email,
                name=email.split("@")[0],
                role=role,
                active=True,
                created_at=datetime.utcnow(),
                last_login=datetime.utcnow(),
                email_verified=True,
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            log.info("user.created", email=email, role=str(role))
        else:
            user.last_login = datetime.utcnow()
            session.commit()

        return user

    def get_user_by_email(self, email: str, session):
        from backend.database.models import User

        return (
            session.query(User)
            .filter(User.email == (email or "").strip().lower())
            .one_or_none()
        )

    def set_role(self, email: str, role: "UserRole | str", session):
        """Update a user's role. Returns the updated user or ``None``."""
        from backend.database.models import User

        user = self.get_user_by_email(email, session)
        if user is None:
            return None
        user.role = UserRole(role) if not isinstance(role, UserRole) else role
        session.commit()
        session.refresh(user)
        log.info("user.role_changed", email=email, role=str(user.role))
        return user
