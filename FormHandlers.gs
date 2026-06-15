// ============================================================
// LUX AUTO — Form Response Handlers
// Google Apps Script  |  Automatically routes Google Form
// submissions into the correct sheet tabs and (optionally)
// triggers the buyer-matching pipeline for new buyers.
//
// Setup:
//   1. Run createAllForms() from CreateForms.gs first.
//   2. Run installFormTriggers() once — this registers
//      onFormSubmit listeners for all four forms.
//   3. Responses will auto-populate the sheet tabs below.
// ============================================================

// ── Sheet Names ───────────────────────────────────────────────────────────────

const PORTAL_SHEETS = {
  SELLERS  : 'Sellers',
  DEALERS  : 'Dealers',
  TRADE_INS: 'Trade-Ins',
  // Buyer responses go into the existing CFG.SHEET_BUYERS ('Buyers') tab.
};

// ── Install / Remove Triggers ─────────────────────────────────────────────────

/**
 * Run once after createAllForms().
 * Reads form URLs from the "Portal Form Links" sheet and installs
 * an onFormSubmit trigger for each form.
 */
function installFormTriggers() {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const linksSheet = ss.getSheetByName('Portal Form Links');

  if (!linksSheet) {
    SpreadsheetApp.getUi().alert(
      '⚠️  "Portal Form Links" tab not found.\n' +
      'Run "📋 Create Portal Forms" first, then try again.'
    );
    return;
  }

  // Column B (index 1) = Published URL, but we need the form ID extracted
  // from the edit URL in column C (index 2) — edit URLs contain the form ID.
  const data = linksSheet.getRange(2, 1, 4, 3).getValues(); // rows 2-5, cols A-C

  // Remove any previously installed form triggers to avoid duplicates
  _removeFormTriggers();

  const handlerMap = {
    '🚗 Car Buyer Intake'           : 'onBuyerFormSubmit',
    '🏷️ Car Seller Intake'          : 'onSellerFormSubmit',
    '🏢 Dealer Onboarding'          : 'onDealerFormSubmit',
    '🔄 Trade-In Evaluation'        : 'onTradeInFormSubmit',
  };

  let count = 0;
  data.forEach(([name, , editUrl]) => {
    if (!editUrl) return;
    const formId   = _extractFormId(editUrl);
    const handler  = handlerMap[name];
    if (!formId || !handler) return;

    const form = FormApp.openById(formId);
    ScriptApp.newTrigger(handler)
             .forForm(form)
             .onFormSubmit()
             .create();
    count++;
    Logger.log(`Trigger installed: ${handler} → ${name}`);
  });

  // Ensure intake sheet tabs exist
  _ensurePortalSheets(ss);

  SpreadsheetApp.getUi().alert(
    `✅ ${count} form trigger(s) installed!\n\n` +
    'New submissions will now automatically populate:\n' +
    '• Buyers tab  (buyer intake)\n' +
    '• Sellers tab (seller intake)\n' +
    '• Dealers tab (dealer onboarding)\n' +
    '• Trade-Ins tab (trade-in requests)'
  );
}

/**
 * Removes all form-submit triggers created by this script.
 * Safe to call multiple times.
 */
function removeFormTriggers() {
  _removeFormTriggers();
  SpreadsheetApp.getUi().alert('🗑 All portal form triggers removed.');
}

function _removeFormTriggers() {
  const handlers = new Set([
    'onBuyerFormSubmit', 'onSellerFormSubmit',
    'onDealerFormSubmit', 'onTradeInFormSubmit'
  ]);
  ScriptApp.getProjectTriggers()
    .filter(t => handlers.has(t.getHandlerFunction()))
    .forEach(t => ScriptApp.deleteTrigger(t));
}

