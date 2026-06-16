/**
 * Lux Auto — Google Sheets data layer.
 *
 * Stores a live mirror of GHL deals + buyers, a Manheim alert feed, and an
 * activity log — all in a single Google Spreadsheet owned by the script user.
 *
 * Spreadsheet ID is stored in Script Properties as SHEETS_ID.
 * If SHEETS_ID is blank the first call creates the spreadsheet and saves the ID.
 *
 * Sheet layout:
 *   "Deals"         — current GHL opportunity snapshot (overwritten on each sync)
 *   "Buyers"        — current GHL contact snapshot (overwritten on each sync)
 *   "Manheim Deals" — cumulative Manheim deal alerts (append-only)
 *   "Activity Log"  — audit trail of all admin actions (append-only)
 */

// ── Column definitions ────────────────────────────────────────────────────────

var DEAL_HEADERS  = ['ID','Title','VIN','Year','Make','Score','Value ($)','Stage','Status','Source','Updated'];
var BUYER_HEADERS = ['ID','Name','Email','Phone','Makes','Max Price ($)','City','State'];
var MH_HEADERS    = ['Scanned At','VIN','Year','Make','Model','Mileage','Condition','Location',
                     'Sale Date','Listing Price','MMR Value','Discount %','Deal Score','Est. Profit','Reason'];
var LOG_HEADERS   = ['Timestamp','User','Action','Details'];

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
  // Rename the default blank sheet so the first getOrCreateSheet_ call can find it
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

  // Clear data rows (keep header)
  var last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, DEAL_HEADERS.length).clearContent();

  if (!deals || !deals.length) return;

  var rows = deals.map(function (d) {
    return [d.id, d.title, d.vin || '', d.year || '', d.make || '',
            d.score || 0, d.value || 0, d.stage || '', d.status || '',
            d.source || '', d.updated ? new Date(d.updated).toLocaleString() : ''];
  });
  sheet.getRange(2, 1, rows.length, DEAL_HEADERS.length).setValues(rows);

  // Colour-code by score: ≥70 green, 50-69 yellow, <50 no fill
  rows.forEach(function (_, i) {
    var scoreCell = sheet.getRange(i + 2, 6);  // col F = Score
    var score = rows[i][5];
    scoreCell.setBackground(score >= 70 ? '#d9ead3' : score >= 50 ? '#fff2cc' : null);
  });
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

// ── Manheim alerts ───────────────────────────────────────────────────────────

/**
 * Appends a Manheim deal alert row. Called from Manheim.gs.
 * @param {Object} alert — deal alert object from buildDealAlert_()
 */
function appendManheimAlert_(alert) {
  var ss    = getSpreadsheet_();
  var sheet = getOrCreateSheet_(ss, 'Manheim Deals', MH_HEADERS);
  var v     = alert.listing;
  sheet.appendRow([
    new Date().toLocaleString(),
    v.vin, v.year, v.make, v.model, v.mileage,
    v.conditionGrade || '', v.auctionLocation || '', v.saleDate || '',
    v.listingPrice || 0, v.mmrValue || 0,
    v.discountPct ? (v.discountPct * 100).toFixed(1) + '%' : '',
    alert.dealScore || 0,
    alert.estimatedProfitMargin || 0,
    alert.reason || ''
  ]);
}

// ── Activity log ─────────────────────────────────────────────────────────────

/**
 * Appends one line to the Activity Log sheet.
 * @param {string} action  — short action name, e.g. "move_deal"
 * @param {string} details — human-readable context
 */
function logActivity_(action, details) {
  try {
    var ss    = getSpreadsheet_();
    var sheet = getOrCreateSheet_(ss, 'Activity Log', LOG_HEADERS);
    var user  = Session.getActiveUser().getEmail() || 'system';
    sheet.appendRow([new Date().toLocaleString(), user, action, details || '']);
  } catch (e) {
    // Non-fatal — never let logging break the main action
    console.warn('logActivity_ failed:', e.message);
  }
}

// ── Full sync (called by trigger or manually) ─────────────────────────────────

/**
 * Pulls live GHL data and writes it to Sheets.
 * Safe to call from a time-based trigger.
 */
function syncGHLToSheets() {
  if (isDemo_()) {
    console.log('syncGHLToSheets: demo mode — skipping live fetch');
    return;
  }
  var snap = liveSnapshot_();
  syncDealsToSheets_(snap.deals || []);
  syncBuyersToSheets_(snap.buyers || []);
  logActivity_('sync_ghl', 'Synced ' + (snap.deals || []).length + ' deals, ' + (snap.buyers || []).length + ' buyers');
  console.log('GHL → Sheets sync complete');
}
