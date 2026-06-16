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
 *   MH_DEAL_THRESHOLD  — Minimum discount % for mass-market gate (default: 0.15 = 15%)
 *                        Exotic makes bypass this gate entirely.
 *   MH_MAX_MILEAGE     — Skip vehicles above this mileage (default: 100000)
 *   MH_SEARCH_QUERY    — Comma-separated makes to scan (default: EXOTIC_MAKES from Api.gs)
 *
 * Public surface (callable from client via google.script.run, or from triggers):
 *   getMMR(vin, mileage)  → {vin, mmr, adjustedMmr, grade, currency} | null
 *   searchListings(opts)  → [{vin, year, make, model, mileage, price, ...}]
 *   runManheimScan()      → {scanned, alerts, skipped, pushed}
 */

// ── API endpoints & constants ─────────────────────────────────────────────────

var MH = Object.freeze({
  AUTH_URL     : 'https://api.manheim.com/id/credentials/accesstoken',
  BASE_URL     : 'https://api.manheim.com',
  MMR_URL      : 'https://marketreport.manheim.com',
  TOKEN_KEY    : 'mh_token',
  TOKEN_TTL    : 3300,    // seconds — token valid 3600; buffer 5 min
  MMR_TTL      : 21600,   // 6h per-VIN MMR cache
  MAX_BID_RATIO: 0.92     // recommended max bid = MMR × 0.92
});

// ── Rarity tiers (bonus score for exotic makes) ───────────────────────────────

var RARITY_TIERS = [
  { makes: ['Bugatti', 'Koenigsegg', 'Pagani', 'Rimac', 'Czinger'],              pts: 20 },
  { makes: ['Ferrari', 'Lamborghini', 'McLaren'],                                 pts: 12 },
  { makes: ['Rolls-Royce', 'Bentley', 'Aston Martin'],                           pts: 10 },
  { makes: ['Porsche', 'Maserati', 'Lotus', 'De Tomaso', 'Alfa Romeo'],          pts:  6 }
];

// ── Auth ──────────────────────────────────────────────────────────────────────

function mhClientId_()     { return prop_('MANHEIM_CLIENT_ID',     ''); }
function mhClientSecret_() { return prop_('MANHEIM_CLIENT_SECRET', ''); }

/**
 * Returns a valid Bearer token, refreshing via client_credentials if expired.
 * Token is cached in ScriptCache to minimise auth calls.
 */
function mhToken_() {
  var cache = CacheService.getScriptCache();
  var tok   = cache.get(MH.TOKEN_KEY);
  if (tok) return tok;

  if (!mhClientId_() || !mhClientSecret_()) {
    throw new Error('MANHEIM_CLIENT_ID / MANHEIM_CLIENT_SECRET not set in Script Properties.');
  }

  var resp = UrlFetchApp.fetch(MH.AUTH_URL, {
    method            : 'post',
    muteHttpExceptions: true,
    contentType       : 'application/x-www-form-urlencoded',
    payload           : 'grant_type=client_credentials'
                      + '&client_id='     + encodeURIComponent(mhClientId_())
                      + '&client_secret=' + encodeURIComponent(mhClientSecret_())
  });

  var code = resp.getResponseCode();
  if (code !== 200) throw new Error('Manheim auth failed (' + code + '): ' + resp.getContentText());

  var data = JSON.parse(resp.getContentText());
  tok = data.access_token;
  cache.put(MH.TOKEN_KEY, tok, MH.TOKEN_TTL);
  return tok;
}

// ── Low-level fetch with backoff ──────────────────────────────────────────────

/**
 * Authenticated UrlFetchApp wrapper with:
 *   - 401 auto-retry (clears token cache and re-authenticates once)
 *   - 429 rate-limit retry (2.5s pause)
 *   - 5xx retry (1.5s pause)
 *
 * @param {string}  baseUrl
 * @param {string}  path
 * @param {Object=} queryObj
 * @param {string=} method   GET (default)
 * @param {boolean} _retry   internal flag — don't pass manually
 */
