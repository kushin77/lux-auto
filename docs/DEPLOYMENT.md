# GitHub Workflow & Deployment Strategy

This document defines the Git workflow, code review process, and deployment pipeline for Lux-Auto.

## Git Workflow

### Branch Naming

```
Feature:        feature/{domain}/{title}   (e.g., feature/auth/oauth2-session-refresh)
Bugfix:         bugfix/{domain}/{title}   (e.g., bugfix/api/n-plus-one-query)
Hotfix:         hotfix/{issue}            (e.g., hotfix/401-invalid-token)
Documentation:  docs/{topic}              (e.g., docs/deployment-guide)
```

### Commit Message Format

```
[#{ISSUE}] Brief summary (50 chars max)

Longer explanation (if needed):
- What changed?
- Why?
- Impact?

Fixes #123
Relates to #456
```

### Example

```
[#42] Add OAuth2 session refresh endpoint

Implements refresh token flow for session extension
- New POST /auth/refresh endpoint
- Session TTL extended to 90 days
- Old tokens revoked on refresh

Fixes #42
```

## Code Review Process

### 1. Open Pull Request

**Checklist before opening:**
- [ ] Branched from latest `main`
- [ ] All tests passing locally
- [ ] No hardcoded secrets
- [ ] Linting/formatting passes
- [ ] PR template filled completely

### 2. Automated Checks

GitHub Actions runs (blocking):

1. ✅ Lint + Format check
2. ✅ Type checking
3. ✅ Unit tests (90%+ coverage)
4. ✅ SAST (Bandit)
5. ✅ Dependency scan
6. ✅ Secrets scan
7. ✅ Integration tests
8. ✅ Docker build
9. ✅ Container scan

**All must pass before review.**

### 3. Code Review

**Reviewers assigned via CODEOWNERS**

```
• Regular files → 1 approval
• Security-critical (/auth/) → 2 approvals (one must be @kushin77)
• Infrastructure (/terraform/) → 2 approvals
• Database schema → 1 approval + database specialist
```

**Reviewer responsibilities:**

- Check against CONTRIBUTING.md requirements (mandatory gates)
- Verify architecture impact (horizontal scaling, failure isolation)
- Validate security decisions (secrets, IAM, audit logging)
- Confirm performance implications (benchmarks, profiling)
- Ensure observability (logs, metrics, alerts)
- Test locally if uncertain

**Review comments:**

- **MUST FIX** → Blocking, must resolve before merge
- **SHOULD FIX** → Strongly suggest, but can merge with justification
- **NICE-TO-HAVE** → Suggestion, auto-dismiss stale

### 4. Approval

When approved:
- [ ] All automated checks passing
- [ ] Required reviewers approved
- [ ] All conversations resolved
- [ ] No pending changes requested

### 5. Merge Strategy

**Single-commit feature:**
```bash
Squash and merge
# Message: [#42] Brief title
```

**Multi-commit feature (keep history):**
```bash
Create a merge commit
# Message: Merge PR #42: Brief title
```

**Hotfixes (linear history):**
```bash
Rebase and merge
```

## Branch Protection Rules

Enable in GitHub Settings → Branches → `main`:

```
✅ Require a pull request before merging
   - Dismiss stale pull request approvals when new commits are pushed
   - Require code review from code owners (CODEOWNERS)
   - Require approval from 2 reviewers (if CODEOWNERS applicable)

✅ Require status checks to pass before merging
   - ✓ lint
   - ✓ type-check
   - ✓ test
   - ✓ sast
   - ✓ dependencies
   - ✓ secrets
   - ✓ integration
   - ✓ build
   - ✓ container-scan

✅ Require branches to be up to date before merging
   - Prevents merging against stale main

✅ Require conversation resolution before merging
   - Forces discussion of all review comments

✅ Restrict who can push to matching branches
   - Only @kushin77 can push directly to main (emergency hotfixes only)

✅ Require signed commits (optional, elite tier)
   - Cryptographic proof of authorship

✅ Require status checks from a required GitHub App
   - (If using Dependabot, SAST tools with GitHub integration)

❌ Require code review dismissal stale on push
❌ Allow auto-merge (manual merge enforces final review)
❌ Allow force pushes
```

## Deployment Pipeline

### Environments

```
┌─────────────────────────────────────────────────┐
│ Feature Branch (GitHub)                         │
│ ├─ Runs: CI/CD pipeline (all checks)            │
│ ├─ Artifact: Docker image (tagged with SHA)     │
│ └─ Deployment: None (PR testing only)           │
└─────────────────────────────────────────────────┘
                       ↓
            (After approval + merge)
                       ↓
┌─────────────────────────────────────────────────┐
│ Staging Environment (auto-deploy)               │
│ ├─ Trigger: Push to main                        │
│ ├─ Deploy: Latest image from CI                 │
│ ├─ URL: staging-api.lux.kushnir.cloud           │
│ ├─ Database: staging_prod (separate)            │
│ └─ Duration: 5-10 minutes                       │
└─────────────────────────────────────────────────┘
                       ↓
           (Smoke tests + manual validation)
                       ↓
┌─────────────────────────────────────────────────┐
│ Production Environment (manual release)         │
│ ├─ Trigger: Tag release (v1.2.3)                │
│ ├─ Deploy: Tagged image to prod                 │
│ ├─ URL: api.lux.kushnir.cloud                   │
│ ├─ Database: lux_prod (with backups)            │
│ ├─ Canary: 10% traffic (if load-balancer ready) │
│ └─ Rollback: 1-command revert (previous image)  │
└─────────────────────────────────────────────────┘
```

