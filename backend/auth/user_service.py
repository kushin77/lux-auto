"""
User Service - Manages user records and admin initialization.

Responsibilities:
- Get existing user or create new user on first login
- Auto-assign ADMIN role to default admin email
- Track user login activity (last_login timestamp)
- Provide role-based access control helpers
"""

from sqlalchemy.orm import Session
from datetime import datetime
import logging
from enum import Enum

logger = logging.getLogger(__name__)

# Default admin email (first login gets admin role)
ADMIN_USER_EMAIL = "akushnir@bioenergystrategies.com"


class UserRole(str, Enum):
    """Enumeration of user roles."""
    ADMIN = "admin"      # Full access
    USER = "user"        # Standard access
    VIEWER = "viewer"    # Read-only access


class UserService:
    """Service for managing users and authorization."""

    @staticmethod
    def get_or_create_user(email: str, session: Session) -> "User":
        """
        Get existing user or create new user on first login.

        If user is default admin email, assign ADMIN role.
        Otherwise, assign USER role.

        Args:
            email: User email from oauth2-proxy
            session: SQLAlchemy database session

        Returns:
            User object (newly created or existing)
        """
        # Import here to avoid circular imports
        from backend.database.models import User

        # Try to get existing user
        user = session.query(User).filter(User.email == email).first()

        if user:
            # Update last login for returning user
            user.last_login = datetime.utcnow()
            session.commit()
            logger.info(f"[AUDIT] User login: {email}")
            return user

        # New user - create it
        logger.info(f"[AUDIT] New user registration: {email}")

        # Determine role: admin if matches default admin email
        is_admin = email == ADMIN_USER_EMAIL
        role = UserRole.ADMIN if is_admin else UserRole.USER

        user = User(
            email=email,
            name=email.split("@")[0],  # Use email prefix as display name
            role=role,
            active=True,
            created_at=datetime.utcnow(),
            last_login=datetime.utcnow(),
        )

        session.add(user)
        session.commit()

        if is_admin:
            logger.warning(f"[SECURITY] Admin user created: {email}")
        else:
            logger.info(f"[AUDIT] Regular user created: {email} (role={role})")

        return user

    @staticmethod
    def is_admin(user: "User") -> bool:
        """Check if user has admin role."""
        return user.role == UserRole.ADMIN

    @staticmethod
    def is_active(user: "User") -> bool:
        """Check if user account is active."""
        return user.active

    @staticmethod
    def list_admins(session: Session) -> list:
        """List all admin users."""
        from backend.database.models import User

        return (
            session.query(User)
            .filter(User.role == UserRole.ADMIN)
            .all()
        )

    @staticmethod
    def list_all_users(session: Session) -> list:
        """List all users (admin only)."""
        from backend.database.models import User

        return session.query(User).all()

    @staticmethod
    def promote_to_admin(email: str, session: Session) -> "User":
        """
        Promote user to admin role.
        
        Note: Only callable via direct DB or admin endpoint.
        Regular users cannot promote themselves.
        """
        from backend.database.models import User

        user = session.query(User).filter(User.email == email).first()
        if user:
            user.role = UserRole.ADMIN
            session.commit()
            logger.warning(f"[SECURITY] User promoted to admin: {email}")
        return user

    @staticmethod
    def revoke_admin(email: str, session: Session) -> "User":
        """
        Revoke admin role from user.

        Prevents revoking the default admin email.
        """
        from backend.database.models import User

        user = session.query(User).filter(User.email == email).first()
        if user and user.email != ADMIN_USER_EMAIL:
            user.role = UserRole.USER
            session.commit()
            logger.warning(f"[SECURITY] Admin role revoked from: {email}")
        return user

    @staticmethod
    def deactivate_user(email: str, session: Session) -> "User":
        """Deactivate user account (soft delete)."""
        from backend.database.models import User

        user = session.query(User).filter(User.email == email).first()
        if user:
            user.active = False
            session.commit()
            logger.warning(f"[SECURITY] User deactivated: {email}")
        return user

    @staticmethod
    def reactivate_user(email: str, session: Session) -> "User":
        """Reactivate deactivated user account."""
        from backend.database.models import User

        user = session.query(User).filter(User.email == email).first()
        if user:
            user.active = True
            session.commit()
            logger.info(f"[AUDIT] User reactivated: {email}")
        return user

    @staticmethod
    def get_user_by_email(email: str, session: Session) -> "User":
        """Retrieve user by email."""
        from backend.database.models import User

        return session.query(User).filter(User.email == email).first()

    @staticmethod
    def user_exists(email: str, session: Session) -> bool:
        """Check if user already exists."""
        from backend.database.models import User

        user = session.query(User).filter(User.email == email).first()
        return user is not None
