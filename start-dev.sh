cd#!/bin/bash
# Video Calling Application - Startup Script (Linux/Mac)
# Run this to start all services at once

echo "========================================"
echo "  Video Calling Application - Start"
echo "========================================"
echo ""

# Check if LiveKit is running
if docker ps --filter "name=livekit" --format "{{.Names}}" | grep -q "livekit"; then
    echo "✓ LiveKit is already running"
else
    echo "⚡ Starting LiveKit..."
    docker run -d --name livekit -p 7880:7880 -p 7881:7881 -p 7882:7882/udp -e LIVEKIT_KEYS="devkey: secret" livekit/livekit-server 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✓ LiveKit started successfully"
    else
        echo "⚠ LiveKit may already exist. Trying to start..."
        docker start livekit 2>/dev/null
    fi
fi

sleep 2
echo ""

# Start Node Backend
echo "🚀 Starting Node Backend..."
cd "backend/node server"
gnome-terminal -- bash -c "echo '==========================================='; \
    echo '  Node.js Backend (Port 3001)'; \
    echo '==========================================='; \
    npm run dev; exec bash" 2>/dev/null || \
    osascript -e 'tell app "Terminal" to do script "cd \"'"$(pwd)"'\" && npm run dev"' 2>/dev/null || \
    echo "  → Start manually: cd 'backend/node server' && npm run dev"

cd ../..
sleep 3

# Start Frontend
echo "🎨 Starting Frontend..."
cd "frontend/project"
gnome-terminal -- bash -c "echo '==========================================='; \
    echo '  Frontend (Port 3000)'; \
    echo '==========================================='; \
    npm run dev; exec bash" 2>/dev/null || \
    osascript -e 'tell app "Terminal" to do script "cd \"'"$(pwd)"'\" && npm run dev"' 2>/dev/null || \
    echo "  → Start manually: cd 'frontend/project' && npm run dev"

cd ../..
sleep 2

echo ""
echo "========================================"
echo "  All Services Started!"
echo "========================================"
echo ""
echo "📱 Open: http://localhost:3000"
echo ""
echo "Services:"
echo "  • Frontend:  http://localhost:3000"
echo "  • Backend:   http://localhost:3001"
echo "  • LiveKit:   ws://localhost:7880"
echo ""
echo "Press Ctrl+C to exit"
echo ""

# Keep script running
while true; do
    sleep 10
done
