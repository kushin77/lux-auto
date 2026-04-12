#!/bin/bash
#
# Lux-Auto Docker Image Security Scanning
# Scans Docker images for vulnerabilities using Trivy
# REQUIRED: Must pass before pushing to registry
#
# Usage: bash scripts/scan-docker-image.sh [image_name] [registry]
# Default: kushin77/lux-auto (local image)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

IMAGE_NAME="${1:-kushin77/lux-auto:latest}"
REGISTRY="${2:-}"
SCAN_FORMAT="${3:-json}"  # json, sarif, table

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
echo -e "${BLUE}  Lux-Auto Docker Image Vulnerability Scan${NC}"
echo -e "${BLUE}  Image: $IMAGE_NAME${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

# Check if Docker is running
log_info "Checking Docker daemon..."

if ! docker ps > /dev/null 2>&1; then
    log_error "Docker daemon not accessible"
    exit 1
fi

log_success "Docker daemon is running"

# Check if image exists
log_info "Checking if image exists..."

if ! docker image inspect "$IMAGE_NAME" > /dev/null 2>&1; then
    log_error "Image not found: $IMAGE_NAME"
    log_info "Available images:"
    docker images | grep lux-auto || log_warning "No lux-auto images found"
    exit 1
fi

log_success "Image found: $IMAGE_NAME"

# Install Trivy if not available
if ! command -v trivy &> /dev/null; then
    log_warning "Trivy not installed. Installing..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin || {
            log_error "Failed to install Trivy"
            exit 1
        }
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install aquasecurity/trivy/trivy || {
            log_error "Failed to install Trivy with brew"
            exit 1
        }
    else
        log_error "Unsupported OS. Please install Trivy manually: https://aquasecurity.github.io/trivy/latest/getting-started/installation/"
        exit 1
    fi
    
    log_success "Trivy installed successfully"
fi

# Get Trivy version
TRIVY_VERSION=$(trivy --version 2>/dev/null | grep -oP '(?<=v)[0-9]+\.[0-9]+\.[0-9]+')
log_info "Trivy version: $TRIVY_VERSION"

# Create output directory
OUTPUT_DIR="$PROJECT_ROOT/scan-results"
mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$OUTPUT_DIR/docker-scan_${TIMESTAMP}.json"

# Run Trivy scan
log_info "Scanning Docker image for vulnerabilities..."
log_info "This may take 1-2 minutes...\n"

# Run scan with different severity thresholds
SCAN_FAILED=0

# Scan with failures on CRITICAL
if ! trivy image \
    --exit-code 1 \
    --severity HIGH,CRITICAL \
    --format json \
    --output "$REPORT_FILE" \
    "$IMAGE_NAME" 2>&1 | tee /tmp/trivy-scan.log; then
    
    log_error "Scan found vulnerabilities"
    SCAN_FAILED=1
    
    # Parse and display results
    if command -v jq &> /dev/null; then
        CRITICALS=$(jq '[.Results[]?.Misconfigurations[]? | select(.Severity=="CRITICAL")] | length' "$REPORT_FILE" 2>/dev/null || echo 0)
        HIGHS=$(jq '[.Results[]?.Misconfigurations[]? | select(.Severity=="HIGH")] | length' "$REPORT_FILE" 2>/dev/null || echo 0)
        
        log_error "Found $CRITICALS CRITICAL and $HIGHS HIGH severity issues"
    fi
else
    log_success "No CRITICAL or HIGH severity vulnerabilities found"
fi

# Additional checks
log_info "Running additional security checks..."

# 1. Check for secrets in image
log_info "Scanning for secrets in image..."

if trivy image \
    --scanners secret \
    --format table \
    "$IMAGE_NAME" 2>&1 | tee /tmp/trivy-secrets.log; then
    
    if grep -q "Secrets" /tmp/trivy-secrets.log; then
        log_warning "Potential secrets detected in image"
        ((SCAN_FAILED++))
    else
        log_success "No secrets detected in image"
    fi
else
    log_warning "Secret scanning skipped"
fi

# 2. Check for misconfigurations
log_info "Scanning for misconfigurations..."

if trivy image \
    --scanners config \
    --format table \
    "$IMAGE_NAME" 2>&1 | tee /tmp/trivy-config.log; then
    
    CONFIG_ISSUES=$(grep -c "CRITICAL\|HIGH" /tmp/trivy-config.log || echo 0)
    
    if [[ $CONFIG_ISSUES -gt 0 ]]; then
        log_warning "Found $CONFIG_ISSUES configuration issues"
    else
        log_success "No critical configuration issues found"
    fi
else
    log_warning "Configuration scanning skipped"
fi

# 3. Generate HTML report
log_info "Generating detailed report..."

HTML_REPORT="$OUTPUT_DIR/docker-scan_${TIMESTAMP}.html"

if command -v trivy &> /dev/null; then
    trivy image \
        --format template \
        --template '@/usr/local/share/trivy/templates/html.tpl' \
        --output "$HTML_REPORT" \
        "$IMAGE_NAME" 2>/dev/null || {
        log_warning "Failed to generate HTML report"
    }
    
    if [[ -f "$HTML_REPORT" ]]; then
        log_success "HTML report generated: $HTML_REPORT"
    fi
fi

# Summary
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Docker Image Scan Results${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

log_info "Image: $IMAGE_NAME"
log_info "Scan report: $REPORT_FILE"

if [[ $SCAN_FAILED -eq 0 ]]; then
    echo -e "\n${GREEN}✓ Docker image scan PASSED${NC}\n"
    echo "Image is safe to push to registry and deploy"
    exit 0
else
    echo -e "\n${RED}✗ Docker image scan FAILED${NC}"
    echo -e "Fix vulnerabilities before deployment:${NC}\n"
    
    echo "1. Review Dockerfile for common issues:"
    echo "   - Use specific base image versions (not 'latest')"
    echo "   - Run 'apt-get update && apt-get upgrade' together"
    echo "   - Use multi-stage builds to minimize image size"
    echo ""
    echo "2. Update vulnerable packages:"
    echo "   - pip install --upgrade vulnerable-package"
    echo "   - apt-get install vulnerable-package"
    echo ""
    echo "3. Re-build and scan:"
    echo "   docker build -t $IMAGE_NAME --no-cache ."
    echo "   bash scripts/scan-docker-image.sh $IMAGE_NAME"
    echo ""
    exit 1
fi
