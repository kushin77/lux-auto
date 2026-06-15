"""
OAuth middleware.

oauth2-proxy terminates Google SSO at the edge and forwards the verified
identity in the ``X-Auth-Request-Email`` header. This middleware lifts that
header onto ``request.state`` and binds it to the structured-logging context so
every downstream log line is attributable. Endpoints remain responsible for
their own authorization (via RBAC); this layer only establishes identity.
"""

from __future__ import annotations

import time

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

log = structlog.get_logger(__name__)

# Paths that never require an identity (health checks, metrics, API docs).
PUBLIC_PATHS = ("/health", "/metrics", "/docs", "/redoc", "/openapi.json")

AUTH_HEADER = "X-Auth-Request-Email"


class OAuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, user_service=None, session_service=None, audit_logger=None):
        super().__init__(app)
        self.user_service = user_service
        self.session_service = session_service
        self.audit_logger = audit_logger

    async def dispatch(self, request: Request, call_next):
        email = request.headers.get(AUTH_HEADER)
        request.state.user_email = email
        request.state.user_id = None

        structlog.contextvars.bind_contextvars(
            path=request.url.path,
            method=request.method,
            user_email=email or "anonymous",
        )

        start = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            structlog.contextvars.unbind_contextvars("path", "method", "user_email")

        elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
        response.headers["X-Response-Time-ms"] = str(elapsed_ms)

        if not request.url.path.startswith(PUBLIC_PATHS):
            log.info(
                "request.completed",
                status_code=response.status_code,
                elapsed_ms=elapsed_ms,
            )
        return response
