# =============================================================================
# Video Calling Application - Unified Startup Script
# =============================================================================
# This script starts all services in a single window with colored output
# Services: Docker/LiveKit, Node Backend, Python Backend, Frontend
# =============================================================================

param(
    [switch]$SkipDocker,
    [switch]$Install
)

$ErrorActionPreference = "Continue"

# Colors
$colors = @{
    Header = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error = "Red"
    Info = "White"
    Node = "Blue"
    Python = "Magenta"
    Frontend = "DarkCyan"
}

function Write-Banner {
    Write-Host ""
    Write-Host "  ================================================================" -ForegroundColor $colors.Header
    Write-Host "        VIDEO CALLING APPLICATION - UNIFIED STARTUP" -ForegroundColor $colors.Header
    Write-Host "  ================================================================" -ForegroundColor $colors.Header
    Write-Host ""
}

function Write-ServiceStatus {
    param($Name, $Status, $Port, $Color)
    $statusIcon = if ($Status -eq "Running") { "[OK]" } else { "[--]" }
    $statusColor = if ($Status -eq "Running") { $colors.Success } else { $colors.Warning }
    Write-Host "  $statusIcon " -NoNewline -ForegroundColor $statusColor
    Write-Host "$Name" -NoNewline -ForegroundColor $Color
    if ($Port) {
        Write-Host " -> http://localhost:$Port" -ForegroundColor $colors.Info
    } else {
        Write-Host "" -ForegroundColor $colors.Info
    }
}

function Test-Port {
    param($Port)
    try {
        $connection = New-Object System.Net.Sockets.TcpClient
        $connection.Connect("localhost", $Port)
        $connection.Close()
        return $true
    } catch {
        return $false
    }
}

# Set working directory to script location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Banner

# =============================================================================
# Step 1: Check Prerequisites
# =============================================================================
Write-Host "  [1/5] Checking Prerequisites..." -ForegroundColor $colors.Header
Write-Host ""

# Check Node.js
$nodeVersion = node --version 2>$null
if ($nodeVersion) {
    Write-Host "       Node.js: $nodeVersion" -ForegroundColor $colors.Success
} else {
    Write-Host "       Node.js: NOT FOUND - Please install Node.js" -ForegroundColor $colors.Error
    exit 1
}

# Check Python
$pythonVersion = python --version 2>$null
if ($pythonVersion) {
    Write-Host "       Python: $pythonVersion" -ForegroundColor $colors.Success
} else {
    Write-Host "       Python: NOT FOUND - Please install Python" -ForegroundColor $colors.Error
    exit 1
}

# Check Docker (optional)
if (-not $SkipDocker) {
    $dockerRunning = docker ps 2>$null
    if ($?) {
        Write-Host "       Docker: Running" -ForegroundColor $colors.Success
    } else {
        Write-Host "       Docker: Not running (use -SkipDocker to skip)" -ForegroundColor $colors.Warning
    }
}

Write-Host ""

# =============================================================================
# Step 2: Install Dependencies (if -Install flag)
# =============================================================================
if ($Install) {
    Write-Host "  [2/5] Installing Dependencies..." -ForegroundColor $colors.Header
    Write-Host ""
    
    # Node backend
    Write-Host "       Installing Node backend dependencies..." -ForegroundColor $colors.Node
    Push-Location "backend/node server"
    npm install --silent 2>$null
    Pop-Location
    
    # Python backend
    Write-Host "       Installing Python backend dependencies..." -ForegroundColor $colors.Python
    Push-Location "backend/python server"
    pip install -r requirements.txt --quiet 2>$null
    Pop-Location
    
    # Frontend
    Write-Host "       Installing Frontend dependencies..." -ForegroundColor $colors.Frontend
    Push-Location "frontend/project"
    npm install --silent 2>$null
    Pop-Location
    
    Write-Host "       Dependencies installed!" -ForegroundColor $colors.Success
    Write-Host ""
} else {
    Write-Host "  [2/5] Skipping dependency install (use -Install to install)" -ForegroundColor $colors.Info
    Write-Host ""
}