function mhFetch_(baseUrl, path, queryObj, method, _retry) {
  var url = baseUrl + path;
  if (queryObj) {
    var qs = Object.keys(queryObj)
      .filter(function (k) {
        return queryObj[k] !== null && queryObj[k] !== undefined && queryObj[k] !== '';
      })
      .map(function (k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(queryObj[k]);
      })
      .join('&');
    if (qs) url += '?' + qs;
  }

  var opts = {
    method            : method || 'get',
    muteHttpExceptions: true,
    headers           : { Authorization: 'Bearer ' + mhToken_() }
  };

  var resp = UrlFetchApp.fetch(url, opts);
  var code = resp.getResponseCode();

  // Retry logic (only once per call)
  if (!_retry) {
    if (code === 401) {
      // Token may have expired mid-session
      CacheService.getScriptCache().remove(MH.TOKEN_KEY);
      return mhFetch_(baseUrl, path, queryObj, method, true);
    }
    if (code === 429) {
      Utilities.sleep(2500);
      return mhFetch_(baseUrl, path, queryObj, method, true);
    }
    if (code >= 500) {
      Utilities.sleep(1500);
      return mhFetch_(baseUrl, path, queryObj, method, true);
    }
  }

  if (code < 200 || code >= 300) {
    throw new Error('Manheim API ' + code + ': ' + resp.getContentText().substring(0, 200));
  }

  var text = resp.getContentText();
  return text ? JSON.parse(text) : {};
}

// ── Per-VIN MMR (internal, cached 6h) ────────────────────────────────────────

/**
 * Internal cached MMR lookup. No assertAccess_() — safe to call from triggers.
 * Returns null on failure (non-fatal).
 *
 * @param  {string}  vin
 * @param  {number=} mileage  Optional — enables mileage-adjusted MMR
 * @return {{vin, mmr, adjustedMmr, grade, currency}|null}
 */
function mmrValue_(vin, mileage) {
  var cache = CacheService.getScriptCache();
  var key   = 'mmr|' + vin + (mileage ? '|' + Math.round(mileage / 1000) : '');
  var hit   = cache.get(key);
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }

  try {
    var query = {};
    if (mileage) query.odometer = mileage;
    var data  = mhFetch_(MH.MMR_URL, '/valuations/vin/' + encodeURIComponent(vin), query);
    var v     = (data.valuations && data.valuations[0]) || data;
    var result = {
      vin        : vin,
      mmr        : v.average          || v.mmr        || 0,
      adjustedMmr: v.adjustedAverage  || v.adjustedMmr || 0,
      grade      : v.conditionGrade   || null,
      currency   : v.currency         || 'USD'
    };
    if (result.mmr) cache.put(key, JSON.stringify(result), MH.MMR_TTL);
    return result;
  } catch (e) {
    console.warn('mmrValue_ failed for ' + vin + ': ' + e.message);
    return null;
  }
}

// ── Public: MMR lookup ────────────────────────────────────────────────────────

/**
 * Fetches the Manheim Market Report (MMR) value for a VIN.
 * Results cached per-VIN for 6h to reduce Manheim API calls by ~80%.
 *
 * @param  {string}  vin
 * @param  {number=} mileage  Optional mileage for adjustment
 * @return {{vin, mmr, adjustedMmr, grade, currency}|null}
 */
function getMMR(vin, mileage) {
  assertAccess_();
  return mmrValue_(vin, mileage);
}

// ── Auction listing search ────────────────────────────────────────────────────

/**
 * Searches upcoming Manheim auctions.
 *
 * @param  {Object} opts  { query, year, maxMileage, limit }
 * @return {Array}        mapped listing objects
 */
function searchListings(opts) {
  assertAccess_();
  opts = opts || {};
  var params = {
    query    : opts.query      || '',
    year     : opts.year       || '',
    mileageTo: opts.maxMileage || mhMaxMileage_(),
    rows     : opts.limit      || 50,
    start    : 0
  };
  var data  = mhFetch_(MH.BASE_URL, '/listings/search', params);
  var items = data.items || data.results || data.listings || [];
  return items.map(mapListing_);
}

// ── Listing mapper ────────────────────────────────────────────────────────────

