"""
SQLAlchemy ORM Models for Lux-Auto application.

Models:
- User: User account information and role
- UserSession: OAuth session tracking and token management
- AuditLog: Audit trail for compliance and forensics
- UserRole: Role-based access control
- APIKey: API key management for programmatic access
- PortalUserPreferences: User-specific portal settings
- Deal: Vehicle deal information
- Buyer: Buyer profile and preferences
- SystemConfig: System configuration key-value store
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, Text, ForeignKey, Index, DECIMAL, JSON, ARRAY
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.auth.user_service import UserRole

Base = declarative_base()


class User(Base):
    """User account model."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=True)
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, default=datetime.utcnow, nullable=False)
    email_verified = Column(Boolean, default=True, nullable=False)

    # Relationships
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    user_roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan", foreign_keys="[UserRole.user_id]")
    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")
    preferences = relationship("PortalUserPreferences", back_populates="user", cascade="all, delete-orphan", uselist=False)

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', role={self.role})>"

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "role": self.role,
            "active": self.active,
            "created_at": self.created_at.isoformat(),
            "last_login": self.last_login.isoformat(),
        }


class UserSession(Base):
    """User session model for OAuth token tracking."""

    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    access_token = Column(Text, nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    issued_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    user_agent = Column(String(512), nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    revoked_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="sessions")

    # Indexes for common queries
    __table_args__ = (
        Index("ix_user_sessions_user_id_active", "user_id", "active"),
        Index("ix_user_sessions_token_hash", "token_hash"),
        Index("ix_user_sessions_expires_at", "expires_at"),
    )

    def is_valid(self) -> bool:
        """Check if session is still valid."""
        return self.active and datetime.utcnow() < self.expires_at

    def revoke(self) -> None:
        """Mark session as revoked."""
        self.active = False
        self.revoked_at = datetime.utcnow()

    def __repr__(self) -> str:
        return f"<UserSession(id={self.id}, user_id={self.user_id}, active={self.active})>"

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "issued_at": self.issued_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "active": self.active,
        }


class AuditLog(Base):
    """Audit logging model for compliance and forensics."""

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    email = Column(String(255), nullable=True, index=True)
    action = Column(String(255), nullable=False)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(String(255), nullable=True)
    old_values = Column(Text, nullable=True)  # JSON string
    new_values = Column(Text, nullable=True)  # JSON string
    status = Column(String(20), nullable=False, default="success")
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(512), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Indexes for common queries
    __table_args__ = (
        Index("ix_audit_logs_event_type_created_at", "event_type", "created_at"),
        Index("ix_audit_logs_user_id_created_at", "user_id", "created_at"),
        Index("ix_audit_logs_email_created_at", "email", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<AuditLog(id={self.id}, event_type='{self.event_type}', user_id={self.user_id})>"

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "event_type": self.event_type,
            "user_id": self.user_id,
            "email": self.email,
            "action": self.action,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "status": self.status,
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat(),
        }


class UserRole(Base):
    """User role assignment model for RBAC."""

    __tablename__ = "user_roles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(50), nullable=False, index=True)  # VIEWER, ANALYST, ADMIN, SUPER_ADMIN
    assigned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    expires_at = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="user_roles", foreign_keys=[user_id])

    __table_args__ = (
        Index("ix_user_roles_user_role", "user_id", "role"),
    )

    def __repr__(self) -> str:
        return f"<UserRole(user_id={self.user_id}, role='{self.role}')>"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "role": self.role,
            "assigned_at": self.assigned_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
        }


class APIKey(Base):
    """API key model for programmatic access."""

    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    key_hash = Column(String(255), nullable=False, unique=True, index=True)
    key_prefix = Column(String(8), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    last_used_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    scopes = Column(ARRAY(String), default=['read:deals', 'read:analytics'])
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    rotated_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="api_keys")

    def __repr__(self) -> str:
        return f"<APIKey(user_id={self.user_id}, prefix={self.key_prefix}*, name='{self.name}')>"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "key_prefix": self.key_prefix,
            "name": self.name,
            "scopes": self.scopes,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
        }


