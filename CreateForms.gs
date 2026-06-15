// ============================================================
// LUX AUTO — Portal Forms Creator
// Google Apps Script  |  Run createAllForms() once to generate
// all four intake forms and log their URLs to a new Sheet tab.
// ============================================================

// ── Config ────────────────────────────────────────────────────────────────────

const FORM_CFG = {
  MAKES: ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan', 'BMW', 'Mercedes-Benz',
          'Audi', 'Hyundai', 'Kia', 'Jeep', 'Ram', 'GMC', 'Lexus', 'Subaru', 'Other'],
  STATES: [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
    'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
    'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
    'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
    'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
    'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
    'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
    'Wisconsin','Wyoming'
  ],
  CONDITIONS: ['Excellent – Like new, no issues', 'Good – Minor wear, fully functional',
               'Fair – Some issues, still driveable', 'Poor – Major issues / needs repair'],
  SHEET_LINKS : 'Portal Form Links',
};


// ── Entry Point ───────────────────────────────────────────────────────────────

/**
 * Run this once.  Creates all four Lux Auto intake forms and logs
 * their edit & response URLs to a "Portal Form Links" sheet tab.
 */
function createAllForms() {
  const results = [
    createBuyerForm(),
    createSellerForm(),
    createDealerForm(),
    createTradeInForm(),
  ];

  _logFormLinks(results);

  SpreadsheetApp.getUi().alert(
    '✅ All four Lux Auto forms have been created!\n\n' +
    'Check the "' + FORM_CFG.SHEET_LINKS + '" tab for edit links and shareable response URLs.\n\n' +
    'Share the Published URLs with buyers, sellers, dealers, and trade-in customers.'
  );
}


// ── 1. Car Buyer Form ─────────────────────────────────────────────────────────

function createBuyerForm() {
  const form = FormApp.create('Lux Auto — Car Buyer Intake');
  form.setDescription(
    'Tell us what you\'re looking for and we\'ll match you with the best available deals. ' +
    'A Lux Auto specialist will follow up within 24 hours.'
  );
  form.setCollectEmail(false);
  form.setConfirmationMessage(
    'Thank you! We\'ve received your buyer profile and will reach out with matching vehicles shortly.'
  );

  // Section 1 — Contact
  form.addSectionHeaderItem()
      .setTitle('Contact Information');

  form.addTextItem()
      .setTitle('Full Name')
      .setRequired(true);

  form.addTextItem()
      .setTitle('Email Address')
      .setRequired(true)
      .setHelpText('We\'ll send vehicle matches to this address.');

  form.addTextItem()
      .setTitle('Phone Number')
      .setRequired(true);

  form.addListItem()
      .setTitle('State / Location')
      .setRequired(true)
      .setChoiceValues(FORM_CFG.STATES);

  // Section 2 — Vehicle Preferences
  form.addSectionHeaderItem()
      .setTitle('Vehicle Preferences');

  form.addCheckboxItem()
      .setTitle('Preferred Makes (select all that apply)')
      .setRequired(true)
      .setChoiceValues(FORM_CFG.MAKES);

  form.addParagraphTextItem()
      .setTitle('Preferred Models')
      .setHelpText('e.g. Camry, F-150, Civic — leave blank if open to any model');

  form.addTextItem()
      .setTitle('Maximum Budget ($)')
      .setRequired(true)
      .setHelpText('Enter a number, e.g. 25000');

  form.addTextItem()
      .setTitle('Maximum Acceptable Mileage')
      .setRequired(true)
      .setHelpText('Enter a number, e.g. 80000');

  form.addTextItem()
      .setTitle('Preferred Year Range (From)')
      .setHelpText('e.g. 2018');

  form.addTextItem()
      .setTitle('Preferred Year Range (To)')
      .setHelpText('e.g. 2024 — leave blank for latest');

  form.addMultipleChoiceItem()
      .setTitle('Do you require financing?')
      .setRequired(true)
      .setChoiceValues(['Yes – I need financing', 'No – I\'m paying cash', 'Undecided']);

  form.addMultipleChoiceItem()
      .setTitle('How soon are you looking to buy?')
      .setRequired(true)
      .setChoiceValues([
        'Immediately (within 1 week)',
        'Within 1 month',
        'Within 3 months',
        'Just browsing / no timeline'
      ]);

  // Section 3 — Additional
  form.addSectionHeaderItem()
      .setTitle('Additional Details');

  form.addParagraphTextItem()
      .setTitle('Any specific features or requirements?')
      .setHelpText('e.g. sunroof, third-row seating, 4WD, specific color preference');

  form.addParagraphTextItem()
      .setTitle('Additional Notes');

  return { name: '🚗 Car Buyer Intake', form };
}


