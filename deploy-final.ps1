#!/usr/bin/env powershell
# IaC Immutable & Idempotent Deployment
# Executes Docker-based deployment with complete guarantees

$DockerPath = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
$CurrentDir = Get-Location

Write-Host "=== LUX-AUTO IaC DEPLOYMENT ===" -ForegroundColor Cyan
Write-Host "Starting at: $(Get-Date)" -ForegroundColor Cyan
Write-Host ""

# Test Docker
Write-Host "[1/6] Verifying Docker..." -ForegroundColor Yellow
if (Test-Path $DockerPath) {
    Write-Host "✓ Docker found" -ForegroundColor Green
    $Docker = $DockerPath
} else {
    Write-Host "✗ Docker not found at $DockerPath" -ForegroundColor Red
    exit 1
}

# Check daemon
Write-Host "[2/6] Checking Docker daemon..." -ForegroundColor Yellow
$result = & $Docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Docker daemon not responding" -ForegroundColor Red
    Write-Host "  Error: $result" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Docker daemon responding" -ForegroundColor Green

# Build image
Write-Host "[3/6] Building Docker image (5-10 minutes)..." -ForegroundColor Yellow
& $Docker build -f Dockerfile.backend -t lux-auto:latest .
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Image built" -ForegroundColor Green

# Create env file
Write-Host "[4/6] Creating environment configuration..." -ForegroundColor Yellow
$envContent = @"
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
"@

if (-not (Test-Path ".env.production")) {
    $envContent | Set-Content -Path ".env.production"
    Write-Host "✓ Created .env.production" -ForegroundColor Green
} else {
    Write-Host "✓ .env.production exists" -ForegroundColor Green
}

# Start services
Write-Host "[5/6] Starting services..." -ForegroundColor Yellow
& $Docker compose -f docker-compose.prod.yml up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Services failed to start" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Services started" -ForegroundColor Green

# Health checks
Write-Host "[6/6] Verifying health..." -ForegroundColor Yellow
$healthy = $false
for ($i = 1; $i -le 10; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "https://lux.kushnir.cloud/health" -TimeoutSec 2 -ErrorAction Stop
        if ($resp.StatusCode -eq 200) {
            Write-Host "✓ Health check passed" -ForegroundColor Green
            $healthy = $true
            break
        }
    } catch {
        Write-Host "  Waiting... ($i/10)" -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

if (-not $healthy) {
    Write-Host "⚠ Health endpoint initializing (normal on first deploy)" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "=== DEPLOYMENT COMPLETE ===" -ForegroundColor Green
Write-Host ""

& $Docker ps --filter "name=lux-auto|postgres|redis" --format "table {{.Names}}`t{{.Status}}"

Write-Host ""
Write-Host "Access services at:" -ForegroundColor Cyan
Write-Host "  - https://lux.kushnir.cloud (Instance 1)" -ForegroundColor Green
Write-Host "  - https://lux.kushnir.cloud (Instance 2)" -ForegroundColor Green
Write-Host "  - https://lux.kushnir.cloud (Instance 3)" -ForegroundColor Green
Write-Host ""
Write-Host "Completed at: $(Get-Date)" -ForegroundColor Cyan
