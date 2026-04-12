#!/bin/bash
set -euo pipefail

# Fetch Secrets from Google Secret Manager
# 
# This script retrieves all OAuth credentials and secrets from Google Secret Manager
# and exports them as environment variables.
#
# Usage: source scripts/fetch-gsm-secrets.sh
#
# Requirements:
# - gcloud CLI installed and authenticated
# - Service account with secretmanager.secretAccessor role
# - Secrets created in Google Secret Manager
#
# Reference: https://github.com/kushin77/code-server/blob/main/scripts/fetch-gsm-secrets.sh

set +u  # Disable unset variable check for this script

# Configuration
GSM_PROJECT="${GSM_PROJECT:-lux-auto}"
QUIET="${QUIET:-false}"

# Logging functions
log() { 
    if [[ "$QUIET" != "true" ]]; then
        echo "[GSM] $*" >&2
    fi
}
error() { 
    echo "[ERROR] $*" >&2
    exit 1
}

# Check prerequisites
if ! command -v gcloud &>/dev/null; then
    error "gcloud CLI not installed. Install: https://cloud.google.com/sdk/docs/install"
fi

# Function to fetch a secret from GSM
fetch_gsm_secret() {
    local SECRET_ID=$1
    local ENV_VAR=$2
    
    log "Fetching $SECRET_ID from GSM project '$GSM_PROJECT'..."
    
    # Try to fetch the secret
    if SECRET_VALUE=$(gcloud secrets versions access latest \
        --secret="$SECRET_ID" \
        --project="$GSM_PROJECT" 2>/dev/null); then
        
        export "$ENV_VAR=$SECRET_VALUE"
        log "✓ $ENV_VAR exported"
    else
        error "Failed to fetch secret: $SECRET_ID from project: $GSM_PROJECT"
    fi
}

# Fetch all secrets
log "Starting secret retrieval from GSM..."
log ""

fetch_gsm_secret "lux-google-oauth-client-id" "GOOGLE_CLIENT_ID"
fetch_gsm_secret "lux-google-oauth-client-secret" "GOOGLE_CLIENT_SECRET"
fetch_gsm_secret "lux-oauth2-cookie-secret" "OAUTH2_PROXY_COOKIE_SECRET"
fetch_gsm_secret "lux-fastapi-secret-key" "FASTAPI_SECRET_KEY"
fetch_gsm_secret "lux-db-password" "DATABASE_PASSWORD"

log ""
log "✓ All secrets fetched successfully from GSM"
log ""

# Verify secrets are set
log "Verifying secrets are available as environment variables..."
for var in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET OAUTH2_PROXY_COOKIE_SECRET FASTAPI_SECRET_KEY DATABASE_PASSWORD; do
    if [[ -z "${!var:-}" ]]; then
        error "$var is not set"
    fi
done

log "✓ All required environment variables are set"

set +u
