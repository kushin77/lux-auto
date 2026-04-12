# AutoArb — Enterprise Wholesale Auto Intelligence Platform
> Full-stack AI agent platform: finds deals, bids autonomously, routes to buyers, closes transactions end-to-end.

---

## Product Vision

AutoArb is the operating system for wholesale vehicle arbitrage. It replaces a team of floor buyers, wholesalers, and sales reps with an autonomous AI agent loop that runs 24/7, learning every time a deal closes. The moat is data compounding: every transaction makes the model smarter at predicting deal quality and buyer demand, creating a flywheel competitors can't replicate.

**One-line pitch:** "AutoArb finds, buys, and sells wholesale vehicles automatically — you just approve the deals you want."

---

## Phase 1 — Foundation (Weeks 1–8) — Ship to first 10 paying customers

### 1.1 Multi-tenant backend (FastAPI → Go)
- Migrate Python FastAPI prototype to Go (Gin) for production throughput
- Postgres with Row-Level Security for tenant isolation
- Clerk or Auth0 for multi-tenant auth (org + member model)
- Stripe Billing with usage-based metering (scan events + transactions)
- Redis for MMR caching (avoid re-hitting Manheim API per VIN)
- Kafka for deal events (scan → score → bid → close pipeline)

### 1.2 Deal agent (LangGraph + Claude API)
- Replace sequential Python scripts with a proper LangGraph agent graph
- Nodes: `scan` → `enrich` → `score` → `human_gate` → `bid` → `match_buyer` → `close`
- Each node is a Claude API call with full deal context injected as system prompt
- `human_gate` node: configurable per tenant (always ask / ask above threshold / fully autonomous)
- Agent memory: pgvector stores past deal outcomes, retrieved as few-shot examples for new decisions
- Tool calls: Manheim ISWS, MMR, CarFax, uShip rate lookup, buyer CRM search

### 1.3 Buyer network (CRM + vector search)
- Tenant uploads buyer contacts (CSV or DMS sync)
- Each buyer profile: preferred makes/models, max price, location, historical purchases
- pgvector embedding of buyer preferences → semantic search at match time
- "Broadcast" mode: when a deal is won, auto-email matched buyers ranked by fit score
- Buyer response tracking: email open/click/reply → feed back into match model

### 1.4 Web dashboard (Next.js 14 + shadcn/ui)
- Dark mode, Linear aesthetic
- Deal pipeline board (Kanban: Scanning → Scored → Bidding → Won → Routing → Closed)
- Deal card: VIN, photo, score, MMR delta, est. margin, matched buyers, one-click approve/reject
- Analytics page: win rate, avg margin, agent accuracy, ROI by make/model
- Settings: bid rules, approval threshold, notification prefs, API keys

### 1.5 Chrome extension v2
- Refactor to call multi-tenant backend (JWT auth, not localhost)
- Tenant config loaded from cloud (threshold, bid rules, buyer list)
- Overlay shows buyer match count alongside deal score
- "Assign to agent" button triggers full autonomous pipeline from extension

---

## Phase 2 — Autonomy (Weeks 9–20) — Scale to 100 customers, $500K ARR

