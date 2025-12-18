"""
Pydantic models for request and response validation
"""
from pydantic import BaseModel


# ==================== Request Models ====================

class TranscribeRequest(BaseModel):
    """Request model for audio transcription"""
    audio: str
    language: str = "en"


class SentimentRequest(BaseModel):
    """Request model for sentiment analysis"""
    text: str


class SummaryRequest(BaseModel):
    """Request model for meeting summary generation"""
    transcript: str
    max_length: int = 200


class ChatRequest(BaseModel):
    """Request model for AI chat"""
    message: str
    context: str = ""


class CodeExecutionRequest(BaseModel):
    """Request model for code execution"""
    code: str
    language: str = "python"
    stdin: str = ""


# ==================== Response Models ====================

class HealthResponse(BaseModel):
    """Response model for health check"""
    status: str
    message: str


class TranscribeResponse(BaseModel):
    """Response model for transcription"""
    message: str
    data: dict = {}


class SentimentResponse(BaseModel):
    """Response model for sentiment analysis"""
    message: str
    text: str
    sentiment: str = "neutral"
    score: float = 0.0


class SummaryResponse(BaseModel):
    """Response model for meeting summary"""
    message: str
    transcript_length: int
    summary: str = ""


class ChatResponse(BaseModel):
    """Response model for AI chat"""
    response: str
    success: bool


class CodeExecutionResponse(BaseModel):
    """Response model for code execution"""
    success: bool
    output: str = ""
    error: str = ""
    execution_time: str = ""
