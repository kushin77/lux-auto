# Lux Auto — Product Roadmap
**Exotic Dealer Command Center | Built on Google Apps Script**

---

## Where We Are Today (Baseline)

The platform is live as a Google Apps Script web app with two routes:
- `/exec` — Client portal (seller intake forms)
- `/exec?page=dashboard` — Manheim Dealer Command Center (deal scoring, MMR, watchlist)

Core loop: Scan Manheim → Score deals → Match to buyers → Outreach → Track

---

## Phase 1 — Google Free Tier, Maximum Capability ✅ *Delivered*

**Theme:** Make this the only tool an exotic dealer needs. Zero paid dependencies. Enterprise-class from day one.

### 1. Speed & Performance
- **CacheService for MMR** — 6-hour cache per VIN reduces Manheim API calls by ~80%. Scan cycles drop from 8–12 minutes to under 2 minutes.
- **Batch sheet writes** — All pipeline, waitlist, and analytics writes use `getRange().setValues()` batch ops, not cell-by-cell.
- **Pre-computed scores** — `_scoreListing()` processes items inline; no redundant re-fetches.

### 2. Exotic Dealer Specialization
- **New scoring engine** (`_scoreListingFull` / `_scoreExoticDeal`) — Detects exotic makes automatically and applies a purpose-built model:
  - Embedded reference price table for Ferrari, Lamborghini, Porsche, McLaren, Bentley, Rolls-Royce, Maserati, Aston Martin, Bugatti, Dodge Viper
  - Exotic mileage curve: < 2,000 mi = +20 pts, < 5,000 = +15, < 10,000 = +10 (vs. generic model's undifferentiated low-mileage bonus)
  - Rarity multiplier: rare makes (Ferrari, Lamborghini) get additional score premium
  - Seasonal adjustment: integrates with Analytics.gs market timing data
- **Scan makes updated** to exotic-first: Ferrari, Lamborghini, Porsche, McLaren, Bentley, Rolls-Royce, Maserati, Aston Martin, Lexus, BMW, Mercedes-Benz, Acura
- **Exotic discount threshold removed** — exotics at market price still get scored and surfaced (unlike mass-market which requires ≥15% discount)

### 3. Enterprise CRM — Pipeline & P&L
**Pipeline.gs** — Full deal lifecycle management:
- Kanban stages: Spotted → Watching → Won → In Transport → Recon → Listed → Sold → (Passed / Arbitrated)
- Conditional formatting per stage (color-coded for instant visual triage)
- Live formula columns: Total Cost, Gross Profit, Net Profit, Margin % auto-update as costs are edited
- At-risk alerts: deals stuck in Recon or Transport > 30 days
- Archive: sold deals > 90 days old move to Archive sheet automatically
- Full audit trail to System Log on every stage change

**Analytics.gs** — P&L and market intelligence:
- Monthly/quarterly/YTD P&L rollup from Pipeline sheet
- Market velocity tracking (days-on-market trends by make)
- Seasonal patterns: learns which months are best to buy/sell each make
- Looker Studio export: `buildLookerStudioExport()` creates a clean flat table on demand — connect Looker Studio to the Sheet for live BI dashboards

### 4. Google Integration Suite
**Google Drive — VehicleVault.gs:**
- Auto-creates a folder per vehicle: `[YEAR] [MAKE] [MODEL] - [VIN]`
- Subfolders pre-created: Condition Report | Carfax | Photos | Title & DMV | Recon | Sale Docs
- Folder ID written back to Pipeline sheet for one-click access
- Vault summary available from dashboard

**Google Calendar — CalendarSync.gs:**
- `syncAuctionEvent()` — auction dates → dedicated "Lux Auto Auctions" calendar with VIN, bid, MMR, lane in event description
- `syncTransportETA()` / `syncReconComplete()` — milestone events auto-created
- Dashboard pulls upcoming auction events via `getUpcomingAuctionEventsAPI()`

**Google Chat — ChatNotify.gs:**
- Webhook-based alerts (configure with CHAT_WEBHOOK_URL script property)
- Hot deal alerts (score ≥ 70): rich card with vehicle, score badge, discount %, action button
- Stage change notifications, transport delay alerts, waitlist match notifications
- Daily briefing card (7 AM trigger) with new listings, hot deals, pipeline value, weekly P&L

### 5. Customer Waitlist Engine
**CustomerWaitlist.gs:**
- Buyers specify: makes, models, year range, max price, max mileage, min score
- `matchInventoryToWaitlist()` — runs on every scan batch, finds matching buyers
- `sendWaitlistNotifications()` — HTML email with luxury dark/gold styling, deal score badge, "View Deal" CTA
- Dedup logic: won't spam same buyer for same VIN within 7 days
- Stats: active count, recent matches, top makes in demand

### 6. Mobile PWA — Auction Floor Tool
**MobileScanner.html** (`/exec?page=mobile`):
- ZXing barcode scanner via rear camera — reads VIN barcodes off window stickers
- Vibrate + flash on successful scan, auto-lookup deal score
- Shows: MMR, deal score badge, recommended max bid (MMR × 0.92)
- Bid calculator: live profit estimate as you adjust the bid
- One-tap actions: Add to Watchlist, Set Bid Limit, Notify Buyer (runs waitlist match)
- Manual VIN entry fallback; recent VINs history (last 5)

### 7. Co-Wholesale System
- `sendCoWholesaleBlast(deal, askPrice)` — sends deal card to entire active buyer list
- Use on auction eve to pre-sell at a markup before committing capital (zero inventory risk)
- Logs to Outreach Log with "Co-Wholesale Sent" status
- Menu shortcut: Lux Auto → Send Co-Wholesale Blast

### 8. Dashboard Enhancements
New tabs added to Manheim Command Center:
- **🚗 Pipeline** — Kanban board with all active deals, stage controls, value by stage
- **📊 P&L** — Metric cards + monthly bar chart + sold vehicle table
- **🔔 Waitlist** — Add buyers, view active waitlist, manage entries
- **📱 Mobile & Tools** — Scanner link, Looker Studio export, calendar sync, vault setup, connection status

---

## Phase 2 — Enhanced Google (Free Tier Limits + Low Cost)

*Timeline: 30-60 days after Phase 1 stabilizes*

| Feature | Tool | Why |
|---|---|---|
| Real-time dashboard sync | Firebase Realtime Database (free Spark plan) | Eliminate page refresh — deals update live across multiple browser tabs |
| Heavy compute offload | Google Cloud Functions (free tier: 2M calls/month) | Move MMR batch-fetching out of GAS execution limits |
| Advanced analytics | BigQuery (free: 1TB queries/month) | Historical auction data warehouse; query across years of deals |
| SMS alerts | Twilio ($0.0075/SMS) | Text buyer when a watched vehicle hits auction — higher open rate than email |
| Custom domain | Google Domains ($12/year) | `dealer.luxauto.com` instead of script.google.com |
| Looker Studio Pro | Google (free → $9/user/month) | Scheduled email reports, blended data sources, custom branding |

---

## Phase 3 — Full Manheim Integration (Paid API)

*Timeline: 60-120 days | Requires Manheim dealer account + API agreement*

| Feature | API Endpoint | Value |
|---|---|---|
| Condition Reports | `GET /marketplace/v1/listings/{vin}/conditionReport` | Structural damage flags, CR score in deal scoring |
| OVE (Online Vehicle Exchange) | `GET /ove/v1/vehicles` | Buy-now inventory, no auction wait |
| Simulcast bidding | Simulcast API | Bid programmatically from the dashboard |
| Ready Logistics transport | Ready Logistics API | Book transport, track ETAs in real-time |
| MMR History | `GET /valuation/v2/mmrtransaction/history` | Price trend by make/model/year for better timing |
| Manheim Express | Mobile API | Buyer-side condition report photos submission |

### Scoring Model Upgrade (Phase 3)
With CR data available:
- Structural damage = instant deal-killer (-40 pts, flagged red)
- CR score ≥ 4.5 = +15 pts, 4.0-4.4 = +8 pts, < 3.5 = -15 pts
- Interior/exterior condition photos embedded in Pipeline card

---

## Phase 4 — Exotic Data Sources

*Timeline: 90-180 days | For serious exotic volume*

| Data Source | Integration Method | Value |
|---|---|---|
| Hagerty Valuation API | REST API (dealer pricing) | Industry-standard classic/exotic values replace embedded reference table |
| Bring a Trailer public results | Web scraping or RSS | Sold comps for rare vehicles where MMR has 0 samples |
| Cars & Bids results | Web scraping | Modern performance car comps |
| CARFAX Dealer API | API partnership | One-click Carfax in Pipeline → Drive vault |
| VINtel (VIN decoder) | REST API | Full spec decode: transmission, options, build date, original color |
| AutoCheck | Sherlock API | Title history, structural damage, odometer rollback detection |

---

## Phase 5 — Enterprise & Scale

*Timeline: 6-12 months*

| Feature | Approach |
|---|---|
| Multi-user RBAC | Firebase Auth + Firestore with role-based rules (Manager / Buyer / Viewer) |
| DMS Integration | CDK Global or vAuto API — push won deals directly into inventory management |
| Floor plan integration | NextGear Capital API — check available credit before bidding |
| Title & DMV workflow | State DMV APIs (where available) + DocuSign for electronic signatures |
| Insurance binding | At market (Progressive Commercial, Hagerty dealer) — API quoting |
| White-label for other dealers | Multi-tenant GAS deployment + custom branding layer |
| Native iOS/Android app | React Native wrapping the GAS APIs — full offline capability |
| AI deal negotiation | Claude API — analyzes comp data, suggests counter-offers, drafts negotiation emails |

---

## What We Haven't Built Yet (Future Backlog)

- **Arbitration tracker** — log disputes, resolution timeline, cost recovery; auto-flag vehicles with prior arbitration history
- **Recon cost estimator** — take photos of defects → AI estimates repair cost → pre-bid decision support
- **Competitor intelligence** — track what other dealers pay at auction (public lane data) to calibrate bid strategy
- **Private seller pipeline** — intake form for private sellers offering directly (separate from Manheim); scoring against retail comps
- **Title chain builder** — multi-vehicle title management with DMV deadline alerts
- **Insurance integration** — bind coverage the day a vehicle is won, not after transport
- **Tax & registration automation** — state-by-state dealer license + temp tag generation
- **Customer facing inventory page** — auto-publishes Listed vehicles to a public-facing page (Google Sites or custom HTML)
- **Buyer financing integration** — DT (Dealer Track) or RouteOne pre-qual link in buyer emails
- **Photo AI grading** — upload auction photos, AI grades condition, pre-fills recon estimate

---

## Performance Targets by Phase

| Metric | Baseline | Phase 1 | Phase 2 | Phase 3+ |
|---|---|---|---|---|
| Scan cycle time | 8-12 min | 2-3 min | < 30 sec | Real-time |
| MMR API calls/scan | 150 | ~30 | 0 (BigQuery) | 0 |
| Dashboard load time | 8 sec | 5 sec | < 1 sec | < 0.5 sec |
| Deals scored/day | 150 | 150 | Unlimited | Unlimited |
| Concurrent users | 1 (GAS limit) | 1 | 100+ (Firebase) | 1000+ |
| Data retention | Session | Sheets (unlimited) | BigQuery (unlimited) | Warehouse |

---

## Setup Checklist for Phase 1

- [ ] Run `setupSheets()` from Apps Script menu (creates all new sheets)
- [ ] Set Script Properties: `MANHEIM_CLIENT_ID`, `MANHEIM_CLIENT_SECRET`
- [ ] Optional: Set `CHAT_WEBHOOK_URL` for Google Chat alerts
- [ ] Run `setupVaultRoot()` from menu to create Drive folder structure
- [ ] Run `setupAuctionCalendar()` to create Google Calendar
- [ ] Add buyers to "Buyers" sheet (Name, Email, Makes, Max Price, etc.)
- [ ] Add buyer wishlist entries to "Customer Waitlist" sheet
- [ ] Install triggers: `installTrigger()` (every 2h scan) + `installDailyDigestTrigger()` (7 AM)
- [ ] Connect Looker Studio: run `buildLookerStudioExport()`, then link the "BI Export" sheet as a Looker Studio data source
- [ ] Open `/exec?page=mobile` on your phone and add to home screen (PWA)

---

*Built entirely on free Google tools: Apps Script, Sheets, Drive, Calendar, Gmail, Google Chat, Looker Studio.*
*No monthly SaaS fees. No vendor lock-in. Runs 24/7 on Google's infrastructure.*
