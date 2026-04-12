#!/bin/bash
#
# Lux-Auto Dependency Vulnerability Scanning
# Scans Python dependencies for known vulnerabilities
# REQUIRED: Must pass before deployment
#
# Usage: bash scripts/scan-dependencies.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

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
echo -e "${BLUE}  Lux-Auto Dependency Vulnerability Scan${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

SCAN_FAILED=0

# 1. pip-audit (Python package vulnerabilities)
log_info "Scanning Python dependencies with pip-audit..."

if command -v pip-audit &> /dev/null; then
    if pip-audit --desc --skip-editable --require-hashes 2>&1 | tee /tmp/pip-audit.log; then
        log_success "pip-audit scan passed"
    else
        VULN_COUNT=$(grep -c "^✓" /tmp/pip-audit.log || echo 0)
        if [[ $VULN_COUNT -gt 0 ]]; then
            log_error "Found $VULN_COUNT Python vulnerabilities"
            ((SCAN_FAILED++))
        else
            log_success "No critical Python vulnerabilities found"
        fi
    fi
else
    log_warning "pip-audit not installed (pip install pip-audit)"
    log_info "Installing pip-audit..."
    pip install pip-audit >/dev/null 2>&1 || {
        log_error "Failed to install pip-audit"
        ((SCAN_FAILED++))
    }
fi

# 2. safety (Alternative Python vulnerability scanner)
log_info "Checking Python dependencies with safety..."

if command -v safety &> /dev/null; then
    if safety check --json --requirement "$PROJECT_ROOT/backend/requirements.txt" 2>&1 | tee /tmp/safety.log; then
        log_success "Safety scan passed - no known vulnerabilities"
    else
        log_error "Safety check found vulnerabilities"
        cat /tmp/safety.log | head -20
        ((SCAN_FAILED++))
    fi
else
    log_warning "safety not installed (pip install safety)"
fi

# 3. Check for outdated packages
log_info "Checking for outdated Python packages..."

if command -v pip &> /dev/null; then
    OUTDATED=$(pip list --outdated 2>/dev/null | grep -v "^Package\|^---" || true)
    
    if [[ -n "$OUTDATED" ]]; then
        log_warning "Outdated packages found (consider updating):"
        echo "$OUTDATED" | head -10 | sed 's/^/  /'
        
        OUTDATED_COUNT=$(echo "$OUTDATED" | wc -l)
        log_warning "Total: $OUTDATED_COUNT packages outdated"
    else
        log_success "All packages up-to-date"
    fi
else
    log_error "pip not found"
    ((SCAN_FAILED++))
fi

# 4. Check for 'bad' packages (typosquatting, malware)
log_info "Checking for suspicious packages..."

SUSPICIOUS_PACKAGES=()

# Known risky packages to avoid
BLOCKED_PACKAGES=(
    "nmap"           # Network scanning tool
    "paramiko"       # SSH client (use with caution)
    "pycurl"         # HTTP requests (use httpx instead)
)

INSTALLED_PACKAGES=$(pip list 2>/dev/null | awk '{print $1}' | tr '[:upper:]' '[:lower:]')

for blocked in "${BLOCKED_PACKAGES[@]}"; do
    if echo "$INSTALLED_PACKAGES" | grep -q "^$blocked\$"; then
        log_warning "Potentially risky package found: $blocked"
        SUSPICIOUS_PACKAGES+=("$blocked")
    fi
done

if [[ ${#SUSPICIOUS_PACKAGES[@]} -gt 0 ]]; then
    log_error "Found ${#SUSPICIOUS_PACKAGES[@]} potentially risky packages"
    for pkg in "${SUSPICIOUS_PACKAGES[@]}"; do
        echo "  - $pkg"
    done
    ((SCAN_FAILED++))
else
    log_success "No known suspicious packages found"
fi

# 5. Check for cryptographic vulnerabilities
log_info "Checking cryptographic package versions..."

CRYPTO_CHECK=$(pip show cryptography 2>/dev/null | grep Version || echo "not installed")
log_info "Cryptography version: $CRYPTO_CHECK"

# 6. License compliance check
log_info "Checking package licenses..."

if command -v licensecheck &> /dev/null; then
    licensecheck --fail-on GPL --fail-on AGPL "$PROJECT_ROOT/backend/requirements.txt" 2>/dev/null || {
        log_warning "Some GPL-licensed packages detected"
    }
else
    log_warning "licensecheck not installed (pip install licenseheaders)"
fi

# Summary
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Dependency Scan Results${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

if [[ $SCAN_FAILED -eq 0 ]]; then
    log_success "All dependency scans passed"
    echo -e "\n${GREEN}✓ Dependency scan PASSED${NC}\n"
    exit 0
else
    log_error "Found $SCAN_FAILED scan failures"
    echo -e "\n${RED}✗ Dependency scan FAILED${NC}"
    echo -e "${RED}Update vulnerable packages before deploying:${NC}\n"
    echo "  pip install --upgrade [package_name]"
    echo "  pip install -r backend/requirements.txt --upgrade"
    echo ""
    exit 1
fi
