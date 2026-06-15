// ============================================================
// LUX AUTO — Analytics.gs
// Market Timing Intelligence | P&L Aggregation | Looker Studio
//
// Depends on: _getSpreadsheet(), _log(), _ensureSheet(),
//             _formatDate() — all defined in Code.gs
// ============================================================

// ── Sheet / Column Constants ──────────────────────────────────────────────────
const ANA = {
  SHEET_MI    : 'Market Intelligence',
  SHEET_PNL   : 'P&L Summary',
  SHEET_BI    : 'BI Export',

  // Market Intelligence columns (0-indexed)
  MI_COL: {
    DATE           : 0,
    MAKE           : 1,
    MODEL          : 2,
    YEAR           : 3,
    VIN            : 4,
    SALE_PRICE     : 5,
    MMR_AT_SALE    : 6,
    DISCOUNT_PCT   : 7,
    DAYS_ON_MARKET : 8,
    MARGIN_PCT     : 9,
    SEASON         : 10,
    MONTH          : 11,
    SOURCE         : 12,
  },

  // P&L Summary columns (0-indexed)
  PNL_COL: {
    PERIOD          : 0,
    TOTAL_VEHICLES  : 1,
    REVENUE         : 2,
    COGS            : 3,
    GROSS_PROFIT    : 4,
    TRANSPORT       : 5,
    RECON           : 6,
    FEES            : 7,
    NET_PROFIT      : 8,
    NET_MARGIN_PCT  : 9,
    AVG_DAYS        : 10,
    BEST_DEAL_VIN   : 11,
    WORST_DEAL_VIN  : 12,
  },

  // Pipeline sheet column names (matched by header row)
  PIPELINE_COLS: {
    STATUS         : 'Status',
    MAKE           : 'Make',
    MODEL          : 'Model',
    YEAR           : 'Year',
    VIN            : 'VIN',
    PURCHASE_PRICE : 'Purchase Price',
    SALE_PRICE     : 'Sale Price',
    TRANSPORT      : 'Transport',
    RECON          : 'Recon',
    FEES           : 'Fees',
    MARGIN_PCT     : 'Margin %',
    DAYS_ON_MARKET : 'Days On Market',
    DATE_SOLD      : 'Date Sold',
    DATE_ACQUIRED  : 'Date Acquired',
    SOURCE         : 'Source',
    MMR            : 'MMR',
  },

  SOLD_STATUS : 'Sold',
  HEADER_COLOR_MI  : '#1a237e',
  HEADER_COLOR_PNL : '#1b5e20',
  HEADER_COLOR_BI  : '#37474f',
};

// ── Sheet Setup ───────────────────────────────────────────────────────────────

/**
 * Creates "Market Intelligence" and "P&L Summary" sheets with headers,
 * column formatting, and frozen header rows. Safe to re-run — skips
 * sheets that already have headers.
 */
function setupAnalyticsSheets() {
  const ss = _getSpreadsheet();

  const miHeaders = [
    'Date','Make','Model','Year','VIN','Sale Price','MMR At Sale',
    'Discount%','Days On Market','Margin%','Season','Month','Source',
  ];
  const pnlHeaders = [
    'Period','Total Vehicles','Revenue','COGS','Gross Profit',
    'Transport','Recon','Fees','Net Profit','Net Margin%',
    'Avg Days To Sell','Best Deal VIN','Worst Deal VIN',
  ];

  const miSheet  = _ensureSheet(ss, ANA.SHEET_MI,  miHeaders,  ANA.HEADER_COLOR_MI);
  const pnlSheet = _ensureSheet(ss, ANA.SHEET_PNL, pnlHeaders, ANA.HEADER_COLOR_PNL);

  // Column widths — Market Intelligence
  miSheet.setColumnWidth(1, 90);   // Date
  miSheet.setColumnWidth(2, 110);  // Make
  miSheet.setColumnWidth(3, 120);  // Model
  miSheet.setColumnWidth(4, 60);   // Year
  miSheet.setColumnWidth(5, 160);  // VIN
  miSheet.setColumnWidth(6, 100);  // Sale Price
  miSheet.setColumnWidth(7, 100);  // MMR At Sale
  miSheet.setColumnWidth(8, 90);   // Discount%
  miSheet.setColumnWidth(9, 130);  // Days On Market
  miSheet.setColumnWidth(10, 90);  // Margin%
  miSheet.setColumnWidth(11, 80);  // Season
  miSheet.setColumnWidth(12, 70);  // Month
  miSheet.setColumnWidth(13, 110); // Source

  // Column widths — P&L Summary
  pnlSheet.setColumnWidth(1, 130);  // Period
  [2,3,4,5,6,7,8,9].forEach(c => pnlSheet.setColumnWidth(c, 110));
  pnlSheet.setColumnWidth(10, 110); // Net Margin%
  pnlSheet.setColumnWidth(11, 130); // Avg Days
  pnlSheet.setColumnWidth(12, 160); // Best Deal VIN
  pnlSheet.setColumnWidth(13, 160); // Worst Deal VIN

  _log('INFO', 'setupAnalyticsSheets: Market Intelligence + P&L Summary ready');
  return { ok: true };
}

