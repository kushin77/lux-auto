"""
End-to-end integration tests against a live SQLite database.

Exercises the full stack the way oauth2-proxy + a real client would: provisions
users with roles, seeds deals + buyers, then drives every endpoint and asserts
RBAC, audit logging, and analytics math. Proves the API is functional, not just
importable.
"""

import os
from datetime import datetime

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite:///./_integration_test.db")
os.environ.setdefault("FASTAPI_SECRET_KEY", "test-secret")
os.environ.setdefault("ADMIN_USER_EMAIL", "admin@luxauto.com")
os.environ.setdefault("ENVIRONMENT", "test")

from fastapi.testclient import TestClient  # noqa: E402

from backend.main import app, engine, SessionLocal  # noqa: E402
from backend.database.models import Base, Deal, Buyer  # noqa: E402
from backend.auth.user_service import UserService, UserRole  # noqa: E402

ADMIN = {"X-Auth-Request-Email": "admin@luxauto.com"}
VIEWER = {"X-Auth-Request-Email": "viewer@luxauto.com"}
ANALYST = {"X-Auth-Request-Email": "analyst@luxauto.com"}


def _seed():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        svc = UserService()
        svc.get_or_create_user("admin@luxauto.com", db)  # ADMIN (matches env + first)
        svc.get_or_create_user("viewer@luxauto.com", db)
        svc.set_role("viewer@luxauto.com", UserRole.VIEWER, db)
        svc.get_or_create_user("analyst@luxauto.com", db)
        svc.set_role("analyst@luxauto.com", UserRole.ANALYST, db)

        now = datetime.now()
        deals = [
            Deal(
                id="d1",
                vin="VINFERRARI0001",
                year=2019,
                make="Ferrari",
                model="488",
                mmr_value=235000,
                estimated_margin=28000,
                score=82,
                status="won",
                created_at=now,
            ),
            Deal(
                id="d2",
                vin="VINLAMBO000002",
                year=2020,
                make="Lamborghini",
                model="Huracan",
                mmr_value=255000,
                estimated_margin=32000,
                score=88,
                status="closed",
                created_at=now,
            ),
            Deal(
                id="d3",
                vin="VINFERRARI0003",
                year=2018,
                make="Ferrari",
                model="GTC4",
                mmr_value=180000,
                estimated_margin=15000,
                score=70,
                status="routed",
                created_at=now,
            ),
            Deal(
                id="d4",
                vin="VINPORSCHE0004",
                year=2021,
                make="Porsche",
                model="911",
                mmr_value=120000,
                estimated_margin=9000,
                score=64,
                status="scored",
                created_at=now,
            ),
        ]
        for d in deals:
            db.merge(d)
        db.merge(
            Buyer(
                id="b1",
                name="Existing Buyer",
                email="existing@buyer.com",
                success_count=2,
                contact_count=4,
            )
        )
        db.commit()
    finally:
        db.close()


@pytest.fixture(scope="module")
def client():
    _seed()
    with TestClient(app) as c:
        yield c


# ── Deals + RBAC ────────────────────────────────────────────────────────────


def test_admin_lists_all_deals(client):
    r = client.get("/api/v2/deals", headers=ADMIN)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 4
    assert len(body["items"]) == 4


def test_deal_filtering_and_sorting(client):
    r = client.get("/api/v2/deals?make=Ferrari&sort_by=score&order=desc", headers=ADMIN)
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 2
    assert items[0]["score"] >= items[1]["score"]


def test_viewer_can_read_but_not_approve(client):
    assert client.get("/api/v2/deals", headers=VIEWER).status_code == 200
    forbidden = client.post("/api/v2/deals/d4/approve", json={}, headers=VIEWER)
    assert forbidden.status_code == 403


def test_unauthenticated_is_401(client):
    assert client.get("/api/v2/deals").status_code == 401


def test_admin_approves_and_rejects(client):
    a = client.post(
        "/api/v2/deals/d4/approve", json={"reason": "Strong margin"}, headers=ADMIN
    )
    assert a.status_code == 200
    assert a.json()["status"] == "approved"
    assert a.json()["approved_by"] == "admin@luxauto.com"

    rj = client.post(
        "/api/v2/deals/d3/reject", json={"reason": "Damaged frame"}, headers=ADMIN
    )
    assert rj.status_code == 200
    assert rj.json()["status"] == "rejected"

    # Persisted?
    detail = client.get("/api/v2/deals/d4", headers=ADMIN).json()
    assert detail["status"] == "approved"


def test_approve_missing_deal_404(client):
    assert (
        client.post("/api/v2/deals/nope/approve", json={}, headers=ADMIN).status_code
        == 404
    )


# ── Analytics ───────────────────────────────────────────────────────────────


def test_dashboard_math(client):
    # NOTE: runs after approve/reject above changed d3→rejected, d4→approved.
    # Won statuses (won/routed/closed): d1, d2 → 2 of 4 = 50% win rate.
    r = client.get("/api/v2/analytics/dashboard?date_range=30d", headers=ADMIN)
    assert r.status_code == 200
    m = r.json()["metrics"]
    assert m["deals_scanned"] == 4
    assert m["deals_won"] == 2
    assert m["win_rate"] == 50.0
    assert m["total_volume"] == 490000.0  # 235000 + 255000
    assert m["total_margin"] == 60000.0  # 28000 + 32000
    assert m["avg_margin_per_deal"] == 30000.0


def test_deal_analytics_grouping(client):
    r = client.get(
        "/api/v2/analytics/deals?metric=margin&group_by=make", headers=ANALYST
    )
    assert r.status_code == 200
    body = r.json()
    assert body["group_by"] == "make"
    assert any(p["group"] == "Ferrari" for p in body["data"])


# ── Buyers + CSV import ─────────────────────────────────────────────────────


def test_buyer_csv_import_and_list(client):
    csv_data = (
        "name,email,phone,max_price,preferred_makes,location\n"
        'Jane Collector,jane@buyer.com,555-1000,300000,"Ferrari,Lamborghini","Miami, FL"\n'
        'Existing Buyer,existing@buyer.com,555-2000,275000,Porsche,"Austin, TX"\n'
    )
    r = client.post(
        "/api/v2/buyers/import",
        files={"file": ("buyers.csv", csv_data, "text/csv")},
        headers=ANALYST,
    )
    assert r.status_code == 200
    summary = r.json()
    assert summary["imported"] == 1  # jane is new
    assert summary["updated"] == 1  # existing@buyer.com updated
    assert summary["failed"] == 0

    lst = client.get("/api/v2/buyers", headers=ANALYST)
    assert lst.status_code == 200
    emails = {b["contact_email"] for b in lst.json()["items"]}
    assert {"jane@buyer.com", "existing@buyer.com"} <= emails


def test_viewer_cannot_import_buyers(client):
    r = client.post(
        "/api/v2/buyers/import",
        files={"file": ("x.csv", "name,email\n", "text/csv")},
        headers=VIEWER,
    )
    assert r.status_code == 403


# ── Audit trail ─────────────────────────────────────────────────────────────


def test_audit_trail_captured_mutations(client):
    r = client.get("/api/v2/audit", headers=ADMIN)
    assert r.status_code == 200
    events = {e["event_type"] for e in r.json()["items"]}
    assert "deal_approved" in events
    assert "deal_rejected" in events
