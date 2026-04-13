"""
Manheim Deal Finder — Local Backend
=====================================
FastAPI service running at lux.kushnir.cloud.
Handles: score lookups, scheduled scans, deal persistence, selling orchestration.

pip install fastapi uvicorn apscheduler httpx pydantic anthropic python-dotenv
"""

import os, json, sqlite3, asyncio
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Optional

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from dotenv import load_dotenv
import anthropic

load_dotenv()

MANHEIM_CLIENT_ID     = os.getenv("MANHEIM_CLIENT_ID")
MANHEIM_CLIENT_SECRET = os.getenv("MANHEIM_CLIENT_SECRET")
ANTHROPIC_API_KEY     = os.getenv("ANTHROPIC_API_KEY")
DEAL_THRESHOLD_PCT    = float(os.getenv("DEAL_THRESHOLD_PCT", "0.15"))
SELL_TRIGGER_SCORE    = float(os.getenv("SELL_TRIGGER_SCORE", "70"))

# ── DB ────────────────────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect("deals.db")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS deals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vin TEXT UNIQUE,
            year INTEGER, make TEXT, model TEXT, trim TEXT,
            mileage INTEGER, listing_price REAL, mmr_value REAL,
            discount_pct REAL, deal_score REAL,
            estimated_profit_margin REAL,
            auction_location TEXT, sale_date TEXT,
            status TEXT DEFAULT 'new',
            listing_description TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS sell_actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vin TEXT, action TEXT, result TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
        """)

# ── Models ────────────────────────────────────────────────────────────────────
class ScoreRequest(BaseModel):
    vin: str
    listing_price: float
    mileage: int

class SellRequest(BaseModel):
    vin: str
    year: Optional[int] = None
    make: Optional[str] = None
    model: Optional[str] = None
    trim: Optional[str] = None
    mileage: Optional[int] = None
    listing_price: Optional[float] = None
    mmr_value: Optional[float] = None
    discount_pct: Optional[float] = None
    deal_score: Optional[float] = None
    estimated_profit_margin: Optional[float] = None
    auction_location: Optional[str] = None
    sale_date: Optional[str] = None

# ── Manheim Auth (reuse from deal_finder.py) ──────────────────────────────────
_token_cache = {"token": None, "expires": 0}

async def get_manheim_token(client: httpx.AsyncClient) -> str:
    import time
    if _token_cache["token"] and time.time() < _token_cache["expires"]:
        return _token_cache["token"]
    resp = await client.post(
        "https://api.manheim.com/id/credentials/accesstoken",
        data={"grant_type": "client_credentials",
              "client_id": MANHEIM_CLIENT_ID,
              "client_secret": MANHEIM_CLIENT_SECRET},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    resp.raise_for_status()
    d = resp.json()
    import time as t
    _token_cache["token"]   = d["access_token"]
    _token_cache["expires"] = t.time() + d.get("expires_in", 3600) - 60
    return _token_cache["token"]

async def fetch_mmr(vin: str, mileage: int) -> Optional[float]:
    async with httpx.AsyncClient(base_url="https://api.manheim.com") as c:
        tok = await get_manheim_token(c)
        r = await c.get(f"/valuation/v2/mmrtransaction/{vin}",
                        params={"odometer": mileage, "odometerUnit": "miles"},
                        headers={"Authorization": f"Bearer {tok}"})
        if r.status_code == 404: return None
        r.raise_for_status()
        return r.json().get("items", [{}])[0].get("average")

def compute_score(listing_price: float, mmr_value: float, mileage: int) -> dict:
    if not mmr_value or listing_price <= 0:
        return {"score": 0, "discount_pct": 0, "estimated_profit_margin": 0, "mmr_value": mmr_value}
    discount_pct = (mmr_value - listing_price) / mmr_value
    if discount_pct < DEAL_THRESHOLD_PCT:
        return {"score": 0, "discount_pct": discount_pct, "estimated_profit_margin": 0, "mmr_value": mmr_value}
    score = min(60.0, discount_pct * 200)
    if mileage < 30_000: score += 10
    elif mileage < 60_000: score += 5
    score = min(100.0, score)
    net = (mmr_value - listing_price) - (listing_price * 0.08)
    return {"score": round(score, 1), "discount_pct": discount_pct,
            "estimated_profit_margin": round(net, 2), "mmr_value": mmr_value}

# ── Selling Orchestrator ──────────────────────────────────────────────────────
claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

async def generate_listing_description(deal: SellRequest) -> str:
    """Use Claude to generate a retail listing description."""
    prompt = f"""Write a compelling retail listing description for this vehicle:
{deal.year} {deal.make} {deal.model} {deal.trim or ''}
Mileage: {deal.mileage:,} miles
Asking price: ${deal.listing_price:,.0f}
Wholesale value (MMR): ${deal.mmr_value:,.0f}

Write 2 paragraphs: first highlights condition and key features, second creates urgency.
Tone: professional, honest, no hype. Target buyer: used car shopper on Facebook Marketplace.
No placeholders — write it as if ready to post. Max 150 words."""

    msg = claude.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}]
    )
    return msg.content[0].text.strip()

async def send_dealer_email_via_gmail_mcp(deal: SellRequest, description: str) -> dict:
    """
    Sends a dealer outreach email via Claude + Gmail MCP.
    Claude decides the best subject/body given the deal context.
    """
    prompt = f"""You have access to Gmail via MCP tools.

