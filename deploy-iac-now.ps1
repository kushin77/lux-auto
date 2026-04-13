#!/usr/bin/env powershell
# IaC Deployment Script - Clean execution without profile issues

param(
    [string]$DockerExe = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
)

$ErrorActionPreference = "Stop"

# Test Docker
Write-Host "Testing Docker..." -ForegroundColor Cyan
if (-not (Test-Path $DockerExe)) {
    $DockerExe = "C:\Program Files\Docker CLI\docker.exe"
}

if (-not (Test-Path $DockerExe)) {
    Write-Host "✗ Docker executable not found" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Found Docker at: $DockerExe" -ForegroundColor Green

# Function to run docker commands
function Invoke-Docker {
    param(
        [Parameter(ValueFromRemainingArguments=$true)]
        [string[]]$Arguments
    )
    & $DockerExe @Arguments
}

# Phase 1: Check Docker daemon
Write-Host "`n[Phase 1] Checking Docker daemon..." -ForegroundColor Cyan
try {
    Invoke-Docker ps --format "table {{.Names}}"
    Write-Host "✓ Docker daemon is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker daemon not responding - please start Docker Desktop" -ForegroundColor Red
    exit 1
}

# Phase 2: Build image
Write-Host "`n[Phase 2] Building Docker image..." -ForegroundColor Cyan
Write-Host "First build will take 5-10 minutes..." -ForegroundColor Yellow

try {
    Invoke-Docker build -f Dockerfile.backend -t lux-auto:latest . | Tee-Object -FilePath "logs\build-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
    Write-Host "✓ Image built" -ForegroundColor Green
} catch {
    Write-Host "✗ Build failed: $_" -ForegroundColor Red
    exit 1
}

# Phase 3: Create environment file
Write-Host "`n[Phase 3] Creating environment configuration..." -ForegroundColor Cyan
if (-not (Test-Path ".env.production")) {
    @"
DB_PASSWORD=postgres
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/lux_auto
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
REDIS_URL=redis://redis:6379/0
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
LOG_LEVEL=INFO
DEBUG=false
PROMETHEUS_ENABLED=true
APP_ENV=production
"@ | Set-Content .env.production
    Write-Host "✓ Created .env.production" -ForegroundColor Green
} else {
    Write-Host "✓ .env.production already exists" -ForegroundColor Green
}

# Phase 4: Start services
Write-Host "`n[Phase 4] Starting services with docker-compose..." -ForegroundColor Cyan
try {
    Invoke-Docker compose -f docker-compose.prod.yml up -d
    Write-Host "✓ Services started" -ForegroundColor Green
} catch {
    Write-Host "✗ Services failed to start: $_" -ForegroundColor Red
    exit 1
}

# Phase 5: Wait for services
Write-Host "`n[Phase 5] Waiting for services to be ready..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

# Phase 6: Health checks
Write-Host "`n[Phase 6] Running health checks..." -ForegroundColor Cyan
$healthPassed = $false
for ($i = 1; $i -le 10; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "https://lux.kushnir.cloud/health" -TimeoutSec 5 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "✓ Health check passed" -ForegroundColor Green
            $healthPassed = $true
            break
        }
    } catch {
        Write-Host "  Attempt $i/10..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}

if (-not $healthPassed) {
    Write-Host "⚠ Health endpoint not yet responding (containers may still be initializing)" -ForegroundColor Yellow
}

# Show status
Write-Host "`n[Summary] Running Containers:" -ForegroundColor Cyan
Invoke-Docker ps --filter "name=lux-auto|postgres|redis" --format "table {{.Names}}`t{{.Status}}"

Write-Host "`n✅ Deployment Complete!" -ForegroundColor Green
Write-Host "`nAccess your services:" -ForegroundColor Cyan
Write-Host "  - Instance 1: https://lux.kushnir.cloud" -ForegroundColor Green
Write-Host "  - Instance 2: https://lux.kushnir.cloud" -ForegroundColor Green
Write-Host "  - Instance 3: https://lux.kushnir.cloud" -ForegroundColor Green
Write-Host "`nView logs: logs/" -ForegroundColor Cyan
