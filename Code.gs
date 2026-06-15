// ============================================================
// LUX AUTO — Manheim Buyer System  |  Enterprise Edition
// Google Apps Script  |  Standalone Web App
//
// Setup:
//   1. Run setupSheets() once to create all tabs + headers
//   2. Project Settings → Script Properties → add:
//        MANHEIM_CLIENT_ID   (your Mashery package key)
//        MANHEIM_CLIENT_SECRET (your Mashery secret)
//   3. Fill Buyers sheet with your buyer list
//   4. Run installTrigger() — auto-scans every 2 hours
//   5. Run installDailyDigestTrigger() — 7 AM advance-notice email
//   6. Interact with deals in the dashboard to build your
//      Preference Profile (copy VINs, do MMR lookups, mark bought)
// ============================================================

// ── Configuration ─────────────────────────────────────────────────────────────
const CFG = {
  // Manheim API  (ref: developer.manheim.com — OAuth2 client_credentials)
  AUTH_URL     : 'https://api.manheim.com/oauth2/token.oauth2',
  AUTH_URL_ALT : 'https://api.manheim.com/id/credentials/accesstoken',
  LISTINGS_URL : 'https://api.manheim.com/marketplace/v1/listings',
  MMR_URL      : 'https://api.manheim.com/valuation/v2/mmrtransaction/',

  // Deal scoring
  DEAL_THRESHOLD_PCT : 0.15,   // flag if listing ≥ 15% below MMR
  MIN_SCORE_TO_EMAIL : 60,

  // Primary scan filters — exotic-first make list (overridden per-scan when profile exists)
  SCAN_MAKES       : ['Ferrari','Lamborghini','Porsche','McLaren','Bentley',
                      'Rolls-Royce','Maserati','Aston Martin','Lexus','BMW',
                      'Mercedes-Benz','Acura'],
  SCAN_YEAR_MIN    : 2010,
  SCAN_MILEAGE_MAX : 60000,
  SCAN_LIMIT       : 150,

  // Daily digest — upcoming auction look-ahead window (days)
  ADVANCE_DAYS_MIN : 7,
  ADVANCE_DAYS_MAX : 21,

  // Email: 'draft' = Gmail drafts  |  'send' = live send
  EMAIL_MODE : 'draft',

  // Sheet names
  SHEET_BUYERS    : 'Buyers',
  SHEET_DEALS     : 'Deals',
  SHEET_LOG       : 'Outreach Log',
  SHEET_HISTORY   : 'Watch History',
  SHEET_UPCOMING  : 'Upcoming Watch',
  SHEET_PROFILE   : 'Preference Profile',
  SHEET_SYSLOG    : 'System Log',
  SHEET_PIPELINE  : 'Pipeline',
  SHEET_WAITLIST  : 'Customer Waitlist',
  SHEET_MARKET    : 'Market Intelligence',
  SHEET_PNL       : 'P&L Summary',
  SHEET_AUDIT     : 'Audit Log',

  // Trigger intervals
  TRIGGER_HOURS       : 2,
  DIGEST_TRIGGER_HOUR : 7,   // 7 AM daily
};

// ── Standalone Spreadsheet Helper ─────────────────────────────────────────────
function _getSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  const ssId  = props.getProperty('SPREADSHEET_ID');
  if (ssId) {
    try { return SpreadsheetApp.openById(ssId); } catch (e) { /* fall through */ }
  }
  const ss = SpreadsheetApp.create('Lux Auto — Manheim Buyer System');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  _log('INFO', 'Created new spreadsheet: ' + ss.getUrl());
  return ss;
}

// ── Web App Entry Point ────────────────────────────────────────────────────────
function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) || 'portal';
  if (page === 'dashboard') {
    return HtmlService.createHtmlOutputFromFile('PortalDashboard')
      .setTitle('Lux Auto — Dealer Command Center')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (page === 'mobile') {
    return HtmlService.createHtmlOutputFromFile('MobileScanner')
      .setTitle('Lux Auto — Mobile Scanner')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Lux Auto — Portal')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── Dashboard API Functions ────────────────────────────────────────────────────

/**
 * Fetches and scores Manheim listings for the live dashboard.
 * Called by PortalDashboard.html via google.script.run.
 */
function fetchAndScoreDealsForDashboard(params) {
  try {
    const token = _getManheimToken();
    if (!token) return { error: 'NO_CREDENTIALS', deals: [] };

    const p = params || {};
    const qp = [];
    if (p.make)       qp.push('make='       + encodeURIComponent(p.make));
    if (p.model)      qp.push('model='      + encodeURIComponent(p.model));
    if (p.yearMin)    qp.push('yearFrom='   + p.yearMin);
    if (p.yearMax)    qp.push('yearTo='     + p.yearMax);
    if (p.priceMin)   qp.push('priceFrom='  + p.priceMin);
    if (p.priceMax)   qp.push('priceTo='    + p.priceMax);
    if (p.mileageMax) qp.push('odometerto=' + p.mileageMax);
    qp.push('count=' + (p.limit || CFG.SCAN_LIMIT));

    const resp = UrlFetchApp.fetch(
      CFG.LISTINGS_URL + (qp.length ? '?' + qp.join('&') : ''),
      { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true }
    );
    const data = JSON.parse(resp.getContentText());
    const items = (data.results || data.listings || data.items || []);
    const deals = items.map(function(item) {
      return _scoreListing(item);
    }).filter(function(d) {
      return d.score >= (p.minScore || 0);
    });

    return {
      deals:        deals,
      scanned:      items.length,
      hotDeals:     deals.filter(function(d){ return d.score >= 70; }).length,
      apiConnected: true
    };
  } catch(err) {
    _log('ERROR', 'fetchAndScoreDealsForDashboard: ' + err.message);
    return { error: err.message, deals: [] };
  }
}

/**
 * MMR valuation lookup for the dashboard MMR tab.
 */
function lookupMMRForDashboard(params) {
  try {
    const token = _getManheimToken();
    if (!token) return { error: 'NO_CREDENTIALS' };
    const p   = params || {};
    const url = CFG.MMR_URL + (p.vin ? p.vin : '') +
      '?make=' + encodeURIComponent(p.make || '') +
      '&model=' + encodeURIComponent(p.model || '') +
      '&year=' + (p.year || '') +
      '&odometer=' + (p.mileage || '');
    const resp = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    const data = JSON.parse(resp.getContentText());
    const avg  = data.average || data.averageAdjusted || data.mmr || 0;
    return {
      avg:   Math.round(avg),
      below: Math.round(avg * 0.87),
      above: Math.round(avg * 1.13),
      count: data.sampleSize || data.count || '—'
    };
  } catch(err) {
    return { error: err.message };
  }
}

/**
 * Adds a vehicle to the Upcoming Watch sheet with bid limit.
 */
function addToWatchlist(deal) {
  try {
    const ss    = _getSpreadsheet();
    let sheet   = ss.getSheetByName(CFG.SHEET_UPCOMING);
    if (!sheet) sheet = ss.insertSheet(CFG.SHEET_UPCOMING);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['VIN','Year','Make','Model','Price','MMR','Score','Bid Limit','Auction','Location','Added']);
    }
    sheet.appendRow([
      deal.vin, deal.year, deal.make, deal.model,
      deal.price, deal.mmr, deal.score, deal.bidLimit || '',
      deal.auctionDate || '', deal.location || '',
      new Date().toISOString()
    ]);
    return { success: true };
  } catch(err) {
    return { error: err.message };
  }
}

/**
 * Saves dashboard configuration to Script Properties.
 */
function saveDashboardConfig(cfg) {
  try {
    const props = PropertiesService.getScriptProperties();
    if (cfg.threshold) props.setProperty('DEAL_THRESHOLD_PCT', cfg.threshold);
    if (cfg.minScore)  props.setProperty('MIN_SCORE_TO_EMAIL', cfg.minScore);
    if (cfg.limit)     props.setProperty('SCAN_LIMIT', cfg.limit);
    if (cfg.emailMode) props.setProperty('EMAIL_MODE', cfg.emailMode);
    return { success: true };
  } catch(err) {
    return { error: err.message };
  }
}

/**
 * Returns portal form links from the "Portal Form Links" sheet.
 * Called by Index.html via google.script.run.
 */
function getPortalLinks() {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Portal Form Links');
    if (!sheet) return null;
    const data = sheet.getDataRange().getValues().slice(1); // skip header row
    const result = {};
    data.forEach(([name, url]) => { if (name && url) result[String(name)] = String(url); });
    return result;
  } catch(err) {
    return null;
  }
}

// ── Web App API Functions ──────────────────────────────────────────────────────