function _extractFormId(editUrl) {
  // Edit URLs: https://docs.google.com/forms/d/<ID>/edit
  const m = editUrl.match(/\/forms\/d\/([a-zA-Z0-9_-]+)\//);
  return m ? m[1] : null;
}


// ── Ensure Portal Sheet Tabs Exist ────────────────────────────────────────────

function _ensurePortalSheets(ss) {
  _ensureSheet(ss, PORTAL_SHEETS.SELLERS, [
    'Submitted At', 'Name', 'Email', 'Phone', 'State',
    'VIN', 'Year', 'Make', 'Model', 'Trim', 'Mileage', 'Condition',
    'Asking Price ($)', 'Title Status', 'Loan Balance ($)',
    'Accidents', 'Known Issues', 'Has Carfax?', 'Notes', 'Status'
  ], '#e67e22');

  _ensureSheet(ss, PORTAL_SHEETS.DEALERS, [
    'Submitted At', 'Dealership Name', 'License #', 'Address', 'City', 'State', 'ZIP',
    'Website', 'Contact Name', 'Title/Role', 'Email', 'Phone',
    'Inventory Types', 'Specializes In', 'Monthly Volume',
    'Manheim Active?', 'Manheim Dealer #', 'Interested In', 'About', 'Status'
  ], '#8e44ad');

  _ensureSheet(ss, PORTAL_SHEETS.TRADE_INS, [
    'Submitted At', 'Name', 'Email', 'Phone', 'State',
    'VIN', 'Year', 'Make', 'Model', 'Trim', 'Mileage', 'Condition',
    'Has Loan?', 'Loan Balance ($)', 'Lender',
    'Purchasing via Lux?', 'Replacement Makes', 'Replacement Model(s)',
    'Replacement Budget ($)', 'Timeline', 'Known Issues', 'Notes', 'Status'
  ], '#16a085');
}

// Reuse the helper already defined in Code.gs
// (Both files share the same Apps Script project namespace.)


// ── 1. Buyer Form Handler ─────────────────────────────────────────────────────

/**
 * Fires when someone submits the Car Buyer Intake form.
 * Appends a row to the existing 'Buyers' sheet (CFG.SHEET_BUYERS)
 * in the format expected by matchDealsToBuyers().
 */
function onBuyerFormSubmit(e) {
  try {
    const r = _parseResponses(e.response.getItemResponses());

    const makes  = _join(r['Preferred Makes (select all that apply)']);
    const models = r['Preferred Models'] || '';
    const price  = _num(r['Maximum Budget ($)']);
    const miles  = _num(r['Maximum Acceptable Mileage']);
    const state  = r['State / Location'] || '';
    const name   = r['Full Name'] || '';
    const email  = r['Email Address'] || '';
    const phone  = r['Phone Number'] || '';
    const notes  = [
      r['Do you require financing?'],
      r['How soon are you looking to buy?'],
      r['Any specific features or requirements?'],
      r['Additional Notes']
    ].filter(Boolean).join(' | ');

    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CFG.SHEET_BUYERS);
    if (!sheet) return;

    // Match Buyers sheet columns:
    // Name | Email | Phone | Makes | Models | Max Price | Max Mileage | State | Active | Last Contacted | Deals Sent | Notes
    sheet.appendRow([
      name, email, phone, makes, models,
      price, miles, state, 'Y',
      '', 0, notes
    ]);

    Logger.log(`Buyer added: ${name} <${email}>`);

    // Alert admin
    sendAdminAlert('Buyer', {
      'Name': name, 'Email': email, 'Phone': phone, 'State': state,
      'Preferred Makes': makes, 'Preferred Models': models,
      'Max Budget': '$' + price, 'Max Mileage': miles,
      'Financing?': r['Do you require financing?'],
      'Timeline': r['How soon are you looking to buy?'],
      'Notes': notes,
    });

    // Optionally kick off a pipeline run immediately for this new buyer
    // Uncomment to auto-match on every new buyer signup:
    // matchDealsTooBuyers();

  } catch (err) {
    Logger.log('onBuyerFormSubmit error: ' + err.message);
  }
}


// ── 2. Seller Form Handler ────────────────────────────────────────────────────

