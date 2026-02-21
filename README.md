# OrbicallAI — Intelligent Video Calling Platform

A full-stack video conferencing application with an AI-powered meeting assistant, real-time collaborative code editor, live translation, and more — built for modern remote collaboration.

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Problem Solution](#problem-solution)
- [Project Description](#project-description)
- [Project Scope](#project-scope)
- [How to Start on Your Local PC](#how-to-start-on-your-local-pc)
- [System Design](#system-design)
- [Architecture — Whole System](#architecture--whole-system)
- [Architecture — AI Assistant](#architecture--ai-assistant)
- [Contribution Guidelines](#contribution-guidelines)

---

## Problem Statement

Remote communication tools like Google Meet and Zoom have become essential, but they lack intelligent, context-aware assistance during meetings. Participants often struggle with:

- **No real-time meeting intelligence** — there is no built-in AI that can listen, understand, and respond to meeting discussions as they happen.
- **Language barriers** — multilingual teams have no native live-translation or text-to-speech support within the call.
- **Disconnected collaboration** — developers need to switch between the video call and external code editors/IDEs to write and run code together, breaking the flow of discussion.
- **Manual note-taking** — generating meeting summaries, action items, and minutes is a tedious manual process done after the meeting ends.
- **No interview/assessment tooling** — conducting technical interviews or online coding assessments requires stitching together multiple third-party tools.

There is a clear need for a unified video calling platform that combines high-quality communication with real-time AI assistance, live translation, and integrated collaborative development tools.

---

## Problem Solution

We built **MeetAI**, a single platform that addresses every gap listed above:

| Problem | Our Solution |
|---------|-------------|
| No real-time meeting intelligence | An **AI Assistant** powered by OpenAI Realtime API that listens to the meeting audio stream, transcribes in real-time, and answers questions on-the-fly. |
| Language barriers | **Live Translation** supporting 20+ languages — meeting audio is transcribed (Groq Whisper), translated (Groq LLM), and spoken back using high-quality **Azure Neural TTS** voices. |
| Disconnected collaboration | A built-in **Collaborative Code Editor** (CodeMirror 6 + Yjs CRDT) with real-time multi-cursor editing, syntax highlighting, and integrated code execution for Python, JavaScript, C++, and Java. |
| Manual note-taking | One-click **Meeting Summaries** that extract key points, decisions, and action items automatically using LLM-powered analysis. |
| No interview/assessment tooling | Dedicated **Enterprise modules** — interview rooms with AI-assisted evaluation and online assessment pages with CodePair support. |

---

## Project Description

Orbicall is a modern, microservices-based video calling application inspired by Google Meet's clean UI, enhanced with AI-powered features. The platform is composed of four core services:

1. **Frontend** — A Next.js 16 / React 19 application with Tailwind CSS, providing the landing page, video room UI, AI assistant sidebar, code editor panel, and enterprise pages.
2. **Node.js Backend** — A lightweight Express server responsible for LiveKit token generation and room management.
3. **Python Backend** — A FastAPI server hosting all AI capabilities — chat (Groq LLM), transcription (Groq Whisper), real-time audio AI (OpenAI Realtime API), live translation (Azure TTS), code execution sandboxing, and Yjs-based collaborative editing sync.
4. **LiveKit Server** — An open-source WebRTC SFU running in Docker, handling multi-participant video/audio streams and screen sharing.

### Key Features

- High-quality multi-participant video and audio calls
- Screen sharing
- Real-time AI assistant that listens and responds to meeting discussions
- Text-based AI chat with streaming responses
- Live transcription of meeting audio
- Live translation with text-to-speech in 20+ languages
- Collaborative code editor with real-time multi-cursor sync
- Sandboxed code execution (Python, JavaScript, C++, Java)
- Automated meeting summaries and sentiment analysis
- Enterprise interview and online assessment modules

### Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion, GSAP |
| Video/Audio | LiveKit Client SDK, LiveKit Components React |
| Code Editor | CodeMirror 6, Yjs, y-websocket, y-codemirror.next |
| Node.js Backend | Express, TypeScript, LiveKit Server SDK |
| Python Backend | FastAPI, Uvicorn, Pydantic |
| AI Services | Groq API (LLM + Whisper), OpenAI Realtime API, Azure Cognitive Services (TTS) |
| Infrastructure | Docker, Docker Compose, Nginx, Certbot (SSL) |

---

## Project Scope

### In Scope

- Real-time video and audio conferencing for up to 50 participants
- AI meeting assistant with real-time audio understanding and text chat
- Live transcription and multilingual translation (20+ languages)
- Collaborative code editor with real-time sync and code execution
- Meeting summaries, key-point extraction, and sentiment analysis
- Enterprise features: interview rooms and online assessments
- Local development setup with one-command startup scripts
- Production deployment via Docker Compose with SSL

### Out of Scope (Future Work)

- Persistent user accounts and authentication (currently stateless)
- Database-backed meeting history and recording storage
- End-to-end encryption for media streams
- Mobile native applications (iOS/Android)
- Calendar integration and meeting scheduling
- Breakout rooms and polling/Q&A features

---

## How to Start on Your Local PC

### Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- **Docker Desktop** (running)
- API keys for: **Groq**, **OpenAI**, and **Azure Speech Services**

### Quick Start (One Command)

**Windows — double-click:**
```
START.bat
```

**Windows — PowerShell:**
```powershell
.\start-all.ps1
```

**First-time setup (installs all dependencies):**
```powershell
.\start-all.ps1 -Install
```

**Linux / macOS:**
```bash
chmod +x start-dev.sh
./start-dev.sh
```

This starts all four services automatically:

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Node.js Backend | 3001 | http://localhost:3001 |
| Python Backend | 5000 | http://localhost:5000/docs |
| LiveKit Server | 7880 | ws://localhost:7880 |

### Manual Setup

**1. Create environment files**

`backend/node server/.env`
```env
PORT=3001
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://localhost:7880
```

`backend/python server/.env`
```env
PORT=5000
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://localhost:7880
GROQ_API_KEY=your_groq_api_key
OPENAI_API_KEY=your_openai_api_key
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=eastasia
```

`frontend/project/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_PYTHON_API_URL=http://localhost:5000
```

**2. Install dependencies**

```bash
# Node.js backend
cd "backend/node server"
npm install

# Python backend
cd "backend/python server"
pip install -r requirements.txt

# Frontend
cd frontend/project
npm install
```

**3. Start each service in a separate terminal**

```bash
# Terminal 1 — LiveKit
docker run -d --name livekit \
  -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  -e LIVEKIT_KEYS="devkey: secret" \
  livekit/livekit-server

# Terminal 2 — Node.js Backend
cd "backend/node server" && npm run dev

# Terminal 3 — Python Backend
cd "backend/python server" && python app.py

# Terminal 4 — Frontend
cd frontend/project && npm run dev
```

**4. Open http://localhost:3000 in your browser**

---

## System Design

The application follows a **microservices architecture** with four independent services communicating over HTTP, WebSocket, and WebRTC protocols.

### Services and Responsibilities

| Service | Technology | Responsibility |
|---------|-----------|---------------|
| **Frontend** | Next.js 16 / React 19 | UI rendering, LiveKit client, user interactions |
| **Node.js Backend** | Express / TypeScript | LiveKit token generation, room management |
| **Python Backend** | FastAPI / Uvicorn | AI chat, transcription, translation, code execution, collaborative editing sync |
| **LiveKit Server** | LiveKit (Docker) | WebRTC SFU — video/audio routing, screen sharing |

### Communication Patterns

- **Browser ↔ Frontend** — HTTP (page loads, SSR)
- **Frontend → Node.js Backend** — REST API (token requests)
- **Browser ↔ LiveKit** — WebRTC (bidirectional video/audio/data)
- **Browser ↔ Python Backend** — WebSocket (AI chat streaming, Yjs document sync, real-time audio) + REST (code execution, summaries)
- **Python Backend → External AI APIs** — HTTPS (Groq, OpenAI, Azure)

### Data Flow Examples

**Joining a meeting:**
```
Browser → Frontend (enter name/room) → Node.js Backend (POST /api/token)
→ LiveKit Server (room created) → Browser connects via WebRTC
```

**AI Assistant responding to a question during a meeting:**
```
Browser captures meeting audio (PCM16 24kHz)
→ Python Backend WebSocket (/ws/ai-chat/{id})
→ OpenAI Realtime API (VAD + STT + LLM)
→ Streaming response back to Browser
```

**Live Translation:**
```
Meeting audio → Python Backend → Groq Whisper (transcribe)
→ Groq LLM (translate to target language)
→ Azure Neural TTS (generate speech)
→ Audio playback in Browser
```

**Collaborative Code Editing:**
```
Browser (CodeMirror + Yjs) ↔ Python Backend (/ws/yjs/{room})
→ Yjs CRDT updates broadcast to all connected participants
```

### API Endpoints (Python Backend)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/chat` | POST | AI text chat |
| `/api/transcribe` | POST | Audio transcription |
| `/api/analyze-sentiment` | POST | Sentiment analysis |
| `/api/generate-summary` | POST | Meeting summary generation |
| `/api/execute-code` | POST | Sandboxed code execution |
| `/ws/ai-chat/{id}` | WebSocket | Real-time AI chat with audio |
| `/ws/yjs/{room}` | WebSocket | Collaborative editing sync |

Full interactive API docs available at **http://localhost:5000/docs** (Swagger UI).

---

## Architecture — Whole System

![System Architecture](assets/system-architecture.png)

The system is composed of four services. The **Browser** connects to the **Next.js Frontend** for the UI, obtains LiveKit tokens from the **Node.js Backend**, and establishes a WebRTC connection with the **LiveKit Server** for video/audio. AI features, code execution, and collaborative editing all flow through the **Python Backend** via WebSocket and REST, which in turn delegates to **Groq API**, **OpenAI Realtime API**, and **Azure Cognitive Services**.

---

## Architecture — AI Assistant

![AI Assistant Architecture](assets/ai-assistant-architecture.png)

The diagram above shows the exact file-level handshake between components. The AI Assistant is powered entirely by the **OpenAI Realtime API** (`gpt-4o-mini-realtime-preview`). Here is the flow through each file:

### Files Involved

| File | Role |
|------|------|
| `AISidebar.tsx` | Frontend component — captures remote participant audio via Web Audio API, converts to PCM16 24kHz base64, streams over WebSocket, and renders responses |
| `ai_chat.py` | Backend WebSocket handler — routes messages between the frontend and the Realtime service |
| `realtime_service.py` | Backend service — manages the WebSocket connection to OpenAI Realtime API, sends audio, receives events |
| `config.py` | Loads `OPENAI_API_KEY` from environment |
| `app.py` | Registers the `/ws/ai-chat/{client_id}` WebSocket endpoint |

### Step-by-Step Flow

1. **User clicks "Start AI Assistant"** — `AISidebar.tsx` sends `{"type": "start_listening"}` over WebSocket to `ai_chat.py`.
2. **Session creation** — `ai_chat.py` instantiates a `RealtimeService` (from `realtime_service.py`), which loads the API key from `config.py` and opens a WebSocket to `wss://api.openai.com/v1/realtime`. It configures the session with server-side VAD, Whisper transcription, and text-only output.
3. **Audio capture loop (~85 ms)** — `AISidebar.tsx` captures remote participant audio tracks via LiveKit, downsamples to 24 kHz PCM16 mono, base64-encodes, and sends `{"type": "audio_stream", "data": base64_pcm}` to `ai_chat.py`.
4. **Audio relay** — `ai_chat.py` calls `realtime_service.py` → `send_audio()`, which forwards the chunk as `{"type": "input_audio_buffer.append"}` to OpenAI.
5. **OpenAI processes** — the Realtime API runs VAD (voice activity detection), transcribes with Whisper, and generates a response with GPT-4o-mini.
6. **Response streaming** — OpenAI sends events (`speech_started`, `transcription.completed`, `response.text.delta`, `response.done`) back to `realtime_service.py`, which normalizes them into `heard`, `stream_token`, and `stream_end` events via the `on_event` callback to `ai_chat.py`, which forwards them over WebSocket to `AISidebar.tsx`.
7. **UI update** — `AISidebar.tsx` renders the transcription ("Heard: ...") and the streaming AI response token-by-token in the chat panel.

---

## Contribution Guidelines

We welcome contributions! Please follow these guidelines to keep the codebase clean and the collaboration smooth.

### Getting Started

1. **Fork** the repository and clone your fork locally.
2. Create a new branch from `main` for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Set up the local development environment following the [How to Start](#how-to-start-on-your-local-pc) section above.

### Development Workflow

1. Make your changes in a focused, single-purpose branch.
2. Write clear, descriptive commit messages:
   ```
   feat: add dark mode toggle to settings page
   fix: resolve WebSocket reconnection failure on network change
   docs: update API endpoint documentation
   ```
3. Test your changes locally — ensure all four services start and your feature works end-to-end.
4. Push your branch and open a **Pull Request** against `main`.

### Code Style

- **Frontend** — follow existing TypeScript/React conventions; use functional components and hooks.
- **Python Backend** — follow PEP 8; use type hints; define request/response models with Pydantic.
- **Node.js Backend** — follow existing TypeScript conventions.
- Keep files focused — avoid mixing unrelated changes in a single commit.

### Pull Request Process

1. Give your PR a clear title and description explaining **what** changed and **why**.
2. Reference any related issues (e.g., `Closes #42`).
3. Ensure no new linter warnings or errors are introduced.
4. At least one maintainer review is required before merging.

### Reporting Issues

- Use GitHub Issues to report bugs or request features.
- Include steps to reproduce, expected behavior, and actual behavior.
- Attach screenshots or logs when relevant.

### Code of Conduct

- Be respectful and constructive in all interactions.
- Focus on the technical merits of contributions.
- Help newcomers get started — everyone was a beginner once.

---

<p align="center">
  Built with Next.js, FastAPI, LiveKit, and a lot of AI magic.
</p>
