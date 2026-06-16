#!/usr/bin/env bash
#
# Lux-Auto — App-only Cloud Run deploy (no external database).
# Boots the FastAPI backend on Cloud Run with an ephemeral SQLite DB so
# /health, /docs, /metrics, /openapi.json come up. DB-backed endpoints
# (deals/buyers/analytics) stay dormant until you attach Cloud SQL.
#
# Config discovered from the repo:
#   GCP project : lux-auto            (GSM project; see scripts/fetch-gsm-secrets.sh)
#   Container   : Dockerfile.backend  (uvicorn backend.main:app on :8000)
#   GSM secrets : lux-fastapi-secret-key, lux-db-password, lux-google-oauth-*, lux-oauth2-cookie-secret
#
# Run from the root of a local checkout of github.com/kushin77/lux-auto.
# Prereqs: gcloud authenticated (`gcloud auth login`) + billing enabled on the project.
set -euo pipefail

# ── Settings ────────────────────────────────────────────────────────────────
PROJECT_ID="lux-auto"
REGION="${REGION:-us-central1}"      # adjust if your resources live elsewhere
SERVICE="${SERVICE:-lux-auto-api}"

echo "▶ Project: $PROJECT_ID | Region: $REGION | Service: $SERVICE"
gcloud config set project "$PROJECT_ID" >/dev/null

# ── Enable required APIs (idempotent) ───────────────────────────────────────
echo "▶ Enabling APIs (run, cloudbuild, artifactregistry)…"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com

# ── Build context: Cloud Run --source wants a file literally named Dockerfile ─
# The repo ships Dockerfile.backend, so stage a copy for the build.
CLEANUP_DOCKERFILE=0
if [[ ! -f Dockerfile && -f Dockerfile.backend ]]; then
  cp Dockerfile.backend Dockerfile
  CLEANUP_DOCKERFILE=1
fi
trap '[[ $CLEANUP_DOCKERFILE -eq 1 ]] && rm -f Dockerfile' EXIT

# ── App-only runtime config ─────────────────────────────────────────────────
# SQLite on the container's writable /tmp → no external DB needed for this smoke deploy.
DB_URL="sqlite:////tmp/lux.db"
# Throwaway secret for the smoke test (the app only requires it to be non-empty).
SECRET_KEY="$(openssl rand -base64 36 2>/dev/null || head -c 27 /dev/urandom | base64)"

echo "▶ Deploying to Cloud Run (app-only, allow-unauthenticated for smoke test)…"
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --port 8000 \
  --allow-unauthenticated \
  --memory 512Mi --cpu 1 --min-instances 0 --max-instances 3 \
  --set-env-vars "DATABASE_URL=${DB_URL},FASTAPI_SECRET_KEY=${SECRET_KEY},ADMIN_USER_EMAIL=akushnir@bioenergystrategies.com,ENVIRONMENT=staging,LOG_LEVEL=INFO"

# ── Verify ──────────────────────────────────────────────────────────────────
URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
echo "▶ Service URL: $URL"
echo "▶ Health check:"
curl -fsS "$URL/health" && echo
echo "✓ Done.  Try:  $URL/docs   |   $URL/openapi.json"

cat <<NOTES

────────────────────────────────────────────────────────────────────────────
NEXT STEPS / PRODUCTION NOTES
• This is app-only and PUBLIC (--allow-unauthenticated) for the smoke test.
  Lock it down before real use:
    gcloud run services update $SERVICE --region $REGION --no-allow-unauthenticated
  and front it with oauth2-proxy / IAP (matches the repo's Google-SSO model).

• Use the real secret from Secret Manager instead of a throwaway:
    --set-secrets "FASTAPI_SECRET_KEY=lux-fastapi-secret-key:latest"
  (grant the Cloud Run runtime SA roles/secretmanager.secretAccessor first.)

• Attach a database (Cloud SQL Postgres) when ready, then swap DATABASE_URL:
    gcloud sql instances create lux-pg --database-version=POSTGRES_16 \\
      --tier=db-f1-micro --region=$REGION
    gcloud run services update $SERVICE --region $REGION \\
      --add-cloudsql-instances $PROJECT_ID:$REGION:lux-pg \\
      --update-env-vars "DATABASE_URL=postgresql+psycopg2://lux_admin:PASS@/lux_prod?host=/cloudsql/$PROJECT_ID:$REGION:lux-pg"
  (DB password is in GSM: lux-db-password.)

• The DB-backed endpoints (deals/buyers/analytics) only work once a real
  Postgres is attached AND PR #103 is merged (cross-dialect ORM + functional
  routers). On SQLite here, /health, /docs, /metrics, /openapi.json work.
────────────────────────────────────────────────────────────────────────────
NOTES