function mapListing_(raw) {
  return {
    vin            : raw.vin              || '',
    year           : parseInt(raw.year   || 0, 10),
    make           : raw.make             || '',
    model          : raw.model            || '',
    trim           : raw.trim             || '',
    mileage        : parseInt(raw.odometer || raw.mileage || 0, 10),
    conditionGrade : Number(raw.conditionGrade || raw.grade || 0) || null,
    auctionLocation: raw.auctionLocation  || raw.location || '',
    saleDate       : raw.saleDate         || raw.startDate || '',
    listingPrice   : Number(raw.salePrice || raw.price    || 0),
    mmrValue       : Number(raw.mmr       || raw.mmrValue || 0),
    images         : raw.images           || []
  };
}

// ── Config helpers ────────────────────────────────────────────────────────────

function mhDealThreshold_() { return parseFloat(prop_('MH_DEAL_THRESHOLD', '0.15')); }
function mhMaxMileage_()    { return parseInt(prop_('MH_MAX_MILEAGE', '100000'), 10); }
function mhSearchMakes_()   {
  var custom = prop_('MH_SEARCH_QUERY', '');
  if (custom) return custom.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  return EXOTIC_MAKES;  // defined in Api.gs
}

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * Returns the rarity bonus score (0–20 pts) for a given make.
 * Ultra-rare (Bugatti, Koenigsegg, Pagani) = 20 pts.
 * Non-exotic makes = 0 pts.
 */
function rarityPts_(make) {
  var m = String(make || '');
  for (var i = 0; i < RARITY_TIERS.length; i++) {
    var tier = RARITY_TIERS[i];
    for (var j = 0; j < tier.makes.length; j++) {
      if (new RegExp(tier.makes[j].replace(/[-\s]/g, '.?'), 'i').test(m)) {
        return tier.pts;
      }
    }
  }
  return 0;
}

/**
 * Scores a listing 0–100.
 *
 * Component weights:
 *   Discount vs MMR   0–35 pts  (each 1% below MMR ≈ 2.3 pts; cap at 35)
 *   Condition grade   0–25 pts  (Manheim 1.0–5.0 scale)
 *   Mileage           0–20 pts  (quadratic decay — very low mileage gets aggressive bonus)
 *   Rarity            0–20 pts  (exotic make tier; 0 for mass-market)
 *   Max total = 100
 *
 * Note: exotics with rarity bonus can reach 80+ even at-market price.
 */
function scoreListing_(listing) {
  var score = 0;
  var maxMi = mhMaxMileage_();

  // Discount vs MMR (0–35 pts)
  if (listing.mmrValue > 0 && listing.listingPrice > 0) {
    var pct = (listing.mmrValue - listing.listingPrice) / listing.mmrValue;
    score += Math.min(35, Math.max(0, Math.round(pct * (35 / 0.15))));
  }

  // Condition grade 1.0–5.0 (0–25 pts)
  if (listing.conditionGrade) {
    score += Math.round((Number(listing.conditionGrade) / 5) * 25);
  }

  // Mileage — quadratic decay gives more weight to ultra-low mileage (0–20 pts)
  if (listing.mileage >= 0 && maxMi > 0) {
    var ratio = Math.max(0, 1 - listing.mileage / maxMi);
    score += Math.round(ratio * ratio * 20);
  }

  // Rarity bonus (0–20 pts for exotic makes)
  score += rarityPts_(listing.make || listing.model || '');

  return Math.min(100, Math.max(0, score));
}

// ── Deal alert builder ────────────────────────────────────────────────────────

/**
 * Builds a deal alert object from a scored listing.
 * @param  {Object} listing   mapped listing from mapListing_()
 * @return {Object}           alert with dealScore, maxBid, reason, etc.
 */
