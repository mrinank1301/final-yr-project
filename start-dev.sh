#!/bin/bash
# =============================================================================
# Video Calling Application - Startup Script (Linux/Mac)
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo -e "${CYAN}========================================"
echo "  Video Calling Application - Start"
echo -e "========================================${NC}"
echo ""

# Check Docker
if ! docker ps > /dev/null 2>&1; then
    echo -e "${RED}Docker is not running!${NC}"
    echo -e "${YELLOW}  Please start Docker and try again.${NC}"
    exit 1
fi

# Start/Check LiveKit
LIVEKIT_RUNNING=$(docker ps --filter "name=livekit" --format "{{.Names}}" 2>/dev/null)
if [ "$LIVEKIT_RUNNING" == "livekit" ]; then
    echo -e "${GREEN}LiveKit is already running${NC}"
else
    echo -e "${YELLOW}Starting LiveKit...${NC}"
    docker run -d --name livekit \
        -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
        -e LIVEKIT_KEYS="devkey: secret" \
        livekit/livekit-server 2>/dev/null || docker start livekit 2>/dev/null
    echo -e "${GREEN}LiveKit started${NC}"
fi

sleep 2
echo ""

# Function to run in background with output
run_service() {
    local name=$1
    local dir=$2
    local cmd=$3
    local color=$4
    
    echo -e "${color}Starting $name...${NC}"
    cd "$SCRIPT_DIR/$dir"
    $cmd &
}

# Start Node Backend
echo -e "${BLUE}Starting Node Backend (Port 3001)...${NC}"
cd "$SCRIPT_DIR/backend/node server"
npm run dev &
NODE_PID=$!

sleep 2

# Start Python Backend
echo -e "${MAGENTA}Starting Python Backend (Port 5000)...${NC}"
cd "$SCRIPT_DIR/backend/python server"
python app.py &
PYTHON_PID=$!

sleep 2

# Start Frontend
echo -e "${CYAN}Starting Frontend (Port 3000)...${NC}"
cd "$SCRIPT_DIR/frontend/project"
npm run dev &
FRONTEND_PID=$!

sleep 3

echo ""
echo -e "${CYAN}========================================"
echo "  All Services Started!"
echo -e "========================================${NC}"
echo ""
echo -e "${YELLOW}Open: http://localhost:3000${NC}"
echo ""
echo "Services:"
echo "  Frontend:        http://localhost:3000"
echo "  Node Backend:    http://localhost:3001"
echo "  Python Backend:  http://localhost:5000"
echo "  Python API Docs: http://localhost:5000/docs"
echo "  LiveKit:         ws://localhost:7880"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Trap to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping services...${NC}"
    kill $NODE_PID 2>/dev/null
    kill $PYTHON_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}All services stopped.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for all processes
wait
