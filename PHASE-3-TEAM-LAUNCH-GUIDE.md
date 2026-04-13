# Phase 3 Launch Guide - Team Reference

**Week:** April 15-19, 2026  
**Phase:** 3 - Developer Onboarding & GitHub Enablement  
**Status:** ✅ Ready to Execute  
**Owner:** @kushin77  
**Team Size:** [Your team size]

---

## EXECUTIVE SUMMARY FOR TEAM

This week, we're setting up GitHub and preparing the team for real feature development. By Friday, everyone will have deployed code through the pipeline, and we'll be ready to build the first feature next week.

**Translation:** Monday you'll install some tools. Wednesday we'll train together. Friday we'll celebrate and plan next week.

---

## YOUR PHASE 3 TRACKING BOARD

Track these 10 issues all week:

| #   | Issue                          | Owner     | Timeline | Status | GitHub Link |
| --- | ------------------------------ | --------- | -------- | ------ | ----------- |
| 81  | [EPIC] Phase 3                 | @kushin77 | Mon-Fri  | 📋     | #81         |
| 82  | [Ops] Install pre-commit hooks | You       | Mon-Tue  | ⏳     | #82         |
| 83  | [Ops] Branch protection (main) | @kushin77 | Mon      | ⏳     | #83         |
| 85  | [Ops] Branch protection (dev)  | @kushin77 | Mon      | ⏳     | #85         |
| 86  | [Ops] GitHub Actions CI/CD     | @kushin77 | Mon-Tue  | ⏳     | #86         |
| 87  | [Ops] GitHub secrets           | @kushin77 | Tue      | ⏳     | #87         |
| 88  | [Docs] GitHub setup procedure  | @kushin77 | Tue-Wed  | ⏳     | #88         |
| 89  | [Framework] Team training      | @kushin77 | Wed 2 PM | ⏳     | #89         |
| 90  | [Ops] Sample PR validation     | You + QA  | Thu-Fri  | ⏳     | #90         |
| 91  | [Framework] Retrospective      | @kushin77 | Fri 3 PM | ⏳     | #91         |

---

## DAILY GUIDE

### MONDAY APRIL 15

**9:00-11:00 AM: Phase 3 Kickoff Meeting**

- Tech lead explains Phase 3
- Framework overview (30 min)
- Pre-commit hooks demo (15 min)
- GitHub workflow demo (15 min)
- Q&A (20 min)

**11:00 AM - 5:00 PM: Start Local Setup**

**Action Items for Developers:**

1. Clone the repository (if not already)

   ```bash
   git clone git@github.com:kushin77/lux-auto.git
   cd lux-auto
   ```

2. Read the setup procedure (link will be shared)
   - 15 minutes

