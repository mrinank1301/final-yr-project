"""
AI Router - Handles AI-related HTTP endpoints (now using Groq)
"""
import base64
from fastapi import APIRouter, HTTPException

from config import GROQ_API_KEY
from models import (
    TranscribeRequest, TranscribeResponse,
    SentimentRequest, SentimentResponse,
    SummaryRequest, SummaryResponse,
    ChatRequest, ChatResponse
)
from services.ai_service import (
    process_message,
    transcribe_audio
)

router = APIRouter(prefix="/api", tags=["AI"])


@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(request: ChatRequest):
    """
    Chat endpoint for AI assistant
    
    - **message**: User's message
    - **context**: Optional meeting context
    """
    try:
        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail="Groq API key not configured")
        
        full_message = request.message
        if request.context:
            full_message = f"Meeting context: {request.context}\n\nUser question: {request.message}"
        
        response = await process_message(full_message)
        
        return {
            "response": response,
            "success": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio_endpoint(request: TranscribeRequest):
    """
    Endpoint for real-time transcription using Groq Whisper
    
    - **audio**: Base64 encoded audio data
    - **language**: Language code (default: en)
    """
    try:
        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail="Groq API key not configured")
        
        audio_data = base64.b64decode(request.audio)
        transcription = await transcribe_audio(audio_data)
        
        return {
            "message": "Transcription successful",
            "data": {
                "language": request.language,
                "transcription": transcription
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-sentiment", response_model=SentimentResponse)
async def analyze_sentiment(request: SentimentRequest):
    """
    Endpoint for sentiment analysis during meetings
    
    - **text**: Text to analyze for sentiment
    """
    try:
        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail="Groq API key not configured")
        
        prompt = f"Analyze the sentiment of this text and respond with ONLY one word (positive/negative/neutral) and a confidence score from 0 to 1. Format: sentiment,score\n\nText: {request.text}"
        response = await process_message(prompt)
        
        result = response.strip().lower().split(",")
        sentiment = result[0] if len(result) > 0 else "neutral"
        try:
            score = float(result[1]) if len(result) > 1 else 0.5
        except:
            score = 0.5
        
        return {
            "message": "Sentiment analysis completed",
            "text": request.text,
            "sentiment": sentiment,
            "score": score
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-summary", response_model=SummaryResponse)
async def generate_summary(request: SummaryRequest):
    """
    Endpoint for generating meeting summaries
    
    - **transcript**: Full meeting transcript
    - **max_length**: Maximum length of summary (default: 200)
    """
    try:
        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail="Groq API key not configured")
        
        prompt = f"Summarize this meeting transcript in about {request.max_length} words. Include key points, decisions made, and action items:\n\n{request.transcript}"
        response = await process_message(prompt)
        
        return {
            "message": "Summary generated successfully",
            "transcript_length": len(request.transcript),
            "summary": response
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
