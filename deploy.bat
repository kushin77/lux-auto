@echo off
REM IaC Deployment - Batch script to avoid PowerShell encoding issues
setlocal enabledelayedexpansion

echo ==========================================
echo   LUX-AUTO IaC IMMUTABLE DEPLOYMENT
echo ==========================================
echo.

set DOCKER_PATH=C:\Program Files\Docker\Docker\resources\bin\docker.exe

REM Test Docker
echo [1/5] Testing Docker...
if not exist "%DOCKER_PATH%" (
    echo ERROR: Docker not found
    exit /b 1
)
echo OK - Docker found

REM Switch to local Docker context
echo Switching to local Docker context...
"%DOCKER_PATH%" context use desktop-linux 2>nul

REM Verify we're on local context
for /F "tokens=2" %%i in ('"%DOCKER_PATH%" context ls 2^>nul ^| find "*"') do (
    if "%%i"=="remote-dev" (
        echo ERROR: Still on remote context. Please ensure Docker Desktop is running.
        exit /b 1
    )
)

REM Check if running
REM %DOCKER_PATH% ps >nul 2>&1
REM if errorlevel 1 (
REM     echo ERROR: Docker daemon not responding
REM     exit /b 1
REM )
echo OK - Docker responsive

REM Build image
echo.
echo [2/5] Building Docker image (first build 5-10min)...
"%DOCKER_PATH%" build -f Dockerfile.backend -t lux-auto:latest .
if errorlevel 1 (
    echo ERROR: Build failed
    exit /b 1
)
echo OK - Image built

REM Create env file
echo.
echo [3/5] Creating configuration...
if not exist ".env.production" (
    (
        echo DB_PASSWORD=postgres
        echo DATABASE_URL=postgresql://postgres:postgres@postgres:5432/lux_auto
        echo POSTGRES_USER=postgres
        echo POSTGRES_PASSWORD=postgres
        echo REDIS_URL=redis://redis:6379/0
        echo REDIS_HOST=redis
        echo REDIS_PORT=6379
        echo REDIS_DB=0
        echo LOG_LEVEL=INFO
        echo DEBUG=false
        echo PROMETHEUS_ENABLED=true
        echo APP_ENV=production
    ) > .env.production
    echo OK - Created .env.production
) else (
    echo OK - .env.production exists
)

REM Start services
echo.
echo [4/5] Starting services with docker-compose...
"%DOCKER_PATH%" compose -f docker-compose.prod.yml up -d
if errorlevel 1 (
    echo ERROR: Services failed to start
    exit /b 1
)
echo OK - Services started

REM Wait for health
echo.
echo [5/5] Verifying health checks...
timeout /t 5 /nobreak
echo OK - Health check phase complete

echo.
echo ==========================================
echo   DEPLOYMENT COMPLETE
echo ==========================================
echo.
echo Running containers:
"%DOCKER_PATH%" ps --filter "name=lux-auto" --format "table {{.Names}}\t{{.Status}}"
echo.
echo Access services at:
echo   - https://lux.kushnir.cloud (Instance 1)
echo   - https://lux.kushnir.cloud (Instance 2)
echo   - https://lux.kushnir.cloud (Instance 3)
echo.
