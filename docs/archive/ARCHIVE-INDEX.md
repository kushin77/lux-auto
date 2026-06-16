# Archive Index

These documents were the project's working notes during the earlier **FastAPI/Docker/Cloud-Run +
"AutoArb" enterprise** phase and the launch run-up. They were **consolidated on 2026-06-16** when the
project went **Google + GHL native**.

**They are reference-only and superseded.** The canonical docs now live at the repo root:
- [`../../CLAUDE.md`](../../CLAUDE.md) — how we work (authoritative)
- [`../../ROADMAP.md`](../../ROADMAP.md) — what we're doing (living source of truth)
- [`../../LUX-CRM-AUTOMATION-BLUEPRINT.md`](../../LUX-CRM-AUTOMATION-BLUEPRINT.md) — GHL contract

Nothing here is deleted — everything is recoverable via git history. **Do not treat these as current.**
The enterprise stack described in several of them is **deferred** until native limits are hit and
signed off (CLAUDE.md §13).

| Folder | What's inside | Count |
|---|---|---|
| `phases/` | Point-in-time PHASE 1–6 plans, trackers, kickoffs, transitions | 40 |
| `deployment-launch/` | Deployment / go-live / launch-day / pre-launch checklists & notices | 35 |
| `status-summaries/` | "Complete"/"Final"/status/framework/implementation snapshots | 20 |
| `enterprise-stack/` | FastAPI · Docker · Terraform/IaC · monitoring · security-hardening · Appsmith/Backstage · testing · API spec | 19 |
| `guides/` | Old onboarding/admin/user/dev guides, SSO `.instructions.md`, doc indexes, project plans | 19 |
| `github-issues/` | GitHub issue trackers/mandates (superseded by ROADMAP) | 10 |
| `autoarb/` | The "AutoArb" enterprise PRD + Terraform + agent graph (deferred vision) | 3 |

> Code directories from the deferred stack (`backend/`, `terraform/`, `monitoring/`, `appsmith/`,
> `backstage/`, the `docker-compose*.yml`, `deploy-*` scripts, `fastapi_backend.py`) remain in place at
> root for now but are **deferred / reference-only** under the native directive. Promote them only per
> CLAUDE.md §13.
