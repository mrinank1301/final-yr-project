# Quick Startup Guide

## 🚀 Start Everything in 3 Steps

### Step 1: Start LiveKit

**Windows PowerShell:**
```powershell
docker run -d --name livekit -p 7880:7880 -p 7881:7881 -p 7882:7882/udp -e LIVEKIT_KEYS="devkey: secret" livekit/livekit-server
```

**Linux/Mac:**
```bash
docker run -d --name livekit -p 7880:7880 -p 7881:7881 -p 7882:7882/udp -e LIVEKIT_KEYS="devkey: secret" livekit/livekit-server
```

✅ You'll get a long ID - that's normal! LiveKit is running.

---

### Step 2: Start Node Backend

**New terminal window:**

```bash
cd "backend/node server"
npm install  # First time only
npm run dev
```

**First time?** Create `.env` file:
```env
PORT=3001
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://localhost:7880
```

---

### Step 3: Start Frontend

**Another new terminal window:**

```bash
cd frontend/project
npm install  # First time only
npm run dev
```

**First time?** Create `.env.local` file:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## ✅ Test It

Open browser: **http://localhost:3000**

1. Enter your name
2. Click "New meeting"
3. Allow camera/microphone
4. Share URL with others!

---

## 🛠️ Using Startup Scripts

### Windows

```powershell
.\start-dev.ps1
```

### Linux/Mac

```bash
chmod +x start-dev.sh
./start-dev.sh
```

This starts everything automatically!

---

## 🔄 Restart After Closing

If you closed terminals, just restart:

```bash
# If LiveKit stopped
docker start livekit

# Backend (in backend/node server)
npm run dev

# Frontend (in frontend/project)
npm run dev
```

---

## 🐛 Quick Fixes

### "Docker not found"
- Install Docker Desktop
- Make sure it's running

### "Port already in use"
- Something is using the port
- Change PORT in `.env` or kill the process

### "Failed to connect"
- Make sure all 3 services are running
- Check `.env` files are created
- Restart backend after .env changes

### Camera not working
- Allow permissions in browser
- Close other apps using camera
- Try Chrome browser

---

## 🎯 What Should Be Running

When everything is working:

✅ **Docker container** - LiveKit (port 7880)  
✅ **Terminal 1** - Node backend (port 3001)  
✅ **Terminal 2** - Frontend (port 3000)  

---

## 📝 Create .env Files (First Time Only)

### Backend: `backend/node server/.env`

```env
PORT=3001
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://localhost:7880
```

### Frontend: `frontend/project/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Note**: Create these files manually with a text editor if needed.

---

## ⚡ One-Time Setup Checklist

- [ ] Docker installed and running
- [ ] Node.js installed
- [ ] Run `npm install` in backend
- [ ] Run `npm install` in frontend
- [ ] Create `.env` file in backend
- [ ] Create `.env.local` file in frontend
- [ ] Start LiveKit container
- [ ] Start backend server
- [ ] Start frontend server
- [ ] Open http://localhost:3000

---

## 🎉 Done!

You should see the landing page with:
- Name input field
- "New meeting" button
- "Join" button with code input

**Ready to create your first video meeting!** 🚀

---

See [README.md](README.md) for complete documentation.

