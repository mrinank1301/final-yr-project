# Video Calling Application - Startup Script (Windows)
# Run this to start all services at once

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Video Calling Application - Start" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

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

# Start Node Backend
Write-Host "Starting Node Backend..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'backend\node server'; Write-Host '===========================================' -ForegroundColor Green; Write-Host '  Node.js Backend (Port 3001)' -ForegroundColor Green; Write-Host '===========================================' -ForegroundColor Green; npm run dev"

Start-Sleep -Seconds 3

# Start Frontend
Write-Host "Starting Frontend..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'frontend\project'; Write-Host '===========================================' -ForegroundColor Magenta; Write-Host '  Frontend (Port 3000)' -ForegroundColor Magenta; Write-Host '===========================================' -ForegroundColor Magenta; npm run dev"

Start-Sleep -Seconds 2
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  All Services Started!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Open: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Services:" -ForegroundColor Gray
Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor Gray
Write-Host "  Backend:   http://localhost:3001" -ForegroundColor Gray
Write-Host "  LiveKit:   ws://localhost:7880" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to exit this script" -ForegroundColor DarkGray
Write-Host "Services will continue running in other windows" -ForegroundColor DarkGray
Write-Host ""

# Keep script running
while ($true) {
    Start-Sleep -Seconds 10
}
