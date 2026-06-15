// ============================================================
// LUX AUTO — Customer Waitlist & Auto-Match System
// Google Apps Script
//
// Manages a buyer wishlist/waitlist that auto-matches new
// inventory listings to interested buyers and fires branded
// pre-bid notification emails with luxury dark-themed HTML.
//
// Sheet: "Customer Waitlist"
// Columns (A–P):
//   Buyer ID | Name | Email | Phone | Makes | Models |
//   Min Year | Max Year | Max Mileage | Max Price | Min Score |
//   Status | Notes | Match Count | Last Match Date | Added Date
// ============================================================

// ── Column Index Constants ────────────────────────────────────────────────────

const WL_COL = {
  BUYER_ID        : 1,   // A
  NAME            : 2,   // B
  EMAIL           : 3,   // C
  PHONE           : 4,   // D
  MAKES           : 5,   // E
  MODELS          : 6,   // F
  MIN_YEAR        : 7,   // G
  MAX_YEAR        : 8,   // H
  MAX_MILEAGE     : 9,   // I
  MAX_PRICE       : 10,  // J
  MIN_SCORE       : 11,  // K
  STATUS          : 12,  // L
  NOTES           : 13,  // M
  MATCH_COUNT     : 14,  // N
  LAST_MATCH_DATE : 15,  // O
  ADDED_DATE      : 16,  // P
};

const WL_HEADERS = [
  'Buyer ID', 'Name', 'Email', 'Phone',
  'Makes (comma-sep)', 'Models (comma-sep)',
  'Min Year', 'Max Year', 'Max Mileage', 'Max Price ($)', 'Min Score',
  'Status', 'Notes', 'Match Count', 'Last Match Date', 'Added Date',
];

const WL_SHEET_NAME      = 'Customer Waitlist';
const WL_NOTIF_LOG_NAME  = 'Waitlist Notif Log';

// Dedup window: don't re-notify same buyer+VIN within this many days
const WL_DEDUP_DAYS = 7;


// ── 1. setupWaitlistSheet ─────────────────────────────────────────────────────

/**
 * Creates (or reformats) the "Customer Waitlist" sheet.
 * Safe to run multiple times — won't destroy existing data.
 */
function setupWaitlistSheet() {
  const ss = _getSpreadsheet();
  let sheet = ss.getSheetByName(WL_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(WL_SHEET_NAME);
    Logger.log('CustomerWaitlist: created sheet "' + WL_SHEET_NAME + '"');
  }

  // Write headers only if row 1 is blank
  if (!sheet.getRange(1, 1).getValue()) {
    const hRange = sheet.getRange(1, 1, 1, WL_HEADERS.length);
    hRange.setValues([WL_HEADERS])
          .setBackground('#1a1a2e')
          .setFontColor('#d4af37')
          .setFontWeight('bold')
          .setFontSize(11);
  }

  // Freeze header row
  sheet.setFrozenRows(1);

  // Column widths (px)
  const widths = [130, 160, 220, 130, 200, 200, 80, 80, 110, 110, 90, 90, 200, 90, 130, 130];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  // Data validation on Status column (L = col 12)
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Active', 'Paused', 'Fulfilled'], true)
    .setAllowInvalid(false)
    .setHelpText('Choose Active, Paused, or Fulfilled')
    .build();
  sheet.getRange(2, WL_COL.STATUS, sheet.getMaxRows() - 1, 1)
       .setDataValidation(statusRule);

  // Ensure notification log sheet exists
  _ensureNotifLogSheet(ss);

  Logger.log('CustomerWaitlist: setupWaitlistSheet complete');
  return { success: true, sheetUrl: ss.getUrl() };
}


// ── 2. addToWaitlist ──────────────────────────────────────────────────────────

/**
 * Adds a new buyer to the Customer Waitlist.
 *
 * @param {Object} params  {name, email, phone, makes, models,
 *                          minYear, maxYear, maxMileage, maxPrice, minScore, notes}
 * @returns {Object}       {success: true, buyerId: 'WL-YYYYMMDD-XXX'}
 */
