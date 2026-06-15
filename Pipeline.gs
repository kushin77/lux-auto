// ============================================================
// LUX AUTO — Deal Pipeline Manager
// Google Apps Script  |  Pipeline.gs
//
// Manages the full deal lifecycle from acquisition to sale:
//   Spotted → Watching → Won → In Transport → Recon →
//   Listed → Sold → (Passed / Arbitrated)
//
// Sheet: "Pipeline"
// Depends on: _getSpreadsheet(), _log() from Code.gs
// ============================================================

// ── Pipeline Configuration ────────────────────────────────────────────────────

/** Ordered pipeline stages used for validation and display. */
const PIPELINE_STAGES = [
  'Spotted', 'Watching', 'Won', 'In Transport',
  'Recon', 'Listed', 'Sold', 'Passed', 'Arbitrated',
];

/** Background color for each stage cell (conditional formatting palette). */
const STAGE_COLORS = {
  'Spotted'      : '#fff9c4',  // light yellow
  'Watching'     : '#bbdefb',  // light blue
  'Won'          : '#c8e6c9',  // light green
  'In Transport' : '#ffe0b2',  // orange (light)
  'Recon'        : '#e1bee7',  // light purple
  'Listed'       : '#b2dfdb',  // light teal
  'Sold'         : '#388e3c',  // dark green  (white text)
  'Passed'       : '#e0e0e0',  // light gray
  'Arbitrated'   : '#ef9a9a',  // light red
};

/** Font color overrides — only needed for dark-background stages. */
const STAGE_FONT_COLORS = {
  'Sold': '#ffffff',
};

/**
 * Column headers for the Pipeline sheet (1-based index = position).
 * Column 17 = Stage, Column 30 = Last Updated, Column 31 = Stage Changed At (hidden anchor).
 */
const PIPELINE_HEADERS = [
  'VIN',              // 1
  'Make',             // 2
  'Model',            // 3
  'Year',             // 4
  'Color',            // 5
  'Mileage',          // 6
  'Buy Price',        // 7
  'Transport Cost',   // 8
  'Recon Cost',       // 9
  'Fees',             // 10
  'Total Cost',       // 11  — formula: =G+H+I+J
  'Ask Price',        // 12
  'Sold Price',       // 13
  'Gross Profit',     // 14  — formula: =M-G  (sold - buy)
  'Net Profit',       // 15  — formula: =M-K  (sold - total cost)
  'Margin %',         // 16  — formula: =O/M  (net profit / sold)
  'Stage',            // 17
  'Buyer Name',       // 18
  'Buyer Email',      // 19
  'Days In Stage',    // 20
  'Total Days',       // 21
  'Purchase Date',    // 22
  'Transport ETA',    // 23
  'Recon Complete',   // 24
  'List Date',        // 25
  'Sold Date',        // 26
  'Notes',            // 27
  'Watchlist URL',    // 28
  'Drive Folder ID',  // 29
  'Chat Notified',    // 30
  'Last Updated',     // 31
  'Stage Changed At', // 32  — internal timestamp; hidden column
];

// Column index constants (1-based) for clean references throughout the file.
const PC = {
  VIN            : 1,
  MAKE           : 2,
  MODEL          : 3,
  YEAR           : 4,
  COLOR          : 5,
  MILEAGE        : 6,
  BUY_PRICE      : 7,
  TRANSPORT_COST : 8,
  RECON_COST     : 9,
  FEES           : 10,
  TOTAL_COST     : 11,
  ASK_PRICE      : 12,
  SOLD_PRICE     : 13,
  GROSS_PROFIT   : 14,
  NET_PROFIT     : 15,
  MARGIN_PCT     : 16,
  STAGE          : 17,
  BUYER_NAME     : 18,
  BUYER_EMAIL    : 19,
  DAYS_IN_STAGE  : 20,
  TOTAL_DAYS     : 21,
  PURCHASE_DATE  : 22,
  TRANSPORT_ETA  : 23,
  RECON_COMPLETE : 24,
  LIST_DATE      : 25,
  SOLD_DATE      : 26,
  NOTES          : 27,
  WATCHLIST_URL  : 28,
  DRIVE_FOLDER   : 29,
  CHAT_NOTIFIED  : 30,
  LAST_UPDATED   : 31,
  STAGE_CHANGED  : 32,  // hidden anchor for days-in-stage calculation
};

