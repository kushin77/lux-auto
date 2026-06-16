# GitHub Setup Procedure - Enterprise Standards Enforcement

**Quick Start:** Follow these steps to enable automated enforcement on GitHub

**Prerequisites:** You need admin access to the kushin77/lux-auto repository

**Time Estimate:** 20-30 minutes total

---

## Part 1: Branch Protection Configuration (10 min)

### Step 1.1: Access Branch Protection Settings

1. Go to: https://github.com/kushin77/lux-auto/settings/branches
2. Click "Add rule" (or edit existing "main" branch rule)

### Step 1.2: Configure Require Pull Request Reviews

**Setting Name:** "Require pull request reviews before merging"

```
✅ Require pull request reviews before merging
   ☑ Required number of approvals before merge: 2
   ☑ Require review from Code Owners
   ☑ Dismiss stale pull request approvals when new commits are pushed
   ☑ Require approval of the most recent reviewable push
```

**Why 2 approvals?**
- First approval: Functional correctness (team member)
- Second approval: Production readiness (domain owner via CODEOWNERS)

### Step 1.3: Configure Status Checks

**Setting Name:** "Require status checks to pass before merging"

```
✅ Require status checks to pass before merging
   ☑ Require branches to be up to date before merging
```

**Select these context checks (all from CI pipeline):**
- [ ] lint (code formatting)
- [ ] type-check (MyPy validation)
- [ ] tests (Pytest with 90%+ coverage)
- [ ] security (Bandit SAST)
- [ ] dependency-scan (dependency vulnerabilities)
- [ ] secrets-scan (hardcoded credentials)
- [ ] integration-tests (E2E validation)
- [ ] build (Docker image build)
- [ ] container-scan (container vulnerabilities)

**Note:** These must match the job names in `.github/workflows/ci.yml`

### Step 1.4: Configure Additional Protection Rules

```
✅ Require conversation resolution before merging
   (Ensures all comments addressed)

✅ Include administrators
   (Even admins can't bypass)

✅ Automatically delete head branches
   (Clean up after merge)

☑ Restrict who can push to matching branches
   (Optional: Limit pushes to @kushin77)
```

### Step 1.5: Save Settings

Click "Save changes" at bottom of page

**Verify:** You should see a green checkmark next to "Branch protection" in the sidebar

---

## Part 2: Pull Request Template Activation (2 min)

### Step 2.1: Verify Template File

Template should exist at: `.github/pull_request_template.md`

**Check it's in place:**
```bash
git ls-files .github/pull_request_template.md
# Should return: .github/pull_request_template.md
```

### Step 2.2: Test Template Appears

1. Go to: https://github.com/kushin77/lux-auto/compare/dev...feature/test
2. Click "Create pull request"
3. **Verify:** PR description field shows the 8-section template

**Note:** Template should auto-populate when creating PRs to main branch

---

## Part 3: Code Owners Configuration (3 min)

### Step 3.1: Verify CODEOWNERS File

File should exist at: `.github/CODEOWNERS`

**Content should include:**
```
# Security-sensitive paths require principal engineer
/backend/auth/ @kushin77
/backend/security.py @kushin77
/docs/ @kushin77

# Database changes require DBA review
/backend/database/ @kushin77
/scripts/sql/ @kushin77

# ADR approval required
/docs/adr/ @kushin77
```

### Step 3.2: Enable CODEOWNERS Requirement

This is **enabled by default** when `.github/CODEOWNERS` file exists.

**Verify it's active:**
1. Create a test PR modifying `/backend/auth/`
2. **Expected:** GitHub auto-requests review from @kushin77 (code owner)
3. **Expected:** Cannot merge without their approval (even with 2 other approvals)

**Access Control:** Go to Settings → Manage access → Confirm team member access levels

---

## Part 4: GitHub Secrets Setup (5 min)

### Step 4.1: Access Secrets

Go to: https://github.com/kushin77/lux-auto/settings/secrets/actions

### Step 4.2: Create Required Secrets

**Secret 1: SLACK_WEBHOOK_URL**
```
Name: SLACK_WEBHOOK_URL
Value: https://hooks.slack.com/services/YOUR/WEBHOOK/URL

How to get:
1. Go to Slack.com
2. Admin → Manage Apps → Create New App
3. Incoming Webhooks → Create New Webhook
4. Select #alerts channel
5. Copy webhook URL
```

**Secret 2: PAGERDUTY_SERVICE_KEY**
```
Name: PAGERDUTY_SERVICE_KEY
Value: your-pagerduty-service-integration-key

How to get:
1. Go to PagerDuty
2. Configuration → Services → Create Service
3. Name: "Lux-Auto Production Alerts"
4. Escalation Policy: your team
5. Copy Integration Key
```

**Secret 3: DOCKER_REGISTRY_TOKEN**
```
Name: DOCKER_REGISTRY_TOKEN
Value: your-docker-registry-access-token

How to get:
1. Docker Hub: Account Settings → Security → New Access Token
2. Or private registry: Generate token from registry admin
3. Ensure token has push permissions
```

**Secret 4: SENTRY_DSN** (if using Sentry for error tracking)
```
Name: SENTRY_DSN
Value: https://[key]@sentry.io/[project-id]

How to get:
1. Sentry.io → Create Project
2. Python → Django (or your framework)
3. Copy DSN URL
```

### Step 4.3: Verify Secrets Are Accessible

Secrets appear in GitHub Actions workflows via `${{ secrets.SECRET_NAME }}`

**Test:** Run CI pipeline, verify no "secret not found" errors

---

## Part 5: GitHub Environments (Optional, Recommended) (5 min)

### Step 5.1: Create Staging Environment

Go to: https://github.com/kushin77/lux-auto/settings/environments

