#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Lux Auto — Apps Script ONE-TIME BOOTSTRAP (run this in Google Cloud Shell)
#
# What this does:
#   1. Authenticates clasp with your Google account (browser pop-up once)
#   2. Creates the Apps Script project (gets a Script ID)
#   3. Pushes the source and creates the initial web-app deployment
#   4. Prints the two GitHub secrets you need to paste → repo Settings → Secrets
#
# Run from the webapp/ directory:
#   bash bootstrap-cloudshell.sh
#
# After this runs once, all future deploys happen automatically via
# .github/workflows/webapp-deploy.yml on every push to main.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}▶ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠  $*${NC}"; }
die()  { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }

# ── 0. Prerequisites ─────────────────────────────────────────────────────────
log "Checking prerequisites…"
command -v node >/dev/null || die "Node.js not found — run: nvm install 20 && nvm use 20"
node_ver=$(node -e 'process.stdout.write(process.version)')
log "Node $node_ver ✓"

# ── 1. Install clasp ─────────────────────────────────────────────────────────
log "Installing dependencies…"
npm ci
CLASP="./node_modules/.bin/clasp"

# ── 2. Authenticate ──────────────────────────────────────────────────────────
if [[ -f ~/.clasprc.json ]]; then
  warn "~/.clasprc.json already exists — skipping login (delete it to re-auth)."
else
  log "Authenticating clasp (a browser tab will open — authorize, then paste the code here)…"
  $CLASP login --no-localhost
fi

# Verify auth works
$CLASP list >/dev/null 2>&1 || die "clasp auth failed — try: rm ~/.clasprc.json && bash $0"
log "clasp authenticated ✓"

# ── 3. Create the Apps Script project (only if .clasp.json doesn't exist yet) ─
TITLE="Lux Auto — Command Center"
if [[ -f .clasp.json ]] && ! grep -q "REPLACE_WITH_SCRIPT_ID" .clasp.json 2>/dev/null; then
  log ".clasp.json already present — skipping project creation."
  SCRIPT_ID=$(node -p "require('./.clasp.json').scriptId")
else
  log "Creating Apps Script project: \"$TITLE\"…"
  rm -f .clasp.json
  $CLASP create --type webapp --title "$TITLE" --rootDir .
  SCRIPT_ID=$(node -p "require('./.clasp.json').scriptId")
  # Also write the template (used by CI)
  cat .clasp.json > .clasp.json.template.bak
fi

log "Script ID: ${CYAN}${SCRIPT_ID}${NC}"

# ── 4. Push source ───────────────────────────────────────────────────────────
log "Pushing source to Apps Script…"
$CLASP push --force

# ── 5. Create the initial web-app deployment ──────────────────────────────────
log "Creating deployment…"
$CLASP deploy --description "Initial deploy — $(date -u '+%Y-%m-%dT%H:%M:%SZ')" || {
  warn "Deploy command failed (the source was pushed). If this is a fresh project,"
  warn "open the Script Editor and create the deployment manually once:"
  warn "  Deploy → New deployment → Web app"
  warn "  Execute as: Me | Access: Anyone in your org"
}

# ── 6. Print the live URL ─────────────────────────────────────────────────────
echo ""
log "Active deployments:"
$CLASP deployments 2>/dev/null || true
echo ""

# ── 7. Export GitHub secrets ──────────────────────────────────────────────────
CLASPRC_JSON=$(cat ~/.clasprc.json)

echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  ADD THESE TWO SECRETS TO YOUR GITHUB REPO${NC}"
echo -e "${CYAN}  → github.com/kushin77/lux-auto → Settings → Secrets → Actions${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Secret name:${NC}  SCRIPT_ID"
echo -e "${YELLOW}Secret value:${NC}"
echo "$SCRIPT_ID"
echo ""
echo -e "${YELLOW}Secret name:${NC}  CLASPRC_JSON"
echo -e "${YELLOW}Secret value:${NC}  (one JSON blob — copy everything between the dashed lines)"
echo "──────────────────────────────────────────────────────────────────────"
echo "$CLASPRC_JSON"
echo "──────────────────────────────────────────────────────────────────────"
echo ""
echo -e "${GREEN}Done! Once you paste those two secrets, every push to main that${NC}"
echo -e "${GREEN}touches webapp/ will auto-deploy via GitHub Actions.${NC}"
echo ""
echo -e "Next step: set Script Properties in the editor:"
echo -e "  LC_API_TOKEN    — your CRM Private Integration token"
echo -e "  LC_LOCATION_ID  — your CRM location ID"
echo -e "  ADMIN_EMAILS    — comma-separated admin email(s)"
$CLASP open || true
