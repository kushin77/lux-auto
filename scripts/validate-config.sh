#!/bin/bash
#
# Lux-Auto Pre-Deployment Validation Script
# Validates all configuration and secrets before deployment
# Required: ALL checks must PASS before proceeding to deployment
#
# Usage: bash scripts/validate-config.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track validation results
VALIDATION_PASSED=0
VALIDATION_FAILED=0

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
    ((VALIDATION_PASSED++))
}

log_error() {
    echo -e "${RED}✗${NC} $1"
    ((VALIDATION_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if running from project root
if [[ ! -f "$PROJECT_ROOT/docker-compose.yml" ]]; then
    log_error "docker-compose.yml not found. Please run from project root."
    exit 1
fi

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Lux-Auto Pre-Deployment Validation${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

# 1. Check environment setup
log_info "Checking environment configuration..."

if [[ -f "$PROJECT_ROOT/.env" ]]; then
    log_success "Found .env file"
    source "$PROJECT_ROOT/.env"
else
    log_warning ".env not found, checking for required variables in shell environment"
fi

# 2. Validate required environment variables
log_info "Validating required environment variables..."

REQUIRED_VARS=(
    "GOOGLE_CLIENT_ID"
    "GOOGLE_CLIENT_SECRET"
    "OAUTH2_PROXY_COOKIE_SECRET"
    "FASTAPI_SECRET_KEY"
    "DATABASE_PASSWORD"
    "DOMAIN"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var}" ]]; then
        log_error "Missing environment variable: $var"
    else
        log_success "Found $var"
    fi
done

# 3. Check Docker installation
log_info "Checking Docker installation..."

if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    log_success "Docker installed: $DOCKER_VERSION"
else
    log_error "Docker is not installed or not in PATH"
fi

# 4. Check Docker Compose
log_info "Checking Docker Compose..."

if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    if command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version)
    else
        COMPOSE_VERSION=$(docker compose version)
    fi
    log_success "Docker Compose installed: $COMPOSE_VERSION"
else
    log_error "Docker Compose is not installed"
fi

# 5. Validate docker-compose.yml
log_info "Validating docker-compose.yml syntax..."

if docker compose -f "$PROJECT_ROOT/docker-compose.yml" config > /dev/null 2>&1; then
    log_success "docker-compose.yml is valid"
else
    log_error "docker-compose.yml has syntax errors"
fi

# 6. Check required files exist
log_info "Checking required files..."

REQUIRED_FILES=(
    "Dockerfile.backend"
    "Caddyfile.tpl"
    "backend/main.py"
    "backend/requirements.txt"
    "backend/auth/middleware.py"
    "backend/auth/user_service.py"
    "backend/auth/session_service.py"
    "backend/database/models.py"
    "scripts/fetch-gsm-secrets.sh"
    ".env.example"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [[ -f "$PROJECT_ROOT/$file" ]]; then
        log_success "Found $file"
    else
        log_error "Missing required file: $file"
    fi
done

# 7. Check database connectivity (if .env is set)
if [[ -n "$DATABASE_URL" ]]; then
    log_info "Checking prerequisites for database..."
    
    if command -v psql &> /dev/null; then
        log_success "PostgreSQL client available"
    else
        log_warning "PostgreSQL client not installed (will work once Docker starts)"
    fi
fi

# 8. Validate DNSmask (if DNS configured)
if [[ -n "$DOMAIN" ]]; then
    log_info "Checking domain configuration..."
    
    if [[ "$DOMAIN" == "localhost" ]] || [[ "$DOMAIN" == "127.0.0.1" ]]; then
        log_success "Using localhost domain for development"
    else
        log_warning "Using production domain: $DOMAIN (ensure DNS is configured)"
    fi
fi

# 9. Check Python (for local testing)
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    log_success "Python installed: $PYTHON_VERSION"
else
    log_warning "Python3 not found (will work in Docker)"
fi

# 10. Check for credential files
log_info "Checking security..."

if grep -r "GOOGLE_CLIENT_SECRET\|FASTAPI_SECRET_KEY\|DATABASE_PASSWORD" "$PROJECT_ROOT/backend/" "$PROJECT_ROOT/.git/" 2>/dev/null | grep -qv "\.env\|requirements\|example"; then
    log_error "Potential credentials found in source code (should only be in .env)"
else
    log_success "No credentials found in source code"
fi

# 11. Check .gitignore for secrets
if grep -q "^\.env$" "$PROJECT_ROOT/.gitignore" 2>/dev/null; then
    log_success ".env is in .gitignore"
else
    log_warning ".env not in .gitignore (add it to prevent credential leaks)"
fi

# 12. Validate port availability
log_info "Checking port availability..."

PORTS=(80 443 5432 8000 4180 6379)
for port in "${PORTS[@]}"; do
    if ! netstat -tuln 2>/dev/null | grep -q ":$port " && ! lsof -i ":$port" 2>/dev/null; then
        log_success "Port $port is available"
    else
        log_warning "Port $port is in use (may cause Docker binding issues)"
    fi
done

# 13. Test Docker connectivity
log_info "Testing Docker connectivity..."

if docker ps > /dev/null 2>&1; then
    DOCKER_INFO=$(docker info --format='{{json .}}' 2>/dev/null | grep -o '"Name":"[^"]*"' | head -1)
    log_success "Docker daemon is running and accessible"
else
    log_error "Cannot connect to Docker daemon. Check Docker installation."
fi

# 14. Check git configuration
log_info "Checking Git configuration..."

if [[ -d "$PROJECT_ROOT/.git" ]]; then
    log_success "Git repository initialized"
    
    # Check for pre-commit hook
    if [[ -x "$PROJECT_ROOT/.git/hooks/pre-commit" ]]; then
        log_success "Pre-commit hooks configured"
    else
        log_warning "Pre-commit hooks not configured"
    fi
else
    log_warning "Not a git repository"
fi

# Summary
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Validation Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

echo -e "${GREEN}✓ Passed:${NC} $VALIDATION_PASSED"
echo -e "${RED}✗ Failed:${NC} $VALIDATION_FAILED"

if [[ $VALIDATION_FAILED -gt 0 ]]; then
    echo -e "\n${RED}⚠ Validation FAILED - Fix errors before proceeding${NC}\n"
    exit 1
else
    echo -e "\n${GREEN}✓ All validations passed! Ready for deployment.${NC}\n"
    exit 0
fi
