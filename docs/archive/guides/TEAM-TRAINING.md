# Team Training: Enterprise Standards Framework

**Duration:** 30 minutes  
**Audience:** All developers, new hires, managers  
**Goal:** Understand why we enforce standards and how to work with them

---

## Part 1: Why This Matters (7 minutes)

### The Problem We Solve

**Before Enterprise Standards:**

```
Monday:
- Developer writes feature quickly
- Tests locally ✓
- Pushes to main
- Auto-deploys to production

Tuesday 3:15 AM:
- Memory leak cascades
- Database hits max connections
- API returns 500s for 20 minutes
- Customer notified
- On-call engineer pages in
- Emergency meeting at 7 AM

Postmortem:
Q: "Why didn't we catch this?"
A: "Was working on my laptop..."
```

**After Enterprise Standards:**

```
Monday:
- Developer writes feature
- Pre-commit hooks catch: hardcoded secret, missing test coverage
- Fixes locally
- Pushes to feature branch
- GitHub Actions runs 9 checks:
  ✓ Formatting
  ✓ Type checking
  ✓ Unit tests (90% coverage required)
  ✓ Security scan (no secrets, no vulnerabilities)
  ✓ Dependency check (no unpatched libs)
  ✓ Integration tests
  ✓ Docker image scan
  ✓ All checks pass

Tuesday:
- Code review by 2 developers
- "Does this scale to 10x load?"
- "How do we rollback if it fails?"
- ADR created documenting architectural decision
- Approval given

Wednesday:
- Auto-deploys to staging
- Smoke tests pass
- Manual approval for production
- Auto-deploys with monitoring
- Metrics show: latency +2%, error rate 0.01%, SLO met ✓

Friday:
- Feature working smoothly
- No 3 AM pages
- Customer happy
```

### The Math

**Cost of Production Outage:**
- 15 minutes downtime = customer impact
- 1 hour on-call response = person-hours lost
- Post-mortem investigation = team distraction
- Lost business/reputation = ???

**Cost of 30-minute code review:**
- Catches bugs before production
- Prevents 3 AM pages
- Transfers knowledge
- Builds confidence in code quality

**Return:** ~100x return on investment

### The Culture

**"We don't guess. We measure."**

- Performance is benchmarked, not assumed
- Failures are logged and analyzed
- SLOs are tracked, reviewed, enforced
- Standards are automated, not hope-based

---

## Part 2: How We Enforce Standards (10 minutes)

### Layer 1: Local Development (Developer's Home)

```
Your laptop runs:
├─ Pre-commit hooks (black, pylint, mypy, bandit, secrets scan)
└─ These catch ~70% of issues BEFORE pushing

Result: You already know if code is good before your coworker reviews it
```

**Setup (one-time):**
```bash
pip install pre-commit
pre-commit install

# Now every commit runs checks locally
git commit -m "My change"
# Pre-commit hooks run automatically
# If any fail, commit is blocked until fixed
```

### Layer 2: GitHub CI/CD (Automated Quality Gate)

```
You push to feature branch
    ↓
GitHub Actions runs (no human needed):
├─ Lint checks  (black, pylint, flake8)
├─ Type checking (mypy)
├─ Unit tests (pytest, coverage gate 90%)
├─ Security scan (bandit, secrets)
├─ Dependency scan (safety)
├─ Integration tests
├─ Docker build
└─ Container scan (trivy)

Any failure → PR shows ❌ → Cannot merge

Result: Only code that passes all checks reaches code review
```

**For developers:**
```bash
# See CI status in GitHub PR
# If it fails:
git log --oneline  # See what you changed
git diff origin/main  # Review your changes

# Fix locally and push again
# CI runs again automatically
```

### Layer 3: Code Review (Human Expertise)

```
Your PR passes all CI checks ✓
    ↓
GitHub auto-requests 2 reviewers (from .github/CODEOWNERS)
    ↓
Reviewers check:
├─ Architecture (scales? fails gracefully?)
├─ Security (secrets? auth? audit logging?)
├─ Performance (benchmarked? no N+1 queries?)
├─ Observability (logs? metrics? alerts?)
└─ Tests (coverage? edge cases?)

Reviewers can:
├─ Approve (2 needed to merge)
├─ Request changes (must fix before merge)
└─ Comment (discussion)

All conversations must resolve before merge

Result: Two experienced engineers validate code beyond what automation catches
```

**For reviewers:**
```
Quick checklist:
☑ Does this scale to 10x load?
☑ Can we rollback safely?
☑ Are there audit logs for state changes?
☑ Is error handling appropriate?
☑ Did developer test at scale? (Ask for benchmark)
```