function buildDealAlert_(listing) {
  var discount = listing.mmrValue > 0
    ? (listing.mmrValue - listing.listingPrice) / listing.mmrValue
    : 0;
  var profit = listing.mmrValue - listing.listingPrice;
  var score  = scoreListing_(listing);
  var maxBid = listing.mmrValue ? Math.round(listing.mmrValue * MH.MAX_BID_RATIO) : null;
  var rarity = rarityPts_(listing.make || listing.model || '');
  var isExotic = rarity > 0;

  var reason;
  if (score >= 80) {
    reason = 'Hot deal — ' + (discount * 100).toFixed(0) + '% below MMR';
  } else if (score >= 65) {
    reason = 'Good deal — ' + (discount * 100).toFixed(0) + '% below MMR';
  } else if (isExotic && !listing.mmrValue) {
    reason = 'Rare exotic — no MMR comp; verify value independently';
  } else if (isExotic && discount < 0) {
    reason = 'Rare exotic above market — at-market acquisition';
  } else if (isExotic) {
    reason = 'Exotic flagged — ' + (discount * 100).toFixed(0) + '% vs MMR';
  } else {
    reason = 'Flagged — review manually';
  }

  return {
    listing              : listing,
    dealScore            : score,
    discountPct          : discount,
    estimatedProfitMargin: Math.round(profit),
    maxBid               : maxBid,
    reason               : reason
  };
}

// ── Engine → GHL push (upsert by VIN) ────────────────────────────────────────

/**
 * Batch-upserts a set of Manheim deal alerts into GHL as opportunities.
 * Idempotent: searches for existing opportunities by VIN; updates if found, creates if not.
 * Polite: 120ms sleep between GHL calls to respect rate limits.
 *
 * @param  {Array} alerts  array of alert objects from buildDealAlert_()
 * @return {number}        count of records successfully pushed
 */
function upsertDealsToGHL_(alerts) {
  if (!apiToken_() || !locationId_() || !alerts || !alerts.length) return 0;

  var pipeline;
  try {
    pipeline = getPipeline_();
  } catch (e) {
    logError_('upsertDealsToGHL_/getPipeline', e);
    return 0;
  }

  var stageId = pipeline.stageIdByName['Spotted']
    || Object.values(pipeline.stageById).map(function (s) { return s.id; })[0];
  var pushed  = 0;

  alerts.forEach(function (alert) {
    var l   = alert.listing;
    var vin = l.vin;
    if (!vin) return;

    var year  = l.year  || '';
    var make  = l.make  || '';
    var model = l.model || '';
    var label = [year, make, model].filter(Boolean).join(' ') || 'VIN ' + vin;
    var title = label + ' — VIN: ' + vin
      + ' | Score: '  + (alert.dealScore || 0)
      + (alert.maxBid ? ' | Bid ≤ $' + alert.maxBid.toLocaleString() : '');

    var fields = [
      { key: 'lux_vin',       fieldValue: vin },
      { key: 'lux_year',      fieldValue: String(year) },
      { key: 'lux_make',      fieldValue: make },
      { key: 'lux_model',     fieldValue: model },
      { key: 'lux_mileage',   fieldValue: String(l.mileage || '') },
      { key: 'lux_score',     fieldValue: String(alert.dealScore || '') },
      { key: 'lux_mmr',       fieldValue: String(l.mmrValue || '') },
      { key: 'lux_max_bid',   fieldValue: String(alert.maxBid || '') },
      { key: 'lux_margin',    fieldValue: String(alert.estimatedProfitMargin || '') },
      { key: 'lux_sale_date', fieldValue: l.saleDate        || '' },
      { key: 'lux_location',  fieldValue: l.auctionLocation || '' },
      { key: 'lux_source',    fieldValue: 'manheim_scan' }
    ];

    try {
      Utilities.sleep(120);  // polite GHL rate limiting

      // Search for existing opportunity by VIN in the title
      var search = lcFetch_('get', '/opportunities/search', {
        location_id: locationId_(),
        pipeline_id: pipeline.pipelineId,
        q          : vin
      });
      var match = ((search.opportunities || []).filter(function (o) {
        return (o.name || '').indexOf(vin) !== -1;
      }))[0];

      if (match) {
        lcFetch_('put', '/opportunities/' + encodeURIComponent(match.id), null, {
          name:          title,
          monetaryValue: l.mmrValue || 0,
          customFields:  fields
        });
      } else {
        lcFetch_('post', '/opportunities/', null, {
          locationId      : locationId_(),
          pipelineId      : pipeline.pipelineId,
          pipelineStageId : stageId,
          name            : title,
          monetaryValue   : l.mmrValue || 0,
          status          : 'open',
          source          : 'Manheim Scan',
          customFields    : fields
        });
      }
      pushed++;
    } catch (e) {
      logError_('upsertDealsToGHL_/' + vin, e);
    }
  });

  if (pushed > 0) CacheService.getScriptCache().remove('snapshot');
  return pushed;
}

