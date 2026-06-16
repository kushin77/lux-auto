# Lux Auto — Roadmap

> **Single source of truth for what we're building.** *How* we build is `CLAUDE.md` (read it first).
> This roadmap is **kept current every session** — see §*Maintenance* at the bottom. All work is
> **Google + GHL native** until native limits are hit and documented (CLAUDE.md §2, §13).

**Last reviewed:** 2026-06-16 (session 2) · **Owner:** Alex (kushin77) · **Mission:** world-class exotic-car
auction scraper + deal-filter for dealers and buyers/traders.

**Status legend:** ✅ done · 🔄 in progress · ⬜ planned · ⏸️ deferred (post-native) · ⚠️ needs verification

---

## Where We Are Today (honest baseline)

The project **went native** (commit `feat: go native — GAS + GHL + Sheets, remove GCP/Cloud Run`).

- **Engine (Google Apps Script):** `webapp/` — `Code · Api · Auth · Config · Manheim · Sheets ·
  Triggers · SellerPortal` + `CommandCenter.html`. Manheim OAuth + scan + MMR + exotic scoring,
  GHL read/dashboard, and full seller/buyer intake live in the engine.
- **Command Center — 5-view SPA (session 2, 2026-06-16):** Dashboard (KPIs + activity feed + quick
  actions), Pipeline (kanban + per-column value totals + move-deal for admins), Sellers (VIN decode →
  NHTSA + MMR preview card → intake form → leads list), Buyers (registration form + buyer grid),
  Market (Manheim alerts table + admin scan trigger). All views lazy-load.
- **SellerPortal.gs (session 2, 2026-06-16):** `decodeVIN` (NHTSA free API + optional Manheim MMR
  enrichment), `submitSellerLead` (GHL contact + opportunity upsert at Spotted stage), `getSellerLeads`,
  `registerBuyer` (GHL contact with buyer tags + custom fields), `getManheimAlerts`, `getActivityLog`.
- **CRM (GHL):** pipeline **Lux Auto — Acquisitions** (8 stages) is **live**; first deal logged. Custom
  field schema and workflows **designed** (`LUX-CRM-AUTOMATION-BLUEPRINT.md`) but not yet provisioned
  via API (Phase 2 work).
- **2026-06-16 code audit:** advanced modules older docs claimed (Pipeline.gs, Analytics.gs,
  VehicleVault.gs, CalendarSync.gs, ChatNotify.gs, CustomerWaitlist.gs, MobileScanner.html) are **NOT
  in the repo** — ⚠️ items confirmed not-built here. Run `clasp pull` to check the live project.
- **Top engine gaps (Phase 1):** ① VIN dedupe — Manheim alerts append-only, re-scans duplicate;
  ② exotic no-discount-gate not implemented (exotics still need 15% discount to flag); ③ no per-VIN
  MMR cache yet; ④ engine reads GHL but doesn't push deals to it (Phase 2).

---

## Phase 0 — Native Foundation ✅ (mostly complete)

| # | Task | Status |
|---|---|---|
| 0.1 | Pivot to Google + GHL native; remove GCP/Cloud Run from active path | ✅ |
| 0.2 | Apps Script engine committed (`webapp/*.gs`) | ✅ |
| 0.3 | `appsscript.json` scopes + V8 + Stackdriver logging | ✅ |
| 0.4 | Repo hygiene: `.gitignore`, pre-commit, CI for webapp | ✅ |
| 0.5 | Authoritative `CLAUDE.md` + consolidated `ROADMAP.md` | ✅ 2026-06-16 |
| 0.8 | `SellerPortal.gs` — VIN decode, seller intake, buyer registration, Sheets reads | ✅ 2026-06-16 |
| 0.9 | `CommandCenter.html` — 5-view SPA (Dashboard/Pipeline/Sellers/Buyers/Market) | ✅ 2026-06-16 |
| 0.6 | Archive legacy/enterprise docs → `docs/archive/` | ✅ 2026-06-16 |
| 0.7 | `clasp pull` live project; commit any modules not in the repo | ⚠️ ⬜ (repo audited 2026-06-16 — none present here) |