function getDashboardData() {
  try {
    const ss     = _getSpreadsheet();
    const deals  = _getAllDeals(ss);
    const buyers = _getActiveBuyers(ss);

    const elite   = deals.filter(d => d.tier === 'elite').length;
    const premium = deals.filter(d => d.tier === 'premium').length;
    const avgScore = deals.length
      ? (deals.reduce((s, d) => s + d.score, 0) / deals.length).toFixed(1) : 0;
    const potMargin = deals.reduce((s, d) => s + (d.netMargin || 0), 0);

    const upSheet = ss.getSheetByName(CFG.SHEET_UPCOMING);
    const upcomingCount = upSheet ? Math.max(0, upSheet.getLastRow() - 1) : 0;

    return {
      ok      : true,
      ssUrl   : ss.getUrl(),
      stats   : { totalDeals: deals.length, eliteDeals: elite, premiumDeals: premium,
                  avgScore, potMargin, activeBuyers: buyers.length },
      deals,
      upcomingCount,
      profile : _getCachedProfile(),
    };
  } catch (err) {
    _log('ERROR', 'getDashboardData: ' + err.message);
    return { ok: false, error: err.message, deals: [], stats: {}, upcomingCount: 0 };
  }
}

function triggerScan() {
  try {
    fetchAndScoreDeals();
    matchDealsTooBuyers();
  } catch (err) {
    _log('ERROR', 'triggerScan: ' + err.message);
  }
  return getDashboardData();
}

function getMMRForVin(vin, mileage) {
  if (!vin) return { success: false, error: 'No VIN provided' };
  try {
    const mmr = _fetchMMR(vin.trim(), mileage || 0);
    return mmr ? { success: true, mmr } : { success: false, error: 'No MMR data available' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getUpcomingDeals() {
  try {
    const ss    = _getSpreadsheet();
    const sheet = ss.getSheetByName(CFG.SHEET_UPCOMING);
    if (!sheet || sheet.getLastRow() < 2) return { ok: true, deals: [] };
    const data  = sheet.getDataRange().getValues();
    const heads = data[0];
    const deals = data.slice(1).map(row => {
      const obj = {};
      heads.forEach((h, i) => { obj[String(h)] = row[i]; });
      return obj;
    }).filter(d => d['VIN']);
    return { ok: true, deals };
  } catch (err) {
    return { ok: false, error: err.message, deals: [] };
  }
}

function getProfileData() {
  return { ok: true, profile: _getCachedProfile() };
}

// Called from dashboard whenever a user copies a VIN, does MMR lookup, or marks bought
function logVehicleAction(vin, make, model, year, mileage, price, action) {
  if (!vin) return { ok: false };
  try {
    const ss    = _getSpreadsheet();
    const sheet = ss.getSheetByName(CFG.SHEET_HISTORY)
      || _ensureSheet(ss, CFG.SHEET_HISTORY,
           ['Timestamp','VIN','Make','Model','Year','Mileage','Price ($)','Action','Notes'],
           '#7c4dff');
    sheet.appendRow([new Date(), vin, make||'', model||'', year||'',
                     mileage||'', price||'', action, '']);
    _rebuildPreferenceProfile(ss);
    return { ok: true };
  } catch (err) {
    _log('ERROR', 'logVehicleAction: ' + err.message);
    return { ok: false, error: err.message };
  }
}

// ── Preference Profile Engine ─────────────────────────────────────────────────

function _getCachedProfile() {
  const raw = PropertiesService.getScriptProperties().getProperty('LUX_PROFILE');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function _rebuildPreferenceProfile(ss) {
  const histSheet = ss.getSheetByName(CFG.SHEET_HISTORY);
  if (!histSheet || histSheet.getLastRow() < 2) return null;

  const rows = histSheet.getDataRange().getValues().slice(1).filter(r => r[1]);
  if (!rows.length) return null;

  // Action weights: bought = 5, copied = 3, mmr_lookup = 2, viewed = 1
  const W = { bought: 5, copied: 3, mmr_lookup: 2, viewed: 1 };

  const makePts = {}, modelPts = {};
  const years = [], prices = [], miles = [];

  rows.forEach(row => {
    const [ts, vin, make, model, year, mileage, price, action] = row;
    const w   = W[action] || 1;
    const age = (Date.now() - new Date(ts).getTime()) / 86400000; // days
    const rec = Math.max(0.1, 1 - age / 180);                     // 6-month decay
    const pts = w * rec;
    if (make)    makePts[make]   = (makePts[make]   || 0) + pts;
    if (model)   modelPts[model] = (modelPts[model] || 0) + pts;
    if (year)    years.push(parseInt(year));
    if (price)   prices.push(parseFloat(price));
    if (mileage) miles.push(parseInt(mileage));
  });

  const byScore  = obj => Object.entries(obj).sort((a,b) => b[1]-a[1]).map(e => e[0]);
  const avg      = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : null;
  const pctile   = (arr, p) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a,b)=>a-b);
    return s[Math.min(s.length-1, Math.floor(s.length*p))];
  };

  const profile = {
    topMakes   : byScore(makePts).slice(0, 8),
    topModels  : byScore(modelPts).slice(0, 10),
    avgYear    : avg(years),
    avgPrice   : avg(prices),
    p90Price   : pctile(prices, 0.9),
    avgMileage : avg(miles),
    p90Mileage : pctile(miles, 0.9),
    sampleSize : rows.length,
    updatedAt  : new Date().toISOString(),
  };

  // Cache as JSON
  PropertiesService.getScriptProperties().setProperty('LUX_PROFILE', JSON.stringify(profile));

  // Write human-readable summary
  const profSheet = ss.getSheetByName(CFG.SHEET_PROFILE)
    || _ensureSheet(ss, CFG.SHEET_PROFILE, ['Attribute','Value','Details'], '#0097a7');
  profSheet.clearContents();
  const tableRows = [
    ['Attribute','Value','Details'],
    ['Top Makes',   profile.topMakes.slice(0,5).join(', '),   profile.topMakes.length + ' makes tracked'],
    ['Top Models',  profile.topModels.slice(0,5).join(', '),  profile.topModels.length + ' models tracked'],
    ['Avg Year',    profile.avgYear || 'N/A', ''],
    ['Avg Price',   profile.avgPrice  ? '$' + profile.avgPrice.toLocaleString()  : 'N/A', 'P90: $' + (profile.p90Price||0).toLocaleString()],
    ['Avg Mileage', profile.avgMileage ? profile.avgMileage.toLocaleString() : 'N/A', 'P90: ' + (profile.p90Mileage||0).toLocaleString()],
    ['Sample Size', profile.sampleSize, 'vehicle interactions logged'],
    ['Last Updated', profile.updatedAt, ''],
  ];
  profSheet.getRange(1, 1, tableRows.length, 3).setValues(tableRows);
  profSheet.getRange(1, 1, 1, 3)
    .setBackground('#0097a7').setFontColor('#fff').setFontWeight('bold');
  profSheet.setFrozenRows(1);

  _log('INFO', 'Profile rebuilt: ' + profile.topMakes.join(',') + ' | ' + profile.sampleSize + ' samples');
  return profile;
}

// ── Daily Suggestions Engine (Advance Notice) ─────────────────────────────────

function runDailySuggestions() {
  _log('INFO', '=== Daily Suggestions Start ===');
  const ss      = _getSpreadsheet();
  const profile = _getCachedProfile() || _rebuildPreferenceProfile(ss);

  // Use profile makes if available, else fall back to config defaults
  const makesToScan = (profile && profile.topMakes.length)
    ? profile.topMakes.slice(0, 6)
    : CFG.SCAN_MAKES.slice(0, 6);

  const today   = new Date();
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + CFG.ADVANCE_DAYS_MIN);
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + CFG.ADVANCE_DAYS_MAX);

  const yearMin  = (profile && profile.avgYear)    ? profile.avgYear - 3        : CFG.SCAN_YEAR_MIN;
  const mileMax  = (profile && profile.p90Mileage) ? Math.round(profile.p90Mileage * 1.15) : CFG.SCAN_MILEAGE_MAX;

  _log('INFO', 'Scanning: ' + makesToScan.join(',') +
       ' | sale ' + _formatDate(minDate) + ' → ' + _formatDate(maxDate));

  const data = _mhGet(CFG.LISTINGS_URL, {
    make        : makesToScan.join(','),
    yearMin,
    mileageMax  : mileMax,
    saleDateMin : _formatDate(minDate),
    saleDateMax : _formatDate(maxDate),
    limit       : 100,
  });

  if (!data || !data.items || !data.items.length) {
    _log('INFO', 'No upcoming listings returned for this window');
    return;
  }

  _log('INFO', 'Fetched ' + data.items.length + ' upcoming listings — scoring…');

  const upcoming = [];
  data.items.forEach((item, i) => {
    const vin     = (item.vin || '').trim();
    const price   = parseFloat(item.price || 0);
    const mileage = parseInt(item.odometer || 0, 10);
    if (!vin || !price) return;
    if (i > 0 && i % 8 === 0) Utilities.sleep(600);

    const mmr    = _fetchMMR(vin, mileage);
    const scored = _scoreDeal(price, mmr, mileage);
    if (!scored || scored.score < 50) return; // slightly lower bar for advance notice

    const saleTs  = item.saleDate ? new Date(item.saleDate) : null;
    const daysOut = saleTs ? Math.round((saleTs - today) / 86400000) : null;

    // Profile match scoring (how closely this matches our purchase history)
    const makeRank  = profile ? profile.topMakes.indexOf(item.make)   : -1;
    const modelRank = profile ? profile.topModels.indexOf(item.model)  : -1;
    const profScore = Math.max(0, 8 - (makeRank  >= 0 ? makeRank  : 8))
                    + Math.max(0, 6 - (modelRank >= 0 ? modelRank : 6));

    upcoming.push({
      vin, year: item.year, make: item.make, model: item.model,
      trim: item.trim || '', mileage, price, mmr,
      ...scored,
      location  : item.locationName || '',
      saleDate  : item.saleDate || '',
      runNumber : item.runNumber || '',
      daysOut,
      profScore,
      totalScore: scored.score + profScore * 2,
    });
  });

  upcoming.sort((a, b) => b.totalScore - a.totalScore);

  if (!upcoming.length) {
    _log('INFO', 'No upcoming deals passed score threshold');
    return;
  }

  _writeUpcomingDeals(ss, upcoming);
  _sendDailyDigest(ss, upcoming, profile);
  _log('INFO', 'Daily suggestions complete — ' + upcoming.length + ' deals logged');
}

