# Team Launch FAQ
## Frequently Asked Questions Before Phase 3

All answers are here. If your question isn't listed, post in **#lux-auto-dev** on Slack.

---

## General Questions

### Q: What is the Lux-Auto framework?
**A:** An enterprise development framework that takes you from "I have an idea" to "I'm running in production" in 6 weeks. This week (Phase 3) is team onboarding and framework validation.

### Q: Why does this matter to me?
**A:** This framework is the foundation for every project we'll ship. You're learning the system once, so every future feature is faster and safer.

### Q: Who decided on this framework?
**A:** @kushnir77 with input from the architecture review board. This is proven industry practice, customized for our team.

### Q: Can we change it later?
**A:** Yes. Phase 6 includes a quarterly "Framework Evolution" where we assess and improve. This is a starting point, not permanent.

---

## Phase 3 Specific Questions

### Q: What exactly happens Monday at 9 AM?
**A:** We meet in Slack voice, say hello, then you verify GitHub branch protection is set up. It's hands-on and takes about 1-2 hours.

### Q: Do I need to know how to code to participate?
**A:** Not for Phase 3. If you're DevOps, you'll verify infrastructure. If you're a PM, you'll track issues. Developers will code. Everyone learns.

### Q: What if I make a mistake during Phase 3?
**A:** Good news: Phase 3 is on the dev branch, not production. Mistakes are learning opportunities. We catch everything before Friday.

### Q: Will there be meetings every day this week?
**A:** Standups daily (10:30 AM PT, 15 min). Main work 9 AM - 1 PM, then 2 PM - 5 PM. You have breaks and can flex your schedule within those windows.

### Q: Can I work from anywhere?
**A:** Yes, as long as you have internet and can join Slack voice. Time zone is PT (Pacific Time). Convert yours if needed.

---

## Setup Questions

### Q: I don't have Python 3.10 installed. What do I do?
**A:** Install it:
- **macOS:** `brew install python@3.10`
- **Windows:** Visit https://python.org and download 3.10+
- **Linux:** `apt-get install python3.10` or equivalent
- Message @kushnir77 if stuck

### Q: Can I use Python 3.11 or 3.12?
**A:** Yes! We require 3.10+, so anything newer works.

### Q: I'll clone the repo but get permission denied. Why?
**A:** You don't have GitHub access yet. Message @kushnir77: "I can't clone lux-auto. GitHub access issue?"

### Q: My virtual environment won't activate. Help?
**A:** Try this:
```bash
# Delete the old one
rm -rf venv

# Create fresh
python -m venv venv

# Activate (use YOUR OS command)
source venv/bin/activate  # macOS/Linux
.\venv\Scripts\Activate.ps1  # Windows PowerShell
```

### Q: The dependencies won't install. Error message is ugly.
**A:** Copy the full error and post in #lux-auto-dev. We'll debug together. This is common.

### Q: Do I need Docker installed?
**A:** Not required for Phase 3. Nice to have, but you can work around it. We'll use Docker in Phase 4.

### Q: My company has a proxy/firewall. Will that block things?
**A:** Possibly. Test now: Can you reach github.com and pypi.org? If no, contact your IT team before Monday.

---

## GitHub & Issue Tracking

### Q: What's the difference between `main` and `dev` branches?
**A:** 
- **dev:** Where we work (Phase 3-4). Gets tested before production.
- **main:** Production code only. Locked down, requires approvals.

### Q: Do I need to write my own GitHub issues?
**A:** No. We've created all Phase 3 issues already. Your job is to complete them.

### Q: What's a PR (Pull Request)?
**A:** Your way of saying "here's code, please review it." You'll make your first PR on Thursday of Phase 3.

### Q: How many approvals do I need before merging?
**A:** 
- On **dev:** 1 approval
- On **main:** 2 approvals
We'll explain the difference on Tuesday.

### Q: What if I mess up a commit message?
**A:** No big deal. We can fix it before Friday. Ask in #lux-auto-dev.

---

## Code Quality & Testing

### Q: What does "90% coverage" mean?
**A:** Of every 100 lines of code you write, 90 should be tested by auto tests. It keeps bugs out.

### Q: Do I need to write tests myself?
**A:** Yes, if you're a developer. Week 1 you'll learn how. DevOps/PMs won't write code tests.

### Q: What's a "pre-commit hook"?
**A:** Magic that runs before you commit. It checks your code is clean. If it fails, the commit won't go through until you fix it.

### Q: Will the linter complain about my code?
**A:** Yes! That's the point. We use Black (formatter), Ruff (linter), MyPy (type checker). They're automated boring stuff so you can focus on logic.

### Q: Can I disable the linter?
**A:** Not recommended, but you can ask @kushnir77. Better to learn the standards now.

---

## Slack & Communication

### Q: How do I ask questions during the week?
**A:** Post in #lux-auto-dev. Someone will answer within 30 min. Or ask in standup at 10:30 AM.

