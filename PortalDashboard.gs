// ============================================================
// LUX AUTO — Portal Dashboard Sidebar
// Google Apps Script  |  Shows live submission counts,
// recent leads, and quick-action buttons in a sidebar.
// ============================================================

/**
 * Opens the Lux Auto Portal Dashboard sidebar.
 */
function openPortalDashboard() {
  const html = HtmlService
    .createHtmlOutputFromFile('PortalDashboard')
    .setTitle('Lux Auto Portal')
    .setWidth(320);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Called by the sidebar to fetch live stats.
 * Returns a JSON-serialisable object.
 */
function getDashboardData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheetDefs = [
    { key: 'buyers',   name: CFG.SHEET_BUYERS,      icon: '🚗', color: '#1a73e8' },
    { key: 'sellers',  name: PORTAL_SHEETS.SELLERS,  icon: '🏷️', color: '#e67e22' },
    { key: 'dealers',  name: PORTAL_SHEETS.DEALERS,  icon: '🏢', color: '#8e44ad' },
    { key: 'tradeins', name: PORTAL_SHEETS.TRADE_INS, icon: '🔄', color: '#16a085' },
  ];

  const result = {};

  sheetDefs.forEach(def => {
    const sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      result[def.key] = { count: 0, newCount: 0, recent: [], icon: def.icon, color: def.color, sheetName: def.name };
      return;
    }

    const data      = sheet.getDataRange().getValues();
    const headers   = data[0] || [];
    const rows      = data.slice(1);
    const statusIdx = headers.indexOf('Status');

    const newCount = statusIdx >= 0
      ? rows.filter(r => r[statusIdx] === 'New').length
      : 0;

    // Recent 5 rows — grab first 4 meaningful columns after timestamp
    const recent = rows.slice(-5).reverse().map(row => {
      const ts   = row[0] ? new Date(row[0]).toLocaleDateString() : '';
      const name = row[1] || '';
      const col3 = row[2] || '';
      const stat = statusIdx >= 0 ? (row[statusIdx] || '') : '';
      return { ts, name, col3, stat };
    });

    result[def.key] = {
      count    : rows.length,
      newCount,
      recent,
      icon     : def.icon,
      color    : def.color,
      sheetName: def.name,
    };
  });

  // Deals sheet
  const dealsSheet = ss.getSheetByName(CFG.SHEET_DEALS);
  if (dealsSheet) {
    const dRows   = dealsSheet.getDataRange().getValues().slice(1);
    const dHdrs   = dealsSheet.getDataRange().getValues()[0] || [];
    const statIdx = dHdrs.indexOf('Status');
    result.deals = {
      total         : dRows.length,
      portalDeals   : dRows.filter(r => String(r[11]).startsWith('Portal')).length,
      needsReview   : dRows.filter(r => r[statIdx] === 'Portal – Needs Review').length,
    };
  } else {
    result.deals = { total: 0, portalDeals: 0, needsReview: 0 };
  }

  result.spreadsheetId = ss.getId();
  result.lastRefresh   = new Date().toLocaleTimeString();
  return result;
}

/**
 * Mark a row as "Contacted" in the given sheet.
 * rowIndex is 1-based (header = row 1, data starts at 2).
 */
function markContacted(sheetName, rowIndex) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { ok: false, msg: 'Sheet not found: ' + sheetName };

  const headers   = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const statusIdx = headers.indexOf('Status');
  if (statusIdx < 0) return { ok: false, msg: 'No Status column found' };

  sheet.getRange(rowIndex, statusIdx + 1).setValue('Contacted');
  return { ok: true };
}

/**
 * Run the full buyer pipeline from the sidebar.
 */
function runPipelineFromSidebar() {
  try {
    runFullPipeline();
    return { ok: true, msg: 'Pipeline complete — check Deals and Outreach Log tabs.' };
  } catch (err) {
    return { ok: false, msg: err.message };
  }
}
