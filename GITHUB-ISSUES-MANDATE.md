# Lux-Auto GitHub Issues Mandate

**Version:** 1.0  
**Owner:** @kushin77

---

## 🎯 Core Principle

**Every piece of work—past, present, and future—must be trackable via GitHub issues.**

This mandate ensures:
- ✅ Clear work visibility
- ✅ Accountability for deliverables
- ✅ Historical context for decisions
- ✅ Structured handoff for new team members
- ✅ Scalability as team grows

---

## 📋 Mandate Requirements

### 1. All Work Must Have an Issue

**Rule:** No work starts without a GitHub issue (except critical incidents)

**Applies to:**
- ✅ Features (new functionality)
- ✅ Bugs (defects that affect users)
- ✅ Documentation (guides, tutorials, FAQs)
- ✅ Testing (test suite additions, coverage improvements)
- ✅ Infrastructure (setup, monitoring, deployment)
- ✅ Framework improvements (standards, processes)
- ✅ Refactoring (code quality, performance)
- ✅ Security (vulnerabilities, hardening)
- ✅ Operational tasks (maintenance, cleanup)

**Does NOT apply to:**
- ❌ Production emergency patches (create issue after resolution)
- ❌ Typo fixes in documentation (can batch in single issue)
- ❌ Comment-only changes

### 2. Issue Structure Requirements

**Every issue must include:**

```yaml
Title:
  Format: "[TYPE] Brief description (max 60 chars)"
  Example: "[Feature] Add real-time deal notifications"

Labels:
  - Type: feature, bug, docs, test, refactor, ops, infra
  - Category: framework, backend, frontend, devops
  - Priority: p0-critical, p1-high, p2-medium, p3-low
  - Phase: phase-1, phase-2, phase-3, phase-4, phase-5, phase-6
  - Status: ready, in-progress, blocked, review, done

Assignments:
  - Owner: (primary responsible person)
  - Reviewer: (code/design review person)
  - Optional: Secondary owner

Milestone:
  - Phase (e.g., "Phase 3: Developer Onboarding")
  - OR specific release (e.g., "v1.0-Beta")

Description (from template):
  - User Story (if applicable)
  - Acceptance Criteria (3-5 specific checks)
  - Technical Details (approach, design notes)
  - Dependencies (what must be done first)
  - Resources (links to relevant docs)

Estimate:
  - Story points (XS, S, M, L, XL)
  - Time estimate in hours

Links:
  - Related issues (references)
  - Documentation references
  - Test file references
  - Design doc links
```

### 3. Issue Templates (Mandatory)

All issues must use appropriate templates from `.github/issue_templates/`:

- **feature.md** - New functionality
- **bug.md** - Defect reports
- **docs.md** - Documentation work
- **test.md** - Testing work
- **refactor.md** - Code improvements
- **framework.md** - Framework updates
- **infrastructure.md** - Ops/infra work

**Template checklist:**
- ✅ Fills out all required sections
- ✅ Uses consistent formatting
- ✅ Links to relevant resources
- ✅ Clear acceptance criteria

### 4. Issue Lifecycle

**Issue statuses (via labels):**

```
ready → in-progress → review → testing → done

ready:       Issue is clearly defined, ready to start
in-progress: Someone is actively working on it
review:      Ready for code/design review
testing:     In QA or manual testing phase
done:        Merged/deployed and verified

blocked:     Cannot proceed (reason in comment)
wontfix:     Intentionally not addressing
duplicate:   Links to issue it duplicates
```

**Automatic transitions:**
- PR created → Add `review` label
- PR approved → Add `testing` label
- PR merged → Keep `testing`, schedule `done`
- Not progressing 5+ days → Add comment asking for status

### 5. Issue Linking Requirements

**Cross-reference your issues:**

```markdown
# In issue body:
Depends on: #123 #124
Blocks: #125
Related: #126 #127

# In commit messages:
Fixes #123
Relates to #456

# In pull requests:
Closes #789
Related to #101, #102
```

