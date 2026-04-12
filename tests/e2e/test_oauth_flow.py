"""End-to-end tests for Lux-Auto OAuth flow and API"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from sqlalchemy.orm import Session

from backend.main import app, SessionLocal, user_service
from backend.database.models import User


@pytest.fixture
def client():
    """Create test client with app"""
    return TestClient(app)


def test_health_check_no_auth(client: TestClient):
    """Test health endpoint does not require authentication"""
    response = client.get("/health")
    
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert "service" in response.json()


def test_api_me_missing_auth_header(client: TestClient):
    """Test /api/me returns 401 without auth header"""
    response = client.get("/api/me")
    
    assert response.status_code == 401
    assert "authentication" in response.json()["detail"].lower()


def test_api_me_with_auth_header_new_user(client: TestClient):
    """Test /api/me creates user on first login"""
    test_email = "newuser@example.com"
    
    response = client.get(
        "/api/me",
        headers={"X-Auth-Request-Email": test_email}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_email
    assert data["role"] == "user"
    assert data["is_admin"] is False


def test_api_me_with_auth_header_existing_user(client: TestClient):
    """Test /api/me returns existing user"""
    test_email = "existing@example.com"
    
    # First request creates user
    response1 = client.get(
        "/api/me",
        headers={"X-Auth-Request-Email": test_email}
    )
    user_id_1 = response1.json()["id"]
    
    # Second request returns same user
    response2 = client.get(
        "/api/me",
        headers={"X-Auth-Request-Email": test_email}
    )
    user_id_2 = response2.json()["id"]
    
    assert response2.status_code == 200
    assert user_id_1 == user_id_2


def test_api_me_admin_user(client: TestClient):
    """Test admin user is identified correctly"""
    admin_email = "akushnir@bioenergystrategies.com"
    
    response = client.get(
        "/api/me",
        headers={"X-Auth-Request-Email": admin_email}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == admin_email
    assert data["role"] == "admin"
    assert data["is_admin"] is True


def test_logout_endpoint(client: TestClient):
    """Test logout endpoint"""
    test_email = "logout@example.com"
    
    # First authenticate
    client.get(
        "/api/me",
        headers={"X-Auth-Request-Email": test_email}
    )
    
    # Then logout
    response = client.post(
        "/api/sessions/logout",
        headers={"X-Auth-Request-Email": test_email}
    )
    
    assert response.status_code == 200
    assert response.json()["status"] == "success"


def test_logout_without_auth(client: TestClient):
    """Test logout without authentication"""
    response = client.post("/api/sessions/logout")
    
    assert response.status_code == 401


def test_active_sessions_endpoint(client: TestClient):
    """Test getting active sessions"""
    test_email = "sessions@example.com"
    
    # Authenticate
    client.get(
        "/api/me",
        headers={"X-Auth-Request-Email": test_email}
    )
    
    # Get sessions
    response = client.get(
        "/api/sessions",
        headers={"X-Auth-Request-Email": test_email}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["user_email"] == test_email
    assert "active_sessions" in data


def test_logout_all_sessions(client: TestClient):
    """Test logging out all sessions"""
    test_email = "logout_all@example.com"
    
    # Authenticate
    client.get(
        "/api/me",
        headers={"X-Auth-Request-Email": test_email}
    )
    
    # Logout all
    response = client.post(
        "/api/sessions/logout-all",
        headers={"X-Auth-Request-Email": test_email}
    )
    
    assert response.status_code == 200
    assert response.json()["status"] == "success"


def test_concurrent_user_creation(client: TestClient):
    """Test concurrent user creation with same email"""
    test_email = "concurrent@example.com"
    
    response1 = client.get(
        "/api/me",
        headers={"X-Auth-Request-Email": test_email}
    )
    
    response2 = client.get(
        "/api/me",
        headers={"X-Auth-Request-Email": test_email}
    )
    
    assert response1.status_code == 200
    assert response2.status_code == 200
    assert response1.json()["id"] == response2.json()["id"]


def test_multiple_different_users(client: TestClient):
    """Test multiple different users can authenticate"""
    emails = [
        "user1@example.com",
        "user2@example.com",
        "user3@example.com",
    ]
    
    user_ids = []
    for email in emails:
        response = client.get(
            "/api/me",
            headers={"X-Auth-Request-Email": email}
        )
        assert response.status_code == 200
        user_ids.append(response.json()["id"])
    
    # All should have unique IDs
    assert len(set(user_ids)) == len(user_ids)
    assert len(user_ids) == 3


@pytest.mark.asyncio
async def test_oauth_flow_simulation(client: TestClient):
    """Simulate complete OAuth flow"""
    # Step 1: User not authenticated
    response = client.get("/api/me")
    assert response.status_code == 401
    
    # Step 2: User logs in via OAuth (simulated by header)
    response = client.get(
        "/api/me",
        headers={"X-Auth-Request-Email": "oauth_user@example.com"}
    )
    assert response.status_code == 200
    user_data = response.json()
    
    # Step 3: User retrieves their sessions
    response = client.get(
        "/api/sessions",
        headers={"X-Auth-Request-Email": "oauth_user@example.com"}
    )
    assert response.status_code == 200
    
    # Step 4: User logs out
    response = client.post(
        "/api/sessions/logout",
        headers={"X-Auth-Request-Email": "oauth_user@example.com"}
    )
    assert response.status_code == 200
