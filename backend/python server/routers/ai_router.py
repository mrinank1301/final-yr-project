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
    ChatRequest, ChatResponse,
    MeetingEndRequest, MeetingSummaryResponse
)
from services.ai_service import (
    process_message,
    transcribe_audio,
    generate_meeting_summary_with_minutes
)
from services.meeting_service import (
    get_or_create_meeting,
    get_meeting,
    end_meeting,
    add_transcript_to_meeting
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


@router.post("/meeting/end", response_model=MeetingSummaryResponse)
async def end_meeting_and_summarize(request: MeetingEndRequest):
    """
    End a meeting and generate comprehensive summary with minutes
    
    - **room_id**: Room/meeting ID
    - **participant_name**: Name of participant ending the meeting
    """
    try:
        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail="Groq API key not configured")
        
        # Get or create meeting
        meeting = get_or_create_meeting(request.room_id, request.participant_name)
        
        # End the meeting
        meeting.end_meeting()
        
        # Get full transcript
        transcript = meeting.get_full_transcript()
        
        if not transcript or len(transcript.strip()) < 10:
            return {
                "success": True,
                "message": "Meeting ended. No transcript available for summary.",
                "room_id": request.room_id,
                "meeting_data": meeting.to_dict(),
                "summary": "No transcript was recorded during this meeting.",
                "minutes": {
                    "meeting_date": meeting.start_time.strftime("%Y-%m-%d"),
                    "duration": meeting.format_duration(),
                    "participants": meeting.participants,
                    "summary": "No transcript available.",
                    "key_points": [],
                    "action_items": [],
                    "decisions": [],
                    "topics_discussed": []
                },
                "key_points": [],
                "action_items": [],
                "decisions": [],
                "topics_discussed": []
            }
        
        # Generate comprehensive summary with minutes
        summary_data = await generate_meeting_summary_with_minutes(
            transcript=transcript,
            participants=meeting.participants,
            duration=meeting.format_duration()
        )
        
        # Store summary in meeting
        meeting.summary = summary_data.get("summary", "")
        meeting.minutes = summary_data.get("minutes", {})
        
        return {
            "success": True,
            "message": "Meeting ended and summary generated successfully",
            "room_id": request.room_id,
            "meeting_data": meeting.to_dict(),
            "summary": summary_data.get("summary", ""),
            "minutes": summary_data.get("minutes", {}),
            "key_points": summary_data.get("key_points", []),
            "action_items": summary_data.get("action_items", []),
            "decisions": summary_data.get("decisions", []),
            "topics_discussed": summary_data.get("topics_discussed", [])
        }
        
    except Exception as e:
        print(f"[Meeting End] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Error ending meeting: {str(e)}")


@router.get("/meeting/{room_id}")
async def get_meeting_data(room_id: str):
    """Get meeting data by room ID"""
    try:
        meeting = get_meeting(room_id)
        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")
        
        return {
            "success": True,
            "meeting_data": meeting.to_dict(),
            "transcript": meeting.get_full_transcript()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
