# LiveKit Python Server (FastAPI)

FastAPI backend for AI features in video calling application.

## Setup

```bash
# Create virtual environment
python -m venv venv

# Activate
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

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

## Run

```bash
python app.py
```

Or with uvicorn:
```bash
uvicorn app:app --reload --port 5000
```

## API Documentation

- **Swagger UI**: http://localhost:5000/docs
- **ReDoc**: http://localhost:5000/redoc

## API Endpoints (Placeholders for AI)

**GET /health** - Health check

**POST /api/transcribe** - Real-time transcription (to be implemented)
```json
{
  "audio": "base64_encoded_audio",
  "language": "en"
}
```

**POST /api/analyze-sentiment** - Sentiment analysis (to be implemented)
```json
{
  "text": "Meeting transcript"
}
```

**POST /api/generate-summary** - Meeting summary (to be implemented)
```json
{
  "transcript": "Full meeting transcript",
  "max_length": 200
}
```

## Future AI Features

- Whisper for real-time transcription
- Transformers for sentiment analysis
- LLM for meeting summaries
- Background noise cancellation
- Virtual backgrounds

---

See main [README.md](../../README.md) for complete setup.