### Staging Deployment

Automatic on every main branch push:

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy Staging

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Fetch image from CI
        # Pull Docker image tagged with commit SHA
        
      - name: Deploy to staging
        run: |
          kubectl set image deployment/backend-staging \
            backend=ghcr.io/kushin77/lux-auto:${commit_sha} \
            --record
          kubectl rollout status deployment/backend-staging -w
          
      - name: Run smoke tests
        run: |
          pytest tests/smoke/ -v --tb=short
          # Check: health endpoints, OAuth flow, basic API calls
          
      - name: Slack notification
        if: failure()
        run: |
          # Alert on-call of staging deployment failure
```

### Production Release (Manual)

Every release requires human approval:

```bash
# 1. Create annotated tag with changelog
git tag -a v1.2.3 -m "Release v1.2.3

[CHANGELOG]
- Feature: OAuth2 session refresh (#42)
- Bugfix: N+1 query in user list (#41)
- Perf: 35% faster session validation

[BREAKING CHANGES]
None

[DEPLOYMENT NOTES]
- Requires database migration (run automatically)
- Secrets already in GSM
- Rollback: helm rollback lux-auto 1 (previous release)
"

# 2. Push tag
git push origin v1.2.3

# 3. GitHub Actions automatically:
#    - Creates release
#    - Builds + signs image
#    - Deploys to production (with Slack approval gate)
```

```yaml
# .github/workflows/deploy-production.yml
name: Deploy Production

on:
  push:
    tags:
      - 'v*'

jobs:
  approve:
    runs-on: ubuntu-latest
    environment:
      name: production
      required_reviewers: ['@kushin77']  # Requires manual approval
    steps:
      - name: Approval given
        run: echo "Production deployment approved"

  deploy:
    needs: approve
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3
        with:
          ref: ${{ github.ref }}
          
      - name: Build + Sign image
        run: |
          docker build -t ghcr.io/kushin77/lux-auto:${{ github.ref_name }} .
          docker sign ...  # Cosign
          docker push ...
          
      - name: Deploy to production
        run: |
          # Helm deploy with image tag from release
          helm upgrade lux-auto ./terraform/helm/lux-auto \
            --set image.tag=${{ github.ref_name }} \
            --record
            
      - name: Wait for rollout
        run: kubectl rollout status deployment/backend -w --timeout=5m
        
      - name: Run health checks
        run: |
          curl -f https://api.lux.kushnir.cloud/health
          curl -f https://api.lux.kushnir.cloud/ready
          
      - name: Smoke tests (production)
        run: pytest tests/smoke/ -v
        
      - name: Slack notification
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "✅ Production deployment ${{ job.status }}",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Release v${{ github.ref_name }}* deployed to production"
                  }
                },
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "Health: OK\nLatency p95: 156ms\nError rate: 0.02%"
                  }
                }
              ]
            }
```

### Rollback Procedure

**If production breaks immediately:**

```bash
# Option 1: Revert to previous release (seconds)
kubectl rollout undo deployment/backend

# Option 2: Deploy previous tag
git tag -l | tail -2  # Get previous version
git checkout v1.2.2
git push origin v1.2.2
# GitHub Actions auto-triggers deployment

# Check status
kubectl rollout status deployment/backend -w
curl https://api.lux.kushnir.cloud/health
```

**Postmortem checklist:**
- [ ] Incident duration tracked
- [ ] Root cause identified (check logs, metrics)
- [ ] Fix committed + tested
- [ ] Was CI/CD supposed to catch this? (add test)
- [ ] Update ADR or runbook
- [ ] Team notified

## Hotfix Process (Direct Push)

**ONLY for critical production down, with immediate review:**

```bash
# 1. Create hotfix branch from main
git checkout -b hotfix/critical-bug-401 origin/main

# 2. Fix + test
# ... make changes, test locally ...

# 3. Create PR (expedited review)
# Title: [HOTFIX] Brief description
# Description: Explain impact, why it couldn't wait

# 4. @kushin77 approves immediately
# 5. Merge directly to main

# 6. Automatic staging deployment
# 7. Tag release manually
# 8. Production auto-deploys

# 9. Postmortem (required)
```

## Metrics & Visibility

### Deployment Dashboard

Every merge to main generates a dashboard showing:

```
Last 10 Deployments
├─ v1.2.3 (2 hours ago)  ✅ Stable  P95: 156ms  Error: 0.02%
├─ v1.2.2 (1 day ago)    ✅ Stable  P95: 145ms  Error: 0.01%
├─ v1.2.1 (3 days ago)   ⚠️  Alert  P95: 645ms  Error: 1.2%  [Rollback]
└─ ...

Release Velocity
├─ Merges/week: 8
├─ Deployments/week: 4
├─ Lead time (commit→prod): 2 hours
├─ MTTR (mean time to recovery): 12 minutes
└─ Change failure rate: < 5%
```

### Team Notifications

Slack integration notifies:

```
#releases channel:
- New merge to main (commit message)
- Staging deployment status
- Production releases (tag + changelog)
- Failed CI/CD (with logs link)
- Rollbacks (reason + previous version)
```

## References

- GitHub Flow: github.com/scottchacon/github-flow
- Deployment flow inspiration: https://github.com/features/releases
- Kubernetes rollout: kubectl.io/docs/reference/generated/kubectl/kubectl-commands#rollout
