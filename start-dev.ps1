# =============================================================================
# Video Calling Application - Multi-Window Startup Script
# =============================================================================
# This script opens separate windows for each service
# For unified single-window startup, use: .\start-all.ps1
# =============================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Video Calling Application - Start" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set working directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Check Docker
$dockerRunning = docker ps 2>$null
if (-not $?) {
    Write-Host "Docker is not running!" -ForegroundColor Red
    Write-Host "  Please start Docker Desktop and try again." -ForegroundColor Yellow
    exit 1
}

# Start/Check LiveKit
$livekitRunning = docker ps --filter "name=livekit" --format "{{.Names}}" 2>$null
if ($livekitRunning -eq "livekit") {
    Write-Host "LiveKit is already running" -ForegroundColor Green
} else {
    Write-Host "Starting LiveKit..." -ForegroundColor Yellow
    docker run -d --name livekit -p 7880:7880 -p 7881:7881 -p 7882:7882/udp -e LIVEKIT_KEYS="devkey: secret" livekit/livekit-server 2>$null
    if ($?) {
        Write-Host "LiveKit started successfully" -ForegroundColor Green
    } else {
        Write-Host "LiveKit may already exist. Trying to start..." -ForegroundColor Yellow
        docker start livekit 2>$null
    }
}

Start-Sleep -Seconds 2
Write-Host ""

# Start Node Backend (new window)
Write-Host "Starting Node Backend (new window)..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$scriptDir\backend\node server'; Write-Host '===========================================`n  Node.js Backend (Port 3001)`n===========================================' -ForegroundColor Green; npm run dev"

Start-Sleep -Seconds 2

# Start Python Backend (new window)
Write-Host "Starting Python Backend (new window)..." -ForegroundColor Magenta
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$scriptDir\backend\python server'; Write-Host '===========================================`n  Python Backend (Port 5000)`n===========================================' -ForegroundColor Magenta; python app.py"

Start-Sleep -Seconds 2

# Start Frontend (new window)
Write-Host "Starting Frontend (new window)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$scriptDir\frontend\project'; Write-Host '===========================================`n  Frontend (Port 3000)`n===========================================' -ForegroundColor Cyan; npm run dev"

Start-Sleep -Seconds 2
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  All Services Started!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Open: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Services:" -ForegroundColor Gray
Write-Host "  Frontend:        http://localhost:3000" -ForegroundColor Gray
Write-Host "  Node Backend:    http://localhost:3001" -ForegroundColor Gray
Write-Host "  Python Backend:  http://localhost:5000" -ForegroundColor Gray
Write-Host "  Python API Docs: http://localhost:5000/docs" -ForegroundColor Gray
Write-Host "  LiveKit:         ws://localhost:7880" -ForegroundColor Gray
Write-Host ""
Write-Host "Tip: Use .\start-all.ps1 for single-window startup" -ForegroundColor DarkGray
Write-Host ""
