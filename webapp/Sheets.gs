/**
 * Lux Auto — Google Sheets data layer.
 *
 * Stores a live mirror of GHL deals + buyers, a VIN-deduped Manheim alert feed,
 * an activity log, and a system/error log — all in a single Google Spreadsheet
 * owned by the script user.
 *
 * Spreadsheet ID is stored in Script Properties as SHEETS_ID.
 * If SHEETS_ID is blank the first call creates the spreadsheet and saves the ID.
 *
 * Sheet layout:
 *   "Deals"         — current GHL opportunity snapshot (overwritten on each sync)
 *   "Buyers"        — current GHL contact snapshot (overwritten on each sync)
 *   "Manheim Deals" — Manheim deal alerts, UPSERTED by VIN (no duplicates)
 *   "VIN Index"     — VIN → GHL opportunityId map (managed by Api.gs)
 *   "Activity Log"  — audit trail of all admin actions (append-only)
 *   "System Log"    — structured error log (append-only)
 */

// ── Column definitions ────────────────────────────────────────────────────────

var DEAL_HEADERS   = ['ID','Title','VIN','Year','Make','Score','Value ($)','Stage','Status','Source','Updated'];
var BUYER_HEADERS  = ['ID','Name','Email','Phone','Makes','Max Price ($)','City','State'];
// NOTE: 'Max Bid' is appended at the END so existing column indexes (used by
// SellerPortal.gs getManheimAlerts) stay stable. Do not insert columns mid-table.
var MH_HEADERS     = ['Scanned At','VIN','Year','Make','Model','Mileage','Condition','Location',
                      'Sale Date','Listing Price','MMR Value','Discount %','Deal Score',
                      'Est. Profit','Reason','Max Bid'];
var LOG_HEADERS    = ['Timestamp','User','Action','Details'];
var SYSLOG_HEADERS = ['Timestamp','Context','Message','Stack'];

var MH_VIN_COL   = 2;   // 'VIN' column (1-based) in MH_HEADERS
var MH_SCORE_COL = 13;  // 'Deal Score' column (1-based) in MH_HEADERS

// ── Spreadsheet bootstrap ─────────────────────────────────────────────────────

/**
 * Returns (creating if necessary) the Lux Auto spreadsheet.
 * Saves the spreadsheet ID to Script Properties on first creation.
 */
function getSpreadsheet_() {
  var id = prop_('SHEETS_ID', '');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* stale ID — recreate */ }
  }
  var ss = SpreadsheetApp.create('Lux Auto — Command Center Data');
  props_().setProperty('SHEETS_ID', ss.getId());
  ss.getSheets()[0].setName('_setup');
  return ss;
}

/**
 * Returns the named sheet, creating it with a header row if it doesn't exist.
 */
function getOrCreateSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#1a1a2e')
      .setFontColor('#e0e0e0')
      .setFontWeight('bold');
    sheet.setColumnWidths(1, headers.length, 130);
  }
  return sheet;
}

// ── Public: open the spreadsheet ─────────────────────────────────────────────

/** Called from the webapp or Makefile link — returns the spreadsheet URL. */
function getSheetsUrl() {
  return getSpreadsheet_().getUrl();
}

// ── Deals sync ───────────────────────────────────────────────────────────────

/**
 * Overwrites the "Deals" sheet with the current GHL snapshot.
 * @param {Array} deals — array of deal objects from liveSnapshot_()
 */
function syncDealsToSheets_(deals) {
  var ss    = getSpreadsheet_();
  var sheet = getOrCreateSheet_(ss, 'Deals', DEAL_HEADERS);

  var last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, DEAL_HEADERS.length).clearContent();

  if (!deals || !deals.length) return;

  var rows = deals.map(function (d) {
    return [d.id, d.title, d.vin || '', d.year || '', d.make || '',
            d.score || 0, d.value || 0, d.stage || '', d.status || '',
            d.source || '', d.updated ? new Date(d.updated).toLocaleString() : ''];
  });
  sheet.getRange(2, 1, rows.length, DEAL_HEADERS.length).setValues(rows);

  // Colour-code by score: ≥70 green, 50-69 yellow, <50 white
  var bg = rows.map(function (r) {
    var s = r[5];
    return [s >= 70 ? '#d9ead3' : s >= 50 ? '#fff2cc' : '#ffffff'];
  });
  sheet.getRange(2, 6, bg.length, 1).setBackgrounds(bg);
}

// ── Buyers sync ──────────────────────────────────────────────────────────────

/**
 * Overwrites the "Buyers" sheet with the current GHL contact snapshot.
 * @param {Array} buyers — array of buyer objects from liveSnapshot_()
 */
function syncBuyersToSheets_(buyers) {
  var ss    = getSpreadsheet_();
  var sheet = getOrCreateSheet_(ss, 'Buyers', BUYER_HEADERS);

  var last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, BUYER_HEADERS.length).clearContent();

  if (!buyers || !buyers.length) return;

  var rows = buyers.map(function (b) {
    return [b.id, b.name, b.email || '', b.phone || '',
            b.makes || '', b.maxPrice || 0, b.city || '', b.state || ''];
  });
  sheet.getRange(2, 1, rows.length, BUYER_HEADERS.length).setValues(rows);
}

// ── Manheim alerts (UPSERT by VIN, batched) ───────────────────────────────────

/**
 * Builds one Manheim Deals row from a deal alert object.
 */
function alertRow_(a) {
  var v = a.listing;
  return [
    new Date().toLocaleString(),
    v.vin || '', v.year || '', v.make || '', v.model || '', v.mileage || 0,
    v.conditionGrade || '', v.auctionLocation || '', v.saleDate || '',
    v.listingPrice || 0, v.mmrValue || 0,
    (a.discountPct != null ? (a.discountPct * 100).toFixed(1) + '%' : ''),
    a.dealScore || 0,
    a.estimatedProfitMargin || 0,
    a.reason || '',
    a.maxBid || 0
  ];
}

