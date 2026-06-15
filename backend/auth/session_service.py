"""
Session service — issue, list, and revoke user sessions.

oauth2-proxy owns the browser cookie/JWT lifecycle; these rows give us a
server-side audit + revocation surface (e.g. "log out everywhere").
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from backend.clock import utcnow

import structlog

log = structlog.get_logger(__name__)

DEFAULT_TTL = timedelta(hours=12)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class SessionService:
    """CRUD over ``UserSession`` rows."""

    def create_session(
        self,
        user_id: int,
        session,
        ip_address: str | None = None,
        user_agent: str | None = None,
        ttl: timedelta = DEFAULT_TTL,
    ):
        from backend.database.models import UserSession

        raw = secrets.token_urlsafe(32)
        row = UserSession(
            user_id=user_id,
            access_token=raw,
            token_hash=_hash(raw),
            issued_at=utcnow(),
            expires_at=utcnow() + ttl,
            ip_address=ip_address,
            user_agent=(user_agent or "")[:512] or None,
            active=True,
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return row

    def list_user_sessions(self, user_id: int, session):
        """Active, non-expired sessions for a user, newest first."""
        from backend.database.models import UserSession

        return (
            session.query(UserSession)
            .filter(
                UserSession.user_id == user_id,
                UserSession.active.is_(True),
                UserSession.expires_at > utcnow(),
            )
            .order_by(UserSession.issued_at.desc())
            .all()
        )

    def revoke_all_user_sessions(self, user_id: int, session) -> int:
        """Mark every active session for a user as revoked. Returns the count."""
        from backend.database.models import UserSession

        rows = (
            session.query(UserSession)
            .filter(UserSession.user_id == user_id, UserSession.active.is_(True))
            .all()
        )
        for row in rows:
            row.active = False
            row.revoked_at = utcnow()
        session.commit()
        log.info("sessions.revoked_all", user_id=user_id, count=len(rows))
        return len(rows)