Write and SEND (do not just draft) a dealer outreach email for this wholesale deal:
Vehicle: {deal.year} {deal.make} {deal.model} {deal.trim or ''}
Mileage: {deal.mileage:,}
Wholesale buy price: ${deal.listing_price:,.0f}
MMR: ${deal.mmr_value:,.0f}
Est. net margin after fees: ${deal.estimated_profit_margin:,.0f}

Send to: dealer-inquiries@placeholder-dealer.com
Subject line: clear, specific to this vehicle
Body: 3–4 sentences. State availability, price, MMR discount. End with a call to action.
Sign: Alex | Wholesale Auto Division

Use your Gmail tool to send this now."""

    msg = claude.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
        mcp_servers=[{"type": "url", "url": "https://gmail.mcp.claude.com/mcp", "name": "gmail"}]
    )
    return {"status": "sent", "response": msg.content[0].text if msg.content else ""}

async def log_to_notion_or_sheets(deal: SellRequest, description: str):
    """Placeholder — wire to Notion API or Google Sheets API as needed."""
    with get_db() as db:
        db.execute("""
            INSERT OR REPLACE INTO deals
            (vin, year, make, model, trim, mileage, listing_price, mmr_value,
             discount_pct, deal_score, estimated_profit_margin, auction_location,
             sale_date, listing_description, status, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'listed',datetime('now'))
        """, (deal.vin, deal.year, deal.make, deal.model, deal.trim, deal.mileage,
              deal.listing_price, deal.mmr_value, deal.discount_pct, deal.deal_score,
              deal.estimated_profit_margin, deal.auction_location, deal.sale_date, description))

async def orchestrate_sell(deal: SellRequest) -> dict:
    """Full selling pipeline triggered when deal score >= SELL_TRIGGER_SCORE."""
    results = {}

    # 1. Generate listing description
    desc = await generate_listing_description(deal)
    results["listing_description"] = desc

    # 2. Send dealer outreach email via Gmail MCP
    email_result = await send_dealer_email_via_gmail_mcp(deal, desc)
    results["email"] = email_result

    # 3. Log to deal tracker
    await log_to_notion_or_sheets(deal, desc)
    results["logged"] = True

    # 4. Log action
    with get_db() as db:
        db.execute("INSERT INTO sell_actions (vin, action, result) VALUES (?,?,?)",
                   (deal.vin, "orchestrate_sell", json.dumps(results)))

    return results

# ── Scheduled full scan ───────────────────────────────────────────────────────
async def scheduled_scan():
    """Pull fresh inventory + score everything. Auto-trigger sell if score high enough."""
    print(f"[{datetime.now().isoformat()}] Scheduled scan starting...")
    try:
        async with httpx.AsyncClient(base_url="https://api.manheim.com") as c:
            tok = await get_manheim_token(c)
            resp = await c.get("/marketplace/v1/listings",
                               params={"make": "Toyota,Honda,Ford,Chevrolet",
                                       "yearMin": 2018, "mileageMax": 80000, "limit": 100},
                               headers={"Authorization": f"Bearer {tok}"})
            items = resp.json().get("items", [])

        hot_deals = []
        for item in items:
            vin     = item.get("vin", "")
            price   = float(item.get("price", 0))
            mileage = item.get("odometer", 0)
            if not vin or not price: continue
            mmr  = await fetch_mmr(vin, mileage)
            data = compute_score(price, mmr, mileage)
            if data["score"] >= SELL_TRIGGER_SCORE:
                deal = SellRequest(vin=vin, year=item.get("year"),
                                   make=item.get("make"), model=item.get("model"),
                                   trim=item.get("trim"), mileage=mileage,
                                   listing_price=price, **data,
                                   auction_location=item.get("locationName"),
                                   sale_date=item.get("saleDate"))
                hot_deals.append(deal)
                await orchestrate_sell(deal)

        print(f"  Scan complete — {len(hot_deals)} hot deals auto-triggered")
    except Exception as e:
        print(f"  Scan error: {e}")

# ── App ───────────────────────────────────────────────────────────────────────
scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    scheduler.add_job(scheduled_scan, IntervalTrigger(minutes=30), id="deal-scan",
                      next_run_time=datetime.now())
    scheduler.start()
    yield
    scheduler.shutdown()

app = FastAPI(title="Manheim Deal Finder", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

@app.post("/score")
async def score_endpoint(req: ScoreRequest):
    mmr  = await fetch_mmr(req.vin, req.mileage)
    data = compute_score(req.listing_price, mmr, req.mileage)
    return {**data, "vin": req.vin}

@app.post("/scan")
async def manual_scan():
    asyncio.create_task(scheduled_scan())
    return {"status": "scan triggered"}

@app.get("/deals")
async def get_deals(limit: int = 50, min_score: float = 40):
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM deals WHERE deal_score >= ? ORDER BY deal_score DESC LIMIT ?",
            (min_score, limit)
        ).fetchall()
    return {"deals": [dict(r) for r in rows]}

@app.post("/sell")
async def sell_endpoint(deal: SellRequest):
    return await orchestrate_sell(deal)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