/**
 * Collapses duplicate VINs within a batch of alerts, keeping the LAST occurrence
 * (most recent score wins). Pure function — unit-tested in Tests.gs.
 * @param  {Array} alerts
 * @return {Array}
 */
function dedupeAlertsByVin_(alerts) {
  var seen = {}, out = [];
  for (var i = (alerts || []).length - 1; i >= 0; i--) {
    var vin = (alerts[i].listing && alerts[i].listing.vin) ? alerts[i].listing.vin.toString() : '';
    if (vin) { if (seen[vin]) continue; seen[vin] = true; }
    out.unshift(alerts[i]);
  }
  return out;
}

/**
 * Upserts Manheim deal alerts by VIN — updates the existing row in place when the
 * VIN is already present, otherwise appends. All writes are batched. Idempotent:
 * re-scans never create duplicate rows for the same VIN (CLAUDE.md prime rule).
 *
 * @param  {Array} alerts — deal alert objects from buildDealAlert_()
 * @return {{updated:number, inserted:number}}
 */
function upsertManheimAlerts_(alerts) {
  if (!alerts || !alerts.length) return { updated: 0, inserted: 0 };

  // Collapse duplicate VINs within this batch (last wins) before touching the sheet.
  alerts = dedupeAlertsByVin_(alerts);

  var ss    = getSpreadsheet_();
  var sheet = getOrCreateSheet_(ss, 'Manheim Deals', MH_HEADERS);

  // Keep the header row in sync with MH_HEADERS (handles added columns like Max Bid).
  sheet.getRange(1, 1, 1, MH_HEADERS.length).setValues([MH_HEADERS]);

  // Index existing VINs → row number (read the VIN column once).
  var lastRow = sheet.getLastRow();
  var index = {};
  if (lastRow > 1) {
    var vins = sheet.getRange(2, MH_VIN_COL, lastRow - 1, 1).getValues();
    for (var i = 0; i < vins.length; i++) {
      var vv = (vins[i][0] || '').toString();
      if (vv) index[vv] = i + 2;
    }
  }

  var updated = 0, inserted = 0;
  var inserts = [];

  alerts.forEach(function (a) {
    var row = alertRow_(a);
    var vin = (a.listing && a.listing.vin) ? a.listing.vin.toString() : '';
    if (vin && index[vin]) {
      sheet.getRange(index[vin], 1, 1, MH_HEADERS.length).setValues([row]);
      updated++;
    } else {
      inserts.push(row);
    }
  });

  if (inserts.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, inserts.length, MH_HEADERS.length).setValues(inserts);
    inserted = inserts.length;
  }

  colorScoreColumn_(sheet);
  return { updated: updated, inserted: inserted };
}

/** Back-compat single-alert helper — delegates to the batched upsert. */
function appendManheimAlert_(alert) {
  return upsertManheimAlerts_([alert]);
}

/** Re-applies score colour bands to the whole Manheim Deals data range. */
function colorScoreColumn_(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return;
  var n = last - 1;
  var scores = sheet.getRange(2, MH_SCORE_COL, n, 1).getValues();
  var bg = [];
  for (var i = 0; i < n; i++) {
    var s = Number(scores[i][0] || 0);
    bg.push([s >= 70 ? '#d9ead3' : s >= 50 ? '#fff2cc' : '#ffffff']);
  }
  sheet.getRange(2, MH_SCORE_COL, n, 1).setBackgrounds(bg);
}

// ── Activity + System logs ────────────────────────────────────────────────────

/**
 * Appends one line to the Activity Log sheet (audit trail).
 */
function logActivity_(action, details) {
  try {
    var ss    = getSpreadsheet_();
    var sheet = getOrCreateSheet_(ss, 'Activity Log', LOG_HEADERS);
    var user  = Session.getActiveUser().getEmail() || 'system';
    sheet.appendRow([new Date().toLocaleString(), user, action, details || '']);
  } catch (e) {
    console.warn('logActivity_ failed:', e.message);
  }
}

/**
 * Structured error logger — writes to the System Log sheet and console.
 * Never throws (logging must not break the caller).
 */
function logError_(context, error) {
  var msg   = (error && error.message) ? error.message : String(error);
  var stack = (error && error.stack) ? String(error.stack).substring(0, 500) : '';
  try {
    var ss    = getSpreadsheet_();
    var sheet = getOrCreateSheet_(ss, 'System Log', SYSLOG_HEADERS);
    sheet.appendRow([new Date().toLocaleString(), context || '', msg, stack]);
  } catch (e) {
    console.error('logError_ failed: ' + (e && e.message));
  }
  console.error('[' + (context || '') + '] ' + msg);
}

// ── Full sync (called by trigger or manually) ─────────────────────────────────

/**
 * Pulls live GHL data and writes it to Sheets.
 * Safe to call from a time-based trigger.
 */
function syncGHLToSheets() {
  return withLock_('sync_ghl', syncGHLToSheets_, 2000);
}

function syncGHLToSheets_() {
  if (isDemo_()) {
    console.log('syncGHLToSheets: demo mode — skipping live fetch');
    return { ok: false, demo: true };
  }
  var snap = liveSnapshot_();
  syncDealsToSheets_(snap.deals || []);
  syncBuyersToSheets_(snap.buyers || []);
  logActivity_('sync_ghl', 'Synced ' + (snap.deals || []).length + ' deals, ' + (snap.buyers || []).length + ' buyers');
  console.log('GHL → Sheets sync complete');
  return { ok: true, deals: (snap.deals || []).length, buyers: (snap.buyers || []).length };
}
