#!/usr/bin/env bash
# Deploy the Lux-Auto API to Google Cloud Run (Google-native, gcloud CLI).
# Run from the repo root.  Requires: gcloud, a GCP project, Cloud SQL Postgres.
#
#   PROJECT_ID=my-proj REGION=us-central1 \
#   CLOUDSQL_INSTANCE=my-proj:us-central1:luxauto \
#   ./backend/deploy/cloud-run.sh
set -euo pipefail

: "${PROJECT_ID:?set PROJECT_ID}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-lux-auto-api}"
CLOUDSQL_INSTANCE="${CLOUDSQL_INSTANCE:?set CLOUDSQL_INSTANCE (project:region:instance)}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/lux-auto/${SERVICE}:$(git rev-parse --short HEAD 2>/dev/null || echo latest)"

echo "→ Building image: ${IMAGE}"
gcloud builds submit --project "${PROJECT_ID}" \
  --tag "${IMAGE}" \
  --gcloud-ignore-file .gcloudignore .

echo "→ Deploying to Cloud Run: ${SERVICE} (${REGION})"
# Secrets (DATABASE_URL, FASTAPI_SECRET_KEY) come from Secret Manager.
gcloud run deploy "${SERVICE}" --project "${PROJECT_ID}" --region "${REGION}" \
  --image "${IMAGE}" \
  --platform managed \
  --add-cloudsql-instances "${CLOUDSQL_INSTANCE}" \
  --set-env-vars "ENVIRONMENT=production,LOG_LEVEL=INFO,ADMIN_USER_EMAIL=${ADMIN_USER_EMAIL:-}" \
  --set-secrets "DATABASE_URL=lux-auto-database-url:latest,FASTAPI_SECRET_KEY=lux-auto-secret-key:latest" \
  --no-allow-unauthenticated \
  --port 8080 \
  --cpu 1 --memory 512Mi --min-instances 0 --max-instances 10

echo "✓ Deployed. Front this service with oauth2-proxy for Google SSO."
echo "  Logs:  gcloud run services logs read ${SERVICE} --region ${REGION} --project ${PROJECT_ID}"