3. Install pre-commit hooks (#82)

   ```bash
   pip install pre-commit
   pre-commit install
   pre-commit run --all-files
   ```

   - 30 minutes (first time can be slow)

4. Test the hooks work
   ```bash
   # Make a dummy change
   echo "# test" >> README.md
   git add README.md
   git commit -m "test: verify hooks work"
   # Should run hooks and either pass or show errors
   # Fix any errors and commit again
   ```

   - 15 minutes

**Action Items for Tech Lead:**

- [ ] Run 9:00-11:00 AM kickoff meeting
- [ ] Enable GitHub Actions (#86)
- [ ] Verify branch protection setup (#83, #85)
- [ ] Help developers with setup (pair if needed)

### TUESDAY APRIL 16

**Goal:** Finish local setup, start GitHub infrastructure

**Action Items for Developers:**

- [ ] Finish pre-commit hooks (#82) if not complete
- [ ] Verify hooks run on every `git commit`
- [ ] Help other team members if stuck

**Action Items for Tech Lead:**

- [ ] Check: All developers have pre-commit installed
- [ ] Create GitHub secrets (#87)
- [ ] Verify GitHub Actions pipeline (#86) working
- [ ] Share GitHub setup documentation (#88) - WIP

### WEDNESDAY APRIL 17

**2:00-3:00 PM: Team Training Session (Mandatory)**

**What We'll Cover:**

1. Why the framework exists (5 min)
2. How to create a branch (live demo, 5 min)
3. How to make commits (live demo, 5 min)
4. How to open a PR (live demo, 5 min)
5. Code review process (5 min)
6. GitHub Actions pipeline explained (5 min)
7. Q&A (20 min)

**Before Training:**

- [ ] Read GitHub setup procedure (#88)
- [ ] Ask questions in Slack #tech-help

**After Training:**

- [ ] Recording available for anyone who missed it
- [ ] FAQ document available

**Rest of Wednesday:**

- [ ] Team to review training materials
- [ ] Tech lead finalizes sample PR (#90) to run Thursday

### THURSDAY APRIL 18

**Goal:** Run first PR through the entire pipeline

**All Developers:**

- [ ] Follow sample PR walkthrough (#90)
- [ ] Create a branch
- [ ] Make a small change
- [ ] Open a PR
- [ ] Watch GitHub Actions run (take notes if anything surprises you)
- [ ] Get code review feedback
- [ ] Fix any issues
- [ ] Merge the PR
- [ ] Document what you learned

**Tech Lead:**

- [ ] Facilitate code review on sample PR
- [ ] Help developers with any blockers
- [ ] Document issues that came up

### FRIDAY APRIL 19

**3:00-4:00 PM: Phase 3 Retrospective (Mandatory)**

**Agenda:**

1. What went well? (10 min)
   - Share positives
   - What was smooth?
   - What process was helpful?

2. What was hard? (10 min)
   - Blockers?
   - Confusing parts?
   - Technical issues?

3. Metrics (5 min)
   - How long did local setup actually take?
   - How many issues?
   - Team confidence level? (1-10 rating)

4. Process improvements (10 min)
   - What should we change for Phase 4?
   - Tool improvements?
   - Documentation improvements?

5. Phase 4 planning (10 min)
   - Discuss feature options
   - Select ONE feature for next week
   - Assign feature lead

6. Celebration (5 min)
   - Recognize good work
   - Celebrate milestone
   - Energize for next week

**After Retrospective:**

- [ ] Tech lead creates Phase 4 epic issue
- [ ] Tech lead creates Phase 4 sub-issues (5 issues)
- [ ] Team briefed on Phase 4
- [ ] Weekend planning begins

---

## GETTING HELP

### Q: "I have a problem"

- Post in #tech-help channel with:
  - What you're trying to do
  - What error you got
  - What you tried
- Tech lead responds within 2 hours

### Q: "Pre-commit is failing"

- Read the error message
- Fix the code
- Try committing again
- If stuck: #tech-help channel

### Q: "GitHub Actions failed"

- Click on red "X" in GitHub PR
- Read the error message in the workflow
- Fix the code
- Push again (GitHub re-runs automatically)
- Tech lead can help if stuck

### Q: "I'm lost"

- This is normal (phase 1 week for everyone)
- Ask in #tech-help
- Tech lead will pair with you
- You'll get through it

---

## SUCCESS CRITERIA FOR THIS WEEK

By Friday EOD, you should be able to:

- [ ] Install and use pre-commit hooks
- [ ] Create a branch and make commits
- [ ] Open a pull request on GitHub
- [ ] Read GitHub Actions results
- [ ] Get and respond to code feedback
- [ ] Merge a PR to the dev branch
- [ ] Understand why all this matters

By Friday 4 PM:

- [ ] Feel 80%+ confident about the process
- [ ] Know who to ask if you have questions
- [ ] Excited (and maybe a little nervous) about Phase 4

---

## COMMON ISSUES & FIXES

### "Pre-commit hook is too slow"

- First run caches dependencies
- Later runs are much faster (5-10 sec)
- This is normal

### "Pre-commit keeps failing"

- Read the error
- Fix the code
- Try again
- Black formatter can auto-fix some issues: `black .`

### "I can't push to dev branch"

- This is correct! Branch protection is working
- You must create a PR instead
- PR must pass all checks + code review
- Then you can merge

### "GitHub Actions is showing a red X"

- Click the X to see what failed
- Read the error in the workflow logs
- Fix the code
- Push to your branch again (auto-re-runs)

### "I'm stuck on step X"

- Post error message in #tech-help
- Include what you were trying to do
- Tech lead will help

---

## WHAT'S COMING NEXT WEEK (Phase 4)

- First real feature development
- 5 sub-issues (feature, tests, docs, deployment, retro)
- Feature will be deployed to staging by Friday
- Team will repeat this process but with real code

This week is practice. Next week is real. Don't worry!

---

## KEY CONTACTS

**Tech Lead:** @kushin77

- Questions about framework
- Help with blockers
- Pair programming

**DevOps Lead:** [Name]

- Questions about GitHub Actions
- Help with deployment issues

**Slack Channel:** #tech-help

- Ask questions anytime
- Team helps each other

**Emergency:** @kushin77 (direct message)

---

## CALENDAR INVITES (Check Your Calendar)

- [ ] Monday 9 AM - Phase 3 Kickoff (2 hours)
- [ ] Wednesday 2 PM - Team Training (1 hour)
- [ ] Friday 3 PM - Retrospective (1 hour)

All meetings mandatory. No exceptions.

---

## PRE-WORK (Complete Before Monday 9 AM)

If you haven't already:

- [ ] GitHub account set up
- [ ] SSH key configured
- [ ] Added to lux-auto repository
- [ ] Python 3.10+ installed
- [ ] Docker installed
- [ ] Repository cloned

---

**Questions?** Post in #tech-help  
**Last updated:** April 12, 2026  
**Status:** Ready for launch Monday April 15
