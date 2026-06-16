# Monday April 15 Launch Day Checklist
## Quick Reference for Seamless Kickoff (Print & Post)

**Date:** Monday, April 15, 2026  
**Kickoff Time:** 9:00 AM PT (SHARP)  
**Owner:** Program Lead / Tech Lead  
**Duration:** 4 hours (9 AM - 1 PM PT)  

**Print this out and post in meeting room Friday afternoon.**

---

## PRE-KICKOFF VERIFICATION (By 8:30 AM PT)

### DevOps/SRE: Infrastructure Checklist
- [ ] Prometheus dashboard is responding (all green)
- [ ] Grafana dashboards loading without errors
- [ ] AlertManager is receiving test alerts
- [ ] Staging environment is healthy (test deploy if unsure)
- [ ] GitHub Actions CI/CD pipeline is green
- [ ] Docker registry is accessible
- [ ] All team members have repository access (verify 3 random members)
- [ ] Slack integration with GitHub is working (test by creating fake issue)

**Issue If Any Box Red:** Call DevOps immediately (not during kickoff)

---

### Tech Lead: Team Readiness Checklist
- [ ] All 8 team members have confirmed they're attending (Slack or email)
- [ ] 8/8 team members have completed pre-work (spot check 3 members)
- [ ] Meeting room is set up (chairs, projector, whiteboard)
- [ ] Zoom link is working (test screen share 10 min before start)
- [ ] WiFi is stable (test with laptop download)
- [ ] All laptops in room have GitHub access (test with 1 team member)
- [ ] CONTRIBUTING.md and QUICK-REFERENCE.md are printed/bookmarked
- [ ] First 4 GitHub Phase 3 issues are reviewed and ready to assign

**Issue If Any Box Red:** Address now, don't wait for kickoff

---

### Program Lead: Logistics Checklist
- [ ] Executive Sponsor confirmed attending (check 5 min before start)
- [ ] All leadership reviewers are on Zoom/present
- [ ] Slack #lux-auto-main is monitored (have phone ready)
- [ ] Communication sent: "Launch approved ✅ - See you in 60 minutes" (8:00 AM)
- [ ] Coffee/water available in meeting room
- [ ] Celebration note prepared (1-2 sentences for Friday end-of-day)
- [ ] Phase 4 preview document is ready (for Friday discussion)
- [ ] Attendance tracker is open (for sign-in at 8:55 AM)

**Issue If Any Box Red:** Note it, continue anyway (not blocking)

---

## 8:55 AM PT: TEAM ARRIVAL (5 MINUTES BEFORE START)

### Greeting & Sign-In
- [ ] All 8 team members have arrived in room
- [ ] Mark arrival time in tracker
- [ ] Greet each person individually (sets tone)
- [ ] Hand out printed materials

### Quick Tech Prep
- [ ] Verify Zoom is recording (if remote attendees)
- [ ] Test projector with opening slide
- [ ] Have GitHub repo open on big screen
- [ ] Have CONTRIBUTING.md ready to share screen
- [ ] Slack on phone for real-time issues

---

## 9:00 AM PT: KICKOFF BEGINS

### Block 1: Welcome & Ceremony (0:00-0:15 | 15 min)

**Facilitator:** Executive Sponsor (or Program Lead if exec unavailable)

**Script:**
```
"Good morning everyone! Welcome to the Lux-Auto Framework Phase 3 kickoff.

We've spent months designing this. Today is where the design becomes reality.

This week, we will:
1. Learn how to ship code safely
2. Practice our standards together
3. Complete 4 real features
4. Agree on how we work together going forward

By Friday, you will have:
- Deep understanding of code quality
- Real experience with our CI/CD pipeline
- Confidence that you can ship good code
- Trust in each other and the process

Let's begin."
```

**During this block:**
- [ ] Executive Sponsor delivers opening remarks (keep to 5 min)
- [ ] Program Lead does welcome & framework overview (10 min)
- [ ] Team takes 30-second water/restroom break (soft transition)

**Checkpoint:** Look for team energy level. Should be curious, not anxious.

---

### Block 2: Framework Overview (0:15-1:00 | 45 min)

**Facilitator:** Program Lead