function addToWaitlist(params) {
  try {
    if (!params || !params.name || !params.email) {
      return { success: false, error: 'name and email are required' };
    }

    const ss    = _getSpreadsheet();
    const sheet = ss.getSheetByName(WL_SHEET_NAME) || setupWaitlistSheet();

    const buyerId = _generateBuyerId(sheet);
    const now     = new Date();

    sheet.appendRow([
      buyerId,
      String(params.name  || '').trim(),
      String(params.email || '').trim().toLowerCase(),
      String(params.phone || '').trim(),
      String(params.makes  || '').trim(),
      String(params.models || '').trim(),
      params.minYear    ? parseInt(params.minYear,    10) : '',
      params.maxYear    ? parseInt(params.maxYear,    10) : '',
      params.maxMileage ? parseInt(params.maxMileage, 10) : '',
      params.maxPrice   ? parseFloat(params.maxPrice)    : '',
      params.minScore   ? parseFloat(params.minScore)    : '',
      'Active',
      String(params.notes || '').trim(),
      0,           // Match Count
      '',          // Last Match Date
      now,         // Added Date
    ]);

    Logger.log('CustomerWaitlist: added buyer ' + buyerId + ' — ' + params.name);
    return { success: true, buyerId };
  } catch (err) {
    Logger.log('addToWaitlist error: ' + err.message);
    return { success: false, error: err.message };
  }
}


// ── 3. updateWaitlistEntry ────────────────────────────────────────────────────

/**
 * Updates one or more fields for an existing waitlist buyer.
 *
 * @param {string} buyerId   e.g. 'WL-20250615-001'
 * @param {Object} updates   Any subset of the addToWaitlist params + 'status'
 * @returns {Object}         {success: true} or {success: false, error}
 */
function updateWaitlistEntry(buyerId, updates) {
  try {
    const { sheet, rowIndex } = _findBuyerRow(buyerId);
    if (rowIndex === -1) return { success: false, error: 'Buyer not found: ' + buyerId };

    const fieldMap = {
      name        : WL_COL.NAME,
      email       : WL_COL.EMAIL,
      phone       : WL_COL.PHONE,
      makes       : WL_COL.MAKES,
      models      : WL_COL.MODELS,
      minYear     : WL_COL.MIN_YEAR,
      maxYear     : WL_COL.MAX_YEAR,
      maxMileage  : WL_COL.MAX_MILEAGE,
      maxPrice    : WL_COL.MAX_PRICE,
      minScore    : WL_COL.MIN_SCORE,
      status      : WL_COL.STATUS,
      notes       : WL_COL.NOTES,
    };

    Object.entries(updates).forEach(([key, val]) => {
      const col = fieldMap[key];
      if (col) sheet.getRange(rowIndex, col).setValue(val);
    });

    Logger.log('CustomerWaitlist: updated ' + buyerId + ' — fields: ' + Object.keys(updates).join(', '));
    return { success: true };
  } catch (err) {
    Logger.log('updateWaitlistEntry error: ' + err.message);
    return { success: false, error: err.message };
  }
}


// ── 4. removeFromWaitlist ─────────────────────────────────────────────────────

/**
 * Marks a buyer as Fulfilled (soft-delete). Pass {hardDelete: true} to remove row.
 *
 * @param {string} buyerId
 * @param {Object} [opts]   {hardDelete: boolean}
 * @returns {Object}        {success: true|false}
 */
function removeFromWaitlist(buyerId, opts) {
  try {
    const { sheet, rowIndex } = _findBuyerRow(buyerId);
    if (rowIndex === -1) return { success: false, error: 'Buyer not found: ' + buyerId };

    if (opts && opts.hardDelete) {
      sheet.deleteRow(rowIndex);
      Logger.log('CustomerWaitlist: hard-deleted row for ' + buyerId);
    } else {
      sheet.getRange(rowIndex, WL_COL.STATUS).setValue('Fulfilled');
      Logger.log('CustomerWaitlist: marked ' + buyerId + ' as Fulfilled');
    }

    return { success: true };
  } catch (err) {
    Logger.log('removeFromWaitlist error: ' + err.message);
    return { success: false, error: err.message };
  }
}


// ── 5. getWaitlist ────────────────────────────────────────────────────────────

/**
 * Returns all waitlist entries, optionally filtered by status.
 *
 * @param {string} [statusFilter]  'Active' | 'Paused' | 'Fulfilled' | undefined = all
 * @returns {Object[]}             Array of buyer objects
 */
