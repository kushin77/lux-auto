"""Unit tests for Lux-Auto authentication module"""

import pytest
from sqlalchemy.orm import Session

from backend.auth.user_service import UserService
from backend.auth.session_service import SessionService
from backend.database.models import User, UserSession


class TestUserService:
    """Test User Service"""
    
    def test_get_or_create_user_new(self, test_db_session: Session, mock_user_email: str):
        """Test creating a new user"""
        service = UserService(lambda: test_db_session, admin_email="admin@example.com")
        
        user = service.get_or_create_user(test_db_session, email=mock_user_email)
        
        assert user is not None
        assert user.email == mock_user_email
        assert user.role == "user"  # Regular user, not admin
        assert user.active is True
    
    def test_get_or_create_user_existing(self, test_db_session: Session, mock_user_email: str):
        """Test getting existing user"""
        service = UserService(lambda: test_db_session, admin_email="admin@example.com")
        
        # Create user first time
        user1 = service.get_or_create_user(test_db_session, email=mock_user_email)
        test_db_session.commit()
        
        # Get same user second time
        user2 = service.get_or_create_user(test_db_session, email=mock_user_email)
        
        assert user1.id == user2.id
        assert user2.email == mock_user_email
    
    def test_admin_user_creation(self, test_db_session: Session, admin_user_email: str):
        """Test admin user gets admin role"""
        service = UserService(lambda: test_db_session, admin_email=admin_user_email)
        
        user = service.get_or_create_user(test_db_session, email=admin_user_email)
        
        assert user.email == admin_user_email
        assert user.role == "admin"
    
    def test_non_admin_user_creation(self, test_db_session: Session):
        """Test non-admin user gets user role"""
        service = UserService(lambda: test_db_session, admin_email="admin@example.com")
        
        user = service.get_or_create_user(test_db_session, email="regular@example.com")
        
        assert user.email == "regular@example.com"
        assert user.role == "user"
    
    def test_activate_user(self, test_db_session: Session, mock_user_email: str):
        """Test user activation"""
        service = UserService(lambda: test_db_session, admin_email="admin@example.com")
        user = service.get_or_create_user(test_db_session, email=mock_user_email)
        test_db_session.commit()
        
        user.active = False
        test_db_session.commit()
        
        activated_user = test_db_session.query(User).filter(User.email == mock_user_email).first()
        assert activated_user.active is False
        
        service.activate_user(test_db_session, user.id)
        
        activated_user = test_db_session.query(User).filter(User.email == mock_user_email).first()
        assert activated_user.active is True


class TestSessionService:
    """Test Session Service"""
    
    def test_create_session(self, test_db_session: Session, mock_user_email: str):
        """Test session creation"""
        user_service = UserService(lambda: test_db_session, admin_email="admin@example.com")
        session_service = SessionService(lambda: test_db_session)
        
        user = user_service.get_or_create_user(test_db_session, email=mock_user_email)
        test_db_session.commit()
        
        session = session_service.create_session(
            test_db_session,
            user_id=user.id,
            token="test_token",
            ip_address="127.0.0.1",
            user_agent="Test Browser",
        )
        
        assert session is not None
        assert session.user_id == user.id
        assert session.active is True
        assert session.revoked_at is None
    
    def test_validate_session(self, test_db_session: Session, mock_user_email: str):
        """Test session validation"""
        user_service = UserService(lambda: test_db_session, admin_email="admin@example.com")
        session_service = SessionService(lambda: test_db_session)
        
        user = user_service.get_or_create_user(test_db_session, email=mock_user_email)
        test_db_session.commit()
        
        session = session_service.create_session(
            test_db_session,
            user_id=user.id,
            token="test_token",
            ip_address="127.0.0.1",
            user_agent="Test Browser",
        )
        test_db_session.commit()
        
        # Token is hashed, so validate with hash
        import hashlib
        token_hash = hashlib.sha256("test_token".encode()).hexdigest()
        
        validated = session_service.validate_session(
            test_db_session,
            user_id=user.id,
            token_hash=token_hash,
        )
        
        assert validated is not None
    
    def test_revoke_session(self, test_db_session: Session, mock_user_email: str):
        """Test session revocation"""
        user_service = UserService(lambda: test_db_session, admin_email="admin@example.com")
        session_service = SessionService(lambda: test_db_session)
        
        user = user_service.get_or_create_user(test_db_session, email=mock_user_email)
        test_db_session.commit()
        
        session = session_service.create_session(
            test_db_session,
            user_id=user.id,
            token="test_token",
            ip_address="127.0.0.1",
            user_agent="Test Browser",
        )
        test_db_session.commit()
        
        session_service.revoke_session(test_db_session, session.id)
        
        revoked_session = test_db_session.query(UserSession).filter(UserSession.id == session.id).first()
        assert revoked_session.active is False
        assert revoked_session.revoked_at is not None
