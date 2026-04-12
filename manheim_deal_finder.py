"""
Manheim Wholesale Deal Finder
=============================
Uses Manheim's official ISWS + Vehicle APIs to surface underpriced inventory.
"Deal" = listing price significantly below MMR (Manheim Market Report) value.

Setup:
  pip install httpx pydantic python-dotenv rich

Auth flow: OAuth 2.0 client_credentials → bearer token → API calls
"""

import os
import asyncio
from datetime import datetime, timedelta
from typing import Optional
import httpx
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────

MANHEIM_CLIENT_ID     = os.getenv("MANHEIM_CLIENT_ID")
MANHEIM_CLIENT_SECRET = os.getenv("MANHEIM_CLIENT_SECRET")

BASE_URL  = "https://api.manheim.com"
AUTH_URL  = "https://api.manheim.com/id/credentials/accesstoken"

# Deal threshold: flag if listing is this % BELOW MMR
DEAL_THRESHOLD_PCT = float(os.getenv("DEAL_THRESHOLD_PCT", "0.15"))  # 15% below MMR

# ── Models ────────────────────────────────────────────────────────────────────

class VehicleListing(BaseModel):
    vin: str
    year: int
    make: str
    model: str
    trim: Optional[str] = None
    mileage: int
    condition_grade: Optional[float] = None   # Manheim 1.0–5.0 scale
    auction_location: str
    sale_date: str
    listing_price: float
    mmr_value: Optional[float] = None
    discount_pct: Optional[float] = None
    run_number: Optional[str] = None
    images: list[str] = []

class DealAlert(BaseModel):
    listing: VehicleListing
    deal_score: float          # 0–100, higher = better deal
    reason: str
    estimated_profit_margin: float

# ── Auth ──────────────────────────────────────────────────────────────────────

