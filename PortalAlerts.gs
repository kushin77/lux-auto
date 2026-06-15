// ============================================================
// LUX AUTO — Portal Alerts & Seller Auto-Scoring
// Google Apps Script
//
// Called automatically by FormHandlers.gs after each submission:
//   • Sends the admin a formatted email summary
//   • For seller & trade-in submissions: looks up the VIN via
//     Manheim MMR, scores the deal, and if it meets the threshold
//     writes a row to the Deals sheet so the buyer pipeline picks it up
// ============================================================

// ── Config ────────────────────────────────────────────────────────────────────

const ALERT_CFG = {
  // Who receives new-lead notifications (defaults to script owner's email)
  ADMIN_EMAIL : Session.getActiveUser().getEmail(),

  // Minimum deal score to auto-add a portal seller to the Deals sheet
  PORTAL_MIN_SCORE : 50,   // slightly lower than the email threshold (60) — human review first

  // Deal threshold: flag if asking price is >= this % below MMR
  DEAL_THRESHOLD_PCT : 0.10,  // 10 % below MMR qualifies a seller listing
};


// ── Public API (called by FormHandlers.gs) ────────────────────────────────────

/**
 * Send an admin alert email for any form submission.
 *
 * @param {string} formType   One of: 'Buyer' | 'Seller' | 'Dealer' | 'Trade-In'
 * @param {Object} fields     Key→value map of the submission's important fields
 */
function sendAdminAlert(formType, fields) {
  try {
    const subject = `[Lux Auto] New ${formType} Submission — ${fields['Name'] || fields['Dealership Name'] || 'Unknown'}`;
    const body    = _buildAlertEmail(formType, fields);

    GmailApp.sendEmail(ALERT_CFG.ADMIN_EMAIL, subject, '', { htmlBody: body });
    Logger.log(`Alert sent for ${formType}: ${subject}`);
  } catch (err) {
    Logger.log('sendAdminAlert error: ' + err.message);
  }
}

/**
 * Look up a seller's VIN against Manheim MMR.
 * If the asking price is a good deal, write it to the Deals sheet.
 *
 * @param {Object} sellerData  Keys: vin, year, make, model, trim, mileage, askingPrice, name, email
 * @returns {Object|null}      Score result, or null if MMR unavailable
 */
function scoreSeller(sellerData) {
  try {
    const mmrData = _fetchMMR(sellerData.vin, sellerData.mileage);
    if (!mmrData) {
      Logger.log(`MMR lookup returned null for VIN ${sellerData.vin}`);
      return null;
    }

    const mmr          = mmrData.above || mmrData.average || mmrData.below || 0;
    const askingPrice  = sellerData.askingPrice || 0;
    const discountPct  = mmr > 0 ? (mmr - askingPrice) / mmr : 0;
    const estMargin    = mmr - askingPrice;

    // Score 0–100: discount pct weighted 70 %, recency of year weighted 30 %
    const yearScore    = Math.max(0, Math.min(30, (sellerData.year - 2015) * 3));
    const dealScore    = Math.round(Math.min(100, discountPct * 500) * 0.70 + yearScore);

    const result = { mmr, askingPrice, discountPct, estMargin, dealScore };
    Logger.log(`Seller score for ${sellerData.vin}: score=${dealScore}, MMR=${mmr}, asking=${askingPrice}, discount=${(discountPct*100).toFixed(1)}%`);

    if (discountPct >= ALERT_CFG.DEAL_THRESHOLD_PCT && dealScore >= ALERT_CFG.PORTAL_MIN_SCORE) {
      _addSellerToDealSheet(sellerData, result);
    }

    return result;
  } catch (err) {
    Logger.log('scoreSeller error: ' + err.message);
    return null;
  }
}

/**
 * Manually re-score all "New" rows in the Sellers sheet.
 * Useful for bulk-processing a backlog.
 */