**Why:** Provides traceability and helps predict cascading impacts

### 6. Epic Structure (Phase-Level Tracking)

**Each phase is an Epic with sub-issues:**

```
Epic: Phase 3 - Developer Onboarding & GitHub Enablement
├─ Issue: Pre-commit hook configuration
├─ Issue: GitHub branch protection setup
├─ Issue: GitHub Actions pipeline validation
├─ Issue: Team training session
├─ Issue: Developer success validation
└─ Closing issue: Phase 3 Complete ✅
```

**Epic requirements:**
- Title: `[EPIC] Phase X - [Name]`
- Use GitHub Projects board to track
- Weekly status updates in comments
- Rollup metrics (issues closed vs. total)

### 7. Acceptance Criteria Standard

**Every issue must have 3-5 acceptance criteria:**

```markdown
## Acceptance Criteria
- [ ] Specific, testable outcome 1
- [ ] Specific, testable outcome 2
- [ ] Specific, testable outcome 3
- [ ] Documentation/comments updated
- [ ] Tests pass locally and in CI/CD

## How to Verify (for reviewer)
1. Step 1
2. Step 2
3. Step 3
```

**Bad criteria:** "Add feature" ❌  
**Good criteria:** "User can search deals by buyer name with partial match in <500ms" ✅

### 8. Estimation Requirements

**All issues must be estimated:**

```yaml
Story Points (Fibonacci scale):
  XS: 1 point   (< 2 hours, trivial)
  S:  2-3 points (2-4 hours)
  M:  5 points  (5-8 hours, typical)
  L:  8 points  (8-16 hours)
  XL: 13+ points (>16 hours, break into smaller issues)

Rule: Any issue > 8 points should be split
```

**Why:** 
- Prevents scope creep
- Enables better planning
- Catches missing subtasks

### 9. Comment Protocol

**When commenting on issues:**

```markdown
# Status update (for assignee)
✅ Completed section 1
⏳ Working on section 2 (ETA Friday)
⚠️ Blocked on #456

# Technical discussion
> Question about approach
My suggestion: [details]
Reference: [docs/link]

# Review comment (for reviewers)
🎯 Suggestion: [specific change]
Reason: [why this matters]
Alternative: [if applicable]

# Closing issue
✅ Merged in PR #789
📝 Documentation updated: [link]
🧪 Tests: 10 new tests added
🚀 Deployed to staging [date]
⚡ Ready for production [when]
```

### 10. Automation Rules (Bots/Workflows)

**Automated actions:**

```yaml
When: Issue has no estimate
Action: Bot comments → "Please estimate with story points"
Expectation: Team member adds estimate within 24h

When: Issue > 8 points
Action: Bot comments → "Consider breaking into smaller issues"
Response: Owner either estimates correctly or creates sub-issues

When: Issue in-progress > 5 days, no activity
Action: Bot comments → "Status update requested"
Owner: Reply within 24h or reassign

When: PR merged
Action: Automatically add testing label to linked issue
Owner: Move to done when fully verified

When: Issue created without template
Action: Bot comments → "Please use appropriate template"
Help: Links to templates directory
```

### 11. Automated PR → Issue Closing Workflow ✅

**This is how issues actually get CLOSED when work is done:**

#### Step 1: Create PR with Issue Link (Developer)

```markdown
## PR Title
[Feature/Bug/Docs] What you did

## Description
Fixing [issue description]

Fixes #123
Related to #456

## Checklist
- [x] Tests pass
- [x] Documentation updated
- [x] Issue acceptance criteria met
```

**Valid link patterns:**
- `Fixes #123` → Issue closes when PR merges ✅
- `Closes #456` → Issue closes when PR merges ✅
- `Resolves #789` → Issue closes when PR merges ✅
- `Related to #101` → Links issue, does NOT auto-close

#### Step 2: Automated Status Update (GitHub Actions)

