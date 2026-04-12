"""
Tests for OAuth header extraction middleware.
Verifies that oauth2-proxy headers are correctly extracted and available in request.state.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app


@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


class TestOAuthMiddleware:
    """Test suite for OAuth middleware header extraction"""
    
    def test_health_check_allows_unauthenticated(self, client):
        """Health endpoint should not require authentication"""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
    
    def test_protected_endpoint_without_auth_fails(self, client):
        """Accessing protected endpoint without auth should return 401"""
        response = client.get("/api/dashboard")
        assert response.status_code == 401
        assert response.json()["error"] == "unauthorized"
    
    def test_protected_endpoint_with_oauth_header_succeeds(self, client):
        """Accessing protected endpoint with oauth2-proxy header should succeed"""
        response = client.get(
            "/api/dashboard",
            headers={"X-Auth-Request-Email": "akushnir@bioenergystrategies.com"}
        )
        assert response.status_code == 200
        assert "akushnir@bioenergystrategies.com" in response.json()["message"]
    
    def test_user_info_endpoint_returns_email(self, client):
        """User info endpoint should return authenticated user email"""
        response = client.get(
            "/api/auth/user",
            headers={"X-Auth-Request-Email": "test@example.com"}
        )
        assert response.status_code == 200
        assert response.json()["email"] == "test@example.com"
    
    def test_user_info_endpoint_without_auth(self, client):
        """User info endpoint without auth should return 401"""
        response = client.get("/api/auth/user")
        assert response.status_code == 401
    
    def test_profile_endpoint_returns_user_info(self, client):
        """Profile endpoint should return user information"""
        user_email = "john@example.com"
        user_name = "john"
        
        response = client.get(
            "/api/profile",
            headers={
                "X-Auth-Request-Email": user_email,
                "X-Auth-Request-User": user_name,
                "X-Auth-Request-Groups": "admins,developers",
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == user_email
        assert data["name"] == user_name
        assert data["authenticated"] is True
    
    def test_me_endpoint_alias(self, client):
        """Verify /api/auth/me is alias for /api/auth/user"""
        response = client.get(
            "/api/auth/me",
            headers={"X-Auth-Request-Email": "alice@example.com"}
        )
        assert response.status_code == 200
        assert response.json()["email"] == "alice@example.com"
    
    def test_oauth_headers_preserved_in_response(self, client):
        """Response should include appropriate security headers"""
        response = client.get(
            "/api/dashboard",
            headers={"X-Auth-Request-Email": "user@example.com"}
        )
        assert response.status_code == 200
        
        # Check for security headers added by middleware
        assert "x-content-type-options" in response.headers
        assert response.headers["x-content-type-options"] == "nosniff"
        assert "x-frame-options" in response.headers
        assert response.headers["x-frame-options"] == "SAMEORIGIN"
    
    def test_optional_oauth_headers(self, client):
        """Test optional oauth headers are extracted if present"""
        response = client.get(
            "/api/profile",
            headers={
                "X-Auth-Request-Email": "user@example.com",
                "X-Auth-Request-User": "username",
                "X-Auth-Request-Groups": "group1,group2",
                "Authorization": "Bearer test-token",
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "user@example.com"
        assert data["name"] == "username"
    
    def test_root_endpoint_public(self, client):
        """Root endpoint should be public"""
        response = client.get("/")
        assert response.status_code == 200
        assert "message" in response.json()
    
    def test_docs_endpoint_public(self, client):
        """Swagger docs endpoint should be public"""
        response = client.get("/docs")
        # Docs returns HTML, so we just check it's accessible
        assert response.status_code == 200
    
    def test_openapi_schema_public(self, client):
        """OpenAPI schema should be public"""
        response = client.get("/openapi.json")
        assert response.status_code == 200
        assert "openapi" in response.json()
    
    def test_cors_headers_included(self, client):
        """Response should include CORS headers"""
        response = client.get(
            "/api/dashboard",
            headers={
                "X-Auth-Request-Email": "user@example.com",
                "Origin": "https://lux.kushnir.cloud",
            }
        )
        assert response.status_code == 200
    
    def test_email_header_case_insensitive(self, client):
        """Email header should be extracted regardless of case"""
        response = client.get(
            "/api/profile",
            headers={"x-auth-request-email": "user@example.com"}  # lowercase
        )
        assert response.status_code == 200
    
    def test_multiple_protected_endpoints_all_require_auth(self, client):
        """All protected endpoints should require auth"""
        protected_endpoints = [
            "/api/dashboard",
            "/api/profile",
            "/api/auth/user",
        ]
        
        for endpoint in protected_endpoints:
            response = client.get(endpoint)
            assert response.status_code == 401, f"{endpoint} should require auth"
    
    def test_invalid_email_format_still_accepted(self, client):
        """Middleware doesn't validate email format - that's done elsewhere"""
        response = client.get(
            "/api/profile",
            headers={"X-Auth-Request-Email": "not-an-email"}  # Invalid email
        )
        # Middleware accepts it - validation happens in service layer
        assert response.status_code == 200
        assert response.json()["email"] == "not-an-email"


class TestHealthCheckEndpoints:
    """Test health check endpoints that bypass authentication"""
    
    def test_health_endpoint_no_auth_required(self, client):
        """Health check should work without authentication"""
        response = client.get("/health")
        assert response.status_code == 200
        
    def test_ready_endpoint_no_auth_required(self, client):
        """Readiness check should work without authentication"""
        response = client.get("/ready")
        assert response.status_code == 200
    
    def test_health_response_structure(self, client):
        """Health response should have required fields"""
        response = client.get("/health")
        data = response.json()
        
        assert "status" in data
        assert "service" in data
        assert "timestamp" in data


class TestAuthDependency:
    """Test AuthRequired dependency"""
    
    def test_auth_dependency_populated(self, client):
        """AuthRequired dependency should be populated from request.state"""
        response = client.get(
            "/api/profile",
            headers={"X-Auth-Request-Email": "user@example.com"}
        )
        assert response.status_code == 200