const PIPELINE_SHEET_NAME  = 'Pipeline';
const ARCHIVE_SHEET_NAME   = 'Archive';
const ARCHIVE_DAYS_CUTOFF  = 90;   // sold deals older than this get archived
const AT_RISK_DAYS         = 30;   // days in Recon or In Transport before flagging

// ── Sheet Setup ───────────────────────────────────────────────────────────────

/**
 * Creates (or resets formatting on) the Pipeline sheet.
 *
 * - Writes the full header row with a dark-charcoal background.
 * - Freezes row 1 and column 1 (VIN).
 * - Sets practical column widths.
 * - Applies conditional formatting rules to the Stage column (col 17) so
 *   each stage gets its own background color automatically.
 * - Hides the internal "Stage Changed At" column (col 32).
 *
 * Safe to run repeatedly — it will not overwrite existing data rows.
 */
function setupPipelineSheet() {
  try {
    const ss    = _getSpreadsheet();
    let   sheet = ss.getSheetByName(PIPELINE_SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(PIPELINE_SHEET_NAME);
    }

    // ── Headers ──────────────────────────────────────────────────────────────
    const headerRange = sheet.getRange(1, 1, 1, PIPELINE_HEADERS.length);
    headerRange
      .setValues([PIPELINE_HEADERS])
      .setBackground('#263238')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setFontSize(10)
      .setWrap(false);

    // ── Freeze ────────────────────────────────────────────────────────────────
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(1);

    // ── Column widths (batch via setColumnWidth) ───────────────────────────
    const widths = {
      1: 160,  // VIN
      2: 100,  // Make
      3: 110,  // Model
      4:  55,  // Year
      5:  80,  // Color
      6:  80,  // Mileage
      7:  95,  // Buy Price
      8:  95,  // Transport Cost
      9:  90,  // Recon Cost
      10:  70, // Fees
      11:  95, // Total Cost
      12:  90, // Ask Price
      13:  90, // Sold Price
      14:  95, // Gross Profit
      15:  90, // Net Profit
      16:  80, // Margin %
      17: 115, // Stage
      18: 130, // Buyer Name
      19: 175, // Buyer Email
      20:  85, // Days In Stage
      21:  80, // Total Days
      22: 115, // Purchase Date
      23: 115, // Transport ETA
      24: 115, // Recon Complete
      25: 100, // List Date
      26: 100, // Sold Date
      27: 200, // Notes
      28: 200, // Watchlist URL
      29: 150, // Drive Folder ID
      30: 100, // Chat Notified
      31: 130, // Last Updated
      32:   1, // Stage Changed At (hidden)
    };
    Object.entries(widths).forEach(([col, w]) => {
      sheet.setColumnWidth(parseInt(col), w);
    });

    // ── Conditional formatting — Stage column ─────────────────────────────
    // Remove any existing rules before re-applying so re-runs are idempotent.
    sheet.clearConditionalFormatRules();
    const rules = [];
    const stageColA1 = 'Q2:Q'; // column 17 = Q

    PIPELINE_STAGES.forEach(stage => {
      const bg   = STAGE_COLORS[stage]      || '#ffffff';
      const font = STAGE_FONT_COLORS[stage] || '#000000';
      const rule = SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(stage)
        .setBackground(bg)
        .setFontColor(font)
        .setFontWeight('bold')
        .setRanges([sheet.getRange(stageColA1)])
        .build();
      rules.push(rule);
    });
    sheet.setConditionalFormatRules(rules);

    // ── Number formats on financial columns ──────────────────────────────
    const currency = '$#,##0.00';
    const pct      = '0.00%';
    [PC.BUY_PRICE, PC.TRANSPORT_COST, PC.RECON_COST, PC.FEES,
     PC.TOTAL_COST, PC.ASK_PRICE, PC.SOLD_PRICE,
     PC.GROSS_PROFIT, PC.NET_PROFIT].forEach(col => {
      sheet.getRange(2, col, sheet.getMaxRows() - 1, 1).setNumberFormat(currency);
    });
    sheet.getRange(2, PC.MARGIN_PCT, sheet.getMaxRows() - 1, 1).setNumberFormat(pct);

    _pipelineLog('SETUP', '', 'Pipeline sheet configured');
    Logger.log('setupPipelineSheet complete');
    return { success: true };
  } catch (err) {
    Logger.log('setupPipelineSheet error: ' + err.message);
    return { success: false, error: err.message };
  }
}

