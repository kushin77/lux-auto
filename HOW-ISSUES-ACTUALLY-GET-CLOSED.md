# How Issues Actually Get Closed - Complete Workflow

**Date:** April 12, 2026  
**Status:** ✅ Automation now active  
**Audience:** All developers

---

## THE PROBLEM YOU IDENTIFIED ✅

"Issues are sitting open but not getting updated/closed when tasks are satisfied"

**Root cause:** No automation connecting PR completion to issue closure.

**SOLUTION:** GitHub Actions workflows now automatically:
1. **Track PR progress** (draft → review → ready to merge)
2. **Update issue status** (labels, comments)
3. **Close issues** when PR merges (if properly linked)

---

## THE COMPLETE WORKFLOW (What Happens Now)

```
┌────────────────────────────────────────────────────────┐
│ 1. ISSUE CREATED (by @kushin77 or team)                │
│    Status: "ready" label, XS/S/M estimate              │
│    Example: Issue #2 "Install pre-commit hooks"        │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│ 2. DEVELOPER TAKES ISSUE                               │
│    Action: Assign to self                              │
│    Action: Create branch: git checkout -b feature/2    │
│    Status: No automatic change yet                      │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│ 3. DEVELOPER MAKES COMMITS                             │
│    Action: Make code changes                           │
│    Action: Commit: git commit -m "message"             │
│    Action: Push: git push origin feature/2             │
│    Status: Still showing as "ready" on GitHub          │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│ 4. DEVELOPER CREATES PR (CRITICAL STEP!)               │
│    Action: Go to GitHub, create PR                     │
│    🔴 IMPORTANT: PR description MUST include:          │
│        Fixes #2                                        │
│                                                        │
│    Good PR description:                                │
│    ───────────────────                                 │
│    ## What                                             │
│    Install pre-commit hooks for all devs              │
│                                                        │
│    Fixes #2                                           │ ← THIS IS CRITICAL
│                                                        │
│    ## Steps                                            │
│    - Created setup script                              │
│    - Tested on multiple OSes                          │
│    - Added documentation                              │
│                                                        │
│    Status: GitHub Actions bot detects "Fixes #2"      │
│    Automation: ⚙️ Updates issue #2 → Label: in-progress│
│                  Updates issue #2 → Comment: PR #XYZ  │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│ 5. CODE REVIEW (In-Progress)                           │
│    Action: Reviewer reviews PR                         │
│    Action: Reviewer requests changes OR approves       │
│    Status: GitHub Actions detects review activity      │
│    Automation: ⚙️ Updates issue #2 → Label: review      │
│                  Adds comment: "2 reviews needed..."   │
│    PR shows: "2/2 approvals required"                  │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│ 6. APPROVAL & MERGE (Ready)                            │
│    Action: Reviewer approves PR (2nd approval)         │
│    Action: Developer clicks "Merge PR"                 │
│    GitHub merges  to dev branch                        │
│    Status: GitHub detects PR.merged = true             │
│                                                        │
│    🎯 AUTOMATION TRIGGERS:                             │
│    1. Finds "Fixes #2" in PR body                      │
│    2. GitHub API: CLOSE issue #2                       │
│    3. GitHub API: Add label "done" to issue            │
│    4. GitHub API: Remove old labels (ready, in-prog)   │
│    5. GitHub API: Comment on issue:                    │
│                                                        │
│       ✅ Closed by merged PR #456                      │
│       Commit: a1b2c3d (link)                           │
│       Merged at: 2026-04-15T10:23:00Z                 │
│                                                        │
│    Issue #2: NOW CLOSED ✅                            │
└────────────────────────────────────────────────────────┘
```

---

## REAL EXAMPLE: Phase 3 Issue #2

### Current State (Before PR)

```
Issue #2: [Ops] Install pre-commit hooks on all developer machines
├─ Status: 🟡 OPEN  
├─ Label: ready, phase-3, p0-critical
├─ Assignee: (unassigned)
├─ Estimate: S (< 1 day)
└─ Comments: (none yet)
```

### After Developer Takes Action

**Monday 10 AM:** Developer @alice assigns to self

```
Issue #2: [Ops] Install pre-commit hooks...
├─ Status: 🟡 OPEN
├─ Assignee: @alice ✅
└─ (No status change: ready/in-progress determined by PR)
```

**Monday 10:30 AM:** Alice creates PR

PR description:
```markdown
## What
Install pre-commit hooks on all developer machines

Fixes #2

## Changes
- Updated setup-framework.sh
- Updated setup-framework.ps1
- Tested on Windows, Mac, Linux

## How to Verify
1. Run: bash scripts/setup-framework.sh
2. Verify: ls -la .git/hooks/pre-commit
3. Test: git commit --allow-empty
```