function rescoreAllSellers() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PORTAL_SHEETS.SELLERS);
  if (!sheet) { Logger.log('Sellers sheet not found'); return; }

  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const idxVIN  = headers.indexOf('VIN');
  const idxYear = headers.indexOf('Year');
  const idxMake = headers.indexOf('Make');
  const idxMod  = headers.indexOf('Model');
  const idxTrim = headers.indexOf('Trim');
  const idxMile = headers.indexOf('Mileage');
  const idxAsk  = headers.indexOf('Asking Price ($)');
  const idxStat = headers.indexOf('Status');
  const idxName = headers.indexOf('Name');
  const idxEmail= headers.indexOf('Email');

  let scored = 0;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[idxStat] !== 'New') continue;

    const result = scoreSeller({
      vin         : row[idxVIN],
      year        : parseInt(row[idxYear]) || 2020,
      make        : row[idxMake],
      model       : row[idxMod],
      trim        : row[idxTrim],
      mileage     : parseInt(row[idxMile]) || 0,
      askingPrice : parseFloat(row[idxAsk]) || 0,
      name        : row[idxName],
      email       : row[idxEmail],
    });

    if (result) {
      // Write score back to sheet (append to Notes or a score column if it exists)
      Logger.log(`Row ${i+1} scored: ${result.dealScore}`);
      scored++;
    }
  }

  SpreadsheetApp.getUi().alert(`✅ Re-scored ${scored} seller row(s). Check the Deals sheet for any new qualified listings.`);
}


// ── MMR Lookup ────────────────────────────────────────────────────────────────

function _fetchMMR(vin, mileage) {
  if (!vin || vin.length !== 17) return null;
  // Reuse the existing _mhGet() helper from Code.gs (same script project)
  return _mhGet(CFG.MMR_URL + encodeURIComponent(vin), { odometer: mileage || 0, country: 'US' });
}


// ── Write Qualified Seller to Deals Sheet ─────────────────────────────────────

function _addSellerToDealSheet(seller, score) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CFG.SHEET_DEALS);
  if (!sheet) return;

  const existing = sheet.getDataRange().getValues();
  const vinCol   = 0; // VIN is first column
  const alreadyExists = existing.some((row, i) => i > 0 && row[vinCol] === seller.vin);
  if (alreadyExists) {
    Logger.log(`VIN ${seller.vin} already in Deals sheet — skipping.`);
    return;
  }

  // Deals columns: VIN | Year | Make | Model | Trim | Mileage | List Price | MMR | Discount% | Deal Score | Est Net Margin | Auction Location | Sale Date | Run# | Status | Matched Buyers | Scanned At
  sheet.appendRow([
    seller.vin,
    seller.year,
    seller.make,
    seller.model,
    seller.trim    || '',
    seller.mileage || 0,
    score.askingPrice,
    score.mmr,
    (score.discountPct * 100).toFixed(2) + '%',
    score.dealScore,
    score.estMargin,
    'Portal Seller — ' + (seller.name || ''),   // Auction Location repurposed as source
    '',                                           // Sale Date
    '',                                           // Run #
    'Portal – Needs Review',
    '',
    new Date(),
  ]);

  Logger.log(`Seller ${seller.vin} added to Deals sheet (score ${score.dealScore})`);
}


// ── Email Template ────────────────────────────────────────────────────────────

function _buildAlertEmail(formType, f) {
  const icons = { Buyer: '🚗', Seller: '🏷️', Dealer: '🏢', 'Trade-In': '🔄' };
  const colors = { Buyer: '#1a73e8', Seller: '#e67e22', Dealer: '#8e44ad', 'Trade-In': '#16a085' };
  const icon  = icons[formType]  || '📋';
  const color = colors[formType] || '#333';

  const rows = Object.entries(f)
    .map(([k, v]) => v
      ? `<tr><td style="padding:4px 12px 4px 0;color:#555;font-size:13px;white-space:nowrap"><b>${_esc(k)}</b></td>` +
        `<td style="padding:4px 0;font-size:13px;color:#222">${_esc(String(v))}</td></tr>`
      : ''
    ).join('');

  return `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">

  <div style="background:${color};padding:20px 24px">
    <h2 style="margin:0;color:#fff;font-size:20px">${icon} New ${formType} Submission</h2>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px">${new Date().toLocaleString()}</p>
  </div>

  <div style="padding:20px 24px">
    <table style="width:100%;border-collapse:collapse">
      ${rows}
    </table>
  </div>

  <div style="background:#f9f9f9;padding:14px 24px;border-top:1px solid #eee">
    <p style="margin:0;font-size:12px;color:#888">
      Sent by Lux Auto Portal •
      <a href="https://docs.google.com/spreadsheets/d/${SpreadsheetApp.getActiveSpreadsheet().getId()}" style="color:#1a73e8">Open Spreadsheet</a>
    </p>
  </div>

</div>
</body>
</html>`;
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
