# Team Pre-Work Assignment
## Due: Sunday April 14, 2026 by 11:59 PM PT

**Framework Launch:** Monday April 15, 2026 at 9:00 AM PT (Phase 3 Kickoff)

This document outlines all pre-work you must complete this weekend to be ready for launch. Completion time: **2-4 hours per team member**

---

## Part 1: Access Verification (30 minutes)
### Required: Confirm you have GitHub access

1. **GitHub Repository Access**
   - [ ] Clone repo: `https://github.com/kushin77/lux-auto.git`
   - [ ] Verify you can see the `dev` branch
   - [ ] Verify you can see at least 3 recent commits
   - [ ] Command to test:
     ```bash
     git clone https://github.com/kushin77/lux-auto.git
     cd lux-auto
     git log --oneline -5
     ```
   - [ ] **Stop here if this fails** → Message: @kushnir77 in Slack immediately

2. **GitHub Issues Access**
   - [ ] Go to https://github.com/kushin77/lux-auto/issues
   - [ ] Verify you can see Phase 3 issues (#24-31)
   - [ ] Click one issue and verify you can view all details
   - [ ] **If you cannot see issues** → You don't have correct permissions

3. **Verify GitHub Team Membership**
   - [ ] Message from @kushnir77: "I've added you to kushin77/lux-auto team"
   - [ ] You should have received email invite
   - [ ] [ ] Accept invite if you haven't already

---

## Part 2: Local Environment Setup (1-2 hours)
### Required: Set up development environment

### Step 1: Clone Repository
```bash
cd ~/projects  # or your preferred dev directory
git clone https://github.com/kushin77/lux-auto.git
cd lux-auto
```

### Step 2: Install Python & Dependencies
**Requirement:** Python 3.10+

```bash
# Check Python version
python --version
# Should output: Python 3.10.x or higher

# Create virtual environment
python -m venv venv

# Activate venv
# On macOS/Linux:
source venv/bin/activate
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r backend/requirements.txt
pip install pytest pytest-cov black ruff mypy bandit detect-secrets
```

### Step 3: Verify Installation
```bash
# Test Flask/FastAPI can be imported
python -c "import fastapi; print(fastapi.__version__)"

# Test pytest works
pytest --version

# Test linters
black --version
ruff --version
mypy --version
```

### Step 4: Docker Setup (Optional but Recommended)
```bash
# Verify Docker is installed
docker --version

# Try pulling the base image
docker pull python:3.10-slim
```

**If Docker fails:** You can skip this and use local Python for Phase 3

### Step 5: Run Pre-commit Hooks Setup
```bash
pip install pre-commit
pre-commit install

# Test it works
touch backend/test.py
git add backend/test.py
# Should see pre-commit checks run
git reset backend/test.py
rm backend/test.py
```

### Completion Check:
```bash
# Should output no errors
python -c "from backend.main import app; print('✓ FastAPI app imports successfully')"
```

---

## Part 3: Documentation Review (30-45 minutes)
### Required: Read these documents BEFORE Monday 9 AM

**READ IN THIS ORDER:**

1. **[INDEX.md](INDEX.md)** (5 min)
   - Overview of all framework documents
   - Understand the 6-phase structure
   
2. **[FRAMEWORK-EXECUTION-MASTER-GUIDE.md](FRAMEWORK-EXECUTION-MASTER-GUIDE.md)** (10 min)
   - How the entire framework fits together
   - Your role in each phase
   - What documents apply to you

3. **[PHASE-3-LAUNCH-KICKOFF.md](PHASE-3-LAUNCH-KICKOFF.md)** (15 min)
   - Detailed Monday-Friday schedule
   - What you'll learn each day
   - Success criteria for Phase 3

4. **[CONTRIBUTING.md](CONTRIBUTING.md)** (10 min)
   - How we write code
   - Testing requirements (90%+ coverage)
   - Code review process

5. **Your Role-Specific Guide** (10 min)
   - **If you're on DevOps:** Read INFRASTRUCTURE-DEPLOYMENT-READY.md
   - **If you're on the feature team:** Read PHASE-4-EXECUTION-KICKOFF.md
   - **If you're leadership:** Read GO-LIVE-DECISION-MATRIX.md
   - **If you're a project manager:** Read GITHUB-ISSUES-EXECUTION-SUMMARY.md

---

## Part 4: Questions & Answers (Store these somewhere visible)
### Read the FAQ before Monday

Open [TEAM-LAUNCH-FAQ.md](TEAM-LAUNCH-FAQ.md) and review:
- Common setup issues and solutions
- What to expect each day
- How to ask questions during the week
- Who to contact for what

---

## Part 5: Environment Configuration (15 minutes)
### Required: Prepare your local config

**Create `backend/.env.local` file:**
```bash
# backend/.env.local
DATABASE_URL=postgresql://lux.kushnir.cloud:5432/lux_dev
FASTAPI_SECRET_KEY=dev-secret-key-not-for-production
GOOGLE_CLIENT_ID=dev-client-id
GOOGLE_CLIENT_SECRET=dev-client-secret
OAUTH2_PROXY_COOKIE_SECRET=dev-cookie-secret
DEBUG=true
```

**Test it works:**
```bash
cd backend
python -c "from dotenv import load_dotenv; load_dotenv('.env.local'); print('✓ Config loaded')"
```

---

## Part 6: Slack Channel Setup (10 minutes)
### Required: Join team Slack channels

Join these channels in Slack workspace:
- [ ] #lux-auto-launch (announcements Monday)
- [ ] #lux-auto-dev (technical discussion)
- [ ] #lux-auto-standup (daily standups, 10:30 AM PT)
- [ ] #lux-auto-random (off-topic, team social)

**First message:** Reply to the pinned welcome message with:
```
✓ Pre-work complete (@mention if you have blockers)
```

---

## Completion Checklist

Print this out and check off as you go:

```
SATURDAY:
[ ] GitHub access verified
[ ] Repository cloned
[ ] Python 3.10+ installed
[ ] Virtual environment created and activated
[ ] Dependencies installed
[ ] Pre-commit hooks set up
[ ] FastAPI imports successfully
[ ] All 5+ documentation files read
[ ] .env.local created
[ ] Slack channels joined

SUNDAY:
[ ] Review Phase-3 checklist again (5 min refresh)
[ ] Verify all tools still work (run pre-commit test)
[ ] Get good sleep - big week ahead!
[ ] Have breakfast ready for Monday 8:30 AM
```

---

## If You Hit Blockers

**Cannot clone repo?**
→ Message @kushnir77: "I cannot access lux-auto repository"

**Python issues?**
→ Message @kushnir77: "Python 3.10+ not available on my machine"

**Docker issues?**
→ Message @kushnir77: "Docker installation failed, but I have Python ready"

**Cannot access GitHub issues?**
→ Message @kushnir77: "I cannot see Phase 3 issues on GitHub"

**Timezone question?**
→ All times listed are PT (Pacific Time). Convert if needed: https://www.timeanddate.com/

---

## What You DON'T Need To Do This Weekend

❌ Write any code - that starts Monday
❌ Deploy anything - infrastructure is pre-configured  
❌ Set up databases - we'll do that together Monday
❌ Study the entire codebase - we'll learn together this week
❌ Prepare presentations - we've got that covered

---

## Success Metrics

You are **READY** if:

✅ You can clone the repo and see all code  
✅ Python and all dependencies install  
✅ You've read the 5 key documents  
✅ You've joined all Slack channels  
✅ You have zero blockers listed above  

**Expected readiness:** Saturday evening  
**Confirmation deadline:** Sunday 11:59 PM (just reply "Ready" in Slack)  

---

## Timeline for Monday

- **8:30 AM PT:** Join Slack voice (channel #lux-auto-standup)
- **8:45 AM PT:** All cameras on, intros and welcome
- **9:00 AM PT:** Phase 3 kickoff begins
- **9:30 AM PT:** First hands-on task (verify GitHub branch protection)
- **12:00 PM PT:** Lunch break
- **1:00 PM PT:** Continue with Phase 3 tasks

---

## Questions Before Monday?

Reach out in Slack:
- **#lux-auto-general** - General questions
- **@kushnir77** - Urgent blockers or clarifications

**Response guarantee:** You'll get an answer within 4 hours

---

**You've got this! See you Monday morning.** 🚀

---

*Last updated: April 12, 2026*  
*Next update: Phase 3 completion (April 19, 2026)*