function _writeUpcomingDeals(ss, deals) {
  const headers = [
    'Sale Date','Days Out','VIN','Year','Make','Model','Trim','Mileage',
    'List Price ($)','MMR ($)','Discount %','Deal Score','Est. Net Margin ($)',
    'Location','Run #','Profile Match','Added At'
  ];
  let sheet = ss.getSheetByName(CFG.SHEET_UPCOMING);
  if (!sheet) sheet = _ensureSheet(ss, CFG.SHEET_UPCOMING, headers, '#e91e63');

  const existingVins = _getColumnValues(sheet, 3); // col C = VIN
  const now = new Date().toLocaleString();

  deals.forEach(d => {
    if (existingVins.includes(d.vin)) return;
    sheet.appendRow([
      d.saleDate, d.daysOut, d.vin, d.year, d.make, d.model, d.trim,
      d.mileage, d.price, d.mmr || '',
      d.discountPct ? ((d.discountPct * 100).toFixed(1) + '%') : '',
      d.score, d.netMargin || '', d.location, d.runNumber, d.profScore, now
    ]);
    existingVins.push(d.vin);
  });
}

function _sendDailyDigest(ss, deals, profile) {
  try {
    const from    = Session.getActiveUser().getEmail();
    const ssUrl   = ss.getUrl();
    const today   = _formatDate(new Date());
    const top     = deals.slice(0, 12);

    const subject = '🚗 Lux Auto Daily Watch — ' + deals.length + ' upcoming matches (' + today + ')';

    const lines = top.map((d, i) => {
      const disc   = d.discountPct ? (d.discountPct * 100).toFixed(0) + '% below MMR' : 'no MMR';
      const margin = d.netMargin   ? '~$' + d.netMargin.toLocaleString() + ' net' : '';
      const when   = d.daysOut == null ? ''
                   : d.daysOut === 0   ? 'TODAY'
                   : d.daysOut === 1   ? 'TOMORROW'
                   : d.daysOut + ' days out';
      return (i + 1) + '. ' + d.year + ' ' + d.make + ' ' + d.model + (d.trim ? ' ' + d.trim : '')
           + '  [Score: ' + d.score + ' | Profile match: ' + d.profScore + '/14]\n'
           + '   ' + (d.mileage || 0).toLocaleString() + ' mi  |  $' + (d.price || 0).toLocaleString()
           + ' list  |  ' + disc + '  |  ' + margin + '\n'
           + '   📍 ' + d.location + '  |  Sale: ' + d.saleDate + ' (' + when + ')  |  Run #' + d.runNumber + '\n'
           + '   VIN: ' + d.vin;
    }).join('\n\n');

    const profileNote = profile
      ? 'Your profile: ' + profile.topMakes.slice(0, 4).join(', ')
        + ' | avg $' + (profile.avgPrice || 0).toLocaleString()
        + ' | avg ' + (profile.avgMileage || 0).toLocaleString() + ' mi'
        + ' (' + profile.sampleSize + ' interactions logged)'
      : 'No preference profile yet — copy VINs and do MMR lookups in the dashboard to build one.';

    const body = 'Good morning — your daily Lux Auto vehicle advance-notice report.\n\n'
      + profileNote + '\n'
      + 'Scan window: ' + CFG.ADVANCE_DAYS_MIN + '–' + CFG.ADVANCE_DAYS_MAX
      + ' days out  |  ' + deals.length + ' vehicles matched\n\n'
      + '─'.repeat(56) + '\nTOP UPCOMING DEALS\n' + '─'.repeat(56) + '\n\n'
      + lines + '\n\n'
      + '─'.repeat(56) + '\n'
      + 'Dashboard & full sheet: ' + ssUrl + '\n\n'
      + 'These vehicles are ' + CFG.ADVANCE_DAYS_MIN + '–' + CFG.ADVANCE_DAYS_MAX
      + ' days from auction — time to plan transport, set bid limits, and brief buyers before sale day.\n\n'
      + '— Lux Auto Buyer System';

    if (CFG.EMAIL_MODE === 'send') {
      GmailApp.sendEmail(from, subject, body, { name: 'Lux Auto Buyer System' });
    } else {
      GmailApp.createDraft(from, subject, body, { name: 'Lux Auto Buyer System' });
    }
    _log('INFO', 'Daily digest ' + (CFG.EMAIL_MODE === 'send' ? 'sent' : 'drafted') + ' to ' + from);
  } catch (err) {
    _log('ERROR', 'Daily digest failed: ' + err.message);
  }
}

// ── Menu (container-bound context only) ───────────────────────────────────────
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('🚗 Lux Auto')
      .addItem('▶ Run Full Pipeline',       'runFullPipeline')
      .addSeparator()
      .addItem('📡 Scan Manheim Now',  'fetchAndScoreDeals')
      .addItem('🎯 Match Deals → Buyers', 'matchDealsTooBuyers')
      .addItem('📧 Send Outreach Emails','sendOutreachEmails')
      .addSeparator()
      .addItem('🔮 Run Daily Suggestions','runDailySuggestions')
      .addSeparator()
      .addSeparator()
      .addItem('💬 Send Co-Wholesale Blast', 'runCoWholesaleBlast')
      .addSeparator()
      .addItem('⚙️ Setup All Sheets (Phase 1)', 'setupSheets')
      .addItem('📊 Build Looker Studio Export', 'buildLookerStudioExport')
      .addItem('📅 Setup Auction Calendar',  'setupAuctionCalendar')
      .addItem('📁 Setup Vehicle Vault',     'setupVaultRoot')
      .addItem('⏰ Install Scan Trigger',     'installTrigger')
      .addItem('🌅 Install Daily Digest Trigger','installDailyDigestTrigger')
      .addItem('🗑 Remove All Triggers','removeAllTriggers')
      .addToUi();
  } catch (e) { /* standalone context — no UI */ }
}

