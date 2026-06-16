#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Lux Auto — GCP ONE-COMMAND BOOTSTRAP
#
# Idempotent. Creates everything GCP needs for Lux Auto and auto-populates
# GitHub Actions secrets so CI deploys just work on the first push.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - gh CLI installed and authenticated (gh auth login)  [optional — secrets
#     are printed as copy-paste commands if gh is absent]
#   - Billing enabled on the GCP project
#
# Usage:
#   PROJECT_ID=lux-auto bash scripts/gcp-bootstrap.sh
#
# What it creates (all idempotent):
#   ✓ Enables required GCP APIs
#   ✓ Artifact Registry repo (lux-auto) for Docker images
#   ✓ Deploy service account (deploy@<project>.iam.gserviceaccount.com)
#   ✓ Workload Identity Federation pool + provider for GitHub Actions (keyless)
#   ✓ Cloud SQL Postgres 16 instance (lux-pg, db-f1-micro) + DB + user
#   ✓ Secret Manager secrets: DB URL, FastAPI key, GHL token
#   ✓ IAM bindings for deploy SA and Cloud Run runtime SA
#   ✓ Sets GitHub Actions secrets (CLASPRC_JSON must come from webapp bootstrap)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
PROJECT_ID="${PROJECT_ID:-lux-auto}"
REGION="${REGION:-us-central1}"
GITHUB_REPO="${GITHUB_REPO:-kushin77/lux-auto}"

SERVICE="lux-auto-api"
DEPLOY_SA="deploy"
DEPLOY_SA_EMAIL="${DEPLOY_SA}@${PROJECT_ID}.iam.gserviceaccount.com"

WIF_POOL="github-pool"
WIF_PROVIDER="github-provider"

SQL_INSTANCE="lux-pg"
DB_NAME="lux_prod"
DB_USER="lux_admin"
SQL_TIER="${SQL_TIER:-db-f1-micro}"          # upgrade to db-g1-small for production load

AR_REPO="lux-auto"                            # Artifact Registry repository name

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${GREEN}▶ $*${NC}"; }
info() { echo -e "${CYAN}  $*${NC}"; }
warn() { echo -e "${YELLOW}⚠  $*${NC}"; }
die()  { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }
section() { echo ""; echo -e "${BOLD}${CYAN}══ $* ══${NC}"; }

# ── Validate ──────────────────────────────────────────────────────────────────
command -v gcloud >/dev/null || die "gcloud not found — install Google Cloud SDK"
gcloud auth print-access-token >/dev/null 2>&1 || die "gcloud not authenticated — run: gcloud auth login"

section "Bootstrap: ${PROJECT_ID} / ${REGION}"
gcloud config set project "$PROJECT_ID" >/dev/null
PROJECT_NUM="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
info "Project number: $PROJECT_NUM"

# ── 1. APIs ───────────────────────────────────────────────────────────────────
section "Enabling APIs"
APIS=(
  run.googleapis.com
  cloudbuild.googleapis.com
  artifactregistry.googleapis.com
  sqladmin.googleapis.com
  secretmanager.googleapis.com
  iam.googleapis.com
  iamcredentials.googleapis.com
)
gcloud services enable "${APIS[@]}" --project "$PROJECT_ID"
log "APIs enabled ✓"

# ── 2. Artifact Registry ──────────────────────────────────────────────────────
section "Artifact Registry"
if gcloud artifacts repositories describe "$AR_REPO" \
    --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  warn "Repository $AR_REPO already exists — skipping."
else
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --project="$PROJECT_ID" \
    --description="Lux Auto container images"
  log "Artifact Registry: ${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO} ✓"
fi
IMAGE_BASE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/${SERVICE}"

# ── 3. Deploy service account ─────────────────────────────────────────────────
section "Deploy Service Account"
if gcloud iam service-accounts describe "$DEPLOY_SA_EMAIL" \
    --project "$PROJECT_ID" >/dev/null 2>&1; then
  warn "Service account $DEPLOY_SA_EMAIL already exists — skipping creation."
else
  gcloud iam service-accounts create "$DEPLOY_SA" \
    --project "$PROJECT_ID" \
    --display-name "Lux Auto CI Deploy"
  log "Service account created: $DEPLOY_SA_EMAIL ✓"
fi

# Grant roles to the deploy SA
DEPLOY_ROLES=(
  roles/run.admin
  roles/cloudbuild.builds.editor
  roles/artifactregistry.admin
  roles/iam.serviceAccountUser
  roles/secretmanager.secretAccessor
  roles/cloudsql.client
)
for role in "${DEPLOY_ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
    --role="$role" \
    --condition=None \
    >/dev/null
