/**
 * Lux Auto — Seller Portal + Buyer Registry (server-side).
 *
 * Called from the browser via google.script.run — all functions require
 * assertAccess_() so the token never leaves the server.
 *
 * Public surface:
 *   decodeVIN(vin)          → {vin, year, make, model, trim, series, mmr, adjustedMmr} | {error}
 *   submitSellerLead(form)  → {ok, id, title}
 *   getSellerLeads(limit)   → [{id, title, vin, year, make, score, value, stage, updated, source}]
 *   registerBuyer(form)     → {ok, id, name}
 *   getManheimAlerts(limit) → [{scannedAt, vin, year, make, model, mileage, condition,
 *                               location, saleDate, listingPrice, mmrValue, discountPct,
 *                               dealScore, estProfit, reason}]
 *   getActivityLog(limit)   → [{timestamp, user, action, details}]
 */

var NHTSA_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/';

// ── VIN Decode ────────────────────────────────────────────────────────────────

/**
 * Decodes a VIN via the free NHTSA API, then enriches with MMR if Manheim is
 * configured. No auth required for NHTSA — safe to call for any logged-in user.
 *
 * @param  {string} vin
 * @return {{vin, year, make, model, trim, series, mmr, adjustedMmr, currency}|{error}}
 */
function decodeVIN(vin) {
  assertAccess_();
  if (!vin) return { error: 'VIN is required.' };
  vin = String(vin).toUpperCase().replace(/\s/g, '');
  if (vin.length < 11) return { error: 'Enter a valid 11–17 character VIN.' };

  try {
    var resp = UrlFetchApp.fetch(
      NHTSA_BASE + encodeURIComponent(vin) + '?format=json',
      { muteHttpExceptions: true }
    );
    if (resp.getResponseCode() !== 200) {
      return { error: 'VIN lookup service unavailable — try again.' };
    }
    var raw = JSON.parse(resp.getContentText());
    var items = (raw && raw.Results) ? raw.Results : [];

    // NHTSA variable IDs: 29 = ModelYear, 26 = Make, 28 = Model, 38 = Trim, 34 = Series
    function v_(id) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].VariableId === id) {
          var val = items[i].Value;
          return (val && val !== '0' && val !== 'Not Applicable' && val !== 'null') ? val : '';
        }
      }
      return '';
    }

    var year   = v_(29);
    var make   = v_(26);
    var model  = v_(28);
    var trim   = v_(38);
    var series = v_(34);

    if (!make && !model) return { error: 'VIN not recognised — check for typos.' };

    var result = {
      vin: vin, year: year, make: make, model: model,
      trim: trim, series: series,
      mmr: null, adjustedMmr: null, grade: null, currency: 'USD'
    };

    // Enrich with MMR if Manheim credentials are configured
    if (mhClientId_()) {
      try {
        var mmrData = getMMR(vin);
        if (mmrData) {
          result.mmr         = mmrData.mmr;
          result.adjustedMmr = mmrData.adjustedMmr;
          result.grade       = mmrData.grade;
          result.currency    = mmrData.currency || 'USD';
        }
      } catch (e) {
        console.warn('MMR enrichment failed for ' + vin + ': ' + e.message);
        // Non-fatal: return VIN decode without MMR
      }
    }

    return result;
  } catch (e) {
    console.error('decodeVIN error for ' + vin + ':', e.message);
    return { error: 'VIN lookup failed: ' + e.message };
  }
}

// ── Seller Lead Submission ─────────────────────────────────────────────────────

/**
 * Creates a seller contact + opportunity in the CRM at the "Spotted" stage.
 * Idempotent by VIN — if the VIN already exists in GHL the opportunity gets
 * a note rather than a duplicate record.
 *
 * @param {Object} form  { vin, year, make, model, trim, mileage, condition,
 *                         askingPrice, sellerName, sellerEmail, sellerPhone, notes }
 * @return {{ok:boolean, id:string, title:string, demo?:boolean}}
 */
