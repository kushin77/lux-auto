/**
 * CRM backend client (server-side only).
 *
 * The browser never talks to the CRM — it calls google.script.run, which runs
 * here. The token stays in Script Properties. All vendor-specific JSON is mapped
 * into clean Lux objects before anything is returned to the client.
 */

var EXOTIC_MAKES = ['Ferrari','Lamborghini','Porsche','McLaren','Bentley','Rolls-Royce',
  'Maserati','Aston Martin','Bugatti','Mercedes-Benz','BMW','Audi','Lexus','Acura','Dodge'];

// ── Low-level fetch ─────────────────────────────────────────────────────────
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

  var resp = UrlFetchApp.fetch(url, opts);
  var code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Data source error (' + code + ')');
  }
  return JSON.parse(resp.getContentText() || '{}');
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
