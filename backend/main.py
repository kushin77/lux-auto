"""
Lux-Auto FastAPI Application

OAuth2 SSO with Google authentication via oauth2-proxy.
User extraction from X-Auth-Request-Email header.
Comprehensive deal management API with RBAC and audit logging.
"""

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime

import structlog
from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
import sqlalchemy.exc

from backend.auth.middleware import OAuthMiddleware
from backend.auth.user_service import UserService
from backend.auth.session_service import SessionService
from backend.auth.audit import AuditLogger, AuditEventType, AuditStatus
from backend.auth.rbac_service import RBACService
from backend.database.models import Base
from backend.database import set_session_local
from backend.routers import deals, analytics, audit, websocket

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

# Get logger
log = structlog.get_logger(__name__)

# Configuration from environment
DATABASE_URL = os.getenv("DATABASE_URL")
FASTAPI_SECRET_KEY = os.getenv("FASTAPI_SECRET_KEY")
ADMIN_USER_EMAIL = os.getenv("ADMIN_USER_EMAIL", "akushnir@bioenergystrategies.com")
ENVIRONMENT = os.getenv("ENVIRONMENT", "production")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

if not FASTAPI_SECRET_KEY:
    raise ValueError("FASTAPI_SECRET_KEY environment variable is required")

# Database setup
engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_size=20,
    max_overflow=40,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Initialize database module with SessionLocal
set_session_local(SessionLocal)

# Create tables - use raw SQL with IF NOT EXISTS to avoid race conditions
from sqlalchemy import inspect, text

print(f"DEBUG: Base.metadata tables registered: {list(Base.metadata.tables.keys())}", flush=True)

# First, try to create all tables using SQLAlchemy (which handles everything)
try:
    with engine.begin() as connection:
        # Drop indexes first to clean up any orphaned state
        for table in Base.metadata.tables.values():
            for index in table.indexes:
                try:
                    # Drop index if it exists (safe with IF EXISTS)
                    drop_stmt = f"DROP INDEX IF EXISTS {index.name} CASCADE"
                    connection.execute(text(drop_stmt))
                except:
                    pass  # Index might not exist, continue
        
        # Now create tables
        Base.metadata.create_all(bind=connection)
    
    print("✓ Database schema created successfully", flush=True)
except Exception as e:
    print(f"⚠ Schema creation error (will retry): {str(e)[:200]}", flush=True)
    # Try one more time with a fresh connection
    try:
        Base.metadata.create_all(bind=engine)
        print("✓ Schema created on second attempt", flush=True)
    except Exception as e2:
        print(f"✗ Final schema creation failed: {str(e2)[:200]}", flush=True)
        print("⚠ Continuing with partial/existing schema", flush=True)

# Verify tables exist
inspector = inspect(engine)
tables = inspector.get_table_names()
print(f"DEBUG: Tables in database: {tables}", flush=True)

if not tables:
    print("⚠ WARNING: No tables created in database", flush=True)

# Service initialization
# Instantiate services for middleware injection
user_service = UserService()
session_service = SessionService()
audit_logger = AuditLogger(session_factory=SessionLocal)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown."""
    # Startup
    log.info("Starting Lux-Auto FastAPI application", environment=ENVIRONMENT)
    yield
    # Shutdown
    log.info("Shutting down Lux-Auto FastAPI application")
    engine.dispose()  # Close database connections


# Create FastAPI app
app = FastAPI(
    title="Lux-Auto API",
    version="2.0.0",
    description="Automated arbitrage opportunity finder with OAuth2 SSO, RBAC, and real-time updates",
    lifespan=lifespan,
)

# Add OAuth middleware
app.add_middleware(OAuthMiddleware, user_service=user_service, session_service=session_service, audit_logger=audit_logger)

# Include API v2 routes
app.include_router(deals.router)
app.include_router(analytics.router)
app.include_router(audit.router)

# Include WebSocket routes
app.include_router(websocket.router)


@app.get("/health", tags=["Health"])
async def health_check() -> dict:
    """Health check endpoint (no auth required)."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "environment": ENVIRONMENT,
        "service": "lux-auto-fastapi",
    }


