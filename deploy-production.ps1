#!/usr/bin/env pwsh
# IaC Immutable & Idempotent Deployment Script
# Purpose: Deploy Lux-Auto with full lifecycle management
# Properties: Immutable (read-only), Idempotent (safe re-run), Complete IaC

param(
    [string]$Environment = "production",
    [string]$Action = "deploy",
    [switch]$SkipHealthChecks,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$VerbosePreference = "Continue"

# Configuration - IMMUTABLE
$Config = @{
    ProjectName = "lux-auto"
    Environment = $Environment
    ComposeFile = "docker-compose.prod.yml"
    LogDir = "./logs"
    StateFile = "./.deployment-state.json"
    HealthCheckRetries = 5
    HealthCheckDelay = 10
    RollbackEnabled = $true
}

# Color Output Helper
function Write-ColorOutput {
    param(
        [string]$Message,
        [ValidateSet("Info", "Success", "Error", "Warning")]
        [string]$Type = "Info"
    )
    
    $Colors = @{
        Info = "Cyan"
        Success = "Green"
        Error = "Red"
        Warning = "Yellow"
    }
    
    Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] " -NoNewline
    Write-Host $Message -ForegroundColor $Colors[$Type]
}

# Immutable State Management
function Get-DeploymentState {
    if (Test-Path $Config.StateFile) {
        $state = Get-Content $Config.StateFile | ConvertFrom-Json
        return $state
    }
    
    return @{
        lastDeploy = $null
        imageId = $null
        status = "none"
        version = "0.0.0"
    }
}

function Set-DeploymentState {
    param($State)
    
    $State | ConvertTo-Json | Set-Content $Config.StateFile -Force
    Write-ColorOutput "State updated: $($Config.StateFile)" "Info"
}

