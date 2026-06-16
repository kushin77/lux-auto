/**
 * Web app entry point. Serves the Google-native Command Center UI.
 * Deployed as a web app: Deploy → New deployment → Web app.
 */

function doGet() {
  return HtmlService.createTemplateFromFile('CommandCenter')
    .evaluate()
    .setTitle(APP.NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Allow HTML partials via <?!= include('name') ?> if the UI is split later. */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** Lightweight health/info for the client header (no secrets). */
function getAppInfo() {
  return { name: APP.NAME, demo: isDemo_(), stages: APP.STAGE_ORDER };
}
