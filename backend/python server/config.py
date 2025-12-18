"""
Configuration module for the Video Calling AI Server
"""
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

# Server Configuration
PORT = int(os.getenv('PORT', 5000))

# LiveKit Configuration
LIVEKIT_API_KEY = os.getenv('LIVEKIT_API_KEY')
LIVEKIT_API_SECRET = os.getenv('LIVEKIT_API_SECRET')
LIVEKIT_URL = os.getenv('LIVEKIT_URL')

# Gemini AI Configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

# Configure Gemini if API key is available
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Available Gemini models (in order of preference)
GEMINI_MODELS = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b", 
    "gemini-2.0-flash-lite",
    "gemini-pro"
]

# AI System Instruction
AI_SYSTEM_INSTRUCTION = """You are an AI meeting assistant integrated into a video conferencing application. 
Your role is to:
- Help summarize discussions
- Answer questions about the meeting content
- Provide helpful suggestions and insights
- Translate content if needed
- Keep responses concise and helpful
Be conversational, friendly, and professional."""