Click "New environment" → Name it "staging"

**Configuration:**
```
Environment: staging
Deployment branches: 
  ☑ All branches allowed (auto-deploy on any merge)

Reviewers: (leave empty, auto-deploy)
```

### Step 5.2: Create Production Environment

Click "New environment" → Name it "production"

**Configuration:**
```
Environment: production
Deployment branches:
  ☑ Selected branches
  └─ main (manual deployments only)

Reviewers:
  ☑ @kushin77 (requires approval before deploy)
  
Wait timer: 0
```

### Step 5.3: Update Workflows to Use Environments

In `.github/workflows/ci.yml`, deployment jobs should reference:

```yaml
deploy-staging:
  environment: staging
  # Auto-runs on dev branch merge

deploy-production:
  environment: production
  # Requires manual approval + approval from @kushin77
```

---

## Part 6: Verify Everything Works (5 min)

### Test 1: Pre-Commit Hooks Block Bad Code

```bash
# Open a shell on your machine
cd ~/repos/lux-auto

# Make a bad commit (e.g., print statement without purpose)
echo 'print("debug")' >> backend/main.py

# Try to commit
git add .
git commit -m "test: verify pre-commit blocks"

# Expected: ❌ Commit blocked by Black/Ruff/MyPy
# Message: "Failed to fix formatting for backend/main.py"
# Fix it by running: black backend/

# After black runs, inspect the file
cat backend/main.py
# Should be auto-fixed

# Try commit again, should succeed
git commit -m "test: verify pre-commit works"
```

### Test 2: CI Pipeline Blocks PR Without Tests

```bash
# Create test branch
git checkout -b test/ci-validation
git checkout -b feature/test-ci

# Add some code without tests
echo 'def new_function(): pass' >> backend/api/test.py

# Create PR (don't merge yet)
git push -u origin feature/test-ci
# Then create PR in GitHub UI

# Expected: ❌ CI fails on coverage requirement
# Message: "coverage below threshold (required: 90%)"
# Fix: Add tests for new_function

# Add tests
cat > tests/unit/test_api.py << 'EOF'
def test_new_function():
    from backend.api.test import new_function
    result = new_function()
    assert result is None
EOF

# Push fix
git add tests/unit/test_api.py
git commit -m "test: add test for new_function"
git push

# Expected: ✅ CI passes now
```

### Test 3: PR Requires 2 Approvals

```bash
# Create a real PR (with complete template)
# Try to merge with only 1 approval

# Expected: ❌ Button disabled
# Message: "This branch has 1 required status check that is either failing or pending, and 1 required approval."

# Get 2nd approval
# Expected: ✅ Merge button enabled
```

### Test 4: CODEOWNERS Auto-Request

```bash
# Create PR that modifies /backend/auth/middleware.py

# Expected: ⭐ GitHub auto-requests review from @kushin77
# Cannot merge without their approval (even if 2 others approve)
```

---

## Troubleshooting

### Status checks not appearing in PR

**Problem:** CI checks don't show in "Checks" tab

**Solution:**
1. Verify `.github/workflows/ci.yml` exists
2. Check workflow file syntax: `yamllint .github/workflows/ci.yml`
3. Ensure workflow has `on: [push, pull_request]`
4. Manually trigger: Go to Actions tab → Select workflow → Run

### Pre-commit hooks aren't running

**Problem:** Developer can commit bad code

**Solution:**
1. Verify hook is installed: `cat .git/hooks/pre-commit`
2. Make it executable: `chmod +x .git/hooks/pre-commit`
3. Reinstall: `pre-commit install --install-hooks`

### Can't merge even though checks pass

**Problem:** "Merge button is disabled"

**Solution:**
1. Verify ≥2 reviews received
2. Verify CODEOWNERS reviewer approved (if applicable)
3. Verify branch is up to date: Click "Update branch"
4. Verify no conversations pending (all resolved)

### Secrets aren't available in workflow

**Problem:** Workflow job fails with "secret not found"

**Solution:**
1. Verify secret name matches exactly (case-sensitive)
2. Verify secret is created in Settings → Secrets
3. Verify workflow references it: `${{ secrets.SECRET_NAME }}`
4. Secrets don't appear in logs (GitHub masks them) ✓

---

## Rollback Instructions (If Needed)

### Temporarily Disable Branch Protection

1. Go to Settings → Branches → main
2. Uncheck "Require pull request reviews before merging"
3. Save changes
4. ⚠️ **WARNING:** Normal PRs can now merge with 0 reviews!

**Time to disable:** < 1 minute
**To re-enable:** Repeat above, check all boxes again

### Disable CI Enforcement

1. Go to `.github/workflows/ci.yml`
2. Change: `name: Deploy and Test` → `name: ci-DISABLED`
3. Or: Move file to `.github/workflows/ci.yml.bak`
4. Commit and push
5. CI won't run

**To re-enable:** Rename back and push

---

## Success Indicators

✅ **After following this guide, you should have:**

- [x] Branch protection on main with 2-approval requirement
- [x] All 9 CI status checks configured
- [x] PR template auto-populates for new PRs  
- [x] CODEOWNERS auto-request for sensitive paths
- [x] GitHub Secrets configured for alerts and deployments
- [x] Environments set up for staging and production
- [x] Pre-commit hooks installed on all developer machines
- [x] First test PR succeeds through full pipeline

**Framework is now ACTIVE and ENFORCED.**

---

## Questions?

- **GitHub-specific:** GitHub Docs → https://docs.github.com/en/repositories/configuring-branches-and-merges
- **Framework questions:** FRAMEWORK-FAQ.md
- **Setup problems:** DEVELOPER-QUICKSTART.md
- **Escalation:** @kushin77 on Slack