// ── Add Deal ──────────────────────────────────────────────────────────────────

/**
 * Appends a new deal row to the Pipeline sheet.
 *
 * Columns 11, 14, 15, 16 (Total Cost, Gross Profit, Net Profit, Margin %)
 * are written as live spreadsheet formulas so they stay current as cost fields
 * are updated later.
 *
 * @param {Object} params
 * @param {string} params.vin          - Vehicle Identification Number (required)
 * @param {string} params.make         - Make (e.g. "Ferrari")
 * @param {string} params.model        - Model (e.g. "488 GTB")
 * @param {number} params.year         - Model year
 * @param {string} [params.color]      - Exterior color
 * @param {number} [params.mileage]    - Odometer reading
 * @param {number} params.buyPrice     - Acquisition cost in dollars
 * @param {string} [params.watchlistUrl] - Source listing URL
 * @param {string} [params.notes]      - Free-text notes
 * @returns {{success: boolean, row?: number, error?: string}}
 */
function addDealToPipeline(params) {
  try {
    if (!params || !params.vin) {
      return { success: false, error: 'VIN is required' };
    }

    const ss    = _getSpreadsheet();
    const sheet = _getPipelineSheet(ss);

    // Prevent duplicate VINs
    if (_findVinRow(sheet, params.vin) !== -1) {
      return { success: false, error: 'VIN already exists in Pipeline: ' + params.vin };
    }

    const now = new Date();

    // Build row as a flat array; formulas reference the row being appended.
    // We need to know the target row number first.
    const targetRow = Math.max(sheet.getLastRow() + 1, 2);
    const r = targetRow; // alias for formula strings

    // Column letter helpers
    const col = (n) => _colLetter(n);

    const rowData = [
      String(params.vin || '').trim().toUpperCase(), // 1  VIN
      String(params.make  || ''),                    // 2  Make
      String(params.model || ''),                    // 3  Model
      params.year     ? parseInt(params.year)   : '', // 4  Year
      String(params.color || ''),                    // 5  Color
      params.mileage  ? parseInt(params.mileage) : '', // 6  Mileage
      params.buyPrice ? parseFloat(params.buyPrice) : 0, // 7  Buy Price
      0,                                             // 8  Transport Cost
      0,                                             // 9  Recon Cost
      0,                                             // 10 Fees
      // 11 Total Cost = Buy + Transport + Recon + Fees
      '=' + col(PC.BUY_PRICE) + r + '+' + col(PC.TRANSPORT_COST) + r + '+' +
            col(PC.RECON_COST) + r + '+' + col(PC.FEES) + r,
      '',                                            // 12 Ask Price
      '',                                            // 13 Sold Price
      // 14 Gross Profit = Sold Price - Buy Price
      '=IF(' + col(PC.SOLD_PRICE) + r + '<>"",' +
         col(PC.SOLD_PRICE) + r + '-' + col(PC.BUY_PRICE) + r + ',"")',
      // 15 Net Profit = Sold Price - Total Cost
      '=IF(' + col(PC.SOLD_PRICE) + r + '<>"",' +
         col(PC.SOLD_PRICE) + r + '-' + col(PC.TOTAL_COST) + r + ',"")',
      // 16 Margin % = Net Profit / Sold Price
      '=IF(AND(' + col(PC.SOLD_PRICE) + r + '<>"",' +
         col(PC.SOLD_PRICE) + r + '<>0),' +
         col(PC.NET_PROFIT) + r + '/' + col(PC.SOLD_PRICE) + r + ',"")',
      'Spotted',                                     // 17 Stage
      '',                                            // 18 Buyer Name
      '',                                            // 19 Buyer Email
      0,                                             // 20 Days In Stage
      0,                                             // 21 Total Days
      params.purchaseDate ? new Date(params.purchaseDate) : now, // 22 Purchase Date
      '',                                            // 23 Transport ETA
      '',                                            // 24 Recon Complete
      '',                                            // 25 List Date
      '',                                            // 26 Sold Date
      String(params.notes || ''),                    // 27 Notes
      String(params.watchlistUrl || ''),             // 28 Watchlist URL
      '',                                            // 29 Drive Folder ID
      'No',                                          // 30 Chat Notified
      now,                                           // 31 Last Updated
      now,                                           // 32 Stage Changed At (hidden anchor)
    ];

    // Batch write: all columns in one setValues call
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);

    _pipelineLog('ADD', params.vin,
      (params.year || '') + ' ' + (params.make || '') + ' ' + (params.model || '') +
      ' | Buy: $' + (params.buyPrice || 0));

    return { success: true, row: targetRow };
  } catch (err) {
    _pipelineLog('ERROR', params && params.vin ? params.vin : '?',
      'addDealToPipeline: ' + err.message);
    return { success: false, error: err.message };
  }
}

