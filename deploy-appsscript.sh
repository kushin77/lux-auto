#!/usr/bin/env bash
#
# Lux Auto — deploy the Apps Script app as a live web app.
# 100% native Google (Sheets/Drive/Gmail/Calendar/Chat). Free. No GCP. No billing.
#
# Run this from the "Lux Auto" folder on your computer (where the .gs files are).
# Prereqs:
#   • Node 18+ installed
#   • One-time: turn ON the Apps Script API at
#       https://script.google.com/home/usersettings   (toggle "Apps Script API")
set -euo pipefail

TITLE="${TITLE:-Lux Auto Command Center}"

echo "▶ Installing clasp (local dev dependency)…"
npm install >/dev/null 2>&1 || npm install

CLASP="npx clasp"

echo "▶ Logging in to Google (a browser window will open — authorize with your Google account)…"
$CLASP login

# If .clasp.json still has the placeholder scriptId, remove it so 'create' can run.
if [[ -f .clasp.json ]] && grep -q "REPLACE_WITH_YOUR_SCRIPT_ID" .clasp.json; then
  rm -f .clasp.json
fi

if [[ ! -f .clasp.json ]]; then
  echo "▶ Creating a new Apps Script web-app project…"
  $CLASP create --type webapp --title "$TITLE" --rootDir .
fi

echo "▶ Pushing all .gs/.html files…"
$CLASP push --force

echo "▶ Creating a web-app deployment…"
$CLASP deploy --description "Lux Auto live web app"

echo
echo "✓ Deployed. Your live URLs:"
echo "    Client portal :  <web-app-url>/exec"
echo "    Dashboard     :  <web-app-url>/exec?page=dashboard"
echo "    Mobile scanner:  <web-app-url>/exec?page=mobile"
echo
echo "Get the exact URL with:   npx clasp deployments    (or: npx clasp open-web-app)"
echo
cat <<NOTES
Next (inside the Apps Script editor — Project Settings → Script Properties):
  • MANHEIM_CLIENT_ID, MANHEIM_CLIENT_SECRET   (for live deal scanning)
  • CHAT_WEBHOOK_URL                            (optional Google Chat alerts)
Then run setupSheets(), setupVaultRoot(), setupAuctionCalendar() from the editor's Run menu.

Privacy: appsscript.json is set to access = ANYONE_ANONYMOUS (so seller intake forms
work publicly). For a private internal tool, change "access" to "MYSELF" or "DOMAIN"
in appsscript.json, then re-run:  npx clasp push --force && npx clasp deploy
NOTES
