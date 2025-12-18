"""
AI Router - Handles AI-related HTTP endpoints
"""
import base64
from fastapi import APIRouter, HTTPException

from config import GEMINI_API_KEY
from models import (
    TranscribeRequest, TranscribeResponse,
    SentimentRequest, SentimentResponse,
    SummaryRequest, SummaryResponse,
    ChatRequest, ChatResponse
)
from services.ai_service import (
    get_gemini_model,
    process_text_with_gemini,
    transcribe_audio_with_gemini
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
        if not GEMINI_API_KEY:
            raise HTTPException(status_code=500, detail="Gemini API key not configured")
        
        full_message = request.message
        if request.context:
            full_message = f"Meeting context: {request.context}\n\nUser question: {request.message}"
        
        response = await process_text_with_gemini(full_message)
        
        return {
            "response": response,
            "success": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(request: TranscribeRequest):
    """
    Endpoint for real-time transcription
    
    - **audio**: Base64 encoded audio data
    - **language**: Language code (default: en)
    """
    try:
        if not GEMINI_API_KEY:
            raise HTTPException(status_code=500, detail="Gemini API key not configured")
        
        audio_data = base64.b64decode(request.audio)
        transcription = await transcribe_audio_with_gemini(audio_data)
        
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
        if not GEMINI_API_KEY:
            raise HTTPException(status_code=500, detail="Gemini API key not configured")
        
        model = get_gemini_model()
        response = model.generate_content(
            f"Analyze the sentiment of this text and respond with ONLY one word (positive/negative/neutral) and a confidence score from 0 to 1. Format: sentiment,score\n\nText: {request.text}"
        )
        
        result = response.text.strip().lower().split(",")
        sentiment = result[0] if len(result) > 0 else "neutral"
        score = float(result[1]) if len(result) > 1 else 0.5
        
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
        if not GEMINI_API_KEY:
            raise HTTPException(status_code=500, detail="Gemini API key not configured")
        
        model = get_gemini_model()
        response = model.generate_content(
            f"Summarize this meeting transcript in about {request.max_length} words. Include key points, decisions made, and action items:\n\n{request.transcript}"
        )
        
        return {
            "message": "Summary generated successfully",
            "transcript_length": len(request.transcript),
            "summary": response.text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
