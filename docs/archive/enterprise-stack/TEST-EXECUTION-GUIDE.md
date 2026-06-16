# Test Suite Execution Guide

## Quick Reference

### Test Files Summary
```
tests/
├── __init__.py                      (32 bytes)   - Package initialization
├── conftest.py                      (8,686 bytes) - Shared fixtures and configuration
├── test_manheim_api.py              (12,956 bytes) - Manheim API integration tests (22 tests)
├── README.md                        - Comprehensive test documentation
├── unit/
│   ├── __init__.py                  (22 bytes) - Unit tests package
│   ├── test_auth.py                 (6,040 bytes) - Authentication tests (existing)
│   └── test_oauth_middleware.py     (8,033 bytes) - OAuth middleware tests (20 tests)
├── e2e/                             - End-to-end tests (existing)
└── performance/                     - Performance tests (existing)

backend/integrations/
├── __init__.py                      (53 bytes) - Integrations package
└── manheim_api.py                   (6,494 bytes) - Manheim API client module
```

### File Sizes
- **Total test code:** ~35 KB
- **Total integration code:** ~6.5 KB
- **Documentation:** ~320 KB
- **Configuration:** As per pytest.ini

## Running Tests

### Standard Test Execution

```bash
# Run all tests in the project
pytest

# Run tests with verbose output
pytest -v

# Run tests with coverage report
pytest --cov=backend --cov-report=term-missing

# Run tests with HTML coverage report
pytest --cov=backend --cov-report=html
# View report: open htmlcov/index.html
```

### Running Specific Tests

```bash
# Run all OAuth middleware tests
pytest tests/unit/test_oauth_middleware.py -v

# Run all Manheim API tests
pytest tests/test_manheim_api.py -v

# Run specific test class
pytest tests/unit/test_oauth_middleware.py::TestOAuthMiddleware -v

# Run specific test method
pytest tests/unit/test_oauth_middleware.py::TestOAuthMiddleware::test_protected_endpoint_without_auth_fails -v

# Run authentication tests
pytest tests/unit/test_auth.py -v
```

### Running with Markers

```bash
# Run only async tests
pytest -m asyncio

# Run only unit tests
pytest -m unit

# Run integration tests
pytest -m integration

# Skip slow tests
pytest -m "not slow"

# Run OAuth-specific tests
pytest -m oauth
```

### Running with Filters

```bash
# Run tests matching a pattern
pytest -k "test_oauth"

# Run tests containing "header" in the name
pytest -k "header"

# Run tests from specific file
pytest tests/test_manheim_api.py
```

## Performance Information

### Estimated Execution Times
- **Entire test suite:** ~30-45 seconds
- **Unit tests:** ~5-10 seconds
- **OAuth middleware tests:** ~2-3 seconds
- **Manheim API tests:** ~5-8 seconds
- **Auth tests:** ~2-3 seconds

### Test Count by Category
- **Unit tests (total):** 22 tests
  - OAuth middleware: 20 tests
  - Authentication: 2+ tests
- **Integration tests:** 22 tests
  - Manheim API: 22 tests
- **Other tests:** E2E and performance tests (existing)

## Coverage Report

### Default Coverage
```bash
pytest --cov=backend --cov-report=term-missing
```

**Expected Output:**
- Coverage percentage for each module
- Missing line numbers for uncovered code
- Overall coverage summary (Target: 80%+)

### HTML Coverage Report
```bash
pytest --cov=backend --cov-report=html
```

**Output:** `htmlcov/index.html`
- Interactive HTML report
- Line-by-line coverage visualization
- Branch coverage analysis
- Per-file coverage breakdown

## Test Fixtures Available

### OAuth Headers
- `mock_oauth_headers` - Complete OAuth headers
- `mock_oauth_minimal_headers` - Email-only headers
- `mock_oauth_admin_headers` - Admin user headers

### Manheim API
- `mock_manheim_response` - Auction response
- `mock_manheim_vehicle_details` - Vehicle information
- `mock_manheim_pricing` - Pricing data