// ── Sheet Setup ───────────────────────────────────────────────────────────────
function setupSheets() {
  const ss = _getSpreadsheet();

  _ensureSheet(ss, CFG.SHEET_BUYERS, [
    'Name','Email','Phone','Makes (comma-sep)','Models (comma-sep)',
    'Max Price ($)','Max Mileage','State','Active (Y/N)',
    'Last Contacted','Deals Sent','Notes'
  ], '#1a73e8');

  _ensureSheet(ss, CFG.SHEET_DEALS, [
    'VIN','Year','Make','Model','Trim','Mileage',
    'List Price ($)','MMR ($)','Discount %','Deal Score',
    'Est. Net Margin ($)','Auction Location','Sale Date',
    'Run #','Status','Matched Buyers','Scanned At'
  ], '#34a853');

  _ensureSheet(ss, CFG.SHEET_LOG, [
    'Timestamp','Buyer Name','Buyer Email','VIN','Vehicle',
    'Deal Score','Discount %','Est. Margin ($)','Email Subject','Status'
  ], '#fbbc04');

  _ensureSheet(ss, CFG.SHEET_HISTORY, [
    'Timestamp','VIN','Make','Model','Year','Mileage',
    'Price ($)','Action','Notes'
  ], '#7c4dff');

  _ensureSheet(ss, CFG.SHEET_UPCOMING, [
    'Sale Date','Days Out','VIN','Year','Make','Model','Trim','Mileage',
    'List Price ($)','MMR ($)','Discount %','Deal Score','Est. Net Margin ($)',
    'Location','Run #','Profile Match','Added At'
  ], '#e91e63');

  _ensureSheet(ss, CFG.SHEET_PROFILE, ['Attribute','Value','Details'], '#0097a7');
  _ensureSheet(ss, CFG.SHEET_SYSLOG,  ['Timestamp','Level','Message'],  '#607d8b');

  // Phase 1: set up new sheets
  try { setupPipelineSheet();     } catch (e) { _log('WARN', 'setupPipelineSheet: ' + e.message); }
  try { setupWaitlistSheet();     } catch (e) { _log('WARN', 'setupWaitlistSheet: ' + e.message); }
  try { setupAnalyticsSheets();   } catch (e) { _log('WARN', 'setupAnalyticsSheets: ' + e.message); }

  try {
    SpreadsheetApp.getUi().alert(
      '✅ All sheets ready! (Phase 1 — Exotic Edition)\n\n'
      + 'Next:\n'
      + '1. Fill the "Buyers" tab with your buyer list\n'
      + '2. Add MANHEIM_CLIENT_ID + MANHEIM_CLIENT_SECRET\n'
      + '   in Project Settings → Script Properties\n'
      + '3. Add optional: CHAT_WEBHOOK_URL for Google Chat alerts\n'
      + '4. Run "Install Scan Trigger" (every 2h scans)\n'
      + '5. Open the web app dashboard and start interacting'
    );
  } catch (e) {
    Logger.log('setupSheets complete — ' + ss.getUrl());
  }
}

function _ensureSheet(ss, name, headers, color) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getRange(1, 1).getValue() === '') {
    const hRange = sheet.getRange(1, 1, 1, headers.length);
    hRange.setValues([headers])
          .setBackground(color)
          .setFontColor('#ffffff')
          .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ── Manheim Auth ──────────────────────────────────────────────────────────────
function _getManheimToken() {
  const props = PropertiesService.getScriptProperties();
  const cached   = props.getProperty('MH_TOKEN');
  const expires  = parseInt(props.getProperty('MH_EXPIRES') || '0', 10);

  if (cached && Date.now() < expires) return cached;

  const clientId     = props.getProperty('MANHEIM_CLIENT_ID');
  const clientSecret = props.getProperty('MANHEIM_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('Missing MANHEIM_CLIENT_ID or MANHEIM_CLIENT_SECRET in Script Properties.');
  }

  // Primary: Basic auth per Manheim OAuth2 spec (developer.manheim.com)
  const credentials = Utilities.base64Encode(clientId + ':' + clientSecret);
  let resp = UrlFetchApp.fetch(CFG.AUTH_URL, {
    method      : 'post',
    headers     : { Authorization: 'Basic ' + credentials },
    contentType : 'application/x-www-form-urlencoded',
    payload     : 'grant_type=client_credentials',
    muteHttpExceptions: true,
  });

  // Fallback: form-body auth (older Manheim endpoint)
  if (resp.getResponseCode() !== 200) {
    _log('WARN', 'Primary auth endpoint returned ' + resp.getResponseCode() + ' — trying alternate');
    resp = UrlFetchApp.fetch(CFG.AUTH_URL_ALT, {
      method      : 'post',
      contentType : 'application/x-www-form-urlencoded',
      payload     : 'grant_type=client_credentials'
                  + '&client_id=' + encodeURIComponent(clientId)
                  + '&client_secret=' + encodeURIComponent(clientSecret),
      muteHttpExceptions: true,
    });
  }

  if (resp.getResponseCode() !== 200) {
    throw new Error('Manheim auth failed (' + resp.getResponseCode() + '): ' + resp.getContentText());
  }

  const data  = JSON.parse(resp.getContentText());
  const token = data.access_token;
  const exp   = Date.now() + (data.expires_in || 3600) * 1000 - 60000;

  props.setProperty('MH_TOKEN',   token);
  props.setProperty('MH_EXPIRES', String(exp));
  return token;
}

// Fetch with exponential backoff + 401 token refresh
function _mhGet(url, params, _retries) {
  const maxRetries = _retries || 3;
  const qs = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
    .join('&');
  const fullUrl = qs ? (url + '?' + qs) : url;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const token = _getManheimToken();
    const resp  = UrlFetchApp.fetch(fullUrl, {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      muteHttpExceptions: true,
    });
    const code = resp.getResponseCode();

    if (code === 200) return JSON.parse(resp.getContentText());
    if (code === 404) return null;

    if (code === 401) {
      // Clear token and retry
      PropertiesService.getScriptProperties().deleteProperty('MH_TOKEN');
      _log('WARN', 'Token expired on attempt ' + attempt + ' — refreshing');
      if (attempt < maxRetries) { Utilities.sleep(500); continue; }
    }
    if (code === 429 || code >= 500) {
      _log('WARN', 'API ' + code + ' on attempt ' + attempt + ' — backing off');
      if (attempt < maxRetries) { Utilities.sleep(Math.pow(2, attempt) * 1000); continue; }
    }

    _log('ERROR', 'Manheim API ' + code + ' → ' + fullUrl.slice(0, 120) +
         ': ' + resp.getContentText().slice(0, 200));
    return null;
  }
  return null;
}

