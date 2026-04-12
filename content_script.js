// Manheim Deal Finder — Content Script
// Injects deal score badges onto listing cards in real time.
// Communicates with local FastAPI backend (localhost:8000).

const BACKEND = "http://localhost:8000";
const BADGE_ATTR = "data-deal-scored";

// ── Selectors (update if Manheim redesigns their DOM) ────────────────────────
const SELECTORS = {
  listingCard:  ".vehicle-card, .srp-list-item, [data-vehicle-id]",
  vin:          "[data-vin], .vin-number, [class*='vin']",
  price:        "[class*='price'], [data-price]",
  mileage:      "[class*='mileage'], [class*='odometer']",
  title:        "[class*='vehicle-title'], [class*='year-make-model']",
};

// ── Main ─────────────────────────────────────────────────────────────────────
function extractVin(card) {
  const el = card.querySelector(SELECTORS.vin);
  if (el) return (el.dataset.vin || el.textContent || "").trim().replace(/\s/g, "");
  // Fallback: scan text nodes for VIN pattern (17 alphanum)
  const text = card.innerText || "";
  const match = text.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
  return match ? match[0] : null;
}

function extractPrice(card) {
  const el = card.querySelector(SELECTORS.price);
  if (!el) return 0;
  return parseFloat((el.dataset.price || el.textContent).replace(/[^0-9.]/g, "")) || 0;
}

function extractMileage(card) {
  const el = card.querySelector(SELECTORS.mileage);
  if (!el) return 0;
  return parseInt((el.textContent || "").replace(/[^0-9]/g, "")) || 0;
}

async function scoreListing(vin, price, mileage) {
  try {
    const res = await fetch(`${BACKEND}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vin, listing_price: price, mileage }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // backend offline — fail silently
  }
}

function badgeColor(score) {
  if (score >= 80) return { bg: "#1a6b3c", text: "#6effa8", label: "HOT DEAL" };
  if (score >= 60) return { bg: "#7a4f00", text: "#ffc84a", label: "GOOD DEAL" };
  if (score >= 40) return { bg: "#1a3a5c", text: "#7ec8ff", label: "WATCH" };
  return { bg: "#3a1a1a", text: "#ff9090", label: "PASS" };
}

function injectBadge(card, data) {
  // Remove existing badge
  card.querySelector(".mdf-badge")?.remove();

  const { score, mmr_value, discount_pct, estimated_profit_margin } = data;
  const { bg, text, label } = badgeColor(score);

  const badge = document.createElement("div");
  badge.className = "mdf-badge";
  badge.innerHTML = `
    <div class="mdf-label">${label}</div>
    <div class="mdf-score">${score.toFixed(0)}<span>/100</span></div>
    <div class="mdf-row"><span>MMR</span><strong>$${mmr_value?.toLocaleString() ?? "—"}</strong></div>
    <div class="mdf-row"><span>Below MMR</span><strong>${discount_pct != null ? (discount_pct * 100).toFixed(1) + "%" : "—"}</strong></div>
    <div class="mdf-row"><span>Est. net</span><strong>$${estimated_profit_margin?.toLocaleString() ?? "—"}</strong></div>
    <button class="mdf-act" data-action="sell">▶ Start selling</button>
  `;
  badge.style.cssText = `--bg:${bg};--txt:${text}`;

  badge.querySelector(".mdf-act").addEventListener("click", (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: "TRIGGER_SELL", deal: data });
  });

  // Prepend inside card
  card.style.position = "relative";
  card.prepend(badge);
}

async function processCard(card) {
  if (card.getAttribute(BADGE_ATTR)) return;
  card.setAttribute(BADGE_ATTR, "1");

  const vin     = extractVin(card);
  const price   = extractPrice(card);
  const mileage = extractMileage(card);
  if (!vin) return;

  const data = await scoreListing(vin, price, mileage);
  if (!data) return;

  // Only inject badge if score is above minimum threshold
  const { threshold } = await chrome.storage.sync.get({ threshold: 40 });
  if (data.score >= threshold) injectBadge(card, { ...data, vin });
}

// ── Observer: handle infinite scroll / SPA navigation ────────────────────────
function scanCards() {
  document.querySelectorAll(SELECTORS.listingCard).forEach(processCard);
}

const observer = new MutationObserver(() => scanCards());
observer.observe(document.body, { childList: true, subtree: true });
scanCards(); // initial scan on load
