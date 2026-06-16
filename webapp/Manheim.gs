/**
 * Lux Auto — Manheim API client (Apps Script).
 *
 * Implements the Manheim ISWS OAuth2 client_credentials flow entirely in GAS
 * using UrlFetchApp — no external libraries required.
 *
 * Script Properties required:
 *   MANHEIM_CLIENT_ID     — Manheim developer API client ID
 *   MANHEIM_CLIENT_SECRET — Manheim developer API client secret
 *
 * Optional Script Properties:
 *   MH_DEAL_THRESHOLD     — Minimum discount % to flag as a deal (default: 0.15 = 15%)
 *   MH_MAX_MILEAGE        — Skip vehicles above this mileage (default: 100000)
 *   MH_SEARCH_QUERY       — Comma-separated makes to scan (default: exotic makes from Config.gs)
 *
 * Public surface (callable from client or triggers):
 *   getMMR(vin)          → {vin, mmr, adjustedMmr, grade, currency}
 *   searchListings(opts) → [{vin, year, make, model, mileage, price, ...}]
 *   runManheimScan()     → {scanned, alerts, skipped}  — also writes to Sheets
 */

var MH = Object.freeze({
  AUTH_URL : 'https://api.manheim.com/id/credentials/accesstoken',
  BASE_URL : 'https://api.manheim.com',
  MMR_URL  : 'https://marketreport.manheim.com',
  TOKEN_KEY: 'mh_token',            // ScriptCache key
  TOKEN_TTL: 3300                   // seconds (token valid 3600 — buffer 5 min)
});

// ── Auth ──────────────────────────────────────────────────────────────────────

function mhClientId_()     { return prop_('MANHEIM_CLIENT_ID', ''); }
function mhClientSecret_() { return prop_('MANHEIM_CLIENT_SECRET', ''); }

/** Returns a valid Bearer token, refreshing if expired. */
function mhToken_() {
  var cache = CacheService.getScriptCache();
  var tok   = cache.get(MH.TOKEN_KEY);
  if (tok) return tok;

  if (!mhClientId_() || !mhClientSecret_()) {
    throw new Error('MANHEIM_CLIENT_ID / MANHEIM_CLIENT_SECRET not set in Script Properties');
  }

  var resp = UrlFetchApp.fetch(MH.AUTH_URL, {
    method           : 'post',
    muteHttpExceptions: true,
    contentType      : 'application/x-www-form-urlencoded',
    payload          : 'grant_type=client_credentials' +
                       '&client_id='     + encodeURIComponent(mhClientId_()) +
                       '&client_secret=' + encodeURIComponent(mhClientSecret_())
  });

  var code = resp.getResponseCode();
  if (code !== 200) throw new Error('Manheim auth failed (' + code + '): ' + resp.getContentText());

  var data = JSON.parse(resp.getContentText());
  tok = data.access_token;
  cache.put(MH.TOKEN_KEY, tok, MH.TOKEN_TTL);
  return tok;
}

// ── Low-level fetch ───────────────────────────────────────────────────────────

