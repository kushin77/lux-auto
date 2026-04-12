# GitHub Branch Protection Configuration

This guide enables branch protection rules to enforce standards on the `main` branch.

## Automation Setup

Run this script in GitHub CLI to automatically configure branch protection:

```bash
#!/bin/bash
# setup-branch-protection.sh
# Configure GitHub branch protection enforcement on main branch

OWNER="kushin77"  # Change to your GitHub username/org
REPO="lux-auto"

echo "🔒 Configuring branch protection for $OWNER/$REPO/main"
echo ""

# Enable branch protection
gh api repos/$OWNER/$REPO/branches/main/protection \
  --input /dev/stdin << 'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "lint",
      "type-check",
      "test",
      "sast",
      "dependencies",
      "secrets",
      "integration",
      "build",
      "container-scan"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismissal_restrictions": {
      "users": [],
      "teams": []
    },
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 2,
    "bypass_pull_request_allowances": {
      "users": [],
      "teams": []
    }
  },
  "restrictions": {
    "users": ["kushin77"],
    "teams": [],
    "apps": []
  },
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "required_deployments": {
    "strict_required_status_checks_policy": true,
    "deployment_branch_policy": {
      "protected_branches": false,
      "custom_branch_policies": true
    }
  }
}
EOF

if [ $? -eq 0 ]; then
    echo "✅ Branch protection enabled on main branch"
    echo ""
    echo "Rules:
    ✓ Require PR before merge
    ✓ Require 2 approvals (1 from CODEOWNERS)
    ✓ Require all status checks passing
    ✓ Require conversation resolution
    ✓ Dismiss stale approvals on new commits
    ✓ Require code owner reviews
    ✓ Only @kushin77 can push directly (emergency hotfixes)
    ✓ Force pushes blocked
    ✓ Deletions blocked
    "
else
    echo "❌ Failed to enable branch protection"
    echo "Ensure you have GitHub CLI installed: gh --version"
    echo "And you're authenticated: gh auth login"
    exit 1
fi
```

**To run:**

```bash
chmod +x setup-branch-protection.sh
./setup-branch-protection.sh
```

---

## Manual Setup (GitHub UI)

If you prefer manual configuration:

### Step 1: Go to Repository Settings

- Navigate: https://github.com/{owner}/{repo}/settings/branches
- Select branch: `main`

### Step 2: Enable Protection

Check the following boxes:

```
☑ Require a pull request before merging
  ☑ Require approvals: 2
  ☑ Dismiss stale pull request approvals when new commits are pushed
  ☑ Require review from Code Owners
  ☑ Require approval of the most recent reviewers review
  
☑ Require status checks to pass before merging
  ☑ Require branches to be up to date before merging
  
  Status checks that must pass:
  ☑ lint
  ☑ type-check
  ☑ test
  ☑ sast
  ☑ dependencies
  ☑ secrets
  ☑ integration
  ☑ build
  ☑ container-scan

☑ Require conversation resolution before merging

☑ Restrict who can push to matching branches
  Allowed users: @kushin77 only
  
☐ Require linear history (optional, elite tier)

☐ Require deployments to succeed before merging (optional, if using environments)

☑ Block force pushes

☑ Block deletions
```

### Step 3: Save

Click "Save changes"

---

## Verify Configuration

```bash
# List current branch protection rules
gh api repos/kushin77/lux-auto/branches/main/protection

# You should see:
# {
#   "url": "...",
#   "required_status_checks": {
#     "strict": true,
#     "contexts": ["lint", "type-check", "test", ...]
#   },
#   "required_pull_request_reviews": {
#     "required_approving_review_count": 2
#   },
#   ...
# }
```

---

## What This Enforces

| Rule | Effect |
|------|--------|
| Require PR | No direct pushes to main (except @kushin77 for hotfixes) |
| 2 Approvals | Two separate reviewers must approve |
| CODEOWNERS Required | Reviewers must include code owners from `.github/CODEOWNERS` |
| Stale dismissal | If you push new commits, old approvals get dismissed (re-review required) |
| Status checks | All CI/CD checks (lint, tests, SAST, etc.) must pass |
| Conversation resolved | All review comments must be resolved |
| Force push blocked | Cannot rewrite history (prevents accidents) |
| Deletions blocked | Cannot delete main branch (again, accidents) |

---

## Emergency Hotfix (Admin Override)

**Only for critical production issues:**

```bash
# @kushin77 can force-push directly to main (only user allowed)
git push --force-with-lease origin fix/critical-issue:main

# This:
# ✅ Bypasses approval requirement
# ✅ Bypasses status checks (if critical and time-sensitive)
# ❌ MUST be followed by immediate code review + postmortem

# After pushing:
# 1. Create issue: "Hotfix deployed: [description]"
# 2. Within 1 hour, peer review the code
# 3. Next day, postmortem: why didn't we catch this earlier?
```

**This should be rare (< 2x per year).**

---

## Disabling Rules (Never Do This)

```bash
# This REMOVES all protection (don't do it)
gh api --method DELETE repos/kushin77/lux-auto/branches/main/protection

# Why:
# ❌ Opens door to bad commits
# ❌ Developers will "temporarily" disable, forget to re-enable
# ❌ Eventually someone merges untested code
# ❌ Production breaks at 3am
```

**Once protection is on, it stays on.**

---

## Troubleshooting

### PR Can't Merge: "Required status checks have not been successful"

**Solution:**
```bash
# Check which check is failing
gh pr checks {pr-number}

# Common causes:
# 1. Tests failing → Fix the test
# 2. Linting error → Run `black backend/`
# 3. Coverage < 90% → Add tests
# 4. SAST finding → Fix security issue
# 5. Secrets detected → Remove secret, revoke in GSM
```

### "This branch is out of date with the base branch"

**Solution:**
```bash
git fetch origin
git merge origin/main
git push
# Re-review + re-approval required (stale dismissal)
```

### "Waiting for status checks..."

**Check status:**
```bash
gh run list --repo kushin77/lux-auto
# Shows running CI jobs
```

### "Merging blocked: Code owner review required"

**Fix:**
```bash
# Request review from code owner
# Match file paths to .github/CODEOWNERS
# Example: If /auth/ changed, @code-owner-1 must review
```

---

## Maintenance

### Monthly Review

```bash
# Check for stale rules (update GitHub CLI tools)
gh version

# Verify protection still enabled
gh api repos/kushin77/lux-auto/branches/main/protection | grep "strict"
# Should return: "strict": true
```

### Updating Required Checks

When adding new CI checks:

1. Add to `.github/workflows/ci.yml` with `name: {check-name}`
2. Update branch protection:
   ```bash
   # Add to contexts array
   gh api repos/kushin77/lux-auto/branches/main/protection \
     --input /dev/stdin << 'EOF'
   { "required_status_checks": { "contexts": [..., "new-check"] } }
   EOF
   ```

---

## References

- GitHub Docs: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches
- GitHub CLI: https://cli.github.com/manual
- CODEOWNERS: [../.github/CODEOWNERS](../../.github/CODEOWNERS)