**Agenda:**
- [ ] 0:15-0:20: 6 phases overview (visual timeline on screen)
- [ ] 0:20-0:30: Phase 3 week structure (Mon-Fri what we're learning)
- [ ] 0:30-0:40: Success metrics (what does "winning" look like Friday)
- [ ] 0:40-0:50: Code quality standards (90% coverage, 2 approvals, testing)
- [ ] 0:50-1:00: Q&A (take any questions)

**Materials to share on screen:**
- [ ] QUICK-REFERENCE.md (project overview)
- [ ] PHASE-3-LAUNCH-KICKOFF.md (this week's plan)
- [ ] CONTRIBUTING.md (code standards)

**Talking points (print and have with you):**
- "Today is slow and careful. We're learning, not shipping."
- "By Friday, we'll ship. But today is about the foundation."
- "If something is unclear, ask. No stupid questions. Ever."
- "You have each other and you have leadership support. You're not alone."

**Checkpoint:** Can team answer "What are the 6 phases?" and "What does Phase 3 look like?"

---

### Block 3: Technical Setup Verification (1:00-2:00 | 60 min)

**Facilitator:** Tech Lead (supported by DevOps for infrastructure questions)

**Agenda:**
- [ ] 1:00-1:10: Local environment check (hand raise if you have issues)
- [ ] 1:10-1:20: GitHub access verification (try to clone a test repo)
- [ ] 1:20-1:30: Git workflow walkthrough (how branches work, commit process)
- [ ] 1:30-1:45: Code quality tools demo (show Black, Ruff, MyPy running)
- [ ] 1:45-2:00: First task walkthrough (what's Issue #21 and how to start it)

**Live demo to show team:**
- [ ] Clone repository on your laptop
- [ ] Create a test branch
- [ ] Make a code change
- [ ] Run Black/Ruff locally
- [ ] Commit and push
- [ ] Show CI/CD pipeline running on GitHub
- [ ] Explain what each stage checks

**Checkpoint:** Every team member can clone the repo by 2:00 PM. If not, help individually after kickoff.

---

### Block 4: First Task & Hands-On (2:00-4:00 PM | 120 min)

**Facilitator:** Tech Lead (with pair programming as-needed)

**Agenda:**
- [ ] 2:00-2:10: Task assignment & context (what you're building, why it matters)
- [ ] 2:10-2:30: Hands-on setup (everyone clones, creates branch, opens editor)
- [ ] 2:30-3:30: Independent work (team works on Issue #21, tech lead circulates helping)
- [ ] 3:30-3:50: Code review walkthrough (show how to request review, what reviewer checks)
- [ ] 3:50-4:00: Wrap-up & early wins (celebrate what's done, discuss what's next)

**Success Criteria for 4 PM:**
- [ ] 8/8 team members have initial code pushed to a branch
- [ ] 2+ code reviews requested (team reviewing each other)
- [ ] 0 panic, 100% confidence people know how to continue tomorrow
- [ ] Energy is positive (tired but energized)

**Checkpoint:** By 4 PM, team has:
- Cloned repo ✓
- Created branch ✓
- Made code change ✓
- Requested code review ✓
- Understands next steps ✓

---

## ISSUE RESOLUTION DURING KICKOFF

### If someone's laptop doesn't have Python
**Solution:** Don't fix live. Note on tracker. Tech lead helps after kickoff (not urgent).

### If GitHub access is broken
**Solution:** Call DevOps immediately (5 min fix). Meanwhile, that person shadows a partner.

### If projector dies
**Solution:** Share screen via Zoom or read from screen on your laptop. Keep going.

### If Zoom drops
**Solution:** Restart, get link from Slack. 2 min delay. Continue.

### If someone is totally lost
**Solution:** Have them pair with someone confident. Keep group momentum. Help after.

**General principle:** Small issues don't stop the group. Pair that person with a buddy and keep going.

---

## 4:00 PM: KICKOFF COMPLETE

### Closing Message (from Program Lead)

```
"Great work today, everyone. 

You learned a ton. You proved you can work the framework.
Tomorrow we go deeper. Monday you're shipping real features.

Tonight: Rest. Eat. Sleep well.
Tomorrow 10 AM: Daily standup (15 min, routine check-in)

Any final questions?"

[Take 2-3 questions, keep it light]

"See you tomorrow. Welcome to the team."
```

---

## IMMEDIATE POST-KICKOFF (4:00-5:30 PM)

- [ ] Tech Lead: Help any team members still struggling with env setup
- [ ] Program Lead: Send Slack recap with "Day 1 Complete ✅"
- [ ] DevOps: Monitor infrastructure for any post-kickoff issues
- [ ] Leadership: Send "thank you" message to team

---

## OPTIONAL: DAY 1 TRACKING

**Record for leadership debrief Friday:**
- [ ] # of team members with working laptops at end of day: ___/8
- [ ] # of code reviews requested by 5 PM: ___
- [ ] Log of issues team encountered: [Notes section below]
- [ ] Team energy level at end (1-10): ___
- [ ] Biggest learning from Day 1: ___

**Issues Encountered (for Friday postmortem):**
```
[Record any env issues, misunderstandings, technical blockers]
[Rate severity: Low/Medium/High]
[Note how resolved]

Example:
- Issue: Python version confusion (person had 3.9, needed 3.11+)
- Severity: Low
- Resolution: Downloaded 3.12, installed post-kickoff, 30 min
- Learning: Add Python version check to pre-work script
```

---

## FINAL SUCCESS CRITERIA

✅ **Kickoff was successful if:**
- [ ] All 8 team members present and engaged
- [ ] No critical blockers (everything either working or has a plan to fix)
- [ ] Team understands what a successful Phase 3 looks like
- [ ] At least 4 people have made their first commit
- [ ] Everyone knows what tomorrow looks like (next standup, next task)
- [ ] Energy is positive (tired is ok, anxious is not ok)
- [ ] Zero team members want to quit (confidence > doubt)

---

## MONDAY EVENING: Debrief Call (5 min, Leadership only)

**Tech Lead + Program Lead + DevOps sync**

Quick discussion:
- "How did it actually go?"
- "Any surprises?"
- "Any concerns for Tuesday?"
- "Anything we need to adjust for the rest of the week?"

---

## QUICK FAQ FOR DAY 1 (if asked)

**Q: When do I start coding?**
A: Tuesday morning. Today is setup and learning. Tomorrow you work the workflow.

**Q: What if I don't finish my task by Friday?**
A: That's ok. Quality > quantity. Friday we celebrate what's done, learn what stalled.

**Q: Am I going to break production?**
A: No. Your code goes to staging first. We stage → test → review → approve. Takes time.

**Q: How much testing is actually required?**
A: 90%+ code coverage minimum. Means 9 out of 10 lines run in tests.

**Q: What if my code is bad?**
A: Code reviews exist for a reason. 2 people look at it before it ships. You learn together.

**Q: Is this going to be this detailed every week?**
A: Phase 3 is intense learning. Phase 4 picks up pace. Phase 6 you'll probably forget why Phase 3 felt so detailed. Trust the process.

---

## FOR TEAM MEMBERS: What to Bring Monday

- [ ] Laptop (charged)
- [ ] Notebook (for notes)
- [ ] Positive energy (required)
- [ ] Questions (very welcome)
- [ ] Water bottle (dehydration is real)
- [ ] Open mind (frameworks are weird until they're obvious)

---

## LAST-MINUTE REMINDERS (Friday Afternoon)

**Send this to team Friday 3 PM:**

```
☀️ ALMOST THERE!

Kickoff is Monday 9 AM PT. Just a few reminders:

✅ **Bring:**
- Charged laptop
- Notebook for notes
- Hydration
- Positive energy

✅ **Know:**
- Time: 9:00 AM PT (not 9:15, not 9:05 - be on time!)
- Location: [Meeting room] (or Zoom: [link])
- Duration: 4 hours (9 AM - 1 PM)
- No prior prep needed (you already did pre-work!)
- Questions welcome, no such thing as stupid questions

✅ **Should be ready:**
- Python 3.11+ installed
- GitHub access working
- Repository cloned
- Slack logged in (for standup updates)

❓ **Any last-minute blockers?**
Reply in thread NOW. We're here to help.

See you Monday morning. You got this! 🚀
```

---

**Printed Version Ready:** Cut and paste into printed format (2 pages, double-sided)  
**Digital Version:** Share in Slack #lux-auto-launch  
**Backup:** Email to program lead/tech lead for reference  

---

**Version:** 1.0  
**Owner:** Tech Lead / Program Lead  
**Last Updated:** April 12, 2026  
**Print Before Friday EOD:** Yes
