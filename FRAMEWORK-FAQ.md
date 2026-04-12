# Enterprise Standards Framework - FAQ & Troubleshooting

Quick answers to common questions about Lux-Auto's engineering standards.

## Framework Overview

### Q: Why do we have these standards?

**A:** These standards ensure:
- **Reliability**: 99.5% uptime target (measurable, monitored)
- **Security**: No secrets in code, auth tokens hashed, audit logging
- **Maintainability**: Type hints, test coverage, documented decisions
- **Scalability**: Performance benchmarks, async/await, caching strategy
- **Observability**: Metrics, logging, alerting for every critical path

Think of it like an aircraft: safety systems aren't optional. Neither are ours.

### Q: Does every PR need to pass all 9 CI checks?

**A:** Yes. No exceptions, no manual bypasses.
- If a check fails, the PR cannot merge
- Fix the issue in your code or update the standard (with approval)
- Emergency hotfixes (production bugs): Use branch protection exceptions (requires 2 approvals)

### Q: Can I skip tests if my change is "small"?

**A:** No. "Small" changes often have big impacts:
- Security boundary change → needs security review
- Database query change → needs performance test
- Authentication flow → needs auth tests
- Cache logic → needs cache invalidation test

Every change flows through the same gate. This is the point.

---

## Local Development

### Q: How do I set up my environment?

**A:** Run the automated setup script:

**Bash (macOS/Linux):**
```bash
bash scripts/setup-framework.sh
```

**PowerShell (Windows):**
```powershell
.\scripts\setup-framework.ps1
```

What it does:
- Creates Python virtual environment
- Installs backend dependencies
- Installs dev tools (Black, MyPy, Pytest, Bandit)
- Installs pre-commit hooks
- Validates local setup

### Q: What are pre-commit hooks?

**A:** Scripts that run before each commit. They catch issues early:
- **Black** → Fixes code formatting
- **Ruff** → Detects style violations
- **MyPy** → Finds type errors
- **Bandit** → Detects security issues
- **Detect-secrets** → Prevents credential commits

If a hook fails, your commit is blocked. Fix it and try again.

### Q: My pre-commit hooks are slow. How do I fix it?

**A:** First commit takes time (downloads checkers). Subsequent commits are cached.

If still slow:
```bash
# Update pre-commit
pre-commit autoupdate

# Run in parallel
export PRE_COMMIT_FROM_REF=origin/main
export PRE_COMMIT_TO_REF=HEAD
pre-commit run --from-ref $PRE_COMMIT_FROM_REF --to-ref $PRE_COMMIT_TO_REF
```

If hooks are blocking development:
```bash
# One-time bypass (not recommended)
git commit --no-verify

# Better: fix the hook configuration
# Contact: principal engineer (you)
```

### Q: How do I run tests locally?

**A:** Use pytest:

```bash
# Run all tests with coverage report
pytest tests/ --cov=backend --cov-report=term-missing

# Run specific test file
pytest tests/unit/test_auth.py -v

# Run and stop on first failure
pytest tests/ -x

# Show test output (usually hidden)
pytest tests/ -s

# Run only markers
pytest -m "not slow" tests/
```

**Coverage requirement:** 90%+ on modified files. CI enforces this.

### Q: Code formatting is driving me crazy. Can I disable Black?

**A:** No, but Black has a learning phase:
1. First week: Weird formatting → Gets used to it
2. Second week: Formatting becomes invisible
3. Third week: Consistent code becomes natural

Alternative: Enable Black editor integration:
- VSCode: Install "Black Formatter"
- PyCharm: Settings → Tools → Python Integrations → Black
- Vim: Run `black <file>` manually

### Q: How do I check type correctness?

**A:** Run MyPy:

```bash
# Check entire backend
mypy backend/ --ignore-missing-imports

# Check specific module
mypy backend/auth/ 

# Show detailed error info
mypy backend/ --show-traceback
```

**Common error:** Missing type hints on function parameters.
```python
# ❌ Bad
def authenticate(user):
    ...

# ✓ Good
def authenticate(user: User) -> Token:
    ...
```

---

## Pull Requests

### Q: What should I include in a PR?

**A:** The PR template has 8 required sections. Complete all of them:

1. **Summary** - What problem does this solve?
2. **Architecture Impact** - How does this scale? What fails?
3. **Security Review** - Could this leak secrets? Auth issues?
4. **Performance** - Did you benchmark it? Any blocking ops?
5. **Observability** - Added metrics? Logs? Alerts?
6. **CI/CD** - Tests passing? Coverage >90%?
7. **Risk Assessment** - What breaks? What's the blast radius?
8. **Rollback Plan** - How do we revert this in production?

Incomplete template = Changes Requested (blocked).

### Q: Why does my PR need 2 approvals?

**A:** Different approval tiers:
- **Author code review** (1st approval) - Functional correctness
- **Senior review** (2nd approval) - Production readiness

Special cases:
- `/backend/auth/` - REQUIRES principal engineer approval (security-sensitive)
- `/terraform/` - REQUIRES platform team approval (infrastructure impact)
- `/docs/adr/` - REQUIRES principal engineer (architectural decisions)

See `.github/CODEOWNERS` for exact rules.

### Q: Can I merge if 1 approval is from my team lead?

**A:** No. CI pipeline requires BOTH:
- Code review from team member
- CODEOWNERS approval from domain owner

This isn't about trust, it's about visibility. Multiple eyes catch issues.

### Q: How long does CI take?

**A:** Typically 5-10 minutes:
- Lint: 30s
- Type check: 1 min
- Unit tests: 3-4 min (with coverage)
- SAST: 1 min
- Dependency scan: 30s
- Secrets scan: 1 min
- Integration tests: 2 min (if applicable)
- Container build: 1-2 min

**Slowest stage:** Usually unit tests. Optimize with:
- Enable pytest-xdist (parallel execution)
- Cache fixtures in conftest.py
- Mock external calls

### Q: Why was my PR blocked by SAST?

**A:** Bandit detected a security issue. Common ones:

| Issue | Example | Fix |
|-------|---------|-----|
| Hardcoded secret | `password = "admin123"` | Use env var |
| SQL injection | `f"SELECT * FROM users WHERE id={id}"` | Use parameterized query |
| Weak crypto | `hashlib.md5()` | Use `hashlib.sha256()` |
| Pickle usage | `pickle.loads(data)` | Use json.loads() |

See `.sast-ignore` for false positives (requires approval).

### Q: How do I address review comments?

**A:** Don't delete comments, respond to them:

1. **If you agree** → Fix and reply "Done"
2. **If you disagree** → Explain your reasoning
3. **If it's a question** → Answer it
4. **If resolve is unclear** → Ask reviewer for clarification

Reviewers use these responses to decide on approval.

---

## Monitoring & Alerts

### Q: What does it mean when I get a Slack alert?

**A:** Someone's SLO is being violated. Take action:

| Alert | Meaning | Action |
|-------|---------|--------|
| HighErrorRate | >5% of requests failing | Check Backend logs, DB health |
| HighLatency | Response time >1000ms | Check query performance, cache hits |
| HighDatabaseConnections | >80% pool used | Check for connection leaks |
| OAuthFailureRate | >1% auth failures | Check OAuth2 Proxy, token validity |

**Critical alerts** (red) go to PagerDuty → on-call engineer.
**Warning alerts** (yellow) go to Slack #alerts → next standup.

### Q: Can I silence alerts?

**A:** No. Silencing an alert hides a real problem.

If alert is false positive:
1. Document why in AlertManager (context)
2. Propose threshold adjustment
3. Get principal engineer approval
4. Update `alert_rules.yml`
5. Commit and deploy

Real scenario: Alert triggers on expected load spike. Don't silence it, adjust threshold.

### Q: How do I check SLO attainment?

**A:** Login to Grafana:
1. Go to http://localhost:3000 (or production dashboard)
2. Look for "SLO Attainment" dashboard
3. View error budget burn-down rate

If burn rate is high, errors will cause downtime. Focus on reliability.

---

## Architecture Decisions

### Q: When do I write an ADR?

**A:** Write an ADR when making architectural decisions that:
- Affect multiple services
- Have security implications
- Impact scalability
- Change data layer
- Alter authentication flow
- Deploy new infrastructure

Don't write ADR for: Bug fixes, single-function changes, refactoring within same architecture.

### Q: What should an ADR include?

**A:** See `docs/adr/README.md` template:

1. **Context** - Why are we deciding this?
2. **Decision** - What did we choose and why?
3. **Alternatives** - What else did we consider?
4. **Tradeoffs** - What are we giving up?
5. **Security Implications** - Any risks?
6. **Scaling Implications** - Will it handle 10x load?

Example: [docs/adr/ADR-001-oauth2-session-management.md](docs/adr/ADR-001-oauth2-session-management.md)

