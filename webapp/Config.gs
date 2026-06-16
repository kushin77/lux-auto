/**
 * Lux Auto — Command Center (Google Apps Script web app)
 * Config & Script Properties access.
 *
 * Secrets live in Script Properties (Project Settings → Script properties),
 * never in code and never sent to the browser:
 *   LC_API_TOKEN    — CRM backend Private Integration token
 *   LC_LOCATION_ID  — CRM backend location id
 *   ALLOWED_EMAILS  — comma-separated allowlist (optional; blank = anyone in domain)
 *   ADMIN_EMAILS    — comma-separated admins (can approve/reject)
 *
 * The CRM vendor is an invisible backend. Nothing here is surfaced to the UI by name.
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
