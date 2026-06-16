/**
 * Lux Auto — Daily digest (Gmail + optional Google Chat).
 *
 * sendDailyDigest() summarizes the last 24h of Manheim deal alerts plus current
 * pipeline value and emails it to ADMIN_EMAILS (falls back to ALLOWED_EMAILS).
 * If CHAT_WEBHOOK_URL is set, it also posts a short Google Chat message.
 *
 * Installed by setupTriggers() to run daily at 7 AM ET (after the 6 AM scan).
 * Brand rule: the email is Lux Auto–branded; the CRM vendor is never named.
 */

function sendDailyDigest() {
  return withLock_('daily_digest', sendDailyDigest_, 2000);
}

function sendDailyDigest_() {
  try {
    var recipients = emailList_('ADMIN_EMAILS');
    if (!recipients.length) recipients = emailList_('ALLOWED_EMAILS');
    if (!recipients.length) {
      console.log('sendDailyDigest: no recipients configured (ADMIN_EMAILS / ALLOWED_EMAILS)');
      return { ok: false, reason: 'no_recipients' };
    }

    var summary = buildDigestSummary_();
    var subject = 'Lux Auto — Daily Digest · ' + new Date().toLocaleDateString() +
                  ' · ' + summary.newCount + ' new, ' + summary.hot + ' hot';

    MailApp.sendEmail({
      to: recipients.join(','),
      subject: subject,
      htmlBody: renderDigestHtml_(summary)
    });

    postChatDigest_(summary);
    logActivity_('daily_digest', 'Sent to ' + recipients.length + ' recipient(s) — ' +
      summary.newCount + ' new, ' + summary.hot + ' hot');
    return { ok: true, recipients: recipients.length, newCount: summary.newCount, hot: summary.hot };
  } catch (e) {
    logError_('sendDailyDigest', e);
    return { ok: false, error: e.message };
  }
}

/** Builds the digest data from the last 24h of the Manheim Deals sheet + pipeline metrics. */
function buildDigestSummary_() {
  var ss    = getSpreadsheet_();
  var sheet = ss.getSheetByName('Manheim Deals');
  var since = Date.now() - 24 * 3600 * 1000;
  var newDeals = [], hot = 0;

  if (sheet && sheet.getLastRow() > 1) {
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, MH_HEADERS.length).getValues();
    rows.forEach(function (r) {
      var ts = new Date(r[0]).getTime();
      if (isNaN(ts) || ts < since) return;
      var score = Number(r[MH_SCORE_COL - 1] || 0);
      newDeals.push({
        vehicle: [r[2], r[3], r[4]].filter(function (x) { return x; }).join(' '),
        vin: r[1], score: score,
        price: Number(r[9] || 0), mmr: Number(r[10] || 0), maxBid: Number(r[15] || 0),
        reason: r[14] || ''
      });
      if (score >= APP.HOT_SCORE) hot++;
    });
  }
  newDeals.sort(function (a, b) { return b.score - a.score; });

  var snap = isDemo_() ? demoSnapshot_() : liveSnapshot_();
  var m = snap.metrics || {};
  return {
    newDeals: newDeals.slice(0, 15),
    newCount: newDeals.length,
    hot: hot,
    pipelineValue: m.pipelineValue || 0,
    activeDeals: m.activeDeals || 0,
    demo: !!snap.demo
  };
}