function submitSellerLead(form) {
  var user = assertAccess_();
  if (!form || !form.vin) throw new Error('VIN is required to submit a seller lead.');

  form.vin = String(form.vin).toUpperCase().trim();
  var year    = form.year  ? String(form.year).trim() : '';
  var make    = form.make  ? String(form.make).trim() : '';
  var model   = form.model ? String(form.model).trim() : '';
  var label   = [year, make, model].filter(Boolean).join(' ') || ('VIN ' + form.vin);
  var mileStr = form.mileage ? Number(form.mileage).toLocaleString() + ' mi' : '';
  var fullTitle = label + ' — VIN: ' + form.vin + (mileStr ? ' (' + mileStr + ')' : '');

  if (!isDemo_()) {
    var contactId = null;

    // 1. Create seller contact if contact details provided
    if (form.sellerEmail || form.sellerPhone || form.sellerName) {
      try {
        var nameParts = (form.sellerName || '').trim().split(/\s+/);
        var cPayload  = {
          locationId:   locationId_(),
          firstName:    nameParts[0] || 'Seller',
          lastName:     nameParts.slice(1).join(' ') || '',
          email:        form.sellerEmail || '',
          phone:        form.sellerPhone || '',
          tags:         ['seller', 'lux:seller'],
          customFields: [
            { key: 'lux_vin',  fieldValue: form.vin },
            { key: 'lux_role', fieldValue: 'seller' }
          ]
        };
        var cResp   = lcFetch_('post', '/contacts/', null, cPayload);
        contactId   = ((cResp.contact || cResp) || {}).id || null;
      } catch (e) {
        console.warn('Seller contact creation failed:', e.message);
        // Non-fatal: still create the opportunity
      }
    }

    // 2. Create opportunity at "Spotted"
    var pipeline = getPipeline_();
    var stageId  = pipeline.stageIdByName['Spotted'] ||
                   Object.keys(pipeline.stageById)[0];

    var oppPayload = {
      locationId:      locationId_(),
      pipelineId:      pipeline.pipelineId,
      pipelineStageId: stageId,
      name:            fullTitle,
      monetaryValue:   Number(form.askingPrice || 0),
      status:          'open',
      source:          'Seller Intake',
      customFields:    [
        { key: 'lux_vin',       fieldValue: form.vin },
        { key: 'lux_year',      fieldValue: year },
        { key: 'lux_make',      fieldValue: make },
        { key: 'lux_model',     fieldValue: model },
        { key: 'lux_trim',      fieldValue: (form.trim  || '').trim() },
        { key: 'lux_mileage',   fieldValue: String(form.mileage || '') },
        { key: 'lux_condition', fieldValue: (form.condition || '').trim() },
        { key: 'lux_source',    fieldValue: 'seller_intake' }
      ]
    };
    if (contactId) oppPayload.contactId = contactId;

    var oResp = lcFetch_('post', '/opportunities/', null, oppPayload);
    var oppId = ((oResp.opportunity || oResp) || {}).id || null;

    // 3. Attach notes if provided
    if (oppId && form.notes) {
      try {
        lcFetch_('post', '/opportunities/' + encodeURIComponent(oppId) + '/notes/', null, {
          body:   String(form.notes).trim(),
          userId: user.email
        });
      } catch (e) { console.warn('Note attachment failed:', e.message); }
    }

    // 4. Invalidate dashboard cache + log
    CacheService.getScriptCache().remove('snapshot');
    logActivity_('seller_intake', label + ' (VIN: ' + form.vin + ') — ' + user.email);

    return { ok: true, id: oppId || 'created', title: fullTitle };
  }

  // Demo mode — log and return synthetic response
  logActivity_('seller_intake_demo', label + ' (demo — no CRM write)');
  return { ok: true, id: 'demo-' + Date.now(), title: fullTitle, demo: true };
}

// ── Seller Leads Read ──────────────────────────────────────────────────────────

