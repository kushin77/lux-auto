/**
 * CRM backend client (server-side only).
 *
 * The browser never talks to the CRM — it calls google.script.run, which runs
 * here. The token stays in Script Properties. All vendor-specific JSON is mapped
 * into clean Lux objects before anything is returned to the client.
 *
 * Engine→CRM sync (CLAUDE.md §3): opportunities are upserted BY VIN and the
 * VIN→opportunityId map is kept in the "VIN Index" sheet so updates are O(1)
 * and idempotent. Heavy logic stays here, not in CRM workflows.
 */

var EXOTIC_MAKES = ['Ferrari','Lamborghini','Porsche','McLaren','Bentley','Rolls-Royce',
  'Maserati','Aston Martin','Bugatti','Mercedes-Benz','BMW','Audi','Lexus','Acura','Dodge'];

// Opportunity (deal) custom-field schema — created via the v2 API (idempotent).
var LUX_DEAL_FIELDS = [
  { name: 'VIN',              fieldKey: 'lux_vin',          dataType: 'TEXT' },
  { name: 'Year',            fieldKey: 'lux_year',         dataType: 'NUMERICAL' },
  { name: 'Make',            fieldKey: 'lux_make',         dataType: 'TEXT' },
  { name: 'Model',           fieldKey: 'lux_model',        dataType: 'TEXT' },
  { name: 'Mileage',         fieldKey: 'lux_mileage',      dataType: 'NUMERICAL' },
  { name: 'MMR Value',       fieldKey: 'lux_mmr',          dataType: 'MONETARY' },
  { name: 'Deal Score',      fieldKey: 'lux_score',        dataType: 'NUMERICAL' },
  { name: 'Max Bid',         fieldKey: 'lux_max_bid',      dataType: 'MONETARY' },
  { name: 'Estimated Margin', fieldKey: 'lux_margin',      dataType: 'MONETARY' },
  { name: 'Auction Date',    fieldKey: 'lux_auction_date', dataType: 'DATE' },
  { name: 'Lane',            fieldKey: 'lux_lane',         dataType: 'TEXT' },
  { name: 'Drive Vault URL', fieldKey: 'lux_vault_url',    dataType: 'TEXT' }
];

// ── Low-level fetch (429 / 5xx backoff) ──────────────────────────────────────
function lcFetch_(method, path, query, payload) {
  var url = APP.API_BASE + path;
  var qs = Object.keys(query || {})
    .filter(function (k) { return query[k] !== undefined && query[k] !== null && query[k] !== ''; })
    .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(query[k]); })
    .join('&');
  if (qs) url += (path.indexOf('?') === -1 ? '?' : '&') + qs;

  var opts = {
    method: method,
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + apiToken_(),
      Version: APP.API_VERSION,
      Accept: 'application/json'
    }
  };
  if (payload) { opts.contentType = 'application/json'; opts.payload = JSON.stringify(payload); }

  var maxAttempts = APP.MAX_FETCH_RETRIES || 4;
  var attempt = 0;
  while (true) {
    attempt++;
    var resp = UrlFetchApp.fetch(url, opts);
    var code = resp.getResponseCode();
    if ((code === 429 || code >= 500) && attempt < maxAttempts) {
      Utilities.sleep(backoffMs_(attempt));
      continue;
    }
    if (code < 200 || code >= 300) {
      throw new Error('Data source error (' + code + ')');
    }
    return JSON.parse(resp.getContentText() || '{}');
  }
}

// ── Pipeline + stage mapping ────────────────────────────────────────────────
function getPipeline_() {
  var data = lcFetch_('get', '/opportunities/pipelines', { locationId: locationId_() });
  var pipelines = data.pipelines || [];
  var p = pipelines.filter(function (x) { return /lux auto/i.test(x.name || ''); })[0] || pipelines[0];
  if (!p) throw new Error('No pipeline configured');
  var stageById = {}, stageIdByName = {};
  (p.stages || []).forEach(function (s) {
    stageById[s.id] = { id: s.id, name: s.name };
    stageIdByName[s.name] = s.id;
  });
  return { pipelineId: p.id, stageById: stageById, stageIdByName: stageIdByName };
}

