#!/bin/bash
#
# Lux-Auto Monitoring Script
# Continuously monitors service health and logs
#
# Usage: bash scripts/monitor.sh [interval]
# Default interval: 30 seconds
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

COMPOSE_CMD="docker-compose -f $PROJECT_ROOT/docker-compose.yml"
INTERVAL="${1:-30}"

# Colors
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
echo -e "${BLUE}  Lux-Auto Service Monitor (interval: ${INTERVAL}s)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
echo "Press Ctrl+C to stop monitoring\n"

while true; do
    clear
    echo -e "${BLUE}$(date '+%Y-%m-%d %H:%M:%S')${NC} - Service Status\n"
    
    # Check Docker connectivity
    if ! docker ps > /dev/null 2>&1; then
        log_error "Docker daemon not accessible"
        sleep $INTERVAL
        continue
    fi
    
    # Get service status
    SERVICES=("postgres" "cache" "fastapi" "oauth2-proxy" "caddy")
    
    for service in "${SERVICES[@]}"; do
        STATUS=$($COMPOSE_CMD ps "$service" --format "{{.State}}" 2>/dev/null || echo "not found")
        HEALTH=$($COMPOSE_CMD ps "$service" --format "{{.Health}}" 2>/dev/null || echo "")
        
        case "$STATUS" in
            "running")
                if [[ -z "$HEALTH" ]] || [[ "$HEALTH" == "healthy" ]] || [[ "$HEALTH" == "(none)" ]]; then
                    log_success "$service ($STATUS)"
                else
                    log_warning "$service ($STATUS - $HEALTH)"
                fi
                ;;
            exited|paused)
                log_warning "$service ($STATUS)"
                ;;
            *)
                log_error "$service ($STATUS)"
                ;;
        esac
    done
    
    echo ""
    log_info "Health Checks:"
    
    # PostgreSQL
    if docker exec lux-postgres pg_isready -U lux_admin > /dev/null 2>&1; then
        log_success "PostgreSQL ready"
    else
        log_warning "PostgreSQL not responding"
    fi
    
    # Redis
    if docker exec lux-cache redis-cli ping > /dev/null 2>&1; then
        log_success "Redis responding"
    else
        log_warning "Redis not responding"
    fi
    
    # FastAPI
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        log_success "FastAPI health check passed"
    else
        log_warning "FastAPI health check failed"
    fi
    
    # OAuth2 Proxy
    if curl -sf http://localhost:4180/ping > /dev/null 2>&1; then
        log_success "OAuth2 proxy responding"
    else
        log_warning "OAuth2 proxy not responding"
    fi
    
    # Caddy
    if curl -sf http://localhost:2019/status > /dev/null 2>&1; then
        log_success "Caddy admin API responding"
    else
        log_warning "Caddy admin API not responding"
    fi
    
    echo ""
    log_info "Recent Logs (last 5 lines per service):"
    
    for service in "${SERVICES[@]}"; do
        echo -e "\n${YELLOW}$service:${NC}"
        $COMPOSE_CMD logs --tail=3 "$service" 2>&1 | tail -3 | sed 's/^/  /'
    done
    
    echo -e "\n${BLUE}─────────────────────────────────────────────────────────${NC}"
    echo "Next check in ${INTERVAL}s (Ctrl+C to stop)..."
    
    sleep $INTERVAL
done
