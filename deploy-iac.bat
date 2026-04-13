@echo off
REM Direct IaC Deployment - uses docker from PATH
REM Deploys with corrected PostgreSQL init-db.sql

setlocal
cd /d C:\Users\Alex Kushnir\Desktop\Lux-auto

echo.
echo ========================================
echo IaC PRODUCTION DEPLOYMENT
echo PostgreSQL: Fixed init-db.sql syntax
echo ========================================
echo.

echo [1/4] Pulling base images...
docker pull postgres:15-alpine >nul 2>&1
docker pull redis:7-alpine >nul 2>&1

echo [2/4] Deploying with docker-compose...
docker compose -f docker-compose.prod.yml down >nul 2>&1
docker compose -f docker-compose.prod.yml up -d 2>&1

echo [3/4] Waiting 20 seconds for initialization...
timeout /t 20 /nobreak >nul

echo [4/4] Service Status:
echo.
docker ps --filter="name=lux-auto" --format="table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.

echo ========================================
echo Deployment Complete
echo ========================================
echo.
echo Services available at:
echo   https://lux.kushnir.cloud  (FastAPI-1)
echo   https://lux.kushnir.cloud  (FastAPI-2)
echo   https://lux.kushnir.cloud  (FastAPI-3)
echo https://lux.kushnir.cloud (Production)
echo.

endlocal