function onSellerFormSubmit(e) {
  try {
    const r    = _parseResponses(e.response.getItemResponses());
    const ss   = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(PORTAL_SHEETS.SELLERS);
    if (!sheet) { _ensurePortalSheets(ss); }

    const issues = _join(r['Known Issues (select all that apply)']);

    ss.getSheetByName(PORTAL_SHEETS.SELLERS).appendRow([
      new Date(),
      r['Full Name']                    || '',
      r['Email Address']                || '',
      r['Phone Number']                 || '',
      r['State / Location']             || '',
      r['VIN (Vehicle Identification Number)'] || '',
      r['Year']                         || '',
      r['Make']                         || '',
      r['Model']                        || '',
      r['Trim Level']                   || '',
      _num(r['Current Mileage']),
      r['Overall Condition']            || '',
      _num(r['Your Asking Price ($)']),
      r['Do you have the title in hand?'] || '',
      _num(r['Outstanding Loan Balance ($)']),
      r['Has the vehicle been in any accidents?'] || '',
      issues,
      r['Do you have a Carfax or AutoCheck report?'] || '',
      r['Additional Notes or Modifications'] || '',
      'New',  // Status column — update manually or via pipeline
    ]);

    Logger.log(`Seller submitted: ${r['Full Name']} — ${r['Year']} ${r['Make']} ${r['Model']}`);

    // Alert admin
    sendAdminAlert('Seller', {
      'Name'        : r['Full Name'],
      'Email'       : r['Email Address'],
      'Phone'       : r['Phone Number'],
      'State'       : r['State / Location'],
      'VIN'         : r['VIN (Vehicle Identification Number)'],
      'Vehicle'     : `${r['Year']} ${r['Make']} ${r['Model']} ${r['Trim Level'] || ''}`.trim(),
      'Mileage'     : r['Current Mileage'],
      'Condition'   : r['Overall Condition'],
      'Asking Price': '$' + _num(r['Your Asking Price ($)']),
      'Title Status': r['Do you have the title in hand?'],
      'Accidents'   : r['Has the vehicle been in any accidents?'],
    });

    // Auto-score against Manheim MMR
    scoreSeller({
      vin         : r['VIN (Vehicle Identification Number)'],
      year        : parseInt(r['Year'])          || 2020,
      make        : r['Make'],
      model       : r['Model'],
      trim        : r['Trim Level']              || '',
      mileage     : _num(r['Current Mileage']),
      askingPrice : _num(r['Your Asking Price ($)']),
      name        : r['Full Name'],
      email       : r['Email Address'],
    });

  } catch (err) {
    Logger.log('onSellerFormSubmit error: ' + err.message);
  }
}


// ── 3. Dealer Form Handler ────────────────────────────────────────────────────

function onDealerFormSubmit(e) {
  try {
    const r  = _parseResponses(e.response.getItemResponses());
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const inventoryTypes = _join(r['Inventory Types (select all that apply)']);
    const specializes    = _join(r['Makes You Specialize In']);
    const interests      = _join(r['What are you most interested in? (select all)']);

    ss.getSheetByName(PORTAL_SHEETS.DEALERS).appendRow([
      new Date(),
      r['Dealership Name']          || '',
      r['Dealer License Number']    || '',
      r['Street Address']           || '',
      r['City']                     || '',
      r['State']                    || '',
      r['ZIP Code']                 || '',
      r['Dealership Website']       || '',
      r['Contact Name']             || '',
      r['Title / Role']             || '',
      r['Email Address']            || '',
      r['Direct Phone Number']      || '',
      inventoryTypes,
      specializes,
      r['Average Monthly Retail Volume']                  || '',
      r['Are you currently active at Manheim auctions?']  || '',
      r['Manheim Dealer Number (if applicable)']          || '',
      interests,
      r["Tell us about your dealership and what you're looking to achieve"] || '',
      'New',
    ]);

    Logger.log(`Dealer submitted: ${r['Dealership Name']}`);

    sendAdminAlert('Dealer', {
      'Dealership'    : r['Dealership Name'],
      'License #'     : r['Dealer License Number'],
      'Location'      : `${r['City']}, ${r['State']} ${r['ZIP Code']}`,
      'Contact'       : `${r['Contact Name']} (${r['Title / Role'] || 'N/A'})`,
      'Email'         : r['Email Address'],
      'Phone'         : r['Direct Phone Number'],
      'Monthly Volume': r['Average Monthly Retail Volume'],
      'Manheim Active': r['Are you currently active at Manheim auctions?'],
      'Interests'     : inventoryTypes,
    });

  } catch (err) {
    Logger.log('onDealerFormSubmit error: ' + err.message);
  }
}


// ── 4. Trade-In Form Handler ──────────────────────────────────────────────────