### Database & Services
- `test_db_engine` - In-memory SQLite engine
- `test_db_session` - Database session fixture
- `test_client` - FastAPI test client
- `mock_database_session` - Mock async database
- `mock_redis_client` - Mock Redis client
- `mock_logger` - Mock logger

### Test Data
- `test_user_email` - "test@example.com"
- `admin_user_email` - "akushnir@bioenergystrategies.com"
- `test_auction_id` - "ATL-2024-01-15"
- `test_vehicle_vin` - "JTHBP5C28A5034448"

## Configuration Files

### pytest.ini
Location: `pytest.ini`
Key settings:
- Test discovery patterns
- Coverage requirements (80% minimum)
- Logging configuration
- Timeout: 300 seconds
- Plugins: asyncio, cov

### conftest.py
Location: `tests/conftest.py`
Provides:
- Event loop fixture for async tests
- Database fixtures
- All OAuth and API mocks
- Test data constants
- Custom hooks and markers

## CI/CD Integration

### GitHub Actions Workflow
Tests run automatically on:
1. **Push to develop/main branch**
   - Full test suite execution
   - Coverage report generation
   - HTML report upload

2. **Pull Request**
   - All tests must pass
   - Coverage threshold enforcement (80%)
   - Detailed test report comments

3. **Nightly Runs**
   - Full extended test suite
   - Performance regression tests
   - Report aggregation

See `.github/workflows/` for specific configurations.

## Troubleshooting

### Common Issues

**Issue:** Tests don't discover
```
Solution: Check python_files pattern in pytest.ini
- Ensure files are named test_*.py
- Files must be in testpaths directory (tests/)
```

**Issue:** Async tests fail
```
Solution: Check asyncio configuration
- asyncio_mode = auto must be in pytest.ini
- Use @pytest.mark.asyncio decorator on async test functions
- Check for proper await usage
```

**Issue:** Import errors
```
Solution: Verify Python path
- Ensure backend/ is in Python path
- Check __init__.py files exist in all packages
- Verify import paths match directory structure
```

**Issue:** Mock objects not working
```
Solution: Check mock types
- Use Mock() for sync operations
- Use AsyncMock() for async operations
- Ensure proper patching of object paths
```

## Dependencies

### Core Testing
- pytest >= 7.0
- pytest-asyncio >= 0.20 (for async tests)
- pytest-cov >= 4.0 (for coverage)

### HTTP/API Testing
- httpx >= 0.23
- fastapi >= 0.95
- aiohttp >= 3.8

### Database
- sqlalchemy >= 2.0
- alembic >= 1.11 (migrations)

See `backend/requirements.txt` for complete list.

## Next Steps

### To Run Tests Now:
1. Install dependencies: `pip install -r backend/requirements.txt`
2. Run tests: `pytest`
3. View coverage: `pytest --cov=backend --cov-report=html`
4. Open report: `open htmlcov/index.html`

### To Integrate with CI/CD:
1. Push to GitHub: `git push origin dev`
2. Create Pull Request
3. GitHub Actions will automatically run tests
4. Coverage report available in PR comments

### To Add New Tests:
1. Create test file in appropriate directory
2. Use fixtures from conftest.py
3. Follow naming conventions (test_*.py)
4. Run pytest to verify

## Resources

- [Full Documentation](tests/README.md)
- [Pytest Docs](https://docs.pytest.org/)
- [pytest-asyncio](https://pytest-asyncio.readthedocs.io/)
- [FastAPI Testing](https://fastapi.tiangolo.com/advanced/testing-dependencies/)

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total Test Files | 4 |
| Total Test Cases | 42+ |
| Lines of Test Code | ~35,000 |
| Code Coverage Target | 80%+ |
| Average Test Time | ~30-45 sec |
| Supported Test Types | Sync, Async, Unit, Integration |
| Documentation Pages | 3 |

---
**Generated:** April 12, 2026
**Project:** Lux Auto
**Status:** Ready for Execution