---

## Phase 1 — Engine: Scan · Score · Filter (Google) 🔄

Make the exotic deal-finder fast, accurate, and trustworthy. *Statuses trued-up by the 2026-06-16
audit of `webapp/*.gs`.*

| # | Task | Status | Notes (from audit) |
|---|---|---|---|
| 1.1 | Manheim OAuth (client_credentials) + token refresh | ✅ | Token cached in `CacheService` (~55 min); 401 auto-retry once. |
| 1.2 | ISWS listing search (`searchListings`) | ✅ | Works; response field mapping is generic — ⚠️ verify against the live ISWS schema. |
| 1.3 | Per-VIN MMR cache (~6h) to cut Manheim calls ~80% | 🔄 | Token cache done; **per-VIN MMR cache not built** — `getMMR` hits the API every call. |
| 1.4 | Exotic scoring (make detect · mileage curve · rarity · no-MMR-gate for exotics) | 🔄 | Generic 0–100 scorer exists; **exotic mileage curve, rarity multiplier, and the no-15%-gate for exotics are NOT implemented** — `runManheimScan` still skips exotics below the discount threshold. |
| 1.5 | Batch Sheet writes (`setValues`) + chunk scans under 6-min limit | 🔄 | Deals/Buyers writes batched; **Manheim alerts append per-row**; no scan chunking/continuation. |
| 1.6 | VIN dedupe / upsert across scans (no duplicate deals) | ⬜ | **Critical gap & #1 next fix** — `appendManheimAlert_` is append-only, so re-scans duplicate the same VIN. |
| 1.7 | Time-driven triggers: scan + daily digest | 🔄 | Hourly GHL→Sheets sync + daily 6 AM ET scan installed (idempotent); **daily digest email/Chat not built**. |
| 1.8 | Flag VINs with 0 MMR samples for §5 exotic comp sources | ⬜ | — |
| 1.9 | System Log sheet + structured error handling on every external call | 🔄 | Activity Log + try/catch exist; **no dedicated error/System Log**; add **429 backoff** (only 401 retry today). |
| 1.10 | GHL→Sheets mirror + Command Center dashboard (read deals/buyers, move deal, RBAC, demo mode) | ✅ | Already built (`Api.gs`/`Sheets.gs`/`Auth.gs`) — was untracked in the old roadmap. |
| 1.11 | Snapshot + token caching via `CacheService` | ✅ | Dashboard snapshot cached 90s; Manheim token cached. |

---

## Phase 2 — GHL CRM Sync & Automation 🔄 (from the Blueprint)

Engine ↔ GHL, API-first, idempotent, event-driven. Detail: `LUX-CRM-AUTOMATION-BLUEPRINT.md`.

> **Audit note (2026-06-16):** the engine currently **reads** GHL (dashboard + Sheets mirror +
> move-deal) but does **not yet push** scanned Manheim deals into GHL. Task **2.3 (upsert-by-VIN)** is
> the missing link that turns the scanner into pipeline deals.

| # | Task | Status |
|---|---|---|
| 2.1 | Create custom-field schema via GHL v2 API — *Lux Deal* + *Lux Buyer* folders | ⬜ |
| 2.2 | Provision GHL Private Integration token → GSM `lux-ghl-api-token` (engine reads `LC_API_TOKEN`) | ⬜ |
| 2.3 | Engine → GHL upsert opportunities **by VIN**; store `opportunityId` keyed by VIN | ⬜ |
| 2.4 | Backfill currently-scanned deals into the pipeline | ⬜ |
| 2.5 | Workflow 1 — **Hot Deal Alert** (`lux_score ≥ 70` → alert + max bid) | ⬜ |
| 2.6 | Workflow 2 — **Buyer Match & Outreach** (make/price/score match, 7-day dedupe) | ⬜ |
| 2.7 | Workflow 3 — **Auction Reminder** (`lux_auction_date` in 24h → SMS w/ lane + max bid) | ⬜ |
| 2.8 | Workflow 4 — **Won → Logistics** (transport task + Drive vault + notify buyers + 14d SLA) | ⬜ |
| 2.9 | Inbound webhooks GHL → engine (Won → vault/transport, Passed → archive) | ⬜ |
| 2.10 | Workflow 5 — **Stage SLA Watchdog** (Recon >30d / Transport >14d → at-risk) | ⬜ |
| 2.11 | Workflow 6 — **Win/Loss Capture** + Workflow 7 — **Buyer Nurture** | ⬜ |
| 2.12 | Staging GHL sub-account + change-management before prod workflow edits | ⬜ |

