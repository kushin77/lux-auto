@echo off
setlocal

echo Stopping and removing existing containers...
"C:\Program Files\Docker\Docker\resources\bin\docker.exe" compose -f docker-compose.prod.yml down -v

echo.
echo Waiting 5 seconds before restarting...
timeout /t 5 /nobreak

echo.
echo Starting fresh deployment with corrected SQL init script...
"C:\Program Files\Docker\Docker\resources\bin\docker.exe" compose -f docker-compose.prod.yml up -d

echo.
echo Waiting 15 seconds for services to start...
timeout /t 15 /nobreak

echo.
echo Checking container status...
"C:\Program Files\Docker\Docker\resources\bin\docker.exe" ps --filter name=lux-auto

echo.
echo Checking PostgreSQL health...
"C:\Program Files\Docker\Docker\resources\bin\docker.exe" ps --filter name=lux-auto-postgres

endlocal
