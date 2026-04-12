#!/bin/bash
#
# Lux-Auto Deployment Script
# Orchestrates build, validation, and deployment of all services
#
# Prerequisites: bash scripts/validate-config.sh (must pass)
# Usage: bash scripts/deploy.sh [action]
# Actions: start, stop, restart, logs, status, clean
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

# Configuration
ACTION="${1:-start}"
COMPOSE_CMD="docker-compose -f $PROJECT_ROOT/docker-compose.yml"
TIMEOUT=300
CHECK_INTERVAL=5

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }

# Function to wait for service to be healthy
wait_for_service() {
    local service=$1
    local timeout=$2
    local elapsed=0
    
    log_info "Waiting for $service to be healthy (max ${timeout}s)..."
    
    while [[ $elapsed -lt $timeout ]]; do
        if $COMPOSE_CMD ps "$service" 2>/dev/null | grep -q "healthy\|(running)"; then
            log_success "$service is healthy"
            return 0
        fi
        
        sleep $CHECK_INTERVAL
        elapsed=$((elapsed + CHECK_INTERVAL))
        echo -ne "  ${YELLOW}${elapsed}s${NC} \r"
    done
    
    log_error "$service did not become healthy within ${timeout}s"
    return 1
}

# Function to validate deployment
validate_deployment() {
    log_info "Validating deployment..."
    
    # Check all containers are running
    local running_count=$($COMPOSE_CMD ps --quiet | wc -l)
    if [[ $running_count -lt 5 ]]; then
        log_error "Not all services are running (expected 5+, got $running_count)"
        return 1
    fi
    
    log_success "All ($running_count) services are running"
    
    # Test health endpoint
    log_info "Testing health endpoint..."
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        log_success "Health endpoint responding"
    else
        log_warning "Health endpoint not responding yet"
    fi
    
    return 0
}

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Lux-Auto Deployment System${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

# Load environment
if [[ ! -f "$PROJECT_ROOT/.env" ]]; then
    log_error ".env file not found!"
    log_info "Create .env file from .env.example and populate with values from Google Secret Manager"
    exit 1
fi

source "$PROJECT_ROOT/.env"

case "$ACTION" in
    start)
        log_info "Starting Lux-Auto deployment..."
        
        # Validate configuration first
        log_info "Running pre-deployment validation..."
        if ! bash "$SCRIPT_DIR/validate-config.sh"; then
            log_error "Pre-deployment validation failed. Fix errors and try again."
            exit 1
        fi
        
        # Pull latest images
        log_info "Pulling Docker images..."
        if ! $COMPOSE_CMD pull 2>/dev/null || true; then
            log_warning "Some images not available (will build locally)"
        fi
        
        # Build backend image
        log_info "Building FastAPI backend image..."
        $COMPOSE_CMD build --no-cache fastapi || {
            log_error "Failed to build FastAPI image"
            exit 1
        }
        
        # Start services with dependency ordering
        log_info "Starting PostgreSQL..."
        $COMPOSE_CMD up -d postgres
        wait_for_service "postgres" $TIMEOUT || exit 1
        
        log_info "Starting Redis cache..."
        $COMPOSE_CMD up -d cache
        wait_for_service "cache" $TIMEOUT || exit 1
        
        log_info "Starting FastAPI application..."
        $COMPOSE_CMD up -d fastapi
        wait_for_service "fastapi" $TIMEOUT || exit 1
        
        log_info "Starting OAuth2 proxy..."
        $COMPOSE_CMD up -d oauth2-proxy
        wait_for_service "oauth2-proxy" 60 || exit 1
        
        log_info "Starting Caddy reverse proxy..."
        $COMPOSE_CMD up -d caddy
        sleep 10  # Allow Caddy to generate HTTPS cert
        
        # Validate deployment
        if validate_deployment; then
            log_success "Deployment successful!"
            echo -e "\n${GREEN}Services running:${NC}"
            $COMPOSE_CMD ps
            echo -e "\n${GREEN}Access points:${NC}"
            echo -e "  API:     https://${DOMAIN}/api/me"
            echo -e "  Health:  https://${DOMAIN}/health"
            echo -e "  Metrics: https://${DOMAIN}/metrics"
            echo -e "  Admin:   Caddy admin @ localhost:2019"
        else
            log_error "Deployment validation failed"
            exit 1
        fi
        ;;
        
    stop)
        log_info "Stopping all services..."
        $COMPOSE_CMD down
        log_success "All services stopped"
        ;;
        
    restart)
        log_info "Restarting all services..."
        $COMPOSE_CMD restart
        log_success "All services restarted"
        
        # Wait for health
        wait_for_service "fastapi" 60 || true
        ;;
        
    logs)
        SERVICE="${2:-all}"
        if [[ "$SERVICE" == "all" ]]; then
            $COMPOSE_CMD logs -f --tail=100
        else
            $COMPOSE_CMD logs -f --tail=100 "$SERVICE"
        fi
        ;;
        
    status)
        log_info "Service Status:"
        $COMPOSE_CMD ps
        
        log_info "Health Checks:"
        log_info "PostgreSQL:"
        docker exec lux-postgres pg_isready -U ${DATABASE_USER:-lux_admin} 2>/dev/null && \
            log_success "PostgreSQL responding" || \
            log_warning "PostgreSQL check failed"
        
        log_info "Redis:"
        docker exec lux-cache redis-cli ping 2>/dev/null && \
            log_success "Redis responding" || \
            log_warning "Redis check failed"
        
        log_info "FastAPI:"
        curl -sf http://localhost:8000/health >/dev/null 2>&1 && \
            log_success "FastAPI health check passed" || \
            log_warning "FastAPI health check failed"
        
        log_info "OAuth2 Proxy:"
        curl -sf http://localhost:4180/ping >/dev/null 2>&1 && \
            log_success "OAuth2 proxy responding" || \
            log_warning "OAuth2 proxy not responding"
        ;;
        
    clean)
        log_warning "Removing all containers, volumes, and image builds..."
        read -p "Are you sure? (yes/no): " -r
        if [[ $REPLY =~ ^yes$ ]]; then
            $COMPOSE_CMD down -v --remove-orphans
            docker image prune -a --force --filter "label!=keep"
            log_success "Cleanup complete"
        else
            log_info "Cleanup cancelled"
        fi
        ;;
        
    *)
        log_error "Unknown action: $ACTION"
        echo -e "\n${BLUE}Usage:${NC} bash scripts/deploy.sh [action]"
        echo -e "\n${BLUE}Actions:${NC}"
        echo "  start      - Build and start all services (default)"
        echo "  stop       - Stop all services"
        echo "  restart    - Restart all services"
        echo "  logs       - View service logs (optionally: logs SERVICE)"
        echo "  status     - Check service status and health"
        echo "  clean      - Remove all containers and volumes"
        exit 1
        ;;
esac