// ── Record Sale ───────────────────────────────────────────────────────────────

/**
 * Records a completed vehicle sale to the Market Intelligence sheet.
 * Auto-calculates Discount%, Season, and Month from the current date.
 *
 * @param {Object} params
 * @param {string} params.make
 * @param {string} params.model
 * @param {number} params.year
 * @param {string} params.vin
 * @param {number} params.salePrice
 * @param {number} params.mmrAtSale
 * @param {number} params.daysOnMarket
 * @param {number} params.margin       - margin as a decimal (e.g. 0.12 = 12%)
 * @param {string} params.source
 * @returns {Object} { ok, row }
 */
function recordSale(params) {
  const ss    = _getSpreadsheet();
  let sheet   = ss.getSheetByName(ANA.SHEET_MI);
  if (!sheet) {
    setupAnalyticsSheets();
    sheet = ss.getSheetByName(ANA.SHEET_MI);
  }

  const now         = new Date();
  const monthNum    = now.getMonth();  // 0-11
  const discountPct = (params.mmrAtSale && params.mmrAtSale > 0)
    ? ((params.mmrAtSale - params.salePrice) / params.mmrAtSale * 100)
    : 0;

  const row = [
    now,
    params.make       || '',
    params.model      || '',
    params.year       || '',
    params.vin        || '',
    params.salePrice  || 0,
    params.mmrAtSale  || 0,
    Math.round(discountPct * 100) / 100,
    params.daysOnMarket || 0,
    params.margin != null ? Math.round(params.margin * 10000) / 100 : 0,  // store as %
    _getSeason(monthNum),
    monthNum,
    params.source || '',
  ];

  sheet.appendRow(row);
  const newRow = sheet.getLastRow();

  // Format currency columns
  sheet.getRange(newRow, ANA.MI_COL.SALE_PRICE + 1)
       .setNumberFormat('$#,##0');
  sheet.getRange(newRow, ANA.MI_COL.MMR_AT_SALE + 1)
       .setNumberFormat('$#,##0');
  sheet.getRange(newRow, ANA.MI_COL.DISCOUNT_PCT + 1)
       .setNumberFormat('0.00"%"');
  sheet.getRange(newRow, ANA.MI_COL.MARGIN_PCT + 1)
       .setNumberFormat('0.00"%"');

  _log('INFO', 'recordSale: ' + params.vin + ' @ $' + params.salePrice);
  return { ok: true, row: newRow };
}

// ── P&L Summary ───────────────────────────────────────────────────────────────

/**
 * Reads the Pipeline sheet, aggregates financials for the requested
 * period, writes results to the P&L Summary sheet, and returns the
 * aggregated object.
 *
 * @param {'monthly'|'quarterly'|'ytd'|'alltime'} period
 * @returns {Object} { period, totalVehicles, revenue, cogs, grossProfit,
 *                     transport, recon, fees, netProfit, netMarginPct,
 *                     avgDaysToSell, bestDealVin, worstDealVin }
 */
