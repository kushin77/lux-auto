# CLAUDE.md — Lux Auto Project Instructions

> **Read this file first, every session.** It is the single source of authority for how
> work is done on Lux Auto. `ROADMAP.md` is the single source of truth for *what* is being
> done. If anything elsewhere in the repo (older docs, the generic agent persona in
> `claude_md.txt`/`memory_md.txt`, archived plans) contradicts this file, **this file wins.**

**Last updated:** 2026-06-16 · **Owner:** Alex (kushin77) · **Repo:** https://github.com/kushin77/lux-auto

---

## 1. What Lux Auto Is

Lux Auto is a **world-class auction scraper and deal-filter for exotic-car dealers and buyers/traders.**
It scans wholesale auction inventory, scores each listing against market value, filters to genuine
deals, matches them to buyers, and drives the deal from "spotted" to "sold" — with as close to zero
manual data entry as possible.

**Core loop:** `Scan → Score → Filter → Match to buyer → Outreach → Track to close → Learn`

**Who it serves**
- **Dealers / acquisition buyers** — find underpriced exotics, decide max bid, never miss a hot lane.
- **Buyers / traders / wholesalers** — get matched, ranked deals pushed to them the moment they surface.

**What "world-class" means here:** sub-minute scan-to-alert, zero duplicate deals (VIN is the natural
key), exotic-grade scoring, and a fully automated CRM pipeline — all built on tools that cost ~$0/month
to run.

---

## 2. Prime Directive — Google + GHL Native Only

**Everything is built natively on Google Workspace + Apps Script and GoHighLevel (GHL). Do not
introduce custom backend infrastructure until native capabilities are genuinely exhausted.**

This is a deliberate, current decision (see commit `feat: go native — GAS + GHL + Sheets, remove
GCP/Cloud Run`). It overrides the generic "sovereign / self-hosted / air-gapped" persona in
`claude_md.txt` and `memory_md.txt`, which applies to Alex's *other* products, **not** Lux Auto.

**✅ In-scope (build with these):**
- Google Apps Script (V8), Google Sheets, Google Drive, Google Calendar, Gmail, Google Chat,
  Google Forms, Looker Studio.
- GoHighLevel: v2 API, Workflows, Opportunities (deals), Contacts (buyers), Pipelines, custom fields.
- Manheim APIs + exotic data sources (§5) as the data feed.

**⛔ Out-of-scope until native is exhausted (do NOT add without explicit approval):**
- FastAPI / custom Python services, Docker / docker-compose, Kubernetes, Terraform, Caddy,
  oauth2-proxy, PostgreSQL/Redis/Kafka/ClickHouse, Cloud Run / GKE, the "AutoArb" Go stack.

These were prototyped earlier and are **deferred**, not deleted — they live in `docs/archive/` as the
future "enterprise scale" tier. See §13 *Graduation Criteria* for when (and only when) we revisit them.

**Before reaching for anything out-of-scope, ask:** *Can Apps Script + Sheets + Drive + GHL do this?*
The answer is almost always yes. If you believe it genuinely cannot, stop and flag it to Alex with the
specific native limit you hit (e.g., Apps Script 6-min execution cap, GHL API rate limit) rather than
silently adding infrastructure.

---

## 3. Architecture — Google = Engine, GHL = CRM/Outreach

Two systems, one clean seam. Keep the boundary crisp.

```
   Manheim + exotic sources
            │  (data)
            ▼
 ┌──────────────────────────┐        upsert by VIN (GHL v2 API)
 │  GOOGLE = ENGINE         │ ───────────────────────────────────▶ ┌────────────────────────┐
 │  Apps Script · Sheets    │                                       │  GHL = CRM / OUTREACH  │
 │  Drive · Calendar · Gmail│ ◀─────────────────────────────────── │  Opportunities (deals) │
 │  scan · score · filter   │        webhooks (stage changes)       │  Contacts (buyers)     │
 │  dedupe · vault · BI      │                                       │  Workflows · SMS/email │
 └──────────────────────────┘                                       └────────────────────────┘
            │                                                                   │
       Looker Studio  ◀───────────────── reporting / KPIs ──────────────────────┘
```

