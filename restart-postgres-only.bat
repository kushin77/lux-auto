@echo off
setlocal

echo Stopping PostgreSQL container...
"C:\Program Files\Docker\Docker\resources\bin\docker.exe" stop lux-auto-postgres 2>nul

echo Removing PostgreSQL container...
"C:\Program Files\Docker\Docker\resources\bin\docker.exe" rm lux-auto-postgres 2>nul

echo Removing PostgreSQL volume...
"C:\Program Files\Docker\Docker\resources\bin\docker.exe" volume rm lux-auto_postgres_data 2>nul

echo.
echo Restarting PostgreSQL with corrected init script...
"C:\Program Files\Docker\Docker\resources\bin\docker.exe" compose -f docker-compose.prod.yml up -d postgres

echo.
echo Waiting 10 seconds for PostgreSQL to initialize...
timeout /t 10 /nobreak

echo.
echo Checking PostgreSQL health...
"C:\Program Files\Docker\Docker\resources\bin\docker.exe" ps --filter name=postgres

echo.
echo Getting PostgreSQL logs...
"C:\Program Files\Docker\Docker\resources\bin\docker.exe" logs --tail=50 lux-auto-postgres 2>&1

endlocal