### Layer 4: Staging Deployment (Real Environment Test)

```
Code approved and merged to main
    ↓
GitHub Actions automatically:
├─ Builds Docker image (tagged with commit SHA)
├─ Deploys to staging environment
├─ Runs smoke tests
└─ Notifies Slack

Potential issues caught here:
├─ Configuration mismatches
├─ Database migration failures
├─ Missing environment variables
└─ Environmental issues (file system, network)

Result: Real environment testing before production
```

### Layer 5: Production Deployment (Manual + Approval)

```
Create release tag: git tag -a v1.2.3

GitHub Actions:
├─ Signs Docker image (cryptographic proof)
├─ Requires manual approval in GitHub Environments
├─ Deploys to production
├─ Runs smoke tests
└─ Sends Slack notification

Only @kushin77 can approve production deployments

Result: Intentional, approved deployments to production
```

### Layer 6: Operational Monitoring (SLO Enforcement)

```
Code in production
    ↓
Metrics collected:
├─ Error rate (target: < 0.1%)
├─ Latency p95 (target: < 200ms)
├─ Availability (target: 99.5%)
├─ Database replication lag (target: < 100ms)
└─ Auth success rate (target: > 99%)

If SLO violated:
├─ Prometheus alert fires
├─ AlertManager routes to appropriate team
├─ Slack notification sent
├─ PagerDuty pages on-call if critical
└─ Dashboard shows issue details

Result: Real-time visibility into production health
```

---

## Part 3: Common Workflows (8 minutes)

### Scenario 1: You're Writing a New Feature

**Step-by-step:**

1. **Create branch**
   ```bash
   git checkout -b feature/auth/session-refresh
   ```

2. **Write code locally**
   ```bash
   # Make changes
   # Pre-commit hooks run on commit
   git commit -m "[#42] Add session refresh endpoint"
   # If hooks fail, fix and try again
   ```

3. **Push & open PR**
   ```bash
   git push origin feature/auth/session-refresh
   # GitHub: https://github.com/kushin77/lux-auto/pulls
   # Click "Open PR"
   # Template auto-fills
   ```

4. **Complete PR template**
   - [ ] Summary (what problem does this solve?)
   - [ ] Architecture Impact
   - [ ] Security Review
   - [ ] Performance
   - [ ] Tests (**90%+ coverage required**)
   - [ ] Rollback Plan

5. **Wait for CI**
   - GitHub Actions runs automatically
   - Watch for ✅ or ❌
   - If ❌: Click failing check, read error, fix locally, push again

6. **Code review**
   - 2 developers auto-requested
   - If they request changes, fix and push again
   - If they approve, can merge

7. **Merge**
   - Auto-deploys to staging
   - Smoke tests confirm it works
   - Celebrate! 🎉

### Scenario 2: Code Review Gone Wrong

**Reviewer says:** "This doesn't scale. What happens at 10x load?"

**You:**
1. Write benchmark locally:
   ```bash
   wrk -c 10 -t 4 https://lux.kushnir.cloud/api/endpoint
   # Results: 5,000 req/sec, 50ms latency
   ```

2. Share results in PR comment:
   ```
   Benchmark results attached.
   At 10x load (50k req/sec):
   - Database connections stable (18/20 available)
   - Latency increases 2x (100ms)
   - Error rate: 0%
   
   Scaling strategy: Replicate database read replicas at this load
   ```

3. Reviewer approves, merge

**Lesson:** Justify claims with data, not assumptions

### Scenario 3: Security Scan Failed

**CI shows:** ❌ Bandit: Possible hardcoded secret

**Your code:**
```python
OAUTH2_CLIENT_SECRET = "abc123def456"  # ❌ Bandit caught this
```

**You fix it:**
```python
# backend/main.py
import os

OAUTH2_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")  # ✅ From environment
```

**Then:**
1. Add secret to `.env.example` (without actual value):
   ```
   GOOGLE_CLIENT_SECRET=your-secret-here
   ```

2. Push fix
3. CI re-runs, security scan passes ✓

**Lesson:** Never hardcode secrets. Always use environment variables or GSM.

### Scenario 4: Coverage Dropped

**CI shows:** ❌ Coverage: 87% (required: 90%)

**You add tests:**
```python
# tests/unit/test_session.py
def test_session_refresh_token_validation():
    """Test that invalid token is rejected"""
    result = refresh_session(invalid_token)
    assert result is None

def test_session_refresh_updates_ttl():
    """Test that refresh extends TTL"""
    old_expiry = session.expires_at
    refresh_session(token)
    new_expiry = session.expires_at
    assert new_expiry > old_expiry
```

