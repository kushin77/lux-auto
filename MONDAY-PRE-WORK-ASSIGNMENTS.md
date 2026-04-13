# Monday April 15 Pre-Work Assignments
## Team Must Complete by 9:00 AM PT Monday

**Status:** Framework launch readiness verification  
**Date Assigned:** Friday, April 12, 2026  
**Deadline:** Monday, April 15, 2026 - 9:00 AM PT  
**Estimated Time:** 3-4 hours per team member  

---

## Purpose

This document contains all required pre-work for the Lux-Auto Framework launch. Every team member must complete all steps before 9:00 AM Monday to ensure the Phase 3 kickoff (5-day onboarding) runs smoothly without technical delays.

**Do not skip steps.** If you encounter ANY blocking issue, notify leadership immediately (by phone if needed) - we're only 72 hours from launch.

---

## SECTION 1: Environment Setup (Do First - 2 hours)

### Step 1.1: Verify GitHub Access
**Purpose:** Confirm you can access the lux-auto repository  
**Time:** 10 minutes

1. Open https://github.com/kushin77/lux-auto
2. Verify you can see the repository (green "Code" button visible)
3. Check that you have **write access** - you should see Settings tab in the repository
4. If you cannot access or don't have write access:
   - **STOP HERE** - notify the team lead immediately
   - Do NOT proceed with other steps until GitHub access is confirmed
   - This is a blocking issue that prevents all other work

**Verification Checklist:**
- [ ] Repository loads successfully
- [ ] I can see the "Code" button
- [ ] I can see the "Pull requests" tab
- [ ] I can see the "Issues" tab
- [ ] I have write access (can see Settings)

---

### Step 1.2: Clone the Repository
**Purpose:** Get a local copy to work from  
**Time:** 15 minutes

**On Windows (PowerShell as Administrator):**

```powershell
# Navigate to your projects folder (modify path if desired)
cd ~\Desktop

# Clone the repository
git clone https://github.com/kushin77/lux-auto.git
cd lux-auto

# Verify you're on dev branch
git branch -a
# Should show: * dev with origin/dev

# Pull latest changes
git pull origin dev
```

**Expected output:**
```
Cloning into 'lux-auto'...
remote: Enumerating objects: XXXX, done.
Receiving objects: 100% (XXXX/XXXX), XXX MB, done.
Resolving deltas: 100% (XXXX/XXXX), done.
```

**Verification Checklist:**
- [ ] Repository cloned successfully
- [ ] `cd lux-auto` command works
- [ ] `git branch -a` shows `* dev` (asterisk means current branch)
- [ ] Latest commit is visible: `git log --oneline -1`
- [ ] No git errors ("fatal", "error", "rejected")

**If you see this error:**
```
fatal: could not read Username
```
This is expected on first clone. Configure Git:
```powershell
git config --global user.name "Your Name"
git config --global user.email "your.email@company.com"
```

---

### Step 1.3: Verify Python Environment
**Purpose:** Ensure you have Python 3.11+ (required by backend)  
**Time:** 10 minutes

**Check Python version:**
```powershell
python --version
# or
python3 --version
```

**Expected output:** `Python 3.11.x` or higher (3.12+ even better)

**If version is 3.10 or lower:**
- Download Python 3.12 from https://www.python.org/downloads/
- Install it (check "Add Python to PATH" during installation)
- **DO NOT uninstall old version** - other projects may depend on it
- Verify: `python --version` shows 3.12+

**Verification Checklist:**
- [ ] Python version is 3.11 or higher
- [ ] `python -m pip --version` works (shows pip version)
- [ ] `python -c "import sys; print(sys.executable)"` shows your Python path
- [ ] No "command not found" or "not recognized" errors

---

### Step 1.4: Install Backend Dependencies
**Purpose:** Get all required Python packages for local development  
**Time:** 20 minutes

**From the lux-auto folder:**

```powershell
# Navigate to the repository
cd ~\Desktop\lux-auto

# Create a virtual environment (optional but recommended)
python -m venv venv

# Activate it
.\venv\Scripts\Activate.ps1
# You should see (venv) in your terminal prompt

# Install backend dependencies
pip install -r backend/requirements.txt

# Verify critical imports work
python -c "import fastapi; import pytest; import black; print('✓ All critical packages installed')"
```

**Expected output:** 
```
✓ All critical packages installed
```

**If you get "pip is not defined":**
This is usually a Windows PATH issue. Try:
```powershell
python -m pip install -r backend/requirements.txt
```

