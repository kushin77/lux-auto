# Lux Auto — Enterprise CRM Automation Blueprint

**System of record:** GoHighLevel (sub-account *Pure Bliss Marketing*, location `bTLwmX2mz7dBOQheNed6`)
**Scoring/data engine:** Manheim integration (Apps Script app + FastAPI backend, repo `kushin77/lux-auto`)
**Status:** Pipeline + first deal live. This blueprint defines the enterprise, API-first path to *complete automation*.

---

## 1. Architecture — one source of truth, event-driven

```
            ┌─────────────────────────┐        ┌──────────────────────────┐
 Manheim ──▶│  Scoring Engine          │  API   │  GoHighLevel (CRM)       │
  API       │  (FastAPI / Apps Script) │───────▶│  • Opportunities (deals) │
            │  • scan, score, MMR      │  v2    │  • Contacts (buyers)     │
            │  • dedupe by VIN         │◀───────│  • Workflows (automation)│
            └──────────┬───────────────┘ webhook└──────────────────────────┘
                       │                                   │
                  Secret Manager                      Looker / BI
                  (GSM, lux-auto)                     (reporting)
```

**Principles (enterprise best practice):**
- **API-first, not UI-first.** Every CRM object (deal, buyer, stage move, custom field) is created/updated through the GHL v2 API so the whole flow is reproducible, version-controlled, and automatable. Manual UI work is for exceptions only.
- **Idempotent + deduped.** VIN is the natural key. Every create/update is upsert-by-VIN so re-scans never create duplicates.
- **Event-driven both ways.** Engine → CRM on new/changed deals; CRM → Engine via webhooks on stage changes (Won, Passed) to trigger transport/vault/archive.
- **Least privilege + secrets in GSM.** No credentials in code; GHL API token + Manheim keys live in Secret Manager (`lux-auto`).
- **Everything audited.** Stage changes, approvals, and outreach are logged (CRM audit + backend `AuditLog`).

---

## 2. CRM data model (custom fields)

Create these once via the **GHL v2 API** (preferred — automatable) or the UI when the Custom Fields page renders. Group them in a folder named **"Lux Deal"** (Opportunity object) and **"Lux Buyer"** (Contact object).

### Opportunity (deal) fields — folder *Lux Deal*
| Field | Key | Type |
|---|---|---|
| VIN | `lux_vin` | Text (unique) |
| Year | `lux_year` | Number |
| Make | `lux_make` | Single option |
| Model | `lux_model` | Text |
| Mileage | `lux_mileage` | Number |
| MMR Value | `lux_mmr` | Monetary |
| Deal Score | `lux_score` | Number (0–100) |
| Max Bid | `lux_max_bid` | Monetary |
| Estimated Margin | `lux_margin` | Monetary |
| Auction Date | `lux_auction_date` | Date |
| Lane | `lux_lane` | Text |
| Condition Report Score | `lux_cr_score` | Number |
| Drive Vault URL | `lux_vault_url` | Text (URL) |

### Contact (buyer) fields — folder *Lux Buyer*
| Field | Key | Type |
|---|---|---|
| Preferred Makes | `buyer_makes` | Multi-option |
| Max Price | `buyer_max_price` | Monetary |
| Max Mileage | `buyer_max_mileage` | Number |
| Min Score | `buyer_min_score` | Number |
| Region | `buyer_region` | Text |

> **Automation note:** Because the engine sets these via API, the deal card always carries VIN/MMR/score as structured data — no manual entry, and workflows can branch on `lux_score`, `lux_margin`, etc.

**Create-field API call (pattern):**
```
POST https://services.leadconnectorhq.com/locations/{locationId}/customFields
Authorization: Bearer {token}   Version: 2021-07-28
{ "name": "Deal Score", "dataType": "NUMERICAL", "model": "opportunity",
  "fieldKey": "lux_score", "placeholder": "0-100" }
```

---

## 3. Pipeline governance — *Lux Auto — Acquisitions* (live)

8 stages with explicit entry criteria, SLA, and the automation that fires on entry:

| # | Stage | Enter when | SLA | On-enter automation |
|---|---|---|---|---|
| 1 | **Spotted** | Engine scores a listing | — | If `lux_score ≥ 70` → hot-deal alert |
| 2 | **Watching** | Manually flagged to track | until auction | Auction-date reminder scheduled |
| 3 | **Won** | Auction won | 24h | Create transport task + Drive vault, notify matched buyers |
| 4 | **In Transport** | Transport booked | 14d | At-risk alert if >14d |
| 5 | **Recon** | Vehicle received | 30d | At-risk alert if >30d; recon cost task |
| 6 | **Listed** | Ready for sale | 45d | Publish to buyer outreach sequence |
| 7 | **Sold** | Sale closed | — | P&L roll-up; archive after 90d |
| 8 | **Passed / Arbitrated** | Passed or dispute | — | Archive; log reason for win-rate analytics |

---

## 4. Workflow automations (the "complete automation" set)

Build these as GHL Workflows (or trigger from the backend). Each is idempotent and logged.

