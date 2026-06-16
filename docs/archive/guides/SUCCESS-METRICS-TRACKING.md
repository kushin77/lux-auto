# Enterprise Standards Framework - Success Metrics & Tracking

**Use this document to measure framework adoption and impact**

**Start Date:** [INSERT DATE]  
**Review Frequency:** Weekly (first 2 months), then monthly

---

## 📊 Adoption Metrics (Did We Implement It?)

### Pre-Commit Hooks Adoption
| Metric | Target | Week 1 | Week 2 | Month 1 | Status |
|--------|--------|--------|--------|---------|--------|
| Developers with pre-commit installed | 100% | [ ]% | [ ]% | [ ]% | ⏳ |
| Hooks blocking invalid commits | 90%+ | [ ]% | [ ]% | [ ]% | ⏳ |
| False positive hook blocks (type misses) | <5% | [ ]% | [ ]% | [ ]% | ⏳ |

**How to Measure:**
- `ls -la .git/hooks/pre-commit` on each machine
- Review GitHub Actions logs for failed local checks
- Count "failed to commit" messages in team Slack

### CI/CD Pipeline Activation
| Metric | Target | Week 1 | Week 2 | Month 1 | Status |
|--------|--------|--------|--------|---------|--------|
| CI pipeline executing on all PRs | 100% | [ ]% | [ ]% | [ ]% | ⏳ |
| Average pipeline runtime | <15 min | [ ]min | [ ]min | [ ]min | ⏳ |
| Pipeline pass rate before code review | >80% | [ ]% | [ ]% | [ ]% | ⏳ |

