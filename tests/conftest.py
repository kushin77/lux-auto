"""Test fixtures and utilities for Lux-Auto tests"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient

from backend.database.models import Base
from backend.main import app


@pytest.fixture(scope="session")
def test_db_engine():
    """Create test database engine"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_db_session(test_db_engine):
    """Create test database session"""
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_db_engine,
    )
    session = TestingSessionLocal()
    
    # Cleanup before session
    Base.metadata.drop_all(bind=test_db_engine)
    Base.metadata.create_all(bind=test_db_engine)
    
    yield session
    
    # Cleanup after session
    session.close()
    Base.metadata.drop_all(bind=test_db_engine)


@pytest.fixture
def test_client():
    """Create FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def mock_user_email():
    """Standard mock user email for testing"""
    return "test@example.com"


@pytest.fixture
def admin_user_email():
    """Admin user email for testing"""
    return "akushnir@bioenergystrategies.com"
