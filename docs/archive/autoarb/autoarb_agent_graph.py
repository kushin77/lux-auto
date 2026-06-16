"""
AutoArb Deal Agent — LangGraph graph definition
================================================
Full autonomous pipeline: scan → enrich → score → human_gate → bid → match → close
Each node is a Claude API call with full deal context.

pip install langgraph anthropic httpx pgvector psycopg2-binary
"""

from typing import TypedDict, Annotated, Optional
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.postgres import PostgresSaver
import anthropic
import operator
import json

client = anthropic.Anthropic()

# ── State ─────────────────────────────────────────────────────────────────────

class DealState(TypedDict):
    # Vehicle
    vin: str
    year: int
    make: str
    model: str
    trim: Optional[str]
    mileage: int
    condition_grade: Optional[float]
    listing_price: float
    auction_location: str
    sale_date: str
    images: list[str]

    # Enrichment
    mmr_value: Optional[float]
    carfax_summary: Optional[str]
    transport_cost_estimate: Optional[float]
    recon_estimate: Optional[float]

    # Scoring
    deal_score: Optional[float]
    discount_pct: Optional[float]
    estimated_net_margin: Optional[float]
    score_reasoning: Optional[str]

    # Decisioning
    human_approval_required: bool
    human_approved: Optional[bool]
    bid_amount: Optional[float]
    bid_reasoning: Optional[str]
    bid_submitted: bool

    # Buyer matching
    matched_buyers: list[dict]
    buyer_outreach_sent: bool
    buyer_accepted: Optional[dict]

    # Closing
    contract_sent: bool
    payment_received: bool
    transport_booked: bool
    deal_closed: bool

    # Meta
    tenant_id: str
    agent_messages: Annotated[list, operator.add]
    errors: Annotated[list, operator.add]

# ── Helpers ───────────────────────────────────────────────────────────────────

