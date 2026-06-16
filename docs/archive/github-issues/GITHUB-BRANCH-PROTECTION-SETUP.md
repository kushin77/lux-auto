# GitHub Configuration Guide - Phase 3 Setup

**Date:** April 12, 2026  
**Status:** Pre-Phase 3 Setup Instructions  
**Target:** Complete before Monday, April 15

---

## Branch Protection Configuration

### Configure `main` Branch Protection

**Steps:**
1. Go to: https://github.com/kushin77/lux-auto/settings/branches
2. Add rule for branch name: `main`
3. Enable these settings:

```
☑ Require a pull request before merging
  ☑ Require 2 approvals
  ☑ Require code owner review
  ☑ Dismiss stale PR reviews
  ☑ Require review from CODEOWNERS

☑ Require status checks to pass before merging
  ☑ Require branches to be up to date
  Require status checks:
    ☑ ci (linting, tests)
    ☑ security (SAST, secret scan)
    ☑ build (Docker build validation)

☑ Require conversation resolution before merging

☑ Include administrators in restrictions

☑ Allow force pushes: Disabled

☑ Allow deletions: Disabled
```

**Expected Result:**
- Can't merge directly to `main`
- Requires PR with 2 approvals
- Requires branch to be up-to-date with `dev`
- Requires all CI checks to pass

---

### Configure `dev` Branch Protection

**Steps:**
1. Go to: https://github.com/kushin77/lux-auto/settings/branches
2. Add rule for branch name: `dev`
3. Enable these settings:

```
☑ Require a pull request before merging
  ☑ Require 1 approval  (less strict than main)
  ☑ Require code owner review
  ☑ Dismiss stale PR reviews

☑ Require status checks to pass before merging
  ☑ Require branches to be up to date
  Require status checks:
    ☑ ci (linting, tests)
    ☑ security (SAST, secret scan)
    ☑ build (Docker build validation)

☑ Require conversation resolution before merging

☑ Include administrators in restrictions: No (admins can bypass)

☑ Allow force pushes: Disabled

☑ Allow deletions: Disabled
```

**Expected Result:**
- Can't merge directly to `dev`
- Requires PR with 1 approval
- Requires branch to be up-to-date
- Requires all CI checks to pass
- Admins can bypass if emergency

---

## GitHub Actions Status Checks Configuration

### What We've Already Enabled

✅ Ready to use:
- `auto-close-issues.yml` - Auto-closes issues on merge
- `issue-status-updates.yml` - Updates issue labels in real-time
- `required-checks.yml` - Status checks for lint, security, build, tests

### Status Checks Workflow

File: `.github/workflows/required-checks.yml` (Created)

**Runs on:**
- Every PR (opened, synchronized, reopened)
- Every push to main and dev

**Checks included:**
- ✅ **Lint Check** (flake8, black, isort, pylint)
  - Format validation
  - Import order checking
  - Code quality scoring
  
- ✅ **Security Check** (Trivy, Trufflehog)
  - Vulnerability scanning
  - Secret detection
  - Exposed credential checking
  
- ✅ **Build Check** (Docker)
  - Docker image build
  - docker-compose validation
  
- ✅ **Test Check** (pytest)
  - Unit tests
  - Integration tests
  - Code coverage reporting

**Result:** After PR is created, all 4 checks run automatically

---

## GitHub Secrets Configuration

### Required Secrets for Phase 3+

Go to: https://github.com/kushin77/lux-auto/settings/secrets/actions

**Add these secrets:**

| Secret Name | Value | Used By |
|-------------|-------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Tests |
| `REDIS_URL` | Redis connection string | Tests |
| `CODECOV_TOKEN` | Coverage reporting | Tests |
| `DOCKER_HUB_USERNAME` | Hub username | Docker push |
| `DOCKER_HUB_TOKEN` | Hub token | Docker push |
| `SLACK_WEBHOOK` | Slack notification URL | Alerts |

**How to add:**
1. Go to settings link above
2. Click "New repository secret"
3. Name: `SECRET_NAME`
4. Value: Paste the actual value
5. Click "Add secret"

---

## Environment Files

### Create `.env.template` 

File: `.env.template` (for developers to copy)

```bash
# Database
DATABASE_URL=postgresql://user:pass@lux.kushnir.cloud:5432/lux_auto
DATABASE_ECHO=false

# Redis
REDIS_URL=redis://lux.kushnir.cloud:6379/0
REDIS_TTL=3600

# Security
SECRET_KEY=your-secret-key-change-in-production
API_KEY_ROTATION_DAYS=90

# Features
FEATURE_WEBSOCKET=true
FEATURE_AUDIT_LOG=true
FEATURE_CACHING=true

# Monitoring
SENTRY_DSN=https://your.sentry.io/project
JAEGER_AGENT_HOST=lux.kushnir.cloud
JAEGER_AGENT_PORT=6831

# Testing
TEST_DATABASE_URL=postgresql://test:test@lux.kushnir.cloud:5432/lux_auto_test
PYTEST_WORKER_COUNT=4
```

