# Lux-Auto SSO Skills

This file documents reusable skills for the Lux-Auto SSO implementation.

## Skill Categories

### Infrastructure Skills

#### fetch-gcp-secrets
**Purpose**: Retrieve secrets from Google Secret Manager  
**Pattern**: Used in deploy.sh to inject secrets at runtime  
**Command**:
```bash
gcloud secrets versions access latest --secret="SECRET_NAME" --project="lux-auto"
```

#### validate-service-health
**Purpose**: Check if Docker services are healthy  
**Pattern**: Polling with retry logic (30 attempts, 2s delay)  
**Command**:
```bash
curl -sf http://localhost:SERVICE_PORT/health | jq '.status'
```

#### deploy-with-docker-compose
**Purpose**: Fully automated deployment of multi-container app  
**Pattern**: Fetch secrets → Generate config → Pull images → Start → Migrate → Test  
**Command**: `bash scripts/deploy.sh`

### Backend Skills

#### extract-oauth-headers
**Purpose**: Implement middleware to read X-Auth-Request-Email from oauth2-proxy  
**Pattern**: FastAPI middleware that populates request.state with user info  
**Location**: `backend/auth/middleware.py`  
**Key**: Never trust client auth headers - oauth2-proxy is the security boundary

#### auto-create-admin-user
**Purpose**: Create admin user on first login if email matches ADMIN_USER_EMAIL  
**Pattern**: get_or_create_user() checks if user exists, creates with appropriate role  
**Location**: `backend/auth/user_service.py`  
**Key**: Default admin email hardcoded, no API for role elevation

#### manage-user-sessions
**Purpose**: Track, validate, and revoke OAuth sessions via database  
**Pattern**: Hash tokens before storage, expiration checks on every request  
**Location**: `backend/auth/session_service.py`  
**Key**: Sessions stored in DB (not cookies), 24h TTL default

### Testing Skills

#### test-oauth-flow
**Purpose**: End-to-end test of full OAuth2 authentication  
**Pattern**: Simulate oauth2-proxy headers, verify user creation and role assignment  
**Location**: `tests/e2e/test_oauth_flow.py`  
**Methods**:
- test_admin_user_auto_created()
- test_regular_user_created_as_user_role()
- test_unauthenticated_access_rejected()

#### test-service-health
**Purpose**: Verify all services responding to health checks  
**Pattern**: Parallel health checks for Caddy, oauth2-proxy, FastAPI, PostgreSQL  
**Location**: `tests/integration/test_sso_integration.py`  
**Key**: Services must reach healthy status within 2 minutes

#### test-security
**Purpose**: Verify no injection vulnerabilities or credential leaks  
**Pattern**: Attempt SQL injection, email spoofing, hardcoded credential scanning  
**Location**: `tests/security/test_oauth_security.py`  
**Key**: Session tokens must be hashed, never log credentials

## Workflow Skills

### Issue Implementation Pattern

1. **Read Issue** (GitHub)
   - Extract requirements, acceptance criteria
   - Note dependencies and blockers

2. **Plan Implementation**
   - Identify required files to create/modify
   - Check .instructions.md for conventions
   - Review similar issues for patterns

3. **Implement Code**
   - Follow Python/YAML/Bash standards from .instructions.md
   - Add docstrings and type hints
   - Create tests alongside implementation

4. **Test Locally**
   - Run pytest for Python
   - Run docker compose for services
   - Verify health endpoints

5. **Update Repository**
   - Create memory notes on learnings
   - Reference issue number in commits
   - Link related issues in descriptions

### Deployment Workflow

1. **Pre-Deploy Checks**
   - `bash scripts/validate-config.sh` - verify .env
   - `nslookup lux.kushnir.cloud` - verify DNS
   - `docker compose config` - verify docker-compose.yml

2. **Execute Deployment**
   - `bash scripts/deploy.sh` - automated full deploy
   - Streams colored output to console
   - Stops on first error (set -e)

3. **Post-Deploy Verification**
   - `bash scripts/monitor.sh` - interactive health dashboard
   - Test endpoints manually with curl
   - Check logs for errors: `docker compose logs -f fastapi`

4. **Rollback if Needed**
   - `bash scripts/rollback.sh` - restore previous version
   - Restores from .backup directory
   - Instant recovery without full redeploy

## Common Patterns

### Middleware Implementation
```python
from starlette.middleware.base import BaseHTTPMiddleware

class OAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        email = request.headers.get("X-Auth-Request-Email")
        if not email:
            return JSONResponse(status_code=401, ...)
        request.state.email = email
        return await call_next(request)
```

### Service Pattern
```python
class UserService:
    @staticmethod
    def get_or_create_user(email: str, session: Session):
        user = session.query(User).filter(User.email == email).first()
        if user:
            user.last_login = datetime.utcnow()
            session.commit()
            return user
        # Create new user with appropriate role
        user = User(email=email, role=determine_role(email))
        session.add(user)
        session.commit()
        return user
```

### Database Migration
```python
# alembic/versions/001_create_users.py
def upgrade():
    op.create_table('users', sa.Column('id', sa.Integer, ...))
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

def downgrade():
    op.drop_table('users')
```

### Test Pattern
```python
def test_feature():
    # Arrange: Set up test data
    # Act: Call function being tested
    # Assert: Verify expected outcome
    assert response.status_code == 200
```

## Skill Invocation Commands

### For Copilot/Agents
When implementing issues, reference these skills:

- **"Implement OAuth header extraction"** → fetch-oauth-headers skill
- **"Set up admin user auto-creation"** → auto-create-admin-user skill
- **"Create session management system"** → manage-user-sessions skill
- **"Write E2E tests"** → test-oauth-flow skill
- **"Deploy to production"** → deploy-with-docker-compose skill

### For Manual Execution
```bash
# Fetch secrets for local dev
bash scripts/fetch-gsm-secrets.sh

# Deploy full stack
bash scripts/deploy.sh

# Run all tests
pytest --cov=backend tests/

# Monitor deployment
bash scripts/monitor.sh
```

## Success Metrics

- ✅ All 9 issues (#63-#71) completed
- ✅ 90%+ code coverage on auth module
- ✅ All tests passing (unit, integration, E2E, security)
- ✅ Full deployment automated via script
- ✅ No credentials in git history
- ✅ Services healthy and accessible via https://lux.kushnir.cloud

## References

- Base pattern: https://github.com/kushin77/code-server
- This project: https://github.com/kushin77/lux-auto
- Documentation: See `/memories/repo/lux-auto-conventions.md`
