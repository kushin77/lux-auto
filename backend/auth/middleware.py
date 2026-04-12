"""
OAuth2 Middleware - Extracts authenticated user from oauth2-proxy headers.

Pattern: oauth2-proxy verifies Google OAuth token and passes X-Auth-Request-Email header.
This middleware synchronizes the user to the database on each request.

Data Flow:
  oauth2-proxy → X-Auth-Request-Email header → FastAPI middleware
                                                    ↓
                                          OAuthMiddleware.dispatch()
                                                    ↓
                                          UserService.get_or_create_user()
                                                    ↓
                                          request.state.user populated
"""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from backend.auth.user_service import UserService
from backend.auth.audit import AuditLogger, AuditEventType, AuditStatus
from backend.database import get_db
from typing import Callable, Optional
import logging

logger = logging.getLogger(__name__)


class OAuthMiddleware(BaseHTTPMiddleware):
    """
    Extract authenticated user from oauth2-proxy headers.
    Auto-sync user record on first login.
    Logs authentication events for audit trail.
    """

    # Endpoints that don't require authentication
    PUBLIC_PATHS = {"/health", "/ready", "/docs", "/openapi.json", "/redoc"}

    def __init__(self, app, user_service: UserService, session_service=None, audit_logger: Optional[AuditLogger] = None):
        """Initialize middleware with services.
        
        Args:
            app: FastAPI application
            user_service: UserService instance
            session_service: SessionService instance (optional)
            audit_logger: AuditLogger instance (optional)
        """
        super().__init__(app)
        self.user_service = user_service
        self.session_service = session_service
        self.audit_logger = audit_logger

    async def dispatch(self, request: Request, call_next: Callable):
        """
        Process request:
        1. Skip auth for public endpoints
        2. Extract X-Auth-Request-Email from oauth2-proxy
        3. Get or create user in database
        4. Populate request.state with user info
        """

        # Skip authentication for public endpoints
        if request.url.path in self.PUBLIC_PATHS:
            return await call_next(request)

        # Extract email from oauth2-proxy header
        email = request.headers.get("X-Auth-Request-Email")

        if not email:
            logger.warning(
                f"[SECURITY] Missing X-Auth-Request-Email for {request.method} {request.url.path}"
            )
            # Log security event
            if self.audit_logger:
                self.audit_logger.log_event(
                    event_type=AuditEventType.AUTH_FAILED,
                    email="unknown",
                    action="Missing authentication header",
                    status=AuditStatus.BLOCKED,
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("User-Agent"),
                    error_message="X-Auth-Request-Email header missing"
                )
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})

        # Get or create user in database
        db = next(get_db())
        try:
            user = UserService.get_or_create_user(email=email, session=db)

            # Populate request state with user info
            request.state.email = email
            request.state.user = user
            request.state.is_admin = UserService.is_admin(user)

            logger.info(f"Authenticated: {email} (role={user.role})")
            
            # Log successful authentication
            if self.audit_logger:
                self.audit_logger.log_authentication(
                    email=email,
                    status=AuditStatus.SUCCESS,
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("User-Agent")
                )

        except Exception as e:
            logger.error(f"Error syncing user {email}: {str(e)}", exc_info=True)
            # Log authentication failure
            if self.audit_logger:
                self.audit_logger.log_event(
                    event_type=AuditEventType.AUTH_FAILED,
                    email=email,
                    action="User sync failed",
                    status=AuditStatus.FAILURE,
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("User-Agent"),
                    error_message=str(e)
                )
            return JSONResponse(status_code=500, content={"detail": "Server error"})

        finally:
            db.close()

        # Call next middleware/route handler
        response = await call_next(request)
        return response
