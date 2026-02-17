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
