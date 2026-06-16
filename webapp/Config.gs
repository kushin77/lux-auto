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
  CACHE_SECONDS: 90,           // dashboard snapshot cache
  MMR_CACHE_SECONDS: 21600,    // per-VIN MMR cache = 6h (CacheService max)
  MAX_FETCH_RETRIES: 4,        // total attempts on 429 / 5xx before giving up
  MAX_BID_FACTOR: 0.92,        // recommended max bid = MMR × this
  // Canonical pipeline stage order for the board (mirrors the CRM pipeline).
  STAGE_ORDER: ['Spotted', 'Watching', 'Won', 'In Transport', 'Recon', 'Listed', 'Sold', 'Passed / Arbitrated'],
  HOT_SCORE: 70
});

/**
 * Exotic-aware scoring tuning (CLAUDE.md §5).
 *   RARITY          — score multiplier for the rarest makes.
 *   EXOTIC_MILEAGE  — bonus points by mileage band for exotics (first match wins).
 */
var SCORING = Object.freeze({
  RARITY: {
    'Bugatti': 1.20, 'Ferrari': 1.15, 'Lamborghini': 1.15, 'McLaren': 1.10,
    'Rolls-Royce': 1.10, 'Bentley': 1.08, 'Aston Martin': 1.08,
    'Maserati': 1.05, 'Porsche': 1.05
  },
  EXOTIC_MILEAGE: [
    { max: 2000,  pts: 20 }, { max: 5000,  pts: 15 }, { max: 10000, pts: 10 },
    { max: 25000, pts: 6 },  { max: 50000, pts: 3 }
  ]
});

/** Exponential backoff with jitter (ms) for retryable HTTP failures. */
function backoffMs_(attempt) {
  var base = 400 * Math.pow(2, Math.max(0, attempt - 1)); // 400, 800, 1600, 3200...
  return Math.min(8000, base) + Math.floor(Math.random() * 250);
}

/**
 * Runs fn() while holding the script lock so overlapping time-driven triggers
 * (e.g. two scans, or a scan + a sync) cannot race on the spreadsheet. If the
 * lock can't be acquired quickly, the run is skipped (not queued) — the next
 * scheduled run will pick the work up. Not reentrant: only wrap top-level
 * entry points, never nested calls.
 *
 * @param  {string}   label      short name for logging
 * @param  {Function} fn         work to run under the lock
 * @param  {number}   [waitMs]   how long to wait for the lock (default 1500ms)
 * @return {*}        fn()'s return, or {ok:false, skipped:true} if locked out
 */
function withLock_(label, fn, waitMs) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(waitMs || 1500)) {
    console.warn('withLock_: "' + label + '" skipped — another run holds the lock');
    return { ok: false, skipped: true, reason: 'locked' };
  }
  try {
    return fn();
  } finally {
    try { lock.releaseLock(); } catch (e) { /* lock auto-releases at end of execution */ }
  }
}

// ── Input validation / normalization ──────────────────────────────────────────

/** Uppercases and strips non-VIN characters (VINs never contain I, O, or Q). */
function normalizeVin_(vin) {
  return String(vin || '').toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
}

/** True only for a full, well-formed 17-character VIN. */
function isValidVin_(vin) {
  return normalizeVin_(vin).length === 17;
}

/** Coerces to a finite number, else the fallback (default 0). */
function toNum_(v, fallback) {
  var n = Number(v);
  return isFinite(n) ? n : (fallback || 0);
}

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
