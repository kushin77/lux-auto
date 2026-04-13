#!/usr/bin/env pwsh
# Deployment Monitoring & Verification Script
# Post-deployment idempotent health checks and metrics collection

param(
    [int]$CheckInterval = 10,
    [int]$DurationMinutes = 5
)

$ErrorActionPreference = "Stop"

# Config
$Services = @(
    @{ Name = "Instance 1"; Port = 8889; Container = "lux-auto-app-prod-1" },
    @{ Name = "Instance 2"; Port = 8890; Container = "lux-auto-app-prod-2" },
    @{ Name = "Instance 3"; Port = 8891; Container = "lux-auto-app-prod-3" }
)

$MetricsLog = "deployment-metrics.json"
$StartTime = Get-Date

function Get-ContainerMetrics {
    param([string]$ContainerName)
    
    try {
        $stats = docker stats --no-stream $ContainerName --format "{{.MemPerc}} {{.CPUPerc}}" 2>$null
        if ($stats) {
            [PSCustomObject]@{
                Container = $ContainerName
                Memory = ($stats.Split(" ")[0])
                CPU = ($stats.Split(" ")[1])
                Timestamp = (Get-Date).ToString("o")
            }
        }
    }
    catch {
        return $null
    }
}

function Test-ServiceEndpoint {
    param(
        [string]$Name,
        [int]$Port,
        [string]$Endpoint = "/health"
    )
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:${Port}${Endpoint}" `
            -Method Get `
            -TimeoutSec 5 `
            -ErrorAction Stop
        
        return [PSCustomObject]@{
            Service = $Name
            Status = "HEALTHY"
            HttpCode = $response.StatusCode
            ResponseTime = $response.Headers["X-Response-Time"] ?? "N/A"
            Timestamp = (Get-Date).ToString("o")
        }
    }
    catch {
        return [PSCustomObject]@{
            Service = $Name
            Status = "UNHEALTHY"
            HttpCode = "N/A"
            ResponseTime = "N/A"
            Error = $_.Exception.Message
            Timestamp = (Get-Date).ToString("o")
        }
    }
}

Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   DEPLOYMENT MONITORING & VERIFICATION                 ║" -ForegroundColor Cyan
Write-Host "║   Duration: $DurationMinutes minutes                              ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

$totalChecks = 0
$healthyChecks = 0
$allMetrics = @()

$endTime = $StartTime.AddMinutes($DurationMinutes)

while ((Get-Date) -lt $endTime) {
    Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] Health Check #$($totalChecks + 1):" -ForegroundColor Yellow
    
    $checkResults = @()
    
    foreach ($svc in $Services) {
        $result = Test-ServiceEndpoint -Name $svc.Name -Port $svc.Port
        $checkResults += $result
        
        $statusColor = if ($result.Status -eq "HEALTHY") { "Green" } else { "Red" }
        Write-Host "  ✓ $($result.Service): $($result.Status) (HTTP $($result.HttpCode))" -ForegroundColor $statusColor
        
        # Collect metrics
        $metrics = Get-ContainerMetrics -ContainerName $svc.Container
        if ($metrics) {
            $allMetrics += $metrics
            Write-Host "    └─ Memory: $($metrics.Memory) | CPU: $($metrics.CPU)"
        }
    }
    
    $healthy = ($checkResults | Where-Object { $_.Status -eq "HEALTHY" }).Count
    $total = $checkResults.Count
    
    Write-Host "  Summary: $healthy/$total services healthy" -ForegroundColor $(if ($healthy -eq $total) { "Green" } else { "Yellow" })
    
    if ($healthy -eq $total) {
        $healthyChecks++
    }
    
    $totalChecks++
    
    if ((Get-Date) -lt $endTime) {
        Start-Sleep -Seconds $CheckInterval
    }
}

# Generate Summary Report
$summaryReport = [PSCustomObject]@{
    DeploymentTime = (Get-Date).ToString("o")
    TotalChecks = $totalChecks
    HealthyCheckCycles = $healthyChecks
    HealthCheckPercent = [math]::Round(($healthyChecks / $totalChecks) * 100, 2)
    Containers = (docker ps --filter "name=lux-auto" --format "{{.Names}}" | Measure-Object).Count
    Metrics = $allMetrics
}

# Save report
$summaryReport | ConvertTo-Json | Set-Content $MetricsLog
Write-Host "`n✓ Metrics saved to $MetricsLog" -ForegroundColor Green

# Final Summary
Write-Host "`n╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   MONITORING SUMMARY                                   ║" -ForegroundColor Green
Write-Host "║   Total Checks: $($totalChecks.ToString().PadLeft(44, ' ')) ║" -ForegroundColor Green
Write-Host "║   Healthy Cycles: $($healthyChecks.ToString().PadLeft(40, ' ')) ║" -ForegroundColor Green
Write-Host "║   Health Rate: $($summaryReport.HealthCheckPercent.ToString("0.00").PadLeft(44, ' '))% ║" -ForegroundColor Green
Write-Host "║   Running Containers: $((docker ps --filter "name=lux-auto" --quiet | Measure-Object).Count.ToString().PadLeft(39, ' ')) ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Green

# List running containers
Write-Host "`nActive Services:" -ForegroundColor Cyan
docker ps --filter "name=lux-auto" --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