---

## Phase 3 — Buyer Network & Google Suite Integration ⬜

| # | Task | Status |
|---|---|---|
| 3.1 | Buyer profiles (makes, max price, max mileage, min score, region) as GHL contacts | ⬜ |
| 3.2 | Ranked match: every *Listed* deal matched to ≥1 buyer by fit score | ⬜ |
| 3.3 | Drive **Vehicle Vault**: auto folder per VIN (`[YEAR] [MAKE] [MODEL] - [VIN]`) + subfolders | ⬜ (not in repo) |
| 3.4 | Calendar sync: auction dates → "Lux Auto Auctions" calendar (VIN/bid/MMR/lane) | ⬜ (not in repo) |
| 3.5 | Co-wholesale blast (pre-sell to buyer list before committing capital) | ⬜ |
| 3.6 | Mobile auction-floor PWA: VIN barcode scan → score + recommended max bid | ⬜ (not in repo) |

---

## Phase 4 — Analytics & BI (Looker Studio) ⬜

| # | Task | Status |
|---|---|---|
| 4.1 | Flat BI export sheet (`buildLookerStudioExport`) from pipeline + outcomes | ⬜ |
| 4.2 | Looker Studio dashboards: win rate, avg margin, DOM by make, seasonal timing | ⬜ |
| 4.3 | Monthly/quarterly/YTD P&L rollup | ⬜ |
| 4.4 | KPI tracking vs targets (below) | ⬜ |

---

## Phase 5 — Exotic Data Source Expansion ⬜

Source layer is a plug-in behind a common listing shape (CLAUDE.md §12).

| # | Task | Status |
|---|---|---|
| 5.1 | Bring a Trailer sold comps (rare-exotic comps where MMR = 0 samples) | ⬜ |
| 5.2 | Cars & Bids results (modern performance comps) | ⬜ |
| 5.3 | Hagerty Valuation (replace embedded reference price table) | ⬜ |
| 5.4 | RM Sotheby's / collector results | ⬜ (backlog) |

---

## Phase 6 — AI Augmentation ⬜

Plugs into the **engine**, not the CRM.

| # | Task | Status |
|---|---|---|
| 6.1 | Recon-cost estimate from defect photos → pre-bid decision support | ⬜ |
| 6.2 | Score-model upgrade with Manheim condition-report data (structural = deal-killer) | ⬜ |
| 6.3 | Claude-drafted negotiation / outreach emails from comp data | ⬜ |
| 6.4 | Buyer-demand forecasting → feed scan priorities | ⬜ |

---

## Phase 7 — Multi-Location / White-Label ⬜

| # | Task | Status |
|---|---|---|
| 7.1 | Parameterize engine + blueprint by GHL location ID + token (swap = new tenant) | ⬜ |
| 7.2 | Per-tenant config in private config file; no code changes to add a rooftop | ⬜ |
| 7.3 | Brand layer: keep all surfaces Lux Auto / Google-native (GHL invisible) | ⬜ |

---

## ⏸️ Deferred — Enterprise Scale Tier (post-native graduation only)

Lifted from `docs/archive/` **only** when a documented native ceiling is hit + Alex signs off
(CLAUDE.md §13). Do not start these under the current directive.

- FastAPI/Go backend, Postgres + RLS, Redis, Kafka, ClickHouse, pgvector
- Docker / Kubernetes / Terraform / Caddy / oauth2-proxy, Cloud Run / GKE
- Paid Manheim integrations needing server-side webhooks (Simulcast bidding, OVE, Ready Logistics)
- Stripe billing, multi-tenant auth (Clerk/Auth0), the "AutoArb" marketplace vision

---

