# Test Suite Documentation

## Overview
Comprehensive test suite for the Lux Auto project covering OAuth middleware, Manheim API integration, authentication, and authorization.

## Test Structure

### Unit Tests (`tests/unit/`)
- `test_auth.py` - Authentication and user service tests
- `test_oauth_middleware.py` - OAuth2 proxy header extraction and middleware tests

### Integration Tests (`tests/`)
- `test_manheim_api.py` - Manheim MarketTrack API client integration tests

### Test Fixtures (`conftest.py`)
Shared fixtures available across all tests:
- OAuth mock headers (standard, minimal, admin)
- Manheim API response mocks
- Database and cache mocks
- Test data constants

## Running Tests

### Run all tests
```bash
pytest
```

### Run specific test file
```bash
pytest tests/unit/test_oauth_middleware.py
```

### Run with coverage
```bash
pytest --cov=backend --cov-report=html
```

### Run specific test class
```bash
pytest tests/unit/test_oauth_middleware.py::TestOAuthMiddleware
```

### Run specific test method
```bash
pytest tests/unit/test_oauth_middleware.py::TestOAuthMiddleware::test_protected_endpoint_without_auth_fails
```

### Run tests with markers
```bash
pytest -m asyncio  # Run async tests
pytest -m "not slow"  # Skip slow tests
```

## Test Categories

### OAuth Middleware Tests (20 tests)
Located in `tests/unit/test_oauth_middleware.py`

**Coverage:**
- Header extraction from oauth2-proxy
- Protected endpoint authentication
- User info endpoints
- Security headers validation
- Public endpoint access (health, docs)
- Header case sensitivity
- Auth dependency injection

**Key test classes:**
- `TestOAuthMiddleware` - Core middleware functionality
- `TestHealthCheckEndpoints` - Public health/readiness checks
- `TestAuthDependency` - Auth dependency injection

### Manheim API Tests (22 tests)
Located in `tests/test_manheim_api.py`

**Coverage:**
- Auction data retrieval
- Vehicle search and details
- Pricing data endpoints
- Market trends analysis
- API authentication
- Rate limiting and error handling
- Data model validation
- Full workflow integration

**Key test classes:**
- `TestManheimAPIClient` - API client functionality
- `TestVehicleData` - Vehicle data model
- `TestAuctionData` - Auction data model
- `TestManheimAPIIntegration` - End-to-end workflows

## Test Fixtures

### OAuth Headers
- `mock_oauth_headers()` - Standard authenticated user headers
- `mock_oauth_minimal_headers()` - Minimal headers (email only)
- `mock_oauth_admin_headers()` - Admin user headers

### Manheim API Data
- `mock_manheim_response()` - Sample auction response
- `mock_manheim_vehicle_details()` - Detailed vehicle data
- `mock_manheim_pricing()` - Vehicle pricing data

### Services
- `mock_database_session()` - Mock async database session
- `mock_redis_client()` - Mock Redis cache client
- `mock_logger()` - Mock logger for debugging

## Configuration

### pytest.ini
Main pytest configuration file with:
- Test discovery patterns
- Coverage requirements (80% minimum)
- Logging configuration
- Timeout settings (300 seconds)
- Custom markers

### conftest.py
Shared test configuration and fixtures:
- Event loop setup for async tests
- Test database engine and sessions
- FastAPI test client
- Authentication headers
- API response mocks
- Service mocks

## Coverage Goals

- **Minimum coverage:** 80%
- **Target coverage:** 90%+
- **Critical modules:** Authentication, OAuth middleware, API clients

Current coverage can be viewed in `htmlcov/index.html` after running tests with `--cov-report=html`.

## Continuous Integration

Tests are automatically run on:
- Push to main branch
- All pull requests
- Nightly scheduled runs

See `.github/workflows/` for CI configuration.

## Dependencies

Test dependencies are managed in `backend/requirements.txt`:
- pytest >= 7.0
- pytest-asyncio >= 0.20
- pytest-cov >= 4.0
- httpx >= 0.23
- sqlalchemy >= 2.0
- FastAPI >= 0.95

## Adding New Tests

### Naming Convention
- Test files: `test_<module>.py`
- Test classes: `Test<Feature>`
- Test methods: `test_<scenario>`

### Example
```python
class TestNewFeature:
    """Test suite for new feature"""
    
    def test_feature_basic_behavior(self, mock_oauth_headers):
        """Test description"""
        # Arrange
        
        # Act
        
        # Assert
```

### Using Fixtures
All fixtures from `conftest.py` are automatically available:
```python
def test_something(self, mock_oauth_headers, test_db_session):
    """Test using fixtures"""
    user_email = mock_oauth_headers["X-Auth-Request-Email"]
    # Use fixtures...
```

## Common Issues

### Import Errors
- Ensure `backend/` is in Python path
- Check that all `__init__.py` files exist in package directories
- Verify module imports match directory structure

### AsyncIO Errors
- Use `@pytest.mark.asyncio` decorator for async tests
- Ensure `asyncio_mode = auto` is set in pytest.ini
- Use `await` for async function calls

### Database Errors
- Tests use in-memory SQLite database
- Database is automatically reset between tests
- Fixtures handle cleanup automatically

## Performance

Average test execution times:
- Unit tests: ~0.5 seconds
- Integration tests: ~2-5 seconds
- Full suite: ~30 seconds

Slow tests are marked with `@pytest.mark.slow` and can be skipped with `-m "not slow"`.

## Resources

- [pytest Documentation](https://docs.pytest.org/)
- [pytest-asyncio](https://pytest-asyncio.readthedocs.io/)
- [FastAPI Testing](https://fastapi.tiangolo.com/advanced/testing-dependencies/)
- [SQLAlchemy Testing](https://docs.sqlalchemy.org/en/20/faq/testing.html)