// ── Update Stage ──────────────────────────────────────────────────────────────

/**
 * Moves a deal to a new pipeline stage.
 *
 * Resets the Days In Stage counter (column 20) to 0 and records the stage
 * change timestamp in the hidden column 32 so `getPipelineData()` can
 * compute accurate "days in stage" values going forward.
 *
 * @param {string} vin      - VIN to look up
 * @param {string} newStage - Must be one of PIPELINE_STAGES
 * @param {string} [notes]  - Optional note appended to the Notes column
 * @returns {{success: boolean, previousStage?: string, newStage?: string, error?: string}}
 */
function updateDealStage(vin, newStage, notes) {
  try {
    if (!vin)      return { success: false, error: 'VIN is required' };
    if (!newStage) return { success: false, error: 'newStage is required' };
    if (!PIPELINE_STAGES.includes(newStage)) {
      return { success: false, error: 'Invalid stage: ' + newStage +
               '. Valid stages: ' + PIPELINE_STAGES.join(', ') };
    }

    const ss    = _getSpreadsheet();
    const sheet = _getPipelineSheet(ss);
    const row   = _findVinRow(sheet, vin);

    if (row === -1) {
      return { success: false, error: 'VIN not found in Pipeline: ' + vin };
    }

    const now          = new Date();
    const totalCols    = PIPELINE_HEADERS.length;
    const rowVals      = sheet.getRange(row, 1, 1, totalCols).getValues()[0];
    const previousStage = String(rowVals[PC.STAGE - 1] || '');

    // Accumulate total days by adding current days-in-stage to running total
    const prevDaysInStage = parseInt(rowVals[PC.DAYS_IN_STAGE - 1]) || 0;
    const prevTotalDays   = parseInt(rowVals[PC.TOTAL_DAYS - 1])    || 0;
    const newTotalDays    = prevTotalDays + prevDaysInStage;

    // Append notes if provided
    const existingNotes = String(rowVals[PC.NOTES - 1] || '');
    const updatedNotes  = notes
      ? (existingNotes ? existingNotes + '\n' : '') +
        '[' + _formatDate(now) + ' → ' + newStage + '] ' + notes
      : existingNotes;

    // Batch write: Stage, Days In Stage (reset), Total Days, Notes, Last Updated, Stage Changed At
    const updates = [
      [PC.STAGE,         newStage],
      [PC.DAYS_IN_STAGE, 0],
      [PC.TOTAL_DAYS,    newTotalDays],
      [PC.NOTES,         updatedNotes],
      [PC.LAST_UPDATED,  now],
      [PC.STAGE_CHANGED, now],
    ];

    // Group contiguous columns into single setValues calls for efficiency
    updates.forEach(([col, val]) => {
      sheet.getRange(row, col).setValue(val);
    });

    _pipelineLog('STAGE_CHANGE', vin,
      previousStage + ' → ' + newStage + (notes ? ' | ' + notes : ''));

    return { success: true, previousStage, newStage };
  } catch (err) {
    _pipelineLog('ERROR', vin || '?', 'updateDealStage: ' + err.message);
    return { success: false, error: err.message };
  }
}

// ── Update Costs ──────────────────────────────────────────────────────────────

