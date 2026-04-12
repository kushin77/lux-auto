"""Test fixtures and utilities for Lux-Auto tests"""

import pytest
import asyncio
import os
from typing import Generator
from unittest.mock import Mock, AsyncMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient

from backend.database.models import Base
from backend.main import app


# Event loop fixture for async tests
@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


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


# OAuth headers fixtures
@pytest.fixture
def mock_oauth_headers() -> dict:
    """Fixture providing mock OAuth2 proxy headers for testing."""
    return {
        "X-Auth-Request-Email": "test.user@bioenergystrategies.com",
        "X-Auth-Request-User": "test.user",
        "X-Auth-Request-Groups": "engineers,product",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test",
    }


@pytest.fixture
def mock_oauth_minimal_headers() -> dict:
    """Fixture providing minimal OAuth headers (just email)."""
    return {
        "X-Auth-Request-Email": "minimal@bioenergystrategies.com"
    }


@pytest.fixture
def mock_oauth_admin_headers() -> dict:
    """Fixture providing OAuth headers with admin group."""
    return {
        "X-Auth-Request-Email": "admin@bioenergystrategies.com",
        "X-Auth-Request-User": "admin_user",
        "X-Auth-Request-Groups": "admins,engineers",
    }


# Manheim API fixtures
@pytest.fixture
def mock_manheim_response() -> dict:
    """Fixture providing mock Manheim API auction response."""
    return {
        "auctionId": "ATL-2024-01-15",
        "location": "Atlanta",
        "auctionDate": "2024-01-15",
        "totalVehicles": 250,
        "averagePrice": 15000.00,
        "vehicles": [
            {
                "vin": "JTHBP5C28A5034448",
                "make": "Toyota",
                "model": "Camry",
                "year": 2010,
                "mileage": 145000,
                "condition": "Average",
                "estimatedValue": 9500.00,
                "title": "Clean",
                "exterior": "Silver",
                "interior": "Gray Fabric",
            },
            {
                "vin": "2HGCV41646H555001",
                "make": "Honda",
                "model": "Accord",
                "year": 2015,
                "mileage": 75000,
                "condition": "Good",
                "estimatedValue": 12000.00,
                "title": "Clean",
                "exterior": "Black",
                "interior": "Black Leather",
            },
        ]
    }


@pytest.fixture
def mock_manheim_vehicle_details() -> dict:
    """Fixture providing detailed vehicle information from Manheim."""
    return {
        "vin": "JTHBP5C28A5034448",
        "make": "Toyota",
        "model": "Camry",
        "year": 2010,
        "mileage": 145000,
        "condition": "Average",
        "title": "Clean",
        "exterior": {
            "color": "Silver",
            "condition": "Average",
            "damage": ["Minor rear bumper damage"],
        },
        "interior": {
            "color": "Gray",
            "material": "Fabric",
            "condition": "Good",
        },
        "mechanical": {
            "transmission": "Automatic",
            "engine": "2.5L 4-Cylinder",
            "driveType": "Front-Wheel Drive",
            "mileage": 145000,
        },
        "history": {
            "owners": 3,
            "accidents": 0,
            "titleIssues": False,
            "serviceRecords": 12,
        },
        "pricing": {
            "estimatedValue": 9500.00,
            "marketAverage": 9750.00,
            "low": 8500.00,
            "high": 11000.00,
        }
    }


@pytest.fixture
def mock_manheim_pricing() -> dict:
    """Fixture providing pricing data from Manheim."""
    return {
        "vin": "JTHBP5C28A5034448",
        "pricing": {
            "average": 9500.00,
            "low": 8500.00,
            "high": 11000.00,
            "median": 9600.00,
            "daysSinceListed": 15,
            "marketTrend": "stable",
            "demandLevel": "moderate",
        },
        "comparableVehicles": {
            "count": 42,
            "avgPrice": 9750.00,
            "source": "marketTrack",
        }
    }


# Mock service fixtures
@pytest.fixture
def mock_database_session():
    """Fixture providing mock async database session."""
    mock_session = AsyncMock()
    mock_session.execute = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.rollback = AsyncMock()
    mock_session.close = AsyncMock()
    return mock_session


@pytest.fixture
def mock_redis_client():
    """Fixture providing mock Redis client."""
    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=None)
    mock_redis.set = AsyncMock()
    mock_redis.delete = AsyncMock()
    mock_redis.exists = AsyncMock(return_value=False)
    return mock_redis


@pytest.fixture
def mock_logger():
    """Fixture providing mock logger."""
    return Mock(
        debug=Mock(),
        info=Mock(),
        warning=Mock(),
        error=Mock(),
        critical=Mock(),
    )


# Test data fixtures
@pytest.fixture
def test_user_email_bioenergystrategies() -> str:
    """Fixture providing test Bioenergy Strategies user email."""
    return "test.user@bioenergystrategies.com"


@pytest.fixture
def test_auction_id() -> str:
    """Fixture providing test auction ID."""
    return "ATL-2024-01-15"


@pytest.fixture
def test_vehicle_vin() -> str:
    """Fixture providing test vehicle VIN."""
    return "JTHBP5C28A5034448"


@pytest.fixture(scope="session", autouse=True)
def configure_test_environment():
    """Configure environment for testing."""
    os.environ["ENV"] = "test"
    os.environ["DEBUG"] = "true"
    os.environ["LOG_LEVEL"] = "DEBUG"
    if "DATABASE_URL" not in os.environ:
        os.environ["DATABASE_URL"] = "sqlite:///:memory:"


# Pytest hooks
def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line(
        "markers",
        "asyncio: mark test as async"
    )
    config.addinivalue_line(
        "markers",
        "unit: mark test as unit test"
    )
    config.addinivalue_line(
        "markers",
        "integration: mark test as integration test"
    )
    config.addinivalue_line(
        "markers",
        "slow: mark test as slow running"
    )
    config.addinivalue_line(
        "markers",
        "oauth: mark test as oauth related"
    )
    config.addinivalue_line(
        "markers",
        "manheim: mark test as manheim API related"
    )


def pytest_collection_modifyitems(config, items):
    """Modify test collection - auto-add asyncio marker to async tests."""
    for item in items:
        if asyncio.iscoroutinefunction(item.function):
            item.add_marker(pytest.mark.asyncio)


def pytest_sessionstart(session):
    """Called after the Session object has been created."""
    print("\n" + "="*70)
    print("Starting Lux Auto Test Suite")
    print("="*70 + "\n")