**GitHub Actions detects "Fixes #2":**

```
Issue #2 AUTO-UPDATED:
├─ Status: 🟡 OPEN (still open)
├─ Label added: in-progress ✅
├─ Label removed: ready
├─ Comment added by bot: ⏳ PR #456 "Install pre-commit hooks"
│  "Status: in-progress, awaiting review (2 reviewers requested)"
└─ Status: Tracking PR #456
```

**Monday 2 PM:** Reviewer reviews and approves

```
Issue #2 AUTO-UPDATED:
├─ Label changed: in-progress → review
├─ Comment updated by bot: "Now in review, 1 of 2 approvals"
```

**Monday 3 PM:** Second reviewer approves, PR is merged

```
Issue #2 AUTO-CLOSED ✅:
├─ Status: 🟢 CLOSED (completed)
├─ Labels: done, merged
├─ Label removed: review, in-progress, ready
├─ Comment added by bot:
│  "✅ Closed by merged PR #456"
│  "Commit: a1b2c3d"
│  "Merged at: 2026-04-15T15:20:00Z"
└─ GitHub shows: "Closed by kushin77/lux-auto#456"
```

---

## WHAT YOU NEED TO DO (Developer Checklist)

### ✅ When Creating a PR:

```yaml
Step 1: Go to GitHub → Create Pull Request
Step 2: In Description, add ONE of these lines:
        ✅ Fixes #123
        ✅ Closes #456
        ✅ Resolves #789
        ❌ Related to #101 (doesn't auto-close!)

Step 3: Fill out other PR details as normal

Step 4: Click "Create pull request"

Result: GitHub Actions bot detects pattern
        Automation updates linked issue in real-time
        Status tracked automatically
        Issue closes when PR merges
```

### ✅ Valid Patterns (Use ONE):

```
✅ Fixes #2
✅ Fixes #2, #3, #5
✅ This PR Fixes #2 and Resolves #3
✅ Closes #2
✅ Resolves #2

❌ Related to #2 (links only, doesn't close)
❌ Ref #2 (links only, doesn't close)
❌ #2 (no action, just a comment)
```

---

## CURRENT STATUS: Phase 3 Issues

### What's Created (But Not Yet Closed)

| Issue # | Title | Status | Why Not Closed |
|---------|-------|--------|---|
| #1 | [EPIC] Phase 3 | 🟡 OPEN | Epic stays open while sub-issues done |
| #2 | Install pre-commit hooks | 🟡 OPEN | Task not started yet (Mon still Apr 15) |
| #3 | Branch protection (main) | 🟡 OPEN | Task not started |
| #4 | Branch protection (dev) | 🟡 OPEN | Task not started |
| #5-#10 | Other Phase 3 tasks | 🟡 OPEN | Tasks not started |

### When They'll Close

```
Monday Apr 15, 10 AM: Devs start Phase 3 tasks
├─ Issues #2-#10 get assigned
├─ Developers create PRs (with "Fixes #N" pattern)
├─ GitHub Actions auto-update issue labels
├─ Developers submit for review

Mon/Tue/Wed: Code review & iteration
├─ Labels auto-update (ready → in-progress → review)
├─ Comments auto-added by bot
├─ Status visible in real-time

Wed-Fri: PRs merge
├─ GitHub Actions detects merge
├─ Issues #2-#10 AUTO-CLOSE one by one
├─ Labels set to "done", "merged"
├─ Bot comments: "✅ Closed by PR #XXX"

Friday Apr 19, 5 PM: Issue #10 closed
├─ All Phase 3 issues complete ✅
├─ Team had successful first week
├─ Ready for Phase 4 Monday
```

---

## Architecture: How It Works

### GitHub Actions Workflows (Now Active)

**1. `.github/workflows/auto-close-issues.yml`**
- Trigger: `on: pull_request.types: [closed]`
- Action: When PR closed with `merged: true`
- Logic:
  ```
  FOR each issue reference in PR body:
    IF reference is "Fixes" OR "Closes" OR "Resolves":
      UPDATE issue state to "closed"
      ADD comment with merge details
      REMOVE old status labels
      ADD label "done"
    ELSE IF reference is "Related to":
      SKIP (don't auto-close)
  ```