/** Renders the digest as a dark/gold Lux Auto HTML email. */
function renderDigestHtml_(s) {
  var money = function (n) { return '$' + (Number(n) || 0).toLocaleString(); };
  var rows = s.newDeals.map(function (d) {
    var badge = d.score >= 70 ? '#1f9d55' : d.score >= 50 ? '#b7791f' : '#555';
    return '<tr>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #2a2a3e;color:#eee;">' + (d.vehicle || '—') +
        '<div style="color:#888;font-size:11px;">' + d.vin + '</div></td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #2a2a3e;text-align:center;">' +
        '<span style="background:' + badge + ';color:#fff;border-radius:10px;padding:2px 8px;font-weight:bold;">' + d.score + '</span></td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #2a2a3e;color:#ddd;text-align:right;">' + money(d.price) + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #2a2a3e;color:#ddd;text-align:right;">' + money(d.mmr) + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #2a2a3e;color:#d4af37;text-align:right;font-weight:bold;">' + money(d.maxBid) + '</td>' +
    '</tr>';
  }).join('');

  if (!rows) rows = '<tr><td colspan="5" style="padding:16px;color:#888;text-align:center;">No new deals in the last 24 hours.</td></tr>';

  return '' +
  '<div style="background:#0f0f1a;padding:24px;font-family:Arial,Helvetica,sans-serif;">' +
    '<div style="max-width:640px;margin:0 auto;background:#15152400;">' +
      '<h1 style="color:#d4af37;margin:0 0 4px;font-size:22px;">Lux Auto</h1>' +
      '<div style="color:#aaa;font-size:13px;margin-bottom:16px;">Daily Deal Digest · ' + new Date().toLocaleDateString() +
        (s.demo ? ' · <span style="color:#b7791f;">demo data</span>' : '') + '</div>' +
      '<div style="display:block;margin-bottom:16px;">' +
        '<span style="display:inline-block;background:#1a1a2e;color:#eee;border-radius:8px;padding:10px 14px;margin:0 8px 8px 0;">New deals: <b style="color:#d4af37;">' + s.newCount + '</b></span>' +
        '<span style="display:inline-block;background:#1a1a2e;color:#eee;border-radius:8px;padding:10px 14px;margin:0 8px 8px 0;">Hot (≥' + APP.HOT_SCORE + '): <b style="color:#1f9d55;">' + s.hot + '</b></span>' +
        '<span style="display:inline-block;background:#1a1a2e;color:#eee;border-radius:8px;padding:10px 14px;margin:0 8px 8px 0;">Pipeline: <b style="color:#d4af37;">' + money(s.pipelineValue) + '</b></span>' +
      '</div>' +
      '<table style="width:100%;border-collapse:collapse;background:#151524;border-radius:8px;overflow:hidden;">' +
        '<tr style="background:#1a1a2e;">' +
          '<th style="padding:10px;text-align:left;color:#d4af37;font-size:12px;">Vehicle</th>' +
          '<th style="padding:10px;color:#d4af37;font-size:12px;">Score</th>' +
          '<th style="padding:10px;text-align:right;color:#d4af37;font-size:12px;">List</th>' +
          '<th style="padding:10px;text-align:right;color:#d4af37;font-size:12px;">MMR</th>' +
          '<th style="padding:10px;text-align:right;color:#d4af37;font-size:12px;">Max Bid</th>' +
        '</tr>' + rows +
      '</table>' +
      '<div style="color:#666;font-size:11px;margin-top:16px;">Recommended max bid = MMR × ' + (APP.MAX_BID_FACTOR || 0.92) +
        '. Open the Command Center for full detail.</div>' +
    '</div>' +
  '</div>';
}

/** Posts a short digest line to Google Chat if CHAT_WEBHOOK_URL is configured. */
function postChatDigest_(s) {
  var url = prop_('CHAT_WEBHOOK_URL', '');
  if (!url) return;
  try {
    var top = s.newDeals[0];
    var text = '*Lux Auto — Daily Digest*\n' +
      s.newCount + ' new deals, ' + s.hot + ' hot. Pipeline $' + (s.pipelineValue || 0).toLocaleString() + '.' +
      (top ? '\nTop: ' + top.vehicle + ' (score ' + top.score + ', max bid $' + (top.maxBid || 0).toLocaleString() + ')' : '');
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({ text: text })
    });
  } catch (e) {
    logError_('postChatDigest_', e);
  }
}