### Q: What if my question is embarrassing or newbie-level?
**A:** Everyone asks. We all learned once. No judgment, we want you to win.

### Q: Can I DM @kushnir77 directly?
**A:** Only for urgent blockers (repo access, can't start work). Use channels for everything else so others learn too.

### Q: What's the standup for?
**A:** You say: (1) what you did yesterday, (2) what you're doing today, (3) any blockers. Takes 1-2 min per person, 15 min total.

### Q: I'm in a different timezone. What time is 9 AM PT for me?
**A:** Check https://www.timeanddate.com/worldclock/
- PT (Pacific) is UTC-7 right now
- 9 AM PT = 12 PM ET, 5 PM UTC, etc.

---

## Work & Schedule

### Q: Do I have to be online the entire 8 hours?
**A:** No. Standup is required (10:30 AM). The rest is flexible within work windows (9-1 PM, 2-5 PM). Work your style.

### Q: What if I can't make a standup?
**A:** Post update in #lux-auto-dev before, no stress.

### Q: Can I work late/weekends?
**A:** Not expected. Keep work-life balance. Framework is designed so you can ship in 5 days. Don't burn out.

### Q: Will there be lunch break?
**A:** Yes! 1-2 PM is built in. Use it.

### Q: What if Phase 3 work takes longer than the week?
**A:** We'll extend. Never compress quality. Talk to @kushnir77 if you're stuck.

---

## Next Phases

### Q: What happens after Friday?
**A:** You'll have a 1-week break (April 20-21), then Phase 4 starts Monday April 22.

### Q: What's Phase 4?
**A:** First feature through the complete pipeline. You'll ship something real.

### Q: Do I have to participate in all 6 phases?
**A:** Depends on your role:
- **Developers:** Yes, all 6 phases
- **DevOps:** Phases 2, 3, 5, 6 heavily; 4 lightly
- **PMs:** All 6 phases (different tasks each)
- **QA:** Phases 3-6 heavily

### Q: Can I leave during Phase 3 if I don't like it?
**A:** Of course. No one is forced. But we built this to work. Give it a fair week before deciding.

---

## Logistics

### Q: Where do I find all the documents?
**A:** In the repository root. Start with [INDEX.md](INDEX.md). All documents are organized there.

### Q: How do I download the documents to read offline?
**A:** 
```bash
# Clone the repo
git clone https://github.com/kushin77/lux-auto.git

# All .md files are ready to open
# Open any .md file in your text editor
```

### Q: Can I print the documents?
**A:** Yes. They're written for that. Use the "Print to PDF" feature in your browser for best formatting.

### Q: Will there be screen recordings for async viewing?
**A:** Yes. We'll record standup and key sessions. Posted in Slack channel #lux-auto-recordings.

### Q: What if I have a personal emergency and miss 1-2 days?
**A:** Message @kushnir77 ASAP. We'll adjust. Life happens.

---

## Blockers & Problems

### Q: I have a blocker RIGHT NOW (before Monday). Who do I contact?
**A:** Message @kushnir77 on Slack with:
- What doesn't work
- What error you see
- What you've tried

Be specific. We'll unblock you by Sunday.

### Q: What if tests fail on my computer?
**A:** This is expected first time. We'll debug together during Phase 3.

### Q: What if I can't understand the code?
**A:** Totally normal. That's what Phase 3 training is for. You'll get there.

### Q: What if the framework doesn't work for our team?
**A:** We collect feedback Fridays. Iterate the framework in Phase 6. This is v1, not perfect.

---

## Success & Celebration

### Q: How do I know if I'm doing it right?
**A:** You know Phase 3 succeeded when:
1. You can commit code to dev without errors
2. You made at least one PR
3. You understand branch protection
4. You saw CI/CD pipeline work

### Q: What if I'm slower than others?
**A:** Everyone learns at different pace. Measure your progress against Day 1 you, not against others.

### Q: Is it okay to help other team members?
**A:** YES! That's encouraged. Helping others deepens your own understanding.

### Q: Will we celebrate completing Phase 3?
**A:** Absolutely! Friday afternoon we'll do a team retrospective and celebration. You've earned it.

---

## Still Have Questions?

**Before Monday:**
- Post in #lux-auto-dev
- Message @kushnir77
- Response within 4 hours guaranteed

**During Monday-Friday:**
- Ask in daily standup (10:30 AM)
- Post in #lux-auto-dev anytime
- Ask in #lux-auto-random for non-urgent stuff

**After Friday:**
- We'll have a retrospective. Bring all feedback.

---

## One More Thing

You're about to join a team that cares about quality, learning, and shipping fast. We built this framework so that:
- You don't have to invent everything from scratch
- Code quality is automatic, not stressful
- Bugs are caught before production
- Everyone knows the playbook

Trust the system. Help your teammates. Ask questions. You're going to do great.

**See you Monday at 9 AM PT!** 🚀

---

*Last updated: April 12, 2026*  
*Next update: Phase 3 complete (April 19, 2026)*
