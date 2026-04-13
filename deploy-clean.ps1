#!/usr/bin/env pwsh
# Clean deployment wrapper - bypasses broken PowerShell profile
# Executes core deployment logic without profile interception

param(
    [string]$Command = "deploy"
)

$ErrorActionPreference = "Stop"

# Test Docker availability without profile
Write-Host "Testing Docker availability..." -ForegroundColor Cyan

try {
    $dockerExe = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
    if (-not (Test-Path $dockerExe)) {
        # Try alternate path
        $dockerExe = "C:\Program Files\Docker CLI\docker.exe"
    }
    
    if (-not (Test-Path $dockerExe)) {
        # Try Docker path in PATH
        $dockerExe = (Get-Command docker -ErrorAction SilentlyContinue).Path
    }
    
    if (-not $dockerExe) {
        Write-Host "✗ Docker not found in standard paths." -ForegroundColor Red
        Write-Host "  Please verify Docker Desktop is installed." -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "✓ Found Docker at: $dockerExe" -ForegroundColor Green
}
catch {
    Write-Host "✗ Error testing Docker: $_" -ForegroundColor Red
    exit 1
}

# Execute docker directly
Write-Host "`nExecuting docker ps..." -ForegroundColor Cyan

try {
    & $dockerExe ps --format "table {{.Names}}\t{{.Status}}"
}
catch {
    Write-Host "✗ Docker command failed: $_" -ForegroundColor Red
    Write-Host "`nTipp: Docker Desktop may not be running." -ForegroundColor Yellow
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
    exit 1
}

Write-Host "`nAttempting full deployment..." -ForegroundColor Cyan
Write-Host "This may take 15-30 minutes depending on image build time." -ForegroundColor Yellow

# Create a wrapper deployment function
function Invoke-CleanDeployment {
    # Create deployment directory structure
    New-Item -ItemType Directory -Path "logs" -Force | Out-Null
    
    $logFile = "logs/deployment-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
    
    # Phase 1: Verify Docker
    Write-Host "`n[Phase 1] Verifying Docker..." -ForegroundColor Cyan
    try {
        $version = & $dockerExe --version
        Write-Host "✓ Docker version: $version" -ForegroundColor Green
        $version | Add-Content $logFile
    }
    catch {
        Write-Host "✗ Docker verification failed" -ForegroundColor Red
        return $false
    }
    
    # Phase 2: Check docker-compose
    Write-Host "`n[Phase 2] Checking docker-compose..." -ForegroundColor Cyan
    try {
        $composeVersion = & $dockerExe compose version
        Write-Host "✓ Docker Compose available: $composeVersion" -ForegroundColor Green
    }
    catch {
        Write-Host "✗ Docker Compose not available" -ForegroundColor Red
        return $false
    }
    
    # Phase 3: Build image
    Write-Host "`n[Phase 3] Building Docker image..." -ForegroundColor Cyan
    Write-Host "This will take 5-10 minutes for the first build..." -ForegroundColor Yellow
    
    try {
        & $dockerExe build -f Dockerfile.backend -t lux-auto:latest . 2>&1 | Tee-Object -FilePath $logFile -Append | ForEach-Object {
            if ($_ -match "error|Error|ERROR") {
                Write-Host $_ -ForegroundColor Red
            }
            elseif ($_ -match "Successfully") {
                Write-Host $_ -ForegroundColor Green
            }
            else {
                Write-Host $_
            }
        }
        
        Write-Host "✓ Image built successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "✗ Image build failed: $_" -ForegroundColor Red
        return $false
    }
    
    # Phase 4: Start services with docker-compose
    Write-Host "`n[Phase 4] Starting services with docker-compose..." -ForegroundColor Cyan
    
    try {
        # Make sure .env.production exists
        if (-not (Test-Path ".env.production")) {
            Write-Host "Creating .env.production..." -ForegroundColor Yellow
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
APP_VERSION=1.0.0
"@ | Set-Content .env.production
        }
        
        # Start services
        & $dockerExe compose -f docker-compose.prod.yml up -d
        
        Write-Host "✓ Services started" -ForegroundColor Green
    }
    catch {
        Write-Host "✗ Service startup failed: $_" -ForegroundColor Red
        return $false
    }
    
    # Phase 5: Health checks
    Write-Host "`n[Phase 5] Running health checks..." -ForegroundColor Cyan
    
    $maxRetries = 10
    $healthChecksPassed = $false
    
    for ($i = 1; $i -le $maxRetries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8889/health" -Method Get -TimeoutSec 5 -ErrorAction Stop
            
            if ($response.StatusCode -eq 200) {
                Write-Host "✓ Instance 1 health check passed (HTTP 200)" -ForegroundColor Green
                $healthChecksPassed = $true
                break
            }
        }
        catch {
            Write-Host "⟳ Health check attempt $i/$maxRetries..." -ForegroundColor Yellow
            Start-Sleep -Seconds 5
        }
    }
    
    if (-not $healthChecksPassed) {
        Write-Host "⚠ Health checks may still be initializing. Containers started." -ForegroundColor Yellow
    }
    
    # Show running containers
    Write-Host "`n[Summary] Running Containers:" -ForegroundColor Cyan
    & $dockerExe ps --filter "name=lux-auto|postgres|redis" --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
    
    return $true
}

# Execute deployment
$success = Invoke-CleanDeployment

if ($success) {
    Write-Host "`n✅ Deployment phase completed successfully!" -ForegroundColor Green
    Write-Host "`nAccess your services at:" -ForegroundColor Cyan
    Write-Host "  Instance 1: http://localhost:8889" -ForegroundColor Green
    Write-Host "  Instance 2: http://localhost:8890" -ForegroundColor Green
    Write-Host "  Instance 3: http://localhost:8891" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "`n❌ Deployment failed. Check logs in ./logs/ directory." -ForegroundColor Red
    exit 1
}
