// ============================================================
// LUX AUTO — Chat Notifications  |  Google Chat Webhook Alerts
// Google Apps Script
//
// Script Properties required:
//   CHAT_WEBHOOK_URL — Google Chat space webhook URL (set by dealer)
//
// All functions gracefully handle a missing webhook URL by
// logging a warning rather than throwing.
//
// Entry points:
//   sendChatMessage(text, cardData)
//   notifyNewHotDeal(listing)
//   notifyDealStageChange(vin, make, model, year, oldStage, newStage, note)
//   notifyWaitlistMatch(buyerName, vin, make, model, year, price, score)
//   notifyTransportAlert(vin, make, model, year, etaDays)
//   notifyDailyBriefing(summary)
//   isChatConfigured()
// ============================================================

// ── Colour tokens used in Card decoratedTexts / icons ────────────────────────
// Google Chat Cards v2 does not support arbitrary hex on text, but we use
// these in iconUrl badge patterns and section headers via HTML-alike labels.
const CHAT_COLOR_GREEN  = '#00C853';  // hot deals
const CHAT_COLOR_ORANGE = '#FF6D00';  // warnings / transport alerts
const CHAT_COLOR_RED    = '#D50000';  // urgent alerts
const CHAT_COLOR_BLUE   = '#1565C0';  // informational / daily briefing
const CHAT_COLOR_GOLD   = '#F9A825';  // stage changes / waitlist

// ── Webhook Configuration ─────────────────────────────────────────────────────

/**
 * Returns true if CHAT_WEBHOOK_URL is set and non-empty in Script Properties.
 *
 * @returns {boolean}
 */
function isChatConfigured() {
  const url = PropertiesService.getScriptProperties().getProperty('CHAT_WEBHOOK_URL');
  return !!(url && url.trim().length > 0);
}

/**
 * Retrieves the webhook URL from Script Properties.
 * Logs a warning and returns null if not configured.
 *
 * @returns {string|null}
 */
function _getWebhookUrl() {
  const url = PropertiesService.getScriptProperties().getProperty('CHAT_WEBHOOK_URL');
  if (!url || !url.trim()) {
    Logger.log('ChatNotify: CHAT_WEBHOOK_URL is not configured — skipping notification');
    return null;
  }
  return url.trim();
}

// ── Core Send Function ────────────────────────────────────────────────────────

/**
 * Sends a message to the configured Google Chat webhook.
 * Pass plain text for a simple message, or a cardData object for a rich card.
 *
 * cardData must be a valid Google Chat Cards v2 "cardsV2" array element:
 *   { cardId: string, card: { header: {}, sections: [...] } }
 *
 * @param {string}  text      Plain-text fallback (shown in notifications).
 * @param {Object}  [cardData] Optional Cards v2 card object.
 * @returns {{ success: boolean, httpCode: number }}
 */
