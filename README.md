# Video Calling Application

A modern video calling application with AI-powered features, built with Next.js, TypeScript, FastAPI, and LiveKit.

## 🚀 Features

- Google Meet-style clean UI
- High-quality video and audio calling
- Create instant meetings with one click
- Join meetings using a code
- Multiple participants support
- Screen sharing
- **AI Meeting Assistant** (Gemini-powered)
- **Collaborative Code Editor** (Real-time multi-user coding)
- Code execution (Python, JavaScript, C++, Java)
- Real-time communication via LiveKit

---

## ⚡ Quick Start (One Command)

### Windows (Recommended)

**Option 1: Double-click**
```
Double-click START.bat
```

**Option 2: PowerShell**
```powershell
.\start-all.ps1
```

**First time setup:**
```powershell
.\start-all.ps1 -Install
```

This single command starts ALL services:
- ✅ LiveKit (Docker)
- ✅ Node.js Backend (Port 3001)
- ✅ Python AI Backend (Port 5000)
- ✅ Frontend (Port 3000)

### Linux/Mac

```bash
chmod +x start-dev.sh
./start-dev.sh
```

---

## 📁 Project Structure

```
video-calling-app/
├── frontend/project/              # Next.js Frontend
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── room/[roomId]/        # Video room
│   │   └── components/
│   │       ├── landing/          # Landing page components
│   │       └── room/             # Room components (AI, Code Editor, etc.)
│   └── package.json
│
├── backend/
│   ├── node server/              # Node.js Backend (LiveKit tokens)
│   │   ├── src/index.ts
│   │   └── package.json
│   │
│   └── python server/            # Python AI Backend (Modular)
│       ├── app.py                # Main entry point
│       ├── config.py             # Configuration
│       ├── models.py             # Pydantic models
│       ├── routers/              # API routes
│       │   ├── ai_router.py      # AI endpoints
│       │   └── code_router.py    # Code execution
│       ├── services/             # Business logic
│       │   ├── ai_service.py     # Gemini AI service
│       │   └── code_execution.py # Code sandbox
│       ├── websockets/           # WebSocket handlers
│       │   ├── ai_chat.py        # AI chat WebSocket
│       │   └── collaborative.py  # Yjs sync WebSocket
│       └── requirements.txt
│
├── START.bat                     # Windows double-click starter
├── start-all.ps1                 # PowerShell unified startup
├── start-dev.sh                  # Linux/Mac startup
└── README.md
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Node Backend | Express, TypeScript, LiveKit Server SDK |
| Python Backend | FastAPI, Uvicorn, Pydantic, Gemini AI |
| Collaborative Editor | CodeMirror 6, Yjs, y-websocket |
| Video Server | LiveKit (Docker/Cloud) |

---

## 📦 Services Overview

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 3000 | Next.js UI |
| Node Backend | 3001 | LiveKit token generation |
| Python Backend | 5000 | AI features, code execution, collaboration |
| LiveKit | 7880 | WebRTC video server |

---

## 🔧 Manual Setup

### Prerequisites

- Node.js 18+
- Python 3.10+
- Docker Desktop

### 1. Environment Files

**Backend Node (`backend/node server/.env`):**
```env
PORT=3001
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://localhost:7880
```

**Backend Python (`backend/python server/.env`):**
```env
PORT=5000
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://localhost:7880
GEMINI_API_KEY=your_gemini_api_key
```

**Frontend (`frontend/project/.env.local`):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_PYTHON_API_URL=http://localhost:5000
```

### 2. Install Dependencies

```bash
# Node backend
cd "backend/node server"
npm install

# Python backend
cd "backend/python server"
pip install -r requirements.txt

# Frontend
cd frontend/project
npm install
```

### 3. Start Services Manually

```bash
# Terminal 1: LiveKit
docker run -d --name livekit -p 7880:7880 -p 7881:7881 -p 7882:7882/udp -e LIVEKIT_KEYS="devkey: secret" livekit/livekit-server

# Terminal 2: Node Backend
cd "backend/node server" && npm run dev

# Terminal 3: Python Backend
cd "backend/python server" && python app.py

# Terminal 4: Frontend
cd frontend/project && npm run dev
```

---

## 🎯 Usage

1. Open **http://localhost:3000**
2. Enter your name
3. Click **"New meeting"** to create a meeting
4. Share the URL with others to join
5. Use the bottom toolbar for:
   - 🎤 Mic on/off
   - 📷 Camera on/off
   - 🖥️ Screen share
   - 💬 Chat
   - 👥 Participants
   - 🤖 AI Assistant
   - 💻 Code Editor

---

## 🤖 AI Features

The AI Assistant can:
- Answer questions about the meeting
- Summarize discussions
- Listen to the meeting and auto-respond to questions
- Transcribe audio in real-time

Access via the **🤖 AI** button in the meeting toolbar.

---

## 💻 Collaborative Code Editor

Features:
- Real-time collaborative editing
- Multiple cursors with participant names
- Language support: Python, JavaScript, C++, Java
- Integrated terminal for code execution
- Full-screen mode

When one participant opens the Code Editor, all others automatically see it.

---

## 📝 API Documentation

### Python Backend Endpoints

- **Swagger UI**: http://localhost:5000/docs
- **ReDoc**: http://localhost:5000/redoc

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/chat` | POST | AI chat |
| `/api/transcribe` | POST | Audio transcription |
| `/api/analyze-sentiment` | POST | Sentiment analysis |
| `/api/generate-summary` | POST | Meeting summary |
| `/api/execute-code` | POST | Code execution |
| `/ws/ai-chat/{id}` | WS | Real-time AI chat |
| `/ws/yjs/{room}` | WS | Collaborative editing |

---

## 🐛 Troubleshooting

### "Docker not found"
- Install Docker Desktop
- Make sure Docker is running

### "Port already in use"
```powershell
# Find what's using port 3000
netstat -ano | findstr :3000

# Kill process (replace PID)
taskkill /PID <PID> /F
```

### "Failed to connect to server"
- Ensure all services are running
- Check `.env` files are created
- Restart services after changing `.env`

### Camera/Mic not working
- Allow browser permissions
- Close other apps using camera
- Use Chrome browser

---

## 🔐 Security Notes

### Development (Local)
- Default credentials (`devkey:secret`) are fine
- HTTP/WS connections acceptable

### Production
- ⚠️ Change default credentials
- ⚠️ Use HTTPS/WSS everywhere
- ⚠️ Implement authentication
- ⚠️ Set up proper CORS

---

## 📄 License

MIT License - Free for educational and commercial use

---

## 🎉 Quick Reference

```
Start:      .\start-all.ps1  or  START.bat
Frontend:   http://localhost:3000
API Docs:   http://localhost:5000/docs
Stop:       Ctrl+C in the terminal
```

**Happy coding!** 🚀