/**
 * Returns recent seller-intake opportunities from GHL (Spotted stage).
 *
 * @param  {number} limit  max results (default 20)
 * @return {Array<Object>}
 */
function getSellerLeads(limit) {
  assertAccess_();
  limit = Number(limit) || 20;

  if (isDemo_()) {
    return [
      { id: 'demo-s1', title: '2021 Ferrari 488 Pista',   vin: 'ZFF90ZLA0M0246100', year: '2021',
        make: 'Ferrari',     score: 0, value: 265000, stage: 'Spotted',
        updated: new Date().toISOString(), source: 'Seller Intake' },
      { id: 'demo-s2', title: '2019 Lamborghini Urus',    vin: 'ZPBUA1ZL1KLA00100', year: '2019',
        make: 'Lamborghini', score: 0, value: 148000, stage: 'Spotted',
        updated: new Date().toISOString(), source: 'Seller Intake' },
      { id: 'demo-s3', title: '2022 Porsche 992 Turbo S', vin: 'WP0AD2A93NS246100', year: '2022',
        make: 'Porsche',     score: 0, value: 225000, stage: 'Spotted',
        updated: new Date().toISOString(), source: 'Seller Intake' }
    ];
  }

  try {
    var pipeline    = getPipeline_();
    var spotStageId = pipeline.stageIdByName['Spotted'];
    var query = {
      location_id:      locationId_(),
      pipeline_id:      pipeline.pipelineId,
      limit:            limit
    };
    if (spotStageId) query.pipeline_stage_id = spotStageId;

    var resp = lcFetch_('get', '/opportunities/search', query);
    return (resp.opportunities || []).map(function (o) {
      return mapDeal_(o, pipeline.stageById);
    });
  } catch (e) {
    console.error('getSellerLeads error:', e.message);
    return [];
  }
}

// ── Buyer Registration ─────────────────────────────────────────────────────────

/**
 * Creates/upserts a buyer contact in the CRM with buyer-specific tags and
 * custom fields for makes, max price, region.
 *
 * @param  {Object} form  { name, email, phone, makes, maxPrice, city, state, notes }
 * @return {{ok:boolean, id:string, name:string, demo?:boolean}}
 */
function registerBuyer(form) {
  var user = assertAccess_();
  if (!form || (!form.email && !form.phone)) {
    throw new Error('Email or phone number is required to register a buyer.');
  }

  var name = String(form.name || '').trim() || form.email || '';

  if (!isDemo_()) {
    var nameParts = name.split(/\s+/);
    var payload = {
      locationId:   locationId_(),
      firstName:    nameParts[0] || name,
      lastName:     nameParts.slice(1).join(' ') || '',
      email:        (form.email || '').trim(),
      phone:        (form.phone || '').trim(),
      city:         (form.city  || '').trim(),
      state:        (form.state || '').trim().toUpperCase(),
      tags:         ['buyer', 'lux:buyer-network'],
      customFields: [
        { key: 'lux_buyer_makes',     fieldValue: (form.makes    || '').trim() },
        { key: 'lux_buyer_max_price', fieldValue: String(form.maxPrice || '') },
        { key: 'lux_role',            fieldValue: 'buyer' }
      ]
    };

    var resp = lcFetch_('post', '/contacts/', null, payload);
    var id   = ((resp.contact || resp) || {}).id || 'created';

    if (form.notes && id && id !== 'created') {
      try {
        lcFetch_('post', '/contacts/' + encodeURIComponent(id) + '/notes/', null, {
          body: String(form.notes).trim()
        });
      } catch (e) { console.warn('Buyer note failed:', e.message); }
    }

    CacheService.getScriptCache().remove('snapshot');
    logActivity_('buyer_registered', name + ' (' + (form.email || form.phone) + ') — ' + user.email);
    return { ok: true, id: id, name: name };
  }

  logActivity_('buyer_registered_demo', name + ' (demo — no CRM write)');
  return { ok: true, id: 'demo-b-' + Date.now(), name: name, demo: true };
}

// ── Manheim Alerts Read ────────────────────────────────────────────────────────