// ── Deal Fetching & Scoring ───────────────────────────────────────────────────
function fetchAndScoreDeals() {
  _getManheimToken(); // validate credentials early

  // Use preference profile makes if profile exists and is recent
  const profile  = _getCachedProfile();
  const makesToUse = (profile && profile.topMakes.length >= 2)
    ? [...new Set([...profile.topMakes.slice(0,6), ...CFG.SCAN_MAKES.slice(0,4)])]
    : CFG.SCAN_MAKES;

  _log('INFO', 'Scanning Manheim: ' + makesToUse.slice(0,8).join(','));

  const data = _mhGet(CFG.LISTINGS_URL, {
    make      : makesToUse.slice(0, 8).join(','),
    yearMin   : CFG.SCAN_YEAR_MIN,
    mileageMax: CFG.SCAN_MILEAGE_MAX,
    limit     : CFG.SCAN_LIMIT,
  });

  if (!data || !data.items) {
    _log('WARN', 'No listings returned from Manheim');
    return [];
  }

  const items     = data.items;
  const ss        = _getSpreadsheet();
  const sheet     = ss.getSheetByName(CFG.SHEET_DEALS) || _ensureSheet(ss, CFG.SHEET_DEALS, [], '#34a853');
  const scannedAt = new Date().toLocaleString();
  const existVins = _getColumnValues(sheet, 1);
  const deals     = [];

  items.forEach((item, i) => {
    const vin     = (item.vin || '').trim();
    const price   = parseFloat(item.price || 0);
    const mileage = parseInt(item.odometer || 0, 10);
    if (!vin || !price) return;
    if (i > 0 && i % 10 === 0) Utilities.sleep(500);

    const mmr    = _fetchMMR(vin, mileage);
    const scored = _scoreDeal(price, mmr, mileage);
    if (!scored || scored.score < 1) return;

    const row = [
      vin, item.year || '', item.make || '', item.model || '', item.trim || '',
      mileage, price, mmr || '',
      scored.discountPct ? ((scored.discountPct * 100).toFixed(1) + '%') : '',
      scored.score, scored.netMargin || '',
      item.locationName || '', item.saleDate || '', item.runNumber || '',
      'new', '', scannedAt
    ];

    deals.push({ vin, year: item.year, make: item.make, model: item.model,
                 trim: item.trim, mileage, price, mmr, ...scored });

    if (existVins.includes(vin)) {
      sheet.getRange(existVins.indexOf(vin) + 2, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
      existVins.push(vin);
    }
  });

  _colorScoreColumn(sheet);
  _log('INFO', 'Scan complete — ' + deals.length + ' deals above threshold');
  try { _getSpreadsheet().toast('Found ' + deals.length + ' deals', '📡 Scan Complete', 5); } catch(e) {}
  return deals;
}

function _fetchMMR(vin, mileage) {
  return _fetchMMRCached(vin, mileage);
}

/** MMR lookup with 6-hour CacheService cache to reduce API calls. */
function _fetchMMRCached(vin, mileage) {
  const cacheKey = 'MMR_' + vin + '_' + Math.round((mileage || 0) / 5000) * 5000;
  try {
    const cache  = CacheService.getScriptCache();
    const cached = cache.get(cacheKey);
    if (cached) return parseFloat(cached);
  } catch (e) { /* cache miss — proceed to API */ }

  const data = _mhGet(CFG.MMR_URL + encodeURIComponent(vin), {
    odometer: mileage, odometerUnit: 'miles',
  });
  const mmr = data ? (parseFloat(((data.items || [{}])[0].average) || 0) || null) : null;

  if (mmr) {
    try {
      CacheService.getScriptCache().put(cacheKey, String(mmr), 21600); // 6h TTL
    } catch (e) { /* non-critical */ }
  }
  return mmr;
}

function _scoreDeal(listingPrice, mmrValue, mileage) {
  return _scoreListingFull(listingPrice, mmrValue, mileage, '', '', 0);
}

/**
 * Unified scoring engine. Detects exotics automatically and applies
 * the appropriate curve. Generic vehicles use MMR-discount model;
 * exotics use reference-price model with mileage, rarity, and seasonal factors.
 * @param {number} price  - listing price
 * @param {number} mmr    - Manheim MMR (may be null for exotics)
 * @param {number} miles  - odometer
 * @param {string} make   - vehicle make
 * @param {string} model  - vehicle model
 * @param {number} year   - model year
 * @return {Object|null}  - {score, tier, discountPct, netMargin, isExotic} or null
 */
function _scoreListingFull(price, mmr, miles, make, model, year) {
  if (!price || price <= 0) return null;
  const isExotic = _isExoticMake(make);

  if (isExotic) {
    return _scoreExoticDeal(price, mmr, miles, make, model, year);
  }

  // ── Generic / mass-market scoring ──────────────────────────────────────────
  if (!mmr) return null;
  const discountPct = (mmr - price) / mmr;
  if (discountPct < CFG.DEAL_THRESHOLD_PCT) return null;

  let score = Math.min(60, discountPct * 200);
  if (miles < 30000)       score += 10;
  else if (miles < 60000)  score += 5;
  score = Math.min(100, score);

  const friction  = price * 0.08;
  const netMargin = Math.round((mmr - price) - friction);
  const tier      = score >= 80 ? 'elite' : score >= 70 ? 'premium' : score >= 60 ? 'good' : 'watch';

  return { score: Math.round(score * 10) / 10, tier, discountPct, netMargin, isExotic: false };
}

/**
 * Exotic scoring model — tuned for luxury/performance vehicles where:
 * - MMR may be unavailable or unreliable (low comp count)
 * - Mileage below 15k is a premium, not neutral
 * - Rarity, originality, and market timing matter more than discount depth
 * @return {Object|null}
 */
function _scoreExoticDeal(price, mmr, miles, make, model, year) {
  let score = 50; // neutral base

  // ── Reference price comparison ──────────────────────────────────────────────
  const refPrice = _getExoticRefPrice(make, year);
  const compBase = (mmr && mmr > price * 0.5) ? mmr : refPrice; // prefer MMR if credible
  if (compBase && compBase > 0) {
    const discountPct = (compBase - price) / compBase;
    // Exotics: reward deeper discounts more aggressively
    score += Math.round(Math.min(35, discountPct * 150));
  }

  // ── Mileage curve (exotic-specific) ────────────────────────────────────────
  if      (miles <  2000)  score += 20;
  else if (miles <  5000)  score += 15;
  else if (miles < 10000)  score += 10;
  else if (miles < 20000)  score +=  5;
  else if (miles < 40000)  score +=  0;
  else if (miles < 60000)  score -= 10;
  else if (miles < 85000)  score -= 20;
  else                     score -= 30;

  // ── Seasonal bonus from Analytics.gs (if data exists) ─────────────────────
  try {
    const monthBonus = getSeasonalBuyingBonus(make, new Date().getMonth());
    score += (monthBonus || 0);
  } catch (e) { /* Analytics.gs may not be set up yet */ }

  // ── Rarity bonus ───────────────────────────────────────────────────────────
  const rarityBonus = _getExoticRarityBonus(make);
  score += rarityBonus;

  score = Math.max(0, Math.min(100, score));
  const tier = score >= 80 ? 'elite' : score >= 65 ? 'premium' : score >= 50 ? 'good' : 'watch';

  const compPrice   = compBase || price;
  const discountPct = compPrice > 0 ? (compPrice - price) / compPrice : 0;
  const friction    = price * 0.06; // lower friction assumption for exotics (no transport)
  const netMargin   = Math.round((compPrice - price) - friction);

  return { score: Math.round(score * 10) / 10, tier, discountPct, netMargin, isExotic: true };
}

/**
 * Full listing object → scored deal object.
 * Called by fetchAndScoreDealsForDashboard.
 */
function _scoreListing(item) {
  const vin     = (item.vin   || '').trim();
  const price   = parseFloat(item.price || item.currentBid || 0);
  const miles   = parseInt(item.odometer || item.mileage || 0, 10);
  const year    = parseInt(item.year  || 0, 10);
  const make    = String(item.make  || '').trim();
  const model   = String(item.model || '').trim();

  const mmr    = _fetchMMRCached(vin, miles);
  const scored = _scoreListingFull(price, mmr, miles, make, model, year);

  return {
    vin, year, make, model,
    trim      : String(item.trim || '').trim(),
    mileage   : miles, price, mmr,
    score     : scored ? scored.score    : 0,
    tier      : scored ? scored.tier     : 'watch',
    discountPct : scored ? scored.discountPct : 0,
    netMargin   : scored ? scored.netMargin   : 0,
    isExotic    : scored ? scored.isExotic    : false,
    location    : String(item.locationName || item.location || '').trim(),
    saleDate    : String(item.saleDate || '').trim(),
    runNumber   : String(item.runNumber || '').trim(),
    auctionDate : String(item.auctionDate || item.saleDate || '').trim(),
    url         : String(item.url || item.vehicleUrl || '').trim(),
    cr          : item.conditionReport || null,
  };
}

// ── Buyer Matching ────────────────────────────────────────────────────────────
function matchDealsTooBuyers() {
  const ss     = _getSpreadsheet();
  const deals  = _getDealsAboveScore(ss, CFG.MIN_SCORE_TO_EMAIL);
  const buyers = _getActiveBuyers(ss);

  if (!deals.length)  { _log('INFO', 'No qualifying deals to match'); return; }
  if (!buyers.length) { _log('INFO', 'No active buyers found');       return; }

  const dealSheet = ss.getSheetByName(CFG.SHEET_DEALS);
  const allVins   = _getColumnValues(dealSheet, 1);

  deals.forEach(deal => {
    const matched = buyers.filter(b => _buyerMatchesDeal(b, deal));
    if (!matched.length) return;
    const rowIdx = allVins.indexOf(deal.vin) + 2;
    if (rowIdx > 1) dealSheet.getRange(rowIdx, 16).setValue(matched.map(b => b.name).join(', '));
    deal.matchedBuyers = matched;
  });

  _log('INFO', 'Matching done — ' + deals.filter(d => d.matchedBuyers && d.matchedBuyers.length).length + ' deals matched');
  try { _getSpreadsheet().toast('Matching complete', '🎯 Matched', 5); } catch(e) {}
  return deals;
}

function _buyerMatchesDeal(buyer, deal) {
  if (buyer.makes && buyer.makes.length) {
    const mk = (deal.make || '').toLowerCase();
    if (!buyer.makes.some(m => mk.includes(m.toLowerCase()))) return false;
  }
  if (buyer.models && buyer.models.length) {
    const mo = (deal.model || '').toLowerCase();
    if (!buyer.models.some(m => mo.includes(m.toLowerCase()))) return false;
  }
  if (buyer.maxPrice   && deal.price   > buyer.maxPrice)   return false;
  if (buyer.maxMileage && deal.mileage > buyer.maxMileage) return false;
  return true;
}

// ── Email Outreach ────────────────────────────────────────────────────────────
function sendOutreachEmails() {
  const ss     = _getSpreadsheet();
  const deals  = _getDealsAboveScore(ss, CFG.MIN_SCORE_TO_EMAIL);
  const buyers = _getActiveBuyers(ss);

  if (!deals.length || !buyers.length) {
    _log('WARN', 'No qualifying deals or buyers — run scanner first');
    return;
  }

  const from     = Session.getActiveUser().getEmail();
  const logSheet = ss.getSheetByName(CFG.SHEET_LOG) || _ensureSheet(ss, CFG.SHEET_LOG, [], '#fbbc04');
  let sent = 0;

  deals.forEach(deal => {
    const matched = (deal.matchedBuyers || []).length
      ? deal.matchedBuyers
      : buyers.filter(b => _buyerMatchesDeal(b, deal));

    matched.forEach(buyer => {
      try {
        const { subject, body } = _buildEmail(buyer, deal, from);
        if (CFG.EMAIL_MODE === 'send') {
          GmailApp.sendEmail(buyer.email, subject, body, { name: 'Alex | Lux Auto Wholesale', replyTo: from });
        } else {
          GmailApp.createDraft(buyer.email, subject, body, { name: 'Alex | Lux Auto Wholesale' });
        }
        logSheet.appendRow([
          new Date(), buyer.name, buyer.email, deal.vin,
          deal.year + ' ' + deal.make + ' ' + deal.model,
          deal.score,
          deal.discountPct ? ((deal.discountPct * 100).toFixed(1) + '%') : '',
          deal.netMargin || '', subject,
          CFG.EMAIL_MODE === 'send' ? 'Sent' : 'Draft created'
        ]);
        _updateBuyerStats(ss, buyer);
        sent++;
        Utilities.sleep(200);
      } catch (err) {
        _log('ERROR', 'Email to ' + buyer.email + ': ' + err.message);
        logSheet.appendRow([new Date(), buyer.name, buyer.email, deal.vin,
          deal.year + ' ' + deal.make + ' ' + deal.model,
          deal.score, '', '', '', 'Error: ' + err.message]);
      }
    });
  });

  _log('INFO', sent + ' emails ' + (CFG.EMAIL_MODE === 'send' ? 'sent' : 'drafted'));
  try { _getSpreadsheet().toast(sent + ' emails ' + (CFG.EMAIL_MODE === 'send' ? 'sent' : 'drafted'), '📧 Outreach', 5); } catch(e) {}
}

function _buildEmail(buyer, deal, from) {
  const vehicle  = deal.year + ' ' + deal.make + ' ' + deal.model + (deal.trim ? ' ' + deal.trim : '');
  const discount = deal.discountPct ? ((deal.discountPct * 100).toFixed(0) + '%') : '';
  const margin   = deal.netMargin   ? '$' + deal.netMargin.toLocaleString() : '';
  const price    = '$' + deal.price.toLocaleString();
  const mmr      = deal.mmr ? '$' + deal.mmr.toLocaleString() : 'N/A';
  const miles    = deal.mileage ? deal.mileage.toLocaleString() : '';

  const subject = vehicle + ' — ' + discount + ' below MMR — ' + price + ' wholesale';
  const body    = 'Hi ' + buyer.name.split(' ')[0] + ',\n\n'
    + 'I have a ' + vehicle + ' available — ' + miles + ' miles — priced at ' + price
    + ' wholesale (MMR is ' + mmr + ', that\'s ' + discount + ' below market).\n\n'
    + 'Estimated net margin after fees and transport: ' + margin + '.'
    + (deal.location ? '\nAuction location: ' + deal.location + '.' : '')
    + (deal.saleDate ? '  Sale date: ' + deal.saleDate + '.' : '') + '\n\n'
    + 'If this fits your inventory, reach out and I\'ll send full details and photos.\n\n'
    + 'Alex\nLux Auto Wholesale\n' + from;

  return { subject, body };
}

// ── Full Pipeline ─────────────────────────────────────────────────────────────
function runFullPipeline() {
  _log('INFO', '=== Full Pipeline Start ===');
  try {
    fetchAndScoreDeals();
    matchDealsTooBuyers();
    sendOutreachEmails();
    _log('INFO', '=== Pipeline Complete ===');
  } catch (err) {
    _log('ERROR', 'Pipeline: ' + err.message);
    try { _getSpreadsheet().toast('Error: ' + err.message, '⚠️ Pipeline Failed', 10); } catch(e) {}
  }
}

// ── Triggers ──────────────────────────────────────────────────────────────────
function installTrigger() {
  _removeTriggerByName('runFullPipeline');
  ScriptApp.newTrigger('runFullPipeline').timeBased().everyHours(CFG.TRIGGER_HOURS).create();
  _log('INFO', 'Scan trigger installed — every ' + CFG.TRIGGER_HOURS + 'h');
  try {
    SpreadsheetApp.getUi().alert('✅ Scan trigger installed — every ' + CFG.TRIGGER_HOURS + ' hours.');
  } catch(e) { Logger.log('Scan trigger installed.'); }
}

function installDailyDigestTrigger() {
  _removeTriggerByName('runDailySuggestions');
  ScriptApp.newTrigger('runDailySuggestions')
    .timeBased().everyDays(1).atHour(CFG.DIGEST_TRIGGER_HOUR).create();
  _log('INFO', 'Daily digest trigger installed — ' + CFG.DIGEST_TRIGGER_HOUR + ':00 AM');
  try {
    SpreadsheetApp.getUi().alert(
      '✅ Daily digest trigger installed.\n'
      + 'Every morning at ' + CFG.DIGEST_TRIGGER_HOUR + ':00 AM you\'ll receive an email with\n'
      + 'vehicles 7–21 days out that match your buying history.'
    );
  } catch(e) { Logger.log('Daily digest trigger installed at ' + CFG.DIGEST_TRIGGER_HOUR + ':00 AM.'); }
}

function removeTrigger() { _removeTriggerByName('runFullPipeline'); }

function removeAllTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  _log('INFO', 'All triggers removed');
  try { SpreadsheetApp.getUi().alert('All triggers removed.'); } catch(e) {}
}

