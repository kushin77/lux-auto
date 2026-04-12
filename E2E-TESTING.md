# End-to-End Testing & QA Guide

## Testing Strategy

Comprehensive testing across all layers ensures platform reliability and quality.

---

## Test Pyramid

```
        ┌────────────┐
        │   E2E      │  1-5% (Slow, expensive)
        │  Tests     │  Appsmith, Backstage, critical paths
        ├────────────┤
        │ Integration│ 10-20% (Medium)
        │  Tests     │  API endpoints, database interactions
        ├────────────┤
        │   Unit     │ 75-85% (Fast, cheap)
        │  Tests     │ Individual functions, components
        └────────────┘
```

---

## Unit Testing (Python/FastAPI)

### Test Structure

```python
# tests/unit/test_deals.py
import pytest
from backend.models import Deal
from backend.services import DealService

@pytest.fixture
def mock_session():
    """Fixture for mocked database session"""
    return MagicMock()

class TestDealService:
    def test_create_deal_success(self, mock_session):
        """Test successful deal creation"""
        deal_data = {
            "vin": "WVWZZZ3CZ9E123456",
            "year": 2020,
            "make": "Volkswagen",
            "listing_price": 15000
        }
        
        service = DealService(mock_session)
        result = service.create_deal(deal_data)
        
        assert result.vin == deal_data["vin"]
        assert result.year == deal_data["year"]
        mock_session.add.assert_called_once()
    
    def test_create_deal_invalid_vin(self, mock_session):
        """Test deal creation with invalid VIN"""
        with pytest.raises(ValidationError):
            DealService(mock_session).create_deal({
                "vin": "INVALID"  # Too short
            })
    
    def test_get_deal_by_id(self, mock_session):
        """Test fetching deal by ID"""
        deal = Deal(id=1, vin="WVWZZZ3CZ9E123456")
        mock_session.query.return_value.get.return_value = deal
        
        service = DealService(mock_session)
        result = service.get_deal(1)
        
        assert result.id == 1
        mock_session.query.assert_called_with(Deal)
    
    def test_list_deals_pagination(self, mock_session):
        """Test deal list pagination"""
        deals = [Deal(id=i) for i in range(1, 11)]
        mock_session.query.return_value.limit.return_value.offset.return_value = deals
        
        service = DealService(mock_session)
        result = service.list_deals(page=1, per_page=10)
        
        assert len(result) == 10

@pytest.mark.asyncio
async def test_approve_deal_rbac():
    """Test RBAC on deal approval"""
    # ANALYST can't approve, only ADMIN can
    analyst_user = User(role="ANALYST")
    
    with pytest.raises(HTTPException) as exc:
        await approve_deal(deal_id=1, user=analyst_user)
    
    assert exc.value.status_code == 403
```

### Running Unit Tests

```bash
# Run all unit tests
pytest tests/unit/

# Run specific test
pytest tests/unit/test_deals.py::TestDealService::test_create_deal_success

# With coverage
pytest --cov=backend tests/unit/

# Coverage report
pytest --cov=backend --cov-report=html tests/unit/
```

---

## Integration Testing

### API Integration Tests

```python
# tests/integration/test_api_deals.py
import pytest
from fastapi.testclient import TestClient
from backend.main import app

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def auth_headers():
    """Generate auth headers for test"""
    return {
        "Authorization": f"Bearer {TEST_TOKEN}",
        "Content-Type": "application/json"
    }

class TestDealsAPI:
    def test_list_deals_success(self, client, auth_headers):
        """Test GET /api/v2/deals"""
        response = client.get(
            "/api/v2/deals?status=approved",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        assert "data" in response.json()
        assert isinstance(response.json()["data"], list)
    
    def test_list_deals_unauthorized(self, client):
        """Test unauthenticated request"""
        response = client.get("/api/v2/deals")
        assert response.status_code == 401
    
    def test_create_deal_success(self, client, auth_headers):
        """Test POST /api/v2/deals"""
        deal_data = {
            "vin": "WVWZZZ3CZ9E123456",
            "year": 2020,
            "make": "Volkswagen",
            "model": "Golf",
            "listing_price": 15000,
            "mmr_value": 16000
        }
        
        response = client.post(
            "/api/v2/deals",
            json=deal_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        assert response.json()["vin"] == deal_data["vin"]
    
    def test_update_deal_success(self, client, auth_headers):
        """Test PUT /api/v2/deals/{id}"""
        response = client.put(
            "/api/v2/deals/1",
            json={"status": "approved"},
            headers=auth_headers
        )
        
        assert response.status_code == 200
    
    def test_delete_deal_forbidden(self, client, auth_headers):
        """Test ANALYST can't delete deal"""
        # Create analyst token
        analyst_headers = get_analyst_headers()
        
        response = client.delete(
            "/api/v2/deals/1",
            headers=analyst_headers
        )
        
        assert response.status_code == 403
    
    def test_rate_limiting(self, client, auth_headers):
        """Test API rate limiting"""
        # Make 101 requests (limit is 100/minute)
        for i in range(101):
            response = client.get("/api/v2/deals", headers=auth_headers)
            
            if i < 100:
                assert response.status_code == 200
            else:
                assert response.status_code == 429  # Rate limit exceeded
```

