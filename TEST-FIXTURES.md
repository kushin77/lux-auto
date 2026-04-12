# Test Configuration and Fixtures

## pytest.ini

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = 
    -v
    --strict-markers
    --tb=short
    --disable-warnings
markers =
    unit: Unit tests
    integration: Integration tests
    e2e: End-to-end tests
    slow: Slow tests
    security: Security tests
asyncio_mode = auto
```

## conftest.py

```python
# tests/conftest.py
import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
import jwt

# Import app and models
from backend.main import app, get_db
from backend.database import Base
from backend.models import User, Deal, Buyer, AuditLog

# Test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

@pytest.fixture(scope="session")
def test_db():
    """Create test database"""
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db_session(test_db):
    """Get test database session"""
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_db
    )
    session = TestingSessionLocal()
    
    yield session
    
    session.rollback()
    session.close()

@pytest.fixture
def client(db_session):
    """Get test client"""
    def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()

@pytest.fixture
def admin_token():
    """Generate admin JWT token"""
    payload = {
        "sub": "admin@test.com",
        "role": "ADMIN",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    token = jwt.encode(
        payload,
        os.getenv("JWT_SECRET", "test-secret"),
        algorithm="HS256"
    )
    return token

@pytest.fixture
def analyst_token():
    """Generate analyst JWT token"""
    payload = {
        "sub": "analyst@test.com",
        "role": "ANALYST",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    token = jwt.encode(
        payload,
        os.getenv("JWT_SECRET", "test-secret"),
        algorithm="HS256"
    )
    return token

@pytest.fixture
def viewer_token():
    """Generate viewer JWT token"""
    payload = {
        "sub": "viewer@test.com",
        "role": "VIEWER",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    token = jwt.encode(
        payload,
        os.getenv("JWT_SECRET", "test-secret"),
        algorithm="HS256"
    )
    return token

@pytest.fixture
def admin_headers(admin_token):
    """Headers for admin user"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }

@pytest.fixture
def analyst_headers(analyst_token):
    """Headers for analyst user"""
    return {
        "Authorization": f"Bearer {analyst_token}",
        "Content-Type": "application/json"
    }

@pytest.fixture
def viewer_headers(viewer_token):
    """Headers for viewer user"""
    return {
        "Authorization": f"Bearer {viewer_token}",
        "Content-Type": "application/json"
    }

@pytest.fixture
def sample_deal(db_session):
    """Create sample deal for testing"""
    deal = Deal(
        vin="WVWZZZ3CZ9E123456",
        year=2020,
        make="Volkswagen",
        model="Golf",
        listing_price=15000.0,
        mmr_value=16000.0,
        status="pending",
        created_at=datetime.utcnow(),
        created_by="test@test.com"
    )
    db_session.add(deal)
    db_session.commit()
    db_session.refresh(deal)
    return deal

@pytest.fixture
def sample_buyer(db_session):
    """Create sample buyer for testing"""
    buyer = Buyer(
        name="John Smith",
        email="john@test.com",
        phone="+12125551234",
        company="Test LLC",
        status="active",
        region="NY",
        created_at=datetime.utcnow()
    )
    db_session.add(buyer)
    db_session.commit()
    db_session.refresh(buyer)
    return buyer

@pytest.fixture
def audit_log_cleanup(db_session):
    """Ensure audit logs are clean before test"""
    db_session.query(AuditLog).delete()
    db_session.commit()
    yield
    db_session.query(AuditLog).delete()
    db_session.commit()
```

## API Response Helpers

```python
# tests/helpers.py
from typing import Any, Dict

def assert_paginated_response(response: Dict[str, Any]):
    """Validate paginated API response structure"""
    assert "data" in response
    assert "meta" in response
    assert "page" in response["meta"]
    assert "per_page" in response["meta"]
    assert "total" in response["meta"]
    assert isinstance(response["data"], list)

def assert_error_response(response: Dict[str, Any], code: str):
    """Validate error response structure"""
    assert "error" in response
    assert response["error"]["code"] == code
    assert "message" in response["error"]

def create_deal_payload(**kwargs) -> Dict[str, Any]:
    """Helper to create deal payload with defaults"""
    defaults = {
        "vin": "WVWZZZ3CZ9E123456",
        "year": 2020,
        "make": "Volkswagen",
        "model": "Golf",
        "trim": "S",
        "listing_price": 15000.0,
        "mmr_value": 16000.0,
    }
    defaults.update(kwargs)
    return defaults

def create_buyer_payload(**kwargs) -> Dict[str, Any]:
    """Helper to create buyer payload with defaults"""
    defaults = {
        "name": "John Smith",
        "email": "john@test.com",
        "phone": "+12125551234",
        "company": "Test LLC",
        "region": "NY",
    }
    defaults.update(kwargs)
    return defaults
```

---

## Test Directory Structure

```
tests/
├── unit/
│   ├── test_models.py
│   ├── test_services.py
│   └── test_utils.py
├── integration/
│   ├── test_api_deals.py
│   ├── test_api_buyers.py
│   ├── test_api_analytics.py
│   ├── test_database.py
│   └── test_rbac.py
├── e2e/
│   ├── deals.spec.ts
│   ├── buyers.spec.ts
│   ├── analytics.spec.ts
│   └── admin.spec.ts
├── performance/
│   ├── load_test.js
│   └── stress_test.js
├── conftest.py
└── helpers.py
```

---

## playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'https://appsmith.lux.kushnir.cloud',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: 'docker-compose up -d',
    url: 'https://appsmith.lux.kushnir.cloud',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

---

Last Updated: April 12, 2026
