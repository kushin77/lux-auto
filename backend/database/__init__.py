"""
Database module for Lux-Auto

Provides database session management and models.
"""

from sqlalchemy.orm import Session


# Will be set by main.py
_SessionLocal = None


def set_session_local(session_factory):
    """Set the session factory (called from main.py)."""
    global _SessionLocal
    _SessionLocal = session_factory


def get_db() -> Session:
    """Get database session for dependency injection."""
    if _SessionLocal is None:
        raise RuntimeError("Database not initialized. Call set_session_local() first.")
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Export models
from backend.database.models import (
    Base,
    User,
    UserSession,
    AuditLog,
    UserRole,
    APIKey,
    PortalUserPreferences,
    Deal,
    Buyer,
    SystemConfig,
)

__all__ = [
    "Base",
    "User",
    "UserSession",
    "AuditLog",
    "UserRole",
    "APIKey",
    "PortalUserPreferences",
    "Deal",
    "Buyer",
    "SystemConfig",
    "get_db",
    "set_session_local",
]
