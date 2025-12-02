# Video Calling Application

A modern, clean video calling application similar to Google Meet, built with Next.js, TypeScript, FastAPI, and LiveKit.

## 🚀 Features

- Clean Google Meet-style UI with white background
- High-quality video and audio calling
- Create instant meetings with one click
- Join meetings using a code
- Multiple participants support
- Screen sharing
- Real-time communication via LiveKit
- TypeScript for type safety
- FastAPI backend ready for AI features

## 📁 Project Structure

```
├── frontend/project/           # Next.js frontend
│   ├── app/
│   │   ├── page.tsx           # Landing page
│   │   └── room/[roomId]/     # Video room
│   └── package.json
├── backend/
│   ├── node server/           # TypeScript backend (LiveKit tokens)
│   └── python server/         # FastAPI backend (AI features)
├── start-dev.ps1              # Windows startup script
├── start-dev.sh               # Linux/Mac startup script
└── README.md                  # This file
```

## 🛠️ Tech Stack

**Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, LiveKit Components  
**Backend (Node):** Express, TypeScript, LiveKit Server SDK  
**Backend (Python):** FastAPI, Uvicorn, Pydantic  
**Video Server:** LiveKit (self-hosted or cloud)

---

## ⚡ Quick Start

### Prerequisites

- Node.js 18+
- Python 3.8+ (optional, for AI features)
- Docker (for LiveKit)

### 1. Start LiveKit Server

**Windows PowerShell:**
```powershell
docker run -d --name livekit -p 7880:7880 -p 7881:7881 -p 7882:7882/udp -e LIVEKIT_KEYS="devkey: secret" livekit/livekit-server
```

**Linux/Mac:**
```bash
docker run -d --name livekit -p 7880:7880 -p 7881:7881 -p 7882:7882/udp -e LIVEKIT_KEYS="devkey: secret" livekit/livekit-server
```

### 2. Setup Node Backend

```bash
cd "backend/node server"
npm install
```

Create `.env` file:
```env
PORT=3001
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://localhost:7880
```

Start backend:
```bash
npm run dev
```

### 3. Setup Frontend

```bash
cd frontend/project
npm install
```

Create `.env.local` file:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Start frontend:
```bash
npm run dev
```

### 4. Open Application

Visit **http://localhost:3000** in your browser!

---

## 🎯 Usage

1. Enter your name
2. Click **"New meeting"** to create a meeting
3. Share the URL with others to join
4. Or use **"Join"** with a meeting code

---

## 🔧 Configuration

### Development Credentials (Default)

```
LiveKit API Key: devkey
LiveKit API Secret: secret
LiveKit URL: ws://localhost:7880
```

⚠️ **Production:** Use LiveKit Cloud or generate secure credentials

### Generate Production Credentials

```bash
# API Key (16 bytes)
openssl rand -hex 16

# API Secret (32 bytes)
openssl rand -hex 32
```

### LiveKit Cloud (Recommended for Production)

1. Sign up at https://cloud.livekit.io/
2. Create a project
3. Copy your credentials
4. Update `.env` files with your credentials

---

## 🐍 Python Backend (Optional - AI Features)

### Setup

```bash
cd "backend/python server"
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Create `.env` file:
```env
PORT=5000
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://localhost:7880
```

### Run

```bash
python app.py
```

### API Documentation

- **Swagger UI**: http://localhost:5000/docs
- **ReDoc**: http://localhost:5000/redoc

### Placeholder Endpoints (Ready for AI Integration)

- `POST /api/transcribe` - Real-time transcription
- `POST /api/analyze-sentiment` - Sentiment analysis
- `POST /api/generate-summary` - Meeting summaries

---

## 🎨 UI Design

Clean, professional interface inspired by Google Meet:
- White background
- Blue accent colors
- Responsive design
- Smooth transitions
- Modern typography

---

## 📦 Services Overview

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 3000 | Next.js UI |
| Node Backend | 3001 | Token generation |
| Python Backend | 5000 | AI features |
| LiveKit | 7880 | Video server |

---

## 🔍 Development

### Check Service Status

```bash
# LiveKit
docker ps | grep livekit
docker logs livekit

