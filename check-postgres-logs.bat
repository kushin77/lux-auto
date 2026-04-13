@echo off
setlocal

echo Checking PostgreSQL container logs...
"C:\Program Files\Docker\Docker\resources\bin\docker.exe" logs lux-auto-postgres

echo.
echo Checking PostgreSQL container status...
"C:\Program Files\Docker\Docker\resources\bin\docker.exe" ps -a --filter name=postgres

echo.
echo Running health check manually...
"C:\Program Files\Docker\Docker\resources\bin\docker.exe" exec lux-auto-postgres pg_isready -U postgres

endlocal
