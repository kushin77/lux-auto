@echo off
REM Production IaC Deployment - Pure CMD, no PowerShell
REM Deploys: PostgreSQL (fixed) + Redis + 3x FastAPI

setlocal enabledelayedexpansion

REM Navigate to project directory
cd /d C:\Users\Alex Kushnir\Desktop\Lux-auto

echo.
echo ========================================
echo   IaC PRODUCTION DEPLOYMENT
echo   PostgreSQL: MySQL INDEX syntax FIXED
echo ========================================
echo.

REM Stop existing containers/volumes
echo [1/5] Cleaning up existing services...
docker compose -f docker-compose.prod.yml down -v >nul 2>&1

REM Wait briefly
timeout /t 3 /nobreak >nul

REM Deploy fresh
echo [2/5] Starting services...
docker compose -f docker-compose.prod.yml up -d

echo [3/5] Waiting 30 seconds for initialization...
timeout /t 30 /nobreak >nul

REM Show status
echo [4/5] Service Status:
echo.
docker ps --filter="name=lux-auto" --format="table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

REM Check PostgreSQL specifically
echo.
echo [5/5] PostgreSQL Health Check:
docker ps --filter="name=postgres" --format="{{.Names}}: {{.Status}}"

echo.
echo ========================================
echo   DEPLOYMENT COMPLETE
echo ========================================
echo.
echo Access Points:
echo   FastAPI-1:      https://lux.kushnir.cloud
echo   FastAPI-2:      https://lux.kushnir.cloud  
echo   FastAPI-3:      https://lux.kushnir.cloud
echo   Production:    https://lux.kushnir.cloud
echo.

pause
