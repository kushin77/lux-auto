# Enterprise Standards Enforcement

This document explains how Lux-Auto maintains production-grade engineering standards and what happens if policies are not followed.

## The Philosophy

**"Working is not sufficient. Production-hardened is the baseline."**

We don't write code that passes local tests. We write code that survives:

- AWS region failures
- Database deadlocks
- Memory exhaustion
- Cascading failures in dependent services
- Security audits from AWS or regulatory bodies
- 3am pages when something breaks
- Replatforming to Kubernetes or serverless

This requires **automation + culture + enforcement**.

## Enforcement Mechanisms

### 1. Automated Gates (CI/CD Pipeline)

**Location:** `.github/workflows/ci.yml`

Every PR runs:

```
Lint → Type Check → Unit Tests → SAST → Dependency Scan → 
Secrets Scan → Integration Tests → Docker Build → Container Scan
```

**If ANY step fails, merge is BLOCKED.**

No exceptions. No "I'll fix it later." No "I didn't know."

### 2. Code Review Requirements

**Location:** `.github/CODEOWNERS`

Critical domains require:

- **Security code** (`/auth/`, `/security/`): 2 approvals (1 from @kushin77)
- **Database changes** (`/database/`, migrations): 1 approval + SQL verification
- **Infrastructure** (`/terraform/`, `/scripts/`): 2 approvals
- **Documentation changes**: 1 approval (maintainability check)

**Approval cannot come from PR author.**

### 3. Release Gates

**Location:** `.github/workflows/deploy-production.yml`

Production deployment requires:

1. ✅ All CI checks passing
2. ✅ 2+ approvals from reviewers
3. ✅ Manual environment approval (GitHub Environments)
4. ✅ Smoke tests passing on staging
5. ✅ Release notes in tag annotation

**Staging auto-deploys (to catch issues early). Production requires human approval.**

### 4. ADR Enforcement (Architectural)

**Location:** `docs/adr/`

Before implementing:

- New service? ADR required.
- Auth mechanism change? ADR required.
- Database schema change? ADR required.
- Framework upgrade? ADR required.

**ADR missing = PR marked as WIP, cannot merge.**

### 5. SLO Enforcement (Operational)

**Location:** `docs/SLOs.md`

Every service must define:

- SLIs (what we measure)
- SLO targets (availability, latency)
- Error budgets (how much failure is acceptable)
- Alerts (what triggers on-call)

**If SLOs missing, service is "best effort" (not production-ready).**

### 6. Documentation Enforcement

**Location:** CONTRIBUTING.md, PR template

Every PR must document:

- [ ] What problem does this solve?
- [ ] How does this scale?
- [ ] What's the security model?
- [ ] How do we observe this?
- [ ] How do we rollback if it fails?

**Incomplete PR template = request changes, cannot merge.**

## Escalation Path

### Scenario 1: Developer Skips Test Coverage

**Red flag:** Coverage drops from 92% → 87%

**Process:**
1. CI blocks merge (coverage gate fails)
2. Developer must add tests
3. Coverage returns to 90%+
4. CI passes, merge allowed

**Result:** Culture shifts. Next developer won't skip tests.

### Scenario 2: Security Issue in Code

**Red flag:** Bandit flags hardcoded API key

**Process:**
1. CI blocks merge (SAST scan fails)
2. Code review points out issue
3. Developer fixes (moves to GSM)
4. CI passes
5. Merge allowed

**Escalation:** If repeated → pair programming, re-training

**Result:** Knowledge accumulates, team gets better.

### Scenario 3: Missing ADR for Major Change

**Red flag:** Developer refactors authentication without ADR

**Process:**
1. Code review requests ADR
2. Developer writes ADR (context, decision, alternatives, consequences)
3. Architectural discussion happens in PR
4. ADR accepted
5. Merge allowed

**Result:** Decision documented, no future "why did we do this?"

### Scenario 4: Architectural Risk

**Red flag:** New endpoint unintentionally creates N+1 query

**Process:**
1. Code review spots query inefficiency (asks for EXPLAIN ANALYZE)
2. Performance testing shows 10x latency increase at scale
3. Developer optimizes with join or caching
4. Benchmarks show baseline latency maintained
5. Merge allowed

**Result:** Better practices shared with team, junior devs learn

## What Happens If Rules Are Ignored

### Direct Push to Main (Bypass PR)

**Unlikely (branch protection prevents it), but if attempted:**

```
GitHub rejects force push
Error: "Protected branch rule violations"
```

**Only @kushin77 can override, and ONLY for critical hotfixes with:**
- [ ] IR ticket created
- [ ] Incident severity = critical
- [ ] Immediate code review post-merge
- [ ] Postmortem required

### Merge Without Approval

```
GitHub blocks merge:
"This branch requires 2 approvals"
```

**No way around it.** If reviewer unavailable, delay merge or pair with another senior engineer.

### Merge with Failed CI

```
GitHub blocks merge:
"Some status checks are failing"
```

**No bypass.** Developer must fix the failing check (test, lint, security scan, etc.).

### Commit Secrets to Repository

```
CI detects hardcoded API key
→ Blocks merge
→ Developer revokes key in GSM
→ Removes from code
→ Re-encrypts (if needed)
→ Merge allowed
→ Security audit: how did this pass local checks?
```