1. **Hot Deal Alert** — *Trigger:* opportunity created/updated with `lux_score ≥ 70`. *Action:* Slack/SMS/email to acquisitions with VIN, score, MMR, recommended max bid (`MMR × 0.92`), one-click "Watch" link.
2. **Buyer Match & Outreach** — *Trigger:* new deal in Spotted/Listed. *Action:* find contacts where `buyer_makes` contains make AND `buyer_max_price ≥ MMR` AND `buyer_min_score ≤ lux_score`; send templated "deal available" email/SMS; dedupe so a buyer isn't pinged for the same VIN within 7 days.
3. **Auction Reminder** — *Trigger:* `lux_auction_date` is in 24h. *Action:* task + SMS to bidder with lane and max bid.
4. **Won → Logistics** — *Trigger:* stage = Won. *Action:* create transport task, create Drive vault folder (Apps Script), notify matched buyers, set 14-day SLA timer.
5. **Stage SLA Watchdog** — *Trigger:* daily. *Action:* any deal stuck in Recon >30d or In Transport >14d → at-risk alert + task to owner.
6. **Win/Loss Capture** — *Trigger:* stage = Sold or Passed/Arbitrated. *Action:* write outcome + reason to analytics; archive after retention window.
7. **Buyer Nurture** — *Trigger:* new buyer contact. *Action:* 3-touch onboarding sequence collecting `buyer_makes`, `buyer_max_price`, etc.

> Keep workflows **thin**; put complex scoring/matching in the backend and let GHL call it via a webhook action. This keeps logic testable (the backend already has a 17-test suite) and avoids brittle no-code branching.

---

## 5. Integration & data sync (engine ↔ GHL)

- **Outbound (engine → GHL):** after each scan, upsert opportunities by `lux_vin`. Use the GHL v2 Opportunities API; store the returned `opportunityId` keyed by VIN in the engine DB to make updates O(1) and idempotent.
- **Inbound (GHL → engine):** register a GHL **webhook** for opportunity stage changes → backend endpoint; on `Won` create the Drive vault + transport record, on `Passed` archive.
- **Auth:** GHL Private Integration token (or OAuth app) stored in GSM as `lux-ghl-api-token`; rotate quarterly.
- **Reliability:** retries with exponential backoff, idempotency keys, dead-letter logging (the backend's `audit` + structured logs already support this).
- **Rate limits:** batch upserts, respect GHL limits, backoff on 429 (mirrors the Manheim client's existing backoff logic).

---

## 6. Enterprise best practices (governance)

- **RBAC:** mirror the backend roles (Viewer / Analyst / Admin / Super-Admin) onto GHL user permissions; acquisitions can move stages, only Admin approves bids.
- **Naming + tags taxonomy:** pipeline `Lux Auto — Acquisitions`; tags `lux:hot`, `lux:matched`, `lux:at-risk`, `lux:arbitration` — never free-text.
- **Secrets:** all in GSM (`lux-auto`): `lux-ghl-api-token`, `lux-fastapi-secret-key`, `MANHEIM_CLIENT_ID/SECRET`. Nothing in code.
- **Environments:** keep a staging GHL sub-account for workflow changes before they touch production data.
- **Auditability:** every state-changing automation writes who/what/when; reconcile with the backend `AuditLog`.
- **Data retention & privacy:** archive Sold/Passed after 90d; PII (buyer contacts) access-controlled and exportable on request.
- **Change management:** workflows version-noted in this repo; no silent edits to live automations.

---

## 7. Futureproofing & scale

- **API-first everything** → the CRM can be rebuilt or migrated from code; no lock-in to manual config.
- **Event-driven** → add consumers (BI, AI, SMS) without touching the core flow.
- **Multi-location / white-label** → the same engine + blueprint deploys to new GHL sub-accounts by changing the location ID + token.
- **AI augmentation** → recon-cost estimation from photos, deal-score model upgrades with CR data, AI negotiation drafts (Claude API) — all plug into the engine, not the CRM.
- **BI** → pipeline + outcomes export to Looker Studio for win-rate, days-on-market, margin-by-make.
- **DR/backup** → nightly export of opportunities/contacts; engine DB backed up (Cloud SQL automated backups when the backend deploys).

---

## 8. Execution roadmap (mapped to what's already done)

**Done this session**
- ✅ Pipeline *Lux Auto — Acquisitions* with 8 stages (live in Pure Bliss Marketing).
- ✅ First deal (2019 Ferrari 488, $235k) in *Spotted* + source contact.
- ✅ Backend functional (PR #103), Manheim CLI, Apps Script app + deploy scripts, GitHub Actions.

**Next (0–30 days)**
1. Create the custom-field schema via the GHL v2 API (section 2) — automatable, sidesteps the UI render bug.
2. Provision a GHL Private Integration token → store in GSM as `lux-ghl-api-token`.
3. Build the engine→GHL upsert (idempotent by VIN) and backfill current scanned deals.
4. Stand up workflows 1–4 (hot deal, buyer match, auction reminder, won→logistics).

**30–60 days**
5. Inbound webhooks (GHL→engine) for Won/Passed → Drive vault + archive.
6. SLA watchdog + win/loss analytics → Looker dashboard.
7. Staging sub-account + change-management process.

**60–90 days**
8. Buyer nurture + segmentation; AI recon/negotiation; multi-location readiness.

---

## 9. Success metrics (KPIs)

| KPI | Target |
|---|---|
| Scan→CRM latency | < 60s, fully automated |
| Duplicate deals | 0 (VIN upsert) |
| Hot-deal alert time | < 1 min from scan |
| Buyer match rate | every Listed deal matched to ≥1 buyer |
| At-risk SLA breaches caught | 100% (daily watchdog) |
| Manual data entry | ~0 (API-driven) |

---

*This blueprint makes Lux's CRM API-first, idempotent, event-driven, auditable, and multi-location ready — the foundation for complete automation. Build the field schema + token next, and the engine→GHL sync turns the pipeline into a self-running deal machine.*