class ManheimAuth:
    def __init__(self):
        self._token: Optional[str] = None
        self._expires_at: Optional[datetime] = None

    async def get_token(self, client: httpx.AsyncClient) -> str:
        if self._token and datetime.now() < self._expires_at:
            return self._token

        resp = await client.post(
            AUTH_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": MANHEIM_CLIENT_ID,
                "client_secret": MANHEIM_CLIENT_SECRET,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
        data = resp.json()
        self._token = data["access_token"]
        self._expires_at = datetime.now() + timedelta(seconds=data.get("expires_in", 3600) - 60)
        return self._token

auth = ManheimAuth()

# ── API Client ────────────────────────────────────────────────────────────────

class ManheimClient:
    def __init__(self):
        self.client = httpx.AsyncClient(base_url=BASE_URL, timeout=30.0)

    async def _headers(self) -> dict:
        token = await auth.get_token(self.client)
        return {"Authorization": f"Bearer {token}", "Accept": "application/json"}

    async def search_inventory(
        self,
        makes: list[str] = None,
        models: list[str] = None,
        year_min: int = None,
        year_max: int = None,
        mileage_max: int = None,
        condition_min: float = None,
        location_ids: list[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict:
        """Search presale listings via ISWS API."""
        params = {"limit": limit, "offset": offset}
        if makes:         params["make"]         = ",".join(makes)
        if models:        params["model"]        = ",".join(models)
        if year_min:      params["yearMin"]      = year_min
        if year_max:      params["yearMax"]      = year_max
        if mileage_max:   params["mileageMax"]   = mileage_max
        if condition_min: params["conditionMin"] = condition_min
        if location_ids:  params["locationId"]   = ",".join(location_ids)

        resp = await self.client.get(
            "/marketplace/v1/listings",
            params=params,
            headers=await self._headers(),
        )
        resp.raise_for_status()
        return resp.json()

    async def get_mmr(self, vin: str, mileage: int) -> Optional[float]:
        """Fetch Manheim Market Report value for a specific VIN."""
        resp = await self.client.get(
            f"/valuation/v2/mmrtransaction/{vin}",
            params={"odometer": mileage, "odometerUnit": "miles"},
            headers=await self._headers(),
        )
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        data = resp.json()
        # MMR returns average, above, below — use average
        return data.get("items", [{}])[0].get("average")

    async def get_condition_report(self, vin: str) -> Optional[dict]:
        """Pull full condition report if available."""
        resp = await self.client.get(
            f"/vehicle/v1/vin/{vin}/condition",
            headers=await self._headers(),
        )
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()

    async def close(self):
        await self.client.aclose()

# ── Deal Scoring Engine ───────────────────────────────────────────────────────

def score_deal(listing: VehicleListing) -> Optional[DealAlert]:
    """
    Multi-factor deal scoring.
    Returns DealAlert if listing clears the deal threshold.
    """
    if not listing.mmr_value or listing.listing_price <= 0:
        return None

    discount_pct = (listing.mmr_value - listing.listing_price) / listing.mmr_value

    if discount_pct < DEAL_THRESHOLD_PCT:
        return None  # Not enough below MMR

    listing.discount_pct = discount_pct

    # Base score from discount depth (max 60 pts)
    score = min(60.0, discount_pct * 200)

    # Condition bonus (max 20 pts) — higher grade = more confident in MMR comparison
    if listing.condition_grade:
        score += (listing.condition_grade / 5.0) * 20

    # Low mileage bonus (max 10 pts)
    if listing.mileage < 30_000:
        score += 10
    elif listing.mileage < 60_000:
        score += 5

    # Condition report available bonus (max 10 pts)
    # (already hydrated by caller if present)
    score = min(100.0, score)

    # Estimated margin: assume ~8% buy/sell friction (transport, recon, fees)
    estimated_profit = listing.mmr_value - listing.listing_price
    friction = listing.listing_price * 0.08
    net_margin = estimated_profit - friction

    reason_parts = [f"{discount_pct:.1%} below MMR (${listing.mmr_value:,.0f})"]
    if listing.condition_grade and listing.condition_grade >= 3.5:
        reason_parts.append(f"grade {listing.condition_grade}/5.0")
    if listing.mileage < 30_000:
        reason_parts.append("low mileage")

    return DealAlert(
        listing=listing,
        deal_score=round(score, 1),
        reason=" · ".join(reason_parts),
        estimated_profit_margin=round(net_margin, 2),
    )

# ── Main Scan Loop ────────────────────────────────────────────────────────────

async def run_deal_scan(search_params: dict) -> list[DealAlert]:
    """
    Full pipeline: search inventory → fetch MMR for each → score → return deals.
    """
    api = ManheimClient()
    deals: list[DealAlert] = []

    try:
        print(f"[{datetime.now().isoformat()}] Scanning Manheim inventory...")
        raw = await api.search_inventory(**search_params)
        items = raw.get("items", [])
        print(f"  Found {len(items)} listings matching criteria")

        # Fetch MMR concurrently — batch to respect rate limits
        async def enrich_listing(item: dict) -> Optional[DealAlert]:
            try:
                listing = VehicleListing(
                    vin              = item["vin"],
                    year             = item["year"],
                    make             = item["make"],
                    model            = item["model"],
                    trim             = item.get("trim"),
                    mileage          = item.get("odometer", 0),
                    condition_grade  = item.get("conditionGrade"),
                    auction_location = item.get("locationName", "Unknown"),
                    sale_date        = item.get("saleDate", ""),
                    listing_price    = float(item.get("price", 0)),
                    run_number       = item.get("runNumber"),
                )
                listing.mmr_value = await api.get_mmr(listing.vin, listing.mileage)
                return score_deal(listing)
            except Exception as e:
                print(f"  [warn] Failed to enrich {item.get('vin', '?')}: {e}")
                return None

        # Process in batches of 10 to avoid hammering rate limits
        batch_size = 10
        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]
            results = await asyncio.gather(*[enrich_listing(item) for item in batch])
            deals.extend(r for r in results if r is not None)
            await asyncio.sleep(0.5)  # rate limit courtesy

        deals.sort(key=lambda d: d.deal_score, reverse=True)
        print(f"  Surfaced {len(deals)} deals above {DEAL_THRESHOLD_PCT:.0%} threshold")
        return deals

    finally:
        await api.close()

# ── CLI Output ────────────────────────────────────────────────────────────────

def print_deals(deals: list[DealAlert]):
    from rich.console import Console
    from rich.table import Table

    console = Console()
    tbl = Table(title=f"🔥 Manheim Deal Report — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    tbl.add_column("Score",    style="green bold", width=6)
    tbl.add_column("Vehicle",  width=28)
    tbl.add_column("Miles",    justify="right", width=8)
    tbl.add_column("List $",   justify="right", width=10)
    tbl.add_column("MMR $",    justify="right", width=10)
    tbl.add_column("Discount", justify="right", width=9)
    tbl.add_column("Est. Net", justify="right", width=10)
    tbl.add_column("Location", width=20)
    tbl.add_column("Sale Date", width=12)

    for d in deals:
        l = d.listing
        tbl.add_row(
            str(d.deal_score),
            f"{l.year} {l.make} {l.model} {l.trim or ''}".strip(),
            f"{l.mileage:,}",
            f"${l.listing_price:,.0f}",
            f"${l.mmr_value:,.0f}",
            f"{l.discount_pct:.1%}",
            f"${d.estimated_profit_margin:,.0f}",
            l.auction_location,
            l.sale_date,
        )

    console.print(tbl)

# ── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Customize your search criteria here
    SEARCH = {
        "makes":       ["Toyota", "Honda", "Ford", "Chevrolet"],
        "year_min":    2018,
        "year_max":    2023,
        "mileage_max": 80_000,
        "condition_min": 3.0,   # Manheim grade 3.0+ (good condition)
        "limit":       200,
    }

    deals = asyncio.run(run_deal_scan(SEARCH))
    print_deals(deals)