**Post-incident:** Add pre-commit hook to detect secrets locally.

## Monitoring Enforcement

### Weekly Metrics

Every Monday, team reviews:

```
Last 7 days:
├─ Merges: 8
├─ High-risk merges (security, DB): 2
├─ Failed CI checks: 0
├─ Rollbacks: 0
├─ Mean time to merge: 4 hours
├─ Mean time to production: 6 hours
└─ SLO violation incidents: 0
```

**Goal:** Trend should show quality improving, not regressing.

### Monthly Retrospective

First Tuesday of month:

```
Safety metrics:
├─ Hardcoded secrets blocked: 0 ✅
├─ SAST findings (high): 0 ✅
├─ Failed deployments: 0 ✅
├─ Rollbacks: 0 ✅

Efficiency metrics:
├─ Lead time (commit→prod): 5.2 hours
├─ PR review turnaround: 2.1 hours
├─ Test coverage: 91%

Pain points:
├─ 2 PRs blocked by slow integration tests → Cache optimization needed
├─ 1 PR delayed by SAST false positive → Tool tuning needed

Action items:
├─ [ ] Optimize integration test suite
├─ [ ] Tune SAST rules for fewer false positives
└─ [ ] Add distributed tracing (as per ADR-002 proposal)
```

## Culture Change

Enforcement works only if **team believes in why it matters**.

### Onboarding New Team Member

First week, they learn:

```
1. Read CONTRIBUTING.md
   "This is how we guarantee quality"

2. Walk through a PR end-to-end:
   "CI ran 9 checks. Here's why each matters."

3. Help fix a CI failure:
   "Test coverage dropped. Let's add a test."

4. Deploy to staging:
   "All checks passed. Smoke tests pass. We're confident."

5. Ask: "Why do we require 2 approvals for auth?"
   Answer: "Because auth breaches end the company. Senior eyes catch risks."

6. See a rollback happen:
   "Version bumped memory limit. Performance hit. We caught it in staging.
    Rolled back, fixed root cause, deployed again. That's why we're careful."
```

**Result:** New hire understands security and reliability are not bureaucracy. They're survival.

### Celebrating Compliance

```
#engineering channel:

🎉 @jane-dev
Protected the team from a SQL injection vulnerability.
SAST caught it during code review. Issue fixed.
This is why we enforce static analysis.

🎉 @alex-dev
Architecture decision documented in ADR-004.
Peer review was thoughtful. Decision is now record.
This is how we maintain institutional knowledge.

🎉 0 production incidents this month.
SLO maintained. Error budget healthy.
Great work, team.
```

## Ruthless Truth

If:

- Policies are not automated (CI gates exist, but developers can override)
- Reviews are optional (manager "finds a way to merge it")
- Scans are warnings only (SAST can be ignored)
- Performance is not measured (faster deploy, slower app)
- ADRs are written but ignored (document for compliance, not engineering)

**Then this entire system is theater.**

Enforcement requires:

1. **Automation:** CI/CD gates that block merge
2. **Consistency:** Rules apply to everyone (including founders)
3. **Accountability:** When shortcut is taken, it's noted and discussed
4. **Trust:** Team believes shortcuts hurt us long-term
5. **Reinforcement:** Celebrate when rules catch bugs; mourn when they're bypassed

## Tools & Support

### Local Development Setup

Developers can run CI locally before pushing:

```bash
# Install pre-commit hooks
pre-commit install

# Run lint locally
black backend/ tests/
python -m pylint backend/

# Run tests locally
pytest tests/ --cov=backend --cov-fail-under=90

# Run security scan locally
bandit -r backend/

# Run type check locally
mypy backend/ --ignore-missing-imports
```

**Goal:** Developers catch issues before CI, faster feedback loop.

### Dashboard for Visibility

```
Metrics visible to team:
└─ Merge queue (what's waiting)
└─ CI results (what's failing)
└─ Deployment status (what's in staging/prod)
└─ SLO health (are we meeting targets?)
```

Access: `https://ops.lux.kushnir.cloud/dashboard`

### Escalation Process

If something is blocking development:

```
"Tests are timing out, blocking all PRs"
  Reported by → Dev (comment in PR)
    ↓
  Severity assessed → Critical (no one can merge)
    ↓
  On-call engineer → Investigates root cause
    ↓
  Mitigation → Restart CI service / increase timeouts
    ↓
  Root cause fix → Optimized test suite (merged next day)
    ↓
  Postmortem → Tool tuning improved, prevents recurrence
```

## References

- CONTRIBUTING.md (mandatory reading)
- Pull Request Template (enforced per PR)
- CODEOWNERS (defines review requirements)
- .github/workflows/ci.yml (defines automation)
- docs/adr/ (architectural decisions)
- docs/SLOs.md (reliability targets)
- docs/DEPLOYMENT.md (release process)

---

## Questions?

- **"Why do we enforce this?"** → Ask @kushin77, open Slack thread
- **"How do I bypass this?"** → You don't. Work with the system.
- **"This seems slow"** → It's not. It's fast **and safe**. Slow is debugging production at 3am.
- **"Can we skip this once?"** → No. Once broken, rule is gone.

**Elite engineering = enforcement + culture + automation.**