### Database Integration Tests

```python
# tests/integration/test_database.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base

@pytest.fixture(scope="session")
def test_db():
    """Create test database"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)

@pytest.fixture
def session(test_db):
    """Get test session"""
    Session = sessionmaker(bind=test_db)
    session = Session()
    yield session
    session.rollback()  # Rollback after test

def test_deal_relationship(session):
    """Test deal -> buyer relationship"""
    buyer = Buyer(name="John", email="john@test.com")
    deal = Deal(
        vin="WVWZZZ3CZ9E123456",
        buyer=buyer
    )
    
    session.add(deal)
    session.commit()
    
    # Query back and verify relationship
    saved_deal = session.query(Deal).first()
    assert saved_deal.buyer.name == "John"
```

---

## End-to-End Testing with Playwright

### Setup

```bash
# Install Playwright
npm install -D @playwright/test

# Install browsers
npx playwright install
```

### Example E2E Tests

```javascript
// tests/e2e/deals.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Deal Management Dashboard', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('https://backstage.lux.kushnir.cloud');
    await page.click('text=Sign in');
    await page.click('text=Google');
    
    // Complete Google OAuth (pre-authenticated in test)
    await page.goto('https://appsmith.lux.kushnir.cloud/dashboards/deal-management');
  });

  test('should load dashboard and display deals', async ({ page }) => {
    // Wait for data to load
    await page.waitForSelector('[data-testid="deals-table"]');
    
    // Verify table is visible
    const table = await page.locator('[data-testid="deals-table"]');
    await expect(table).toBeVisible();
    
    // Check row count
    const rows = page.locator('[data-testid="deals-table"] tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should filter deals by status', async ({ page }) => {
    // Select status filter
    await page.selectOption('[data-testid="status-filter"]', 'approved');
    
    // Wait for filter to apply
    await page.waitForLoadState('networkidle');
    
    // Verify all visible deals have status "approved"
    const statusCells = page.locator('[data-testid="deal-status"]');
    for (let i = 0; i < await statusCells.count(); i++) {
      const status = await statusCells.nth(i).textContent();
      expect(status).toBe('Approved');
    }
  });

  test('should edit deal details', async ({ page }) => {
    // Click first deal row
    await page.click('[data-testid="deals-table"] tbody tr:first-child');
    
    // Wait for modal to open
    await page.waitForSelector('[data-testid="deal-modal"]');
    
    // Edit status field
    await page.selectOption('[data-testid="status-field"]', 'rejected');
    
    // Submit form
    await page.click('[data-testid="save-button"]');
    
    // Wait for success message
    await expect(page.locator('text=Deal updated')).toBeVisible();
  });

  test('should create new deal', async ({ page }) => {
    // Click add deal button
    await page.click('[data-testid="new-deal-button"]');
    
    // Fill form
    await page.fill('[data-testid="vin-input"]', 'WVWZZZ3CZ9E123456');
    await page.fill('[data-testid="year-input"]', '2020');
    await page.fill('[data-testid="make-input"]', 'Volkswagen');
    await page.fill('[data-testid="model-input"]', 'Golf');
    await page.fill('[data-testid="price-input"]', '15000');
    
    // Submit
    await page.click('[data-testid="create-button"]');
    
    // Verify success
    await expect(page.locator('text=Deal created')).toBeVisible();
    
    // Verify new deal in list
    await expect(
      page.locator('[data-testid="deals-table"]')
    ).toContainText('WVWZZZ3CZ9E123456');
  });

  test('should display error for invalid VIN', async ({ page }) => {
    await page.click('[data-testid="new-deal-button"]');
    
    // Enter invalid VIN
    await page.fill('[data-testid="vin-input"]', 'INVALID');
    
    // Blur to trigger validation
    await page.click('[data-testid="year-input"]');
    
    // Check error message
    await expect(page.locator('text=Invalid VIN')).toBeVisible();
  });

  test('should navigate pages', async ({ page }) => {
    // Go to page 2
    await page.click('[data-testid="page-2-button"]');
    
    // Wait for new data
    await page.waitForLoadState('networkidle');
    
    // Verify different deals are shown
    const firstVin = await page.locator('[data-testid="deal-vin"]').first().textContent();
    
    // Go back to page 1
    await page.click('[data-testid="page-1-button"]');
    await page.waitForLoadState('networkidle');
    
    // Verify original deals
    const newFirstVin = await page.locator('[data-testid="deal-vin"]').first().textContent();
    expect(newFirstVin).not.toBe(firstVin);
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Intercept API and return error
    await page.route('**/api/v2/deals', route => {
      route.abort('failed');
    });
    
    // Reload page
    await page.reload();
    
    // Check error message shown
    await expect(page.locator('text=Failed to load deals')).toBeVisible();
  });

  test('should validate user permissions', async ({ page, context }) => {
    // Create new context with VIEWER role
    const viewerContext = await context.browser()?.newContext();
    const viewerPage = await viewerContext!.newPage();
    
    // Login as VIEWER
    await loginAsRole(viewerPage, 'VIEWER');
    
    // Should not see edit button
    const editButtons = viewerPage.locator('[data-testid="deal-edit"]');
    await expect(editButtons).toHaveCount(0);
    
    // Should not be able to create deals
    await expect(
      viewerPage.locator('[data-testid="new-deal-button"]')
    ).toBeDisabled();
  });

  test('should handle real-time updates', async ({ page }) => {
    // Open dashboard
    await page.goto('https://appsmith.lux.kushnir.cloud/dashboards/deal-management');
    
    // Start monitoring deals count
    let initialCount = await page.locator('[data-testid="total-deals"]').textContent();
    
    // Simulate deal being created in another session
    // (Use API to create deal)
    const newDeal = await createDealViaAPI({
      vin: 'WVWZZZ3CZ9E999999',
      year: 2021
    });
    
    // Wait for update to appear
    await page.waitForFunction(
      (expected) => {
        return document.querySelector('[data-testid="total-deals"]')?.textContent?.includes(expected);
      },
      String(Number(initialCount) + 1),
      { timeout: 5000 }
    );
    
    // Verify new deal visible
    await expect(page.locator('text=WVWZZZ3CZ9E999999')).toBeVisible();
  });
});
```