// ── 2. Car Seller Form ────────────────────────────────────────────────────────

function createSellerForm() {
  const form = FormApp.create('Lux Auto — Car Seller Intake');
  form.setDescription(
    'List your vehicle with Lux Auto. Provide accurate details for the fastest, ' +
    'most competitive offer. We typically respond within 24 hours.'
  );
  form.setCollectEmail(false);
  form.setConfirmationMessage(
    'Thanks for submitting your vehicle details! A Lux Auto buyer will review your listing and be in touch soon.'
  );

  // Section 1 — Contact
  form.addSectionHeaderItem()
      .setTitle('Your Contact Information');

  form.addTextItem()
      .setTitle('Full Name')
      .setRequired(true);

  form.addTextItem()
      .setTitle('Email Address')
      .setRequired(true);

  form.addTextItem()
      .setTitle('Phone Number')
      .setRequired(true);

  form.addListItem()
      .setTitle('State / Location')
      .setRequired(true)
      .setChoiceValues(FORM_CFG.STATES);

  // Section 2 — Vehicle Details
  form.addSectionHeaderItem()
      .setTitle('Vehicle Details');

  form.addTextItem()
      .setTitle('VIN (Vehicle Identification Number)')
      .setRequired(true)
      .setHelpText('17-character VIN found on your dashboard or registration');

  form.addTextItem()
      .setTitle('Year')
      .setRequired(true);

  form.addListItem()
      .setTitle('Make')
      .setRequired(true)
      .setChoiceValues(FORM_CFG.MAKES);

  form.addTextItem()
      .setTitle('Model')
      .setRequired(true)
      .setHelpText('e.g. Camry, F-150, Civic');

  form.addTextItem()
      .setTitle('Trim Level')
      .setHelpText('e.g. LE, XLT, Sport — leave blank if unknown');

  form.addTextItem()
      .setTitle('Current Mileage')
      .setRequired(true)
      .setHelpText('Enter exact odometer reading');

  form.addListItem()
      .setTitle('Overall Condition')
      .setRequired(true)
      .setChoiceValues(FORM_CFG.CONDITIONS);

  // Section 3 — Pricing
  form.addSectionHeaderItem()
      .setTitle('Pricing & Title');

  form.addTextItem()
      .setTitle('Your Asking Price ($)')
      .setRequired(true)
      .setHelpText('Enter a number — we\'ll compare against current market values');

  form.addMultipleChoiceItem()
      .setTitle('Do you have the title in hand?')
      .setRequired(true)
      .setChoiceValues(['Yes – title is clear', 'Yes – but there\'s a lien', 'No – still financing', 'Lost / need replacement']);

  form.addTextItem()
      .setTitle('Outstanding Loan Balance ($)')
      .setHelpText('Leave blank if title is clear');

  // Section 4 — Vehicle History
  form.addSectionHeaderItem()
      .setTitle('Vehicle History');

  form.addMultipleChoiceItem()
      .setTitle('Has the vehicle been in any accidents?')
      .setRequired(true)
      .setChoiceValues(['No accidents', 'Minor fender-bender (no airbag deploy)', 'Moderate damage', 'Major damage / structural']);

  form.addCheckboxItem()
      .setTitle('Known Issues (select all that apply)')
      .setChoiceValues([
        'Engine / drivetrain issues',
        'Transmission issues',
        'Electrical issues',
        'Rust / frame damage',
        'Interior damage',
        'Cosmetic damage (dents/scratches)',
        'None – vehicle is in good working order'
      ]);

  form.addTextItem()
      .setTitle('Do you have a Carfax or AutoCheck report?')
      .setHelpText('Yes / No / URL if available online');

  // Section 5 — Additional
  form.addSectionHeaderItem()
      .setTitle('Additional Details');

  form.addParagraphTextItem()
      .setTitle('Additional Notes or Modifications')
      .setHelpText('Upgrades, recent repairs, service history highlights, etc.');

  return { name: '🏷️ Car Seller Intake', form };
}


// ── 3. Dealer Onboarding Form ─────────────────────────────────────────────────

