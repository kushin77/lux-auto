#!/usr/bin/env pwsh
# Idempotent IaC Deployment Entry Point
# Manages complete product lifecycle: deploy, monitor, rollback, verify

param(
    [ValidateSet("deploy", "monitor", "rollback", "verify", "status")]
    [string]$Command = "deploy",
    [string]$Environment = "production",
    [switch]$DryRun,
    [switch]$SkipHealthChecks,
    [int]$MonitorMinutes = 5
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

# Logging Setup
New-Item -ItemType Directory -Path "$ProjectRoot/logs" -Force | Out-Null
$LogFile = "$ProjectRoot/logs/deployment-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

function Log-Output {
    param([string]$Message, [ValidateSet("Info", "Success", "Error", "Warning")][string]$Type = "Info")
    
    $timestamp = Get-Date -Format "HH:mm:ss"
    $colors = @{ Info = "Cyan"; Success = "Green"; Error = "Red"; Warning = "Yellow" }
    
    Write-Host "[$timestamp] $Message" -ForegroundColor $colors[$Type]
    "[$(Get-Date -Format 'o')] [$Type] $Message" | Add-Content $LogFile
}

switch ($Command) {
    "deploy" {
        Log-Output "🚀 Starting IaC Deployment (Immutable & Idempotent)" "Info"
        Log-Output "Environment: $Environment | DryRun: $DryRun | SkipHealthChecks: $SkipHealthChecks" "Info"
        
        & "$ProjectRoot/deploy-production.ps1" `
            -Environment $Environment `
            -SkipHealthChecks:$SkipHealthChecks `
            -DryRun:$DryRun
        
        if ($LASTEXITCODE -eq 0) {
            Log-Output "✅ Deployment successful. Starting monitoring..." "Success"
            Start-Sleep -Seconds 5
            
            Log-Output "Starting 5-minute post-deployment health monitoring..." "Info"
            & "$ProjectRoot/monitor-deployment.ps1" -DurationMinutes 5
            
            Log-Output "📊 Deployment Complete" "Success"
        }
        else {
            Log-Output "❌ Deployment failed" "Error"
            exit 1
        }
    }
    
    "monitor" {
        Log-Output "📊 Starting monitoring for $MonitorMinutes minutes..." "Info"
        & "$ProjectRoot/monitor-deployment.ps1" -DurationMinutes $MonitorMinutes
    }
    
    "rollback" {
        Log-Output "⚠️  INITIATING ROLLBACK" "Warning"
        
        try {
            docker-compose -f docker-compose.prod.yml down
            Log-Output "✓ Rollback completed - all services stopped" "Success"
        }
        catch {
            Log-Output "✗ Rollback failed: $_" "Error"
            exit 1
        }
    }
    
    "verify" {
        Log-Output "🔍 Verifying deployment state..." "Info"
        
        $containers = @("postgres", "redis", "lux-auto-app-prod-1", "lux-auto-app-prod-2", "lux-auto-app-prod-3")
        $running = 0
        
        foreach ($container in $containers) {
            $exists = docker ps --filter "name=$container" --format "{{.Names}}" 2>$null
            if ($exists) {
                Log-Output "✓ $container running" "Success"
                $running++
            }
            else {
                Log-Output "✗ $container not found" "Error"
            }
        }
        
        Log-Output "Total running: $running/$($containers.Count)" $(if ($running -eq $containers.Count) { "Success" } else { "Warning" })
        
        Log-Output "`nContainer Status:" "Info"
        docker ps --filter "name=lux-auto|postgres|redis" --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
    }
    
    "status" {
        Log-Output "📋 Deployment Status Report" "Info"
        
        $logFiles = Get-ChildItem "$ProjectRoot/logs" -Filter "*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        
        if ($logFiles) {
            $state = Get-Content $logFiles.FullName | ConvertFrom-Json
            Log-Output "Last Deployment: $($state.lastDeploy)" "Info"
            Log-Output "Status: $($state.status)" "Info"
            Log-Output "Image ID: $($state.imageId)" "Info"
        }
        
        Log-Output "`nRunning Services:" "Info"
        docker ps --filter "name=lux-auto|postgres|redis" --format "table {{.Names}}\t{{.State}}\t{{.Status}}"
    }
}

Log-Output "Command [$Command] completed. Log: $LogFile" "Info"
