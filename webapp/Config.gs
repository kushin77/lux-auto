/**
 * Lux Auto — Command Center (Google Apps Script web app)
 * Config & Script Properties access.
 *
 * All secrets live in Script Properties (Project Settings → Script properties).
 * They are NEVER in code and NEVER sent to the browser.
 *
 * ── Required ──────────────────────────────────────────────────────────────────
 *   LC_API_TOKEN          — GHL Private Integration bearer token
 *   LC_LOCATION_ID        — GHL location / sub-account ID
 *
 * ── Access control ────────────────────────────────────────────────────────────
 *   ALLOWED_EMAILS        — comma-separated allowlist (blank = anyone in domain)
 *   ADMIN_EMAILS          — comma-separated admins (can move deals, run scans)
 *
 * ── Manheim (optional — enables deal scan + MMR lookup) ──────────────────────
 *   MANHEIM_CLIENT_ID     — Manheim developer API client ID
 *   MANHEIM_CLIENT_SECRET — Manheim developer API client secret
 *   MH_DEAL_THRESHOLD     — Min discount % to flag as deal (default: 0.15 = 15%)
 *   MH_MAX_MILEAGE        — Skip vehicles above this mileage (default: 100000)
 *   MH_SEARCH_QUERY       — Comma-separated makes to scan (default: exotic makes)
 *
 * ── Google Sheets (auto-managed) ─────────────────────────────────────────────
 *   SHEETS_ID             — Spreadsheet ID (auto-created on first sync if blank)
 *
 * The CRM vendor is an invisible backend — nothing is surfaced to the UI by name.
 */

var APP = Object.freeze({
  NAME: 'Lux Auto — Command Center',
  API_BASE: 'https://services.leadconnectorhq.com',
  API_VERSION: '2021-07-28',
  CACHE_SECONDS: 90,
  // Canonical pipeline stage order for the board (mirrors the CRM pipeline).
  STAGE_ORDER: ['Spotted', 'Watching', 'Won', 'In Transport', 'Recon', 'Listed', 'Sold', 'Passed / Arbitrated'],
  HOT_SCORE: 70
});

function props_() {
  return PropertiesService.getScriptProperties();
}

function prop_(key, fallback) {
  var v = props_().getProperty(key);
  return (v === null || v === undefined || v === '') ? (fallback || '') : v;
}

function apiToken_()   { return prop_('LC_API_TOKEN', ''); }
function locationId_() { return prop_('LC_LOCATION_ID', ''); }

/** Demo mode when the backend isn't wired yet — the UI still works with sample data. */
function isDemo_() { return !apiToken_() || !locationId_(); }

function emailList_(key) {
  return prop_(key, '')
    .split(',')
    .map(function (s) { return s.trim().toLowerCase(); })
    .filter(function (s) { return s; });
}