function getWaitlist(statusFilter) {
  try {
    const ss    = _getSpreadsheet();
    const sheet = ss.getSheetByName(WL_SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const rows = sheet.getDataRange().getValues().slice(1); // skip header
    return rows
      .map((row, i) => _rowToBuyer(row, i + 2))
      .filter(b => b.buyerId && (!statusFilter || b.status === statusFilter));
  } catch (err) {
    Logger.log('getWaitlist error: ' + err.message);
    return [];
  }
}


// ── 6. matchInventoryToWaitlist ───────────────────────────────────────────────

/**
 * Core matching engine. Checks all Active waitlist entries against a listing.
 *
 * @param {Object} listing  {make, model, year, mileage, price, score, vin, url}
 * @returns {Object[]}      Array of matching buyer objects
 */
function matchInventoryToWaitlist(listing) {
  const activeBuyers = getWaitlist('Active');
  if (!activeBuyers.length) return [];

  const lMake    = String(listing.make  || '').toLowerCase();
  const lModel   = String(listing.model || '').toLowerCase();
  const lYear    = parseInt(listing.year,    10) || 0;
  const lMileage = parseInt(listing.mileage, 10) || 0;
  const lPrice   = parseFloat(listing.price) || 0;
  const lScore   = parseFloat(listing.score) || 0;

  return activeBuyers.filter(buyer => {
    // Make match — required; partial/case-insensitive
    // e.g. buyer makes = ["Porsche"] matches listing make = "Porsche 911 GT3"
    // and  listing make = "Porsche" matches buyer makes = ["Porsche 911"]
    if (buyer.makes && buyer.makes.length) {
      const makeMatch = buyer.makes.some(bm => {
        const bmLower = bm.toLowerCase();
        return lMake.includes(bmLower) || bmLower.includes(lMake);
      });
      if (!makeMatch) return false;
    }

    // Model match — optional; only checked when buyer specified models
    if (buyer.models && buyer.models.length) {
      const modelMatch = buyer.models.some(bm => {
        const bmLower = bm.toLowerCase();
        return lModel.includes(bmLower) || bmLower.includes(lModel);
      });
      if (!modelMatch) return false;
    }

    // Year range
    if (buyer.minYear && lYear && lYear < buyer.minYear) return false;
    if (buyer.maxYear && lYear && lYear > buyer.maxYear) return false;

    // Mileage ceiling
    if (buyer.maxMileage && lMileage > buyer.maxMileage) return false;

    // Price ceiling
    if (buyer.maxPrice && lPrice > buyer.maxPrice) return false;

    // Minimum deal score — only enforced when buyer specified a threshold
    if (buyer.minScore && lScore < buyer.minScore) return false;

    return true;
  });
}


// ── 7. sendWaitlistNotifications ─────────────────────────────────────────────

/**
 * Sends a branded HTML notification email to each matched buyer.
 * Updates Match Count and Last Match Date in the sheet after sending.
 *
 * @param {Object}   listing       {make, model, year, mileage, price, score, vin, url}
 * @param {Object[]} matchedBuyers Array returned by matchInventoryToWaitlist()
 * @returns {Object}               {sent: N, failed: N}
 */
function sendWaitlistNotifications(listing, matchedBuyers) {
  let sent = 0, failed = 0;

  if (!matchedBuyers || !matchedBuyers.length) return { sent, failed };

  const ss = _getSpreadsheet();

  matchedBuyers.forEach(buyer => {
    try {
      const subject  = '🔔 Match Found: ' + listing.year + ' ' + listing.make + ' ' + listing.model + ' — Lux Auto';
      const htmlBody = _buildNotificationEmail(buyer, listing);

      GmailApp.sendEmail(
        buyer.email,
        subject,
        // Plain-text fallback
        'A vehicle matching your wishlist has been found.\n\n'
        + listing.year + ' ' + listing.make + ' ' + listing.model + '\n'
        + 'Price: $' + (listing.price || 0).toLocaleString() + '\n'
        + 'Mileage: ' + (listing.mileage || 0).toLocaleString() + ' mi\n'
        + 'Score: ' + listing.score + '\n'
        + (listing.url ? 'View Deal: ' + listing.url + '\n' : '')
        + '\n— Lux Auto\nUnsubscribe: mailto:unsubscribe@luxauto.com',
        {
          htmlBody : htmlBody,
          name     : 'Lux Auto',
        }
      );

      // Update Match Count and Last Match Date in sheet
      _incrementMatchStats(ss, buyer.rowIndex);

      sent++;
      Logger.log('CustomerWaitlist: notification sent to ' + buyer.email + ' for VIN ' + listing.vin);
      Utilities.sleep(150); // throttle to respect Gmail quotas
    } catch (err) {
      failed++;
      Logger.log('CustomerWaitlist: failed to notify ' + buyer.email + ': ' + err.message);
    }
  });

  return { sent, failed };
}


// ── 8. runWaitlistMatchForAll ─────────────────────────────────────────────────

/**
 * Batch runner: matches every listing in the given array to the waitlist,
 * deduplicates notifications (same VIN+buyer within 7 days), and fires emails.
 *
 * @param {Object[]} listings  Array of listing objects
 * @returns {Object}           {matched: N, notified: N}
 */
function runWaitlistMatchForAll(listings) {
  if (!listings || !listings.length) return { matched: 0, notified: 0 };

  const ss      = _getSpreadsheet();
  const logSheet = _ensureNotifLogSheet(ss);
  const sentLog  = _loadNotifLog(logSheet); // { 'BUYERID::VIN' : Date }

  let totalMatched  = 0;
  let totalNotified = 0;

  listings.forEach(listing => {
    const vin    = String(listing.vin || '').trim();
    const buyers = matchInventoryToWaitlist(listing);
    if (!buyers.length) return;

    totalMatched += buyers.length;

    // Filter out buyers already notified within the dedup window
    const cutoff  = new Date(Date.now() - WL_DEDUP_DAYS * 86400000);
    const pending = buyers.filter(buyer => {
      const key      = buyer.buyerId + '::' + vin;
      const lastSent = sentLog[key];
      return !lastSent || new Date(lastSent) < cutoff;
    });

    if (!pending.length) return;

    const result = sendWaitlistNotifications(listing, pending);
    totalNotified += result.sent;

    // Record successful sends in the log
    const now = new Date();
    pending.forEach(buyer => {
      if (result.sent > 0) {
        const key = buyer.buyerId + '::' + vin;
        sentLog[key] = now;
        logSheet.appendRow([now, buyer.buyerId, buyer.name, buyer.email, vin,
                            listing.year + ' ' + listing.make + ' ' + listing.model,
                            listing.score || '', listing.price || '']);
      }
    });
  });

  Logger.log('CustomerWaitlist: runWaitlistMatchForAll — matched=' + totalMatched + ', notified=' + totalNotified);
  return { matched: totalMatched, notified: totalNotified };
}


// ── 9. getWaitlistStats ───────────────────────────────────────────────────────

/**
 * Returns summary statistics for the waitlist and recent notification activity.
 *
 * @returns {Object} {totalActive, totalPaused, totalFulfilled,
 *                    recentMatches: [{buyerName, vin, date}],
 *                    topMakes: [{make, count}]}
 */
function getWaitlistStats() {
  try {
    const all       = getWaitlist();
    const active    = all.filter(b => b.status === 'Active').length;
    const paused    = all.filter(b => b.status === 'Paused').length;
    const fulfilled = all.filter(b => b.status === 'Fulfilled').length;

    // Top makes across all waitlist entries (any status)
    const makeCounts = {};
    all.forEach(buyer => {
      buyer.makes.forEach(make => {
        const k = make.trim();
        if (k) makeCounts[k] = (makeCounts[k] || 0) + 1;
      });
    });
    const topMakes = Object.entries(makeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([make, count]) => ({ make, count }));

    // Recent matches from the notification log
    const ss       = _getSpreadsheet();
    const logSheet = ss.getSheetByName(WL_NOTIF_LOG_NAME);
    let recentMatches = [];

    if (logSheet && logSheet.getLastRow() > 1) {
      const logData = logSheet.getDataRange().getValues();
      // Columns: Date | BuyerID | BuyerName | Email | VIN | Vehicle | Score | Price
      recentMatches = logData.slice(1)
        .filter(row => row[0])
        .sort((a, b) => new Date(b[0]) - new Date(a[0]))
        .slice(0, 20)
        .map(row => ({
          buyerName : String(row[2] || ''),
          vin       : String(row[4] || ''),
          vehicle   : String(row[5] || ''),
          date      : row[0] ? new Date(row[0]).toLocaleString() : '',
        }));
    }

    return { totalActive: active, totalPaused: paused, totalFulfilled: fulfilled,
             recentMatches, topMakes };
  } catch (err) {
    Logger.log('getWaitlistStats error: ' + err.message);
    return { totalActive: 0, totalPaused: 0, totalFulfilled: 0, recentMatches: [], topMakes: [] };
  }
}


// ── Private Helpers ───────────────────────────────────────────────────────────

/**
 * Generates a unique Buyer ID: WL-YYYYMMDD-NNN (zero-padded sequential suffix).
 */
function _generateBuyerId(sheet) {
  const today   = new Date();
  const ymd     = today.getFullYear().toString()
                + String(today.getMonth() + 1).padStart(2, '0')
                + String(today.getDate()).padStart(2, '0');
  const prefix  = 'WL-' + ymd + '-';

  // Find the highest existing suffix for today's date prefix
  const lastRow = sheet.getLastRow();
  let maxSeq    = 0;

  if (lastRow > 1) {
    const ids = sheet.getRange(2, WL_COL.BUYER_ID, lastRow - 1, 1)
                     .getValues().flat().map(String);
    ids.forEach(id => {
      if (id.startsWith(prefix)) {
        const seq = parseInt(id.replace(prefix, ''), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    });
  }

  return prefix + String(maxSeq + 1).padStart(3, '0');
}

/**
 * Finds a buyer row by Buyer ID. Returns {sheet, rowIndex} where rowIndex is
 * 1-based (Sheets row number) or -1 if not found.
 */
function _findBuyerRow(buyerId) {
  const ss    = _getSpreadsheet();
  const sheet = ss.getSheetByName(WL_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return { sheet, rowIndex: -1 };

  const ids = sheet.getRange(2, WL_COL.BUYER_ID, sheet.getLastRow() - 1, 1)
                   .getValues().flat().map(String);
  const idx = ids.indexOf(String(buyerId));
  return { sheet, rowIndex: idx === -1 ? -1 : idx + 2 };
}

/**
 * Maps a data row array + rowIndex into a buyer object.
 */
function _rowToBuyer(row, rowIndex) {
  return {
    rowIndex,
    buyerId     : String(row[WL_COL.BUYER_ID        - 1] || '').trim(),
    name        : String(row[WL_COL.NAME            - 1] || '').trim(),
    email       : String(row[WL_COL.EMAIL           - 1] || '').trim(),
    phone       : String(row[WL_COL.PHONE           - 1] || '').trim(),
    makes       : _splitCsvField(row[WL_COL.MAKES   - 1]),
    models      : _splitCsvField(row[WL_COL.MODELS  - 1]),
    minYear     : parseInt(row[WL_COL.MIN_YEAR       - 1], 10) || null,
    maxYear     : parseInt(row[WL_COL.MAX_YEAR       - 1], 10) || null,
    maxMileage  : parseInt(row[WL_COL.MAX_MILEAGE    - 1], 10) || null,
    maxPrice    : parseFloat(row[WL_COL.MAX_PRICE    - 1]) || null,
    minScore    : parseFloat(row[WL_COL.MIN_SCORE    - 1]) || null,
    status      : String(row[WL_COL.STATUS           - 1] || '').trim(),
    notes       : String(row[WL_COL.NOTES            - 1] || '').trim(),
    matchCount  : parseInt(row[WL_COL.MATCH_COUNT    - 1], 10) || 0,
    lastMatchDate: row[WL_COL.LAST_MATCH_DATE        - 1] || null,
    addedDate   : row[WL_COL.ADDED_DATE              - 1] || null,
  };
}

/**
 * Increments Match Count and updates Last Match Date for a buyer row.
 */
function _incrementMatchStats(ss, rowIndex) {
  if (!rowIndex || rowIndex < 2) return;
  const sheet = ss.getSheetByName(WL_SHEET_NAME);
  if (!sheet) return;

  const countCell = sheet.getRange(rowIndex, WL_COL.MATCH_COUNT);
  countCell.setValue((parseInt(countCell.getValue(), 10) || 0) + 1);
  sheet.getRange(rowIndex, WL_COL.LAST_MATCH_DATE).setValue(new Date());
}

/**
 * Splits a comma-separated field value into a trimmed, non-empty array.
 */
function _splitCsvField(val) {
  return String(val || '').split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Ensures the notification log sheet exists and returns it.
 */
function _ensureNotifLogSheet(ss) {
  let sheet = ss.getSheetByName(WL_NOTIF_LOG_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(WL_NOTIF_LOG_NAME);
    const headers = ['Date Sent', 'Buyer ID', 'Buyer Name', 'Email', 'VIN', 'Vehicle', 'Score', 'Price ($)'];
    sheet.getRange(1, 1, 1, headers.length)
         .setValues([headers])
         .setBackground('#1a1a2e')
         .setFontColor('#d4af37')
         .setFontWeight('bold');
    sheet.setFrozenRows(1);
    Logger.log('CustomerWaitlist: created notification log sheet');
  }
  return sheet;
}

/**
 * Loads the notification log into a map { 'BUYERID::VIN' : Date } for dedup.
 */
function _loadNotifLog(logSheet) {
  const map = {};
  if (!logSheet || logSheet.getLastRow() < 2) return map;

  logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 5)
          .getValues()
          .forEach(row => {
            const date    = row[0];
            const buyerId = String(row[1] || '').trim();
            const vin     = String(row[4] || '').trim();
            if (date && buyerId && vin) {
              map[buyerId + '::' + vin] = date;
            }
          });
  return map;
}

/**
 * Returns the score badge color: green ≥70, yellow ≥50, red <50.
 */
function _scoreBadgeColor(score) {
  const s = parseFloat(score) || 0;
  if (s >= 70) return '#27ae60';
  if (s >= 50) return '#f39c12';
  return '#e74c3c';
}

/**
 * HTML-escapes a string to prevent injection in email templates.
 */
function _wlEsc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Builds the luxury dark-themed HTML notification email.
 */
function _buildNotificationEmail(buyer, listing) {
  const year      = _wlEsc(listing.year    || '');
  const make      = _wlEsc(listing.make    || '');
  const model     = _wlEsc(listing.model   || '');
  const vin       = _wlEsc(listing.vin     || '—');
  const price     = listing.price   ? '$' + parseFloat(listing.price).toLocaleString()   : '—';
  const mileage   = listing.mileage ? parseInt(listing.mileage, 10).toLocaleString() + ' mi' : '—';
  const score     = listing.score != null ? listing.score : '—';
  const scoreColor = _scoreBadgeColor(listing.score);
  const condition = _wlEsc(listing.condition || 'Auction');
  const firstName = buyer.name.split(' ')[0] || 'there';
  const viewUrl   = listing.url || '#';

  const dealerEmail = Session.getActiveUser().getEmail();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0d0d1a;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d1a;padding:32px 16px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

      <!-- Header / Brand Bar -->
      <tr>
        <td style="background:#1a1a2e;border-top:3px solid #d4af37;padding:24px 32px;border-radius:8px 8px 0 0">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="font-size:22px;font-weight:700;color:#d4af37;letter-spacing:2px;text-transform:uppercase">LUX AUTO</span>
                <br>
                <span style="font-size:11px;color:#888;letter-spacing:1px;text-transform:uppercase">Exclusive Exotic Car Dealer</span>
              </td>
              <td align="right">
                <span style="background:${scoreColor};color:#fff;font-size:13px;font-weight:700;padding:6px 14px;border-radius:20px;letter-spacing:0.5px">
                  SCORE&nbsp;&nbsp;${_wlEsc(String(score))}
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Notification Banner -->
      <tr>
        <td style="background:#12122a;padding:20px 32px;border-left:1px solid #2a2a4a;border-right:1px solid #2a2a4a">
          <p style="margin:0 0 4px;font-size:11px;color:#d4af37;text-transform:uppercase;letter-spacing:2px">Wishlist Match Found</p>
          <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;line-height:1.2">
            ${year} ${make} ${model}
          </h1>
          <p style="margin:8px 0 0;font-size:14px;color:#aaa">
            Hi ${_wlEsc(firstName)}, a vehicle matching your criteria just became available.
          </p>
        </td>
      </tr>

      <!-- Vehicle Details Card -->
      <tr>
        <td style="background:#1a1a2e;padding:0 32px 8px;border-left:1px solid #2a2a4a;border-right:1px solid #2a2a4a">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #2a2a4a;border-radius:6px;margin:16px 0;overflow:hidden">

            <tr style="background:#12122a">
              <td colspan="2" style="padding:12px 16px;border-bottom:1px solid #2a2a4a">
                <span style="font-size:11px;color:#d4af37;text-transform:uppercase;letter-spacing:1.5px;font-weight:700">Vehicle Details</span>
              </td>
            </tr>

            <tr>
              <td style="padding:10px 16px;color:#888;font-size:13px;width:40%;border-bottom:1px solid #1e1e38">Year</td>
              <td style="padding:10px 16px;color:#fff;font-size:13px;font-weight:600;border-bottom:1px solid #1e1e38">${year}</td>
            </tr>
            <tr style="background:#111128">
              <td style="padding:10px 16px;color:#888;font-size:13px;border-bottom:1px solid #1e1e38">Make</td>
              <td style="padding:10px 16px;color:#fff;font-size:13px;font-weight:600;border-bottom:1px solid #1e1e38">${make}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;color:#888;font-size:13px;border-bottom:1px solid #1e1e38">Model</td>
              <td style="padding:10px 16px;color:#fff;font-size:13px;font-weight:600;border-bottom:1px solid #1e1e38">${model}</td>
            </tr>
            <tr style="background:#111128">
              <td style="padding:10px 16px;color:#888;font-size:13px;border-bottom:1px solid #1e1e38">Mileage</td>
              <td style="padding:10px 16px;color:#fff;font-size:13px;font-weight:600;border-bottom:1px solid #1e1e38">${mileage}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;color:#888;font-size:13px;border-bottom:1px solid #1e1e38">Price</td>
              <td style="padding:10px 16px;color:#d4af37;font-size:15px;font-weight:700;border-bottom:1px solid #1e1e38">${price}</td>
            </tr>
            <tr style="background:#111128">
              <td style="padding:10px 16px;color:#888;font-size:13px;border-bottom:1px solid #1e1e38">Deal Score</td>
              <td style="padding:10px 16px;border-bottom:1px solid #1e1e38">
                <span style="background:${scoreColor};color:#fff;font-size:12px;font-weight:700;padding:3px 10px;border-radius:12px">${_wlEsc(String(score))}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 16px;color:#888;font-size:13px;border-bottom:1px solid #1e1e38">Condition</td>
              <td style="padding:10px 16px;color:#fff;font-size:13px;font-weight:600;border-bottom:1px solid #1e1e38">${condition}</td>
            </tr>
            <tr style="background:#111128">
              <td style="padding:10px 16px;color:#888;font-size:13px">VIN</td>
              <td style="padding:10px 16px;color:#aaa;font-size:12px;font-family:monospace">${vin}</td>
            </tr>

          </table>
        </td>
      </tr>

      <!-- CTA Button -->
      <tr>
        <td style="background:#1a1a2e;padding:8px 32px 24px;border-left:1px solid #2a2a4a;border-right:1px solid #2a2a4a;text-align:center">
          <a href="${_wlEsc(viewUrl)}"
             style="display:inline-block;background:#d4af37;color:#0d0d1a;text-decoration:none;font-weight:700;font-size:15px;padding:14px 36px;border-radius:4px;letter-spacing:0.5px;text-transform:uppercase">
            View Deal
          </a>
          <p style="margin:16px 0 0;font-size:12px;color:#666">
            This opportunity may move fast — exclusive listings fill quickly.
          </p>
        </td>
      </tr>

      <!-- Dealer Signature -->
      <tr>
        <td style="background:#12122a;padding:20px 32px;border-left:1px solid #2a2a4a;border-right:1px solid #2a2a4a;border-top:1px solid #2a2a4a">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="border-left:3px solid #d4af37;padding-left:12px">
                <span style="font-size:14px;font-weight:700;color:#fff">Lux Auto</span><br>
                <span style="font-size:12px;color:#888">Exotic &amp; Luxury Vehicles</span><br>
                <span style="font-size:12px;color:#d4af37">
                  <a href="mailto:${_wlEsc(dealerEmail)}" style="color:#d4af37;text-decoration:none">${_wlEsc(dealerEmail)}</a>
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Footer / Unsubscribe -->
      <tr>
        <td style="background:#0d0d1a;padding:16px 32px;border-radius:0 0 8px 8px;border:1px solid #1a1a2e;border-top:none;text-align:center">
          <p style="margin:0;font-size:11px;color:#444;line-height:1.6">
            You received this because you are on the Lux Auto buyer wishlist.
            <a href="mailto:${_wlEsc(dealerEmail)}?subject=Unsubscribe%20Waitlist&amp;body=Please%20remove%20me%20from%20the%20Lux%20Auto%20waitlist."
               style="color:#666;text-decoration:underline">Unsubscribe</a>
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}