function onTradeInFormSubmit(e) {
  try {
    const r  = _parseResponses(e.response.getItemResponses());
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const replacementMakes = _join(r['Preferred Makes for Replacement Vehicle']);
    const knownIssues      = _join(r['Known Issues with Trade-In Vehicle (select all that apply)']);

    ss.getSheetByName(PORTAL_SHEETS.TRADE_INS).appendRow([
      new Date(),
      r['Full Name']                || '',
      r['Email Address']            || '',
      r['Phone Number']             || '',
      r['State / Location']         || '',
      r['VIN (Vehicle Identification Number)'] || '',
      r['Year']                     || '',
      r['Make']                     || '',
      r['Model']                    || '',
      r['Trim Level']               || '',
      _num(r['Current Mileage']),
      r['Overall Condition']        || '',
      r['Do you currently have a loan on this vehicle?'] || '',
      _num(r['Approximate Remaining Loan Balance ($)']),
      r['Lender Name']              || '',
      r['Are you purchasing through Lux Auto?'] || '',
      replacementMakes,
      r['Preferred Replacement Model(s)']  || '',
      _num(r['Replacement Vehicle Budget ($)']),
      r['How soon do you want to complete the trade?'] || '',
      knownIssues,
      r['Additional Notes']         || '',
      'New',
    ]);

    Logger.log(`Trade-in submitted: ${r['Full Name']} — ${r['Year']} ${r['Make']} ${r['Model']}`);

    sendAdminAlert('Trade-In', {
      'Name'              : r['Full Name'],
      'Email'             : r['Email Address'],
      'Phone'             : r['Phone Number'],
      'State'             : r['State / Location'],
      'VIN'               : r['VIN (Vehicle Identification Number)'],
      'Vehicle'           : `${r['Year']} ${r['Make']} ${r['Model']} ${r['Trim Level'] || ''}`.trim(),
      'Mileage'           : r['Current Mileage'],
      'Condition'         : r['Overall Condition'],
      'Loan?'             : r['Do you currently have a loan on this vehicle?'],
      'Loan Balance'      : '$' + _num(r['Approximate Remaining Loan Balance ($)']),
      'Purchasing via Lux': r['Are you purchasing through Lux Auto?'],
      'Replacement Budget': '$' + _num(r['Replacement Vehicle Budget ($)']),
      'Timeline'          : r['How soon do you want to complete the trade?'],
    });

    // Score the trade-in vehicle — if it's a good deal for Lux to acquire, add to Deals
    scoreSeller({
      vin         : r['VIN (Vehicle Identification Number)'],
      year        : parseInt(r['Year'])       || 2020,
      make        : r['Make'],
      model       : r['Model'],
      trim        : r['Trim Level']           || '',
      mileage     : _num(r['Current Mileage']),
      // No asking price on trade-ins; use 0 so any MMR value looks like a deal
      // Admin should review before pipeline auto-matches
      askingPrice : 0,
      name        : r['Full Name'],
      email       : r['Email Address'],
    });

  } catch (err) {
    Logger.log('onTradeInFormSubmit error: ' + err.message);
  }
}


// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Converts an array of ItemResponse objects into a plain key→value map.
 */
function _parseResponses(itemResponses) {
  const map = {};
  itemResponses.forEach(ir => {
    map[ir.getItem().getTitle()] = ir.getResponse();
  });
  return map;
}

/**
 * Joins array responses (checkbox questions) into a comma-separated string.
 */
function _join(val) {
  if (!val) return '';
  return Array.isArray(val) ? val.join(', ') : String(val);
}

/**
 * Parses a numeric string, stripping commas and $ signs.
 * Returns 0 if blank or unparseable.
 */
function _num(val) {
  if (!val) return 0;
  const n = parseFloat(String(val).replace(/[$,]/g, ''));
  return isNaN(n) ? 0 : n;
}


// ── Menu Addition ─────────────────────────────────────────────────────────────
// The onOpen() in Code.gs already adds "📋 Create Portal Forms".
// Add these two items by modifying that menu (shown below for reference):
//
//   .addItem('🔗 Install Form Triggers', 'installFormTriggers')
//   .addItem('🗑 Remove Form Triggers',  'removeFormTriggers')