/**
 * Updates cost, pricing, and buyer fields for a deal.
 *
 * Only fields explicitly present in the `costs` object are written; omitted
 * fields are left unchanged. Profit formula columns (11, 14, 15, 16) are
 * spreadsheet formulas and will recalculate automatically when cost fields
 * change — no explicit re-calculation needed here.
 *
 * @param {string} vin
 * @param {Object} costs
 * @param {number}  [costs.transportCost]
 * @param {number}  [costs.reconCost]
 * @param {number}  [costs.fees]
 * @param {number}  [costs.askPrice]
 * @param {number}  [costs.soldPrice]
 * @param {string|Date} [costs.soldDate]
 * @param {string}  [costs.buyerName]
 * @param {string}  [costs.buyerEmail]
 * @returns {{success: boolean, data?: Object, error?: string}}
 */
function updateDealCosts(vin, costs) {
  try {
    if (!vin)   return { success: false, error: 'VIN is required' };
    if (!costs) return { success: false, error: 'costs object is required' };

    const ss    = _getSpreadsheet();
    const sheet = _getPipelineSheet(ss);
    const row   = _findVinRow(sheet, vin);

    if (row === -1) {
      return { success: false, error: 'VIN not found in Pipeline: ' + vin };
    }

    const now = new Date();

    // Map of field name → column index, only for fields present in costs
    const fieldMap = {
      transportCost : PC.TRANSPORT_COST,
      reconCost     : PC.RECON_COST,
      fees          : PC.FEES,
      askPrice      : PC.ASK_PRICE,
      soldPrice     : PC.SOLD_PRICE,
      soldDate      : PC.SOLD_DATE,
      buyerName     : PC.BUYER_NAME,
      buyerEmail    : PC.BUYER_EMAIL,
    };

    const writes = [];
    Object.entries(fieldMap).forEach(([field, col]) => {
      if (costs[field] !== undefined && costs[field] !== null) {
        let val = costs[field];
        // Normalize numeric fields
        if (['transportCost','reconCost','fees','askPrice','soldPrice'].includes(field)) {
          val = parseFloat(val) || 0;
        }
        // Normalize date fields
        if (field === 'soldDate' && val && !(val instanceof Date)) {
          val = new Date(val);
        }
        writes.push([col, val]);
      }
    });

    writes.push([PC.LAST_UPDATED, now]);

    // Write all changes — each is a single-cell update; grouping into a batch
    // range would require consecutive columns which may not hold here, so we
    // use individual setValue calls wrapped in one sheet interaction.
    writes.forEach(([col, val]) => {
      sheet.getRange(row, col).setValue(val);
    });

    // Return the updated row as a plain object for the caller
    const updatedRow = sheet.getRange(row, 1, 1, PIPELINE_HEADERS.length).getValues()[0];
    const data = _rowToObject(updatedRow);

    const changeSummary = writes
      .filter(([col]) => col !== PC.LAST_UPDATED)
      .map(([col, val]) => PIPELINE_HEADERS[col - 1] + '=' + val)
      .join(', ');
    _pipelineLog('UPDATE_COSTS', vin, changeSummary);

    return { success: true, data };
  } catch (err) {
    _pipelineLog('ERROR', vin || '?', 'updateDealCosts: ' + err.message);
    return { success: false, error: err.message };
  }
}

// ── Read Pipeline ─────────────────────────────────────────────────────────────

/**
 * Returns all pipeline deals as an array of plain objects, sorted by
 * Last Updated descending (most recent activity first).
 *
 * The `daysInStage` field is computed dynamically from today minus the
 * Stage Changed At timestamp stored in the hidden column 32.
 *
 * @returns {Object[]} Array of deal objects, or empty array on error.
 */
function getPipelineData() {
  try {
    const ss    = _getSpreadsheet();
    const sheet = _getPipelineSheet(ss);
    const last  = sheet.getLastRow();

    if (last < 2) return [];

    const values = sheet.getRange(2, 1, last - 1, PIPELINE_HEADERS.length).getValues();
    const today  = new Date();

    const deals = values
      .map(row => _rowToObject(row, today))
      .filter(d => d.vin);  // skip blank rows

    // Sort by Last Updated descending
    deals.sort((a, b) => {
      const da = a.lastUpdated instanceof Date ? a.lastUpdated.getTime() : 0;
      const db = b.lastUpdated instanceof Date ? b.lastUpdated.getTime() : 0;
      return db - da;
    });

    return deals;
  } catch (err) {
    _pipelineLog('ERROR', '', 'getPipelineData: ' + err.message);
    return [];
  }
}