function createDealerForm() {
  const form = FormApp.create('Lux Auto — Dealer Onboarding');
  form.setDescription(
    'Partner with Lux Auto to access exclusive deal flow and buyer matches. ' +
    'Complete this form to register your dealership. We\'ll reach out within 1 business day.'
  );
  form.setCollectEmail(false);
  form.setConfirmationMessage(
    'Thank you for your interest in partnering with Lux Auto! Our team will review your dealership profile and contact you shortly.'
  );

  // Section 1 — Dealership Info
  form.addSectionHeaderItem()
      .setTitle('Dealership Information');

  form.addTextItem()
      .setTitle('Dealership Name')
      .setRequired(true);

  form.addTextItem()
      .setTitle('Dealer License Number')
      .setRequired(true);

  form.addTextItem()
      .setTitle('Street Address')
      .setRequired(true);

  form.addTextItem()
      .setTitle('City')
      .setRequired(true);

  form.addListItem()
      .setTitle('State')
      .setRequired(true)
      .setChoiceValues(FORM_CFG.STATES);

  form.addTextItem()
      .setTitle('ZIP Code')
      .setRequired(true);

  form.addTextItem()
      .setTitle('Dealership Website')
      .setHelpText('e.g. https://yourdealership.com');

  // Section 2 — Primary Contact
  form.addSectionHeaderItem()
      .setTitle('Primary Contact');

  form.addTextItem()
      .setTitle('Contact Name')
      .setRequired(true);

  form.addTextItem()
      .setTitle('Title / Role')
      .setHelpText('e.g. General Manager, Owner, F&I Director');

  form.addTextItem()
      .setTitle('Email Address')
      .setRequired(true);

  form.addTextItem()
      .setTitle('Direct Phone Number')
      .setRequired(true);

  // Section 3 — Operations
  form.addSectionHeaderItem()
      .setTitle('Inventory & Operations');

  form.addCheckboxItem()
      .setTitle('Inventory Types (select all that apply)')
      .setRequired(true)
      .setChoiceValues([
        'New vehicles',
        'Used vehicles',
        'Certified Pre-Owned (CPO)',
        'Fleet / commercial vehicles',
        'Wholesale / auction only',
        'Salvage / rebuilt title'
      ]);

  form.addCheckboxItem()
      .setTitle('Makes You Specialize In')
      .setChoiceValues(FORM_CFG.MAKES);

  form.addMultipleChoiceItem()
      .setTitle('Average Monthly Retail Volume')
      .setRequired(true)
      .setChoiceValues([
        'Under 20 units/mo',
        '20–50 units/mo',
        '51–100 units/mo',
        '101–250 units/mo',
        '250+ units/mo'
      ]);

  form.addMultipleChoiceItem()
      .setTitle('Are you currently active at Manheim auctions?')
      .setRequired(true)
      .setChoiceValues(['Yes – active buyer/seller', 'Yes – buyer only', 'Yes – seller only', 'No – not currently']);

  form.addTextItem()
      .setTitle('Manheim Dealer Number (if applicable)')
      .setHelpText('Leave blank if not applicable');

  // Section 4 — Partnership Interest
  form.addSectionHeaderItem()
      .setTitle('Partnership Interest');

  form.addCheckboxItem()
      .setTitle('What are you most interested in? (select all)')
      .setRequired(true)
      .setChoiceValues([
        'Receiving deal alerts (buy below MMR)',
        'Accessing Lux Auto buyer network',
        'Trade-in processing support',
        'Wholesale buy/sell matching',
        'Market valuation tools (MMR data)'
      ]);

  form.addParagraphTextItem()
      .setTitle('Tell us about your dealership and what you\'re looking to achieve')
      .setRequired(true);

  return { name: '🏢 Dealer Onboarding', form };
}


// ── 4. Trade-In Form ──────────────────────────────────────────────────────────