| Responsibility | Owner | Notes |
|---|---|---|
| Auction scraping / API calls | **Google (Apps Script)** | `webapp/Manheim.gs` etc. |
| Deal scoring & exotic filter | **Google** | Scoring engine; VIN-keyed |
| Dedupe (VIN natural key) | **Google** | Upsert, never duplicate |
| Vehicle document vault | **Google Drive** | Folder per VIN |
| Auction calendar / reminders | **Google Calendar** | Per-deal events |
| Analytics / BI dashboards | **Google Sheets → Looker Studio** | Win rate, margin, DOM |
| Buyer & dealer CRM | **GHL** | Contacts = buyers |
| Deal pipeline (Spotted→Sold) | **GHL** | Pipeline *Lux Auto — Acquisitions*, 8 stages |
| Outreach (SMS / email / nurture) | **GHL** | Workflows, templated, deduped |
| Stage automations & SLAs | **GHL Workflows** | Thin; call back to engine for heavy logic |

**The seam rule:** the engine owns *truth about vehicles and scores*; GHL owns *truth about people and
the deal lifecycle*. Sync is **API-first, idempotent, upsert-by-VIN, event-driven both ways.** Keep GHL
workflows thin — heavy scoring/matching stays in the engine where it's testable. Full contract:
`LUX-CRM-AUTOMATION-BLUEPRINT.md`.

---

## 4. Brand Rule (non-negotiable)

**User-facing surfaces are "Lux Auto" and look Google-native. The CRM vendor (GHL) is the invisible
backend and is NEVER named in any user-facing UI, email, document, or client-facing copy.**

- Internal/technical docs (this file, the blueprint, code comments) may name GHL freely.
- Client-facing copy says "the CRM," "the pipeline," or just "Lux Auto."
- Secrets, tokens, sub-account and location IDs live **only** in `LUX-BACKEND-CONFIG.private.md`
  (gitignored, internal). Do not hardcode them in committed files or paste them into user-facing output.

---

## 5. Data Sources — Exotic-Focused

Primary today, exotic specialists on the roadmap. Build the source layer behind a small abstraction so
a new source is a plug-in, not a rewrite.

| Source | Role | Status |
|---|---|---|
| **Manheim** (ISWS / Vehicle / Valuation/MMR) | Primary wholesale feed + MMR value | **Live** — `webapp/Manheim.gs`, ref `manheim_deal_finder.py` |
| Bring a Trailer (results) | Sold comps for rare exotics where MMR has 0 samples | Planned |
| Cars & Bids (results) | Modern performance-car comps | Planned |
| Hagerty Valuation | Industry-standard classic/exotic values | Planned |
| RM Sotheby's / collector results | High-end / collector comps | Planned (backlog) |

**Exotic scoring rules of thumb** (current engine): exotic makes auto-detected (Ferrari, Lamborghini,
Porsche, McLaren, Bentley, Rolls-Royce, Maserati, Aston Martin, Bugatti, etc.); exotic mileage curve
(<2k mi = big bonus); rarity multiplier for the rarest makes; exotics are surfaced even at/near market
(no 15%-below-MMR gate that mass-market requires). Recommended max bid ≈ `MMR × 0.92`.

---

## 6. Repository Map

```
lux-auto/
├── CLAUDE.md                         ← you are here (HOW we work — authoritative)
├── ROADMAP.md                        ← WHAT we're doing (single source of truth, kept current)
├── README.md                         ← short Google-native overview, points here
├── LUX-LINKS.md                      ← quick links hub
├── LUX-CRM-AUTOMATION-BLUEPRINT.md   ← GHL contract: fields, stages, workflows, sync
├── LUX-BACKEND-CONFIG.private.md     ← secrets/IDs (gitignored, internal only)
├── Lux Command Center.html           ← one-click ops hub
├── webapp/                           ← THE ENGINE (Google Apps Script, clasp-synced)
│   ├── Code.gs        ← entry points / doGet / menu
│   ├── Api.gs         ← API surface for dashboard + mobile
│   ├── Manheim.gs     ← Manheim auth + scan + MMR
│   ├── Sheets.gs      ← sheet setup + batch read/write
│   ├── Auth.gs        ← auth/session helpers
│   ├── Config.gs      ← Script Properties / config
│   ├── Triggers.gs    ← time-driven triggers (scan, sync, daily digest)
│   ├── Notify.gs      ← daily digest (Gmail + optional Google Chat)
│   └── CommandCenter.html ← dashboard UI
├── appsscript.json                   ← GAS manifest (scopes, timezone, webapp access)
├── docs/
│   └── archive/                      ← superseded/legacy docs (see ARCHIVE-INDEX.md)
└── manheim_deal_finder.py            ← Python REFERENCE implementation of scoring (not the prod path)
```