function _removeTriggerByName(fnName) {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === fnName)
    .forEach(t => ScriptApp.deleteTrigger(t));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEMAND_MAKES = {
  Toyota:10, Honda:9, Lexus:10, Acura:8, Ford:7, Chevrolet:7,
  BMW:7, 'Mercedes-Benz':7, Nissan:6, Mazda:8, Subaru:8
};

function _getAllDeals(ss) {
  const sheet = ss.getSheetByName(CFG.SHEET_DEALS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getDataRange().getValues().slice(1).map(row => {
    const vin     = String(row[0] || '').trim();
    if (!vin) return null;
    const year    = parseInt(row[1])  || 0;
    const make    = String(row[2] || '').trim();
    const model   = String(row[3] || '').trim();
    const trim    = String(row[4] || '').trim();
    const mileage = parseInt(row[5])  || 0;
    const price   = parseFloat(row[6]) || 0;
    const mmr     = parseFloat(row[7]) || 0;
    const disc    = parseFloat(String(row[8]).replace('%', '')) / 100 || 0;
    const score   = parseFloat(row[9])  || 0;
    const net     = parseFloat(row[10]) || 0;

    let tier = 'watch';
    if (score >= 80 && mileage < 60000) tier = 'elite';
    else if (score >= 70) tier = 'premium';
    else if (score >= 60) tier = 'good';

    const makeDemand = DEMAND_MAKES[make] || 5;
    const resellIdx  = Math.min(100,
      makeDemand * 3
      + Math.max(0, (year - 2016)) * 2
      + (mileage < 30000 ? 15 : mileage < 60000 ? 8 : 0)
      + Math.min(20, score * 0.2)
    );

    return {
      vin, year, make, model, trim, mileage, price, mmr,
      discountPct: disc, score, netMargin: net,
      location      : String(row[11] || '').trim(),
      saleDate      : String(row[12] || '').trim(),
      runNumber     : String(row[13] || '').trim(),
      status        : String(row[14] || '').trim(),
      matchedBuyers : String(row[15] || '').trim(),
      tier,
      resellIdx     : Math.round(resellIdx),
    };
  }).filter(Boolean);
}

function _getActiveBuyers(ss) {
  const sheet = ss.getSheetByName(CFG.SHEET_BUYERS);
  if (!sheet) return [];
  const data  = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  return data.slice(1).map((row, i) => ({
    rowIndex  : i + 2,
    name      : String(row[0] || '').trim(),
    email     : String(row[1] || '').trim(),
    phone     : String(row[2] || '').trim(),
    makes     : _splitCsv(row[3]),
    models    : _splitCsv(row[4]),
    maxPrice  : parseFloat(row[5]) || null,
    maxMileage: parseInt(row[6], 10) || null,
    state     : String(row[7] || '').trim(),
    active    : String(row[8] || '').trim().toLowerCase(),
    lastContacted: row[9],
    dealsSent    : parseInt(row[10], 10) || 0,
  })).filter(b => b.name && b.email && b.active === 'y');
}

function _getDealsAboveScore(ss, minScore) {
  return _getAllDeals(ss).filter(d => d.score >= minScore && d.status !== 'emailed');
}

function _getColumnValues(sheet, colNum) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, colNum, lastRow - 1, 1)
    .getValues().map(r => String(r[0]).trim());
}