# =============================================================================
# Step 3: Start Docker/LiveKit
# =============================================================================
if (-not $SkipDocker) {
    Write-Host "  [3/5] Starting LiveKit (Docker)..." -ForegroundColor $colors.Header
    
    $livekitRunning = docker ps --filter "name=livekit" --format "{{.Names}}" 2>$null
    if ($livekitRunning -eq "livekit") {
        Write-Host "       LiveKit already running" -ForegroundColor $colors.Success
    } else {
        # Try to start existing container
        docker start livekit 2>$null | Out-Null
        if (-not $?) {
            # Create new container
            Write-Host "       Creating LiveKit container..." -ForegroundColor $colors.Warning
            docker run -d --name livekit `
                -p 7880:7880 -p 7881:7881 -p 7882:7882/udp `
                -e LIVEKIT_KEYS="devkey: secret" `
                livekit/livekit-server 2>$null | Out-Null
        }
        Write-Host "       LiveKit started" -ForegroundColor $colors.Success
    }
    Write-Host ""
} else {
    Write-Host "  [3/5] Skipping Docker/LiveKit (use without -SkipDocker to enable)" -ForegroundColor $colors.Info
    Write-Host ""
}

# =============================================================================
# Step 4: Start All Services
# =============================================================================
Write-Host "  [4/5] Starting Services..." -ForegroundColor $colors.Header
Write-Host ""

# Create jobs for each service
$jobs = @()

# Node Backend Job
Write-Host "       Starting Node Backend (Port 3001)..." -ForegroundColor $colors.Node
$nodeJob = Start-Job -Name "NodeBackend" -ScriptBlock {
    Set-Location $using:scriptDir
    Set-Location "backend/node server"
    npm run dev 2>&1
}
$jobs += $nodeJob

# Wait for Node to initialize
Start-Sleep -Seconds 2

# Python Backend Job
Write-Host "       Starting Python Backend (Port 5000)..." -ForegroundColor $colors.Python
$pythonJob = Start-Job -Name "PythonBackend" -ScriptBlock {
    Set-Location $using:scriptDir
    Set-Location "backend/python server"
    python app.py 2>&1
}
$jobs += $pythonJob

# Wait for Python to initialize
Start-Sleep -Seconds 2

# Frontend Job
Write-Host "       Starting Frontend (Port 3000)..." -ForegroundColor $colors.Frontend
$frontendJob = Start-Job -Name "Frontend" -ScriptBlock {
    Set-Location $using:scriptDir
    Set-Location "frontend/project"
    npm run dev 2>&1
}
$jobs += $frontendJob

Write-Host ""

# =============================================================================
# Step 5: Wait and Monitor
# =============================================================================
Write-Host "  [5/5] Waiting for services to start..." -ForegroundColor $colors.Header
Start-Sleep -Seconds 5

# Check if services are running
Write-Host ""
Write-Host "  ================================================================" -ForegroundColor $colors.Header
Write-Host "                    SERVICE STATUS" -ForegroundColor $colors.Header
Write-Host "  ================================================================" -ForegroundColor $colors.Header
Write-Host ""

$frontendReady = Test-Port 3000
$nodeReady = Test-Port 3001
$pythonReady = Test-Port 5000

Write-ServiceStatus "Frontend (Next.js)" $(if($frontendReady){"Running"}else{"Starting..."}) 3000 $colors.Frontend
Write-ServiceStatus "Node Backend" $(if($nodeReady){"Running"}else{"Starting..."}) 3001 $colors.Node
Write-ServiceStatus "Python Backend" $(if($pythonReady){"Running"}else{"Starting..."}) 5000 $colors.Python
if (-not $SkipDocker) {
    Write-ServiceStatus "LiveKit (Docker)" "Running" 7880 $colors.Success
}

Write-Host ""
Write-Host "  ================================================================" -ForegroundColor $colors.Header
Write-Host "                    QUICK LINKS" -ForegroundColor $colors.Header
Write-Host "  ================================================================" -ForegroundColor $colors.Header
Write-Host ""
Write-Host "    Application:   " -NoNewline -ForegroundColor $colors.Info
Write-Host "http://localhost:3000" -ForegroundColor $colors.Success
Write-Host "    API Docs:      " -NoNewline -ForegroundColor $colors.Info
Write-Host "http://localhost:5000/docs" -ForegroundColor $colors.Success
Write-Host "    Node API:      " -NoNewline -ForegroundColor $colors.Info
Write-Host "http://localhost:3001" -ForegroundColor $colors.Success
Write-Host ""
Write-Host "  ================================================================" -ForegroundColor $colors.Header
Write-Host ""
Write-Host "  Press Ctrl+C to stop all services" -ForegroundColor $colors.Warning
Write-Host ""
Write-Host "  ================================================================" -ForegroundColor $colors.Header
Write-Host "                    LIVE LOGS" -ForegroundColor $colors.Header
Write-Host "  ================================================================" -ForegroundColor $colors.Header
Write-Host ""

# Stream logs from all jobs
try {
    while ($true) {
        foreach ($job in $jobs) {
            $output = Receive-Job -Job $job -ErrorAction SilentlyContinue
            if ($output) {
                $color = switch ($job.Name) {
                    "NodeBackend" { $colors.Node }
                    "PythonBackend" { $colors.Python }
                    "Frontend" { $colors.Frontend }
                    default { $colors.Info }
                }
                $prefix = switch ($job.Name) {
                    "NodeBackend" { "[NODE]" }
                    "PythonBackend" { "[PYTHON]" }
                    "Frontend" { "[FRONTEND]" }
                    default { "[INFO]" }
                }
                foreach ($line in $output) {
                    Write-Host "$prefix $line" -ForegroundColor $color
                }
            }
        }
        Start-Sleep -Milliseconds 500
    }
} finally {
    # Cleanup on Ctrl+C
    Write-Host ""
    Write-Host "  Stopping all services..." -ForegroundColor $colors.Warning
    $jobs | Stop-Job -PassThru | Remove-Job -Force
    Write-Host "  All services stopped." -ForegroundColor $colors.Success
}
