/**
 * Lux Auto — Diagnostics / health check (server-side, admin-gated).
 *
 * Reports configuration + wiring status so an operator can confirm the engine is
 * production-ready WITHOUT ever exposing a secret value (only booleans for which
 * Script Properties are set). Callable from the Apps Script editor or the
 * Command Center via google.script.run.
 */

/** Admin-callable health check. */
function adminHealthCheck() {
  assertAdmin_();
  return healthCheck_();
}

function healthCheck_() {
  var out = {
    app: APP.NAME,
    checkedAt: new Date().toISOString(),
    demoMode: isDemo_(),
    config: {},
    triggers: [],
    sheets: {},
    ghl: { reachable: null },
    manheim: { configured: !!mhClientId_(), scope: mhScope_() },
    issues: []
  };

  // Config presence — booleans only, never values.
  ['LC_API_TOKEN', 'LC_LOCATION_ID', 'MANHEIM_CLIENT_ID', 'MANHEIM_CLIENT_SECRET',
   'MH_API_SCOPE', 'ADMIN_EMAILS', 'ALLOWED_EMAILS', 'CHAT_WEBHOOK_URL', 'SHEETS_ID'
  ].forEach(function (k) { out.config[k] = !!prop_(k, ''); });

  if (!out.config.ADMIN_EMAILS) out.issues.push('ADMIN_EMAILS not set — no admins and no digest recipients.');
  if (out.demoMode) out.issues.push('Demo mode — set LC_API_TOKEN + LC_LOCATION_ID to go live.');
  if (!out.manheim.configured) out.issues.push('Manheim not configured — scans will no-op.');

  // Triggers
  try {
    out.triggers = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  } catch (e) { out.issues.push('Cannot read triggers: ' + e.message); }
  ['runManheimScan', 'syncGHLToSheets', 'sendDailyDigest'].forEach(function (h) {
    if (out.triggers.indexOf(h) === -1) out.issues.push('Trigger missing: ' + h + ' — run setupTriggers().');
  });

  // Sheets (row counts, not contents)
  try {
    var ss = getSpreadsheet_();
    out.sheets.url = ss.getUrl();
    ['Deals', 'Buyers', 'Manheim Deals', 'VIN Index', 'Activity Log', 'System Log'].forEach(function (name) {
      var sh = ss.getSheetByName(name);
      out.sheets[name] = sh ? Math.max(0, sh.getLastRow() - 1) : 'missing';
    });
  } catch (e) { out.issues.push('Cannot open spreadsheet: ' + e.message); }

  // GHL reachability (only when live)
  if (!isDemo_()) {
    try {
      var p = getPipeline_();
      out.ghl.reachable = true;
      out.ghl.stages = Object.keys(p.stageIdByName || {}).length;
    } catch (e) {
      out.ghl.reachable = false;
      out.issues.push('GHL pipeline not reachable: ' + e.message);
    }
  }

  out.ok = out.issues.length === 0;
  return out;
}
