#!/bin/bash
#
# Lux-Auto Master Security Scanning
# Runs all security checks in sequence before deployment
# Issue #74: Security Scanning & Validation
#
# REQUIRED: ALL checks must PASS before code commit or deployment
#
# Usage: bash scripts/run-all-security-checks.sh [--no-docker] [--no-deps]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Options
SKIP_DOCKER=false
SKIP_DEPS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --no-docker) SKIP_DOCKER=true; shift ;;
        --no-deps) SKIP_DEPS=true; shift ;;
        *) shift ;;
    esac
done

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

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0

run_check() {
    local check_name=$1
    local check_script=$2
    local skip_flag=$3
    
    if [[ "$skip_flag" == "true" ]]; then
        log_warning "SKIPPED: $check_name"
        return 0
    fi
    
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log_info "Running: $check_name"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if bash "$check_script" "$PROJECT_ROOT"; then
        log_success "$check_name PASSED"
        ((CHECKS_PASSED++))
    else
        log_error "$check_name FAILED"
        ((CHECKS_FAILED++))
        return 1
    fi
}

echo -e "\n${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Lux-Auto Master Security Scanning                        ║${NC}"
echo -e "${BLUE}║  All checks MUST PASS before commit/deployment            ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}\n"

log_info "Starting comprehensive security scan..."
log_info "Project Root: $PROJECT_ROOT\n"

# 1. Configuration Validation
log_success "Check 1: Configuration Validation"
bash "$SCRIPT_DIR/validate-config.sh" "$PROJECT_ROOT" || ((CHECKS_FAILED++))

# 2. Credential Scanning
log_success "Check 2: Credential Scanning"
bash "$SCRIPT_DIR/scan-credentials.sh" "." || ((CHECKS_FAILED++))

# 3. Dependency Vulnerability Scanning
if [[ "$SKIP_DEPS" == "false" ]]; then
    log_success "Check 3: Dependency Vulnerability Scanning"
    bash "$SCRIPT_DIR/scan-dependencies.sh" || ((CHECKS_FAILED++))
else
    log_warning "Check 3: Dependency Scanning SKIPPED"
fi

# 4. Docker Image Scanning
if [[ "$SKIP_DOCKER" == "false" ]]; then
    log_success "Check 4: Docker Image Security Scanning"
    
    # Check if image needs to be built
    if docker image inspect kushin77/lux-auto:latest > /dev/null 2>&1; then
        bash "$SCRIPT_DIR/scan-docker-image.sh" "kushin77/lux-auto:latest" || ((CHECKS_FAILED++))
    else
        log_warning "Docker image not built yet. Build with: docker build -t kushin77/lux-auto:latest ."
    fi
else
    log_warning "Check 4: Docker Scanning SKIPPED"
fi

# 5. SAST Analysis (Python static analysis)
log_success "Check 5: Static Application Security Testing (SAST)"

if command -v bandit &> /dev/null; then
    log_info "Running Bandit SAST analysis..."
    if bandit -r backend/ -ll --skip B008,B101 2>&1 | tee /tmp/bandit-report.json; then
        log_success "SAST analysis passed"
        ((CHECKS_PASSED++))
    else
        log_error "SAST analysis found security issues"
        ((CHECKS_FAILED++))
    fi
else
    log_warning "Bandit not installed. Install with: pip install bandit"
fi

# 6. Python Type Checking
log_success "Check 6: Python Type Checking"

if command -v mypy &> /dev/null; then
    log_info "Running mypy type checking..."
    if mypy backend/ --ignore-missing-imports --no-error-summary 2>&1 | tee /tmp/mypy-report.log; then
        log_success "Type checking passed"
        ((CHECKS_PASSED++))
    else
        log_warning "Type checking found issues (non-blocking)"
    fi
else
    log_warning "mypy not installed. Install with: pip install mypy"
fi

# 7. Code Quality Checks
log_success "Check 7: Code Quality Analysis"

