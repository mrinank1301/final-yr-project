"""
Configuration module for the Video Calling AI Server
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Server Configuration
PORT = int(os.getenv('PORT', 5000))

# LiveKit Configuration
LIVEKIT_API_KEY = os.getenv('LIVEKIT_API_KEY')
LIVEKIT_API_SECRET = os.getenv('LIVEKIT_API_SECRET')
LIVEKIT_URL = os.getenv('LIVEKIT_URL')

# Legacy - not used but kept for compatibility
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')

# ==================== Azure Speech Configuration (legacy) ====================
AZURE_SPEECH_KEY = os.getenv('AZURE_SPEECH_KEY', '')
AZURE_SPEECH_REGION = os.getenv('AZURE_SPEECH_REGION', 'eastasia')

# ==================== OpenAI Configuration (Realtime API for AI Assistant) ====================
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')

# ==================== Sarvam AI Configuration (Indian language STT, Translation, TTS) ====================
SARVAM_API_KEY = os.getenv('SARVAM_API_KEY', '')

# Mapping from ISO 639-1 codes (frontend) to Sarvam BCP-47 codes
SARVAM_LANGUAGE_MAP = {
    "hi": "hi-IN", "bn": "bn-IN", "ta": "ta-IN", "te": "te-IN",
    "kn": "kn-IN", "ml": "ml-IN", "mr": "mr-IN", "gu": "gu-IN",
    "pa": "pa-IN", "od": "od-IN", "en": "en-IN", "as": "as-IN",
    "ur": "ur-IN", "ne": "ne-IN", "kok": "kok-IN", "ks": "ks-IN",
    "sd": "sd-IN", "sa": "sa-IN", "sat": "sat-IN", "mni": "mni-IN",
    "brx": "brx-IN", "mai": "mai-IN", "doi": "doi-IN",
}

# Languages supported by Sarvam TTS (Bulbul v3) — subset of translation languages
SARVAM_TTS_LANGUAGES = {
    "hi-IN", "bn-IN", "ta-IN", "te-IN", "kn-IN", "ml-IN",
    "mr-IN", "gu-IN", "pa-IN", "od-IN", "en-IN",
}

# ==================== Groq AI Configuration ====================
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')

# Available Groq models for chat (ultra-fast inference) - Updated Jan 2026
GROQ_MODELS = [
    "llama-3.3-70b-versatile",   # Latest, best quality
    "llama-3.1-70b-versatile",   # Fallback
    "llama-3.1-8b-instant",      # Ultra fast
    "gemma2-9b-it",              # Good alternative
]

# AI System Instruction
AI_SYSTEM_INSTRUCTION = """You are an AI meeting assistant helping during a video call or interview.

YOUR JOB:
- Listen to what the other person says and provide helpful responses
- For interview questions: Give professional, well-structured answers
- For statements: Provide thoughtful responses or follow-up points
- For any speech: Help the user know what to say next

RESPONSE STYLE:
- Be concise but complete (2-4 sentences usually)
- Be professional and confident
- Give actionable responses the user can actually say
- For "introduce yourself": Give a strong professional introduction
- For technical questions: Give clear, accurate answers

Remember: Your responses will be READ by the user to help them respond in real-time. Make them natural and speakable."""