# Backend health
curl http://localhost:3001/health

# Python backend health
curl http://localhost:5000/health
```

### Stop Services

```bash
# Stop LiveKit
docker stop livekit

# Stop Node/Frontend (Ctrl+C in their terminals)
```

### Restart Services

```bash
# Restart LiveKit
docker restart livekit

# Restart backends (Ctrl+C and run npm run dev again)
```

---

## 🚀 Production Deployment

### Frontend (Vercel/Netlify)

```bash
cd frontend/project
npm run build
```

Deploy to Vercel or Netlify and set environment variables.

### Backend (Railway/Heroku/DigitalOcean)

```bash
cd "backend/node server"
npm run build
npm start
```

### Important for Production

- ✅ Use HTTPS for all services
- ✅ Use WSS (secure WebSocket) for LiveKit
- ✅ Change default credentials
- ✅ Enable CORS properly
- ✅ Add authentication
- ✅ Set up SSL certificates

---

## 🐛 Troubleshooting

### "Failed to connect to server"

- Ensure backend is running on port 3001
- Check `NEXT_PUBLIC_API_URL` in frontend `.env.local`
- Restart backend after .env changes

### "Token generation failed"

- Verify LiveKit is running: `docker ps`
- Check credentials match in backend `.env`
- Ensure LiveKit URL is correct

### Video/Audio not working

- Allow browser permissions for camera/microphone
- Close other apps using camera
- Try Chrome (best WebRTC support)

### Port conflicts

```bash
# Windows
netstat -ano | findstr :3000

# Linux/Mac
lsof -i :3000

# Change port
npm run dev -- -p 3002
```

---

## 📝 API Endpoints

### Node Backend (Port 3001)

**GET /health**
```json
{"status": "ok"}
```

**POST /api/token**
```json
{
  "roomName": "meeting-code",
  "participantName": "John Doe"
}
```

**POST /api/room**
```json
{
  "roomName": "meeting-code"
}
```

---

## 🎓 For Development/Learning

### Architecture

```
User Browser (Frontend)
    ↓ HTTP/REST
Node.js Backend (Token Generation)
    ↓ LiveKit SDK
LiveKit Server (WebRTC)
    ↓ Media Stream
All Participants
```

### How It Works

1. User creates meeting → Frontend generates room ID
2. Frontend requests token → Backend generates JWT
3. Frontend connects to LiveKit → WebRTC session starts
4. Other users join → See each other in real-time

---

## 🔐 Security Notes

### Development

- Default credentials (`devkey:secret`) are fine
- HTTP/WS connections acceptable
- Local access only

### Production

- **MUST** change default credentials
- **MUST** use HTTPS/WSS
- **SHOULD** implement authentication
- **SHOULD** validate room access
- **SHOULD** add rate limiting

---

## 🤝 Contributing

This is a final year project. Feel free to fork and customize!

---

## 📄 License

MIT License - Free for educational and commercial use

---

## 🆘 Need Help?

### Documentation

- **LiveKit Docs**: https://docs.livekit.io/
- **Next.js Docs**: https://nextjs.org/docs
- **FastAPI Docs**: https://fastapi.tiangolo.com/

### Common Issues

- **Windows Users**: Use PowerShell, copy entire Docker command as one line
- **Port Issues**: Change PORT in `.env` files
- **Permissions**: Allow camera/mic in browser settings

---

## 🎉 You're All Set!

1. ✅ Start LiveKit
2. ✅ Start Node backend
3. ✅ Start Frontend
4. ✅ Open http://localhost:3000
5. ✅ Create or join a meeting

**Happy coding!** 🚀
