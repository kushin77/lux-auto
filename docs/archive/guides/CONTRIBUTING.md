# Lux-Auto CONTRIBUTING.md

## Engineering Constitution

This repository operates at enterprise standards. Every contribution must be:

- **Secure by default** — No hardcoded secrets, least-privilege defaults
- **Observable by default** — Structured logging, metrics, tracing
- **Scalable by design** — Stateless services, explicit concurrency limits
- **Automated end-to-end** — All tests, scans, deployments automated
- **Measurable** — Benchmarks, SLOs, coverage thresholds enforced
- **Defensible in audit** — Compliance-ready, trace-logged, policy-compliant

**Working code is not sufficient. Production-hardened is the baseline.**

## AI-Assisted Development Directive

All AI-generated contributions (GitHub Copilot, Claude, internal agents) must operate in **Ruthless Enterprise Mode**.

### AI Must:

- Challenge architectural assumptions
- Avoid demo-level implementations
- Avoid insecure defaults (e.g., plaintext secrets)
- Avoid hidden scalability ceilings (unbounded memory, connection pools)
- Avoid implicit coupling (hardcoded service URLs, tightly-bound modules)
- Avoid unbounded concurrency or resource consumption

AI-generated code must meet the same standards as senior staff engineers. If it would not survive principal-level review at Amazon, Google, or Meta, it does not merge.

---

## Mandatory Review Gates

Every PR must satisfy these non-negotiable criteria:

### 🏗️ Architecture
- [ ] **Horizontal scalability validated** — Stateless where possible; explicit session/state management
- [ ] **Service dependencies explicit** — No surprise cross-service calls
- [ ] **Failure isolation documented** — What fails if this service fails?
- [ ] **ADR linked** (if architectural change) — See [ADR System](#adr-system)
- [ ] **FastAPI conventions** — Route grouping, dependency injection, exception handling

### 🔒 Security
- [ ] **Zero hardcoded secrets** — All configuration from GSM/environment
- [ ] **Least privilege IAM** — Database users scoped, service accounts limited
- [ ] **Input validation present** — Pydantic models, SQL injection prevention
- [ ] **OAuth2 flow intact** — X-Auth-Request-Email validation, session hashing
- [ ] **Audit logging** — `[AUDIT]` tagged logs for all state changes
- [ ] **Threat model included** (for new services) — See [ADR System](#adr-system)

### ⚡ Performance
- [ ] **No blocking in hot paths** — Async/await used correctly
- [ ] **No N+1 query patterns** — Database queries optimized, joins explicit
- [ ] **Measured, not assumed** — Benchmarks or profiler output required
- [ ] **Defined resource limits** — Connection pools, timeouts, memory caps documented

### 📊 Observability
- [ ] **Structured logging** — JSON format, `[SECURITY]`/`[AUDIT]` tags, no secrets
- [ ] **Metrics emitted** — Prometheus format, latency/error rates tracked
- [ ] **Tracing enabled** — Correlation IDs across service boundaries
- [ ] **Health endpoints** — `/health`, `/readiness` returning proper status
- [ ] **Alert conditions defined** — SLO targets, error budgets documented

### 🚀 CI/CD
- [ ] **Deterministic builds** — No timestamp-dependent artifacts
- [ ] **Automated tests required** — Unit (90%+ backend coverage), integration, E2E
- [ ] **Static analysis enforced** — Pylint/Black for Python, ESLint for JS
- [ ] **Security scans enforced** — SAST, dependency checks, secrets scanning
- [ ] **Versioned artifacts** — All images tagged with commit SHA
- [ ] **Rollback strategy defined** — How to revert safely in production?

### ✅ Definition of Done

A change is complete only when:

- ✔️ Secure (no secrets, proper auth, input validation)
- ✔️ Observable (logs, metrics, alerts)
- ✔️ Load-tested (or verified non-critical path)
- ✔️ Documented (code comments, ADR if needed, README updated)
- ✔️ Automated (tests + deployment)
- ✔️ Reproducible (anyone can rebuild/redeploy)
- ✔️ Policy-compliant (OPA checks passing, no policy violations)

**"Works locally" is not done. Production-ready is the bar.**

---

## PR Template (Required)

See `.github/pull_request_template.md`. All PRs must complete every section.

**Reviewers will block PRs that skip sections.**

---

## Code Ownership & Review Requirements

See `.github/CODEOWNERS`. 

**Critical areas require senior approval. No self-merging for high-risk domains.**

---

## ADR System

**Every architectural decision must be documented in `/docs/adr/`.**

### Required Sections:

```markdown
# ADR-XXX: [Title]

## Status
[Proposed | Accepted | Deprecated]

## Context
Why are we making this decision?

## Decision
What are we doing?

## Alternatives Considered
- Option A: [pros/cons]
- Option B: [pros/cons]

## Consequences
What changes as a result?

## Security Implications
How does this affect auth, data protection, audit?

## Scaling Implications
Does this hit a ceiling? Under what load?

## References
Links to related ADRs, RFCs, threat models.
```

**No major architectural change (new service, auth mechanism, database schema) without an ADR. No exceptions.**

---

## SLO Enforcement

For every production service, document:

- **SLIs** (Service Level Indicators) — What do we measure?
- **SLO targets** — What's our availability/latency goal?
- **Error budget** — How much failure is acceptable per month?
- **Alert thresholds** — At what point do we page?

**Without this, you're not engineering — you're gambling.**

---

## Lux-Auto Specific Standards

### Backend (FastAPI)

**Type Hints:** All functions must have type hints. No `Any` unless justified in comment.

```python
async def get_user(user_id: int) -> User:
    """Get user by ID. Raises 404 if not found."""
```

**Docstrings:** Google-style, include examples for complex functions.

```python
def hash_token(token: str, algorithm: str = "sha256") -> str:
    """Hash a token using specified algorithm.
    
    Args:
        token: Raw token string.
        algorithm: Hash algorithm (sha256, sha512).
        
    Returns:
        Hex-encoded hash.
        
    Raises:
        ValueError: If algorithm not supported.
    """
```

**Async/Await:** All I/O must be async. No blocking operations in request handlers.

```python
# ✅ Good
async def fetch_user(db: AsyncSession, user_id: int):
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalars().first()

# ❌ Bad
def fetch_user(db: AsyncSession, user_id: int):
    result = db.execute(...)  # Blocking!
```

**Database Access:** Use SQLAlchemy ORM, never raw SQL except for migrations.

- Table names: plural (`users`, `user_sessions`)
- Primary key: always `id`
- Foreign keys: `{table_singular}_id`
- Indexes: `ix_{table}_{column}`

**Error Handling:**
- 401 Unauthorized (missing/invalid auth)
- 403 Forbidden (insufficient permissions)
- 422 Unprocessable Entity (validation errors)
- Always return JSON: `{"detail": "..."}`

**Logging:**

```python
import logging

logger = logging.getLogger(__name__)

# Security events
logger.warning("[SECURITY] Failed login attempt: user=%s, ip=%s", user_id, request.client.host)

# Audit events
logger.info("[AUDIT] User created: user_id=%s, created_by=%s", new_user.id, current_user.id)

# Never log secrets
logger.debug("Token hash: %s", token_hash)  # OK
# logger.debug("My secret: %s", secret_key)  # NEVER
```

**Testing Minimum:**

- Unit tests for auth, user service, business logic (90%+ coverage)
- Integration tests for database + service layers
- E2E tests for full OAuth2 flow
- Security tests for injection/spoofing

```bash
pytest tests/ --cov=backend --cov-fail-under=90
```

### Security Checklist

- [ ] No hardcoded `GOOGLE_CLIENT_SECRET` or `FASTAPI_SECRET_KEY`
- [ ] All secrets fetched from GSM at startup
- [ ] Session tokens hashed (SHA-256), never stored in plaintext
- [ ] Database passwords rotated in production (handled by infrastructure)
- [ ] Input validation on all endpoints (Pydantic models required)
- [ ] SQL injection tests passing
- [ ] CORS policies explicit, not `*`
- [ ] Rate limiting on auth endpoints (if applicable)

### Database Migrations

- Use Alembic, never manual DDL in production
- Migrations are versioned, idempotent, tested
- Rollback strategy documented in migration file

### Deployment

- All Docker images signed and scanned
- Database migrations run before app start
- Health checks passing before traffic
- Rollback tested (can revert to previous image?)

---

## CI/CD Pipeline Requirements

Pipeline **must** include (in order):

1. **Lint** — `black --check`, `pylint`
2. **Type Check** — `mypy src/`
3. **Unit Tests** — `pytest tests/unit/ -v`
4. **Coverage Gate** — Fail if < 90% on critical modules
5. **SAST** — Bandit, SonarQube equivalent
6. **Dependency Scan** — Safety, Snyk equivalent
7. **Secrets Scan** — Detect hardcoded credentials
8. **Integration Tests** — `pytest tests/integration/`
9. **Build Docker Image** — Tag with commit SHA
10. **Container Scan** — Trivy or equivalent
11. **E2E Tests** — Full system test (if applicable)
12. **Policy Check** — OPA/Conftest (if rules exist)

**Failure anywhere = block merge. No exceptions.**

---

## Branch Protection Rules

GitHub enforces:

- [ ] Require PR before merge
- [ ] Require 2 approvals (1 from code owner)
- [ ] Require all status checks passing
- [ ] Require conversation resolution (no stale comments)
- [ ] Prevent force pushes
- [ ] Restrict who can push to `main`
- [ ] Require signed commits (optional, elite tier)

---

## Example Complete Workflow

1. Create issue describing problem/feature
2. Create branch: `git checkout -b sso-oauth2-session-refresh`
3. Implement + test locally
4. Commit with issue reference: `git commit -m "[#42] Add OAuth2 session refresh endpoint"`
5. Push, open PR with template completed
6. Address review comments (security, performance, observability)
7. All CI checks pass
8. Code owner approves
9. Squash and merge (for single-commit PRs) or keep history (for multi-commit)
10. Monitor rollout (check logs, metrics, alerts)

---

## Ruthless Truth

If:

- Policies are not automated (CI gates)
- Reviews are optional (enforcement missing)
- Security scans are warnings only (not blocking)
- Performance is not measured (guessing, not validating)
- ADRs are ignored (architectural debt)
- Secrets are in code comments (NEVER)

Then this document is **corporate cosplay**, not engineering.

**Elite engineering = enforcement + culture + automation.**

---

## Questions?

- Architecture questions → Open an issue with `[ADR]` prefix
- Security concerns → Email directly to maintainers
- Performance questions → Profile first, ask second
- Process questions → See CODEOWNERS for domain experts