/**
 * Returns a single deal object by VIN, or null if not found.
 *
 * @param {string} vin
 * @returns {Object|null}
 */
function getPipelineRow(vin) {
  try {
    if (!vin) return null;
    const ss    = _getSpreadsheet();
    const sheet = _getPipelineSheet(ss);
    const row   = _findVinRow(sheet, vin);
    if (row === -1) return null;

    const values = sheet.getRange(row, 1, 1, PIPELINE_HEADERS.length).getValues()[0];
    return _rowToObject(values, new Date());
  } catch (err) {
    _pipelineLog('ERROR', vin || '?', 'getPipelineRow: ' + err.message);
    return null;
  }
}

// ── Summary / Analytics ───────────────────────────────────────────────────────

/**
 * Returns aggregate pipeline statistics.
 *
 * @returns {{
 *   totalDeals: number,
 *   totalCapitalDeployed: number,
 *   totalGrossProfit: number,
 *   avgMargin: number,
 *   avgDaysToSell: number,
 *   dealsByStage: Object,
 *   dealsAtRisk: Object[]
 * }}
 */
function getPipelineSummary() {
  try {
    const deals = getPipelineData();

    const dealsByStage = {};
    PIPELINE_STAGES.forEach(s => { dealsByStage[s] = 0; });

    let totalCapital    = 0;
    let totalGross      = 0;
    let totalMarginSum  = 0;
    let marginCount     = 0;
    let totalDaysToSell = 0;
    let soldCount       = 0;
    const dealsAtRisk   = [];

    deals.forEach(d => {
      // Stage counts
      if (dealsByStage.hasOwnProperty(d.stage)) {
        dealsByStage[d.stage]++;
      }

      // Capital deployed = sum of buy prices for non-sold, non-passed deals
      if (!['Sold','Passed','Arbitrated'].includes(d.stage)) {
        totalCapital += parseFloat(d.buyPrice) || 0;
      }

      // Profit metrics — only on Sold deals
      if (d.stage === 'Sold') {
        const gross = parseFloat(d.grossProfit) || 0;
        const net   = parseFloat(d.netProfit)   || 0;
        const sold  = parseFloat(d.soldPrice)   || 0;
        totalGross += gross;
        if (sold > 0) {
          totalMarginSum += net / sold;
          marginCount++;
        }
        const totalDays = parseInt(d.totalDays) || 0;
        if (totalDays > 0) {
          totalDaysToSell += totalDays;
          soldCount++;
        }
      }

      // At-risk: Recon or In Transport deals with daysInStage > AT_RISK_DAYS
      if (['Recon','In Transport'].includes(d.stage)) {
        const days = parseInt(d.daysInStage) || 0;
        if (days > AT_RISK_DAYS) {
          dealsAtRisk.push({
            vin          : d.vin,
            make         : d.make,
            model        : d.model,
            year         : d.year,
            stage        : d.stage,
            daysInStage  : days,
            buyPrice     : d.buyPrice,
          });
        }
      }
    });

    return {
      totalDeals           : deals.filter(d => !['Passed','Arbitrated'].includes(d.stage)).length,
      totalCapitalDeployed : Math.round(totalCapital),
      totalGrossProfit     : Math.round(totalGross),
      avgMargin            : marginCount ? Math.round((totalMarginSum / marginCount) * 10000) / 100 : 0,
      avgDaysToSell        : soldCount   ? Math.round(totalDaysToSell / soldCount) : 0,
      dealsByStage,
      dealsAtRisk,
    };
  } catch (err) {
    _pipelineLog('ERROR', '', 'getPipelineSummary: ' + err.message);
    return {
      totalDeals: 0, totalCapitalDeployed: 0, totalGrossProfit: 0,
      avgMargin: 0, avgDaysToSell: 0, dealsByStage: {}, dealsAtRisk: [],
    };
  }
}

// ── Archive ───────────────────────────────────────────────────────────────────

/**
 * Moves Sold deals whose Sold Date is more than ARCHIVE_DAYS_CUTOFF days ago
 * to an "Archive" sheet (created if it doesn't exist).
 *
 * Uses batch read and batch write to minimize API calls. Deletes source rows
 * in reverse order to avoid index shifting.
 *
 * @returns {{success: boolean, archived: number, error?: string}}
 */