function calculatePnLSummary(period) {
  const ss            = _getSpreadsheet();
  const pipelineSheet = ss.getSheetByName('Pipeline');

  const empty = {
    period, totalVehicles: 0, revenue: 0, cogs: 0, grossProfit: 0,
    transport: 0, recon: 0, fees: 0, netProfit: 0, netMarginPct: 0,
    avgDaysToSell: 0, bestDealVin: '', worstDealVin: '',
  };

  if (!pipelineSheet || pipelineSheet.getLastRow() < 2) {
    _log('WARN', 'calculatePnLSummary: Pipeline sheet empty or missing');
    return empty;
  }

  const allData = pipelineSheet.getDataRange().getValues();
  const headers = allData[0];
  const rows    = allData.slice(1);

  // Build column index map from header row
  const idx = {};
  headers.forEach((h, i) => { idx[String(h).trim()] = i; });

  const cutoff  = _getPeriodCutoff(period);
  const now     = new Date();

  // Filter to sold vehicles within the period
  const soldRows = rows.filter(r => {
    if (String(r[idx[ANA.PIPELINE_COLS.STATUS]] || '').trim() !== ANA.SOLD_STATUS) return false;
    const dateSold = r[idx[ANA.PIPELINE_COLS.DATE_SOLD]];
    if (!dateSold) return false;
    const d = new Date(dateSold);
    return !isNaN(d.getTime()) && d >= cutoff && d <= now;
  });

  if (soldRows.length === 0) {
    _writePnLRow(ss, empty);
    return empty;
  }

  let revenue = 0, cogs = 0, transport = 0, recon = 0, fees = 0;
  let totalDays = 0, dayCount = 0;
  let bestMarginPct = -Infinity, worstMarginPct = Infinity;
  let bestDealVin = '', worstDealVin = '';

  soldRows.forEach(r => {
    const sp   = _num(r[idx[ANA.PIPELINE_COLS.SALE_PRICE]]);
    const pp   = _num(r[idx[ANA.PIPELINE_COLS.PURCHASE_PRICE]]);
    const tr   = _num(r[idx[ANA.PIPELINE_COLS.TRANSPORT]]);
    const rc   = _num(r[idx[ANA.PIPELINE_COLS.RECON]]);
    const fe   = _num(r[idx[ANA.PIPELINE_COLS.FEES]]);
    const dom  = _num(r[idx[ANA.PIPELINE_COLS.DAYS_ON_MARKET]]);
    const vin  = String(r[idx[ANA.PIPELINE_COLS.VIN]] || '');

    revenue   += sp;
    cogs      += pp;
    transport += tr;
    recon     += rc;
    fees      += fe;

    if (dom > 0) { totalDays += dom; dayCount++; }

    const netProfitVeh = sp - pp - tr - rc - fe;
    const marginPct    = sp > 0 ? netProfitVeh / sp : 0;

    if (marginPct > bestMarginPct)  { bestMarginPct  = marginPct;  bestDealVin  = vin; }
    if (marginPct < worstMarginPct) { worstMarginPct = marginPct;  worstDealVin = vin; }
  });

  const grossProfit  = revenue - cogs;
  const netProfit    = grossProfit - transport - recon - fees;
  const netMarginPct = revenue > 0 ? Math.round(netProfit / revenue * 10000) / 100 : 0;
  const avgDaysToSell = dayCount > 0 ? Math.round(totalDays / dayCount) : 0;

  const result = {
    period,
    totalVehicles : soldRows.length,
    revenue       : Math.round(revenue),
    cogs          : Math.round(cogs),
    grossProfit   : Math.round(grossProfit),
    transport     : Math.round(transport),
    recon         : Math.round(recon),
    fees          : Math.round(fees),
    netProfit     : Math.round(netProfit),
    netMarginPct,
    avgDaysToSell,
    bestDealVin,
    worstDealVin,
  };

  _writePnLRow(ss, result);
  _log('INFO', 'calculatePnLSummary [' + period + ']: ' + soldRows.length
    + ' vehicles, net $' + result.netProfit + ' (' + netMarginPct + '%)');
  return result;
}

// ── Seasonal Patterns ─────────────────────────────────────────────────────────

/**
 * Analyzes Market Intelligence data to find seasonal discount patterns
 * per make. Uses up to the last 24 months of data.
 *
 * @returns {Object} { byMake: { make: { Jan: avgDiscount, ... } },
 *                     bestMonthToSell: { make: monthName },
 *                     bestMonthToBuy:  { make: monthName } }
 */