### 2.1 Autonomous bidding engine
- Per-tenant bid rules: max price formula (`MMR * multiplier - transport_estimate - recon_budget`)
- Automatic bid submission via Manheim Buy Now API (when available) or SimulBid
- Bid guard rails: max daily spend limit, max units in flight, per-make caps
- Bid confidence scoring: agent self-rates confidence, escalates to human below threshold
- Full audit log: every bid decision logged with reasoning (Claude's chain-of-thought stored)

### 2.2 Transport orchestration
- uShip API integration: auto-request quotes on won vehicles
- Route optimizer: if buyer is within X miles, flag for self-transport
- Transport cost built into margin calc before bid decision
- Carrier tracking webhook → update deal status automatically

### 2.3 Contract + payment automation
- DocuSign API: auto-generate bill of sale, send to buyer on acceptance
- Stripe Connect: collect buyer payment, hold in escrow, release on title delivery
- Title tracking: upload title docs to S3, flag missing title as deal blocker
- DMV fee lookup by state: include in final buyer price calculation

### 2.4 Mobile app (React Native / Expo)
- Push notification: "Agent found a deal — approve?" with one-tap approve/pass
- Deal detail view with photo carousel, condition report, margin calc
- Buyer outreach tap-to-call/text from matched buyer list
- Offline-first: deal data cached for auction floor use

### 2.5 DMS integrations
- CDK Global: push won vehicles + buyer deals to inventory
- Reynolds & Reynolds: sync deal records bidirectionally
- vAuto: pull retail market data to sharpen margin estimates
- Generic webhook/CSV export for smaller DMS platforms

---

## Phase 3 — Intelligence + Moat (Weeks 21–40) — $5M ARR target

### 3.1 Proprietary ML scoring model
- Replace MMR-delta-only scoring with trained gradient boosting model
- Features: make/model/trim/year/mileage/grade/location/season/days-to-sale/transport-cost
- Target: predict actual retail sale price at buyer, not just MMR
- Training data: every closed deal in the platform → weekly retrain pipeline (Airflow + Vertex AI)
- Per-tenant model fine-tuning at Enterprise tier (your deal history = your edge)

### 3.2 Buyer demand forecasting
- Track buyer search patterns: what are they looking for this week?
- Demand signal = (buyer searches for X) + (X not in inventory) → buy more X
- Feed demand signal into scan criteria: agent prioritizes high-demand vehicles
- Seasonal adjustment: SUVs in winter, convertibles in spring

### 3.3 Market intelligence layer (data product)
- Aggregate anonymized deal data across tenants
- Publish: "Hot markets" report (which makes/models are widening spread right now)
- Sell market intelligence API to: lenders (floor plan pricing), insurers (GAP product), OEMs (wholesale strategy)
- White-label the intelligence dashboard for dealer groups at $50K+/yr

### 3.4 Network effects — buyer marketplace
- Open buyer network: dealers can opt in to receive deal broadcasts from all AutoArb sellers
- Buyer reputation score: response rate, deal close rate, avg time to payment
- "Preferred buyer" program: higher placement in match results for fast closers
- Eventually: AutoArb becomes the marketplace — transaction fee at 1% on both sides

### 3.5 BYOC + Enterprise deployment
- Terraform module for self-hosted deployment (AWS/GCP/Azure)
- Vault integration for secrets, no static API keys
- Air-gapped option: all AI inference via Ollama (no Claude API required)
- SOC 2 Type II certification — required for dealer group and OEM contracts
- Custom SLA: 99.9% uptime, dedicated Slack/Teams support channel

---

## Tech Stack (Production)

| Layer | Technology |
|---|---|
| API | Go (Gin), OpenAPI 3.1 |
| Agent | LangGraph + Claude API (claude-sonnet-4) |
| Frontend | Next.js 14, shadcn/ui, Tailwind |
| Mobile | React Native (Expo) |
| Database | Postgres (Supabase or RDS) + pgvector |
| Cache | Redis (Upstash or ElastiCache) |
| Events | Kafka (Confluent Cloud or MSK) |
| Analytics | ClickHouse |
| ML | Python, scikit-learn / XGBoost, Vertex AI |
| Auth | Clerk (multi-tenant orgs) |
| Billing | Stripe (subscriptions + usage metering) |
| Storage | S3 (vehicle images, title docs) |
| Infra | Terraform + Kubernetes (EKS/GKE) |
| CI/CD | GitLab CE (self-hosted) + ArgoCD |
| Secrets | HashiCorp Vault |
| Observability | OpenTelemetry + Grafana |

---

## Go-to-Market

**ICP (Ideal Customer Profile):**
- Independent used car dealers buying 20–200 units/month at auction
- Buy-here-pay-here operators with active Manheim accounts
- Wholesale flippers / arbitrageurs (no retail lot) — highest ROI customers
- Dealer groups (5+ rooftops) — Enterprise tier, DMS integration required

**Acquisition:**
- Dealer Facebook groups (100K+ members, free access, direct ICP)
- Manheim / OVE floorwalkers — find buyers at the lane, demo on phone
- YouTube channel: "How I found 3 deals at Manheim this week" — organic content loop
- Partner channel: DMS vendors, dealer 20 Groups, NIADA (National Independent Auto Dealers)

**Sales motion:**
- Self-serve signup → 14-day free trial → convert to Starter
- Outbound via Gmail MCP (agent emails target dealers) → demo → Pro/Business
- Enterprise: direct sales, custom SOW, 12-month contract

**Defensibility:**
- Data flywheel: more deals → better model → better predictions → more customers
- Buyer network: once 500 dealers share buyers, the network itself is the product
- DMS integrations: sticky once embedded in dealer workflow
- Brand: "AutoArb" becomes the verb — "just AutoArb it"
