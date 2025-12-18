# Python AI Backend

FastAPI server providing AI-powered features for the video calling application.

## 📁 Module Structure

```
python server/
├── app.py                    # Main entry point (~100 lines)
├── config.py                 # Configuration & environment variables
├── models.py                 # Pydantic request/response models
├── requirements.txt          # Dependencies
│
├── services/                 # Business logic layer
│   ├── __init__.py
│   ├── ai_service.py         # Gemini AI integration
│   └── code_execution.py     # Sandboxed code execution
│
├── routers/                  # HTTP API routes
│   ├── __init__.py
│   ├── ai_router.py          # AI endpoints (/api/chat, /api/transcribe, etc.)
│   └── code_router.py        # Code execution (/api/execute-code)
│
└── websockets/               # WebSocket handlers
    ├── __init__.py
    ├── ai_chat.py            # Real-time AI chat (/ws/ai-chat/{client_id})
    └── collaborative.py      # Yjs document sync (/ws/yjs/{room_id})
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

Create `.env` file:
```env
PORT=5000
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://localhost:7880
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Run Server

```bash
python app.py
```

Server runs at: **http://localhost:5000**

## 📚 API Documentation

- **Swagger UI**: http://localhost:5000/docs
- **ReDoc**: http://localhost:5000/redoc

## 🔌 Endpoints

### HTTP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API info |
| `/health` | GET | Health check |
| `/api/chat` | POST | AI chat response |
| `/api/transcribe` | POST | Audio transcription |
| `/api/analyze-sentiment` | POST | Sentiment analysis |
| `/api/generate-summary` | POST | Meeting summary |
| `/api/execute-code` | POST | Code execution |

### WebSocket Endpoints

| Endpoint | Description |
|----------|-------------|
| `/ws/ai-chat/{client_id}` | Real-time AI chat with audio support |
| `/ws/yjs/{room_id}` | Yjs document synchronization |

## 🤖 AI Features

Powered by Google Gemini AI:

- **Chat**: Natural conversation with meeting context
- **Transcription**: Audio to text conversion
- **Sentiment Analysis**: Meeting mood detection
- **Summary Generation**: Meeting highlights
- **Question Detection**: Auto-answer meeting questions

## 💻 Code Execution

Supports multiple languages in sandboxed environment:

- Python
- JavaScript (Node.js)
- C++ (g++)
- Java (JDK)

**Example Request:**
```json
POST /api/execute-code
{
  "code": "print('Hello, World!')",
  "language": "python",
  "stdin": ""
}
```

## 🔄 Collaborative Editing

Real-time document sync using Yjs:

- Multiple cursors with user names
- CRDT-based conflict resolution
- WebSocket-based communication
- Room-based document isolation

## 📦 Dependencies

- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `pydantic` - Data validation
- `google-generativeai` - Gemini AI SDK
- `wsproto` - WebSocket protocol
- `python-dotenv` - Environment management

## 🧪 Testing

```bash
# Health check
curl http://localhost:5000/health

# AI Chat
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "context": ""}'

# Execute code
curl -X POST http://localhost:5000/api/execute-code \
  -H "Content-Type: application/json" \
  -d '{"code": "print(1+1)", "language": "python"}'
```

## 📝 Module Details

### `config.py`
- Loads environment variables
- Configures Gemini AI
- Defines available AI models
- Sets system instructions

### `models.py`
- Request/response Pydantic models
- Type validation
- API documentation schemas

### `services/ai_service.py`
- `get_gemini_model()` - Model initialization
- `is_question()` - Question detection
- `process_text_with_gemini()` - Text processing with retry
- `transcribe_audio_with_gemini()` - Audio transcription

### `services/code_execution.py`
- `execute_code_in_sandbox()` - Main execution function
- Language-specific executors (Python, JS, C++, Java)
- Timeout and error handling

### `routers/ai_router.py`
- `/api/chat` - Chat endpoint
- `/api/transcribe` - Transcription
- `/api/analyze-sentiment` - Sentiment
- `/api/generate-summary` - Summaries

### `routers/code_router.py`
- `/api/execute-code` - Code execution

### `websockets/ai_chat.py`
- Real-time AI chat
- Audio message handling
- Meeting transcription
- Auto-question answering

### `websockets/collaborative.py`
- Yjs document sync
- Room management
- State persistence
- Broadcasting updates

## 🔐 Security

- Code execution in isolated temp directories
- Automatic cleanup after execution
- Execution timeouts (10 seconds)
- No file system access from executed code
