@echo off
setlocal

REM Get full path to docker exe
set DOCKER="C:\Program Files\Docker\Docker\resources\bin\docker.exe"

echo Checking Docker status...
%DOCKER% ps -a --no-trunc 2>&1 | findstr "lux-auto"

echo.
echo Composed services:
%DOCKER% compose -f docker-compose.prod.yml ps 2>&1

endlocal
