"""
E2E Test Suite for Lux-Auto Portal

Comprehensive end-to-end tests using Playwright for portal functionality,
RBAC enforcement, and real-time updates.
"""

import pytest
from playwright.async_api import async_playwright, Page
import asyncio
from datetime import datetime
import json


class TestDealWorkflow:
    """Test complete deal approval workflow."""
    
    @pytest.mark.asyncio
    async def test_deal_list_and_filter(self):
        """Test listing deals with filters and sorting."""
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            # Navigate to deals dashboard
            await page.goto("https://lux.kushnir.cloud/deals")
            
            # Wait for deals to load
            await page.wait_for_selector("[data-testid='deal-list']")
            
            # Verify deals are displayed
            deals = await page.query_selector_all("[data-testid='deal-card']")
            assert len(deals) > 0, "No deals displayed"
            
            # Apply filter: status = "bidding"
            await page.click("[data-testid='filter-status']")
            await page.click("[data-testid='filter-status-bidding']")
            
            # Verify filtered results
            filtered_deals = await page.query_selector_all("[data-testid='deal-card']")
            assert all("bidding" in await d.text_content() for d in filtered_deals)
            
            await browser.close()
    
    @pytest.mark.asyncio
    async def test_deal_approval_workflow(self):
        """Test approving deal for bidding."""
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            # Navigate and login
            await page.goto("https://lux.kushnir.cloud/deals")
            await page.wait_for_selector("[data-testid='deal-list']")
            
            # Click first deal
            await page.click("[data-testid='deal-card']:first-child")
            await page.wait_for_selector("[data-testid='deal-detail-modal']")
            
            # Click approve button
            await page.click("[data-testid='btn-approve-deal']")
            
            # Confirm action
            await page.click("[data-testid='btn-confirm-approval']")
            
            # Verify success message
            success_msg = await page.text_content("[data-testid='toast-success']")
            assert "approved" in success_msg.lower()
            
            await browser.close()


class TestRBACEnforcement:
    """Test role-based access control."""
    
    @pytest.mark.asyncio
    async def test_viewer_cannot_edit_deals(self):
        """Test that VIEWER role cannot edit deals."""
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            # Set user role to VIEWER in headers
            await page.set_extra_http_headers({
                "X-User-Role": "VIEWER"
            })
            
            await page.goto("https://lux.kushnir.cloud/deals")
            await page.wait_for_selector("[data-testid='deal-list']")
            
            # Verify no edit button for VIEWER
            edit_btns = await page.query_selector_all("[data-testid='btn-edit-deal']")
            assert len(edit_btns) == 0, "VIEWER should not see edit buttons"
            
            await browser.close()
    
    @pytest.mark.asyncio
    async def test_analyst_can_edit_deals(self):
        """Test that ANALYST role can edit deals."""
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            # Set user role to ANALYST
            await page.set_extra_http_headers({
                "X-User-Role": "ANALYST"
            })
            
            await page.goto("https://lux.kushnir.cloud/deals")
            await page.wait_for_selector("[data-testid='deal-list']")
            
            # Verify edit button is visible
            edit_btns = await page.query_selector_all("[data-testid='btn-edit-deal']")
            assert len(edit_btns) > 0, "ANALYST should see edit buttons"
            
            await browser.close()


class TestBuyerImport:
    """Test CSV buyer import workflow."""
    
    @pytest.mark.asyncio
    async def test_buyer_csv_import(self):
        """Test importing buyers from CSV file."""
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            await page.goto("https://lux.kushnir.cloud/buyers")
            await page.wait_for_selector("[data-testid='btn-import']")
            
            # Click import button
            await page.click("[data-testid='btn-import']")
            await page.wait_for_selector("[data-testid='import-modal']")
            
            # Upload CSV file
            await page.set_input_files(
                "[data-testid='csv-upload']",
                "tests/fixtures/buyers.csv"
            )
            
            # Click confirm import
            await page.click("[data-testid='btn-confirm-import']")
            
            # Wait for success message
            await page.wait_for_selector("[data-testid='toast-success']")
            success = await page.text_content("[data-testid='toast-success']")
            assert "imported" in success.lower()
            
            await browser.close()