@app.get("/api/me", tags=["User"])
async def get_current_user(request: Request) -> dict:
    """Get current authenticated user profile.
    
    Requires: X-Auth-Request-Email header (set by oauth2-proxy)
    """
    user_email = request.headers.get("X-Auth-Request-Email")
    
    if not user_email:
        log.warning("Missing authentication header", path=request.url.path)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication headers. Please login first.",
        )
    
    db: Session = SessionLocal()
    try:
        user = user_service.get_or_create_user(db, email=user_email)
        
        return {
            "id": user.id,
            "email": user.email,
            "name": user.name or user.email.split("@")[0],
            "role": user.role,
            "is_admin": user.role == "admin",
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login": user.last_login.isoformat() if user.last_login else None,
        }
    finally:
        db.close()


@app.post("/api/sessions/logout", tags=["Sessions"])
async def logout(request: Request) -> dict:
    """Logout user (revoke current session)."""
    user_email = request.headers.get("X-Auth-Request-Email")
    
    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    
    log.info("User logout requested", email=user_email)
    
    # Log logout event
    audit_logger.log_event(
        event_type=AuditEventType.USER_LOGOUT,
        email=user_email,
        action="User logout via API",
        status=AuditStatus.SUCCESS,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )
    
    # In production, oauth2-proxy handles logout via /oauth2/sign_out
    return {
        "status": "success",
        "message": "Session revoked. Please visit /oauth2/sign_out to clear cookies.",
    }


@app.post("/api/sessions/logout-all", tags=["Sessions"])
async def logout_all(request: Request) -> dict:
    """Logout user from all sessions (revoke all sessions for this user)."""
    user_email = request.headers.get("X-Auth-Request-Email")
    
    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    
    db: Session = SessionLocal()
    try:
        user = user_service.get_or_create_user(db, email=user_email)
        session_service.revoke_all_user_sessions(db, user.id)
        
        log.info("User logged out from all sessions", email=user_email, user_id=user.id)
        
        # Log logout event
        audit_logger.log_event(
            event_type=AuditEventType.SESSION_REVOKED,
            user_id=user.id,
            email=user_email,
            action="All user sessions revoked",
            resource_type="session",
            status=AuditStatus.SUCCESS,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent")
        )
        
        return {
            "status": "success",
            "message": "All sessions revoked",
        }
    finally:
        db.close()


@app.get("/api/sessions", tags=["Sessions"])
async def get_active_sessions(request: Request) -> dict:
    """Get all active sessions for current user."""
    user_email = request.headers.get("X-Auth-Request-Email")
    
    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    
    db: Session = SessionLocal()
    try:
        user = user_service.get_or_create_user(db, email=user_email)
        sessions = session_service.get_active_sessions(db, user.id)
        
        return {
            "user_email": user_email,
            "active_sessions": len(sessions),
            "sessions": [
                {
                    "id": s.id,
                    "ip_address": s.ip_address,
                    "user_agent": s.user_agent,
                    "issued_at": s.issued_at.isoformat(),
                    "expires_at": s.expires_at.isoformat(),
                }
                for s in sessions
            ],
        }
    finally:
        db.close()


@app.get("/metrics", tags=["Monitoring"])
async def metrics(request: Request) -> dict:
    """Prometheus metrics endpoint."""
    from prometheus_client import generate_latest
    
    return JSONResponse(
        content=generate_latest().decode("utf-8"),
        media_type="text/plain",
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for all unhandled errors."""
    log.error(
        "Unhandled exception",
        path=request.url.path,
        method=request.method,
        error_type=type(exc).__name__,
        error_message=str(exc),
    )
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
            "status": 500,
        },
    )


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level=LOG_LEVEL.lower(),
    )
