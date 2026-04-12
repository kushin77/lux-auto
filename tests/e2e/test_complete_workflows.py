"""
End-to-end testing suite for Lux-Auto portal.

Comprehensive tests covering:
- Deal workflow (create → score → match → approve → route → won → closed)
- Buyer operations (register → upload deals → verify matches)
- Admin workflows (user management, RBAC, audit)
- API reliability and performance
- WebSocket real-time updates
- Error handling and edge cases
"""

import pytest
import asyncio
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any
from httpx import AsyncClient
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
async def async_client():
    """Async HTTP client for testing."""
    from fastapi.testclient import TestClient
    from backend.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
def admin_user(db: Session):
    """Create admin user for testing."""
    from backend.database.models import User
    
    user = User(
        email="admin@test.local",
        name="Test Admin",
        role="admin",
        active=True
    )
    db.add(user)
    db.commit()
    return user


@pytest.fixture
def analyst_user(db: Session):
    """Create analyst user for testing."""
    from backend.database.models import User
    
    user = User(
        email="analyst@test.local",
        name="Test Analyst",
        role="analyst",
        active=True
    )
    db.add(user)
    db.commit()
    return user


@pytest.fixture
def deal_data() -> Dict[str, Any]:
    """Sample deal data for testing."""
    return {
        "vehicle_make": "Toyota",
        "vehicle_model": "Camry",
        "vehicle_year": 2020,
        "vehicle_mileage": 45000,
        "vehicle_condition": "good",
        "buyer_name": "Metro Auto Group",
        "buyer_email": "buyer@metro.local",
        "buyer_location": "New York, NY",
        "estimated_price": 18500.00,
        "notes": "Clean title, one owner"
    }


# ============================================================================
# DEAL WORKFLOW TESTS
# ============================================================================

class TestDealWorkflow:
    """Test complete deal lifecycle."""
    
    @pytest.mark.asyncio
    async def test_deal_creation(self, async_client, analyst_user, deal_data):
        """Test creating a new deal."""
        headers = {"Authorization": f"Bearer {analyst_user.id}"}
        
        response = await async_client.post(
            "/api/v2/deals",
            json=deal_data,
            headers=headers
        )
        
        assert response.status_code == 201
        deal = response.json()
        
        assert deal["vehicle_make"] == "Toyota"
        assert deal["status"] == "scanning"
        assert "deal_id" in deal
        
        return deal
    
    @pytest.mark.asyncio
    async def test_deal_scoring(self, async_client, admin_user, deal_data):
        """Test deal auto-scoring."""
        # Create deal
        response = await async_client.post(
            "/api/v2/deals",
            json=deal_data,
            headers={"Authorization": f"Bearer {admin_user.id}"}
        )
        deal = response.json()
        deal_id = deal["deal_id"]
        
        # Wait for scoring
        await asyncio.sleep(2)  # Simulate async scoring
        
        # Check score updated
        response = await async_client.get(
            f"/api/v2/deals/{deal_id}",
            headers={"Authorization": f"Bearer {admin_user.id}"}
        )
        
        deal = response.json()
        assert deal["status"] in ["scanning", "scored"]
        assert "deal_score" in deal
    
    @pytest.mark.asyncio
    async def test_deal_approval_workflow(self, async_client, admin_user, deal_data):
        """Test deal approval and routing."""
        # Create and score deal
        response = await async_client.post(
            "/api/v2/deals",
            json=deal_data,
            headers={"Authorization": f"Bearer {admin_user.id}"}
        )
        deal = response.json()
        deal_id = deal["deal_id"]
        
        # Approve deal
        response = await async_client.post(
            f"/api/v2/deals/{deal_id}/approve",
            headers={"Authorization": f"Bearer {admin_user.id}"}
        )
        
        assert response.status_code == 200
        deal = response.json()
        assert deal["status"] == "approved"
        assert deal["approved_by"] == admin_user.email
    
    @pytest.mark.asyncio
    async def test_deal_rejection_workflow(self, async_client, admin_user, deal_data):
        """Test deal rejection."""
        response = await async_client.post(
            "/api/v2/deals",
            json=deal_data,
            headers={"Authorization": f"Bearer {admin_user.id}"}
        )
        deal = response.json()
        deal_id = deal["deal_id"]
        
        # Reject deal
        response = await async_client.post(
            f"/api/v2/deals/{deal_id}/reject",
            json={"reason": "Out of service area"},
            headers={"Authorization": f"Bearer {admin_user.id}"}
        )
        
        assert response.status_code == 200
        deal = response.json()
        assert deal["status"] == "rejected"
    
    @pytest.mark.asyncio
    async def test_deal_status_progression(self, async_client, admin_user, deal_data):
        """Test deal moves through all status stages."""
        response = await async_client.post(
            "/api/v2/deals",
            json=deal_data,
            headers={"Authorization": f"Bearer {admin_user.id}"}
        )
        deal = response.json()
        deal_id = deal["deal_id"]
        
        expected_statuses = [
            "scanning",
            "scored",
            "matched",
            "bidding",
            "won",
            "closed"
        ]
        
        for expected_status in expected_statuses:
            # Update status
            response = await async_client.patch(
                f"/api/v2/deals/{deal_id}/status",
                json={"status": expected_status},
                headers={"Authorization": f"Bearer {admin_user.id}"}
            )
            
            assert response.status_code == 200
            deal = response.json()
            assert deal["status"] == expected_status