---

## Manual Verification Checklist

Before Phase 3 starts Monday, verify:

### Branch Protection for `main`

- [ ] Go to repo Settings → Branches
- [ ] Rule exists for `main`
- [ ] "Require 2 approvals" is enabled
- [ ] "Require code owner review" is enabled
- [ ] "Require branches to be up to date" is enabled
- [ ] "Require status checks to pass" is enabled
- [ ] Create test PR: Verify can't merge without approvals

### Branch Protection for `dev`

- [ ] Go to repo Settings → Branches
- [ ] Rule exists for `dev`
- [ ] "Require 1 approval" is enabled
- [ ] "Require branches to be up to date" is enabled
- [ ] Create test PR: Verify can't merge without approval

### GitHub Actions

- [ ] Go to repo Actions tab
- [ ] See workflow runs for all 4 new workflows
- [ ] See recent run logs
- [ ] Verify no errors in logs

### Secrets

- [ ] Go to repo Settings → Secrets & variables → Actions
- [ ] See all 6 secrets listed (names only, values hidden)
- [ ] Values are set correctly (test by running action)

---

## What Happens When Phase 3 Starts

### Monday 10 AM: Developer Creates PR

```
Developer creates PR from feature/2 → dev
PR description: "Fixes #2"
GitHub automatically:
  1. ✅ Runs required-checks.yml
     - Lint check starts
     - Security check starts
     - Build check starts
     - Test check starts
  
  2. ✅ Runs issue-status-updates.yml
     - Issue #2 gets "in-progress" label
     - Comment added: "PR #456 in progress"
  
  3. ✅ Blocks merge (until checks pass)
     - Status shows: "4 checks in progress"
     - Blue dot next to PR number
```

### Within 5 minutes: Status Checks Complete

```
Developer sees:
  ✅ Lint: PASSED (imports good, format good)
  ✅ Security: PASSED (no secrets found)
  ✅ Build: PASSED (Docker builds)
  ✅ Tests: PASSED (all unit & integration pass)

PR Status changes:
  ✅ All checks passed
  Green checkmark visible
  "Merge pull request" button becomes available
```

### Developer Submits for Review

```
GitHub automatically:
  1. ✅ Runs issue-status-updates.yml
     - Issue #2 gets "review" label
     - Comment updated: "Awaiting 1 review"
  
  2. ✅ Requests review from code owners
     - Automated request from CODEOWNERS file
```

### Review Complete, PR Merged

```
When PR merged:
  1. ✅ Runs auto-close-issues.yml
     - Detects "Fixes #2" in PR body
     - Sets Issue #2 state = "closed"
     - Adds "done" label
     - Posts comment with merge commit
  
  2. Issue #2 on GitHub shows:
     - 🟢 CLOSED (green badge)
     - Labels: done, merged, phase-3
     - Comment: "✅ Closed by merged PR #456"
     - Timestamp of merge
```

---

## Troubleshooting

### Status Checks Taking Too Long

**Problem:** Checks running for 10+ minutes

**Solution:**
1. Check if database is alive (for tests)
2. Check if Docker build is slow (first run)
3. Check if large test suite running
4. Increase GitHub Actions timeout if needed

### Checks Failing

**Problem:** "ci" check failing

**Solution:**
1. Check run logs: Click on failed check
2. Scroll to error
3. Common issues:
   - `black` formatting: Run `black .` locally
   - `isort` imports: Run `isort .` locally
   - `pytest` tests: Run `pytest` locally, fix, push again

### Secret Not Found in Workflow

**Problem:** Workflow says "SECRET_NAME is empty"

**Solution:**
1. Go to Settings → Secrets & variables → Actions
2. Verify secret exists
3. Verify secret VALUE is not empty (click and verify)
4. Re-run workflow

### Branch Protection Not Blocking

**Problem:** Can merge PR without approvals

**Solution:**
1. Go to Settings → Branches
2. Verify rule for `main` or `dev` exists
3. Verify "Require approval" is checked
4. Verify "Include administrators" is checked (for mainbranch)

---

## Next Steps

### This Weekend (Apr 13-14)
- [ ] Read this guide
- [ ] Configure branch protection for `main`
- [ ] Configure branch protection for `dev`
- [ ] Add GitHub secrets
- [ ] Test with a sample PR

### Monday Morning (Apr 15)
- [ ] Phase 3 starts
- [ ] Developers create feature branches
- [ ] First PRs use "Fixes #N" pattern
- [ ] Watch automation in action! 🚀

---

**Questions?** See:
- HOW-ISSUES-ACTUALLY-GET-CLOSED.md
- GITHUB-ISSUES-MANDATE.md
- PHASE-3-READY.md
