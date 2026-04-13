#!/usr/bin/env cmd
@echo off
setlocal enabledelayedexpansion

REM Get Windows paths properly
for /F "tokens=*" %%d in ('echo %DOCKER_HOST%') DO @set "OLD_DOCKER_HOST=%%d"

REM Unset DOCKER_HOST to force local connection
set DOCKER_HOST=
set DOCKER_CONTEXT=desktop-linux

echo ==========================================
echo   LUX-AUTO IaC DEPLOYMENT
echo ==========================================
echo Switching Docker to local context...
echo.

REM Try using the direct docker executable path
set DOCKER_CMD="C:\Program Files\Docker\Docker\resources\bin\docker.exe"

REM Check Docker availability
%DOCKER_CMD% --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker not found or not accessible
    exit /b 1
)

echo [1/5] Testing Docker daemon...
%DOCKER_CMD% ps --no-trunc 2>&1 | find "CONTAINER ID" >nul
if errorlevel 1 (
    echo ERROR: Docker daemon not responding
    echo Please ensure:
    echo   1. Docker Desktop is running
    echo   2. DOCKER_HOST environment variable is not set
    echo.
    echo Current DOCKER_HOST: %DOCKER_HOST%
    exit /b 1
)
echo OK - Docker daemon is responsive

REM Build image
echo.
echo [2/5] Building Docker image (first time: 5-10 min)...
%DOCKER_CMD% build -f Dockerfile.backend -t lux-auto:latest .
if errorlevel 1 (
    echo ERROR: Build failed
    exit /b 1
)
echo OK - Image built

REM Create env if needed
echo.
echo [3/5] Creating configuration files...
if not exist ".env.production" (
    (
        echo DB_PASSWORD=postgres
        echo DATABASE_URL=postgresql://postgres:postgres@postgres:5432/lux_auto
        echo POSTGRES_USER=postgres
        echo POSTGRES_PASSWORD=postgres
        echo REDIS_URL=redis://redis:6379/0
        echo REDIS_HOST=redis
        echo REDIS_PORT=6379
        echo LOG_LEVEL=INFO
        echo DEBUG=false
        echo PROMETHEUS_ENABLED=true
        echo APP_ENV=production
    ) > .env.production
)
echo OK - Configuration ready

REM Deploy with compose
echo.
echo [4/5] Starting services with docker-compose...
%DOCKER_CMD% compose -f docker-compose.prod.yml up -d
if errorlevel 1 (
    echo ERROR: docker-compose failed
    exit /b 1
)
echo OK - Services deployed

REM Wait and verify
echo.
echo [5/5] Verifying deployment...
timeout /t 5 /nobreak

REM Show status
echo.
echo ==========================================
echo   DEPLOYMENT STATUS
echo ==========================================
%DOCKER_CMD% ps --filter "name=lux-auto" --format "table {{.Names}}\t{{.Status}}"

echo.
echo Access services:
echo   - http://localhost:8889 (Instance 1)
echo   - http://localhost:8890 (Instance 2)
echo   - http://localhost:8891 (Instance 3)
echo.
echo Completed successfully!

REM Restore original DOCKER_HOST if it existed
if not "!OLD_DOCKER_HOST!"=="" (
    set DOCKER_HOST=!OLD_DOCKER_HOST!
)
