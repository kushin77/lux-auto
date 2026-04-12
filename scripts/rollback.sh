#!/bin/bash
#
# Lux-Auto Emergency Rollback Script
# Quickly reverts to last known good state
#
# Usage: bash scripts/rollback.sh [restore-type]
# Restore types: containers, database, full
# Default: containers
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

COMPOSE_CMD="docker-compose -f $PROJECT_ROOT/docker-compose.yml"
RESTORE_TYPE="${1:-containers}"

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

echo -e "\n${RED}═══════════════════════════════════════════════════════════${NC}"
echo -e "${RED}  EMERGENCY ROLLBACK - ${RESTORE_TYPE}${NC}"
echo -e "${RED}═══════════════════════════════════════════════════════════${NC}\n"

# Safety check
read -p "${YELLOW}WARNING: This will stop services and may lose unsaved data. Continue? (yes/no):${NC} " -r
if [[ ! $REPLY =~ ^yes$ ]]; then
    log_info "Rollback cancelled"
    exit 0
fi

case "$RESTORE_TYPE" in
    containers)
        log_warning "Rolling back containers to last known state..."
        
        log_info "Stopping all services..."
        $COMPOSE_CMD down ||  {
            log_error "Failed to stop services"
            exit 1
        }
        
        log_info "Pulling last known good images..."
        $COMPOSE_CMD pull ||  {
            log_warning "Could not pull images, continuing with local images"
        }
        
        log_info "Restarting services..."
        $COMPOSE_CMD up -d ||  {
            log_error "Failed to restart services"
            exit 1
        }
        
        sleep 10
        
        log_info "Waiting for services to stabilize..."
        for attempt in {1..12}; do
            if $COMPOSE_CMD ps | grep -c "healthy\|(running)" > /dev/null 2>&1; then
                log_success "Services recovered"
                break
            fi
            log_info "  Attempt $attempt/12..."
            sleep 10
        done
        
        log_success "Container rollback complete"
        ;;
        
    database)
        log_warning "Rolling back database to backup..."
        
        # Check for backup
        BACKUP_FILE="$PROJECT_ROOT/backups/postgres_backup_latest.sql"
        if [[ ! -f "$BACKUP_FILE" ]]; then
            log_error "No database backup found at $BACKUP_FILE"
            echo "Create a backup with: docker exec lux-postgres pg_dump -U lux_admin lux_prod > backups/postgres_backup.sql"
            exit 1
        fi
        
        log_info "Stopping FastAPI to release database connections..."
        $COMPOSE_CMD stop fastapi
        sleep 5
        
        log_info "Dropping current database..."
        docker exec lux-postgres psql -U lux_admin -c "DROP DATABASE IF EXISTS lux_prod;" >/dev/null 2>&1 || true
        
        log_info "Creating fresh database..."
        docker exec lux-postgres psql -U lux_admin -c "CREATE DATABASE lux_prod OWNER lux_admin ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8';" >/dev/null 2>&1
        
        log_info "Restoring from backup..."
        docker exec -i lux-postgres psql -U lux_admin lux_prod < "$BACKUP_FILE" || {
            log_error "Database restore failed"
            exit 1
        }
        
        log_info "Restarting FastAPI..."
        $COMPOSE_CMD start fastapi
        
        sleep 10
        log_success "Database rollback complete"
        ;;
        
    full)
        log_error "FULL ROLLBACK: This will destroy all data including database!"
        read -p "${RED}Are you absolutely sure? Type 'destroy everything' to continue:${NC} " -r
        
        if [[ ! "$REPLY" == "destroy everything" ]]; then
            log_info "Full rollback cancelled"
            exit 0
        fi
        
        log_warning "Performing full rollback..."
        
        log_info "Stopping and removing all containers..."
        $COMPOSE_CMD down -v --remove-orphans ||  true
        
        log_info "Removing all volumes..."
        docker volume prune --force --filter "label!=keep" ||  true
        
        log_info "Cleaning up dangling images..."
        docker image prune -a --force --filter "dangling=true" ||  true
        
        log_info "Restarting clean deployment..."
        $COMPOSE_CMD up -d ||  {
            log_error "Failed to start clean deployment"
            exit 1
        }
        
        sleep 30
        log_success "Full rollback complete - fresh deployment running"
        ;;
        
    *)
        log_error "Unknown restore type: $RESTORE_TYPE"
        echo -e "\n${BLUE}Usage:${NC} bash scripts/rollback.sh [type]"
        echo -e "\n${BLUE}Restore Types:${NC}"
        echo "  containers  - Restart services with last known images (default)"
        echo "  database    - Restore database from backup"
        echo "  full        - Complete reset (destroys all data)"
        exit 1
        ;;
esac

echo -e "\n${GREEN}Rollback Status:${NC}"
$COMPOSE_CMD ps

log_success "Rollback procedure completed"