**Verification Checklist:**
- [ ] Virtual environment activated (or you skipped and using system Python - that's ok)
- [ ] `pip install -r backend/requirements.txt` completes without errors
- [ ] Critical packages import successfully
- [ ] `black --version` shows version number
- [ ] `pytest --version` shows version number

---

### Step 1.5: Verify Docker (Optional but Recommended)
**Purpose:** Ensure you can build Docker images (needed for Phase 5)  
**Time:** 10 minutes if Docker installed, skip if not available

**Check if Docker is installed:**
```powershell
docker --version
```

**If installed, verify:**
```powershell
docker ps
# Should show either empty list or running containers (no errors)
```

**If NOT installed:**
- Download Docker Desktop from https://www.docker.com/products/docker-desktop
- Install it
- Restart your computer
- Run `docker --version` to verify
- This is highly recommended - you'll need it Thursday (Phase 5 deployment)

**Verification Checklist:**
- [ ] Docker is installed (or I planned to install it this weekend)
- [ ] `docker --version` shows Docker X.XX.X or higher
- [ ] `docker ps` runs without errors
- [ ] I can see the Docker icon in taskbar (if installed)

---

## SECTION 2: Documentation Review (Do After Setup - 1-1.5 hours)

### Step 2.1: Read the Quick Reference (15 minutes)
**Purpose:** Understand the framework at 30,000 feet  
**File:** [QUICK-REFERENCE.md](QUICK-REFERENCE.md)

**What to pay attention to:**
- The 6 phases and what Phase 3 (your week) involves
- Core values: Incrementalism, Safety, Autonomy
- Key SLOs: 99.5% availability, <200ms latency, <0.1% error rate

**Checkpoint:** Can you answer these without looking back?
- [ ] What are the 6 phases?
- [ ] When does Phase 3 start and end?
- [ ] What is the Phase 3 goal?
- [ ] Who is on the team and what's your role?

---

### Step 2.2: Read Phase 3 Kickoff (30 minutes)
**Purpose:** Understand your role in Phase 3 (this week)  
**File:** [PHASE-3-LAUNCH-KICKOFF.md](PHASE-3-LAUNCH-KICKOFF.md)

**What to focus on:**
- Monday-Friday schedule (what's happening each day)
- Your team's responsibilities
- Meeting times and what to bring
- What success looks like at end of week

**Checkpoint:** Can you answer these without looking back?
- [ ] What time does Monday kickoff start?
- [ ] Is Wednesday a work day? (Yes, retrospective prep)
- [ ] What skill are we learning Thursday morning?
- [ ] What does Friday look like?

---

### Step 2.3: Read Contributing Standards (20 minutes)
**Purpose:** Understand code quality expectations  
**File:** [CONTRIBUTING.md](CONTRIBUTING.md)

**What to focus on:**
- Git workflow (branch naming, commit messages)
- Code review process (who approves, what they check)
- Pre-commit hooks (they run automatically)
- Testing requirements (90%+ coverage minimum)

**Checkpoint:** Can you answer these without looking back?
- [ ] What's the branch naming convention?
- [ ] How many approvals needed before merging?
- [ ] What happens if pre-commit hooks fail locally?
- [ ] What code coverage minimum is required?

---

### Step 2.4: Read Infrastructure Overview (15 minutes)
**Purpose:** Understand the deployment targets and monitoring  
**File:** [INFRASTRUCTURE-OVERVIEW.md](INFRASTRUCTURE-OVERVIEW.md)

**What to focus on:**
- Staging environment (where Phase 4 code goes)
- Production environment (where Phase 5 code goes)
- Monitoring tools (Prometheus, Grafana, AlertManager)
- SLO targets again (they're important)

**Checkpoint:** Can you answer these without looking back?
- [ ] Where does staging code come from?
- [ ] Where does production code come from?
- [ ] What's the on-call process (Phase 5 and 6)?
- [ ] What's our availability SLO target?

---

## SECTION 3: GitHub & Tools Verification (Do After Documentation - 30 minutes)

### Step 3.1: Verify GitHub Issue Access
**Purpose:** Confirm you can see and interact with issues  
**Time:** 10 minutes

1. Go to https://github.com/kushin77/lux-auto/issues
2. Filter by label "phase-3" - you should see 9 issues
3. Click on one issue (any one is fine)
4. Verify you can:
   - [ ] See the issue description and acceptance criteria
   - [ ] See comments section (might be empty)
   - [ ] See "Assignees" section on the right
   - [ ] See "Labels" section showing "phase-3"

**Expected:** You should see 9 Phase 3 issues listed

**If you see 0 issues:**
- STOP - notify team lead immediately
- This is a blocking issue preventing Phase 3 execution

---

### Step 3.2: Test GitHub Workflow
**Purpose:** Verify you can create branches and commits  
**Time:** 20 minutes

This is a SAFE TEST - it creates a branch you'll delete after testing.

**Follow these exact steps:**

```powershell
# 1. Make sure you're in the repo folder
cd ~\Desktop\lux-auto

# 2. Sync with latest code
git pull origin dev

# 3. Create a test branch (you WILL delete this)
git checkout -b test/pre-work-verification-$(Get-Date -Format 'MMdd-HHmm')
# This creates a branch like: test/pre-work-verification-0412-1430

# 4. Create a test file
New-Item -Path ".\pre-work-test-$(Get-Date -Format 'MMdd').txt" -ItemType File -Value "Pre-work test - $(Get-Date)"

# 5. Check status
git status
# Should show your new file as "Untracked files"

# 6. Stage the file
git add *.txt

# 7. Commit it
git commit -m "test: pre-work verification - this will be deleted"

# 8. STOP HERE - do NOT push
# Switch back to dev (this orphans the test branch safely)
git checkout dev

# 9. Delete the test branch
git branch -D test/pre-work-verification-*
# Should see: "Deleted branch test/..."
```

**Expected result:**
- [ ] All git commands executed without errors
- [ ] Test branch was created successfully
- [ ] Test file was committed
- [ ] Test branch deleted successfully
- [ ] You're back on `dev` branch (check with `git status`)

---

### Step 3.3: Verify Code Editor Setup
**Purpose:** Ensure you can edit code and run linters  
**Time:** Optional (if you don't have this, we'll set up Monday)

**If you use VS Code (recommended):**
```powershell
# Check if VS Code is installed
code --version
```

**If installed, open the repo:**
```powershell
cd ~\Desktop\lux-auto
code .
```

**In VS Code, verify these extensions installed** (optional, nice-to-have):
- Python (Microsoft)
- Pylance
- Black Formatter
- Ruff
- GitLens

**If you use PyCharm, IntelliJ, or Vim:** That's fine too - we'll verify Monday.

**Verification Checklist:**
- [ ] I can open the repository in my editor
- [ ] I can see the folder structure (backend/, scripts/, etc.)
- [ ] I can open a Python file without errors
- [ ] (Optional) Code formatting extensions installed

---

## SECTION 4: Team Agreement (Do Last - 10 minutes)

### Step 4.1: Read Standards & Sign Agreement
**Purpose:** Confirm you understand and agree to the framework  
**File:** [TEAM-STANDARDS-AGREEMENT.md](TEAM-STANDARDS-AGREEMENT.md)

**This agreement covers:**
- Code quality standards (90%+ test coverage, 2 approvals required)
- Meeting attendance expectations (95% minimum, calendar block required)
- Communication norms (Slack response SLA, GitHub notification check)
- Learning objectives for Phase 3

**Sign the agreement:**

You don't need to do anything here - this is informational. But read it carefully and be prepared to verbally confirm your agreement Monday morning at 9:00 AM PT.

**Checkpoint:**
- [ ] I've read the TEAM-STANDARDS-AGREEMENT.md
- [ ] I understand the code quality standards
- [ ] I understand the meeting expectations
- [ ] I'm prepared to confirm my agreement Monday at 9 AM PT

---

## SECTION 5: Final Verification Checklist (Do Before Bed Friday - 5 minutes)

Complete this checklist and check every box. If any box is unchecked, fix it now or notify the team lead.

### Environment (All boxes must be ✓)
- [ ] GitHub access verified
- [ ] Repository cloned locally
- [ ] `git branch -a` shows `* dev`
- [ ] Python 3.11+ installed
- [ ] Backend dependencies installed (`pip list` shows FastAPI, pytest, etc.)
- [ ] Docker installed OR scheduled to install this weekend

### Documentation (All boxes must be ✓)
- [ ] Read QUICK-REFERENCE.md
- [ ] Read PHASE-3-LAUNCH-KICKOFF.md
- [ ] Read CONTRIBUTING.md
- [ ] Read INFRASTRUCTURE-OVERVIEW.md
- [ ] Understand the 5-day Phase 3 schedule
- [ ] Know where to find answers to questions

### GitHub (All boxes must be ✓)
- [ ] Can access GitHub repository
- [ ] Can see Phase 3 issues (9 issues listed)
- [ ] Successfully created and deleted a test branch
- [ ] Know how to create commits and PRs

### Readiness (All boxes must be ✓)
- [ ] All environment setup complete (no blocking issues)
- [ ] All documentation reviewed (understand Phase 3)
- [ ] GitHub workflow tested (can commit and branch)
- [ ] Read TEAM-STANDARDS-AGREEMENT.md
- [ ] Calendar blocked: Monday-Friday 9 AM - 5 PM PT
- [ ] Ready to show up Monday at 9 AM PT fresh and prepared

---

## SECTION 6: If You Get Stuck (Emergency Help)

### Issue: GitHub Access Denied
**Solution:**
1. Verify you're signed in to GitHub (upper right corner)
2. Check you have an account (ask team lead if not)
3. Request write access if you're a new team member
4. **Notify team lead immediately if this isn't resolved by Friday 5 PM**

### Issue: pip install keeps failing
**Solution:**
1. Try with `-v` flag to see detailed output: `pip install -r backend/requirements.txt -v`
2. If specific package fails, try installing just that one: `pip install packagename==version`
3. Check your internet connection (large downloads required)
4. **Notify team lead if not resolved by Friday 5 PM**

### Issue: Git commands don't work / Not recognized
**Solution:**
1. Download Git from https://git-scm.com/download/win
2. Install with all defaults
3. **Restart PowerShell** (close and reopen terminal)
4. Try again: `git --version`
5. **Notify team lead if not resolved by Friday 5 PM**

### Issue: Python version wrong or `python` command doesn't work
**Solution:**
1. Go to https://www.python.org and download Python 3.12
2. During installation, **CHECK the box "Add Python to PATH"**
3. **Restart PowerShell** after installation
4. Verify: `python --version` shows 3.12+
5. **Notify team lead if not resolved by Friday 5 PM**

### Issue: Anything else blocking you
**DO NOT WAIT UNTIL MONDAY:**
- Slack the team lead Friday (today if possible)
- Or call (this is too important to wait)
- Include:
  - What you were trying to do
  - The exact error message (screenshot is helpful)
  - What you already tried
  - Your environment (Windows 10/11, Python version, etc.)

---

## SECTION 7: What Happens Monday (Preview)

You'll walk into Monday morning having:
- ✓ Repository cloned and ready
- ✓ Environment set up (Python, Docker, tools)
- ✓ Documentation read and understood
- ✓ GitHub access verified
- ✓ Team standards understood

**Monday 9:00 AM PT Timeline:**
1. **9:00-9:15 AM:** All-hands kickoff meeting (live, in-person or Zoom)
   - Welcome and ceremony
   - Leadership remarks
   - Framework overview
   
2. **9:15-10:00 AM:** Phase 3 objectives and week structure
   - What we're learning
   - Weekly schedule
   - Success criteria
   
3. **10:00-11:00 AM:** Day 1 technical kickoff
   - Repository tour (why are files organized this way?)
   - Standards walkthrough (code quality, testing, reviews)
   - Your first issue assignment
   
4. **11:00 AM-12:00 PM:** Hands-on first task
   - Set up dev environment with team support
   - Run first test locally
   - Get first PR up for review

**Expected:** By end of Monday, every team member will have:
- Repository cloned
- Environment verified
- First task started
- First PR in code review

---

## SECTION 8: Success Criteria for Monday Morning

You're ready for Phase 3 if:

**Technical ✓**
- [ ] Repository cloned and on `dev` branch
- [ ] Python 3.11+ working
- [ ] Backend dependencies installed
- [ ] GitHub access verified (can see Phase 3 issues)
- [ ] Test branch creation/deletion works

**Knowledge ✓**
- [ ] Can explain what Phase 3 is (5-day onboarding)
- [ ] Can explain the 6 phases of the framework
- [ ] Understand code quality standards (90% coverage, 2 approvals)
- [ ] Know where to find documentation when stuck
- [ ] Understand Phase 3 daily schedule (Mon-Fri activities)

**Commitment ✓**
- [ ] Calendar blocked: Mon-Fri 9 AM - 5 PM PT
- [ ] Confirmed you'll attend all meetings
- [ ] Confirmed you understand team standards
- [ ] Confirmed you're ready to learn and ship
- [ ] Confirmed you'll notify team lead of any blockers

---

## Submission: No formal submission needed!

Just come Monday ready. If you get stuck on any step:
1. **Try to fix it yourself first** (we have time)
2. **Check the documentation in the repo** for answers
3. **Slack the team lead** if you're still stuck
4. **Do NOT ignore blockers** - notify immediately

The team lead will check in Friday afternoon to see if anyone has blockers. If you're stuck, say something then.

---

## Timeline Summary

- **Friday 4/12:** You do pre-work (this document) - Goal: 3-4 hours
- **Friday evening:** Team lead checks in with anyone who has blockers
- **Saturday-Sunday:** Rest and prepare mentally (sleep well!)
- **Monday 9:00 AM:** Framework launch - Phase 3 kickoff begins

---

**Final Note:** This is not busy work. Every step here is designed to prevent technical issues from derailing our launch. If you're stuck, speak up TODAY (Friday). We have time to fix things before Monday. If you wait until Monday, it wastes everyone's time and energy.

See you Monday morning. Let's ship something great together.

---

**Version:** 1.0  
**Last Updated:** April 12, 2026  
**Owner:** Framework Leadership Team  
**For Questions:** Contact team lead on Slack