function _splitCsv(val) {
  return String(val || '').split(',').map(s => s.trim()).filter(Boolean);
}

function _updateBuyerStats(ss, buyer) {
  const sheet = ss.getSheetByName(CFG.SHEET_BUYERS);
  if (!sheet || !buyer.rowIndex) return;
  sheet.getRange(buyer.rowIndex, 10).setValue(new Date());
  sheet.getRange(buyer.rowIndex, 11).setValue((buyer.dealsSent || 0) + 1);
}

function _colorScoreColumn(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const range  = sheet.getRange(2, 10, lastRow - 1, 1);
  const colors = range.getValues().map(([s]) => {
    if (!s) return ['#ffffff'];
    if (s >= 80) return ['#c6efce'];
    if (s >= 60) return ['#ffeb9c'];
    return ['#ffc7ce'];
  });
  range.setBackgrounds(colors);
}

function _log(level, message) {
  Logger.log('[' + level + '] ' + message);
  try {
    const ss       = _getSpreadsheet();
    let logSheet   = ss.getSheetByName(CFG.SHEET_SYSLOG);
    if (!logSheet) {
      logSheet = ss.insertSheet(CFG.SHEET_SYSLOG);
      logSheet.appendRow(['Timestamp','Level','Message']);
      logSheet.getRange(1,1,1,3).setBackground('#607d8b').setFontColor('#fff').setFontWeight('bold');
      logSheet.setFrozenRows(1);
    }
    logSheet.appendRow([new Date(), level, String(message).slice(0, 500)]);
    // Trim to last 2000 rows
    const rows = logSheet.getLastRow();
    if (rows > 2001) logSheet.deleteRows(2, rows - 2001);
  } catch (e) { /* logging must never throw */ }
}

function _formatDate(d) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — EXOTIC SCORING ENGINE
// ══════════════════════════════════════════════════════════════════════════════

/** Exotic makes — these get the specialized scoring model. */
const EXOTIC_MAKES_SET = new Set([
  'ferrari','lamborghini','porsche','mclaren','bentley','rolls-royce',
  'aston martin','bugatti','pagani','koenigsegg','lotus','alfa romeo',
  'maserati','morgan','noble','karma','delorean',
  'dodge viper','dodge challenger srt hellcat',
]);

/** Returns true if this make should use exotic scoring. */
function _isExoticMake(make) {
  if (!make) return false;
  const m = make.toLowerCase().trim();
  if (EXOTIC_MAKES_SET.has(m)) return true;
  // Partial matches for compound makes
  for (const exotic of EXOTIC_MAKES_SET) {
    if (m.includes(exotic) || exotic.includes(m)) return true;
  }
  return false;
}

/**
 * Embedded exotic reference price table.
 * These are approximate wholesale/Hagerty mid-market values by make + year range.
 * Format: make (lowercase) → [{yearFrom, yearTo, basePrice}]
 */
const EXOTIC_REF_PRICES = {
  'ferrari':      [{f:1990,t:2005,p:95000},{f:2006,t:2015,p:160000},{f:2016,t:2026,p:240000}],
  'lamborghini':  [{f:1990,t:2005,p:90000},{f:2006,t:2015,p:155000},{f:2016,t:2026,p:230000}],
  'porsche':      [{f:1990,t:2004,p:38000},{f:2005,t:2014,p:55000}, {f:2015,t:2026,p:85000}],
  'mclaren':      [{f:2011,t:2017,p:120000},{f:2018,t:2026,p:165000}],
  'bentley':      [{f:2000,t:2012,p:48000},{f:2013,t:2026,p:115000}],
  'rolls-royce':  [{f:2000,t:2010,p:75000},{f:2011,t:2026,p:195000}],
  'maserati':     [{f:2000,t:2012,p:28000},{f:2013,t:2026,p:52000}],
  'aston martin': [{f:2000,t:2012,p:55000},{f:2013,t:2026,p:115000}],
  'bugatti':      [{f:2005,t:2026,p:1500000}],
  'lotus':        [{f:2000,t:2026,p:35000}],
  'alfa romeo':   [{f:2000,t:2026,p:22000}],
};

/** Rarity bonuses applied to score (higher = rarer / more desirable). */
const EXOTIC_RARITY = {
  'bugatti':5,'koenigsegg':5,'pagani':5,'ferrari':4,'lamborghini':4,
  'mclaren':3,'aston martin':3,'rolls-royce':3,'bentley':2,'porsche':2,
  'maserati':1,'alfa romeo':1,
};

/** Returns embedded reference price for a given make+year, or null. */
function _getExoticRefPrice(make, year) {
  if (!make) return null;
  const tiers = EXOTIC_REF_PRICES[make.toLowerCase()];
  if (!tiers) return null;
  const yr = parseInt(year, 10) || 0;
  for (const tier of tiers) {
    if (yr >= tier.f && yr <= tier.t) return tier.p;
  }
  return tiers[tiers.length - 1].p; // fall back to most recent tier
}