**Then:**
```bash
pytest tests/ --cov=backend --cov-fail-under=90
# Coverage: 92% ✓
```

**Lesson:** Test edge cases, not just happy path

---

## Part 4: Asking for Help (3 minutes)

### "My PR is stuck, what do I do?"

| Situation | Solution |
|-----------|----------|
| CI failing | Click failing check, read error message, fix locally, push again |
| Code review stuck | Ping reviewer in Slack, discuss what they need |
| Don't understand standard | Read CONTRIBUTING.md section, or ask @kushin77 |
| Unsure if ADR needed | If it's major architecture change, write one. Better safe. |
| Urgent hotfix? | Ask @kushin77 for expedited review, or declare SEV-1 incident |

### Resources

```
CONTRIBUTING.md         → What production-ready means
DEVELOPER-QUICKSTART    → First-time contributor guide
docs/adr/README.md      → When & how to write ADRs
docs/SLOs.md            → Service level objectives
docs/DEPLOYMENT.md      → Release process
docs/ENFORCEMENT.md     → Why we do this
```

### Quick Slack Commands

```
@on-call          → Page on-call engineer
#engineering      → Ask engineering questions
#incidents        → Report production issues
@kushin77         → Questions about standards/decisions
```

---

## Part 5: Philosophy & Culture (2 minutes)

### "Elite engineering = automation + consistency + accountability"

**Automation:**
- Pre-commit hooks catch issues locally (before slow GitHub actions)
- CI/CD gates block bad code automatically (not manual reminder)
- Alerts page on-call when SLOs violated (not hope-based reliability)

**Consistency:**
- Everyone follows same standards (no "my code is special")
- Same review criteria for all (fairness)
- Same deployment process (predictability)

**Accountability:**
- If code breaks, we understand why (logs, metrics)
- If standard bypassed, we discuss it (not blame, but learning)
- Issues tracked and resolved (not swept under rug)

### Ruthless Truth

```
If:
  ❌ Policies not automated (can be bypassed)
  ❌ Reviews optional (depends on reviewer mood)
  ❌ Security scans warnings only (ignored)
  ❌ Performance guessed (not measured)
  ❌ ADRs written but ignored (theater)

Then this is just corporate cosplay.

If:
  ✅ CI/CD gates block bad code
  ✅ Code review required + standardized
  ✅ Scans block merge (not warnings)
  ✅ Performance benchmarked & monitored
  ✅ ADRs enforced, referenced in posts

Then this is engineering.
```

---

## Q&A

**Q: This seems slow, why not just merge quickly?**

A: Merging quickly feels fast. Debugging production at 3 AM feels slow. We optimize for long-term velocity, not short-term throughput.

**Q: What if my code doesn't fit the mold?**

A: It probably does. If genuinely novel, open an issue first, get buy-in, write ADR. No one is smarter than the team.

**Q: Can we skip tests for this small change?**

A: That's how production breaks. "Small" changes often have outsized impact. Tests are safety net.

**Q: Why 2 approvals instead of 1?**

A: Two eyes catch what one misses. (1) bugs, (2) security issues, (3) architectural anti-patterns. Worth the 2 hours waiting.

**Q: What if I disagree with a standard?**

A: Open PR to CONTRIBUTING.md, propose change, get consensus. Standards evolve. But until changed, they apply to all.

---

## Homework

By end of week:

- [ ] Read CONTRIBUTING.md
- [ ] Run pre-commit install locally
- [ ] Read DEVELOPER-QUICKSTART.md
- [ ] Read docs/adr/ADR-001-oauth2-session-management.md
- [ ] Understand your team's SLOs (docs/SLOs.md)

Then: Submit first PR following all standards. Get 2 approvals. Merge. Deploy to prod. Monitor SLOs. 🚀

---

## Success Metrics (Team)

After 3 months with this framework:

```
Safety:
  ✅ Zero production secrets in code
  ✅ Zero security audit findings
  ✅ Zero rollbacks due to missing tests

Quality:
  ✅ Test coverage: 90%+
  ✅ Latency stable (no regressions)
  ✅ Incidents: < 1/month (from bugs)
  ✅ SLO attainment: >99%

Productivity:
  ✅ Lead time (commit→prod): < 4 hours
  ✅ Code review turnaround: < 2 hours
  ✅ Team confidence: HIGH

Culture:
  ✅ Standards understood (not resented)
  ✅ Automation trusted (not second-guessed)
  ✅ New hires productive in 1 week
```

---

**Questions? Slack @kushin77 or open an issue.**

**Welcome to elite engineering. Let's ship excellent code.** ✨
