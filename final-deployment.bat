@echo off
REM Final Deployment - Complete Restart with Fixed PostgreSQL Init Script
REM This script will:
REM 1. Stop all services
REM 2. Remove old containers and volumes
REM 3. Start fresh deployment with corrected init-db.sql
REM 4. Verify all 8 services are running and healthy

setlocal enabledelayedexpansion
cd /d "C:\Users\Alex Kushnir\Desktop\Lux-auto"

set DOCKER="C:\Program Files\Docker\Docker\resources\bin\docker.exe"

echo.
echo ============================================
echo  LUX-AUTO FINAL DEPLOYMENT
echo  PostgreSQL: Fixed with corrected init-db.sql
echo ============================================
echo.

echo [1/5] Stopping old services...
%DOCKER% compose -f docker-compose.prod.yml down 2>nul
%DOCKER% stop lux-auto-postgres 2>nul
%DOCKER% stop lux-auto-redis 2>nul
%DOCKER% rm lux-auto-postgres 2>nul
%DOCKER% rm lux-auto-redis 2>nul
%DOCKER% rm lux-auto-app-prod-1 2>nul
%DOCKER% rm lux-auto-app-prod-2 2>nul
%DOCKER% rm lux-auto-app-prod-3 2>nul

echo [2/5] Removing old volumes...
%DOCKER% volume rm lux-auto_postgres_data 2>nul
%DOCKER% volume rm lux-auto_redis_data 2>nul
%DOCKER% volume rm lux-auto_postgres_data 2>nul

echo [3/5] Starting fresh deployment...
%DOCKER% compose -f docker-compose.prod.yml up -d

echo [4/5] Waiting 20 seconds for services to initialize...
timeout /t 20 /nobreak

echo.
echo [5/5] Verifying deployment status...
echo.
echo All containers:
%DOCKER% ps -a --filter name=lux-auto --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo.
echo Redis status (should show UP):
%DOCKER% ps --filter name=redis --format "table {{.Names}}\t{{.Status}}"

echo.
echo PostgreSQL status (should show UP and healthy):
%DOCKER% ps --filter name=postgres --format "table {{.Names}}\t{{.Status}}"

echo.
echo FastAPI instances (should all show UP):
%DOCKER% ps --filter name=app-prod --format "table {{.Names}}\t{{.Status}}"

echo.
echo ============================================
echo  DEPLOYMENT COMPLETE
echo ============================================
echo.
echo Services should be accessible:
echo  - FastAPI 1: http://localhost:8889/health
echo  - FastAPI 2: http://localhost:8890/health
echo  - FastAPI 3: http://localhost:8891/health
echo  - Production: https://lux.kushnir.cloud
echo.

endlocal