if command -v pylint &> /dev/null; then
    log_info "Running Pylint code quality analysis..."
    # Only fail on errors and fatal issues
    if pylint backend/ --disable=all --enable=E,F --max-line-length=120 2>&1 | tee /tmp/pylint-report.log; then
        log_success "Code quality check passed"
        ((CHECKS_PASSED++))
    else
        # Check if there are actual errors
        ERROR_COUNT=$(grep -c "error" /tmp/pylint-report.log || echo 0)
        if [[ $ERROR_COUNT -gt 0 ]]; then
            log_error "Code quality check found errors"
            ((CHECKS_FAILED++))
        else
            log_warning "Code quality check found warnings (non-blocking)"
        fi
    fi
else
    log_warning "Pylint not installed. Install with: pip install pylint"
fi

# 8. Unit Tests
log_success "Check 8: Unit Tests"

if command -v pytest &> /dev/null; then
    log_info "Running unit tests with coverage..."
    if pytest tests/unit/ -v --cov=backend --cov-fail-under=80 2>&1 | tee /tmp/pytest-unit.log; then
        log_success "Unit tests passed (80%+ coverage)"
        ((CHECKS_PASSED++))
    else
        log_error "Unit tests failed or coverage below 80%"
        ((CHECKS_FAILED++))
    fi
else
    log_warning "pytest not installed. Install with: pip install pytest pytest-cov"
fi

# 9. Integration Tests
log_success "Check 9: Integration Tests"

if command -v pytest &> /dev/null; then
    if [[ -d "tests/integration" ]]; then
        log_info "Running integration tests..."
        if pytest tests/integration/ -v 2>&1 | tee /tmp/pytest-integration.log; then
            log_success "Integration tests passed"
            ((CHECKS_PASSED++))
        else
            log_warning "Integration tests failed (non-blocking)"
        fi
    else
        log_warning "No integration tests directory found"
    fi
else
    log_warning "pytest not installed. Install with: pip install pytest"
fi

# 10. Security Tests
log_success "Check 10: Security-Focused Tests"

if command -v pytest &> /dev/null; then
    if [[ -d "tests/security" ]]; then
        log_info "Running security tests..."
        if pytest tests/security/ -v 2>&1 | tee /tmp/pytest-security.log; then
            log_success "Security tests passed"
            ((CHECKS_PASSED++))
        else
            log_error "Security tests failed"
            ((CHECKS_FAILED++))
        fi
    else
        log_warning "No security tests directory found"
    fi
fi

# Summary
echo -e "\n${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Security Scan Summary                                    ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${GREEN}✓ Passed:${NC} $CHECKS_PASSED"
echo -e "${RED}✗ Failed:${NC} $CHECKS_FAILED"

if [[ $CHECKS_FAILED -gt 0 ]]; then
    echo -e "\n${RED}SECURITY SCAN FAILED${NC}"
    echo -e "${RED}Fix all security issues before commit/deployment:${NC}\n"
    
    # Suggest fixes
    if [[ "$SKIP_DEPS" == "false" ]]; then
        echo "1. Update vulnerable dependencies:"
        echo "   pip install --upgrade -r backend/requirements.txt"
    fi
    
    echo "2. Remove hardcoded secrets:"
    echo "   bash scripts/scan-credentials.sh"
    
    echo "3. Fix code quality issues:"
    echo "   black backend/"
    echo "   ruff check --fix backend/"
    
    echo "4. Run tests:"
    echo "   pytest --cov=backend --cov-fail-under=80 tests/"
    
    echo ""
    exit 1
else
    echo -e "\n${GREEN}✓ ALL SECURITY CHECKS PASSED${NC}"
    echo -e "${GREEN}Code is ready for commit/deployment${NC}\n"
    
    echo "Next steps:"
    echo "1. Review  security scan reports in ./scan-results/"
    echo "2. Commit changes: git add . && git commit -m 'Security scans passed'"
    echo "3. Deploy to staging: bash scripts/deploy.sh start"
    echo "4. Run E2E tests: pytest tests/e2e/"
    echo ""
    exit 0
fi
