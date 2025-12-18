"""
AI Service - Gemini AI integration for chat, transcription, and analysis
"""
import asyncio
from typing import List, Optional
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions

from config import GEMINI_MODELS, AI_SYSTEM_INSTRUCTION


def get_gemini_model(model_name: str = None):
    """
    Get a Gemini model instance for chat
    
    Args:
        model_name: Optional specific model name, defaults to first in GEMINI_MODELS
    
    Returns:
        GenerativeModel instance
    """
    model = model_name or GEMINI_MODELS[0]
    return genai.GenerativeModel(
        model_name=model,
        system_instruction=AI_SYSTEM_INSTRUCTION
    )


def is_question(text: str) -> bool:
    """
    Detect if the text contains a question
    
    Args:
        text: Text to analyze
    
    Returns:
        True if text appears to be a question
    """
    question_words = [
        'what', 'why', 'how', 'when', 'where', 'who', 'which', 'whose', 'whom',
        'can', 'could', 'would', 'should', 'is', 'are', 'do', 'does', 'did',
        'will', 'have', 'has', 'may', 'might', 'shall'
    ]
    
    text_lower = text.lower().strip()
    
    # Check for question mark
    if '?' in text:
        return True
    
    # Check if starts with question word
    for word in question_words:
        if text_lower.startswith(word + ' '):
            return True
    
    # Check for common question phrases
    question_phrases = [
        'tell me', 'explain', 'describe', 'clarify', 'help me understand',
        'what do you think', 'any thoughts', 'any ideas', 'anyone know'
    ]
    for phrase in question_phrases:
        if phrase in text_lower:
            return True
    
    return False


async def process_text_with_gemini(
    message: str,
    chat_history: Optional[List[dict]] = None,
    meeting_context: Optional[List[str]] = None,
    max_retries: int = 3
) -> str:
    """
    Process text message with Gemini AI with retry logic
    
    Args:
        message: User message to process
        chat_history: Previous chat messages for context
        meeting_context: Recent meeting transcriptions for context
        max_retries: Number of retry attempts per model
    
    Returns:
        AI response text
    """
    last_error = None
    
    # Build context from meeting if available
    context_prompt = ""
    if meeting_context and len(meeting_context) > 0:
        recent_context = meeting_context[-20:]  # Last 20 transcriptions
        context_prompt = f"\n\nRecent meeting conversation for context:\n" + "\n".join(recent_context) + "\n\n"
    
    full_message = context_prompt + message if context_prompt else message
    
    for model_name in GEMINI_MODELS:
        for attempt in range(max_retries):
            try:
                model = get_gemini_model(model_name)
                
                # Build conversation context
                history = []
                if chat_history:
                    for msg in chat_history[-10:]:  # Keep last 10 messages for context
                        role = "user" if msg["role"] == "user" else "model"
                        history.append({"role": role, "parts": [msg["content"]]})
                
                chat = model.start_chat(history=history)
                response = chat.send_message(full_message)
                
                return response.text
                
            except google_exceptions.ResourceExhausted as e:
                last_error = e
                wait_time = (2 ** attempt) + 1  # Exponential backoff
                print(f"Rate limited on {model_name}, attempt {attempt + 1}/{max_retries}. Waiting {wait_time}s...")
                await asyncio.sleep(wait_time)
                
            except google_exceptions.NotFound as e:
                print(f"Model {model_name} not available, trying next...")
                last_error = e
                break  # Move to next model
                
            except Exception as e:
                last_error = e
                print(f"Error processing with Gemini ({model_name}): {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(1)
    
    # If all retries failed
    error_msg = str(last_error) if last_error else "Unknown error"
    if "quota" in error_msg.lower() or "rate" in error_msg.lower():
        return "⏳ I'm currently at capacity. The free tier has limited requests per minute. Please wait a moment and try again."
    return "I apologize, but I encountered an error. Please try again in a moment."


async def transcribe_audio_with_gemini(audio_data: bytes, max_retries: int = 3) -> str:
    """
    Transcribe audio using Gemini's multimodal capabilities
    
    Args:
        audio_data: Raw audio bytes
        max_retries: Number of retry attempts per model
    
    Returns:
        Transcription text, or empty string if failed
    """
    last_error = None
    
    for model_name in GEMINI_MODELS:
        for attempt in range(max_retries):
            try:
                model = genai.GenerativeModel(model_name)
                
                audio_part = {
                    "mime_type": "audio/webm",
                    "data": audio_data
                }
                
                response = model.generate_content([
                    "Transcribe the following audio. Only output the transcription text, nothing else. If the audio is silent or unclear, respond with [silence]:",
                    audio_part
                ])
                
                result = response.text.strip()
                # Filter out silence markers
                if result.lower() in ['[silence]', 'silence', '[unclear]', '[inaudible]', '']:
                    return ""
                return result
                
            except google_exceptions.ResourceExhausted as e:
                last_error = e
                wait_time = (2 ** attempt) + 1
                print(f"Rate limited on {model_name} for transcription, waiting {wait_time}s...")
                await asyncio.sleep(wait_time)
                
            except google_exceptions.NotFound as e:
                print(f"Model {model_name} not available for transcription, trying next...")
                last_error = e
                break
                
            except Exception as e:
                last_error = e
                print(f"Error transcribing audio with {model_name}: {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(1)
    
    print(f"All transcription attempts failed: {last_error}")
    return ""
