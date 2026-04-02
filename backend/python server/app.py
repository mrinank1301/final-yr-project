"""
Video Calling AI Server - Main Application
==========================================

A FastAPI server providing AI-powered features for video calling applications:
- AI Chat with Gemini
- Audio Transcription
- Meeting Listening & Question Detection
- Sentiment Analysis
- Meeting Summaries
- Collaborative Code Editing
- Code Execution

Author: Video Calling AI Team
Version: 1.0.0
"""

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Import configuration
from config import PORT, LIVEKIT_URL, GEMINI_API_KEY, AZURE_SPEECH_KEY, GROQ_API_KEY

# Import models for health check
from models import HealthResponse

# Import routers
from routers import ai_router, code_router

# Import WebSocket handlers
from websockets import websocket_ai_chat, websocket_yjs_sync, websocket_meeting_transcript


# ==================== App Initialization ====================

app = FastAPI(
    title="Video Calling AI Server",
    description="FastAPI server for AI-powered features in video calling application",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== Include Routers ====================

app.include_router(ai_router)
app.include_router(code_router)


# ==================== WebSocket Endpoints ====================

@app.websocket("/ws/ai-chat/{client_id}")
async def ai_chat_websocket(websocket: WebSocket, client_id: str):
    """
    WebSocket endpoint for real-time AI chat with audio support
    
    Message types:
    - text: {"type": "text", "content": "user message"}
    - audio: {"type": "audio", "data": "base64_encoded_audio"}
    - meeting_audio: {"type": "meeting_audio", "data": "base64_encoded_audio"}
    - start_listening: {"type": "start_listening"}
    - stop_listening: {"type": "stop_listening"}
    - clear: {"type": "clear"} - Clear chat history
    """
    await websocket_ai_chat(websocket, client_id)


@app.websocket("/ws/meeting-transcript/{room_id}")
async def meeting_transcript_websocket(websocket: WebSocket, room_id: str):
    """
    Always-on background transcription for meeting summarization.
    Receives audio chunks, transcribes via Sarvam STT, stores in meeting_storage.
    """
    await websocket_meeting_transcript(websocket, room_id)


@app.websocket("/ws/yjs/{room_id}")
async def yjs_sync_websocket(websocket: WebSocket, room_id: str):
    """
    WebSocket endpoint for Yjs document synchronization (Collaborative Code Editor)
    
    This is a broadcast server that relays Yjs sync messages between clients.
    Supports: sync-step-1, sync-step-2, update, awareness messages
    """
    await websocket_yjs_sync(websocket, room_id)


# ==================== HTTP Endpoints ====================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "message": "Python AI server is running"
    }


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "name": "Video Calling AI Server",
        "version": "2.0.0",
        "framework": "FastAPI",
        "features": [
            "Azure Speech-to-Text (Accurate STT)",
            "Groq AI (Ultra-fast LLM)",
            "Gemini AI Chat (Fallback)",
            "Meeting Listening & Auto-Answer",
            "Question Detection",
            "Interview Assistance",
            "Collaborative Code Editor",
            "Code Execution"
        ],
        "services": {
            "azure_stt": "Configured" if AZURE_SPEECH_KEY else "Not configured",
            "groq_ai": "Configured" if GROQ_API_KEY else "Not configured",
            "gemini_ai": "Configured" if GEMINI_API_KEY else "Not configured"
        },
        "docs": "/docs",
        "redoc": "/redoc"
    }


# ==================== Main Entry Point ====================

if __name__ == "__main__":
    print("=" * 60)
    print("Video Calling AI Server v2.0")
    print("Azure STT + Groq AI for Ultra-Fast Responses")
    print("=" * 60)
    print(f"Server URL: http://localhost:{PORT}")
    print(f"LiveKit URL: {LIVEKIT_URL or 'Not configured'}")
    print("-" * 60)
    print("AI Services Status:")
    print(f"  Azure STT: {'[OK] Configured' if AZURE_SPEECH_KEY else '[X] Not configured'}")
    print(f"  Groq AI:   {'[OK] Configured' if GROQ_API_KEY else '[X] Not configured - set GROQ_API_KEY'}")
    print(f"  Gemini AI: {'[OK] Configured (fallback)' if GEMINI_API_KEY else '[!] Not configured'}")
    print("-" * 60)
    print(f"API Docs: http://localhost:{PORT}/docs")
    print(f"ReDoc: http://localhost:{PORT}/redoc")
    print("=" * 60)
    
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=PORT,
        reload=True,
        log_level="info",
        ws="wsproto"  # Use wsproto instead of websockets for compatibility
    )