**When PR is opened/reviewed:**
1. Bot finds issue reference: `Fixes #123`
2. Checks PR status (draft, open, ready for review)
3. Updates issue labels automatically:
   - Draft PR → Label: `in-progress`
   - Open PR awaiting review → Label: `in-progress`
   - PR in review → Label: `review`
   - Reviews completed → Ready to merge

**Issue comment from bot:**
```
⏳ PR #456 **in-progress** - Awaiting review (2 reviewers requested)

Status Update: <timestamp>
```

#### Step 3: PR Merge & Auto-Close (GitHub Actions)

**When PR is merged:**
1. Bot detects merge (PR closed with merged flag)
2. Finds all "Fixes/Closes/Resolves" references
3. **Automatically closes those issues** with state: `completed`
4. Adds comment to each closed issue:

```
✅ Closed by merged PR #456

**Commit:** abc1234
**Merged at:** <timestamp>
```

5. Removes old status labels (ready, in-progress, review)
6. Adds final labels: `done`, `merged`

#### Result: Issue is CLOSED ✅

**The complete flow:**
```
Issue created (#123)
    ↓
Status: ready (with estimate)
    ↓
Developer: git checkout -b feature/123-name
    ↓
Developer: Make commits, push, create PR
PR description: "Fixes #123"
    ↓
GitHub Actions: Update issue #123 → Label: in-progress
    ↓
Developer/Reviewer: Add review comments
    ↓
GitHub Actions: Update issue #123 → Label: review
    ↓
Reviewer: Approve PR
    ↓
Developer: Merge PR
    ↓
GitHub Actions: **CLOSES ISSUE #123**
    ↓
Issue Status: CLOSED ✅ (completed)
Final Comment: "✅ Closed by merged PR #456"
```

#### Important: Issue WON'T Close If:

❌ PR description has `Related to #123` only (missing "Fixes/Closes/Resolves")
❌ PR is closed without merging
❌ Issue number is misspelled or wrong
❌ PR is to wrong branch

**Always use:** `Fixes #123` (not "Related to" or "Ref")

---

## 📊 Phase-Specific Requirements

### Phase 1 & 2 (Completed) - Retroactive Issues

**Action:** Create issues for all deliverables (for historical record)

**Example issues to create:**
- ✅ `[EPIC] Phase 1 - Documentation Framework`
  - ✅ `[Docs] Create 00-START-HERE.md`
  - ✅ `[Docs] Create CONTRIBUTING.md`
  - ✅ `[Docs] Create DEVELOPER-QUICKSTART.md`
  - etc.

### Phase 3 (Developer Onboarding)

**Issues to create (ready for execution):**
```
[EPIC] Phase 3 - Developer Onboarding & GitHub Enablement

├─ [Infrastructure] Install and configure pre-commit hooks
├─ [Infrastructure] Setup GitHub branch protection rules
├─ [Infrastructure] Enable GitHub status checks
├─ [Docs] Create pre-commit hook runbook
├─ [Ops] Execute developer setup across team
├─ [Framework] Team training session
└─ [Framework] Validate Phase 3 completion
```

### Phase 4 (First Feature)

**Issues to create when feature selected:**
```
[EPIC] Phase 4 - First Feature Through Pipeline

├─ [Feature] [Actual Feature Name]
│  ├─ [Test] Write tests for [feature]
│  ├─ [Docs] Document [feature] usage
│  └─ [Feature] Code review & merge
├─ [Ops] Validate staging deployment
└─ [Framework] Team feedback on process
```

### Phase 5 (Production Deployment)

**Issues to create:**
```
[EPIC] Phase 5 - Production Deployment

├─ [Infrastructure] Prepare production checklist
├─ [Ops] Execute rolling deployment
├─ [Framework] Post-deployment validation
├─ [Monitoring] Verify monitoring alerts
└─ [Framework] Deployment retrospective
```

### Phase 6 (Continuous Excellence)

**Recurring issues:**
```
[EPIC] Phase 6 - Continuous Excellence

├─ [Weekly] Planning & Backlog Refinement
├─ [Weekly] Midpoint Status Check
├─ [Weekly] Demo & Retrospective
├─ [Monthly] SLO Review
├─ [Monthly] Incident Postmortem (as needed)
└─ [Quarterly] Framework Evolution Review
```