/** Returns a rarity score bonus (0-5) for exotic makes. */
function _getExoticRarityBonus(make) {
  if (!make) return 0;
  return EXOTIC_RARITY[make.toLowerCase()] || 1;
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — MOBILE SCANNER API (called by MobileScanner.html)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Looks up MMR and deal score for a VIN. Called by the mobile scanner PWA.
 * Returns a full deal object the scanner can display.
 */
function lookupVinScore(vin) {
  if (!vin) return { error: 'No VIN provided' };
  try {
    const token = _getManheimToken();
    if (!token) return { error: 'NO_CREDENTIALS', vin };

    // Fetch listing from Manheim
    const data = _mhGet(CFG.LISTINGS_URL, { vin: vin.trim(), limit: 1 });
    const item = data && (data.items || data.results || [])[0];

    if (!item) {
      // VIN not in current listings — return MMR only
      const mmr = _fetchMMRCached(vin, 0);
      return {
        vin, found: false, mmr,
        recommendedMax: mmr ? Math.round(mmr * 0.92) : null,
        score: null,
        message: 'VIN not in current Manheim listings',
      };
    }

    const scored = _scoreListing(item);
    const recommendedMax = scored.mmr ? Math.round(scored.mmr * 0.92) : null;
    return { ...scored, found: true, recommendedMax };
  } catch (err) {
    _log('ERROR', 'lookupVinScore ' + vin + ': ' + err.message);
    return { error: err.message, vin };
  }
}

/** Sets a bid limit for a VIN in the Upcoming Watch sheet. */
function setBidLimit(vin, limit) {
  if (!vin) return { success: false, error: 'No VIN' };
  try {
    const ss    = _getSpreadsheet();
    const sheet = ss.getSheetByName(CFG.SHEET_UPCOMING);
    if (!sheet) return { success: false, error: 'Watchlist sheet not found' };
    const vins = _getColumnValues(sheet, 3); // col C = VIN
    const idx  = vins.indexOf(vin.trim());
    if (idx === -1) return { success: false, error: 'VIN not in watchlist' };
    // Assuming col H = Bid Limit (index 8 = col H)
    sheet.getRange(idx + 2, 8).setValue(parseFloat(limit) || 0);
    return { success: true, vin, bidLimit: limit };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Sends waitlist match notifications for a specific VIN.
 * Fetches the listing, runs matching, sends Gmail notifications.
 */
function notifyWaitlistForVin(vin) {
  if (!vin) return { success: false, error: 'No VIN' };
  try {
    const token = _getManheimToken();
    if (!token) return { success: false, error: 'NO_CREDENTIALS' };

    const data  = _mhGet(CFG.LISTINGS_URL, { vin: vin.trim(), limit: 1 });
    const item  = data && (data.items || data.results || [])[0];
    if (!item)  return { success: false, error: 'VIN not in listings' };

    const scored    = _scoreListing(item);
    const matched   = matchInventoryToWaitlist(scored);
    if (!matched.length) return { success: true, notified: 0, message: 'No waitlist matches' };

    const result    = sendWaitlistNotifications(scored, matched);
    return { success: true, notified: result.sent, matched: matched.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — PIPELINE API (thin wrappers — logic lives in Pipeline.gs)
// ══════════════════════════════════════════════════════════════════════════════

/** Returns all deals in the pipeline, sorted by last updated. */
function getPipelineData() {
  try { return { ok: true, deals: getPipelineData_() }; }
  catch (err) { return { ok: false, error: err.message, deals: [] }; }
}
function getPipelineData_() { return getPipelineData ? /* Pipeline.gs */ getPipelineData() : []; }

/** Updates a deal's stage and logs the change. */
function updateDealStageAPI(vin, newStage, notes) {
  try { return updateDealStage(vin, newStage, notes || ''); }
  catch (err) { return { success: false, error: err.message }; }
}

/** Adds a new deal to the pipeline from the dashboard. */
function addDealToPipelineAPI(params) {
  try { return addDealToPipeline(params); }
  catch (err) { return { success: false, error: err.message }; }
}

/** Updates cost fields (transport, recon, fees) for a pipeline vehicle. */
function updateDealCostsAPI(vin, costs) {
  try { return updateDealCosts(vin, costs); }
  catch (err) { return { success: false, error: err.message }; }
}

/** Returns pipeline summary stats (capital deployed, profit, at-risk deals). */
function getPipelineSummaryAPI() {
  try { return { ok: true, summary: getPipelineSummary() }; }
  catch (err) { return { ok: false, error: err.message }; }
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — CUSTOMER WAITLIST API (wrappers — logic in CustomerWaitlist.gs)
// ══════════════════════════════════════════════════════════════════════════════

/** Returns all waitlist entries (optionally filtered by status). */
function getCustomerWaitlistAPI(statusFilter) {
  try { return { ok: true, buyers: getWaitlist(statusFilter) }; }
  catch (err) { return { ok: false, error: err.message, buyers: [] }; }
}

/** Adds a buyer to the waitlist. */
function addToWaitlistAPI(params) {
  try { return addToWaitlist(params); }
  catch (err) { return { success: false, error: err.message }; }
}

/** Returns waitlist stats (counts, recent matches, top makes). */
function getWaitlistStatsAPI() {
  try { return { ok: true, stats: getWaitlistStats() }; }
  catch (err) { return { ok: false, error: err.message }; }
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — ANALYTICS API (wrappers — logic in Analytics.gs)
// ══════════════════════════════════════════════════════════════════════════════

/** Returns comprehensive dashboard analytics: P&L, velocity, alerts. */
function getDashboardAnalyticsAPI() {
  try { return { ok: true, analytics: getDashboardStats() }; }
  catch (err) { return { ok: false, error: err.message }; }
}

/** Triggers a Looker Studio data export (rebuilds the BI Export sheet). */
function triggerLookerExportAPI() {
  try { return buildLookerStudioExport(); }
  catch (err) { return { success: false, error: err.message }; }
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — VEHICLE VAULT API (wrappers — logic in VehicleVault.gs)
// ══════════════════════════════════════════════════════════════════════════════

/** Creates or fetches the Drive folder for a vehicle. */
function createVehicleVaultAPI(vin, make, model, year) {
  try { return createVehicleFolderIfMissing(vin, make, model, year); }
  catch (err) { return { success: false, error: err.message }; }
}

/** Returns the list of files stored for a vehicle in Drive. */
function getVaultContentsAPI(vin) {
  try { return { ok: true, files: getVaultContents(vin) }; }
  catch (err) { return { ok: false, error: err.message, files: [] }; }
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — CALENDAR API (wrappers — logic in CalendarSync.gs)
// ══════════════════════════════════════════════════════════════════════════════

/** Returns upcoming auction events from the Google Calendar. */
function getUpcomingAuctionEventsAPI(daysAhead) {
  try { return { ok: true, events: getUpcomingAuctionEvents(daysAhead || 14) }; }
  catch (err) { return { ok: false, error: err.message, events: [] }; }
}

/** Creates a Google Calendar event for an auction. */
function syncAuctionEventAPI(params) {
  try { return syncAuctionEvent(params); }
  catch (err) { return { success: false, error: err.message }; }
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — CO-WHOLESALE BLAST
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Sends a co-wholesale deal card to your entire active buyer list before
 * committing capital. Use on auction eve to pre-sell at a markup.
 *
 * @param {Object} deal  - {vin, make, model, year, mileage, price, mmr, score, location, saleDate}
 * @param {number} askPrice - your co-wholesale ask price
 */
function sendCoWholesaleBlast(deal, askPrice) {
  if (!deal || !deal.vin) return { success: false, error: 'No deal provided' };
  try {
    const ss      = _getSpreadsheet();
    const buyers  = _getActiveBuyers(ss);
    if (!buyers.length) return { success: false, error: 'No active buyers' };

    const vehicle = `${deal.year} ${deal.make} ${deal.model}`;
    const subject = `🔥 Wholesale Opportunity: ${vehicle} — $${(askPrice || deal.price).toLocaleString()}`;
    const margin  = deal.mmr ? `~$${Math.round(deal.mmr - askPrice).toLocaleString()} below MMR` : '';
    const logSheet = ss.getSheetByName(CFG.SHEET_LOG)
      || _ensureSheet(ss, CFG.SHEET_LOG, ['Timestamp','Buyer','Email','VIN','Vehicle','Score','Discount','Margin','Subject','Status'], '#fbbc04');

    let sent = 0;
    buyers.forEach(buyer => {
      if (!_buyerMatchesDeal(buyer, deal)) return;
      try {
        const body = `Hi ${buyer.name.split(' ')[0]},\n\n`
          + `I have a ${vehicle} available for co-wholesale:\n`
          + `  • Mileage: ${(deal.mileage || 0).toLocaleString()} miles\n`
          + `  • My ask: $${(askPrice || deal.price).toLocaleString()} (${margin})\n`
          + `  • Deal score: ${deal.score || 'N/A'}/100\n`
          + (deal.location ? `  • Location: ${deal.location}\n` : '')
          + (deal.saleDate ? `  • Sale: ${deal.saleDate}\n` : '')
          + `  • VIN: ${deal.vin}\n\n`
          + `First committed buyer wins it. Reply or call.\n\n`
          + `Alex | Lux Auto`;
        GmailApp.sendEmail(buyer.email, subject, body, { name: 'Alex | Lux Auto Wholesale' });
        logSheet.appendRow([new Date(), buyer.name, buyer.email, deal.vin,
          vehicle, deal.score || '', '', '', subject, 'Co-Wholesale Sent']);
        sent++;
        Utilities.sleep(150);
      } catch (e) { _log('ERROR', 'Co-wholesale email to ' + buyer.email + ': ' + e.message); }
    });

    _log('INFO', `Co-wholesale blast: ${vehicle} → ${sent} buyers`);
    try { notifyDealStageChange(deal.vin, deal.make, deal.model, deal.year, '', 'Co-Wholesale Out', `Blasted to ${sent} buyers`); } catch(e) {}
    return { success: true, sent, buyersContacted: buyers.length };
  } catch (err) {
    _log('ERROR', 'sendCoWholesaleBlast: ' + err.message);
    return { success: false, error: err.message };
  }
}

/** Menu trigger — prompts for deal details and runs co-wholesale blast. */
function runCoWholesaleBlast() {
  try {
    const ui   = SpreadsheetApp.getUi();
    const vin  = ui.prompt('Co-Wholesale Blast', 'Enter VIN:', ui.ButtonSet.OK_CANCEL);
    if (vin.getSelectedButton() !== ui.Button.OK || !vin.getResponseText()) return;
    const ask  = ui.prompt('Ask Price', 'Enter your ask price ($):', ui.ButtonSet.OK_CANCEL);
    if (ask.getSelectedButton() !== ui.Button.OK) return;

    const row  = getPipelineRow(vin.getResponseText().trim());
    const deal = row || { vin: vin.getResponseText().trim() };
    const result = sendCoWholesaleBlast(deal, parseFloat(ask.getResponseText().replace(/[$,]/g, '')));
    ui.alert(result.success
      ? `✅ Co-wholesale blast sent to ${result.sent} buyers.`
      : '❌ Error: ' + result.error);
  } catch (e) {
    try { SpreadsheetApp.getUi().alert('Error: ' + e.message); } catch(e2) {}
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — DAILY BRIEFING TRIGGER
// ══════════════════════════════════════════════════════════════════════════════

/** Sends a Google Chat daily briefing (7 AM trigger). */
function sendDailyBriefingToChat() {
  try {
    const ss  = _getSpreadsheet();
    const deals = _getAllDeals(ss);
    let pipelineSummary;
    try { pipelineSummary = getPipelineSummary(); } catch(e) { pipelineSummary = {}; }

    const summary = {
      newListings     : deals.length,
      hotDeals        : deals.filter(d => d.score >= 70).length,
      pipelineValue   : pipelineSummary.totalCapitalDeployed || 0,
      soldThisWeek    : pipelineSummary.dealsByStage ? (pipelineSummary.dealsByStage['Sold'] || 0) : 0,
      grossProfitThisWeek : pipelineSummary.totalGrossProfit || 0,
    };
    notifyDailyBriefing(summary);
  } catch (err) {
    _log('ERROR', 'sendDailyBriefingToChat: ' + err.message);
  }
}