// ── Mappers (vendor JSON → clean Lux objects) ───────────────────────────────
function cf_(o, needle) {
  var arr = o.customFields || o.customField || [];
  for (var i = 0; i < arr.length; i++) {
    var f = arr[i];
    var key = (f.key || f.fieldKey || f.id || '').toLowerCase();
    if (key.indexOf(needle) !== -1) return f.fieldValue || f.value || '';
  }
  return '';
}

function matchMake_(name) {
  for (var i = 0; i < EXOTIC_MAKES.length; i++) {
    if (new RegExp(EXOTIC_MAKES[i].replace(/[-]/g, '.?'), 'i').test(name)) return EXOTIC_MAKES[i];
  }
  return '';
}

function mapDeal_(o, stageById) {
  var name = o.name || '';
  var vin = (name.match(/VIN\s*[:#]?\s*([A-HJ-NPR-Z0-9]{6,17})/i) || [])[1] || cf_(o, 'vin') || '';
  var score = parseInt((name.match(/score\s*[:#]?\s*(\d{1,3})/i) || [])[1] || cf_(o, 'score') || 0, 10);
  var year = parseInt((name.match(/\b(20\d{2}|19\d{2})\b/) || [])[0] || 0, 10);
  var value = Number(o.monetaryValue || cf_(o, 'mmr') || 0);
  var stage = (stageById[o.pipelineStageId] || {}).name || '—';
  var title = (name.split('—')[0] || name).trim();
  return {
    id: o.id, title: title || name, fullName: name, vin: vin, year: year || null,
    make: matchMake_(name) || cf_(o, 'make') || '', score: score || 0, value: value,
    stage: stage, status: o.status || 'open', source: o.source || '',
    updated: o.updatedAt || o.dateUpdated || ''
  };
}

function mapBuyer_(c) {
  var name = (c.contactName || ((c.firstName || '') + ' ' + (c.lastName || ''))).trim();
  return {
    id: c.id, name: name || (c.email || 'Unknown'),
    email: c.email || '', phone: c.phone || '',
    makes: cf_(c, 'make') || '', maxPrice: Number(cf_(c, 'max_price') || 0),
    city: c.city || '', state: c.state || ''
  };
}

// ── Live data ───────────────────────────────────────────────────────────────
function liveSnapshot_() {
  try {
    var pipeline = getPipeline_();
    var oppData = lcFetch_('get', '/opportunities/search', {
      location_id: locationId_(), pipeline_id: pipeline.pipelineId, limit: 100
    });
    var deals = (oppData.opportunities || []).map(function (o) { return mapDeal_(o, pipeline.stageById); });

    var conData = lcFetch_('get', '/contacts/', { locationId: locationId_(), limit: 100 });
    var buyers = (conData.contacts || []).map(mapBuyer_);

    return { deals: deals, buyers: buyers, metrics: buildMetrics_(deals), stages: APP.STAGE_ORDER, demo: false };
  } catch (err) {
    return { deals: [], buyers: [], metrics: buildMetrics_([]), stages: APP.STAGE_ORDER, demo: false, error: String(err.message || err) };
  }
}

function buildMetrics_(deals) {
  var hot = 0, total = 0, top = 0, byStage = {};
  APP.STAGE_ORDER.forEach(function (s) { byStage[s] = 0; });
  deals.forEach(function (d) {
    total += d.value || 0;
    if (d.score >= APP.HOT_SCORE) hot++;
    if (d.score > top) top = d.score;
    if (byStage[d.stage] === undefined) byStage[d.stage] = 0;
    byStage[d.stage]++;
  });
  return { activeDeals: deals.length, hotDeals: hot, pipelineValue: total, topScore: top, byStage: byStage };
}

// ── Public (called from the client via google.script.run) ───────────────────
function getDashboardData(force) {
  var user = assertAccess_();
  var cache = CacheService.getScriptCache();
  if (!force) {
    var cached = cache.get('snapshot');
    if (cached) { var d = JSON.parse(cached); d.user = user; d.cached = true; return d; }
  }
  var snap = isDemo_() ? demoSnapshot_() : liveSnapshot_();
  snap.user = user;
  snap.generatedAt = new Date().toISOString();
  cache.put('snapshot', JSON.stringify(snap), APP.CACHE_SECONDS);
  return snap;
}

/** Admin action: move a deal to another stage. */
function moveDeal(id, toStage) {
  var user = assertAdmin_();
  if (isDemo_()) return { ok: false, demo: true };
  var pipeline = getPipeline_();
  var stageId = pipeline.stageIdByName[toStage];
  if (!stageId) throw new Error('Unknown stage: ' + toStage);
  lcFetch_('put', '/opportunities/' + encodeURIComponent(id), null, {
    pipelineId: pipeline.pipelineId, pipelineStageId: stageId
  });
  CacheService.getScriptCache().remove('snapshot');
  return { ok: true, by: user.email, stage: toStage };
}

// ── Engine → GHL: custom-field schema (idempotent) ───────────────────────────

/**
 * Creates the Lux Deal custom-field schema via the v2 API. Idempotent — skips
 * fields that already exist. Safe to run repeatedly. No-op in demo mode.
 * @return {{ok:boolean, created:Array}}
 */
function setupGHLCustomFields_() {
  if (isDemo_()) return { ok: false, demo: true };

  var existing = {};
  try {
    var data = lcFetch_('get', '/locations/' + encodeURIComponent(locationId_()) + '/customFields', {});
    (data.customFields || []).forEach(function (f) {
      existing[(f.fieldKey || f.key || '').toLowerCase()] = true;
    });
  } catch (e) {
    logError_('setupGHLCustomFields_ list', e);
  }

  var created = [];
  LUX_DEAL_FIELDS.forEach(function (f) {
    var k1 = f.fieldKey.toLowerCase();
    var k2 = ('opportunity.' + f.fieldKey).toLowerCase();
    if (existing[k1] || existing[k2]) return;
    try {
      lcFetch_('post', '/locations/' + encodeURIComponent(locationId_()) + '/customFields', null, {
        name: f.name, dataType: f.dataType, fieldKey: f.fieldKey, model: 'opportunity'
      });
      created.push(f.fieldKey);
    } catch (e) {
      logError_('createField ' + f.fieldKey, e);
    }
  });

  logActivity_('setup_ghl_fields', 'Created: ' + (created.join(', ') || 'none (all present)'));
  return { ok: true, created: created };
}

// ── Engine → GHL: VIN index (VIN → opportunityId) ────────────────────────────

function getVinIndex_() {
  var ss = getSpreadsheet_();
  var sheet = getOrCreateSheet_(ss, 'VIN Index', ['VIN', 'Opportunity ID', 'Updated']);
  var map = {};
  var last = sheet.getLastRow();
  if (last > 1) {
    var vals = sheet.getRange(2, 1, last - 1, 2).getValues();
    for (var i = 0; i < vals.length; i++) {
      var v = (vals[i][0] || '').toString();
      if (v) map[v] = { row: i + 2, id: (vals[i][1] || '').toString() };
    }
  }
  return { sheet: sheet, map: map };
}

function setVinIndex_(idx, vin, oppId) {
  if (idx.map[vin] && idx.map[vin].row) {
    idx.sheet.getRange(idx.map[vin].row, 2, 1, 2).setValues([[oppId, new Date().toLocaleString()]]);
    idx.map[vin].id = oppId;
  } else {
    idx.sheet.appendRow([vin, oppId, new Date().toLocaleString()]);
    idx.map[vin] = { row: idx.sheet.getLastRow(), id: oppId };
  }
}

// ── Engine → GHL: upsert opportunities by VIN ────────────────────────────────

/**
 * Upserts scanned deal alerts into GHL as opportunities, keyed by VIN.
 * New VINs are created in "Spotted"; known VINs are updated in place. Idempotent.
 * No-op in demo mode. Each failure is logged and does not abort the batch.
 *
 * @param  {Array} alerts — deal alert objects from buildDealAlert_()
 * @return {{ok:boolean, inserted:number, updated:number}}
 */
function upsertDealsToGHL_(alerts) {
  if (isDemo_()) return { ok: false, demo: true };
  if (!alerts || !alerts.length) return { ok: true, inserted: 0, updated: 0 };

  var pipeline = getPipeline_();
  var spottedStageId = pipeline.stageIdByName['Spotted'] || '';
  var idx = getVinIndex_();
  var inserted = 0, updated = 0;

  alerts.forEach(function (a) {
    var v = a.listing;
    var vin = (v && v.vin) ? v.vin.toString() : '';
    if (!vin) return;

    var title = [v.year, v.make, v.model].filter(function (x) { return x; }).join(' ') +
                ' — VIN ' + vin + ' — score ' + a.dealScore;
    // Use `fieldValue` to match SellerPortal.gs / cf_() reader convention.
    var customFields = [
      { key: 'lux_vin',     fieldValue: vin },
      { key: 'lux_year',    fieldValue: v.year || '' },
      { key: 'lux_make',    fieldValue: v.make || '' },
      { key: 'lux_model',   fieldValue: v.model || '' },
      { key: 'lux_mileage', fieldValue: v.mileage || 0 },
      { key: 'lux_mmr',     fieldValue: v.mmrValue || 0 },
      { key: 'lux_score',   fieldValue: a.dealScore || 0 },
      { key: 'lux_max_bid', fieldValue: a.maxBid || 0 },
      { key: 'lux_margin',  fieldValue: a.estimatedProfitMargin || 0 },
      { key: 'lux_lane',    fieldValue: v.lane || '' }
    ];
    var body = {
      pipelineId: pipeline.pipelineId,
      locationId: locationId_(),
      name: title,
      monetaryValue: v.mmrValue || 0,
      customFields: customFields
    };

    try {
      var existingId = idx.map[vin] && idx.map[vin].id;
      if (existingId) {
        lcFetch_('put', '/opportunities/' + encodeURIComponent(existingId), null, body);
        updated++;
      } else {
        if (spottedStageId) body.pipelineStageId = spottedStageId;
        var res = lcFetch_('post', '/opportunities/', null, body);
        var newId = (res.opportunity && res.opportunity.id) || res.id || '';
        if (newId) setVinIndex_(idx, vin, newId);
        inserted++;
      }
    } catch (e) {
      logError_('upsertDealsToGHL_ vin=' + vin, e);
    }
  });

  logActivity_('push_ghl', 'GHL upsert — ' + inserted + ' new, ' + updated + ' updated');
  return { ok: true, inserted: inserted, updated: updated };
}

// ── Demo data (used until LC_API_TOKEN / LC_LOCATION_ID are set) ─────────────
function demoSnapshot_() {
  var deals = [
    { id: 'demo-1', title: '2019 Ferrari 488 GTB', fullName: '2019 Ferrari 488 GTB', vin: 'ZFF79ALA4J0231234', year: 2019, make: 'Ferrari', score: 82, value: 235000, stage: 'Spotted', status: 'open', source: 'Manheim', updated: '' },
    { id: 'demo-2', title: '2020 Lamborghini Huracan', fullName: '2020 Lamborghini Huracan', vin: 'ZHWUC2ZF0LLA12345', year: 2020, make: 'Lamborghini', score: 88, value: 255000, stage: 'Watching', status: 'open', source: 'Manheim', updated: '' },
    { id: 'demo-3', title: '2021 Porsche 911 Turbo S', fullName: '2021 Porsche 911 Turbo S', vin: 'WP0AD2A99MS123456', year: 2021, make: 'Porsche', score: 64, value: 120000, stage: 'Recon', status: 'open', source: 'Manheim', updated: '' }
  ];
  var buyers = [
    { id: 'b-1', name: 'Jane Collector', email: 'jane@buyer.com', phone: '', makes: 'Ferrari, Lamborghini', maxPrice: 300000, city: 'Miami', state: 'FL' }
  ];
  return { deals: deals, buyers: buyers, metrics: buildMetrics_(deals), stages: APP.STAGE_ORDER, demo: true };
}