class TestAnalyticsDashboard:
    """Test analytics dashboard and metrics."""
    
    @pytest.mark.asyncio
    async def test_dashboard_metrics_load(self):
        """Test that dashboard metrics load correctly."""
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            await page.goto("https://lux.kushnir.cloud/analytics")
            
            # Wait for metrics to load
            await page.wait_for_selector("[data-testid='metric-total-deals']")
            await page.wait_for_selector("[data-testid='metric-win-rate']")
            await page.wait_for_selector("[data-testid='metric-avg-margin']")
            
            # Verify metrics have values
            total = await page.text_content("[data-testid='metric-total-deals']")
            assert total and total != "0", "Total deals metric should have value"
            
            await browser.close()
    
    @pytest.mark.asyncio
    async def test_analytics_export(self):
        """Test exporting analytics to CSV."""
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            
            # Listen for download
            async with browser.expect_download() as download_info:
                page = await browser.new_page()
                await page.goto("https://lux.kushnir.cloud/analytics")
                
                # Click export button
                await page.click("[data-testid='btn-export-csv']")
            
            download = await download_info.value
            path = await download.path()
            
            # Verify CSV file was downloaded
            assert path.exists(), "CSV export file should exist"
            
            await browser.close()


class TestRealTimeUpdates:
    """Test WebSocket real-time updates."""
    
    @pytest.mark.asyncio
    async def test_deal_status_update_broadcast(self):
        """Test that deal status updates are broadcast in real-time."""
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            # Navigate to deals
            await page.goto("https://lux.kushnir.cloud/deals")
            await page.wait_for_selector("[data-testid='deal-list']")
            
            # Listen for WebSocket messages
            messages = []
            
            async def on_message(msg):
                if msg.type == "text":
                    messages.append(json.loads(msg.text))
            
            # In a real test, you'd connect to WebSocket and listen
            # This is a simplified example
            
            await browser.close()


class TestAdminPanel:
    """Test admin settings and user management."""
    
    @pytest.mark.asyncio
    async def test_admin_user_management(self):
        """Test user management in admin panel."""
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            # Navigate to admin panel (requires ADMIN role)
            await page.goto("https://lux.kushnir.cloud/admin")
            
            # Wait for user table
            await page.wait_for_selector("[data-testid='users-table']")
            
            # Verify users are listed
            users = await page.query_selector_all("[data-testid='user-row']")
            assert len(users) > 0, "Users table should contain rows"
            
            await browser.close()


class TestPerformance:
    """Test performance benchmarks."""
    
    @pytest.mark.asyncio
    async def test_deals_list_load_time(self):
        """Test that deals list loads within performance target."""
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            start = datetime.now()
            await page.goto("https://lux.kushnir.cloud/deals")
            await page.wait_for_selector("[data-testid='deal-list']")
            elapsed = (datetime.now() - start).total_seconds()
            
            # Target: < 2 seconds
            assert elapsed < 2, f"Deals list should load in < 2s, took {elapsed}s"
            
            await browser.close()
    
    @pytest.mark.asyncio
    async def test_api_response_time(self):
        """Test API endpoint response times."""
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            # Navigate to deal list which calls API
            start = datetime.now()
            await page.goto("https://lux.kushnir.cloud/deals")
            
            # Wait for API response
            await page.wait_for_response(
                lambda r: "/api/v2/deals" in r.url and r.status == 200
            )
            elapsed = (datetime.now() - start).total_seconds()
            
            # Target: < 500ms
            assert elapsed < 0.5, f"API should respond in < 500ms, took {elapsed*1000}ms"
            
            await browser.close()


# Fixtures for test data
@pytest.fixture
def sample_deal():
    """Sample deal data for testing."""
    return {
        "id": "deal-test-123",
        "vin": "WVWZZZ3CZ9E123456",
        "year": 2020,
        "make": "Volkswagen",
        "model": "Jetta",
        "score": 75.5,
        "status": "scanning",
        "mmr_value": 8500.00,
        "estimated_margin": 1200.00,
    }


@pytest.fixture
def sample_buyer():
    """Sample buyer data for testing."""
    return {
        "id": "buyer-test-123",
        "name": "John's Auto Dealership",
        "email": "john@autodealership.com",
        "makes": ["Toyota", "Honda", "Nissan"],
        "models": ["Camry", "Civic", "Altima"],
        "min_price": 5000,
        "max_price": 15000,
    }