### Q: Can I override an ADR decision?

**A:** Only with ADR (approval from principal engineer):
1. Document context of why it needs to change
2. Propose new decision
3. Document tradeoffs
4. Get 2 approvals (including principal engineer)
5. Update ADR with superseding decision reference

This isn't bureaucracy, it's institutional memory.

---

## Deployment

### Q: When do I deploy to production?

**A:** Only through automated CI/CD pipeline:
1. PR passes all 9 checks
2. Gets 2 approvals
3. Merge to `main` (manually click merge button)
4. Staging auto-deploys (no approval needed)
5. Production waits for manual approval
6. Tag created, deploy runs

Manual deploys are not allowed. Ever.

### Q: How do I roll back if something breaks?

**A:** The fastest rollback is a previous deployment:

```bash
# Get list of recent deployments
git log --oneline main | head -10

# Revert to specific commit
git revert <commit-hash>
# OR
git reset --hard <commit-hash>  # For simple rollback

# Push and trigger automatic deployment
git push

# Verify in production
curl https://lux-auto.example.com/health
```

**Never edit production data directly.** Always go through code.

### Q: What if I need an emergency hotfix?

**A:** Follow hotfix procedure in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md):

1. Create `hotfix/issue-description` branch from `main`
2. Make minimal change (one single focus)
3. PR with explanation (why is this urgent?)
4. Get 2 approvals (same review gate, no shortcuts)
5. Deploy to staging, smoke test
6. Deploy to production with tag
7. Post-mortem: Why did this bug reach production?

---

## Incidents & Debugging

### Q: How do I debug a production issue?

**A:** Use the runbook:

1. Run [docs/runbooks/README.md](docs/runbooks/README.md) detection steps
2. Isolate the problem (database? API? cache?)
3. Check metrics in Grafana (was there a spike?)
4. Check logs in ELK (what errors are logged?)
5. If immediate action needed, execute resolution steps
6. Document findings in incident channel
7. Schedule postmortem

### Q: What goes into a incident postmortem?

**A:** Not blame, root cause analysis:
1. **Timeline** - What happened when?
2. **Impact** - How many users affected? How long?
3. **Root Cause** - Why did this happen? (not "someone made a mistake")
4. **Action Items** - What prevents this next time?
   - Code safeguard? Alerting? Documentation?
5. **Owner** - Who's accountable for fix?
6. **Publish** - Share with team (learning, not shame)

### Q: How do I check logs?

**A:** Backend logs go to stdout (docker logs):

```python
# In backend code
import structlog
logger = structlog.get_logger()

# Log with structure
logger.info("user_login", user_id=user.id, provider="google", ip=request.client.host)
logger.warning("cache_miss", key=cache_key, duration_ms=elapsed)
logger.error("auth_failed", reason="invalid_token", user_id=user.id)
```

View logs:
```bash
# Docker logs
docker compose logs -f fastapi

# Filter by key
docker compose logs fastapi | grep "user_login"

# View with timestamps
docker compose logs --timestamps fastapi
```

---

## Team & Culture

### Q: What if I disagree with a standard?

**A:** Raise it:
1. Document your reasoning
2. Propose alternative with tradeoffs
3. Present to team (with data, not opinion)
4. Get consensus before change
5. Update docs if approved

Standards exist because they solve real problems. If one isn't, we fix it together.

### Q: How often do standards change?

**A:** Quarterly at minimum:
- **Monthly retros** - What's painful? What's working?
- **Quarterly review** - Big changes based on learnings
- **ADRs override old decisions** - No need to wait for review cycle

Stale standards become burdensome. We keep them fresh.

### Q: What if I need an exception?

**A:** Exceptions require conversation:

| Exception | Process |
|-----------|---------|
| Skip SAST check (false positive) | Document + tech lead approval |
| Skip test coverage (legacy code) | Document + principal approval |
| Merge without 2 approvals | Emergency hotfix + postmortem |
| Disable type checking | Needs principal engineer + broader team discussion |

Exceptions are logged and reviewed monthly. Pattern of exceptions = culture issue.

---

## Still Stuck?

**For quick questions:** Slack thread in #development
**For architectural questions:** Open ADR (template in docs/adr/README.md)
**For standard disputes:** Email principal engineer with context
**For emergencies:** Run incident response runbook, then postmortem

**Remember:** The standard isn't your enemy. It's what keeps production running.
