"""
AI Service - Groq Whisper for transcription + Groq LLM for ultra-fast meeting assistance
"""
import asyncio
import tempfile
import os
from typing import List, Optional
from groq import Groq

from config import (
    GROQ_API_KEY,
    GROQ_MODELS,
    AI_SYSTEM_INSTRUCTION
)

# Initialize Groq client
groq_client = None
if GROQ_API_KEY:
    groq_client = Groq(api_key=GROQ_API_KEY)
    print("[AI Service] Groq client initialized - Ready for transcription and chat!")
else:
    print("[AI Service] ERROR: Groq API key not set! Please set GROQ_API_KEY in .env")


def is_question(text: str) -> bool:
    """Detect if the text contains a question or requires a response"""
    question_words = [
        'what', 'why', 'how', 'when', 'where', 'who', 'which', 'whose', 'whom',
        'can', 'could', 'would', 'should', 'is', 'are', 'do', 'does', 'did',
        'will', 'have', 'has', 'may', 'might', 'shall', 'tell', 'explain',
        'describe', 'give', 'please', 'let'
    ]
    
    # Common phrases that need responses
    response_triggers = [
        'introduce yourself', 'tell me about', 'tell us about',
        'describe yourself', 'your background', 'your experience',
        'explain', 'describe', 'clarify', 'help me understand',
        'what do you think', 'any thoughts', 'any ideas', 'anyone know',
        'tell me', 'share', 'walk me through', 'walk us through',
        'give me', 'provide', 'elaborate', 'your strengths', 'your weaknesses',
        'why should we', 'why do you', 'where do you see yourself',
        'your greatest', 'biggest challenge', 'salary expectations',
        'questions for us', 'questions for me', 'about yourself',
        'your skills', 'your projects', 'worked on', 'experience with',
        'familiar with', 'know about', 'heard of', 'thoughts on'
    ]
    
    text_lower = text.lower().strip()
    
    if '?' in text:
        return True
    
    for word in question_words:
        if text_lower.startswith(word + ' '):
            return True
    
    for phrase in response_triggers:
        if phrase in text_lower:
            return True
    
    return False


async def transcribe_with_groq_whisper(audio_data: bytes) -> str:
    """
    Transcribe audio using Groq's Whisper API - Fast and accurate!
    Supports WebM, MP3, WAV, and other formats directly.
    """
    if not groq_client:
        print("[Whisper] ERROR: No Groq client available")
        return ""
    
    try:
        # Save audio to temp file (Groq Whisper needs a file)
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as temp_file:
            temp_file.write(audio_data)
            temp_path = temp_file.name
        
        try:
            print(f"[Whisper] Transcribing {len(audio_data)} bytes...")
            
            # Use Groq's Whisper API
            loop = asyncio.get_event_loop()
            
            with open(temp_path, "rb") as audio_file:
                transcription = await loop.run_in_executor(
                    None,
                    lambda: groq_client.audio.transcriptions.create(
                        model="whisper-large-v3",
                        file=audio_file,
                        language="en",
                        response_format="text"
                    )
                )
            
            result = transcription.strip() if isinstance(transcription, str) else str(transcription).strip()
            
            # Filter out empty or noise-only transcriptions
            if result and len(result) > 2 and result.lower() not in ['', '.', '...', 'you', 'yeah', 'uh', 'um']:
                print(f"[Whisper] SUCCESS: {result}")
                return result
            else:
                print(f"[Whisper] No meaningful speech detected")
                return ""
                
        finally:
            # Clean up temp file
            try:
                os.unlink(temp_path)
            except:
                pass
                
    except Exception as e:
        print(f"[Whisper] Error: {e}")
        return ""