def claude_call(system: str, user: str, tools: list = None, max_tokens: int = 1000) -> str:
    kwargs = dict(
        model="claude-sonnet-4-20250514",
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    if tools:
        kwargs["tools"] = tools
    resp = client.messages.create(**kwargs)
    return resp.content[0].text if resp.content else ""

AGENT_SYSTEM = """You are AutoArb, an expert wholesale auto arbitrage AI agent.
You have deep knowledge of Manheim auction dynamics, MMR valuations, dealer margins,
transport logistics, and retail market conditions.
Be decisive. Output structured JSON when asked. Think like a 20-year floor buyer."""

# ── Nodes ─────────────────────────────────────────────────────────────────────

async def enrich_node(state: DealState) -> DealState:
    """Fetch MMR, CarFax summary, transport estimate, recon estimate."""
    from backend.integrations import fetch_mmr, fetch_carfax_summary, estimate_transport

    mmr = await fetch_mmr(state["vin"], state["mileage"])
    carfax = await fetch_carfax_summary(state["vin"])
    transport = await estimate_transport(
        origin=state["auction_location"],
        tenant_id=state["tenant_id"]
    )

    # Use Claude to summarize CarFax into a deal-relevant note
    if carfax:
        summary = claude_call(
            AGENT_SYSTEM,
            f"Summarize this CarFax report for a wholesale buyer in 2 sentences. "
            f"Flag any deal-breakers (accidents, title issues, salvage). "
            f"CarFax data: {json.dumps(carfax)}"
        )
    else:
        summary = "No CarFax data available."

    return {
        **state,
        "mmr_value": mmr,
        "carfax_summary": summary,
        "transport_cost_estimate": transport,
        "recon_estimate": 800.0,  # default; override with tenant's avg
        "agent_messages": [f"Enriched VIN {state['vin']}: MMR=${mmr}, transport=${transport}"]
    }

async def score_node(state: DealState) -> DealState:
    """Score the deal using Claude with full context."""
    prompt = f"""Score this wholesale vehicle opportunity. Output valid JSON only.

Vehicle: {state['year']} {state['make']} {state['model']} {state.get('trim','')}
VIN: {state['vin']}
Mileage: {state['mileage']:,}
Condition grade: {state.get('condition_grade', 'unknown')}
Listing price: ${state['listing_price']:,.0f}
MMR value: ${state.get('mmr_value', 0):,.0f}
CarFax: {state.get('carfax_summary', 'N/A')}
Transport estimate: ${state.get('transport_cost_estimate', 800):,.0f}
Recon estimate: ${state.get('recon_estimate', 800):,.0f}

Output JSON:
{{
  "deal_score": <0-100>,
  "discount_pct": <float 0-1>,
  "estimated_net_margin": <float dollars after transport+recon+fees>,
  "score_reasoning": "<2 sentence explanation>",
  "deal_breakers": ["<list any issues>"]
}}"""

    raw = claude_call(AGENT_SYSTEM, prompt, max_tokens=400)
    try:
        data = json.loads(raw)
        return {
            **state,
            "deal_score": data.get("deal_score", 0),
            "discount_pct": data.get("discount_pct", 0),
            "estimated_net_margin": data.get("estimated_net_margin", 0),
            "score_reasoning": data.get("score_reasoning", ""),
            "agent_messages": [f"Scored {state['vin']}: {data.get('deal_score',0)}/100 — {data.get('score_reasoning','')}"]
        }
    except json.JSONDecodeError:
        return {**state, "deal_score": 0, "errors": [f"Score parse error: {raw[:100]}"]}

async def human_gate_node(state: DealState) -> DealState:
    """Determine if human approval is needed based on tenant config."""
    from backend.db import get_tenant_config
    config = await get_tenant_config(state["tenant_id"])

    auto_threshold = config.get("auto_bid_threshold", 80)
    require_approval = (
        state.get("deal_score", 0) < auto_threshold
        or config.get("always_require_approval", False)
        or state.get("listing_price", 0) > config.get("max_auto_bid", 25000)
    )

    if require_approval:
        # Push notification to tenant user (via Kafka event)
        from backend.events import publish_event
        await publish_event("deal.approval_required", {
            "tenant_id": state["tenant_id"],
            "vin": state["vin"],
            "deal_score": state.get("deal_score"),
            "estimated_net_margin": state.get("estimated_net_margin"),
        })

    return {
        **state,
        "human_approval_required": require_approval,
        "agent_messages": [
            f"Human gate: {'approval required' if require_approval else 'auto-proceeding'} "
            f"(score={state.get('deal_score')}, threshold={auto_threshold})"
        ]
    }

def gate_router(state: DealState) -> str:
    """Route: if human approval required and not yet given, pause. Else proceed to bid."""
    if state.get("human_approval_required") and state.get("human_approved") is None:
        return "awaiting_approval"
    if state.get("human_approved") is False:
        return "rejected"
    return "bid"

async def bid_node(state: DealState) -> DealState:
    """Calculate optimal bid and submit to Manheim."""
    prompt = f"""Calculate the optimal bid for this vehicle. Output JSON only.

Listing price: ${state['listing_price']:,.0f}
MMR: ${state.get('mmr_value', 0):,.0f}
Score: {state.get('deal_score', 0)}/100
Est. net margin at listing price: ${state.get('estimated_net_margin', 0):,.0f}
Transport: ${state.get('transport_cost_estimate', 800):,.0f}
Recon: ${state.get('recon_estimate', 800):,.0f}

Rules: target minimum $1,500 net margin after all costs.
Strategy: bid as low as possible while still winning in a typical auction.

Output JSON:
{{
  "bid_amount": <float>,
  "max_bid": <float>,
  "bid_reasoning": "<1 sentence>"
}}"""

    raw = claude_call(AGENT_SYSTEM, prompt, max_tokens=200)
    try:
        data = json.loads(raw)
        bid = data.get("bid_amount", state["listing_price"])

        # Submit bid via Manheim API
        from backend.integrations import submit_manheim_bid
        submitted = await submit_manheim_bid(
            vin=state["vin"],
            bid_amount=bid,
            max_bid=data.get("max_bid", bid),
            tenant_id=state["tenant_id"]
        )

        return {
            **state,
            "bid_amount": bid,
            "bid_reasoning": data.get("bid_reasoning", ""),
            "bid_submitted": submitted,
            "agent_messages": [f"Bid submitted: ${bid:,.0f} on {state['vin']} — {data.get('bid_reasoning','')}"]
        }
    except Exception as e:
        return {**state, "bid_submitted": False, "errors": [f"Bid error: {str(e)}"]}

async def match_buyer_node(state: DealState) -> DealState:
    """Find best-matched buyers using vector search + Claude ranking."""
    from backend.db import search_buyers_by_preference

    # pgvector semantic search on buyer preferences
    candidates = await search_buyers_by_preference(
        make=state["make"],
        model=state["model"],
        year=state["year"],
        mileage=state["mileage"],
        tenant_id=state["tenant_id"],
        limit=10
    )

    if not candidates:
        return {**state, "matched_buyers": [], "agent_messages": ["No buyers matched in network"]}

    # Ask Claude to rank and craft personalized outreach for top 3
    prompt = f"""Rank these buyers for this vehicle and write a personalized 2-sentence outreach 
pitch for each of the top 3. Output JSON only.

Vehicle: {state['year']} {state['make']} {state['model']} — {state['mileage']:,} mi
Our asking price: ${state.get('bid_amount', state['listing_price']) * 1.08:,.0f} (targeting 8% margin)
MMR: ${state.get('mmr_value', 0):,.0f}

Buyers: {json.dumps(candidates[:10], indent=2)}

Output JSON array (top 3 only):
[{{"buyer_id": "...", "match_score": 0-100, "pitch": "...", "suggested_price": 0.0}}]"""

    raw = claude_call(AGENT_SYSTEM, prompt, max_tokens=600)
    try:
        matched = json.loads(raw)

        # Send outreach emails via Gmail MCP
        from backend.integrations import send_buyer_outreach
        for buyer in matched[:3]:
            await send_buyer_outreach(buyer, state, tenant_id=state["tenant_id"])

        return {
            **state,
            "matched_buyers": matched,
            "buyer_outreach_sent": True,
            "agent_messages": [f"Matched {len(matched)} buyers, outreach sent"]
        }
    except Exception as e:
        return {**state, "matched_buyers": [], "errors": [f"Match error: {str(e)}"]}

async def close_node(state: DealState) -> DealState:
    """Send contract, collect payment, book transport."""
    if not state.get("buyer_accepted"):
        return {**state, "deal_closed": False, "agent_messages": ["No buyer accepted yet"]}

    from backend.integrations import (
        send_docusign_contract, charge_buyer_stripe,
        book_uship_transport
    )

    buyer = state["buyer_accepted"]
    sale_price = buyer.get("agreed_price", state.get("bid_amount", 0) * 1.08)

    contract_sent = await send_docusign_contract(
        buyer=buyer, vehicle=state, sale_price=sale_price, tenant_id=state["tenant_id"]
    )
    transport_booked = await book_uship_transport(
        origin=state["auction_location"],
        destination=buyer.get("location"),
        vin=state["vin"]
    )

    return {
        **state,
        "contract_sent": contract_sent,
        "transport_booked": transport_booked,
        "deal_closed": True,
        "agent_messages": [
            f"Deal closed: {state['vin']} → {buyer.get('name')} "
            f"at ${sale_price:,.0f}. Contract + transport booked."
        ]
    }

# ── Build graph ───────────────────────────────────────────────────────────────

def build_deal_graph(checkpointer=None) -> StateGraph:
    g = StateGraph(DealState)

    g.add_node("enrich",        enrich_node)
    g.add_node("score",         score_node)
    g.add_node("human_gate",    human_gate_node)
    g.add_node("bid",           bid_node)
    g.add_node("match_buyer",   match_buyer_node)
    g.add_node("close",         close_node)

    g.set_entry_point("enrich")
    g.add_edge("enrich",     "score")
    g.add_edge("score",      "human_gate")
    g.add_conditional_edges("human_gate", gate_router, {
        "awaiting_approval": END,   # graph pauses; resume on human input
        "rejected": END,
        "bid": "bid",
    })
    g.add_edge("bid",        "match_buyer")
    g.add_edge("match_buyer", "close")
    g.add_edge("close",       END)

    return g.compile(checkpointer=checkpointer)


# ── Resume after human approval ───────────────────────────────────────────────

async def resume_after_approval(thread_id: str, approved: bool, db_conn):
    """Called when a human approves/rejects from the dashboard or mobile app."""
    checkpointer = PostgresSaver(conn=db_conn)
    graph = build_deal_graph(checkpointer=checkpointer)

    await graph.aupdate_state(
        config={"configurable": {"thread_id": thread_id}},
        values={"human_approved": approved}
    )
    # Re-invoke graph from current state
    async for event in graph.astream(None, config={"configurable": {"thread_id": thread_id}}):
        print(event)