done
log "IAM roles granted to deploy SA ✓"

# ── 4. Workload Identity Federation (keyless GitHub Actions auth) ─────────────
section "Workload Identity Federation"
WIF_POOL_NAME="projects/${PROJECT_NUM}/locations/global/workloadIdentityPools/${WIF_POOL}"

if gcloud iam workload-identity-pools describe "$WIF_POOL" \
    --location=global --project "$PROJECT_ID" >/dev/null 2>&1; then
  warn "WIF pool $WIF_POOL already exists — skipping."
else
  gcloud iam workload-identity-pools create "$WIF_POOL" \
    --project="$PROJECT_ID" \
    --location="global" \
    --display-name="GitHub Actions Pool"
  log "WIF pool created ✓"
fi

PROVIDER_FULL="${WIF_POOL_NAME}/providers/${WIF_PROVIDER}"
if gcloud iam workload-identity-pools providers describe "$WIF_PROVIDER" \
    --workload-identity-pool="$WIF_POOL" \
    --location=global --project "$PROJECT_ID" >/dev/null 2>&1; then
  warn "WIF provider $WIF_PROVIDER already exists — skipping."
else
  gcloud iam workload-identity-pools providers create-oidc "$WIF_PROVIDER" \
    --project="$PROJECT_ID" \
    --location="global" \
    --workload-identity-pool="$WIF_POOL" \
    --display-name="GitHub OIDC" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
    --issuer-uri="https://token.actions.githubusercontent.com"
  log "WIF provider created ✓"
fi

# Allow GitHub Actions for this repo to impersonate the deploy SA
REPO_PRINCIPAL="principalSet://iam.googleapis.com/${WIF_POOL_NAME}/attribute.repository/${GITHUB_REPO}"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA_EMAIL" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="$REPO_PRINCIPAL" \
  >/dev/null
log "WIF → deploy SA binding set ✓"

# ── 5. Cloud SQL ──────────────────────────────────────────────────────────────
section "Cloud SQL (Postgres 16)"
if gcloud sql instances describe "$SQL_INSTANCE" \
    --project "$PROJECT_ID" >/dev/null 2>&1; then
  warn "Cloud SQL instance $SQL_INSTANCE already exists — skipping creation."
else
  log "Creating Cloud SQL instance $SQL_INSTANCE ($SQL_TIER) — this takes ~5 min…"
  gcloud sql instances create "$SQL_INSTANCE" \
    --project="$PROJECT_ID" \
    --database-version=POSTGRES_16 \
    --tier="$SQL_TIER" \
    --region="$REGION" \
    --storage-size=10GB \
    --storage-auto-increase \
    --no-assign-ip \
    --enable-google-private-path
  log "Cloud SQL instance created ✓"
fi

gcloud sql databases describe "$DB_NAME" \
    --instance="$SQL_INSTANCE" --project "$PROJECT_ID" >/dev/null 2>&1 \
  || gcloud sql databases create "$DB_NAME" \
      --instance="$SQL_INSTANCE" --project "$PROJECT_ID"
log "Database $DB_NAME ✓"

CONN_NAME="$(gcloud sql instances describe "$SQL_INSTANCE" \
  --project "$PROJECT_ID" --format='value(connectionName)')"
info "Connection name: $CONN_NAME"

# ── 6. Secret Manager ─────────────────────────────────────────────────────────
section "Secret Manager"

create_or_update_secret() {
  local name="$1" value="$2"
  if gcloud secrets describe "$name" --project "$PROJECT_ID" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" \
      --data-file=- --project "$PROJECT_ID" >/dev/null
    info "Updated secret: $name"
  else
    printf '%s' "$value" | gcloud secrets create "$name" \
      --data-file=- --project "$PROJECT_ID" \
      --replication-policy=automatic >/dev/null
    info "Created secret: $name"
  fi
}

# DB password
if gcloud secrets describe "lux-auto-db-password" --project "$PROJECT_ID" >/dev/null 2>&1; then
  DB_PASS="$(gcloud secrets versions access latest --secret=lux-auto-db-password --project "$PROJECT_ID")"
  warn "DB password already in GSM — reusing."
else
  DB_PASS="$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)"
  create_or_update_secret "lux-auto-db-password" "$DB_PASS"
fi

# Set Cloud SQL user password
gcloud sql users set-password "$DB_USER" \
  --instance="$SQL_INSTANCE" \
  --project="$PROJECT_ID" \
  --password="$DB_PASS" 2>/dev/null \
  || gcloud sql users create "$DB_USER" \
      --instance="$SQL_INSTANCE" \
      --project="$PROJECT_ID" \
      --password="$DB_PASS"