function getSeasonalPatterns() {
  const sheet = _getSpreadsheet().getSheetByName(ANA.SHEET_MI);
  if (!sheet || sheet.getLastRow() < 2) return { byMake: {}, bestMonthToSell: {}, bestMonthToBuy: {} };

  const data     = sheet.getDataRange().getValues().slice(1);
  const cutoff   = new Date();
  cutoff.setMonth(cutoff.getMonth() - 24);

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun',
                       'Jul','Aug','Sep','Oct','Nov','Dec'];

  // { make: { monthIdx: [discountPct, ...] } }
  const buckets = {};

  data.forEach(r => {
    const d = new Date(r[ANA.MI_COL.DATE]);
    if (isNaN(d.getTime()) || d < cutoff) return;

    const make    = String(r[ANA.MI_COL.MAKE] || '').trim();
    const month   = parseInt(r[ANA.MI_COL.MONTH], 10);
    const disc    = _num(r[ANA.MI_COL.DISCOUNT_PCT]);

    if (!make || isNaN(month)) return;

    if (!buckets[make]) buckets[make] = {};
    if (!buckets[make][month]) buckets[make][month] = [];
    buckets[make][month].push(disc);
  });

  const byMake           = {};
  const bestMonthToSell  = {};  // highest avg discount = buyer pays less = dealer sells faster
  const bestMonthToBuy   = {};  // lowest  avg discount = best resale pop

  Object.keys(buckets).forEach(make => {
    byMake[make] = {};
    let highestAvg = -Infinity, lowestAvg = Infinity;
    let bestSellMonth = null, bestBuyMonth = null;

    MONTH_NAMES.forEach((name, i) => {
      const vals = buckets[make][i];
      if (!vals || vals.length === 0) {
        byMake[make][name] = null;
        return;
      }
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      byMake[make][name] = Math.round(avg * 100) / 100;
      if (avg > highestAvg) { highestAvg = avg; bestSellMonth = name; }
      if (avg < lowestAvg)  { lowestAvg  = avg; bestBuyMonth  = name; }
    });

    if (bestSellMonth) bestMonthToSell[make] = bestSellMonth;
    if (bestBuyMonth)  bestMonthToBuy[make]  = bestBuyMonth;
  });

  return { byMake, bestMonthToSell, bestMonthToBuy };
}

// ── Market Velocity ───────────────────────────────────────────────────────────

/**
 * Analyzes how quickly each make sells (days-on-market trend).
 * Compares the most recent N/2 sales against the prior N/2 to
 * determine whether velocity is accelerating, slowing, or stable.
 *
 * @returns {Object} { byMake: { make: { avgDays, trend, lastNDeals } },
 *                     fastestMover: make, slowestMover: make }
 */
function getMarketVelocity() {
  const sheet = _getSpreadsheet().getSheetByName(ANA.SHEET_MI);
  if (!sheet || sheet.getLastRow() < 2) {
    return { byMake: {}, fastestMover: null, slowestMover: null };
  }

  const data = sheet.getDataRange().getValues().slice(1)
    .filter(r => new Date(r[ANA.MI_COL.DATE]) instanceof Date
                 && !isNaN(new Date(r[ANA.MI_COL.DATE]).getTime()));

  // Sort ascending by date
  data.sort((a, b) => new Date(a[ANA.MI_COL.DATE]) - new Date(b[ANA.MI_COL.DATE]));

  // Group DOM values by make
  const makeGroups = {};
  data.forEach(r => {
    const make = String(r[ANA.MI_COL.MAKE] || '').trim();
    const dom  = _num(r[ANA.MI_COL.DAYS_ON_MARKET]);
    if (!make || dom <= 0) return;
    if (!makeGroups[make]) makeGroups[make] = [];
    makeGroups[make].push(dom);
  });

  const byMake       = {};
  let fastestMaker   = null, fastestAvg = Infinity;
  let slowestMaker   = null, slowestAvg = -Infinity;

  Object.keys(makeGroups).forEach(make => {
    const vals = makeGroups[make];
    const n    = vals.length;
    const avg  = vals.reduce((s, v) => s + v, 0) / n;

    let trend = 'stable';
    if (n >= 4) {
      const half    = Math.floor(n / 2);
      const recent  = vals.slice(n - half);
      const prior   = vals.slice(n - half * 2, n - half);
      const recentA = recent.reduce((s, v) => s + v, 0) / recent.length;
      const priorA  = prior.reduce((s, v)  => s + v, 0) / prior.length;
      const delta   = recentA - priorA;
      if      (delta < -2) trend = 'accelerating';  // selling faster
      else if (delta >  2) trend = 'slowing';
    }

    byMake[make] = { avgDays: Math.round(avg), trend, lastNDeals: n };

    if (avg < fastestAvg) { fastestAvg = avg; fastestMaker = make; }
    if (avg > slowestAvg) { slowestAvg = avg; slowestMaker = make; }
  });

  return { byMake, fastestMover: fastestMaker, slowestMover: slowestMaker };
}