class PortalUserPreferences(Base):
    """Portal user preferences model."""

    __tablename__ = "portal_user_preferences"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    theme = Column(String(20), default='light')  # light, dark, auto
    dashboard_layout = Column(JSON, default={})
    saved_filters = Column(JSON, default={})
    saved_reports = Column(JSON, default={})
    notifications_enabled = Column(Boolean, default=True)
    email_notifications = Column(Boolean, default=False)
    auto_refresh_interval = Column(Integer, default=30)  # seconds
    items_per_page = Column(Integer, default=50)
    timezone = Column(String(50), default='UTC')
    language = Column(String(10), default='en')
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="preferences")

    def __repr__(self) -> str:
        return f"<PortalUserPreferences(user_id={self.user_id}, theme={self.theme})>"

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "theme": self.theme,
            "notifications_enabled": self.notifications_enabled,
            "auto_refresh_interval": self.auto_refresh_interval,
            "items_per_page": self.items_per_page,
            "timezone": self.timezone,
            "language": self.language,
        }


class Deal(Base):
    """Vehicle deal model."""

    __tablename__ = "deals"

    id = Column(String(255), primary_key=True, index=True)
    vin = Column(String(17), unique=True, nullable=False, index=True)
    year = Column(Integer, nullable=False)
    make = Column(String(100), nullable=False, index=True)
    model = Column(String(100), nullable=False)
    trim = Column(String(100), nullable=True)
    body_style = Column(String(50), nullable=True)
    mileage = Column(Integer, nullable=True)
    transmission = Column(String(50), nullable=True)
    color = Column(String(50), nullable=True)
    interior_color = Column(String(50), nullable=True)
    fuel_type = Column(String(50), nullable=True)
    engine = Column(String(100), nullable=True)
    photo_urls = Column(ARRAY(String), default=[])
    mmr_value = Column(DECIMAL(10, 2), nullable=True)
    estimated_margin = Column(DECIMAL(10, 2), nullable=True)
    score = Column(DECIMAL(5, 2), nullable=True)
    score_breakdown = Column(JSON, default={})
    status = Column(String(50), default='scanning', index=True)  # scanning, scored, bidding, won, routed, closed
    bid_count = Column(Integer, default=0)
    highest_bid = Column(DECIMAL(10, 2), nullable=True)
    condition_report = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_deals_status_created_at", "status", "created_at"),
        Index("ix_deals_make_model", "make", "model"),
    )

    def __repr__(self) -> str:
        return f"<Deal(id={self.id}, vin={self.vin}, status={self.status}, score={self.score})>"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "vin": self.vin,
            "year": self.year,
            "make": self.make,
            "model": self.model,
            "trim": self.trim,
            "body_style": self.body_style,
            "mileage": self.mileage,
            "mmr_value": float(self.mmr_value) if self.mmr_value else None,
            "estimated_margin": float(self.estimated_margin) if self.estimated_margin else None,
            "score": float(self.score) if self.score else None,
            "status": self.status,
            "bid_count": self.bid_count,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class Buyer(Base):
    """Buyer profile model."""

    __tablename__ = "buyers"

    id = Column(String(255), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    location_state = Column(String(2), nullable=True)
    location_city = Column(String(100), nullable=True)
    location_zipcode = Column(String(10), nullable=True)
    make_preferences = Column(ARRAY(String), default=[])
    model_preferences = Column(ARRAY(String), default=[])
    min_price = Column(DECIMAL(10, 2), nullable=True)
    max_price = Column(DECIMAL(10, 2), nullable=True)
    avg_response_time_minutes = Column(Integer, nullable=True)
    match_score = Column(DECIMAL(5, 2), nullable=True, index=True)
    last_contacted_at = Column(DateTime, nullable=True)
    contact_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_buyers_match_score", "match_score"),
    )

    def __repr__(self) -> str:
        return f"<Buyer(id={self.id}, name='{self.name}', email='{self.email}')>"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "location_state": self.location_state,
            "location_city": self.location_city,
            "make_preferences": self.make_preferences,
            "model_preferences": self.model_preferences,
            "min_price": float(self.min_price) if self.min_price else None,
            "max_price": float(self.max_price) if self.max_price else None,
            "match_score": float(self.match_score) if self.match_score else None,
            "contact_count": self.contact_count,
            "success_count": self.success_count,
            "created_at": self.created_at.isoformat(),
        }


class SystemConfig(Base):
    """System configuration key-value store."""

    __tablename__ = "system_config"

    key = Column(String(255), primary_key=True, index=True)
    value = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    def __repr__(self) -> str:
        return f"<SystemConfig(key='{self.key}', value='{self.value}')>"

    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "value": self.value,
            "updated_at": self.updated_at.isoformat(),
        }
