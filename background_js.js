// Service worker — handles scheduled scans + sell trigger routing

const BACKEND = "http://localhost:8000";

// ── Alarm: scheduled scan every 30 min ──────────────────────────────────────
chrome.alarms.create("deal-scan", { periodInMinutes: 30 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "deal-scan") return;
  try {
    const res = await fetch(`${BACKEND}/scan`, { method: "POST" });
    const data = await res.json();
    const hot  = (data.deals || []).filter(d => d.score >= 80);
    if (hot.length) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: `${hot.length} hot deal${hot.length > 1 ? "s" : ""} found`,
        message: hot.slice(0, 3).map(d =>
          `${d.year} ${d.make} ${d.model} — ${(d.discount_pct * 100).toFixed(0)}% below MMR`
        ).join("\n"),
      });
    }
  } catch { /* backend offline */ }
});

// ── Message router ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "TRIGGER_SELL") {
    triggerSellWorkflow(msg.deal).then(sendResponse);
    return true; // async response
  }
  if (msg.type === "GET_DEALS") {
    fetch(`${BACKEND}/deals`)
      .then(r => r.json())
      .then(sendResponse)
      .catch(() => sendResponse({ deals: [] }));
    return true;
  }
  if (msg.type === "SET_THRESHOLD") {
    chrome.storage.sync.set({ threshold: msg.value });
  }
});

async function triggerSellWorkflow(deal) {
  try {
    const res = await fetch(`${BACKEND}/sell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deal),
    });
    return await res.json();
  } catch (e) {
    return { error: e.message };
  }
}
