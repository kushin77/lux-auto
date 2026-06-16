"""
Smoke tests — prove the whole app wires together without a live Postgres.

We point DATABASE_URL at a throwaway SQLite file. The ORM uses Postgres-only
ARRAY columns, so table creation is skipped (main.py tolerates this), but every
module imports, the middleware loads, and all routers mount — which is exactly
what we want to guarantee in CI before a real deploy.
"""

import os

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite:///./_smoke_test.db")
os.environ.setdefault("FASTAPI_SECRET_KEY", "test-secret")
os.environ.setdefault("ADMIN_USER_EMAIL", "admin@luxauto.com")
os.environ.setdefault("ENVIRONMENT", "test")

from fastapi.testclient import TestClient  # noqa: E402

from backend.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


def test_me_requires_auth(client):
    # No X-Auth-Request-Email header → 401 from the endpoint.
    r = client.get("/api/me")
    assert r.status_code == 401


def test_response_time_header(client):
    r = client.get("/health")
    assert "X-Response-Time-ms" in r.headers


def test_openapi_lists_routers(client):
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    assert "/api/v2/deals" in paths
    assert "/api/v2/audit" in paths


def test_rbac_matrix():
    from backend.auth.rbac_service import RBACService
    from backend.auth.user_service import UserRole

    rbac = RBACService()
    assert rbac.has_permission(UserRole.ADMIN, "approve:deals")
    assert rbac.has_permission(UserRole.ADMIN, "read:deals")  # inherited
    assert not rbac.has_permission(UserRole.VIEWER, "approve:deals")


def test_audit_event_enums():
    from backend.auth.audit import AuditEventType, AuditStatus

    assert AuditEventType.USER_LOGOUT.value == "user_logout"
    assert AuditStatus.SUCCESS.value == "success"