function archiveSoldDeals() {
  try {
    const ss          = _getSpreadsheet();
    const sheet       = _getPipelineSheet(ss);
    const last        = sheet.getLastRow();

    if (last < 2) return { success: true, archived: 0 };

    const cutoffDate  = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_DAYS_CUTOFF);

    const allValues   = sheet.getRange(2, 1, last - 1, PIPELINE_HEADERS.length).getValues();

    // Identify rows to archive (collect row numbers in descending order)
    const rowsToArchive = [];  // [{sheetRow, values}]

    allValues.forEach((row, idx) => {
      const stage    = String(row[PC.STAGE - 1] || '').trim();
      const soldDate = row[PC.SOLD_DATE - 1];
      if (stage !== 'Sold') return;
      if (!soldDate)        return;
      const sd = soldDate instanceof Date ? soldDate : new Date(soldDate);
      if (isNaN(sd.getTime()) || sd > cutoffDate) return;
      rowsToArchive.push({ sheetRow: idx + 2, values: row });
    });

    if (!rowsToArchive.length) {
      return { success: true, archived: 0 };
    }

    // Ensure Archive sheet exists with same headers
    let archiveSheet = ss.getSheetByName(ARCHIVE_SHEET_NAME);
    if (!archiveSheet) {
      archiveSheet = ss.insertSheet(ARCHIVE_SHEET_NAME);
      archiveSheet.getRange(1, 1, 1, PIPELINE_HEADERS.length)
        .setValues([PIPELINE_HEADERS])
        .setBackground('#4a148c')
        .setFontColor('#ffffff')
        .setFontWeight('bold');
      archiveSheet.setFrozenRows(1);
    }

    // Batch write to Archive (append all rows at once)
    const archiveData = rowsToArchive.map(r => r.values);
    const archiveStart = Math.max(archiveSheet.getLastRow() + 1, 2);
    archiveSheet.getRange(archiveStart, 1, archiveData.length, PIPELINE_HEADERS.length)
      .setValues(archiveData);

    // Delete from Pipeline in descending row order (prevents index drift)
    rowsToArchive
      .map(r => r.sheetRow)
      .sort((a, b) => b - a)
      .forEach(rowNum => sheet.deleteRow(rowNum));

    _pipelineLog('ARCHIVE', '',
      rowsToArchive.length + ' deals archived (Sold > ' + ARCHIVE_DAYS_CUTOFF + ' days ago)');

    return { success: true, archived: rowsToArchive.length };
  } catch (err) {
    _pipelineLog('ERROR', '', 'archiveSoldDeals: ' + err.message);
    return { success: false, archived: 0, error: err.message };
  }
}

// ── Private Helpers ───────────────────────────────────────────────────────────

/**
 * Returns the Pipeline sheet, creating and formatting it if absent.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function _getPipelineSheet(ss) {
  let sheet = ss.getSheetByName(PIPELINE_SHEET_NAME);
  if (!sheet) {
    setupPipelineSheet();
    sheet = ss.getSheetByName(PIPELINE_SHEET_NAME);
  }
  return sheet;
}

/**
 * Searches column 1 (VIN) for an exact match and returns the 1-based row
 * number, or -1 if not found.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} vin
 * @returns {number}
 */
function _findVinRow(sheet, vin) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const vins = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const normalized = vin.trim().toUpperCase();
  for (let i = 0; i < vins.length; i++) {
    if (String(vins[i][0]).trim().toUpperCase() === normalized) {
      return i + 2;  // +1 for header, +1 for 1-based index
    }
  }
  return -1;
}

/**
 * Converts a raw sheet row array into a named-field object.
 * Computes `daysInStage` live from the Stage Changed At timestamp.
 *
 * @param {Array}  row   - Values array from getValues()[0]
 * @param {Date}   [today] - Reference date for age calculations (defaults to now)
 * @returns {Object}
 */
