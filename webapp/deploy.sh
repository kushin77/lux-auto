#!/usr/bin/env bash
# Lux Auto — Command Center: deploy / redeploy the Apps Script web app.
# Repeatable & idempotent. Run from the webapp/ directory.
#
# Prereqs (one-time):
#   • Apps Script API ON:  https://script.google.com/home/usersettings
#   • clasp authenticated:  npx clasp login   (or clasp login --no-localhost in Cloud Shell)
#
# Usage:  bash deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

CLASP="npx --yes @google/clasp@2.4.2"
TITLE="Lux Auto — Command Center"

# 1) Create the script project on first run (writes scriptId into .clasp.json).
if [[ ! -f .clasp.json ]] || grep -q "REPLACE_WITH_YOUR_SCRIPT_ID" .clasp.json; then
  echo "▶ Creating Apps Script project…"
  rm -f .clasp.json
  $CLASP create --type webapp --title "$TITLE" --rootDir .
fi

# 2) Push source (only .gs/.html/appsscript.json per .claspignore).
echo "▶ Pushing source…"
$CLASP push --force

# 3) Create/refresh a versioned web-app deployment.
echo "▶ Deploying…"
$CLASP deploy --description "Lux Command Center $(date +%Y-%m-%d)" || true

# 4) Print the live web-app URL.
DID="$($CLASP deployments 2>/dev/null | grep -oE 'AKfyc[-_A-Za-z0-9]+' | tail -1 || true)"
echo "── Deployments ──"; $CLASP deployments || true
if [[ -n "$DID" ]]; then
  echo "✓ Live web app:  https://script.google.com/macros/s/$DID/exec"
else
  echo "→ Get the URL:  npx clasp open  → Deploy → Web app → copy the /exec link"
fi