// ── Seasonal Buying Bonus ─────────────────────────────────────────────────────

/**
 * Returns a score adjustment (-10 to +10) for the scoring model based on
 * how favorable the given month is for buying a specific make.
 * Returns 0 if there is insufficient historical data.
 *
 * @param {string} make   - Vehicle make (e.g. 'Ferrari')
 * @param {number} month  - Month index 0-11
 * @returns {number} Score delta in the range [-10, +10]
 */
function getSeasonalBuyingBonus(make, month) {
  if (!make || month == null || isNaN(month)) return 0;

  const patterns = getSeasonalPatterns();
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun',
                       'Jul','Aug','Sep','Oct','Nov','Dec'];

  const makeData = patterns.byMake[make];
  if (!makeData) return 0;

  const monthName = MONTH_NAMES[month];
  const monthAvg  = makeData[monthName];
  if (monthAvg == null) return 0;

  // Collect all non-null month averages for this make
  const allAvgs = MONTH_NAMES.map(m => makeData[m]).filter(v => v != null);
  if (allAvgs.length < 3) return 0;  // need at least a quarter of data

  const overallAvg = allAvgs.reduce((s, v) => s + v, 0) / allAvgs.length;
  const deviation  = monthAvg - overallAvg;  // positive = higher discount = better buy month

  // Scale deviation to [-10, +10] — clamp at ±5pp deviation
  const clamped = Math.max(-5, Math.min(5, deviation));
  return Math.round(clamped * 2);  // ±5pp maps to ±10 points
}

// ── Looker Studio Export ──────────────────────────────────────────────────────

/**
 * Creates or overwrites the "BI Export" sheet with a clean flat table
 * of all pipeline + sold vehicle data, normalized for Looker Studio.
 *
 * @returns {Object} { sheetUrl, rowCount }
 */