function createTradeInForm() {
  const form = FormApp.create('Lux Auto — Trade-In Evaluation Request');
  form.setDescription(
    'Submit your current vehicle for a trade-in evaluation. ' +
    'We\'ll assess its value and apply it toward your next purchase through Lux Auto.'
  );
  form.setCollectEmail(false);
  form.setConfirmationMessage(
    'We\'ve received your trade-in request! A Lux Auto specialist will reach out with your estimated trade-in value within 24 hours.'
  );

  // Section 1 — Contact
  form.addSectionHeaderItem()
      .setTitle('Your Contact Information');

  form.addTextItem()
      .setTitle('Full Name')
      .setRequired(true);

  form.addTextItem()
      .setTitle('Email Address')
      .setRequired(true);

  form.addTextItem()
      .setTitle('Phone Number')
      .setRequired(true);

  form.addListItem()
      .setTitle('State / Location')
      .setRequired(true)
      .setChoiceValues(FORM_CFG.STATES);

  // Section 2 — Trade-In Vehicle
  form.addSectionHeaderItem()
      .setTitle('Vehicle You\'re Trading In');

  form.addTextItem()
      .setTitle('VIN (Vehicle Identification Number)')
      .setRequired(true)
      .setHelpText('17-character VIN found on your dashboard or registration');

  form.addTextItem()
      .setTitle('Year')
      .setRequired(true);

  form.addListItem()
      .setTitle('Make')
      .setRequired(true)
      .setChoiceValues(FORM_CFG.MAKES);

  form.addTextItem()
      .setTitle('Model')
      .setRequired(true);

  form.addTextItem()
      .setTitle('Trim Level')
      .setHelpText('e.g. LE, XLT, Sport');

  form.addTextItem()
      .setTitle('Current Mileage')
      .setRequired(true);

  form.addListItem()
      .setTitle('Overall Condition')
      .setRequired(true)
      .setChoiceValues(FORM_CFG.CONDITIONS);

  // Section 3 — Loan / Title
  form.addSectionHeaderItem()
      .setTitle('Loan & Title Status');

  form.addMultipleChoiceItem()
      .setTitle('Do you currently have a loan on this vehicle?')
      .setRequired(true)
      .setChoiceValues(['No – I own it outright', 'Yes – I\'m still making payments', 'Yes – but I\'m close to payoff']);

  form.addTextItem()
      .setTitle('Approximate Remaining Loan Balance ($)')
      .setHelpText('Leave blank if no loan');

  form.addTextItem()
      .setTitle('Lender Name')
      .setHelpText('e.g. Chase, Wells Fargo — leave blank if no loan');

  // Section 4 — Replacement Vehicle
  form.addSectionHeaderItem()
      .setTitle('What Are You Looking For Next?');

  form.addMultipleChoiceItem()
      .setTitle('Are you purchasing through Lux Auto?')
      .setRequired(true)
      .setChoiceValues([
        'Yes – I\'d like to apply trade-in value to a Lux Auto vehicle',
        'No – I just want a trade-in cash offer',
        'Undecided'
      ]);

  form.addCheckboxItem()
      .setTitle('Preferred Makes for Replacement Vehicle')
      .setChoiceValues(FORM_CFG.MAKES);

  form.addTextItem()
      .setTitle('Preferred Replacement Model(s)')
      .setHelpText('e.g. Tacoma, Explorer — leave blank if open');

  form.addTextItem()
      .setTitle('Replacement Vehicle Budget ($)')
      .setHelpText('Including trade-in value');

  form.addMultipleChoiceItem()
      .setTitle('How soon do you want to complete the trade?')
      .setRequired(true)
      .setChoiceValues([
        'ASAP (within 1 week)',
        'Within 1 month',
        'Within 3 months',
        'No rush'
      ]);

  // Section 5 — Additional
  form.addSectionHeaderItem()
      .setTitle('Additional Details');

  form.addCheckboxItem()
      .setTitle('Known Issues with Trade-In Vehicle (select all that apply)')
      .setChoiceValues([
        'Engine / mechanical issues',
        'Transmission issues',
        'Electrical issues',
        'Rust / frame damage',
        'Accident history',
        'Interior damage',
        'Cosmetic damage (dents/scratches)',
        'None – vehicle is in good working order'
      ]);

  form.addParagraphTextItem()
      .setTitle('Additional Notes')
      .setHelpText('Recent repairs, upgrades, service records, or anything else we should know');

  return { name: '🔄 Trade-In Evaluation', form };
}


// ── Helper: Log Form Links to Sheet ───────────────────────────────────────────

function _logFormLinks(results) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(FORM_CFG.SHEET_LINKS);
  if (!sheet) {
    sheet = ss.insertSheet(FORM_CFG.SHEET_LINKS);
  }

  // Headers
  sheet.clearContents();
  const headers = ['Form Name', 'Published URL (share with public)', 'Edit URL (admins only)', 'Created'];
  const hRange = sheet.getRange(1, 1, 1, 4);
  hRange.setValues([headers]);
  hRange.setBackground('#1a73e8').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setFrozenRows(1);

  // Data rows
  const rows = results.map(r => [
    r.name,
    r.form.getPublishedUrl(),
    r.form.getEditUrl(),
    new Date().toLocaleString()
  ]);
  sheet.getRange(2, 1, rows.length, 4).setValues(rows);

  // Auto-resize
  sheet.autoResizeColumns(1, 4);
  sheet.setColumnWidth(2, 420);
  sheet.setColumnWidth(3, 420);
}


// ── Menu Integration ───────────────────────────────────────────────────────────
// Adds "Create Portal Forms" to the existing Lux Auto menu when the sheet opens.

function onOpen_FormCreator() {
  // Call this from your existing onOpen() function:
  //   SpreadsheetApp.getUi().createMenu('🚗 Lux Auto')
  //     ...existing items...
  //     .addSeparator()
  //     .addItem('📋 Create Portal Forms', 'createAllForms')
  //     .addToUi();
}