---

## 🔐 Enforcement

### Who Enforces?
- **Code Owners:** Require issues linked in PRs
- **CI/CD:** Validate conventional commits reference issues
- **Scrum Master:** Weekly audit of issue status

### Consequences of Non-Compliance

| Violation | Action |
|-----------|--------|
| PR merged without linked issue | Author: Create retroactive issue + label commit |
| Issue created without template | Bot: Auto-comment, owner fix within 24h |
| Issue not estimated | Bot: Auto-comment, owner estimate within 24h |
| Acceptance criteria too vague | Reviewer: Request clarification before approval |
| 5+ days no activity on assigned issue | Scrum: Weekly check-in, reassign if needed |

---

## 📈 Metrics & Reporting

**Track these metrics (monthly):**

```yaml
Issue Health:
  - % of issues with estimates: target 100%
  - % of issues with acceptance criteria: target 100%
  - Average time issue → completed: target 5 days
  - Estimate accuracy: target 80%+ actual vs planned

Team Engagement:
  - Issues created per developer: target 3-5/month
  - Comments per issue: target 3+ (shows discussion)
  - Stalled issues (no activity 5+ days): target 0%

Delivery:
  - Issues completed per sprint: track trend
  - Story points completed: compare to estimate
  - Phase completion: track against roadmap
```

**Where reported:** Monthly in `PHASES-3-6-TRACKER.md`

---

## 🚀 Future-Proofing: Extensibility

### New Phase or Workstream?

**Template to follow:**

```markdown
# [EPIC] [New Phase/Workstream Name]

**Owner:** @[person]
**Duration:** [timeframe]
**Budget (points):** [total estimated effort]

**Objective:** [What are we trying to achieve?]

**Key Milestones:**
- [ ] Milestone 1 (due date)
- [ ] Milestone 2 (due date)
- [ ] Milestone 3 (due date)

**Success Criteria:**
- [ ] Specific metric 1
- [ ] Specific metric 2
- [ ] Specific metric 3

**Sub-issues:** [Link to all sub-issues]

**Blockers:** [Any dependencies]
```

### Adding New Issue Type?

**Create template in `.github/issue_templates/[new-type].md`:**

```markdown
---
name: [New Type Name]
about: [Description]
title: "[TYPE] "
labels: [appropriate-labels]
---

## [Section 1]
[Description]

## [Section 2]
[Description]

...
```

Then update this mandate.

---

## ✅ Implementation Checklist

**To adopt this mandate:**

- [ ] Read and accept this document
- [ ] Create `.github/issue_templates/` (if not exists) with all templates
- [ ] Create Phase 1 & 2 retroactive epic issues
- [ ] Set up automation (bot rules)
- [ ] Announce to team (use TEAM-ANNOUNCEMENT-EMAIL.md as base)
- [ ] First week: All new issues follow mandate
- [ ] Sprint 1: Retroactive issues for old work ~50% complete
- [ ] Sprint 2: Retroactive issues complete

---

## 📞 Questions?

| Question | Answer |
|----------|--------|
| What if I just want to chat about an idea? | Use Slack #development, create issue only if decided to pursue |
| Can I combine 5 small tasks in one issue? | Only if closely related and same epic; prefer separate issues |
| What if requirements change mid-issue? | Update issue description, add comment explaining change |
| How do I ask for help on an issue? | Comment "Help needed: [specific question]" and @mention person |
| Can I be assigned to 5 issues at once? | No; recommend max 2 active at once; discuss overload with lead |

---

## 🎯 Bottom Line

**Every piece of work is trackable.**  
**Every issue has clear requirements.**  
**Every team member knows status at a glance.**  
**Every decision is documented.**  

This is how we scale from 5 people to 50 people without chaos.

---

**Enforced Starting:** immediately  
**Questions:** Email @kushin77  
**Feedback:** Discussion in #development channel