## Backlog (unscheduled)

Arbitration tracker · competitor lane intelligence · private-seller intake pipeline · title-chain
builder w/ DMV deadlines · insurance binding on win · customer-facing inventory page (Google Sites) ·
buyer financing pre-qual links · photo AI condition grading · SMS alerts (if email open-rate insufficient).

---

## KPIs / Targets

| KPI | Target |
|---|---|
| Scan → CRM latency | < 60s, fully automated |
| Duplicate deals | 0 (VIN upsert) |
| Hot-deal alert time | < 1 min from scan |
| Scan cycle time | < 2–3 min (caching + chunking) |
| Buyer match rate | every *Listed* deal → ≥1 buyer |
| At-risk SLA breaches caught | 100% (daily watchdog) |
| Manual data entry | ~0 (API-driven) |
| Monthly run cost | ~$0 (free Google tier; GHL already owned) |

---

## Risks & Dependencies

- **Apps Script limits** (6-min execution, quotas) — mitigate with caching + chunked triggers; a hard
  block is a §13 graduation trigger, not a reason to silently add infra.
- **GHL API rate limits / token** — batch upserts, backoff on 429, rotate token quarterly.
- **Manheim API access tier** — some endpoints (CR, Simulcast, OVE) need a paid dealer agreement; the
  MMR endpoint mapping should be ⚠️ verified against current Manheim docs.
- **Live-vs-repo drift** — keep Apps Script committed via `clasp` (task 0.7).

---

## Immediate Next Actions (post-audit, native-only)

1. **VIN upsert (1.6)** — convert `appendManheimAlert_` to a batched upsert-by-VIN so re-scans update
   in place. Highest impact, self-contained, enforces the prime directive.
2. **Exotic no-gate scoring (1.4)** — in `runManheimScan`, stop dropping exotic makes below the 15%
   discount threshold; add the mileage curve + rarity multiplier from CLAUDE.md §5.
3. **Per-VIN MMR cache (1.3)** — wrap `getMMR` in `CacheService` (~6h) keyed by VIN.
4. **Engine → GHL push (2.1–2.3)** — create the field schema via API, then upsert opportunities by VIN.

---

## Maintenance Protocol

Per `CLAUDE.md` §9, **every session**: flip statuses for work started/finished, add newly discovered
tasks, bump **Last reviewed** to today, and append a **Changelog** line. The weekly scheduled task
*"Lux Auto — Weekly Roadmap Check"* (Mondays) audits drift automatically, but per-session updates are
primary. Don't change code without updating this file.

### Changelog
- **2026-06-16 (session 2)** — Added `SellerPortal.gs`: `decodeVIN` (NHTSA + MMR enrichment),
  `submitSellerLead` (GHL contact + opportunity at Spotted), `getSellerLeads`, `registerBuyer`,
  `getManheimAlerts`, `getActivityLog`. Rewrote `CommandCenter.html` as a 5-view lazy-loading SPA:
  Dashboard (KPIs + activity feed + quick actions), Pipeline (kanban + column value totals),
  Sellers (VIN decode → MMR card → intake form + leads list), Buyers (reg form + buyer grid),
  Market (Manheim alerts table + admin scan trigger). Tasks 0.8–0.9 added and completed ✅.
- **2026-06-16 (audit)** — Trued-up Phase 1 against a full read of `webapp/*.gs`: confirmed Manheim
  OAuth/token-cache, GHL read/dashboard, batched Deals/Buyers writes, RBAC, idempotent triggers (added
  as 1.10/1.11 ✅). Flagged real gaps: no VIN dedupe (1.6), no exotic no-gate/rarity scoring (1.4), no
  per-VIN MMR cache (1.3), no engine→GHL push (2.3), append-only alerts + no 429 backoff (1.5/1.9).
  Resolved the ⚠️ advanced-module items (not in repo). Added an Immediate Next Actions list.
- **2026-06-16** — Consolidated ~150 overlapping planning docs into this single roadmap. Reframed all
  phases on the Google + GHL native path; merged the GHL automation blueprint; moved the enterprise
  stack to the Deferred tier; set KPIs.