### Running E2E Tests

```bash
# Run all E2E tests
npx playwright test

# Run specific test
npx playwright test tests/e2e/deals.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Debug mode
npx playwright test --debug

# Generate report
npx playwright show-report
```

---

## Performance Testing

### Load Testing with k6

```javascript
// tests/performance/load_test.js
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500'],  // 95% of requests under 1.5s
    http_req_failed: ['<0.1'],          // Less than 10% failure
  },
};

export default function () {
  const token = __ENV.AUTH_TOKEN;
  const baseUrl = 'https://lux.kushnir.cloud/api/v2';

  // Test deals list endpoint
  let response = http.get(`${baseUrl}/deals`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 1s': (r) => r.timings.duration < 1000,
    'has deals data': (r) => JSON.parse(r.body).data.length > 0,
  });
}
```

### Running Load Tests

```bash
# Run load test
k6 run --vus 10 --duration 30s tests/performance/load_test.js

# With environment variables
k6 run \
  --env AUTH_TOKEN=xxx \
  --vus 50 \
  --duration 5m \
  tests/performance/load_test.js
```

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov
      
      - name: Run unit tests
        run: pytest tests/unit/ --cov=backend
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: pip install -r requirements.txt
      
      - name: Run integration tests
        run: pytest tests/integration/
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Playwright
        run: |
          npm install
          npx playwright install
      
      - name: Run E2E tests
        run: npx playwright test
        env:
          CI: true
      
      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Test Coverage Goals

| Component | Target Coverage |
|-----------|-----------------|
| Core services | 90%+ |
| API endpoints | 85%+ |
| Database models | 80%+ |
| Utilities | 85%+ |
| Overall | 85%+ |

---

## QA Checklist

- [ ] All unit tests passing
- [ ] Integration tests covering API endpoints
- [ ] E2E tests for critical user paths
- [ ] Load testing shows acceptable performance
- [ ] Code coverage > 85%
- [ ] No security vulnerabilities found
- [ ] Error handling tested
- [ ] Edge cases covered
- [ ] Documentation up to date
- [ ] Team has reviewed tests

---

Last Updated: April 12, 2026
Version: 1.0
