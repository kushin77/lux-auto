/**
 * Lux Auto — Time-based trigger management.
 *
 * Run setupTriggers() ONCE from the Apps Script editor (or via the webapp admin
 * menu) to install the scheduled jobs. Run removeTriggers() to clean up.
 *
 * Installed triggers:
 *   syncGHLToSheets   — every hour  (keeps Sheets mirror fresh)
 *   runManheimScan    — daily at 6 AM ET (deal alert sweep)
 *   sendDailyDigest   — daily at 7 AM ET (email/Chat summary of new deals)
 *
 * Both functions are idempotent — calling setupTriggers() twice will not create
 * duplicate triggers because we check by handler name first.
 */

// ── Setup / teardown ──────────────────────────────────────────────────────────

/**
 * Installs the two scheduled triggers. Safe to call multiple times.
 * Returns a summary of what was created vs already present.
 */
function setupTriggers() {
  var created = [];
  var skipped = [];

  var existing = ScriptApp.getProjectTriggers().map(function (t) {
    return t.getHandlerFunction();
  });

  // Hourly GHL → Sheets sync
  if (existing.indexOf('syncGHLToSheets') === -1) {
    ScriptApp.newTrigger('syncGHLToSheets')
      .timeBased()
      .everyHours(1)
      .create();
    created.push('syncGHLToSheets (every hour)');
  } else {
    skipped.push('syncGHLToSheets');
  }

  // Daily Manheim scan at 6–7 AM ET
  if (existing.indexOf('runManheimScan') === -1) {
    ScriptApp.newTrigger('runManheimScan')
      .timeBased()
      .atHour(6)
      .everyDays(1)
      .inTimezone('America/New_York')
      .create();
    created.push('runManheimScan (daily 6 AM ET)');
  } else {
    skipped.push('runManheimScan');
  }

  // Daily digest at 7 AM ET (after the scan)
  if (existing.indexOf('sendDailyDigest') === -1) {
    ScriptApp.newTrigger('sendDailyDigest')
      .timeBased()
      .atHour(7)
      .everyDays(1)
      .inTimezone('America/New_York')
      .create();
    created.push('sendDailyDigest (daily 7 AM ET)');
  } else {
    skipped.push('sendDailyDigest');
  }

  var msg = 'Triggers set up.\n'
    + (created.length ? 'Created: ' + created.join(', ') + '\n' : '')
    + (skipped.length ? 'Already present: ' + skipped.join(', ') : '');

  console.log(msg);
  logActivity_('setup_triggers', msg);
  return { created: created, skipped: skipped };
}

/**
 * Removes ALL project triggers. Use before reinstalling or during teardown.
 */
function removeTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (t) { ScriptApp.deleteTrigger(t); });
  var msg = 'Removed ' + triggers.length + ' trigger(s)';
  console.log(msg);
  logActivity_('remove_triggers', msg);
  return { removed: triggers.length };
}

/**
 * Lists installed triggers — useful for diagnostics.
 */
function listTriggers() {
  return ScriptApp.getProjectTriggers().map(function (t) {
    return {
      handler: t.getHandlerFunction(),
      type   : t.getEventType().toString(),
      source : t.getTriggerSource().toString()
    };
  });
}

// ── Admin UI helpers (called via google.script.run from the browser) ──────────

/**
 * Exposed to the frontend admin menu: lets an admin force a Sheets sync
 * and a Manheim scan from the Command Center UI without visiting the editor.
 */
function adminSyncNow() {
  assertAdmin_();
  syncGHLToSheets();
  return { ok: true, action: 'ghl_sync', at: new Date().toISOString() };
}

function adminManheimScanNow() {
  assertAdmin_();
  var result = runManheimScan();
  result.ok = true;
  result.at = new Date().toISOString();
  return result;
}

function adminSetupTriggers() {
  assertAdmin_();
  return setupTriggers();
}

function adminGetTriggers() {
  assertAdmin_();
  return listTriggers();
}

/** Admin: create the GHL custom-field schema (idempotent). Run once after the token is set. */
function adminSetupGHLFields() {
  assertAdmin_();
  return setupGHLCustomFields_();
}

/** Admin: send the daily digest immediately (test / on-demand). */
function adminSendDigest() {
  assertAdmin_();
  return sendDailyDigest();
}
