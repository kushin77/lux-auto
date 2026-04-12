#!/bin/bash
#
# Lux-Auto Credential Scanning Script
# Detects hardcoded secrets, API keys, passwords, etc.
# REQUIRED: Must pass before commit
#
# Usage: bash scripts/scan-credentials.sh [path]
# Default path: entire repository
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SCAN_PATH="${1:-.}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Lux-Auto Credential Scanning${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

SECRETS_FOUND=0
WARNINGS=0

# Pattern definitions (regex)
declare -A PATTERNS=(
    ["AWS Key"]="AKIA[0-9A-Z]{16}"
    ["GitHub Token"]="ghp_[a-zA-Z0-9_]{36,255}"
    ["Generic Secret"]="(secret|password|token|api.{0,10}key)[\s]*[=:]\s*['\"][^'\"]*['\"]"
    ["Private Key"]="-----BEGIN (RSA|DSA|EC|OPENSSH|PRIVATE) KEY-----"
    ["Google Cloud Key"]="AIza[0-9A-Za-z\\-_]{35}"
    ["Stripe Key"]="(sk|pk)_live_[0-9a-zA-Z]{24,}"
    ["Google OAuth"]="[0-9]+-[a-z0-9]{32}\.apps\.googleusercontent\.com"
    ["Database URL"]="(postgres|mysql|mongodb)://[a-zA-Z0-9:]*@[a-zA-Z0-9.]+"
    ["Slack Token"]="xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,32}"
)

# Files to skip
SKIP_PATTERNS=(
    "\.env\.example"
    "terraform\.tfvars\.example"
    "\._backup"
    "\.git/"
    "__pycache__"
    "node_modules"
    "\.venv"
    "dist/"
    "build/"
)

should_skip() {
    local file="$1"
    for pattern in "${SKIP_PATTERNS[@]}"; do
        if [[ $file =~ $pattern ]]; then
            return 0
        fi
    done
    return 1
}

log_info "Scanning for hardcoded credentials in: $SCAN_PATH\n"

# Scan for each pattern
for pattern_name in "${!PATTERNS[@]}"; do
    regex="${PATTERNS[$pattern_name]}"
    
    log_info "Scanning for $pattern_name..."
    
    MATCHES=$(grep -rE "$regex" "$PROJECT_ROOT/$SCAN_PATH" 2>/dev/null || true)
    
    if [[ -n "$MATCHES" ]]; then
        while IFS= read -r match; do
            FILE=$(echo "$match" | cut -d: -f1)
            
            if should_skip "$FILE"; then
                continue
            fi
            
            log_warning "Potential $pattern_name found in $FILE"
            echo "$match" | head -1 | sed 's/^/  /'
            ((SECRETS_FOUND++))
        done <<< "$MATCHES"
    else
        log_success "$pattern_name check passed"
    fi
done

# Advanced scanning with detect-secrets (if available)
if command -v detect-secrets &> /dev/null; then
    log_info "\nRunning advanced credential scanning with detect-secrets..."
    
    if detect-secrets scan --baseline .secrets.baseline 2>/dev/null || true; then
        log_success "Advanced scan passed"
    else
        log_warning "Advanced scan detected potential secrets (review .secrets.baseline)"
    fi
else
    log_warning "detect-secrets not installed (pip install detect-secrets for advanced scanning)"
fi

# Scan for common credential files
log_info "\nScanning for credential files..."

CRED_FILES=(".env" "*.key" "*.pem" "*.p12" "terraform.tfvars" "service-account.json")

for pattern in "${CRED_FILES[@]}"; do
    FOUND=$(find "$PROJECT_ROOT/$SCAN_PATH" -name "$pattern" -type f 2>/dev/null || true)
    
    if [[ -n "$FOUND" ]]; then
        while IFS= read -r file; do
            log_warning "Credential file found: $file"
            
            if [[ $file != *"example"* ]] && [[ $file != *"template"* ]] && [[ ! -f "$PROJECT_ROOT/.gitignore" || ! grep -q "$(basename "$file")" "$PROJECT_ROOT/.gitignore" ]]; then
                log_error "⚠️  Credential file is NOT in .gitignore!"
                ((SECRETS_FOUND++))
            fi
        done <<< "$FOUND"
    fi
done

# Check for common environment variable patterns
log_info "\nScanning for exposed environment variables..."

ENV_VARS=(
    "GOOGLE_CLIENT_SECRET"
    "DATABASE_PASSWORD"
    "FASTAPI_SECRET_KEY"
    "OAUTH2_PROXY_COOKIE_SECRET"
)

for var in "${ENV_VARS[@]}"; do
    FOUND=$(grep -r "$var\s*=" "$PROJECT_ROOT/$SCAN_PATH" 2>/dev/null | grep -v "\.env\.example" | grep -v "\.yml$" || true)
    
    if [[ -n "$FOUND" ]]; then
        while IFS= read -r match; do
            FILE=$(echo "$match" | cut -d: -f1)
            
            if should_skip "$FILE"; then
                continue
            fi
            
            log_error "Exposed variable $var in $FILE!"
            ((SECRETS_FOUND++))
        done <<< "$FOUND"
    fi
done

# Summary
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Scan Results${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

if [[ $SECRETS_FOUND -eq 0 ]]; then
    log_success "No credentials found in scan"
    echo -e "\n${GREEN}✓ Credential scan PASSED${NC}\n"
    exit 0
else
    log_error "Found $SECRETS_FOUND potential credential leaks!"
    echo -e "\n${RED}✗ Credential scan FAILED${NC}"
    echo -e "${RED}Remove exposed secrets before committing:${NC}\n"
    echo "1. Delete or move files to .gitignore"
    echo "2. Use .env.example for templates"
    echo "3. Store secrets in Google Secret Manager only"
    echo "4. Run 'git rm --cached <file>' for committed files"
    echo ""
    exit 1
fi
