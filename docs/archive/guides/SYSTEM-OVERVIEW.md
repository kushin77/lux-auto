# SYSTEM OVERVIEW - LUX-AUTO FRAMEWORK

**Purpose:** Quick reference for what this system does and how to operate it

---

## WHAT IS LUX-AUTO?

A production-grade Python/FastAPI backend with:
- ✅ OAuth2 authentication (JWT + sessions)
- ✅ Database persistence (PostgreSQL + SQLAlchemy)
- ✅ Caching layer (Redis)
- ✅ Structured logging + monitoring (Prometheus)
- ✅ 9-stage CI/CD automation (GitHub Actions)
- ✅ Security hardening (SAST, secrets, dependency scanning)
- ✅ Observability (metrics, logging, alerts)

---

## KEY SYSTEMS

### Backend API
- FastAPI application (backend/main.py)
- Routes: api/auth, api/deals, api/buyers, api/analytics
- Database models in backend/database/models.py
- OAuth2 implementation: backend/auth/

### Infrastructure
- PostgreSQL database (connection via SQLAlchemy)
- Redis cache (hiredis optimized)
- Google Cloud Secret Manager (for secrets)
- Prometheus metrics endpoint (/metrics)
- Grafana dashboards (monitoring)

### CI/CD Automation
- GitHub Actions (9-stage pipeline)
- Lint → Type Check → Tests → Security → Build → Deploy
- Auto-deploys on PR merge to staging
- Manual approval for production

### Security
- No hardcoded secrets (truffleHog scanning)
- No vulnerable dependencies (Safety/pip-audit)
- SAST scanning (Bandit for code injection)
- Container scanning (Trivy)
- Branch protection: 2 approvals required

---

## DEVELOPMENT FLOW

```
1. Code locally
2. Push to feature branch
3. GitHub Actions runs 9 stages (automatic)
4. Code review: 2 approvals required
5. Merge to main
6. Auto-deploy to staging
7. Smoke tests verify staging
8. Manual approval for production
9. Rolling deployment: 25% → 50% → 75% → 100%
10. Monitor metrics for issues
```

---

## OPERATING THIS SYSTEM

### Check System Health
```bash
# API up?
curl https://lux.kushnir.cloud/health

# Database connected?
curl https://lux.kushnir.cloud/api/v1/health/db

# Redis working?
redis-cli ping

# Metrics available?
curl https://lux.kushnir.cloud/metrics
```

### Deploy a Change
```bash
# 1. Make code change
# 2. Push to branch
git push origin feature/my-feature

# 3. Create PR (automatic checks run)
# 4. Get 2 approvals
# 5. Merge to main
# 6. Auto-deploys to staging
# 7. Verify staging (run smoke tests)
# 8. Deploy to production (rolling 4 stages)
```

### Debug Issues
- Check logs: `docker logs lux-auto`
- Check metrics: Grafana dashboard
- Check alerts: Slack #incidents
- Runbooks: docs/runbooks/

### Rollback if Needed
```bash
# Health checks auto-detect failure
# Automatic rollback <1 min
# Manual rollback:
git revert <commit>
Deploy previous version
```

---

## MONITORING & ALERTS

### Key Metrics
- **Latency:** p50, p95, p99 response times
- **Errors:** Error rate (% of requests)
- **Throughput:** Requests per second
- **Database:** Connection pool usage, query time
- **Cache:** Hit rate, memory usage

### Alert Triggers
- Error rate > 1% → Slack alert (high)
- Latency p99 > 2s → Slack alert (high)
- Service down → PagerDuty + Slack
- Database connection pool exhausted → Alert
- Cache memory > 80% → Alert

### Response Times
- On-call gets alert immediately
- Response time target: <5 min
- Resolution time target: <15 min

---

## FAILURE SCENARIOS & FIXES

### Database Down
- **Detection:** Connection refused
- **Impact:** All APIs fail
- **Fix:** Check Runbook: docs/runbooks/database-down.md
- **Rollback:** Already working (API returns error)

### Cache Failure
- **Detection:** Redis connection refused
- **Impact:** Performance degradation (no caching)
- **Fix:** Restart Redis | Check Runbook
- **Rollback:** Automatic (app continues without cache)

### High Error Rate
- **Detection:** >1% errors for 2 min
- **Impact:** User-facing errors
- **Fix:** Check logs + rollback if recent deploy
- **Runbook:** docs/runbooks/high-error-rate.md

### Deployment Failure
- **Detection:** Health check fails
- **Impact:** Staging/prod not updated
- **Fix:** Rollback to previous version (<1 min)
- **Process:** Automatic for prod, manual for staging

---

## PERFORMANCE TARGETS

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Latency (p99) | <500ms | >2s sustained |
| Error Rate | <0.1% | >1% sustained |
| Availability | >99.9% | <99% over hour |
| Cache Hit Rate | >80% | <60% sustained |
| DB Connection Pool | <80% used | >90% used |

---

## WHAT'S READY TO SHIP

✅ Code standards enforced (CONTRIBUTING.md)  
✅ All tests documented (tests/ directory)  
✅ Security scans automated (9-stage pipeline)  
✅ Monitoring configured (Prometheus + Grafana)  
✅ Alerts setup (Slack integration)  
✅ Deployment process tested (rolling 4-stage)  
✅ Rollback <1 min (health checks)  
✅ Documentation complete (119 files)  
✅ Runbooks for incidents (docs/runbooks/)  

---

## NEXT STEPS

1. **Verify Locally** → Run PRE-DEPLOYMENT-CHECKLIST.md
2. **Deploy Staging** → Test in staging environment
3. **Deploy Production** → Rolling deployment to users
4. **Monitor** → Watch metrics for 24 hours
5. **Iterate** → Add features with same process

---

**System ready. Execute when needed.**
