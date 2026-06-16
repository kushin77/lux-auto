#!/usr/bin/env bash
#
# Lux-Auto — Production Cloud Run deploy (Cloud SQL Postgres + Secret Manager).
# Wires the FastAPI backend to a managed Postgres and pulls secrets from the
# existing GSM project, matching the repo's security model.
#
# Discovered from the repo:
#   GCP/GSM project : lux-auto
#   Container       : Dockerfile.backend (uvicorn backend.main:app on :8000)
#   DB (terraform)  : database=lux_prod  user=lux_admin  port=5432
#   GSM secrets     : lux-fastapi-secret-key, lux-db-password,
#                     lux-google-oauth-client-id/-secret, lux-oauth2-cookie-secret
#
# Run from the root of a local checkout of github.com/kushin77/lux-auto
# (merge PR #103 first for the functional deal/buyer/analytics endpoints).
# Prereqs: gcloud authenticated, billing enabled, you have roles to create
# Cloud SQL + manage Secret Manager + deploy Cloud Run.
set -euo pipefail

# ── Settings ────────────────────────────────────────────────────────────────
PROJECT_ID="lux-auto"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-lux-auto-api}"
SQL_INSTANCE="${SQL_INSTANCE:-lux-pg}"
DB_NAME="lux_prod"
DB_USER="lux_admin"
SQL_TIER="${SQL_TIER:-db-f1-micro}"     # smallest; bump to db-g1-small for prod load

echo "▶ Project=$PROJECT_ID Region=$REGION Service=$SERVICE SQL=$SQL_INSTANCE"
gcloud config set project "$PROJECT_ID" >/dev/null

# ── APIs ────────────────────────────────────────────────────────────────────
echo "▶ Enabling APIs…"
gcloud services enable \
  run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  sqladmin.googleapis.com secretmanager.googleapis.com

# ── DB password from GSM (already stored per the repo) ──────────────────────
echo "▶ Reading DB password from Secret Manager (lux-db-password)…"
DB_PASS="$(gcloud secrets versions access latest --secret=lux-db-password)"

# ── Cloud SQL Postgres (idempotent) ─────────────────────────────────────────
if ! gcloud sql instances describe "$SQL_INSTANCE" >/dev/null 2>&1; then
  echo "▶ Creating Cloud SQL instance $SQL_INSTANCE (Postgres 16, $SQL_TIER)…"
  gcloud sql instances create "$SQL_INSTANCE" \
    --database-version=POSTGRES_16 --tier="$SQL_TIER" --region="$REGION" \
    --storage-size=10GB --storage-auto-increase
else
  echo "▶ Cloud SQL instance $SQL_INSTANCE already exists."
fi

gcloud sql databases describe "$DB_NAME" --instance="$SQL_INSTANCE" >/dev/null 2>&1 \
  || gcloud sql databases create "$DB_NAME" --instance="$SQL_INSTANCE"

gcloud sql users describe "$DB_USER" --instance="$SQL_INSTANCE" >/dev/null 2>&1 \
  || gcloud sql users create "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASS"

CONN_NAME="$(gcloud sql instances describe "$SQL_INSTANCE" --format='value(connectionName)')"
echo "▶ Cloud SQL connection name: $CONN_NAME"

# ── Store the full DATABASE_URL in GSM (keeps the password out of plaintext env) ─
# Cloud Run reaches Cloud SQL over a unix socket at /cloudsql/<CONNECTION_NAME>.
DATABASE_URL="postgresql+psycopg2://${DB_USER}:${DB_PASS}@/${DB_NAME}?host=/cloudsql/${CONN_NAME}"
if gcloud secrets describe lux-database-url >/dev/null 2>&1; then
  printf '%s' "$DATABASE_URL" | gcloud secrets versions add lux-database-url --data-file=-
else
  printf '%s' "$DATABASE_URL" | gcloud secrets create lux-database-url --data-file=- --replication-policy=automatic
fi

# ── Grant the Cloud Run runtime service account access to the secrets ───────
PROJECT_NUM="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUM}-compute@developer.gserviceaccount.com"
echo "▶ Granting secretAccessor to $RUNTIME_SA…"
for S in lux-database-url lux-fastapi-secret-key; do
  gcloud secrets add-iam-policy-binding "$S" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
done

# ── Build context: stage Dockerfile.backend as Dockerfile for --source ──────
CLEANUP=0
if [[ ! -f Dockerfile && -f Dockerfile.backend ]]; then cp Dockerfile.backend Dockerfile; CLEANUP=1; fi
trap '[[ $CLEANUP -eq 1 ]] && rm -f Dockerfile' EXIT

# ── Deploy (private; front with oauth2-proxy/IAP for Google SSO) ────────────
echo "▶ Deploying $SERVICE to Cloud Run…"
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --port 8000 \
  --no-allow-unauthenticated \
  --add-cloudsql-instances "$CONN_NAME" \
  --memory 1Gi --cpu 1 --min-instances 0 --max-instances 10 \
  --set-secrets "DATABASE_URL=lux-database-url:latest,FASTAPI_SECRET_KEY=lux-fastapi-secret-key:latest" \
  --set-env-vars "ADMIN_USER_EMAIL=akushnir@bioenergystrategies.com,ENVIRONMENT=production,LOG_LEVEL=INFO"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
echo "✓ Deployed: $URL  (private — requires auth/oauth2-proxy)"
cat <<NOTES

────────────────────────────────────────────────────────────────────────────
• Service is private (--no-allow-unauthenticated). Reach it by fronting with
  oauth2-proxy (the repo's Google-SSO model) or grant yourself run.invoker and
  use an identity token:
    TOKEN=\$(gcloud auth print-identity-token)
    curl -H "Authorization: Bearer \$TOKEN" $URL/health
• Functional deal/buyer/analytics endpoints require PR #103 merged.
• To rotate config later, just re-run; all steps are idempotent.
────────────────────────────────────────────────────────────────────────────
NOTES
