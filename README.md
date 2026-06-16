# Lux Auto

**A world-class auction scraper and deal-filter for exotic-car dealers and buyers/traders.**
Scan wholesale auction inventory → score against market value → filter to real deals → match to
buyers → drive the deal from spotted to sold, with near-zero manual data entry.

Built **100% native on Google Workspace + Apps Script and GoHighLevel** — runs ~$0/month, no servers.

---

## Start here

| If you want to… | Read |
|---|---|
| Know **how** we build (rules, architecture, best practices) | **[`CLAUDE.md`](CLAUDE.md)** — authoritative |
| Know **what** we're building and current status | **[`ROADMAP.md`](ROADMAP.md)** — living source of truth |
| Understand the CRM contract (fields, stages, workflows, sync) | [`LUX-CRM-AUTOMATION-BLUEPRINT.md`](LUX-CRM-AUTOMATION-BLUEPRINT.md) |
| Jump to the live tools | [`LUX-LINKS.md`](LUX-LINKS.md) / `Lux Command Center.html` |

> Any AI/automation working in this repo must follow `CLAUDE.md` and keep `ROADMAP.md` current.

## Architecture in one line

**Google = engine** (Apps Script scans, scores, filters, dedupes by VIN; Sheets/Drive/Calendar/Looker
for data, vault, scheduling, BI). **GHL = CRM/outreach** (buyer/dealer contacts, deal pipeline,
SMS/email automation). Synced API-first, idempotent, event-driven. Data feed: Manheim + exotic comps.

```
Manheim + exotic sources → [ Google engine: scan·score·filter·dedupe ] ⇄ [ GHL: CRM·pipeline·outreach ] → Looker BI
```

## The engine

Google Apps Script project in [`webapp/`](webapp/) (`Code · Api · Auth · Config · Manheim · Sheets ·
Triggers` + `CommandCenter.html`), synced with [clasp](https://github.com/google/clasp). Config lives in
Script Properties / Google Secret Manager — **never in code**. `manheim_deal_finder.py` is a reference
implementation only.

## Conventions

- **Native first.** No custom backend (FastAPI/Docker/K8s/Terraform) until native limits are hit and
  documented — see `CLAUDE.md` §2 & §13. Deferred designs live in [`docs/archive/`](docs/archive/).
- **VIN is the natural key** — everything upserts, nothing duplicates.
- **Brand rule:** user-facing surfaces are Lux Auto / Google-native; the CRM vendor is the invisible
  backend, never named to users. Secrets/IDs in `LUX-BACKEND-CONFIG.private.md` (gitignored).

## Links

Repo: https://github.com/kushin77/lux-auto · Vehicle Vault:
https://drive.google.com/drive/folders/1uU1AH7ntnGvg53IXeRWkrlPGL2pPVq_7 · Manheim:
https://developer.manheim.com/