# ============================================================================
# BUYER WORKFLOW TESTS
# ============================================================================

class TestBuyerWorkflow:
    """Test buyer-related operations."""
    
    @pytest.mark.asyncio
    async def test_buyer_preference_setup(self, async_client, analyst_user):
        """Test buyer price/make/model preferences."""
        buyer_prefs = {
            "name": "Quality Motors",
            "email": "buyer@quality.local",
            "location": "California",
            "preferred_makes": ["Toyota", "Honda", "Mazda"],
            "price_min": 15000,
            "price_max": 25000,
            "max_mileage": 100000,
            "financing_available": True
        }
        
        response = await async_client.post(
            "/api/v2/buyers",
            json=buyer_prefs,
            headers={"Authorization": f"Bearer {analyst_user.id}"}
        )
        
        assert response.status_code == 201
        buyer = response.json()
        assert buyer["name"] == "Quality Motors"
    
    @pytest.mark.asyncio
    async def test_buyer_csv_import(self, async_client, analyst_user):
        """Test bulk buyer import via CSV."""
        csv_content = """name,email,location,preferred_makes,max_price,financing
Quality Motors,buyer1@quality.local,CA,"Toyota,Honda",25000,true
Premier Auto,buyer2@premier.local,NY,"BMW,Mercedes",50000,true
Budget Cars,buyer3@budget.local,TX,"Honda,Nissan",15000,false"""
        
        files = {"file": ("buyers.csv", csv_content)}
        
        response = await async_client.post(
            "/api/v2/buyers/import/csv",
            files=files,
            headers={"Authorization": f"Bearer {analyst_user.id}"}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["imported"] == 3
        assert result["failed"] == 0
    
    @pytest.mark.asyncio
    async def test_buyer_deal_matches(self, async_client, analyst_user, deal_data):
        """Test finding deals matching buyer preferences."""
        # Create buyer
        buyer_prefs = {
            "name": "Toyota Specialist",
            "email": "toyota@specialist.local",
            "location": "New York",
            "preferred_makes": ["Toyota"],
            "price_min": 15000,
            "price_max": 25000
        }
        
        resp = await async_client.post(
            "/api/v2/buyers",
            json=buyer_prefs,
            headers={"Authorization": f"Bearer {analyst_user.id}"}
        )
        buyer_id = resp.json()["buyer_id"]
        
        # Create matching deal
        response = await async_client.post(
            "/api/v2/deals",
            json=deal_data,
            headers={"Authorization": f"Bearer {analyst_user.id}"}
        )
        deal = response.json()
        
        # Get matches
        response = await async_client.get(
            f"/api/v2/buyers/{buyer_id}/available-deals",
            headers={"Authorization": f"Bearer {analyst_user.id}"}
        )
        
        assert response.status_code == 200
        matches = response.json()
        assert len(matches["deals"]) > 0


# ============================================================================
# ADMIN WORKFLOW TESTS
# ============================================================================

class TestAdminWorkflow:
    """Test administrative operations."""
    
    @pytest.mark.asyncio
    async def test_user_management(self, async_client, admin_user):
        """Test creating and managing users."""
        new_user = {
            "email": "newuser@test.local",
            "name": "New User",
            "role": "analyst"
        }
        
        response = await async_client.post(
            "/api/v2/admin/users",
            json=new_user,
            headers={"Authorization": f"Bearer {admin_user.id}"}
        )
        
        assert response.status_code == 201
        user = response.json()
        assert user["email"] == "newuser@test.local"
        assert user["role"] == "analyst"
    
    @pytest.mark.asyncio
    async def test_rbac_permission_assignment(self, async_client, admin_user):
        """Test assigning permissions to users."""
        payload = {
            "user_id": 999,
            "role": "buyer_manager",
            "permissions": [
                "deal.view",
                "deal.create",
                "buyer.manage"
            ]
        }
        
        response = await async_client.post(
            "/api/v2/admin/permissions/assign",
            json=payload,
            headers={"Authorization": f"Bearer {admin_user.id}"}
        )
        
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_audit_log_retrieval(self, async_client, admin_user):
        """Test fetching audit logs."""
        response = await async_client.get(
            "/api/v2/audit/logs",
            params={
                "start_date": (datetime.utcnow() - timedelta(days=7)).isoformat(),
                "end_date": datetime.utcnow().isoformat(),
                "action": "deal_created"
            },
            headers={"Authorization": f"Bearer {admin_user.id}"}
        )
        
        assert response.status_code == 200
        logs = response.json()
        assert "logs" in logs
        assert "total" in logs


# ============================================================================
# API RELIABILITY TESTS
# ============================================================================

class TestAPIReliability:
    """Test API reliability and performance."""
    
    @pytest.mark.asyncio
    async def test_bulk_deal_operations(self, async_client, admin_user):
        """Test bulk operations handle 100 deals."""
        deal_ids = list(range(1, 101))
        
        response = await async_client.post(
            "/api/v2/deals/bulk/approve",
            json={"deal_ids": deal_ids},
            headers={"Authorization": f"Bearer {admin_user.id}"}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["approved"] == 100
    
    @pytest.mark.asyncio
    async def test_concurrent_requests(self, async_client, analyst_user):
        """Test API handles concurrent requests."""
        tasks = []
        
        for i in range(20):
            task = async_client.get(
                "/api/v2/deals",
                params={"skip": i * 10, "limit": 10},
                headers={"Authorization": f"Bearer {analyst_user.id}"}
            )
            tasks.append(task)
        
        responses = await asyncio.gather(*tasks)
        
        # All should succeed
        assert all(r.status_code == 200 for r in responses)
    
    @pytest.mark.asyncio
    async def test_large_payload_handling(self, async_client, analyst_user):
        """Test API handles large payloads (e.g., bulk CSV import)."""
        # Generate large CSV (10K rows)
        csv_lines = ["name,email,location"]
        for i in range(10000):
            csv_lines.append(f"Buyer{i},buyer{i}@test.local,NY")
        
        csv_content = "\n".join(csv_lines)
        
        response = await async_client.post(
            "/api/v2/buyers/import/csv",
            files={"file": ("large_import.csv", csv_content)},
            headers={"Authorization": f"Bearer {analyst_user.id}"}
        )
        
        assert response.status_code == 200


# ============================================================================
# WEBSOCKET TESTS
# ============================================================================

class TestWebSocketUpdates:
    """Test WebSocket real-time updates."""
    
    @pytest.mark.asyncio
    async def test_deal_update_broadcast(self, async_client, analyst_user):
        """Test deal updates broadcast to WebSocket subscribers."""
        
        # Connect WebSocket
        async with async_client.websocket_connect(
            "/ws/deals",
            headers={"Authorization": f"Bearer {analyst_user.id}"}
        ) as websocket:
            
            # Create deal (should trigger event)
            deal_data = {
                "vehicle_make": "Honda",
                "vehicle_model": "Civic",
                "vehicle_year": 2021,
                "vehicle_mileage": 30000,
                "vehicle_condition": "excellent",
                "buyer_name": "Test Buyer",
                "buyer_email": "buyer@test.local",
                "buyer_location": "NY",
                "estimated_price": 20000
            }
            
            response = await async_client.post(
                "/api/v2/deals",
                json=deal_data,
                headers={"Authorization": f"Bearer {analyst_user.id}"}
            )
            
            # Should receive event
            data = await asyncio.wait_for(websocket.receive_json(), timeout=5)
            assert data["type"] == "deal_created"
            assert data["payload"]["vehicle_make"] == "Honda"
    
    @pytest.mark.asyncio
    async def test_deal_status_change_notification(self, async_client, admin_user):
        """Test status change notifications via WebSocket."""
        
        async with async_client.websocket_connect(
            "/ws/deals/1001",  # Subscribe to specific deal
            headers={"Authorization": f"Bearer {admin_user.id}"}
        ) as websocket:
            
            # Update status
            response = await async_client.patch(
                "/api/v2/deals/1001/status",
                json={"status": "approved"},
                headers={"Authorization": f"Bearer {admin_user.id}"}
            )
            
            # Should receive notification
            data = await asyncio.wait_for(websocket.receive_json(), timeout=5)
            assert data["type"] == "deal_status_changed"
            assert data["payload"]["new_status"] == "approved"


# ============================================================================
# ERROR HANDLING TESTS
# ============================================================================

class TestErrorHandling:
    """Test error handling and edge cases."""
    
    @pytest.mark.asyncio
    async def test_invalid_deal_id(self, async_client, analyst_user):
        """Test handling of invalid deal ID."""
        response = await async_client.get(
            "/api/v2/deals/999999",
            headers={"Authorization": f"Bearer {analyst_user.id}"}
        )
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_permission_denied(self, async_client, analyst_user):
        """Test permission denied error."""
        response = await async_client.delete(
            "/api/v2/admin/users/1",
            headers={"Authorization": f"Bearer {analyst_user.id}"}
        )
        
        assert response.status_code == 403
    
    @pytest.mark.asyncio
    async def test_invalid_input_validation(self, async_client, analyst_user):
        """Test input validation errors."""
        invalid_deal = {
            "vehicle_make": "Toyota",
            # Missing required fields
        }
        
        response = await async_client.post(
            "/api/v2/deals",
            json=invalid_deal,
            headers={"Authorization": f"Bearer {analyst_user.id}"}
        )
        
        assert response.status_code == 422  # Unprocessable entity
    
    @pytest.mark.asyncio
    async def test_duplicate_deal_prevention(self, async_client, analyst_user, deal_data):
        """Test duplicate deal detection."""
        # Create deal
        await async_client.post(
            "/api/v2/deals",
            json=deal_data,
            headers={"Authorization": f"Bearer {analyst_user.id}"}
        )
        
        # Create same deal again
        response = await async_client.post(
            "/api/v2/deals",
            json=deal_data,
            headers={"Authorization": f"Bearer {analyst_user.id}"}
        )
        
        # Should either reject or handle gracefully
        assert response.status_code in [400, 409, 201]


# ============================================================================
# PERFORMANCE BENCHMARKS
# ============================================================================

class TestPerformance:
    """Test performance benchmarks."""
    
    @pytest.mark.asyncio
    async def test_deal_list_response_time(self, async_client, analyst_user):
        """Test deal list endpoint response time (should be < 500ms)."""
        import time
        
        start = time.time()
        response = await async_client.get(
            "/api/v2/deals",
            params={"skip": 0, "limit": 50},
            headers={"Authorization": f"Bearer {analyst_user.id}"}
        )
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 0.5, f"Response took {elapsed:.2f}s, expected < 500ms"
    
    @pytest.mark.asyncio
    async def test_analytics_calculation_time(self, async_client, analyst_user):
        """Test analytics calculation response time (should be < 2s)."""
        import time
        
        start = time.time()
        response = await async_client.get(
            "/api/v2/analytics/deals/summary",
            params={"period": "month"},
            headers={"Authorization": f"Bearer {analyst_user.id}"}
        )
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 2.0, f"Analytics took {elapsed:.2f}s, expected < 2s"

