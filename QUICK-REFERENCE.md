# Enterprise Standards Quick Reference Card

Print/Bookmark This | Slack #development  
**Last Updated:** April 12, 2026

---

## 🚀 First 5 Minutes

```bash
# Setup your environment (run once)
bash scripts/setup-framework.sh        # macOS/Linux
or
.\scripts\setup-framework.ps1          # Windows

# Verify it worked
pytest tests/ --cov=backend --cov-fail-under=90
```

---

## 📝 Before Every Commit

```bash
# 1. Write code
# 2. Pre-commit hooks run automatically

git commit -m "feat: description"
# ✓ Black format check
# ✓ Type hints validation
# ✓ SAST security scan
# ✓ Secret detection

# If hook fails → Fix error → Try again
```

---

## 🔄 Creating a PR

1. **Push your branch**
   ```bash
   git checkout -b feature/your-feature
   git push -u origin feature/your-feature
   ```

2. **Fill complete PR template** (8 sections required)
   - Summary: Problem you're solving
   - Architecture: How does it scale?
   - Security: Could leak secrets?
   - Performance: Benchmarked?
   - Observability: Metrics/logs/alerts?
   - CI/CD: Tests passing?
   - Risk: What breaks?
   - Rollback: How revert?

3. **CI/CD runs** (5-10 min)
   ```
   ✓ Lint (Black/Ruff)
   ✓ Type Check (MyPy)
   ✓ Tests (Pytest 90%+ coverage)
   ✓ SAST (Bandit)
   ✓ Dependency scan
   ✓ Secrets scan
   ✓ Integration tests
   ✓ Container build
   ✓ Container scan
   ```

4. **Get 2 approvals**
   - Team member code review
   - CODEOWNERS domain review

5. **Merge** (button on GitHub)
   - Auto-deploys to staging
   - Manual approval for production

---

## ✅ Coverage Requirements

**Before push, run locally:**

```bash
# Must be ≥90%
pytest --cov=backend --cov-fail-under=90 tests/

# If too low, add tests
# Coverage report shows uncovered lines
```

---

## 🔍 Common Issues & Fixes

| Problem | Fix | Command |
|---------|-----|---------|
| Type errors | Add type hints | `mypy backend/` |
| Format issues | Auto-fix | `black backend/` |
| Linting | Check rules | `ruff check backend/` |
| Security issue | Review Bandit output | Read PR comments |
| Slow tests | Check database mocks | Add pytest markers |

---

## 🆘 Getting Help

| Question | Answer |
|----------|--------|
| "How do I...?" | Read FRAMEWORK-FAQ.md (40+ Q&A) |
| "Why this standard?" | See CONTRIBUTING.md (explanation) |
| "How do I deploy?" | See docs/DEPLOYMENT.md |
| "What's broken?" | Check monitoring.slack.com or runbooks |
| "Need exception?" | Email @kushin77 with context |

---

## 📊 Monitoring Status

**When alerts Slack #alerts:**

| Alert | Check This | Action |
|-------|-----------|--------|
| HighErrorRate | Backend logs | Restart? Rollback? |
| HighLatency | Database connections | Connection leak? |
| HighDB Connections | Query logs | N+1 query? |
| OAuthFailure | Auth logs | Token validity? |

**Dashboard:** http://localhost:3000 (Grafana)

---

## 🚨 Production Issue? Follow This

1. **Detect:** Alert in Slack
2. **Run runbook:** docs/runbooks/[issue-type].md
3. **Assess:** Impact? Severity?
4. **Fix:** Code change or rollback
5. **Verify:** Monitoring returns normal
6. **Document:** Post-incident in Slack
7. **Postmortem:** Why did this happen?

---

## 📋 DO's ✅

- ✅ Write tests before code
- ✅ Add type hints to functions
- ✅ Log important business events
- ✅ Benchmark performance changes
- ✅ Document architectural decisions
- ✅ Review code like it'll fail in production
- ✅ Ask questions → ADR system for decisions
- ✅ Post postmortems (no blame, root cause)

---

## 📋 DON'Ts ❌

- ❌ Hardcode secrets (use env vars)
- ❌ Merge without passing CI
- ❌ `git commit --no-verify` (no bypass)
- ❌ Manual database edits (use migrations)
- ❌ Deploy outside CI/CD (use branch push)
- ❌ Silence alerts (fix problem instead)
- ❌ Skip tests even for small changes
- ❌ Leave TODO comments (create issue)

---

## 🆘 Emergency Hotfix

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-issue

# 2. Make minimal change (one focus)
# 3. Full PR (same review gate, no shortcuts)
# 4. Get 2 approvals
# 5. Deploy to prod via CI/CD
# 6. Schedule postmortem

# Why this process?
# → Same gate prevents new bugs
# → Postmortem prevents repeat
```

---

## 📞 Escalation Paths

**Slow CI:** @kushin77 (optimize pipeline)  
**Confusing standard:** #development Slack (discuss)  
**Need exception:** Email @kushin77 (with data)  
**Production down:** Follow runbook → Slack #incidents  
**Security issue:** Email @kushin77 (confidential)

---

## 🎯 Remember

> "If it would not survive principal-level review at Amazon, Google, or Meta, it does not merge."

Standards aren't obstacles. They're what keeps production reliable.

**Questions?** Check FRAMEWORK-FAQ.md or `@kushin77` on Slack

---

## 📚 Most Important Files

| File | When to Read |
|------|--------------|
| **00-START-HERE.md** | First time |
| **DEVELOPER-QUICKSTART.md** | Setting up |
| **CONTRIBUTING.md** | Before PR |
| **FRAMEWORK-FAQ.md** | Quick questions |
| **.github/pull_request_template.md** | Writing PR |
| **docs/DEPLOYMENT.md** | Release time |
| **docs/runbooks/** | Production issue |
| **docs/adr/** | Architectural decision |

---

**Bookmark this → Slack #development → Print/Share**

Framework v1.0 | Ready for Team Execution
