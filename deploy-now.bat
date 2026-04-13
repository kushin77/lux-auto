@echo off
REM Direct Docker deployment - ZERO PowerShell involvement
REM Uses only cmd.exe built-ins and docker.exe

cd /d C:\Users\Alex Kushnir\Desktop\Lux-auto

set DOCKER_EXE=C:\Program Files\Docker\Docker\resources\bin\docker.exe

REM Test if docker responds
echo Testing Docker responsiveness...
call "%DOCKER_EXE%" version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker not responding
    echo Please restart Docker Desktop manually
    pause
    exit /b 1
)

echo Docker is responsive! Proceeding with deployment...
echo.

REM Clean shutdown
echo Stopping existing containers...
call "%DOCKER_EXE%" compose -f docker-compose.prod.yml down >nul 2>&1

:DEPLOY
echo Starting fresh deployment...
call "%DOCKER_EXE%" compose -f docker-compose.prod.yml up -d

if %ERRORLEVEL% EQU 0 (
    echo.
    echo SUCCESS: Deployment initiated!
    echo.
    echo Waiting 30 seconds for services to initialize...
    timeout /t 30 /nobreak
    echo.
    echo.
    call "%DOCKER_EXE%" ps --filter name=lux-auto --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
    echo.
    echo Deployment Status:
    call "%DOCKER_EXE%" ps --all --filter name=lux-auto --format "{{.Names}}: {{.Status}}"
) else (
    echo ERROR: Deployment failed
    pause
    exit /b 1
)

echo.
echo Ready! Access at:
echo   http://localhost:8889/health (Instance 1)
echo   http://localhost:8890/health (Instance 2)
echo   http://localhost:8891/health (Instance 3)
echo   https://lux.kushnir.cloud (Production)
echo.

pause