function _rowToObject(row, today) {
  const ref = today || new Date();

  // Days In Stage: compute from hidden Stage Changed At column if available
  let daysInStage = parseInt(row[PC.DAYS_IN_STAGE - 1]) || 0;
  const stageChangedAt = row[PC.STAGE_CHANGED - 1];
  if (stageChangedAt instanceof Date && !isNaN(stageChangedAt.getTime())) {
    daysInStage = Math.floor((ref - stageChangedAt) / 86400000);
  }

  return {
    vin            : String(row[PC.VIN           - 1] || '').trim(),
    make           : String(row[PC.MAKE          - 1] || ''),
    model          : String(row[PC.MODEL         - 1] || ''),
    year           : row[PC.YEAR          - 1] || '',
    color          : String(row[PC.COLOR         - 1] || ''),
    mileage        : row[PC.MILEAGE       - 1] || '',
    buyPrice       : row[PC.BUY_PRICE     - 1] || '',
    transportCost  : row[PC.TRANSPORT_COST - 1] || '',
    reconCost      : row[PC.RECON_COST    - 1] || '',
    fees           : row[PC.FEES          - 1] || '',
    totalCost      : row[PC.TOTAL_COST    - 1] || '',
    askPrice       : row[PC.ASK_PRICE     - 1] || '',
    soldPrice      : row[PC.SOLD_PRICE    - 1] || '',
    grossProfit    : row[PC.GROSS_PROFIT  - 1] || '',
    netProfit      : row[PC.NET_PROFIT    - 1] || '',
    marginPct      : row[PC.MARGIN_PCT    - 1] || '',
    stage          : String(row[PC.STAGE         - 1] || ''),
    buyerName      : String(row[PC.BUYER_NAME    - 1] || ''),
    buyerEmail     : String(row[PC.BUYER_EMAIL   - 1] || ''),
    daysInStage,
    totalDays      : row[PC.TOTAL_DAYS     - 1] || 0,
    purchaseDate   : row[PC.PURCHASE_DATE  - 1] || '',
    transportEta   : row[PC.TRANSPORT_ETA  - 1] || '',
    reconComplete  : row[PC.RECON_COMPLETE - 1] || '',
    listDate       : row[PC.LIST_DATE      - 1] || '',
    soldDate       : row[PC.SOLD_DATE      - 1] || '',
    notes          : String(row[PC.NOTES         - 1] || ''),
    watchlistUrl   : String(row[PC.WATCHLIST_URL - 1] || ''),
    driveFolderId  : String(row[PC.DRIVE_FOLDER  - 1] || ''),
    chatNotified   : String(row[PC.CHAT_NOTIFIED - 1] || ''),
    lastUpdated    : row[PC.LAST_UPDATED   - 1] || '',
  };
}

/**
 * Returns the Excel-style column letter(s) for a 1-based column number.
 * Handles columns A–ZZ (1–702).
 *
 * @param {number} n - 1-based column number
 * @returns {string}
 */
function _colLetter(n) {
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

/**
 * Writes a structured entry to the System Log sheet.
 * Schema: [Timestamp, Module, Action, VIN, Details]
 *
 * @param {string} action  - Short action identifier (e.g. 'ADD', 'STAGE_CHANGE')
 * @param {string} vin     - VIN involved, or '' for global actions
 * @param {string} details - Human-readable detail string
 */
function _pipelineLog(action, vin, details) {
  Logger.log('[Pipeline/' + action + '] ' + (vin ? vin + ' | ' : '') + details);
  try {
    const ss = _getSpreadsheet();
    let logSheet = ss.getSheetByName(CFG.SHEET_SYSLOG);
    if (!logSheet) {
      logSheet = ss.insertSheet(CFG.SHEET_SYSLOG);
      logSheet.appendRow(['Timestamp', 'Level', 'Message']);
      logSheet.getRange(1, 1, 1, 3)
        .setBackground('#607d8b').setFontColor('#fff').setFontWeight('bold');
      logSheet.setFrozenRows(1);
    }
    const message = '[Pipeline] ' + action + (vin ? ' | ' + vin : '') + ' | ' +
                    String(details).slice(0, 400);
    logSheet.appendRow([new Date(), 'Pipeline', message]);

    // Keep log trim to last 2000 rows
    const rows = logSheet.getLastRow();
    if (rows > 2001) logSheet.deleteRows(2, rows - 2001);
  } catch (e) { /* logging must never throw */ }
}

/**
 * Formats a Date object as YYYY-MM-DD.
 * Delegates to the shared _formatDate in Code.gs when available.
 *
 * @param {Date} d
 * @returns {string}
 */
function _pipelineFormatDate(d) {
  if (typeof _formatDate === 'function') return _formatDate(d);
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