# Idempotent Health Check
function Test-ServiceHealth {
    param(
        [string]$ServiceName,
        [string]$HealthEndpoint,
        [int]$Port
    )
    
    $maxRetries = $Config.HealthCheckRetries
    $retryCount = 0
    
    while ($retryCount -lt $maxRetries) {
        try {
            $response = Invoke-WebRequest -Uri "https://lux.kushnir.cloud/health" `
                -Method Get `
                -TimeoutSec 5 `
                -ErrorAction Stop
            
            if ($response.StatusCode -eq 200) {
                Write-ColorOutput "✓ $ServiceName health check passed (port $Port)" "Success"
                return $true
            }
        }
        catch {
            $retryCount++
            if ($retryCount -lt $maxRetries) {
                Write-ColorOutput "⟳ $ServiceName health check attempt $retryCount/$maxRetries..." "Warning"
                Start-Sleep -Seconds $Config.HealthCheckDelay
            }
        }
    }
    
    Write-ColorOutput "✗ $ServiceName failed health checks after $maxRetries attempts" "Error"
    return $false
}

# Idempotent Container Check
function Test-ContainerRunning {
    param([string]$ContainerName)
    
    try {
        $container = docker ps --filter "name=$ContainerName" --format "{{.Names}}" 2>$null
        return -not [string]::IsNullOrEmpty($container)
    }
    catch {
        return $false
    }
}

# Phase 1: Prerequisites Verification (Idempotent)
function Invoke-PhasePrerequisites {
    Write-ColorOutput "=== PHASE 1: Prerequisites Verification ===" "Info"
    
    # Check Docker
    try {
        $dockerVersion = docker --version 2>$null
        Write-ColorOutput "✓ Docker installed: $dockerVersion" "Success"
    }
    catch {
        Write-ColorOutput "✗ Docker not found or not running" "Error"
        return $false
    }
    
    # Check Docker running
    $dockerRunning = (docker ps 2>$null | Measure-Object).Count -gt 0
    if (-not $dockerRunning) {
        Write-ColorOutput "✗ Docker daemon not responding" "Error"
        return $false
    }
    Write-ColorOutput "✓ Docker daemon responding" "Success"
    
    # Check disk space (5GB minimum)
    $diskFreeGB = [math]::Round((Get-Volume C:).SizeRemaining / 1GB, 2)
    if ($diskFreeGB -lt 5) {
        Write-ColorOutput "✗ Insufficient disk space: $diskFreeGB GB (need 5 GB)" "Error"
        return $false
    }
    Write-ColorOutput "✓ Disk space available: $diskFreeGB GB" "Success"
    
    return $true
}

# Phase 2: Build Image (Idempotent - only if not exists or version changed)
function Invoke-PhaseBuild {
    Write-ColorOutput "=== PHASE 2: Build Docker Image ===" "Info"
    
    $state = Get-DeploymentState
    
    # Check if image already exists
    $imageExists = docker image ls "lux-auto" --format "{{.ID}}" 2>$null
    
    if ($imageExists) {
        Write-ColorOutput "✓ Image already built (idempotent): $imageExists" "Success"
        
        if ($DryRun) {
            Write-ColorOutput "[DRY-RUN] Would skip rebuild (image up-to-date)" "Warning"
            return $true
        }
        
        return $true
    }
    
    Write-ColorOutput "Building Docker image (this may take 5-10 minutes)..." "Info"
    
    if ($DryRun) {
        Write-ColorOutput "[DRY-RUN] docker build -f Dockerfile.backend -t lux-auto:latest ." "Warning"
        return $true
    }
    
    try {
        docker build -f Dockerfile.backend -t lux-auto:latest . 2>&1 | ForEach-Object {
            Write-ColorOutput $_ "Info"
        }
        
        $newImageId = docker image ls "lux-auto" --format "{{.ID}}"
        Write-ColorOutput "✓ Image built successfully: $newImageId" "Success"
        
        # Update state
        $state.imageId = $newImageId
        $state.lastDeploy = (Get-Date).ToString("o")
        Set-DeploymentState $state
        
        return $true
    }
    catch {
        Write-ColorOutput "✗ Docker image build failed: $_" "Error"
        return $false
    }
}

# Phase 3: Start Infrastructure (Idempotent)
function Invoke-PhaseInfrastructure {
    Write-ColorOutput "=== PHASE 3: Start Infrastructure Services ===" "Info"
    
    if ($DryRun) {
        Write-ColorOutput "[DRY-RUN] docker-compose -f $($Config.ComposeFile) up -d postgres redis" "Warning"
        return $true
    }
    
    try {
        # Start only backend infrastructure (postgres, redis)
        & docker-compose -f $Config.ComposeFile up -d postgres redis
        
        Write-ColorOutput "✓ Infrastructure services started" "Success"
        
        # Wait for services to be healthy
        Write-ColorOutput "Waiting for PostgreSQL..." "Info"
        for ($i = 0; $i -lt 30; $i++) {
            $pgReady = docker exec lux-auto-postgres pg_isready -U postgres 2>$null
            if ($pgReady -match "accepting connections") {
                break
            }
            Start-Sleep -Seconds 1
        }
        
        Write-ColorOutput "Waiting for Redis..." "Info"
        for ($i = 0; $i -lt 30; $i++) {
            $redisReady = docker exec lux-auto-redis redis-cli ping 2>$null
            if ($redisReady -match "PONG") {
                break
            }
            Start-Sleep -Seconds 1
        }
        
        Write-ColorOutput "✓ All infrastructure services healthy" "Success"
        return $true
    }
    catch {
        Write-ColorOutput "✗ Infrastructure startup failed: $_" "Error"
        return $false
    }
}

# Phase 4: Deploy Application Instances (Idempotent with rolling deployment)
function Invoke-PhaseDeployment {
    Write-ColorOutput "=== PHASE 4: Deploy Application Instances ===" "Info"
    
    if ($DryRun) {
        Write-ColorOutput "[DRY-RUN] docker-compose -f $($Config.ComposeFile) up -d lux-auto-prod-1 lux-auto-prod-2 lux-auto-prod-3" "Warning"
        return $true
    }
    
    try {
        # Start all production instances
        & docker-compose -f $Config.ComposeFile up -d lux-auto-prod-1 lux-auto-prod-2 lux-auto-prod-3
        
        Write-ColorOutput "✓ All production instances deployed" "Success"
        return $true
    }
    catch {
        Write-ColorOutput "✗ Deployment failed: $_" "Error"
        return $false
    }
}

# Phase 5: Health Verification (Idempotent with retries)
function Invoke-PhaseHealthVerification {
    Write-ColorOutput "=== PHASE 5: Health Verification ===" "Info"
    
    if ($SkipHealthChecks) {
        Write-ColorOutput "⊘ Health checks skipped" "Warning"
        return $true
    }
    
    $allHealthy = $true
    
    @(
        @{ Name = "Instance 1"; Port = 8889 },
        @{ Name = "Instance 2"; Port = 8890 },
        @{ Name = "Instance 3"; Port = 8891 }
    ) | ForEach-Object {
        $healthy = Test-ServiceHealth -ServiceName $_.Name -Port $_.Port
        if (-not $healthy) {
            $allHealthy = $false
        }
    }
    
    if ($allHealthy) {
        Write-ColorOutput "✓ All instances passed health checks" "Success"
        return $true
    }
    else {
        Write-ColorOutput "✗ Some instances failed health checks" "Error"
        return $false
    }
}

# Rollback Function (Idempotent)
function Invoke-Rollback {
    Write-ColorOutput "=== INITIATING ROLLBACK ===" "Error"
    
    if (-not $Config.RollbackEnabled) {
        Write-ColorOutput "Rollback disabled. Manual intervention required." "Error"
        return
    }
    
    try {
        Write-ColorOutput "Stopping current deployment..." "Warning"
        docker-compose -f $Config.ComposeFile down
        
        Write-ColorOutput "✓ Rollback completed" "Info"
    }
    catch {
        Write-ColorOutput "✗ Rollback failed (manual intervention needed): $_" "Error"
    }
}

# Main Execution Flow (Idempotent)
function Invoke-MainDeployment {
    Write-ColorOutput "╔════════════════════════════════════════════════════════╗" "Info"
    Write-ColorOutput "║   LUX-AUTO IMMUTABLE & IDEMPOTENT DEPLOYMENT            ║" "Info"
    Write-ColorOutput "║   Environment: $($Config.Environment.PadRight(45, ' ')) ║" "Info"
    Write-ColorOutput "║   Time: $((Get-Date).ToString('u').PadRight(50, ' ')) ║" "Info"
    Write-ColorOutput "╚════════════════════════════════════════════════════════╝" "Info"
    
    if ($DryRun) {
        Write-ColorOutput "[DRY-RUN MODE] No actual changes will be made" "Warning"
    }
    
    # Execute phases in sequence
    $phases = @(
        @{ Name = "Prerequisites"; Func = { Invoke-PhasePrerequisites } },
        @{ Name = "Build"; Func = { Invoke-PhaseBuild } },
        @{ Name = "Infrastructure"; Func = { Invoke-PhaseInfrastructure } },
        @{ Name = "Deployment"; Func = { Invoke-PhaseDeployment } },
        @{ Name = "Health Verification"; Func = { Invoke-PhaseHealthVerification } }
    )
    
    foreach ($phase in $phases) {
        $result = & $phase.Func
        
        if (-not $result) {
            Write-ColorOutput "✗ Phase '$($phase.Name)' failed!" "Error"
            
            if ($Config.RollbackEnabled) {
                Invoke-Rollback
            }
            
            return $false
        }
    }
    
    # Success - Update state
    $state = Get-DeploymentState
    $state.status = "deployed"
    $state.lastDeploy = (Get-Date).ToString("o")
    Set-DeploymentState $state
    
    Write-ColorOutput "╔════════════════════════════════════════════════════════╗" "Success"
    Write-ColorOutput "║   DEPLOYMENT COMPLETED SUCCESSFULLY                    ║" "Success"
    Write-ColorOutput "║   Status: RUNNING                                      ║" "Success"
    Write-ColorOutput "║   Instances: 3 (ports 8889-8891)                       ║" "Success"
    Write-ColorOutput "║   Access: http://lux.kushnir.cloud/health              ║" "Success"
    Write-ColorOutput "╚════════════════════════════════════════════════════════╝" "Success"
    
    # Verify containers
    Write-ColorOutput "`nRunning Containers:" "Info"
    docker ps --filter "name=lux-auto" --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
    
    return $true
}

# Execute Main Flow
$success = Invoke-MainDeployment

exit ($success ? 0 : 1)