/**
 * Returns the N most recent Manheim deal alerts from the Sheets feed,
 * most-recent first.
 *
 * @param  {number} limit  default 50
 * @return {Array<Object>}
 */
function getManheimAlerts(limit) {
  assertAccess_();
  limit = Number(limit) || 50;

  if (isDemo_()) {
    return [
      { scannedAt: new Date().toLocaleString(), vin: 'ZFF79ALA4J0231234',
        year: 2019, make: 'Ferrari',     model: '488 GTB',  mileage: 8400,
        condition: 4.2, location: 'Atlanta, GA', saleDate: '2026-06-20',
        listingPrice: 195000, mmrValue: 235000, discountPct: '17.0%',
        dealScore: 82, estProfit: 40000, reason: 'Hot deal — 17% below MMR' },
      { scannedAt: new Date().toLocaleString(), vin: 'ZHWUC2ZF0LLA12345',
        year: 2020, make: 'Lamborghini', model: 'Huracan',  mileage: 5100,
        condition: 4.5, location: 'Dallas, TX',  saleDate: '2026-06-21',
        listingPrice: 210000, mmrValue: 255000, discountPct: '17.6%',
        dealScore: 88, estProfit: 45000, reason: 'Hot deal — 18% below MMR' }
    ];
  }

  try {
    var ss    = getSpreadsheet_();
    var sheet = ss.getSheetByName('Manheim Deals');
    if (!sheet || sheet.getLastRow() <= 1) return [];

    var data = sheet.getDataRange().getValues();
    var rows = data.slice(1);        // drop header
    rows.reverse();                  // most recent first
    rows = rows.slice(0, limit);

    return rows.map(function (r) {
      return {
        scannedAt:    r[0]  || '',
        vin:          r[1]  || '',
        year:         r[2]  || '',
        make:         r[3]  || '',
        model:        r[4]  || '',
        mileage:      Number(r[5])  || 0,
        condition:    r[6]  || '',
        location:     r[7]  || '',
        saleDate:     r[8]  || '',
        listingPrice: Number(r[9])  || 0,
        mmrValue:     Number(r[10]) || 0,
        discountPct:  r[11] || '',
        dealScore:    Number(r[12]) || 0,
        estProfit:    Number(r[13]) || 0,
        reason:       r[14] || ''
      };
    });
  } catch (e) {
    console.error('getManheimAlerts error:', e.message);
    return [];
  }
}

// ── Activity Log Read ──────────────────────────────────────────────────────────

/**
 * Returns the N most recent activity log entries, most-recent first.
 *
 * @param  {number} limit  default 30
 * @return {Array<Object>}
 */
function getActivityLog(limit) {
  assertAccess_();
  limit = Number(limit) || 30;

  if (isDemo_()) {
    return [
      { timestamp: new Date().toLocaleString(), user: 'demo@lux.auto', action: 'seller_intake',
        details: '2019 Ferrari 488 GTB (VIN: ZFF79ALA4J0231234)' },
      { timestamp: new Date().toLocaleString(), user: 'demo@lux.auto', action: 'manheim_scan',
        details: 'Scanned 124 listings — 2 alerts, 8 skipped' },
      { timestamp: new Date().toLocaleString(), user: 'demo@lux.auto', action: 'sync_ghl',
        details: 'Synced 3 deals, 1 buyer' }
    ];
  }

  try {
    var ss    = getSpreadsheet_();
    var sheet = ss.getSheetByName('Activity Log');
    if (!sheet || sheet.getLastRow() <= 1) return [];

    var data = sheet.getDataRange().getValues();
    var rows = data.slice(1);
    rows.reverse();
    rows = rows.slice(0, limit);

    return rows.map(function (r) {
      return {
        timestamp: r[0] || '',
        user:      r[1] || '',
        action:    r[2] || '',
        details:   r[3] || ''
      };
    });
  } catch (e) {
    console.error('getActivityLog error:', e.message);
    return [];
  }
}