**How to Measure:**
- Check GitHub Actions tab: all PRs should show 9 job runs
- GitHub Actions → Workflows → ci.yml → Total run time
- (# Passing CI) / (# Total PRs) = pass rate

### Code Review Gate Effectiveness
| Metric | Target | Week 1 | Week 2 | Month 1 | Status |
|--------|--------|--------|--------|---------|--------|
| PRs requiring 2 approvals | 100% | [ ]% | [ ]% | [ ]% | ⏳ |
| PRs blocked by CODEOWNERS rule | 50%+ | [ ]% | [ ]% | [ ]% | ⏳ |
| Average time to first review | <4 hours | [ ]h | [ ]h | [ ]h | ⏳ |
| Average time to 2nd approval | <24 hours | [ ]h | [ ]h | [ ]h | ⏳ |

**How to Measure:**
- GitHub PR history: Check "Reviewers" section
- GitHub Settings → Branches → Check "Require 2 reviews"
- GitHub PR list: Time from creation to first review comment

### Documentation Access
| Metric | Target | Week 1 | Week 2 | Month 1 | Status |
|--------|--------|--------|--------|---------|--------|
| Framework FAQ views (hits to GitHub) | >20 | [ ] | [ ] | [ ] | ⏳ |
| Slack #development questions answered | 100% | [ ]% | [ ]% | [ ]% | ⏳ |
| DEVELOPER-QUICKSTART passed to new hire | 100% | [ ]% | [ ]% | [ ]% | ⏳ |

**How to Measure:**
- GitHub repo traffic (Insights → Traffic)
- Count Slack answers in #development channel
- Onboarding checklist includes "read framework docs"

---

## 🎯 Code Quality Metrics (Does It Work?)

### Test Coverage
| Metric | Target | Baseline | Week 2 | Month 1 | Goal |
|--------|--------|----------|--------|---------|------|
| Overall test coverage | 90%+ | [ ]% | [ ]% | [ ]% | 92%+ |
| Coverage change per PR | >0% | [ ]% | [ ]% | [ ]% | 0% |
| Tests passing in CI | 100% | [ ]% | [ ]% | [ ]% | 100% |

**How to Measure:**
- Pytest coverage report: `pytest --cov=backend --cov-report=term-missing`
- GitHub Actions: Check "tests" job output
- GitHub PR: "Coverage change: +0.5%" in job summary

**Target Logic:**
- Coverage shouldn't drop (new code = new tests)
- If coverage drops, PR is marked with "Request Changes"

### Security Scans
| Metric | Target | Week 1 | Week 2 | Month 1 | Notes |
|--------|--------|--------|--------|---------|-------|
| SAST findings per PR (Bandit) | <2 | [ ] | [ ] | [ ] | Security issues caught |
| Hardcoded secrets found | 0 | [ ] | [ ] | [ ] | Detect-secrets blocking |
| Dependency vulnerabilities | <3 | [ ] | [ ] | [ ] | Critical: 0 |

**How to Measure:**
- GitHub Actions: Check "security" job output
- Bandit report in PR comments
- Detect-secrets: Any blocks in CI logs?

**Target Logic:**
- No secrets in code ever (immediate reject)
- Security issues trend downward (learning curve)
- Dependencies updated weekly (automation)

### Code Style Consistency
| Metric | Target | Week 1 | Week 2 | Month 1 | Notes |
|--------|--------|--------|--------|---------|-------|
| Black formatting violations | 0 | [ ] | [ ] | [ ] | Auto-fixed pre-commit |
| Type hint coverage | 90%+ | [ ]% | [ ]% | [ ]% | MyPy validation |
| Linting violations (Ruff) | <5 per PR | [ ] | [ ] | [ ] | Trend downward |

**How to Measure:**
- Pre-commit hooks: "No changes after black"
- MyPy errors: `mypy backend/ --ignore-missing-imports`
- Ruff output: `ruff check backend/`

---

## ⚡ Velocity Metrics (Speed Impact)

### Time to Merge
| Metric | Baseline | Target | Week 1 | Week 2 | Month 1 |
|--------|----------|--------|--------|--------|---------|
| Average time PR open | [ ] hours | 24 hours | [ ] | [ ] | [ ] |
| 95th percentile | [ ] hours | 48 hours | [ ] | [ ] | [ ] |
| Hotfix time (critical) | [ ] hours | 2 hours | [ ] | [ ] | [ ] |

**How to Measure:**
- GitHub PR list: Filter closed PRs, average `closed_at - created_at`
- Or: Script using GitHub API to calculate statistics
- Hotfixes: Measure from incident detection to merge

**Expected Behavior:**
- Week 1: Slower (learning curve, understanding requirements)
- Week 2-3: Normalize (framework becomes routine)
- Month 1+: Faster (no surprises, predictable review)

### Deployment Frequency
| Metric | Baseline | Target | Week 1 | Week 2 | Month 1 |
|--------|----------|--------|--------|--------|---------|
| PRs merged per week | [ ] | ≥baseline | [ ] | [ ] | [ ] |
| Deployments to staging | [ ] | ≥baseline | [ ] | [ ] | [ ] |
| Deployments to production | [ ] | ≥baseline | [ ] | [ ] | [ ] |

**How to Measure:**
- `git log --since="1 week ago" | grep "Merge pull request" | wc -l`
- GitHub Deployments tab
- Count from CI/CD logs

**Principle:** Standards should not slow down shipping. If slower, we fix the standard.

---

## 📈 Reliability Metrics (Does It Scale?)

### SLO Attainment
| SLO | Target | Baseline | Week 2 | Month 1 | Status |
|-----|--------|----------|--------|---------|--------|
| Availability | 99.5% | [ ]% | [ ]% | [ ]% | ⏳ |
| Error Rate | <0.1% | [ ]% | [ ]% | [ ]% | ⏳ |
| Latency (p95) | <200ms | [ ]ms | [ ]ms | [ ]ms | ⏳ |

**How to Measure:**
- Prometheus dashboard: "SLO Status"
- Grafana: Availability % over time window
- Errors: (error events) / (total events)

**Expected Impact:**
- Week 1-2: No change (catching baseline)
- Month 1: Upward trend (standards prevent errors)
- Month 3+: Stabilized at 99.5%+

### Incident Metrics
| Metric | Baseline | Target | Week 1 | Month 1 | Notes |
|--------|----------|--------|--------|---------|-------|
| Production incidents | [ ]/month | -50% | [ ] | [ ] | Fewer bugs |
| MTTR (mean time to resolve) | [ ] min | <30 min | [ ] | [ ] | Runbooks help |
| Postmortems completed | [ ]% | 100% | [ ]% | [ ]% | Learning from issues |

**How to Measure:**
- Slack #incidents channel: Count incident threads
- Time from detection to "resolved" status
- GitHub Issues: Tag "postmortem"

**Principle:** Every incident is learning opportunity. Postmortems prevent repeats.

---

## 👥 Team Satisfaction Metrics (Culture Impact)

### Developer Sentiment
| Question | Week 0 | Week 1 | Month 1 | Goal |
|----------|--------|--------|---------|------|
| Framework helps my work (1-5) | [ ] | [ ] | [ ] | 4+ |
| I understand the standards (1-5) | [ ] | [ ] | [ ] | 4+ |
| Standards prevent bugs (1-5) | [ ] | [ ] | [ ] | 4+ |
| I'd recommend this framework (Y/N) | [ ] | [ ] | [ ] | 100% |

**How to Measure:**
- Quick 2-minute survey: Google Form or Slack poll
- One-on-one check-ins with each developer
- Anonymous feedback channel

**Expected Evolution:**
- Week 0: Skepticism ("more rules?")
- Week 1-2: Frustration ("this is slow")
- Week 3-4: Recognition ("actually helping")
- Month 2+: Evangelism ("love this process")

### Support Load
| Metric | Week 1 | Week 2 | Month 1 | Target |
|--------|--------|--------|---------|--------|
| Support questions per day | [ ] | [ ] | [ ] | <2 |
| Average response time | [ ] hours | [ ] hours | [ ] | <4 hours |
| Unresolved issues | [ ] | [ ] | [ ] | 0 |

**How to Measure:**
- Count Slack messages tagged #framework-help
- Time from question to answer (timestamp)
- Open issues that need resolution

---

## 📋 Weekly Tracking Template

**Week of: ________**

### Adoption
- Pre-commit hooks active: ____ / 4 developers
- PRs written this week: ____ total
- PRs passed CI first time: ____ / ____ (____%)
- Exceptions requested: ____ (note reasons)

### Quality
- Test coverage: ____% (was: ____%)
- Security findings: ____ (was: ____)
- Performance regressions: ____ (was: ____)

### Speed
- Avg PR open time: ____ hours (was: ____)
- Avg review time: ____ hours (was: ____)
- Deployments: ____ (was: ____)

### Team Sentiment
- Questions answered: ____ / ____ (____%)
- Complaints noted: ________________
- Wins celebrated: ________________

### Notes & Action Items
```
[ ] Action item 1
[ ] Action item 2
[ ] Action item 3
```

---

## Monthly Retrospective Template

**For the team: What's working? What's broken? What needs to change?**

### Metrics Review
- Coverage trend: ↗️ / ↘️ / → (and delta)
- Incident trend: ↗️ / ↘️ / → (and delta)
- Velocity trend: ↗️ / ↘️ / → (and delta)
- Team satisfaction: ↗️ / ↘️ / → (and scores)

### What's Working
1. ________________ (celebrate)
2. ________________ (celebrate)
3. ________________ (celebrate)

### What's Painful
1. ________________ (fix or adjust)
2. ________________ (fix or adjust)
3. ________________ (fix or adjust)

### Changes for Next Month
1. Action: ________________ | Owner: ____ | Date: ____
2. Action: ________________ | Owner: ____ | Date: ____
3. Action: ________________ | Owner: ____ | Date: ____

### Framework Updates
- [ ] Update standard? Which: ________________
- [ ] New runbook needed? Topic: ________________
- [ ] Documentation unclear? Section: ________________

---

## Success Thresholds (Red / Yellow / Green)

### Red Flags (Stop & Fix)
- ⛔ Any secrets committed to repo
- ⛔ Production incident caused by code
- ⛔ >50% of PRs failing CI (process broken)
- ⛔ Team abandoning standards (culture issue)

**Action:** Immediate 1:1 with affected person + root cause analysis

### Yellow Flags (Monitor)
- 🟡 Coverage dropping >1% in a week trend
- 🟡 >3 security findings per PR
- 🟡 >25% SAST false positives (overwhelming)
- 🟡 Support backlog >5 unanswered questions

**Action:** Discuss in weekly standup, make adjustment plan

### Green Lights (Keep Going)
- 🟢 Coverage stable or improving
- 🟢 <1 security issue per PR
- 🟢 All questions answered <4 hours
- 🟢 Team sentiment 4/5 or higher

**Action:** Celebrate! Continue maintaining standard.

---

## Escalation: When Metrics Break

**If coverage drops suddenly:**
1. Review recent commits (what changed?)
2. Check if tests are being skipped
3. Verify pytest coverage is running
4. Discuss in team standup

**If incidents increase:**
1. Review incident postmortems
2. Add preventive checks to CI/CD
3. Enhance runbook for common issue
4. Consider SLO threshold adjustment

**If team satisfaction drops:**
1. Do 1:1 check-ins with each member
2. Understand specific pain points
3. Adjust standard if genuinely broken
4. Or clarify expectations if misunderstanding

**If PRs pile up before merge:**
1. Identify bottleneck (CI slow? Review slow?)
2. Add parallelization or optimize checks
3. Or add reviewer to speed up approvals
4. Track and report improvement

---

## Dashboard (Recommended Tools)

### For GitHub Metrics
- **GitHub Actions Logs** → Pipeline health
- **GitHub Insights** → Clone/traffic/network
- **GitHub Projects** → PR/issue tracking

### For Code Quality
- **Pytest coverage reports** → Coverage trends
- **SonarQube** (optional) → Code smell tracking
- **Snyk** (optional) → Dependency scanning

### For Team
- **Slack** → Pulse checks, sentiment
- **Google Forms** → Survey responses
- **GitHub Issues** → Support tickets

### For SLO Tracking
- **Prometheus** → Availability, latency
- **Grafana** → SLO dashboards
- **Sentry** (optional) → Error tracking

---

## Remember

✅ **Measure what matters:** Code quality, reliability, team satisfaction  
✅ **Review weekly:** Catch trends early  
✅ **Adjust quarterly:** Let data drive changes  
✅ **Celebrate wins:** Team engagement matters  
✅ **Be transparent:** Share metrics with everyone  

The goal isn't perfect metrics. It's continuous improvement.
