# Quick Startup Guide

## ⚡ One-Command Start (Recommended)

### Windows

**Double-click:** `START.bat`

**Or PowerShell:**
```powershell
.\start-all.ps1
```

**First time (install dependencies):**
```powershell
.\start-all.ps1 -Install
```

**Skip Docker:**
```powershell
.\start-all.ps1 -SkipDocker
```

---

## 🔗 Quick Links

| Service | URL |
|---------|-----|
| Application | http://localhost:3000 |
| API Docs | http://localhost:5000/docs |
| Node Backend | http://localhost:3001 |

---

## 📋 Checklist

- [ ] Docker Desktop running
- [ ] Node.js installed
- [ ] Python installed
- [ ] `.env` files created (see README.md)

---

## 🛠️ Manual Start

```bash
# Terminal 1: LiveKit
docker start livekit

# Terminal 2: Node Backend
cd "backend/node server" && npm run dev

# Terminal 3: Python Backend  
cd "backend/python server" && python app.py

# Terminal 4: Frontend
cd frontend/project && npm run dev
```

---

## 🛑 Stop All

Press `Ctrl+C` in the terminal running `start-all.ps1`

---

## 🐛 Issues?

See main [README.md](README.md) for troubleshooting.