function buildLookerStudioExport() {
  const ss            = _getSpreadsheet();
  const pipelineSheet = ss.getSheetByName('Pipeline');

  const biHeaders = [
    'Export Date','VIN','Make','Model','Year','Status',
    'Purchase Price','Sale Price','MMR','Transport','Recon','Fees',
    'Gross Profit','Net Profit','Net Margin %','Days On Market',
    'Date Acquired','Date Sold','Source','Season','Month Name',
    'Acquisition Month','Sale Month','Acquisition Year','Sale Year',
  ];

  // Wipe and recreate BI Export sheet
  let biSheet = ss.getSheetByName(ANA.SHEET_BI);
  if (biSheet) ss.deleteSheet(biSheet);
  biSheet = ss.insertSheet(ANA.SHEET_BI);

  const hRange = biSheet.getRange(1, 1, 1, biHeaders.length);
  hRange.setValues([biHeaders])
        .setBackground(ANA.HEADER_COLOR_BI)
        .setFontColor('#ffffff')
        .setFontWeight('bold');
  biSheet.setFrozenRows(1);

  if (!pipelineSheet || pipelineSheet.getLastRow() < 2) {
    _log('WARN', 'buildLookerStudioExport: Pipeline sheet empty — BI Export has headers only');
    return { sheetUrl: ss.getUrl(), rowCount: 0 };
  }

  const MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

  const allData = pipelineSheet.getDataRange().getValues();
  const headers = allData[0];
  const rows    = allData.slice(1);
  const idx     = {};
  headers.forEach((h, i) => { idx[String(h).trim()] = i; });

  const exportNow  = new Date();
  const outputRows = [];

  rows.forEach(r => {
    const sp     = _num(r[idx[ANA.PIPELINE_COLS.SALE_PRICE]]);
    const pp     = _num(r[idx[ANA.PIPELINE_COLS.PURCHASE_PRICE]]);
    const tr     = _num(r[idx[ANA.PIPELINE_COLS.TRANSPORT]]);
    const rc     = _num(r[idx[ANA.PIPELINE_COLS.RECON]]);
    const fe     = _num(r[idx[ANA.PIPELINE_COLS.FEES]]);
    const gross  = sp - pp;
    const net    = gross - tr - rc - fe;
    const margin = sp > 0 ? Math.round(net / sp * 10000) / 100 : 0;

    const dateAcq  = r[idx[ANA.PIPELINE_COLS.DATE_ACQUIRED]];
    const dateSold = r[idx[ANA.PIPELINE_COLS.DATE_SOLD]];
    const dAcq     = dateAcq  ? new Date(dateAcq)  : null;
    const dSold    = dateSold ? new Date(dateSold)  : null;

    const acqMonth   = dAcq  && !isNaN(dAcq.getTime())  ? dAcq.getMonth()   : null;
    const saleMonth  = dSold && !isNaN(dSold.getTime()) ? dSold.getMonth()  : null;
    const acqYear    = dAcq  && !isNaN(dAcq.getTime())  ? dAcq.getFullYear(): null;
    const saleYear   = dSold && !isNaN(dSold.getTime()) ? dSold.getFullYear(): null;

    outputRows.push([
      exportNow,
      r[idx[ANA.PIPELINE_COLS.VIN]]   || '',
      r[idx[ANA.PIPELINE_COLS.MAKE]]  || '',
      r[idx[ANA.PIPELINE_COLS.MODEL]] || '',
      r[idx[ANA.PIPELINE_COLS.YEAR]]  || '',
      r[idx[ANA.PIPELINE_COLS.STATUS]]|| '',
      pp, sp,
      _num(r[idx[ANA.PIPELINE_COLS.MMR]]),
      tr, rc, fe,
      Math.round(gross),
      Math.round(net),
      margin,
      _num(r[idx[ANA.PIPELINE_COLS.DAYS_ON_MARKET]]),
      dAcq  || '',
      dSold || '',
      r[idx[ANA.PIPELINE_COLS.SOURCE]] || '',
      saleMonth != null ? _getSeason(saleMonth) : '',
      saleMonth != null ? MONTH_NAMES[saleMonth] : '',
      acqMonth  != null ? MONTH_NAMES[acqMonth]  : '',
      saleMonth != null ? MONTH_NAMES[saleMonth] : '',
      acqYear   || '',
      saleYear  || '',
    ]);
  });

  if (outputRows.length > 0) {
    biSheet.getRange(2, 1, outputRows.length, biHeaders.length).setValues(outputRows);
  }

  // Auto-resize key columns
  biSheet.autoResizeColumns(1, biHeaders.length);

  _log('INFO', 'buildLookerStudioExport: ' + outputRows.length + ' rows written to BI Export');
  return { sheetUrl: ss.getUrl() + '#gid=' + biSheet.getSheetId(), rowCount: outputRows.length };
}

// ── Dashboard Stats ───────────────────────────────────────────────────────────

/**
 * Comprehensive stats object consumed by the analytics tab in the
 * dealer command center dashboard.
 *
 * @returns {Object} { pnl, pipeline, velocity, topMakes, recentSales, alerts }
 */
