# Launch Day Morning Checklist
## Monday April 15, 2026 — Before 9:00 AM PT

**What:** Final verification before Phase 3 kickoff begins  
**When:** 8:00 AM - 8:55 AM PT (55 minutes to check)  
**Who:** Every team member  
**Duration:** 5-10 minutes per person  

---

## 8:00-8:15 AM: Environment & Setup

### You
- [ ] Computer is fully restarted (fresh start)
- [ ] You have strong internet connection (test: ping google.com)
- [ ] Camera is working and positioned correctly
- [ ] Headphones/speakers are working
- [ ] Slack is open and online

### Repository
- [ ] Terminal open to lux-auto directory:
  ```bash
  cd ~/projects/lux-auto  # or your path
  pwd  # should show .../lux-auto
  ```
- [ ] On `dev` branch:
  ```bash
  git branch  # should show * dev
  ```
- [ ] No uncommitted changes:
  ```bash
  git status  # should say "working tree clean"
  ```

### Dependencies
- [ ] Virtual environment activated:
  ```bash
  source venv/bin/activate  # macOS/Linux
  # OR
  .\venv\Scripts\Activate.ps1  # Windows
  ```
- [ ] FastAPI can be imported (copy/paste this):
  ```bash
  python -c "from fastapi import FastAPI; print('✓ Ready')"
  ```
- [ ] Output should show: `✓ Ready`

---

## 8:15-8:30 AM: GitHub & Access

### GitHub Repository
- [ ] Open https://github.com/kushin77/lux-auto
- [ ] You can see the code (not a 404 error)
- [ ] You can see latest commits (should include "Framework Execution Master Guide" from April 12)

### GitHub Issues
- [ ] Open https://github.com/kushin77/lux-auto/issues
- [ ] Filter by label: `phase-3`
- [ ] You should see 9 issues (#24-#32)
- [ ] Click one issue → you can view it fully (no permission error)

### Team Access
- [ ] You've received invite to kushin77/lux-auto GitHub team (check email)
- [ ] Your GitHub profile shows you're part of kushin77 organization

---

## 8:30-8:45 AM: Slack & Communication

### Slack Setup
- [ ] Slack app is open and you're online
- [ ] Join channels:
  - [ ] #lux-auto-launch
  - [ ] #lux-auto-dev
  - [ ] #lux-auto-standup
  - [ ] #lux-auto-random

### Channel Verification
- [ ] Read the pinned message in #lux-auto-launch
- [ ] It mentions: "Phase 3 kickoff Monday 9 AM PT"
- [ ] You can type a message (test by typing "Test" and deleting it)

### Team Roster
- [ ] You can see @kushnir77 in the member list
- [ ] You can see at least 2 other team members online
- [ ] Team roster is in the #lux-auto-launch pinned messages

---

## 8:45-8:55 AM: Final Verification

### Knowledge Check
- [ ] You've read PHASE-3-LAUNCH-KICKOFF.md (at least the schedule)
- [ ] You know today's first task (should be: "Verify GitHub branch protection")
- [ ] You know what time standup is (10:30 AM PT = 30 min after kickoff starts)

### Readiness Declaration
- [ ] You feel ready to start (or you have a specific blocker listed below)
- [ ] All your tools work
- [ ] You have all access credentials

### Blocker Reporting (IF NEEDED)
If anything is RED (not working):
1. Note the exact blocker
2. Post in #lux-auto-dev right now (8:50 AM latest)
3. Mention @kushnir77
4. Include:
   - What doesn't work: ____________
   - Error message: ____________
   - What you've already tried: ____________

---

## 8:55-9:00 AM: Join Standup

### Join the Meeting
- [ ] Open Slack voice/video
- [ ] Join #lux-auto-standup exactly at 9:00 AM
- [ ] Have camera on
- [ ] Say "Hello" when you join (keep it brief)

### Meeting Link
**Slack #lux-auto-standup voice channel**
- No calendar invite needed
- Just click the voice icon in the channel
- If voice doesn't work, fall back to video in Slack

### What Happens
- [ ] 9:00-9:05 AM: Everyone joins, quick welcome
- [ ] 9:05-9:15 AM: Framework overview
- [ ] 9:15+ AM: Hands-on Phase 3 begins

---

## Troubleshooting Quick Reference

| Problem | Solution | Time To Fix |
|---------|----------|------------|
| Can't activate venv | `source venv/bin/activate` again, make sure it exists | 1 min |
| FastAPI import fails | Run `pip install -r backend/requirements.txt` again | 3 min |
| Can't clone repo | Check GitHub access, message @kushnir77 | 2 min |
| Slack won't connect | Log out/log in to Slack app | 1 min |
| Camera/audio issues | Test in Slack settings before 9 AM | 2 min |
| Timezone confusion | All times are PT, see timeanddate.com | 0 min |
| Git shows uncommitted changes | Run `git status` to see what changed, ask in Slack | 2 min |
| Don't understand first task | Read PHASE-3-LAUNCH-KICKOFF.md schedule again | 3 min |

---

## Success Profile

You are **READY TO LAUNCH** if:

✅ Git status shows "working tree clean"  
✅ You can import FastAPI without errors  
✅ You can see #lux-auto-standup channel  
✅ You have GitHub issues loaded  
✅ Camera and audio work  
✅ You're in Slack and online  

---

## Communication Plan

**If you're going to be late:**
- Message @kushnir77 in Slack **by 8:45 AM**
- No judgment, just need to know

**If you have a blocker:**
- Post in #lux-auto-dev with details
- Tag @kushnir77 if urgent
- Do NOT message privately (we want to help others too)

**If something goes wrong during launch:**
- Keep working on what you can
- Ask questions in #lux-auto-dev
- We're all learning together

---

## Phase 3 Week Overview

**Monday (Today):** GitHub branch protection setup  
**Tuesday:** CI/CD pipeline verification  
**Wednesday:** 30-min team training at 12 PM PT  
**Thursday:** Framework validation with sample PR  
**Friday:** Phase 3 completion & celebrate  

You have **the whole week** to get comfortable. Today is just start.

---

## Confidence Check

Rate yourself (be honest):
- **5/5:** My computer works, I understand the setup, I'm excited
- **4/5:** Minor issue but I'll ask for help
- **3/5:** Some confusion but I'm ready to learn
- **1-2/5:** Major blocker, need help before 9 AM

If you're at 1-2, message @kushnir77 right now.  
If you're at 3-5, you're in great shape.

---

## You're Not Alone

Every person on this team:
- [ ] Has already completed pre-work this weekend
- [ ] Has read the Phase 3 kickoff guide
- [ ] Is as nervous/excited as you are
- [ ] Is ready to help you
- [ ] Wants this to succeed together

**Welcome to the team.** Let's ship something great this week. 🚀

---

## Quick Reference: Commands to Have Ready

```bash
# Check you're on dev branch
git branch

# Pull latest changes
git pull origin dev

# Activate virtual environment
source venv/bin/activate

# Test FastAPI
python -c "from fastapi import FastAPI; print('✓ Ready')"

# See what's in issues
git log --oneline -5

# Check git status
git status
```

---

*Last updated: April 12, 2026 (pre-launch)*  
*Next update: Monday April 15 after kickoff*  

Good luck! 💪
