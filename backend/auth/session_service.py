"""
Session Service - Manages OAuth sessions and token lifecycle.

Responsibilities:
- Create sessions after OAuth authentication
- Validate session tokens (check hash, expiration)
- Revoke sessions on logout
- Track session metadata (IP, user-agent)
- Cleanup expired sessions periodically
"""

from sqlalchemy.orm import Session as DBSession
from sqlalchemy import and_
from datetime import datetime, timedelta
import hashlib
import logging

logger = logging.getLogger(__name__)


class SessionService:
    """Manage OAuth2 sessions and token lifecycle."""

    @staticmethod
    def create_session(
        user_id: int,
        access_token: str,
        expires_in: int = 86400,
        ip_address: str = None,
        user_agent: str = None,
        db: DBSession = None,
    ) -> "UserSession":
        """
        Create new session after OAuth authentication.

        Args:
            user_id: ID of authenticated user
            access_token: OAuth2 access token
            expires_in: Session TTL in seconds (default 24h)
            ip_address: Client IP address
            user_agent: Client user-agent string
            db: SQLAlchemy database session

        Returns:
            UserSession object
        """
        from backend.database.models import UserSession

        token_hash = SessionService._hash_token(access_token)
        expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

        session = UserSession(
            user_id=user_id,
            access_token=access_token,
            token_hash=token_hash,
            issued_at=datetime.utcnow(),
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent,
            active=True,
        )

        db.add(session)
        db.commit()

        logger.info(
            f"[AUDIT] Session created: user_id={user_id}, "
            f"expires={expires_at.isoformat()}, ip={ip_address}"
        )
        return session

    @staticmethod
    def validate_session(token: str, db: DBSession) -> bool:
        """
        Check if token is valid and not expired.

        Args:
            token: Raw OAuth2 access token
            db: SQLAlchemy database session

        Returns:
            True if valid, False if invalid or expired
        """
        from backend.database.models import UserSession

        token_hash = SessionService._hash_token(token)
        session = (
            db.query(UserSession)
            .filter(UserSession.token_hash == token_hash)
            .first()
        )

        if not session:
            logger.warning("[SECURITY] Invalid token provided")
            return False

        if not session.active:
            logger.info(f"[AUDIT] Revoked session accessed for user_id={session.user_id}")
            return False

        if datetime.utcnow() >= session.expires_at:
            logger.info(f"[AUDIT] Expired session accessed for user_id={session.user_id}")
            return False

        return True

    @staticmethod
    def revoke_session(token: str, db: DBSession) -> "UserSession":
        """
        Revoke/logout a session.

        Args:
            token: Raw OAuth2 access token
            db: SQLAlchemy database session

        Returns:
            UserSession object (now revoked)
        """
        from backend.database.models import UserSession

        token_hash = SessionService._hash_token(token)
        session = (
            db.query(UserSession)
            .filter(UserSession.token_hash == token_hash)
            .first()
        )

        if session:
            session.revoke()
            db.commit()
            logger.info(f"[AUDIT] Session revoked for user_id={session.user_id}")

        return session

    @staticmethod
    def revoke_all_user_sessions(user_id: int, db: DBSession) -> list:
        """
        Logout user from all devices.

        Called on password change or security incident.

        Args:
            user_id: ID of user to revoke
            db: SQLAlchemy database session

        Returns:
            List of revoked UserSession objects
        """
        from backend.database.models import UserSession

        sessions = (
            db.query(UserSession)
            .filter(
                and_(
                    UserSession.user_id == user_id,
                    UserSession.active == True,
                )
            )
            .all()
        )

        for session in sessions:
            session.revoke()

        db.commit()
        logger.warning(f"[SECURITY] All {len(sessions)} sessions revoked for user_id={user_id}")
        return sessions

    @staticmethod
    def list_user_sessions(user_id: int, db: DBSession) -> list:
        """List all active sessions for a user."""
        from backend.database.models import UserSession

        return (
            db.query(UserSession)
            .filter(
                and_(
                    UserSession.user_id == user_id,
                    UserSession.active == True,
                )
            )
            .all()
        )

    @staticmethod
    def cleanup_expired_sessions(db: DBSession) -> int:
        """
        Delete sessions older than 30 days.

        Called periodically (every 6 hours) to clean up stale sessions.

        Args:
            db: SQLAlchemy database session

        Returns:
            Number of deleted sessions
        """
        from backend.database.models import UserSession

        cutoff_date = datetime.utcnow() - timedelta(days=30)
        deleted = (
            db.query(UserSession)
            .filter(UserSession.expires_at < cutoff_date)
            .delete()
        )

        db.commit()
        logger.info(f"[AUDIT] Session cleanup: deleted {deleted} expired sessions")
        return deleted

    @staticmethod
    def _hash_token(token: str) -> str:
        """
        Hash token for secure storage.

        Never store raw tokens. Use SHA-256 hash for indexed lookups.

        Args:
            token: Raw OAuth2 token string

        Returns:
            64-character hex hash of token
        """
        return hashlib.sha256(token.encode()).hexdigest()
