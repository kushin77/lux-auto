# [ISSUE-###] Title

## Summary

What problem does this PR solve? What is the business value?

(1-2 sentences, link related issues with #123)

---

## Architecture Impact

- [ ] Horizontal scaling considered (new service? connection pool? batch size?)
- [ ] Service dependencies documented (what does this call? what calls this?)
- [ ] Failure isolation defined (if this fails, what breaks?)
- [ ] ADR linked or created (if architectural change)
- [ ] Database schema changes backward-compatible (if applicable)

**Architecture Notes:**
(Describe any new services, API contracts, data flows, or deployment changes)

---

## Security Review

- [ ] No hardcoded secrets (all config from GSM or environment)
- [ ] No credential leaks in logs (secrets hashed, never logged raw)
- [ ] IAM reviewed (database user scope, service account permissions)
- [ ] Input validation present (Pydantic models, SQL injection tests)
- [ ] OAuth2 flow intact (if auth changes)
- [ ] Audit logging added (for state-changing operations)

**Threat Model (if new service or auth change):**
- Attack vectors considered?
- Trust boundaries explicit?
- Data protection strategy?

---

## Performance

- [ ] No blocking operations in hot paths (async/await correct?)
- [ ] No N+1 query patterns (database queries optimized?)
- [ ] Benchmarked or profiled (where's the latency data?)
- [ ] Resource limits defined (connection pools, timeouts, memory)

**Performance Impact:**
(Expected latency before/after? Throughput? Resource usage?)

**Proof:**
(Attach benchmark results, profiler output, or explain why not applicable)

---

## Observability

- [ ] Structured logging added (JSON format, no secrets)
- [ ] Log tags correct (`[AUDIT]` for state changes, `[SECURITY]` for auth)
- [ ] Metrics exported (Prometheus format, latency/error rates)
- [ ] Tracing enabled (correlation IDs across service boundaries)
- [ ] Health endpoints updated (if new service)
- [ ] Alert conditions defined (paging threshold, error budget impact)

**New Logs/Metrics:**
(List key events being logged and metrics being emitted)

**Alert Conditions:**
(What should operators page on? Error rate threshold? Latency p99?)

---

## Test Coverage

- [ ] Unit tests added/updated (new functions covered?)
- [ ] Integration tests added (if database/service changes)
- [ ] E2E tests added (if user-facing feature)
- [ ] Security tests added (injection, spoofing, auth edge cases)
- [ ] Coverage maintained at 90%+ (critical paths)

**Test Command:**
```bash
# Run tests locally
pytest tests/ --cov=backend --cov-fail-under=90
```

**Coverage Report:**
(Paste `pytest --cov` output if changed critical areas)

---

## CI/CD & Deployment

- [ ] All CI checks passing (lint, type check, SAST, dependency scan)
- [ ] Build reproducible (no timestamps, consistent artifacts)
- [ ] Docker image scanned (if image changes)
- [ ] Database migrations tested (if schema changes)
- [ ] Rollback strategy documented (how to revert safely?)

**Deployment Checklist:**
- [ ] Secrets pre-create in GSM (if new vars needed)
- [ ] Database migrations idempotent
- [ ] Feature flag needed? (if yes, linked here)
- [ ] Backward compatibility maintained

**Rollback Plan:**
(How do we revert this safely? Seconds required? Data consistency risk?)

---

## Risk Assessment

What breaks if this PR fails?

- Critical path impacted? (auth, data consistency, security)
- Data loss risk? (if yes, mitigation?)
- Cascading failures? (if this service fails, what else fails?)
- Compliance risk? (if yes, mitigation?)

---

## Documentation

- [ ] README updated (if user-facing or setup changes)
- [ ] Code comments added (for complex logic)
- [ ] API documentation updated (if endpoints change)
- [ ] ADR created (if architectural decision)
- [ ] Runbook updated (if operational impact)

---

## Checklist (Final)

- [ ] Code follows [CONTRIBUTING.md](../CONTRIBUTING.md)
- [ ] All mandatory review gates satisfied
- [ ] No conflicts with main branch
- [ ] Commit messages reference issue (#123)
- [ ] Ready for production (not WIP)

---

## Notes for Reviewers

(Optional: Anything reviewers should know? Areas to focus on? Known limitations?)