function mhFetch_(baseUrl, path, queryObj, method) {
  var url = baseUrl + path;
  if (queryObj) {
    var qs = Object.keys(queryObj)
      .filter(function (k) { return queryObj[k] !== null && queryObj[k] !== undefined && queryObj[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(queryObj[k]); })
      .join('&');
    if (qs) url += '?' + qs;
  }
  var resp = UrlFetchApp.fetch(url, {
    method            : method || 'get',
    muteHttpExceptions: true,
    headers           : { Authorization: 'Bearer ' + mhToken_() }
  });
  var code = resp.getResponseCode();
  if (code === 401) {
    // Token may have expired mid-session — clear cache and retry once
    CacheService.getScriptCache().remove(MH.TOKEN_KEY);
    resp = UrlFetchApp.fetch(url, {
      method            : method || 'get',
      muteHttpExceptions: true,
      headers           : { Authorization: 'Bearer ' + mhToken_() }
    });
    code = resp.getResponseCode();
  }
  if (code < 200 || code >= 300) throw new Error('Manheim API ' + code + ': ' + resp.getContentText().substring(0, 200));
  var text = resp.getContentText();
  return text ? JSON.parse(text) : {};
}

// ── MMR lookup ────────────────────────────────────────────────────────────────

/**
 * Fetches the Manheim Market Report (MMR) value for a VIN.
 * Returns null if the VIN is not in the Manheim database.
 *
 * @param  {string} vin
 * @return {{vin, mmr, adjustedMmr, grade, currency}|null}
 */
function getMMR(vin) {
  assertAccess_();
  try {
    var data = mhFetch_(MH.MMR_URL, '/valuations/vin/' + encodeURIComponent(vin));
    var v    = (data.valuations && data.valuations[0]) || data;
    return {
      vin        : vin,
      mmr        : v.average      || v.mmr        || 0,
      adjustedMmr: v.adjustedAverage || v.adjustedMmr || 0,
      grade      : v.conditionGrade  || null,
      currency   : v.currency     || 'USD'
    };
  } catch (e) {
    console.warn('getMMR failed for ' + vin + ': ' + e.message);
    return null;
  }
}

// ── Auction search ────────────────────────────────────────────────────────────

/**
 * Searches upcoming Manheim auctions for a make/keyword.
 *
 * @param  {Object} opts  { query, year, maxMileage, limit }
 * @return {Array}        array of listing objects
 */
function searchListings(opts) {
  assertAccess_();
  opts = opts || {};
  var params = {
    query     : opts.query      || '',
    year      : opts.year       || '',
    mileageTo : opts.maxMileage || mhMaxMileage_(),
    rows      : opts.limit      || 50,
    start     : 0
  };
  var data  = mhFetch_(MH.BASE_URL, '/listings/search', params);
  var items = (data.items || data.results || data.listings || []);
  return items.map(mapListing_);
}

// ── Listing mapper ────────────────────────────────────────────────────────────

function mapListing_(raw) {
  return {
    vin            : raw.vin            || '',
    year           : parseInt(raw.year  || 0, 10),
    make           : raw.make           || '',
    model          : raw.model          || '',
    trim           : raw.trim           || '',
    mileage        : parseInt(raw.odometer || raw.mileage || 0, 10),
    conditionGrade : raw.conditionGrade || raw.grade || null,
    auctionLocation: raw.auctionLocation || raw.location || '',
    saleDate       : raw.saleDate       || raw.startDate || '',
    listingPrice   : Number(raw.salePrice || raw.price || 0),
    mmrValue       : Number(raw.mmr      || raw.mmrValue || 0),
    images         : raw.images          || []
  };
}

// ── Config helpers ────────────────────────────────────────────────────────────

function mhDealThreshold_() { return parseFloat(prop_('MH_DEAL_THRESHOLD', '0.15')); }
function mhMaxMileage_()    { return parseInt(prop_('MH_MAX_MILEAGE',    '100000'), 10); }
function mhSearchMakes_()   {
  var custom = prop_('MH_SEARCH_QUERY', '');
  if (custom) return custom.split(',').map(function (s) { return s.trim(); });
  return EXOTIC_MAKES;  // defined in Api.gs
}

// ── Deal scoring ──────────────────────────────────────────────────────────────

/**
 * Scores a listing 0–100.
 * Factors: discount depth (40%), condition grade (30%), mileage (20%), exotic make (10%).
 */
function scoreListing_(listing) {
  var score = 0;

  // Discount vs MMR
  if (listing.mmrValue > 0 && listing.listingPrice > 0) {
    var pct = (listing.mmrValue - listing.listingPrice) / listing.mmrValue;
    score += Math.min(40, Math.round(pct / mhDealThreshold_() * 40));
  }

  // Condition grade (Manheim 1.0–5.0 → up to 30 pts)
  if (listing.conditionGrade) {
    score += Math.round((listing.conditionGrade / 5) * 30);
  }

  // Mileage (lower is better — up to 20 pts)
  var maxMi = mhMaxMileage_();
  if (listing.mileage >= 0) {
    score += Math.round(Math.max(0, 1 - listing.mileage / maxMi) * 20);
  }

  // Exotic make bonus (10 pts)
  if (matchMake_(listing.make || listing.model || '')) score += 10;

  return Math.min(100, Math.max(0, score));
}

function buildDealAlert_(listing) {
  var discount = listing.mmrValue > 0
    ? (listing.mmrValue - listing.listingPrice) / listing.mmrValue
    : 0;
  var profit = listing.mmrValue - listing.listingPrice;
  var score  = scoreListing_(listing);
  return {
    listing              : listing,
    dealScore            : score,
    discountPct          : discount,
    estimatedProfitMargin: Math.round(profit),
    reason               : score >= 70 ? 'Hot deal — ' + (discount * 100).toFixed(0) + '% below MMR'
                         : score >= 50 ? 'Good deal — ' + (discount * 100).toFixed(0) + '% below MMR'
                         :               'Flagged — review manually'
  };
}

// ── Main scan (called by daily trigger) ──────────────────────────────────────

/**
 * Scans Manheim listings for each exotic make, flags deals, writes to Sheets.
 * Safe to call from a time-based trigger.
 * @return {{scanned:number, alerts:number, skipped:number}}
 */
function runManheimScan() {
  if (!mhClientId_()) {
    console.log('runManheimScan: MANHEIM_CLIENT_ID not set — skipping');
    return { scanned: 0, alerts: 0, skipped: 0, reason: 'not_configured' };
  }

  var threshold = mhDealThreshold_();
  var makes     = mhSearchMakes_();
  var scanned   = 0;
  var alerts    = 0;
  var skipped   = 0;

  makes.forEach(function (make) {
    try {
      var listings = searchListings({ query: make, maxMileage: mhMaxMileage_(), limit: 50 });
      listings.forEach(function (listing) {
        scanned++;
        if (!listing.mmrValue || !listing.listingPrice) { skipped++; return; }
        if (listing.mileage > mhMaxMileage_())           { skipped++; return; }
        var discount = (listing.mmrValue - listing.listingPrice) / listing.mmrValue;
        if (discount < threshold)                         { return; }

        // Enrich with a fresh MMR if the listing MMR looks stale / missing
        if (!listing.mmrValue && listing.vin) {
          var mmrData = getMMR(listing.vin);
          if (mmrData) listing.mmrValue = mmrData.mmr;
        }

        var alert = buildDealAlert_(listing);
        appendManheimAlert_(alert);
        alerts++;
      });
    } catch (e) {
      console.warn('Manheim scan error for make "' + make + '": ' + e.message);
    }
  });

  logActivity_('manheim_scan', 'Scanned ' + scanned + ' listings — ' + alerts + ' alerts, ' + skipped + ' skipped');
  console.log('Manheim scan complete: ' + alerts + ' alerts from ' + scanned + ' listings');
  return { scanned: scanned, alerts: alerts, skipped: skipped };
}
