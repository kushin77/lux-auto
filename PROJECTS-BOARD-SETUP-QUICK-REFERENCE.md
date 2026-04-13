# Projects v2 Board Setup — Quick Reference

**Status:** Ready to create (simple UI, ~5 min)  
**Issue:** #80 in GitHub  
**Milestones:** ✅ All created (Phase 4/5/6)

---

## Quick Setup (Copy-Paste Ready)

### Step 1: Create Board
Go to: https://github.com/kushin77/lux-auto/projects

Click **"New"** button → Choose **"Table"** → Name: **"Phase 4 Delivery Pipeline"**

### Step 2: Create Columns
Add these 5 columns in order:
1. **Backlog**
2. **Ready**
3. **In Progress**
4. **In Review**
5. **Done**

### Step 3: Set Up Automation
For each column, click ⚙️ (gear icon) and choose automation:

**Backlog:**
- Trigger: Issues opened
- Set status to: Backlog

**Ready:**
- Trigger: Label added `ready`  
- Set status to: Ready

**In Progress:**
- Trigger: Label added `in-progress`
- Set status to: In Progress

**In Review:**
- Trigger: Label added `review`
- Set status to: In Review

**Done:**
- Trigger: Issue closed
- Set status to: Done

### Step 4: Link to Epic (Optional)
Click ⋮ (more) → Link issue #70 to board

---

## Completed Milestones ✅

| Milestone | Due Date | Status |
|-----------|----------|--------|
| Phase 4 — Health Check API | Apr 25, 2026 | ✅ Created |
| Phase 5 — Production Deployment | May 9, 2026 | ✅ Created |
| Phase 6 — Operations | Jun 2, 2026 | ✅ Created |

**Auto-assignment:** auto-assign.yml will now auto-set milestones when issues are labeled with `phase-4`, `phase-5`, or `phase-6`.

---

## What's Automated Now

✅ Milestones created (issue #84 COMPLETE)  
⏳ Projects board (can be created via UI in 5 min, or use this guide)

---

## Why This Matters

Once board is created:
- Issues auto-flow through columns based on labels
- Team can see progress at a glance
- No manual board updates needed
- Visual kanban for stakeholders

---

*Setup time: ~5 minutes via GitHub UI*  
*Benefit: Hands-off issue flow tracking for entire Phase 4-6*