> The production engine is `webapp/*.gs`. Python files (`manheim_deal_finder.py`, the old `backend/`)
> are **reference only** under the native directive — port logic *into* Apps Script, don't run the
> Python service. Some advanced modules described in `ROADMAP.md` (Pipeline, Analytics, Vault,
> Calendar, Chat, Waitlist, Mobile) may exist in the live Apps Script project but not yet be committed
> here — when you touch them, `clasp pull` and commit so the repo stays the source of truth.

---

## 7. Engineering Best Practices

**Apps Script / JavaScript (the engine)**
- **Idempotent, upsert-by-VIN.** VIN is the natural key everywhere. Re-scans must never create
  duplicates — update in place.
- **Batch all Sheet I/O.** Use `getRange().setValues()` / `getValues()`; never loop cell-by-cell.
- **Cache aggressively.** `CacheService` for MMR per VIN (≈6h) to cut Manheim calls ~80%. Respect the
  6-minute execution limit — chunk long jobs across triggers / continuation tokens.
- **Config in Script Properties**, never in code (`MANHEIM_CLIENT_ID/SECRET`, webhook URLs, GHL token).
- **Rate-limit politely.** Backoff on 429 for both Manheim and GHL; batch GHL upserts.
- **Fail loud, log structured.** Wrap external calls in try/catch, log to a System Log sheet +
  Stackdriver (manifest already routes exceptions there). Never swallow errors silently.
- **Pure, small functions** with a clear single responsibility; keep files modular (one concern each).

**GHL**
- **API-first, not UI-first.** Create/update fields, stages, and deals via the v2 API so the whole
  setup is reproducible and version-noted in this repo. Manual UI work is for exceptions only.
- **Workflows stay thin.** Branch on structured fields (`lux_score`, `lux_margin`); push heavy logic to
  the engine via webhook. Use the tag taxonomy (`lux:hot`, `lux:matched`, `lux:at-risk`,
  `lux:arbitration`) — never free-text tags.
- For workflow debugging, the **`ghl-workflow-debugger`** skill drives the GHL builder in-browser.

**General**
- Production-ready over scaffolding — finish the file, include error handling and logging.
- Match existing style in `webapp/`. Comment non-obvious config heavily.
- Small, reviewable commits; conventional messages (`feat:`, `fix:`, `chore:`, `docs:`). Branch protection is on `main`.

---

## 8. Security & Secrets

- **Zero credentials in code or committed files.** Engine secrets → Apps Script **Script Properties**;
  shared/server secrets → **Google Secret Manager** project `lux-auto`
  (`lux-ghl-api-token`, `MANHEIM_CLIENT_ID/SECRET`, etc.). IDs/tokens reference only
  `LUX-BACKEND-CONFIG.private.md`.
- **Least privilege.** Keep `appsscript.json` OAuth scopes minimal; add a scope only when a feature
  needs it. Mirror RBAC intent (Viewer / Analyst / Admin) onto GHL permissions.
- **Rotate** the GHL token quarterly. **Audit** every state-changing automation (who/what/when).
- **PII = buyer contacts.** Access-controlled, exportable on request, archive Sold/Passed after 90 days.
- Never paste secrets, the GHL location ID, or buyer PII into chat output or user-facing files.

---

## 9. ⭐ The Every-Session Protocol (keep the roadmap alive)

**This is the rule that makes "all future prompts follow these instructions" real. Do it every session
on Lux Auto, without being asked:**

1. **Start:** read `CLAUDE.md` (this file) and `ROADMAP.md` before acting. Honor the Prime Directive (§2).
2. **During:** when you start a roadmap item, mark it 🔄 in `ROADMAP.md`; when you finish one, mark it ✅
   with the date. New work discovered → add it as a task in the right phase/backlog **before** doing it.
3. **End of every session, update `ROADMAP.md`:**
   - Flip statuses for anything started/finished.
   - Add any new tasks, risks, or decisions.
   - Bump **"Last reviewed"** to today's date and add a one-line **Changelog** entry.
4. **Never** let code change without the roadmap reflecting it. The roadmap is the contract; drift is a bug.

A weekly scheduled task ("Lux Auto — Weekly Roadmap Check," Mondays) audits this automatically, but the
per-session discipline above is primary.

---

## 10. Documentation Hierarchy (avoid doc sprawl)

The repo previously accumulated ~150 overlapping planning docs. The canonical set is now small:

| Doc | Purpose | Status |
|---|---|---|
| `CLAUDE.md` | How we work (authoritative) | **Canonical** |
| `ROADMAP.md` | What we're doing (living) | **Canonical** |
| `LUX-CRM-AUTOMATION-BLUEPRINT.md` | GHL contract (fields/stages/workflows/sync) | **Canonical** |
| `LUX-LINKS.md` / `Lux Command Center.html` | Quick links / ops hub | Active |
| `README.md` | Short public overview | Active |
| `docs/archive/**` | Superseded plans + deferred enterprise stack | **Reference only** |

**Do not create new top-level status/phase/summary docs.** Update `ROADMAP.md` instead. If a doc is
genuinely needed, put it under `docs/` and link it from here.

---

## 11. Definition of Done (quality bar)

A change is "done" only when:
- It runs natively (Apps Script / Sheets / Drive / GHL) within free-tier limits.
- It's idempotent and VIN-deduped where it touches deals.
- Secrets are externalized; no credentials or GHL identity in committed/user-facing output.
- Errors are handled and logged; the happy path and the failure path both behave.
- The brand rule holds (GHL never surfaces to users).
- `ROADMAP.md` is updated (status + changelog) per §9.
- For GHL/workflow changes: verified in the builder (diff confirmed before Save/Publish).

---

## 12. Future-Proofing Principles

- **API-first everything** → the CRM and engine can be rebuilt or migrated from code; no lock-in to
  hand-clicked config.
- **Event-driven seam** → add consumers (BI, AI, SMS, new buyers) without touching the core loop.
- **Source abstraction** → adding ADESA/ACV/BaT/Hagerty is a plug-in behind a common listing shape.
- **Multi-location / white-label ready** → the same engine + blueprint deploys to a new GHL sub-account
  by swapping the location ID + token (kept in the private config).
- **AI augmentation plugs into the engine, not the CRM** → recon-cost-from-photos, score-model upgrades
  with condition-report data, Claude-drafted negotiation emails.
- **DR/backup** → nightly export of deals/contacts; the Sheet *is* durable storage; vault in Drive.

### 13. Graduation Criteria — when (and only when) to revisit the heavy stack
Promote a capability out of `docs/archive/` to a real backend **only** when a specific native ceiling is
hit and documented, e.g.:
- Apps Script execution/quota limits block required scan volume *after* caching + chunking, **or**
- Concurrent multi-user needs exceed what Sheets/GHL can serve, **or**
- A paid Manheim integration (Simulcast/OVE/Ready Logistics) needs a server-side webhook handler GHL
  can't host.

When that happens: write the limit + evidence into `ROADMAP.md`, get Alex's sign-off, then lift the
relevant `docs/archive/` design (FastAPI/Cloud Run/Terraform) as the "enterprise scale" tier. Until
then, the answer is native.

---

## 14. Glossary

- **MMR** — Manheim Market Report; wholesale benchmark value for a VIN at a mileage.
- **VIN** — vehicle ID; the natural key for dedupe/upsert across engine + GHL.
- **ISWS** — Manheim Inventory Search Web Service (presale listings API).
- **CR / Condition Grade** — Manheim condition report / 1.0–5.0 grade.
- **Lane / Run #** — physical auction lane and run order.
- **Deal score** — 0–100; higher = better deal (discount depth + condition + mileage + rarity).
- **Opportunity** — a deal record in GHL. **Contact** — a buyer in GHL.
- **DOM** — days on market. **Co-wholesale** — pre-selling a deal to buyers before committing capital.

---

## 15. Key Links & IDs

- **Repo:** https://github.com/kushin77/lux-auto
- **Vehicle Vault (Drive):** https://drive.google.com/drive/folders/1uU1AH7ntnGvg53IXeRWkrlPGL2pPVq_7
- **Manheim Developer:** https://developer.manheim.com/
- **GHL contract:** `LUX-CRM-AUTOMATION-BLUEPRINT.md` · **Links hub:** `LUX-LINKS.md`
- **Backend IDs / tokens:** `LUX-BACKEND-CONFIG.private.md` (internal only — never echo)

---

## Changelog
- **2026-06-16 (session 2)** — Engine hardening: added `webapp/Notify.gs` (daily digest); implemented
  VIN-deduped batched alert upsert, exotic no-gate scoring + rarity/mileage curve + max-bid, per-VIN
  MMR cache, 429/5xx backoff, `logError_`/System Log, and engine→GHL upsert-by-VIN. See `ROADMAP.md`.
- **2026-06-16** — Created CLAUDE.md as the authoritative project instructions. Locked the Google + GHL
  native directive, engine/CRM split, brand rule, every-session roadmap protocol, and graduation
  criteria. Consolidated docs (see `docs/archive/ARCHIVE-INDEX.md`).