log "DB user $DB_USER ✓"

# Full DATABASE_URL (Cloud Run connects via unix socket through Cloud SQL proxy)
DATABASE_URL="postgresql+psycopg2://${DB_USER}:${DB_PASS}@/${DB_NAME}?host=/cloudsql/${CONN_NAME}"
create_or_update_secret "lux-auto-database-url" "$DATABASE_URL"

# FastAPI secret key
FASTAPI_SK="$(openssl rand -base64 48)"
create_or_update_secret "lux-auto-secret-key" "$FASTAPI_SK"

log "Secrets written to Secret Manager ✓"

# ── 7. Grant Cloud Run runtime SA access to secrets ───────────────────────────
section "Secret IAM bindings"
RUNTIME_SA="${PROJECT_NUM}-compute@developer.gserviceaccount.com"
for secret in lux-auto-database-url lux-auto-secret-key; do
  gcloud secrets add-iam-policy-binding "$secret" \
    --project="$PROJECT_ID" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    >/dev/null
  gcloud secrets add-iam-policy-binding "$secret" \
    --project="$PROJECT_ID" \
    --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    >/dev/null
done
log "Runtime SA secret access ✓"

# ── 8. Compute GitHub secret values ───────────────────────────────────────────
section "GitHub Actions Secrets"
GCP_WIF_PROVIDER="projects/${PROJECT_NUM}/locations/global/workloadIdentityPools/${WIF_POOL}/providers/${WIF_PROVIDER}"
GCP_DEPLOY_SA="$DEPLOY_SA_EMAIL"

if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  log "gh CLI detected — setting GitHub secrets automatically…"
  gh secret set GCP_WIF_PROVIDER  --repo "$GITHUB_REPO" --body "$GCP_WIF_PROVIDER"
  gh secret set GCP_DEPLOY_SA     --repo "$GITHUB_REPO" --body "$GCP_DEPLOY_SA"
  gh secret set GCP_PROJECT_ID    --repo "$GITHUB_REPO" --body "$PROJECT_ID"
  gh secret set GCP_REGION        --repo "$GITHUB_REPO" --body "$REGION"
  gh secret set CLOUDSQL_CONN     --repo "$GITHUB_REPO" --body "$CONN_NAME"
  log "GitHub secrets set via gh CLI ✓"
  echo ""
  echo -e "${GREEN}All GitHub secrets populated. CI is ready.${NC}"
  echo -e "To add the CLASPRC_JSON + SCRIPT_ID for the Apps Script workflow:"
  echo -e "  ${CYAN}cd webapp && bash bootstrap-cloudshell.sh${NC}"
else
  warn "gh CLI not found or not authenticated — paste these manually:"
  echo ""
  echo -e "${YELLOW}Go to: github.com/${GITHUB_REPO}/settings/secrets/actions${NC}"
  echo ""
  echo -e "  GCP_WIF_PROVIDER  =  ${GCP_WIF_PROVIDER}"
  echo -e "  GCP_DEPLOY_SA     =  ${GCP_DEPLOY_SA}"
  echo -e "  GCP_PROJECT_ID    =  ${PROJECT_ID}"
  echo -e "  GCP_REGION        =  ${REGION}"
  echo -e "  CLOUDSQL_CONN     =  ${CONN_NAME}"
  echo ""
  echo -e "Or run: ${CYAN}gh auth login && bash $0${NC}  to have it done automatically."
fi

# ── 9. Summary ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  Lux Auto GCP Bootstrap Complete${NC}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  GCP Project      : ${CYAN}${PROJECT_ID}${NC}"
echo -e "  Region           : ${CYAN}${REGION}${NC}"
echo -e "  Cloud SQL        : ${CYAN}${CONN_NAME}${NC}"
echo -e "  Artifact Registry: ${CYAN}${IMAGE_BASE}${NC}"
echo -e "  Deploy SA        : ${CYAN}${DEPLOY_SA_EMAIL}${NC}"
echo -e "  WIF Provider     : ${CYAN}${GCP_WIF_PROVIDER}${NC}"
echo ""
echo -e "  Next steps:"
echo -e "  1. If not done: ${CYAN}cd webapp && bash bootstrap-cloudshell.sh${NC}"
echo -e "     (sets CLASPRC_JSON + SCRIPT_ID for the Apps Script workflow)"
echo -e "  2. Merge the PR into main — Cloud Run deploys automatically."
echo -e "  3. Check CI:  ${CYAN}gh run list --repo ${GITHUB_REPO}${NC}"
echo -e "  4. Health:    ${CYAN}gcloud run services describe lux-auto-api --region ${REGION}${NC}"
echo ""