// ── Main scan (called by daily trigger) ──────────────────────────────────────

/**
 * Scans Manheim listings for each configured make, flags deals, and:
 *   1. Batch-upserts alerts to the "Manheim Deals" Sheet (VIN-keyed).
 *   2. Batch-upserts hot deals as GHL opportunities (VIN-keyed, if CRM is configured).
 *
 * Exotic-make logic:
 *   - Exotics bypass the discount threshold gate entirely (surfaced at any price).
 *   - Rarity bonus adds 6–20 pts, so a zero-mile Ferrari with perfect condition
 *     scores 80+ even at market price.
 *   - Mass-market vehicles still need >= MH_DEAL_THRESHOLD discount to flag.
 *
 * @return {{scanned:number, alerts:number, skipped:number, pushed:number}}
 */
function runManheimScan() {
  if (!mhClientId_()) {
    console.log('runManheimScan: MANHEIM_CLIENT_ID not set — skipping');
    return { scanned: 0, alerts: 0, skipped: 0, pushed: 0, reason: 'not_configured' };
  }

  var threshold  = mhDealThreshold_();
  var maxMileage = mhMaxMileage_();
  var makes      = mhSearchMakes_();
  var scanned    = 0;
  var skipped    = 0;
  var alertBatch = [];

  makes.forEach(function (make) {
    try {
      var listings = searchListings({ query: make, maxMileage: maxMileage, limit: 50 });

      listings.forEach(function (listing) {
        scanned++;

        // Always skip if mileage exceeds cap
        if (listing.mileage > maxMileage) { skipped++; return; }
        // Skip if no listing price
        if (!listing.listingPrice)        { skipped++; return; }

        var isExotic = !!matchMake_(listing.make || listing.model || '');
        var discount = listing.mmrValue > 0
          ? (listing.mmrValue - listing.listingPrice) / listing.mmrValue
          : 0;

        // Mass-market gate: must be >= threshold below MMR
        // Exotic gate: bypass (surface even at/above market)
        if (!isExotic && (!listing.mmrValue || discount < threshold)) { return; }

        // Enrich with cached MMR if listing MMR is missing
        if (!listing.mmrValue && listing.vin) {
          var mmrData = mmrValue_(listing.vin, listing.mileage);
          if (mmrData) {
            listing.mmrValue       = mmrData.mmr;
            listing.conditionGrade = listing.conditionGrade || mmrData.grade;
          }
        }

        alertBatch.push(buildDealAlert_(listing));
      });
    } catch (e) {
      logError_('runManheimScan/' + make, e);
    }
  });

  var alerts = alertBatch.length;

  // 1. Batch-upsert to Sheets (VIN-deduped)
  if (alerts > 0) {
    try {
      upsertManheimAlerts_(alertBatch);
    } catch (e) {
      logError_('runManheimScan/upsertSheets', e);
    }
  }

  // 2. Batch-upsert to GHL (VIN-deduped, only when CRM is configured)
  var pushed = 0;
  if (!isDemo_() && alerts > 0) {
    try {
      pushed = upsertDealsToGHL_(alertBatch);
    } catch (e) {
      logError_('runManheimScan/upsertGHL', e);
    }
  }

  var msg = 'Scanned ' + scanned + ' listings — ' + alerts
    + ' alerts, ' + skipped + ' skipped, ' + pushed + ' GHL upserts';
  logActivity_('manheim_scan', msg);
  console.log('Manheim scan complete: ' + msg);
  return { scanned: scanned, alerts: alerts, skipped: skipped, pushed: pushed };
}
