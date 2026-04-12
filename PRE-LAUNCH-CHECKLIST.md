# Enterprise Standards Framework - Pre-Launch Checklist

**Use this checklist 24 hours before team launch**

Date: ________  
Completed By: ________  
Reviewed By: ________

---

## ✅ Documentation (Review & Approval)

- [ ] **00-START-HERE.md** 
  - [ ] Entry point is clear and engaging
  - [ ] Links all work (test a few)
  - [ ] 5-minute read time estimate is accurate
  - Reviewer: _____ | Date: _____

- [ ] **CONTRIBUTING.md**
  - [ ] Engineering standards are clear
  - [ ] No contradictions with other docs
  - [ ] Tone matches Lux-Auto culture
  - Reviewer: _____ | Date: _____

- [ ] **DEVELOPER-QUICKSTART.md**
  - [ ] Setup instructions verified (run locally)
  - [ ] First PR walkthrough is accurate
  - [ ] Covers common scenarios well
  - Reviewer: _____ | Date: _____

- [ ] **FRAMEWORK-FAQ.md**
  - [ ] 40+ Q&A covers your team's likely questions
  - [ ] Answers are helpful and direct
  - [ ] Links to other docs work
  - Reviewer: _____ | Date: _____

- [ ] **QUICK-REFERENCE.md**
  - [ ] Fits on one printed page
  - [ ] Key commands are correct
  - [ ] Escalation paths are clear
  - Reviewer: _____ | Date: _____

---

## ✅ Infrastructure (Test All)

### Pre-Commit Configuration
- [ ] `.pre-commit-config.yaml` exists and is valid
- [ ] Deploy locally: `pre-commit install`
- [ ] Verify hooks are active: `ls -la .git/hooks/ | grep pre-commit`
- [ ] Test a commit with bad format
- [ ] Verify hook blocks commit and suggests fix
- Tested By: _____ | Date: _____

### CI/CD Pipeline
- [ ] `.github/workflows/ci.yml` exists
- [ ] All 9 stages defined (lint, type-check, tests, SAST, etc.)
- [ ] Test failure logic (trigger test fail, verify pipeline blocks)
- [ ] Coverage requirement is set to 90%
- [ ] Timeout values are reasonable (total <15 min)
- Tested By: _____ | Date: _____

### PR Template
- [ ] `.github/pull_request_template.md` exists
- [ ] 8 required sections are present
- [ ] Template appears when creating new PR (test in GitHub UI)
- [ ] Instructions are clear
- Tested By: _____ | Date: _____

### CODEOWNERS
- [ ] `.github/CODEOWNERS` exists
- [ ] All critical paths have assigned reviewers
- [ ] Path patterns are correct (test matching)
- [ ] Team members know they're assigned
- Tested By: _____ | Date: _____

### Code Deploy Structure
- [ ] `docs/adr/` directory exists with template
- [ ] `docs/runbooks/` directory exists with templates
- [ ] `conf test/` directory exists with policies
- [ ] `monitoring/` directory complete with all configs
- [ ] `scripts/setup-framework.sh` is executable
- [ ] `scripts/setup-framework.ps1` is executable
- Tested By: _____ | Date: _____

---

## ✅ Monitoring Stack (Deploy & Verify)

### Docker Compose Monitoring
- [ ] Navigate to `monitoring/` directory
- [ ] Create `.env.monitoring`:
  ```
  SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
  PAGERDUTY_SERVICE_KEY=your-service-key-here
  ```
- [ ] Deploy: `docker-compose -f docker-compose.monitoring.yml up -d`
- [ ] Wait 60 seconds for all services to start
- [ ] Verify all containers healthy: `docker-compose ps`
- [ ] All 7+ containers show "healthy" ✓

