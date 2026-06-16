# Developer Quick-Start: Enterprise Standards

This guide gets you up-to-speed on Lux-Auto's production-hardened development process.

## 5-Minute Overview

**Lux-Auto's philosophy:** Code must be **secure, observable, scalable, and measurable** before it merges.

### What Changed?

| Before | After |
|--------|-------|
| Code works locally → merge | Code passes 9 automated checks + 2 code reviews → merge |
| "Production will find bugs" | "Staging finds bugs (or monitoring alerts) |
| Testing optional | 90%+ test coverage required |
| Performance guessed | Performance benchmarked & measured |
| Secrets sometimes hardcoded | Zero secrets in code (enforced by scanner) |
| Deploy whenever | Deploy main → staging (auto), deploy release (manual + approval) |

### The Checklist (Every PR Must Satisfy)

```
Architecture:     Horizontal scaling? Failures isolated? ✓
Security:         No secrets? IAM correct? Audit logged? ✓
Performance:      Benchmarked? No N+1 queries? ✓
Observability:    Logs, metrics, alerts defined? ✓
CI/CD:            All checks passing? Rollback plan? ✓
Tests:            90%+ coverage? ✓
Documentation:    ADR if needed? PR template done? ✓
```

**Missing a check? Reviewers will block merge.**

---

## Getting Started (Your First Contribution)

### Step 1: Set Up Local Environment

```bash
# Clone repo
git clone https://github.com/kushin77/lux-auto.git
cd lux-auto

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt
pip install black pylint flake8 mypy pytest pytest-cov bandit

# Install pre-commit hooks (catches issues before you commit)
pip install pre-commit
pre-commit install
```

### Step 2: Create a Feature Branch

```bash
git checkout -b feature/auth/your-feature-name
```

(Use the naming convention: `feature/{domain}/{description}`)

### Step 3: Write Code

```python
# backend/auth/your_service.py
import logging
from typing import Optional

logger = logging.getLogger(__name__)

async def my_function(param: str) -> Optional[str]:
    """
    What does this do? Why?
    
    Args:
        param: Description
        
    Returns:
        Description
        
    Raises:
        ValueError: If input invalid
    """
    logger.debug("Function called with param=%s", param)
    
    if not param:
        raise ValueError("Param cannot be empty")
    
    # Your code here
    
    logger.info("[AUDIT] State changed: param=%s", param)
    return result
```

### Step 4: Run Local Checks (Before Pushing)

```bash
# Format code
black backend/ tests/

# Lint
python -m pylint backend/ --fail-under=8.0

# Type check
mypy backend/ --ignore-missing-imports

# Unit tests (must achieve 90%+ coverage)
pytest tests/unit/ -v --cov=backend --cov-fail-under=90

# Security scan
bandit -r backend/

# If all pass, good to push!
```

### Step 5: Commit & Push

```bash
git add .
git commit -m "[#42] Add OAuth2 session refresh endpoint

Implements refresh token flow for session extension
- New POST /auth/refresh endpoint
- Session TTL extended to 90 days
- Old tokens revoked on refresh

Fixes #42
"

git push origin feature/auth/your-feature-name
```

### Step 6: Open Pull Request

GitHub will:
1. Auto-fill PR template from `.github/pull_request_template.md`
2. Start CI pipeline (runs all 9 checks)
3. Request reviewers from CODEOWNERS

**Complete every section of the template.** Reviewers will block merge if incomplete.

```markdown
# [#42] Add OAuth2 session refresh endpoint

## Summary
Allows users to extend sessions without re-authenticating.

## Architecture Impact
- [ ] Stateless endpoint (uses existing session table)
- [ ] Database query: SELECT * FROM user_sessions WHERE token_hash = ?
- [ ] Index: ix_user_sessions_token_hash (exists)
- [ ] No new dependencies

## Security Review
- [ ] No hardcoded secrets
- [ ] Input validated (token format check)
- [ ] Audit logged: [AUDIT] Session refreshed
- [ ] OAuth2 flow unchanged

## Performance
- [ ] Benchmark: 50 requests/sec through endpoint
- [ ] Latency: 12ms p95 (database query)
- [ ] No blocking operations

## Observability
- [ ] New log: [AUDIT] Session refreshed: user_id=%s
- [ ] New metric: session_refreshes_total
- [ ] Alert: 0 (normal operation)

## Tests
- Unit test: jwt refresh logic
- Integration test: end-to-end refresh flow
- E2E test: browser refresh token scenario
- Coverage: 94%

## Rollback Plan
Revert commit, session table schema unchanged.
```

### Step 7: Address Code Review

Reviewers might ask:

```
❓ "How does this handle 10x load?"
→ Run benchmark: `wrk -c10 -t4 https://lux.kushnir.cloud/auth/refresh`
→ Share results in comment

❓ "What happens if database is down?"
→ Add try/except, return 503 Service Unavailable
→ Add test for this scenario

❓ "Where do we alert on refresh failures?"
→ Add alert rule in docs/SLOs.md
→ Configure in monitoring system
```

### Step 8: Merge When All Green

```
✅ All CI checks passing
✅ 2 approvals from code owners
✅ All conversations resolved
→ GitHub allows merge
```

### Step 9: Monitor Deployment

```
Automatic:
1. Main branch: Auto-deploys to staging
2. Run smoke tests
3. Slack notifies: "Staging deployment OK"

Manual:
1. Create release tag: git tag -a v1.0.1 -m "[CHANGELOG] Add refresh endpoint"
2. Push tag: git push origin v1.0.1
3. GitHub Actions: Requires environment approval
4. @kushin77 approves in GitHub
5. Auto-deploys to production
6. Smoke tests run
7. Slack notifies: "Production deployment OK"
```

---

## Common Scenarios

### "My Tests Are Slow"

```bash
# Identify slow tests
pytest tests/ --durations=10