function sendChatMessage(text, cardData) {
  const webhookUrl = _getWebhookUrl();
  if (!webhookUrl) return { success: false, httpCode: 0 };

  const payload = cardData
    ? { text: text || '', cardsV2: [cardData] }
    : { text: text || '' };

  try {
    const response = UrlFetchApp.fetch(webhookUrl, {
      method      : 'post',
      contentType : 'application/json',
      payload     : JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    const code = response.getResponseCode();
    if (code !== 200) {
      Logger.log('ChatNotify: webhook returned HTTP ' + code + ' — ' + response.getContentText().slice(0, 200));
    }
    return { success: code === 200, httpCode: code };
  } catch (err) {
    Logger.log('ChatNotify.sendChatMessage error: ' + err.message);
    return { success: false, httpCode: 0 };
  }
}

// ── Hot Deal Notification ─────────────────────────────────────────────────────

/**
 * Sends a rich card notification for a high-score deal.
 * Only fires if listing.score >= 70.
 *
 * @param {{
 *   make     : string,
 *   model    : string,
 *   year     : string|number,
 *   mileage  : number,
 *   price    : number,
 *   score    : number,
 *   vin      : string,
 *   url      : string,
 *   mmr      : number,
 *   discount : number   // decimal, e.g. 0.18 for 18%
 * }} listing
 */
function notifyNewHotDeal(listing) {
  if (!listing || listing.score < 70) return;

  const vehicle     = listing.year + ' ' + listing.make + ' ' + listing.model;
  const priceStr    = '$' + Number(listing.price).toLocaleString();
  const mmrStr      = listing.mmr  ? '$' + Number(listing.mmr).toLocaleString()  : 'N/A';
  const discStr     = listing.discount ? (listing.discount * 100).toFixed(0) + '% below MMR' : '—';
  const mileageStr  = listing.mileage  ? Number(listing.mileage).toLocaleString() + ' mi'      : '—';
  const scoreLabel  = listing.score >= 85 ? '🔥 ELITE ('  + listing.score + ')' :
                      listing.score >= 70 ? '⭐ HOT ('    + listing.score + ')' :
                                            '✅ Good ('   + listing.score + ')';

  const card = {
    cardId : 'hot_deal_' + (listing.vin || Date.now()),
    card   : {
      header: {
        title    : '🏎️ New Hot Deal: ' + vehicle,
        subtitle : scoreLabel,
        imageUrl : 'https://fonts.gstatic.com/s/i/materialiconsround/directions_car/v12/24px.svg',
        imageType: 'CIRCLE',
      },
      sections: [
        {
          header  : '<font color="' + CHAT_COLOR_GREEN + '">💰 Deal Metrics</font>',
          widgets : [
            _decoratedText('💵 Price',    priceStr),
            _decoratedText('📊 MMR',      mmrStr),
            _decoratedText('📉 Discount', discStr),
            _decoratedText('🛣️ Mileage',  mileageStr),
            _decoratedText('🔑 VIN',      listing.vin || '—'),
          ],
        },
        {
          widgets: [
            {
              buttonList: {
                buttons: listing.url ? [
                  {
                    text    : '🔍 View Deal',
                    onClick : { openLink: { url: listing.url } },
                    color   : { red: 0, green: 0.784, blue: 0.325, alpha: 1 }, // green
                  },
                ] : [],
              },
            },
          ],
        },
      ],
    },
  };

  sendChatMessage('🏎️ Hot Deal Alert: ' + vehicle + ' — Score ' + listing.score, card);
}

// ── Deal Stage Change Notification ────────────────────────────────────────────

/**
 * Sends a brief card when a vehicle moves pipeline stages.
 *
 * @param {string} vin
 * @param {string} make
 * @param {string} model
 * @param {string|number} year
 * @param {string} oldStage
 * @param {string} newStage
 * @param {string} [note]
 */
function notifyDealStageChange(vin, make, model, year, oldStage, newStage, note) {
  const vehicle = year + ' ' + make + ' ' + model;
  const arrow   = oldStage + ' → ' + newStage;

  const card = {
    cardId : 'stage_' + vin + '_' + Date.now(),
    card   : {
      header: {
        title    : '📋 Stage Change: ' + vehicle,
        subtitle : arrow,
        imageType: 'CIRCLE',
      },
      sections: [
        {
          header  : '<font color="' + CHAT_COLOR_GOLD + '">Pipeline Update</font>',
          widgets : [
            _decoratedText('🔑 VIN',        vin      || '—'),
            _decoratedText('🔀 Transition',  arrow),
            _decoratedText('📝 Note',        note || '—'),
          ],
        },
      ],
    },
  };

  sendChatMessage(vehicle + ' moved: ' + arrow, card);
}

// ── Waitlist Match Notification ───────────────────────────────────────────────

/**
 * Sends a notification when a waitlisted buyer is matched to a vehicle.
 *
 * @param {string}       buyerName
 * @param {string}       vin
 * @param {string}       make
 * @param {string}       model
 * @param {string|number} year
 * @param {number}       price
 * @param {number}       score
 */
function notifyWaitlistMatch(buyerName, vin, make, model, year, price, score) {
  const vehicle  = year + ' ' + make + ' ' + model;
  const priceStr = price ? '$' + Number(price).toLocaleString() : '—';

  const card = {
    cardId : 'waitlist_' + vin + '_' + Date.now(),
    card   : {
      header: {
        title    : '🔔 Waitlist Match!',
        subtitle : buyerName + ' → ' + vehicle,
        imageType: 'CIRCLE',
      },
      sections: [
        {
          header  : '<font color="' + CHAT_COLOR_GOLD + '">🤝 Buyer Matched</font>',
          widgets : [
            _decoratedText('👤 Buyer',    buyerName || '—'),
            _decoratedText('🚗 Vehicle',  vehicle),
            _decoratedText('🔑 VIN',      vin       || '—'),
            _decoratedText('💵 Price',    priceStr),
            _decoratedText('⭐ Score',    score != null ? String(score) : '—'),
          ],
        },
      ],
    },
  };

  sendChatMessage('🔔 Waitlist Match: ' + buyerName + ' matched to ' + vehicle, card);
}

// ── Transport Delay Alert ─────────────────────────────────────────────────────

/**
 * Fires a warning when transport is taking longer than 14 days.
 * Only sends if etaDays > 14.
 *
 * @param {string}       vin
 * @param {string}       make
 * @param {string}       model
 * @param {string|number} year
 * @param {number}       etaDays  Total days in transit so far.
 */
function notifyTransportAlert(vin, make, model, year, etaDays) {
  if (etaDays <= 14) return;

  const vehicle  = year + ' ' + make + ' ' + model;
  const daysStr  = etaDays + ' days in transit';

  const card = {
    cardId : 'transport_' + vin + '_' + Date.now(),
    card   : {
      header: {
        title    : '⚠️ Transport Delay',
        subtitle : vehicle + ' — ' + daysStr,
        imageType: 'CIRCLE',
      },
      sections: [
        {
          header  : '<font color="' + CHAT_COLOR_ORANGE + '">🚚 Transport Alert</font>',
          widgets : [
            _decoratedText('🔑 VIN',         vin     || '—'),
            _decoratedText('🚗 Vehicle',      vehicle),
            _decoratedText('📅 Days in Transit', String(etaDays)),
            _decoratedText('⚠️ Status',       'Exceeded 14-day SLA — follow up with carrier'),
          ],
        },
      ],
    },
  };

  sendChatMessage('⚠️ Transport Delay: ' + vin + ' - ' + etaDays + ' days in transit', card);
}

// ── Daily Briefing Card ───────────────────────────────────────────────────────

/**
 * Sends a daily morning summary card to the Chat space.
 *
 * @param {{
 *   newListings       : number,
 *   hotDeals          : number,
 *   pipelineValue     : number,
 *   soldThisWeek      : number,
 *   grossProfitThisWeek: number
 * }} summary
 */
function notifyDailyBriefing(summary) {
  const s              = summary || {};
  const today          = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'EEEE, MMMM d yyyy');
  const pipelineStr    = s.pipelineValue        ? '$' + Number(s.pipelineValue).toLocaleString()         : '$0';
  const grossStr       = s.grossProfitThisWeek  ? '$' + Number(s.grossProfitThisWeek).toLocaleString()   : '$0';

  const card = {
    cardId : 'briefing_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd'),
    card   : {
      header: {
        title    : '☀️ Lux Auto Daily Briefing',
        subtitle : today,
        imageType: 'CIRCLE',
      },
      sections: [
        {
          header  : '<font color="' + CHAT_COLOR_BLUE + '">📊 Today\'s Snapshot</font>',
          widgets : [
            _decoratedText('🆕 New Listings',        String(s.newListings    != null ? s.newListings    : '—')),
            _decoratedText('🔥 Hot Deals (score≥70)', String(s.hotDeals       != null ? s.hotDeals       : '—')),
            _decoratedText('💼 Pipeline Value',       pipelineStr),
          ],
        },
        {
          header  : '<font color="' + CHAT_COLOR_GREEN + '">📈 This Week\'s Performance</font>',
          widgets : [
            _decoratedText('✅ Vehicles Sold',        String(s.soldThisWeek   != null ? s.soldThisWeek   : '—')),
            _decoratedText('💰 Gross Profit',         grossStr),
          ],
        },
        {
          widgets: [
            {
              textParagraph: {
                text: '<i>Sent by Lux Auto Buyer System · ' + today + '</i>',
              },
            },
          ],
        },
      ],
    },
  };

  sendChatMessage('☀️ Lux Auto Daily Briefing — ' + today, card);
}

// ── Card Widget Helper ────────────────────────────────────────────────────────

/**
 * Builds a Google Chat Cards v2 decoratedText widget.
 *
 * @param {string} topLabel   Bold label displayed above the value.
 * @param {string} text       Main value text.
 * @returns {Object}  Widget object ready for use in a card section's widgets array.
 */
function _decoratedText(topLabel, text) {
  return {
    decoratedText: {
      topLabel : topLabel,
      text     : text || '—',
      wrapText : true,
    },
  };
}