async def process_with_groq(
    message: str,
    chat_history: Optional[List[dict]] = None,
    meeting_context: Optional[List[str]] = None
) -> str:
    """Process text message with Groq AI for ultra-fast responses"""
    if not groq_client:
        print("[Groq LLM] ERROR: No client available")
        return "AI service not configured. Please set GROQ_API_KEY."
    
    try:
        # Build messages for Groq
        messages = [
            {"role": "system", "content": AI_SYSTEM_INSTRUCTION}
        ]
        
        # Add meeting context if available
        if meeting_context and len(meeting_context) > 0:
            recent_context = meeting_context[-10:]
            context_text = "\n".join(recent_context)
            messages.append({
                "role": "system",
                "content": f"Recent conversation:\n{context_text}"
            })
        
        # Add chat history
        if chat_history:
            for msg in chat_history[-6:]:
                role = "user" if msg["role"] == "user" else "assistant"
                messages.append({"role": role, "content": msg["content"]})
        
        # Add current message
        messages.append({"role": "user", "content": message})
        
        # Try each model
        loop = asyncio.get_event_loop()
        
        for model in GROQ_MODELS:
            try:
                print(f"[Groq LLM] Using model: {model}")
                response = await loop.run_in_executor(
                    None,
                    lambda m=model: groq_client.chat.completions.create(
                        model=m,
                        messages=messages,
                        temperature=0.7,
                        max_tokens=512,
                    )
                )
                
                result = response.choices[0].message.content
                print(f"[Groq LLM] Response generated successfully")
                return result
                
            except Exception as e:
                error_msg = str(e)
                print(f"[Groq LLM] Error with {model}: {error_msg}")
                # If model not found, try next
                if "not found" in error_msg.lower() or "does not exist" in error_msg.lower():
                    continue
                # If rate limited, wait and retry
                if "rate" in error_msg.lower():
                    await asyncio.sleep(1)
                    continue
                continue
        
        return "I'm having trouble responding right now. Please try again."
        
    except Exception as e:
        print(f"[Groq LLM] Exception: {e}")
        return "Sorry, I encountered an error. Please try again."


# ==================== Translation Function ====================

async def translate_text(
    text: str,
    target_language: str,
    source_language: str = "auto"
) -> str:
    """Translate text to target language using Groq LLM"""
    if not groq_client:
        print("[Translation] ERROR: No Groq client available")
        return text  # Return original if no client
    
    if not text or len(text.strip()) < 2:
        return ""
    
    try:
        # Language name mapping for better prompts
        language_names = {
            "en": "English", "es": "Spanish", "fr": "French", "de": "German",
            "it": "Italian", "pt": "Portuguese", "ru": "Russian", "zh": "Chinese",
            "ja": "Japanese", "ko": "Korean", "ar": "Arabic", "hi": "Hindi",
            "te": "Telugu", "ta": "Tamil", "bn": "Bengali", "nl": "Dutch",
            "pl": "Polish", "tr": "Turkish", "vi": "Vietnamese", "th": "Thai"
        }
        
        target_name = language_names.get(target_language, target_language)
        
        prompt = f"""Translate the following text to {target_name}. 
Only provide the translation, nothing else. Keep the same tone and meaning.

Text to translate: "{text}"

Translation:"""
        
        messages = [
            {"role": "system", "content": f"You are a professional translator. Translate accurately to {target_name}. Only output the translation, no explanations."},
            {"role": "user", "content": prompt}
        ]
        
        loop = asyncio.get_event_loop()
        
        for model in GROQ_MODELS:
            try:
                print(f"[Translation] Using model: {model}")
                response = await loop.run_in_executor(
                    None,
                    lambda m=model: groq_client.chat.completions.create(
                        model=m,
                        messages=messages,
                        temperature=0.3,  # Lower temp for more accurate translation
                        max_tokens=256,
                    )
                )
                
                result = response.choices[0].message.content.strip()
                # Remove quotes if present
                if result.startswith('"') and result.endswith('"'):
                    result = result[1:-1]
                
                print(f"[Translation] Success: {text[:30]}... -> {result[:30]}...")
                return result
                
            except Exception as e:
                error_msg = str(e)
                print(f"[Translation] Error with {model}: {error_msg}")
                if "not found" in error_msg.lower() or "does not exist" in error_msg.lower():
                    continue
                if "rate" in error_msg.lower():
                    await asyncio.sleep(1)
                    continue
                continue
        
        return text  # Return original if all models fail
        
    except Exception as e:
        print(f"[Translation] Exception: {e}")
        return text  # Return original on error


# ==================== Main API Functions ====================

async def transcribe_audio(audio_data: bytes) -> str:
    """Main transcription function - uses Groq Whisper"""
    print(f"[Transcribe] Processing {len(audio_data)} bytes of audio")
    return await transcribe_with_groq_whisper(audio_data)


async def process_message(
    message: str,
    chat_history: Optional[List[dict]] = None,
    meeting_context: Optional[List[str]] = None
) -> str:
    """Main message processing function - uses Groq LLM"""
    print(f"[Process] Message: {message[:50]}...")
    return await process_with_groq(message, chat_history, meeting_context)