# Common causes:
# 1. Database queries in tests (use fixtures)
# 2. Waiting for external services (mock them)
# 3. Loading large files (use temp fixtures)

# Solution: Mark slow tests, run separately
# @pytest.mark.slow
# def test_load_large_file(): ...

pytest tests/ -m "not slow"  # Skip slow tests locally
```

### "Coverage Dropped"

```bash
# See what's not covered
pytest tests/ --cov=backend --cov-report=html
open htmlcov/index.html

# Add missing tests
# Don't skip tests to hit coverage, add real tests

# If genuinely untestable code:
# pragma: no cover  # Type ignore lines
```

### "SAST Tool Flagged My Code"

```bash
# Example: Bandit found potential SQL injection

# ❌ Bad
query = f"SELECT * FROM users WHERE id = {user_id}"

# ✅ Good (use parameterized queries)
await db.execute(
    select(User).where(User.id == user_id)
)
```

### "I Hardcoded a Secret by Accident"

```bash
# Secrets scanner caught it before allowing merge ✓
# Now:

1. Remove from code
2. Fetch from GSM in production
3. Update .env.example (no actual values)
4. Revoke old secret
5. Push fix
6. CI re-runs, secrets scanner passes
7. Merge allowed
```

### "I Need to Bypass a Check (NEVER)"

```
"Can we merge without tests passing?"
→ No. Branch protection prevents it.

"Can we skip security scan?"
→ No. CI gates block merge.

"This is a hotfix, no time for reviews?"
→ Still requires 2 approvals. Expedite review via Slack.

"Just this once?"
→ No. Once broken, rule is gone. Standard applies always.
```

---

## When You Need an ADR

**ADR = Architecture Decision Record**

Write one when you're introducing:

- ✅ New service (cache, queue, microservice)
- ✅ Auth mechanism change
- ✅ Database schema change
- ✅ Framework upgrade
- ✅ Major operational decision

**Don't write one for:**
- ❌ Bug fixes
- ❌ Adding a new endpoint (unless architecturally novel)
- ❌ Refactoring
- ❌ Configuration changes

### Example: "I'm Adding a Cache Layer"

```markdown
# ADR-002: Redis Cache for Session Validation

## Context
Session validation is hitting database on every request.
At scale, this becomes bottleneck.

## Decision
Add Redis cache layer in front of database:
1. Check Redis for token_hash first
2. If hit: return instantly
3. If miss: Query database, populate Redis (TTL=1hr)

## Alternatives Considered

### A. Database index optimization
- Pro: No new dependency
- Con: Still database query (100ms vs 50ms)

### B. In-process cache
- Pro: No external dependency
- Con: Cache invalidation hard, multi-instance conflicts

## Consequences
+ 90% reduction in session lookup latency (12ms → 1ms)
- Redis dependency introduced
- Cache invalidation complexity

## Scaling
At 1M users, database load → 10% if Redis caching.
Redis throughput sufficient for 10k req/sec.

## Rollback
Remove Redis logic, session validation falls back to database.
```

Place in `docs/adr/ADR-00X-your-title.md` and link in PR.

---

## Reading List

| Material | Time | Why |
|----------|------|-----|
| CONTRIBUTING.md | 15 min | Understand what production-ready means |
| PR Template | 5 min | Know what reviewers expect |
| Example ADR | 10 min | See architectural thinking |
| docs/SLOs.md | 10 min | Understand reliability targets |
| docs/DEPLOYMENT.md | 10 min | Know the release process |
| ENFORCEMENT.md | 15 min | Understand why standards matter |

**Total: ~1 hour to fully onboard**

---

## Key Principles

### 1. Automation > Manual Review
- CI/CD catches 80% of issues
- Code review catches architectural/security issues
- Both running = high confidence

### 2. Documentation = Understanding
- ADRs explain "why" (not just "what")
- Code comments for complex logic
- Runbooks prevent 3am confusion

### 3. Measurement > Assumption
- Benchmark before and after
- Monitor production metrics
- Alert on degradation

### 4. Failure is Data, Not Weakness
- Incidents happen (if well-managed)
- Post-mortem finds root causes
- Prevent recurrence, move forward
- **Never blame people, fix systems**

---

## Slack Quick-Reference

```
#engineering channel commands:

@copilot ADR-needed   → Request ADR guidance
@copilot ci-failed    → CI pipeline help
@copilot slo-alert    → Production alert question
@on-call              → Page on-call engineer
```

---

## Emergency: Production Down

1. **Create incident ticket**
   ```
   # [INCIDENT] Production API Returning 500
   Service: Backend API
   Severity: Critical
   Time: 2024-01-15 14:32 UTC
   Duration: ~5 minutes
   ```

2. **Check dashboards**
   - Error rate?
   - Latency spike?
   - Database connection pool?

3. **Check logs**
   ```bash
   kubectl logs -f deployment/backend --tail=100 | grep ERROR
   ```

4. **Remediate**
   - Restart service?
   - Scale up?
   - Rollback?

5. **Communicate**
   - Slack #incidents channel
   - Customer notice (if applicable)

6. **Postmortem (Next Day)**
   - Root cause?
   - Could monitoring have caught this?
   - Prevention measures?

---

## Questions?

- Confused about ADRs? → Read docs/adr/ADR-001 (OAuth2 example)
- CI failing? → Check error message, likely failing test or lint
- Code review harsh? → It's not personal, it's standards-based
- Need urgent help? → @kushin77 in Slack

**Welcome to the team. Let's ship excellent code.** 🚀