**2. `.github/workflows/issue-status-updates.yml`**
- Trigger: `on: pull_request.types: [opened, reopened, review_requested]`
- Action: When PR created/reviewed
- Logic:
  ```
  FOR each issue reference in PR body:
    IF PR is draft:
      SET label "in-progress"
      ADD comment "🚧 Draft PR"
    ELSE IF PR is open and reviewed:
      SET label "review"
      ADD comment "📝 In review - X approvals needed"
    ELSE IF PR is open:
      SET label "in-progress"
      ADD comment "⏳ Awaiting review"
  ```

### Issue Template Instructions

All 9 issue templates now include:
```markdown
## How to Close This Issue

When creating a PR:

In your description, add:
Fixes #[issue-number]

Your PR will automatically close this issue when merged.
```

---

## FAQ: Common Questions

### Q: I created a PR but issue didn't update?
**A:** Check PR description. Does it have "Fixes #N"?
- ✅ `Fixes #123` → Will be detected
- ❌ `#123` → Won't be detected
- ❌ No issue number → Not linked

Go to PR, edit description, add "Fixes #N".

### Q: Issue has multiple problems, should I link multiple issues?
**A:** YES!
```
Fixes #2, #3, #5
```
All three issues will auto-close when PR merges.

### Q: Can I use "Related to" instead of "Fixes"?
**A:** YES, but it WON'T auto-close.
```
Fixes #2 (auto-closes)
Related to #3 (doesn't auto-close, just links)
```
This is useful for issues that aren't fully resolved by one PR.

### Q: Will old issues ever close?
**A:** Only if YOU create a PR with "Fixes #N" pattern.
Closed issues don't automatically populate from completed issues.

### Q: What if I close a PR without merging?
**A:** Issue won't close (good safety feature).
Must actually MERGE to GitHub (not just close PR).

### Q: Can I manually close an issue?
**A:** YES, but better to let automation do it.
Manual close: GitHub marks as "closed manually"
Automation close: Links to specific PR + commit

Best practice: Let PR merge trigger auto-close.

---

## Visual Proof (What You'll See)

### GitHub Issue Page (When Merged)

```
Issue #2: [Ops] Install pre-commit hooks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ CLOSED · kushin77 closed this Apr 15

Labels: done, merged ✅

Timeline:
├─ Apr 15, 10:30 AM   @alice assigned
├─ Apr 15, 10:31 AM   [PR #456 opened]
├─ Apr 15, 2:00 PM    [Label: in-progress added]
├─ Apr 15, 2:15 PM    [Label: review added]
├─ Apr 15, 3:00 PM    [Approved by @bob]
├─ Apr 15, 3:05 PM    [Merged by @alice]
└─ Apr 15, 3:05:23 PM ✅ Closed by merged PR #456

Comments:
├─ Bot: ⏳ PR #456 in-progress
├─ Bot: 📝 PR #456 in review
└─ Bot: ✅ Closed by merged PR #456
       Commit: a1b2c3d
       Merged: 2026-04-15T15:05:23Z
```

---

## What To Expect: Timeline

### Week 1: Phase 3 (Apr 15-19)

**Monday Morning:**
- Issues #2-#10 assigned to developers
- Status: 🟡 OPEN (waiting for PRs)

**Monday-Tuesday:**
- Developers create feature branches
- Developers create PRs with "Fixes #N"
- GitHub Actions bots start updating issues
- Issues show: 🟡 OPEN but with "in-progress" label
- Comments appear from automation bot

**Tuesday-Wednesday:**
- Code review in progress
- Issues show: "review" label
- Comments show approval count

**Thursday-Friday:**
- PRs merging to dev branch
- Issues AUTO-CLOSING one by one
- Status changes to: 🟢 CLOSED
- Labels change to: "done", "merged"

**Friday 5 PM:**
- All Phase 3 issues: 🟢 CLOSED ✅
- Epic #1: Marked complete
- Team retrospective confirms success

---

## BOTTOM LINE

✅ **Issues now automatically close when PRs merge** (if properly linked)

✅ **Automation updates issue status in real-time**

✅ **Zero manual issue management needed**

✅ **All developers just need to use "Fixes #N" pattern**

---

## Next Steps: For Developers

**Before you create a PR:**
1. Read: GITHUB-ISSUES-MANDATE.md (Section 11)
2. Review: Your issue's acceptance criteria
3. Remember: "Fixes #N" in PR description = auto-close

**When you create a PR:**
1. Fill in PR description
2. Add: "Fixes #[issue-number]"
3. Submit PR
4. Watch: Issue updates in real-time 🎉

**When PR is approved:**
1. Click: Merge
2. Done! Issue auto-closes ✅
3. No manual work needed

---

**Questions?** See GITHUB-ISSUES-MANDATE.md Section 11 or @mention @kushin77