**Containers:**
- [ ] prometheus (http://localhost:9090)
- [ ] alertmanager (http://localhost:9093)
- [ ] grafana (http://localhost:3000)
- [ ] postgres-exporter
- [ ] redis-exporter
- [ ] node-exporter
- [ ] cadvisor

### Prometheus Verification
- [ ] Access http://localhost:9090
- [ ] Go to "Status → Targets"
- [ ] At least 5 targets show "UP"
- [ ] Refresh after 2 minutes, see data flowing
- Verified By: _____ | Date: _____

### AlertManager Verification
- [ ] Access http://localhost:9093
- [ ] Check "Silences" page loads
- [ ] Test alert: Post to http://localhost:9093/api/v1/alerts with test alert JSON
- [ ] Verify alert appears in UI
- Verified By: _____ | Date: _____

### Grafana Verification
- [ ] Access http://localhost:3000
- [ ] Login with admin/admin
- [ ] Change password: _____ (record securely)
- [ ] Verify Prometheus datasource is connected
- [ ] Check at least one pre-built dashboard loads data
- Verified By: _____ | Date: _____

---

## ✅ GitHub Configuration

### Branch Protection (main)
- [ ] Go to Settings → Branches → Edit main branch rules
- [ ] ✅ Require pull request reviews before merging
  - [ ] Set to 2 approvals
  - [ ] Enable "Require review from code owners"
  - [ ] Enable "Dismiss stale pull request approvals when new commits are pushed"
- [ ] ✅ Require status checks to pass
  - [ ] Enable "Require branches to be up to date before merging"
  - [ ] Select all 9 CI status checks
- [ ] ✅ Require conversation resolution
- [ ] ✅ Enable auto-delete of head branches
- [ ] ✅ Restrict who can push to matching branches (main)
  - [ ] Only @kushin77 (principal engineer)
- [ ] Test: Attempt to merge PR without 2 reviews → Should be blocked
- Configured By: _____ | Date: _____

### GitHub Secrets
- [ ] Go to Settings → Secrets and variables → Actions
- [ ] Create `SLACK_WEBHOOK_URL` (Slack integration)
- [ ] Create `PAGERDUTY_SERVICE_KEY` (on-call alerts)
- [ ] Create `DOCKER_REGISTRY_TOKEN` (CI/CD deployments)
- [ ] Create `SENTRY_DSN` (error tracking, if used)
- [ ] Test: Reference in workflow, verify secret substitution works
- [ ] Verify secrets don't appear in logs
- Configured By: _____ | Date: _____

### GitHub Environments
- [ ] Create Environment "staging"
  - [ ] Auto-deploy on PR merge to dev
  - [ ] No approval required
- [ ] Create Environment "production"
  - [ ] Manual deployment only
  - [ ] Requires 1 approval
  - [ ] Restrict to @kushin77 only
- [ ] Test: Attempt to deploy without approval → Should be blocked
- Configured By: _____ | Date: _____

---

## ✅ Team Readiness (Human Factors)

### Communications Sent
- [ ] Announcement email sent to team (see template below)
- [ ] #development Slack pinned with framework summary
- [ ] Training scheduled (30 min, use TEAM-TRAINING.md)
- [ ] Q&A office hours scheduled (first 2 weeks)
- [ ] FAQ link shared in onboarding channels
- Sent By: _____ | Date: _____

### Team Member Readiness
- [ ] All 4 developers have GitHub accounts linked
- [ ] All developers added to team @lux-auto
- [ ] New hire onboarding template updated to include framework
- [ ] Manager briefed on standards and rollout (1:1 scheduled)
- Verified By: _____ | Date: _____

### Training Materials Ready
- [ ] TEAM-TRAINING.md has been reviewed
- [ ] Trainer (@kushin77) is prepared
- [ ] Backup trainer identified (in case of absence)
- [ ] Q&A template prepared
- [ ] Recording is set up (Slack recording or Zoom)
- Prepared By: _____ | Date: _____

---

## ✅ Rollback Plan (If Needed)

### Quick Disable (Less than 5 minutes)
- [ ] Know how to disable branch protection
  - [ ] Go to Settings → Branches → main
  - [ ] Uncheck "Require pull request reviews"
  - [ ] Save changes
- [ ] Know how to pause CI checks
  - [ ] Rename `.github/workflows/ci.yml` to `.github/workflows/ci.yml.disabled`
  - [ ] Commit and push
- [ ] Tested: [ ] Yes / [ ] No
- Tested By: _____ | Date: _____

### Communication Fallback
- [ ] Have template ready to announce framework pause (if major issues arise)
- [ ] Know escalation path (who to notify first)
- [ ] Have incident response runbook updated
- Prepared By: _____ | Date: _____

---

## ✅ Success Metrics Baseline

### Before Launch (Establish Baselines)
- [ ] Current test coverage: ______%
- [ ] Current lines of code: ______
- [ ] Current deployment frequency: ____x per week
- [ ] Current time-to-merge: ______ hours average
- [ ] Team happiness survey score: ______/10

### 30-Day Targets (Post-Launch)
- [ ] Test coverage: 90%+
- [ ] Deployment frequency: ____x per week (same or higher)
- [ ] Time-to-merge: 24 hours or less
- [ ] SLO attainment: 99.5%+
- [ ] Team happiness: 7/10 or higher

**Baseline Established By:** _____ **Date:** _____

---

## ✅ Support Infrastructure

### Help Desk Setup
- [ ] Designated Slack channel #framework-support (or append to #development)
- [ ] Response time SLA: < 4 hours for questions
- [ ] Escalation path documented in QUICK-REFERENCE.md
- [ ] Support person assigned (rotate weekly): _____
- [ ] FAQ pinned in Slack with "Last Updated" date
- Setup By: _____ | Date: _____

### Office Hours Scheduled
- [ ] First week: Daily 30-min call (3pm, @kushin77)
- [ ] Second week: MWF 30-min calls
- [ ] Third week+: Async (Slack, resolved in <4 hours)
- [ ] Calendar invites sent
- [ ] Zoom link prepared
- Scheduled By: _____ | Date: _____

---

## ✅ Final Verification (24 Hours Before Launch)

### Day-Before Sanity Check
- [ ] Perform dry-run: Create test feature branch
- [ ] Write simple test code
- [ ] Commit and verify pre-commit hooks work
- [ ] Push and create PR
- [ ] Verify template appears
- [ ] Verify CI starts (even if not running to completion)
- [ ] Verify CODEOWNERS auto-request appears
- [ ] Test adding yourself as reviewer, see if blocks merging with 1 approval
- Dry-Run By: _____ | Date: _____

### Monitoring Sanity
- [ ] Prometheus showing metrics (check dashboard)
- [ ] No obvious errors in alertmanager logs
- [ ] All exporters connected (postgres, redis, node, cadvisor)
- [ ] Grafana dashboards load without "no data" errors
- Verified By: _____ | Date: _____

### Documentation Freshness
- [ ] All links in main docs are working
- [ ] `.github/` files are committed to dev branch
- [ ] All 30+ framework files are visible in repo
- [ ] README updated with framework reference
- Verified By: _____ | Date: _____

---

## ✅ Go/No-Go Decision

### Checklist Completion
- **Total Items:** 100+
- **Items Completed:** _____
- **Percentage:** _____%
- **Minimum to proceed:** 95%

### Go/No-Go

**Status:** 
- [ ] **GO** — Proceed with team launch
- [ ] **NO-GO** — Address open items before launch
- [ ] **GO with Mitigations** — Proceed but with specific caveats:
  ```
  Caveats:
  1. ___________________________
  2. ___________________________
  3. ___________________________
  ```

**Decision Authority:** @kushin77  
**Decision Date/Time:** _____  
**Communicated To:** _____  
**Communication Method:** (Email/Slack/Meeting) _____

---

## 📋 Sign-Off

**Pre-Launch Checklist Owner:**  
Name: ___________________  
Signature: ___________________  
Date: ___________________

**Framework Lead Approval:**  
Name: @kushin77  
Signature: ___________________  
Date: ___________________

---

## Next Steps (After Approval)

1. ✅ Send team announcement (Day 0)
2. ✅ Conduct team training (Day 1-2)
3. ✅ All developers run setup script (Day 2-3)
4. ✅ First feature branch (Day 4-5)
5. ✅ First PR through full pipeline (Day 5-10)
6. ✅ Monitor metrics (ongoing)

**Questions?** Refer to FRAMEWORK-FAQ.md or @kushin77 on Slack