function getDashboardStats() {
  try {
    const ss            = _getSpreadsheet();
    const pipelineSheet = ss.getSheetByName('Pipeline');
    const now           = new Date();

    const empty = {
      pnl: {
        mtd: { revenue: 0, cost: 0, profit: 0, margin: 0 },
        qtd: { revenue: 0, cost: 0, profit: 0, margin: 0 },
        ytd: { revenue: 0, cost: 0, profit: 0, margin: 0 },
      },
      pipeline   : { active: 0, staged: {} },
      velocity   : { avgDaysToSell30d: 0, avgDaysToSell90d: 0 },
      topMakes   : [],
      recentSales: [],
      alerts     : [],
    };

    if (!pipelineSheet || pipelineSheet.getLastRow() < 2) return empty;

    const allData = pipelineSheet.getDataRange().getValues();
    const headers = allData[0];
    const rows    = allData.slice(1);
    const idx     = {};
    headers.forEach((h, i) => { idx[String(h).trim()] = i; });

    // ── Date cutoffs ─────────────────────────────────────────────────────────
    const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const qtdStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const ytdStart = new Date(now.getFullYear(), 0, 1);
    const d30      = new Date(now); d30.setDate(d30.getDate() - 30);
    const d90      = new Date(now); d90.setDate(d90.getDate() - 90);

    // ── Accumulators ─────────────────────────────────────────────────────────
    const pnlAcc = {
      mtd: { rev: 0, cost: 0 }, qtd: { rev: 0, cost: 0 }, ytd: { rev: 0, cost: 0 },
    };
    const staged     = {};
    let   active     = 0;
    const dom30      = [], dom90 = [];
    const makeMap    = {};  // make -> { count, totalMarginPct }
    const recentSold = [];
    const alerts     = [];

    rows.forEach(r => {
      const status   = String(r[idx[ANA.PIPELINE_COLS.STATUS]] || '').trim();
      const make     = String(r[idx[ANA.PIPELINE_COLS.MAKE]]   || '').trim();
      const model    = String(r[idx[ANA.PIPELINE_COLS.MODEL]]  || '').trim();
      const year     = r[idx[ANA.PIPELINE_COLS.YEAR]]  || '';
      const vin      = String(r[idx[ANA.PIPELINE_COLS.VIN]]    || '');
      const sp       = _num(r[idx[ANA.PIPELINE_COLS.SALE_PRICE]]);
      const pp       = _num(r[idx[ANA.PIPELINE_COLS.PURCHASE_PRICE]]);
      const tr       = _num(r[idx[ANA.PIPELINE_COLS.TRANSPORT]]);
      const rc       = _num(r[idx[ANA.PIPELINE_COLS.RECON]]);
      const fe       = _num(r[idx[ANA.PIPELINE_COLS.FEES]]);
      const dom      = _num(r[idx[ANA.PIPELINE_COLS.DAYS_ON_MARKET]]);
      const dateSold = r[idx[ANA.PIPELINE_COLS.DATE_SOLD]];
      const dateAcq  = r[idx[ANA.PIPELINE_COLS.DATE_ACQUIRED]];

      // ── Pipeline active + staging breakdown ──────────────────────────────
      if (status !== ANA.SOLD_STATUS) {
        active++;
        staged[status] = staged[status] || { count: 0, value: 0 };
        staged[status].count++;
        staged[status].value += pp;

        // Stale inventory alert (>60 days without a sale)
        if (dateAcq) {
          const dAcq = new Date(dateAcq);
          if (!isNaN(dAcq.getTime())) {
            const ageDays = Math.round((now - dAcq) / 86400000);
            if (ageDays > 60) {
              alerts.push({
                type   : 'stale_inventory',
                message: make + ' ' + model + ' (' + year + ') — ' + ageDays + ' days in stock',
                vin,
              });
            }
          }
        }
        return;  // skip P&L for unsold
      }

      // ── Sold vehicle metrics ──────────────────────────────────────────────
      const dSold = dateSold ? new Date(dateSold) : null;
      if (!dSold || isNaN(dSold.getTime())) return;

      const net       = sp - pp - tr - rc - fe;
      const marginPct = sp > 0 ? net / sp * 100 : 0;

      // Overage alert — negative margin
      if (marginPct < 0) {
        alerts.push({
          type   : 'negative_margin',
          message: make + ' ' + model + ' sold at ' + Math.round(marginPct) + '% margin',
          vin,
        });
      }

      // P&L buckets
      [['mtd', mtdStart], ['qtd', qtdStart], ['ytd', ytdStart]].forEach(([key, start]) => {
        if (dSold >= start) {
          pnlAcc[key].rev  += sp;
          pnlAcc[key].cost += pp + tr + rc + fe;
        }
      });

      // Velocity
      if (dom > 0) {
        if (dSold >= d30) dom30.push(dom);
        if (dSold >= d90) dom90.push(dom);
      }

      // Make aggregation
      if (make) {
        if (!makeMap[make]) makeMap[make] = { count: 0, totalMarginPct: 0 };
        makeMap[make].count++;
        makeMap[make].totalMarginPct += marginPct;
      }

      // Recent sales list (collect all, slice after)
      recentSold.push({ dSold, vin, make, model, year, soldPrice: sp, margin: Math.round(marginPct * 100) / 100, daysToSell: dom });
    });

    // ── Finalize P&L ─────────────────────────────────────────────────────────
    const pnl = {};
    ['mtd','qtd','ytd'].forEach(k => {
      const rev    = Math.round(pnlAcc[k].rev);
      const cost   = Math.round(pnlAcc[k].cost);
      const profit = rev - cost;
      pnl[k] = {
        revenue: rev,
        cost,
        profit,
        margin : rev > 0 ? Math.round(profit / rev * 10000) / 100 : 0,
      };
    });

    // ── Velocity ─────────────────────────────────────────────────────────────
    const avg = arr => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;
    const velocity = {
      avgDaysToSell30d: avg(dom30),
      avgDaysToSell90d: avg(dom90),
    };

    // ── Top Makes ────────────────────────────────────────────────────────────
    const topMakes = Object.keys(makeMap)
      .map(m => ({
        make      : m,
        count     : makeMap[m].count,
        avgMargin : Math.round(makeMap[m].totalMarginPct / makeMap[m].count * 100) / 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // ── Recent Sales ─────────────────────────────────────────────────────────
    const recentSales = recentSold
      .sort((a, b) => b.dSold - a.dSold)
      .slice(0, 10)
      .map(({ dSold: _d, ...rest }) => rest);  // strip internal sort key

    return { pnl, pipeline: { active, staged }, velocity, topMakes, recentSales, alerts };

  } catch (err) {
    _log('ERROR', 'getDashboardStats: ' + err.message);
    return { error: err.message };
  }
}

// ── Monthly Cleanup ───────────────────────────────────────────────────────────

/**
 * Designed to run on the 1st of each month via a time-based trigger.
 * Calculates the previous month's P&L, rebuilds the BI Export, and logs results.
 * Install with: ScriptApp.newTrigger('runMonthlyCleanup')
 *                 .timeBased().onMonthDay(1).atHour(3).create();
 */
function runMonthlyCleanup() {
  _log('INFO', '=== Monthly Cleanup Start ===');
  try {
    const pnl    = calculatePnLSummary('monthly');
    const biExpt = buildLookerStudioExport();
    _log('INFO', 'Monthly P&L: vehicles=' + pnl.totalVehicles
      + ', net=$' + pnl.netProfit + ' (' + pnl.netMarginPct + '%)');
    _log('INFO', 'BI Export: ' + biExpt.rowCount + ' rows — ' + biExpt.sheetUrl);
    _log('INFO', '=== Monthly Cleanup Complete ===');
    return { ok: true, pnl, biExport: biExpt };
  } catch (err) {
    _log('ERROR', 'runMonthlyCleanup: ' + err.message);
    return { ok: false, error: err.message };
  }
}

// ── Private Helpers ───────────────────────────────────────────────────────────

/**
 * Safely converts a value to a number; returns 0 for falsy/NaN.
 * @param {*} v
 * @returns {number}
 */
function _num(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

/**
 * Returns the season name for a given 0-indexed month.
 * @param {number} month  0-11
 * @returns {'Spring'|'Summer'|'Fall'|'Winter'}
 */
function _getSeason(month) {
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Fall';
  return 'Winter';
}

/**
 * Returns a Date representing the start of the requested period.
 * @param {'monthly'|'quarterly'|'ytd'|'alltime'} period
 * @returns {Date}
 */
function _getPeriodCutoff(period) {
  const now = new Date();
  switch (period) {
    case 'monthly':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'quarterly':
      return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    case 'ytd':
      return new Date(now.getFullYear(), 0, 1);
    case 'alltime':
    default:
      return new Date(0);  // epoch
  }
}

/**
 * Appends or updates a P&L row in the P&L Summary sheet.
 * Matches on the period label; updates if found, appends otherwise.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {Object} result  - Output of calculatePnLSummary
 */
function _writePnLRow(ss, result) {
  let sheet = ss.getSheetByName(ANA.SHEET_PNL);
  if (!sheet) {
    setupAnalyticsSheets();
    sheet = ss.getSheetByName(ANA.SHEET_PNL);
  }

  const newRow = [
    result.period,
    result.totalVehicles,
    result.revenue,
    result.cogs,
    result.grossProfit,
    result.transport,
    result.recon,
    result.fees,
    result.netProfit,
    result.netMarginPct,
    result.avgDaysToSell,
    result.bestDealVin,
    result.worstDealVin,
  ];

  // Look for an existing row with this period label to update in-place
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const periodCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < periodCol.length; i++) {
      if (String(periodCol[i][0]).trim() === String(result.period).trim()) {
        sheet.getRange(i + 2, 1, 1, newRow.length).setValues([newRow]);
        return;
      }
    }
  }

  sheet.appendRow(newRow);

  // Format currency columns on the new row
  const row = sheet.getLastRow();
  const currencyCols = [3, 4, 5, 6, 7, 8, 9];  // Revenue through Net Profit (1-indexed)
  currencyCols.forEach(c => sheet.getRange(row, c).setNumberFormat('$#,##0'));
  sheet.getRange(row, 10).setNumberFormat('0.00"%"');  // Net Margin%
}
