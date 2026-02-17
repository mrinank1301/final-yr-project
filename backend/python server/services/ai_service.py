"""
AI Service - Groq Whisper for transcription + Groq LLM for ultra-fast meeting assistance
+ Azure TTS for text-to-speech translation
+ Token streaming & incremental transcription for real-time Parakeet AI-like experience
"""
import asyncio
import tempfile
import os
import base64
import aiohttp
import json
from typing import List, Optional, Tuple, AsyncGenerator
from datetime import datetime
from groq import Groq, AsyncGroq

from config import (
    GROQ_API_KEY,
    GROQ_MODELS,
    AI_SYSTEM_INSTRUCTION,
    AZURE_SPEECH_KEY,
    AZURE_SPEECH_REGION
)

# Initialize Groq clients (sync for transcription, async for streaming LLM)
groq_client = None
async_groq_client = None
if GROQ_API_KEY:
    groq_client = Groq(api_key=GROQ_API_KEY)
    async_groq_client = AsyncGroq(api_key=GROQ_API_KEY)
    print("[AI Service] Groq clients initialized - Sync + Async streaming ready!")
else:
    print("[AI Service] ERROR: Groq API key not set! Please set GROQ_API_KEY in .env")

# Reusable aiohttp connector for TTS (connection pooling for speed)
_tts_connector = None
_tts_session = None

async def get_tts_session():
    """Get or create a reusable aiohttp session for TTS requests"""
    global _tts_connector, _tts_session
    if _tts_session is None or _tts_session.closed:
        _tts_connector = aiohttp.TCPConnector(limit=5, keepalive_timeout=30)
        _tts_session = aiohttp.ClientSession(connector=_tts_connector)
    return _tts_session


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


async def transcribe_with_groq_whisper(audio_data: bytes, source_language: str = None) -> str:
    """
    Transcribe audio using Groq's Whisper API - Fast and accurate!
    Supports WebM, MP3, WAV, and other formats directly.
    If source_language is None, auto-detects the language.
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
            print(f"[Whisper] Transcribing {len(audio_data)} bytes... (lang: {source_language or 'auto'})")
            
            # Use Groq's Whisper API
            loop = asyncio.get_event_loop()
            
            # Build parameters - only include language if specified
            def do_transcription():
                params = {
                    "model": "whisper-large-v3",
                    "file": open(temp_path, "rb"),
                    "response_format": "text"
                }
                # Only set language if specified, otherwise let Whisper auto-detect
                if source_language:
                    params["language"] = source_language
                return groq_client.audio.transcriptions.create(**params)
            
            transcription = await loop.run_in_executor(None, do_transcription)
            
            result = transcription.strip() if isinstance(transcription, str) else str(transcription).strip()
            
            # Filter out empty, noise-only, and Whisper hallucination transcriptions
            # Whisper often hallucinates these short phrases on silence/noise
            hallucinations = {
                '', '.', '..', '...', 'you', 'yeah', 'uh', 'um', 'hmm', 'ah', 'oh',
                'thank you.', 'thanks.', 'thank you', 'thanks',
                'hello.', 'hello', 'hi.', 'hi', 'hey.', 'hey',
                'bye.', 'bye', 'goodbye.', 'goodbye',
                'yes.', 'yes', 'no.', 'no', 'okay.', 'okay', 'ok.', 'ok',
                'cheers.', 'cheers', 'good.', 'good',
                'hei!', 'hei', 'olá!', 'olá', 'ciao.', 'ciao',
                'good morning.', 'good morning', 'good night.', 'good night',
                'thank you for watching.', 'thanks for watching.',
                'please subscribe.', 'like and subscribe.',
                'see you next time.', 'see you.',
                'subtitles by', 'translated by', 'amara.org',
            }
            
            result_check = result.lower().strip().rstrip('.')
            if (result and len(result) > 2 
                and result.lower() not in hallucinations 
                and result_check not in hallucinations
                and len(result.split()) >= 2):  # Require at least 2 words
                print(f"[Whisper] SUCCESS: {result}")
                return result
            else:
                print(f"[Whisper] Filtered (hallucination/noise): '{result}'")
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
    """Process text message with Groq AI for ultra-fast responses - Optimized"""
    if not groq_client:
        print("[Groq LLM] ERROR: No client available")
        return "AI service not configured. Please set GROQ_API_KEY."
    
    try:
        # Build messages for Groq - optimized context window
        messages = [
            {"role": "system", "content": AI_SYSTEM_INSTRUCTION}
        ]
        
        # Add meeting context if available (limit to most recent 8 for efficiency)
        if meeting_context and len(meeting_context) > 0:
            recent_context = meeting_context[-8:]  # Reduced from 10 to 8
            context_text = "\n".join(recent_context)
            messages.append({
                "role": "system",
                "content": f"Recent conversation:\n{context_text}"
            })
        
        # Add chat history (limit to last 5 for efficiency)
        if chat_history:
            for msg in chat_history[-5:]:  # Reduced from 6 to 5
                role = "user" if msg["role"] == "user" else "assistant"
                messages.append({"role": role, "content": msg["content"]})
        
        # Add current message
        messages.append({"role": "user", "content": message})
        
        # Try each model - optimized order (fastest first)
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
                        max_tokens=400,  # Reduced from 512 for faster responses
                    )
                )
                
                result = response.choices[0].message.content.strip()
                print(f"[Groq LLM] Response generated successfully ({len(result)} chars)")
                return result
                
            except Exception as e:
                error_msg = str(e)
                print(f"[Groq LLM] Error with {model}: {error_msg[:100]}")
                # If model not found, try next
                if "not found" in error_msg.lower() or "does not exist" in error_msg.lower():
                    continue
                # If rate limited, wait and retry
                if "rate" in error_msg.lower():
                    await asyncio.sleep(0.5)  # Reduced wait time
                    continue
                continue
        
        return "I'm having trouble responding right now. Please try again."
        
    except Exception as e:
        print(f"[Groq LLM] Exception: {e}")
        return "Sorry, I encountered an error. Please try again."


# ==================== Streaming LLM Response ====================

async def process_with_groq_streaming(
    message: str,
    chat_history: Optional[List[dict]] = None,
    meeting_context: Optional[List[str]] = None
) -> AsyncGenerator[str, None]:
    """
    Stream LLM response token-by-token using Groq's async streaming API.
    Yields individual tokens as they are generated for real-time display.
    This is the key to Parakeet AI-like fast responses.
    """
    if not async_groq_client:
        print("[Groq Stream] ERROR: No async client available")
        yield "AI service not configured. Please set GROQ_API_KEY."
        return
    
    try:
        messages = [
            {"role": "system", "content": AI_SYSTEM_INSTRUCTION}
        ]
        
        if meeting_context and len(meeting_context) > 0:
            recent_context = meeting_context[-8:]
            context_text = "\n".join(recent_context)
            messages.append({
                "role": "system",
                "content": f"Recent conversation:\n{context_text}"
            })
        
        if chat_history:
            for msg in chat_history[-5:]:
                role = "user" if msg["role"] == "user" else "assistant"
                messages.append({"role": role, "content": msg["content"]})
        
        messages.append({"role": "user", "content": message})
        
        # Try each model with streaming
        for model in GROQ_MODELS:
            try:
                print(f"[Groq Stream] Streaming with model: {model}")
                stream = await async_groq_client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=400,
                    stream=True,
                )
                
                token_count = 0
                async for chunk in stream:
                    content = chunk.choices[0].delta.content
                    if content:
                        token_count += 1
                        yield content
                
                print(f"[Groq Stream] Streamed {token_count} tokens successfully")
                return
                
            except Exception as e:
                error_msg = str(e)
                print(f"[Groq Stream] Error with {model}: {error_msg[:100]}")
                if "not found" in error_msg.lower() or "does not exist" in error_msg.lower():
                    continue
                if "rate" in error_msg.lower():
                    await asyncio.sleep(0.5)
                    continue
                continue
        
        yield "I'm having trouble responding right now. Please try again."
        
    except Exception as e:
        print(f"[Groq Stream] Exception: {e}")
        yield "Sorry, I encountered an error. Please try again."


async def stream_message(
    message: str,
    chat_history: Optional[List[dict]] = None,
    meeting_context: Optional[List[str]] = None
) -> AsyncGenerator[str, None]:
    """Main streaming message function - yields tokens from Groq LLM"""
    print(f"[Stream] Message: {message[:50]}...")
    async for token in process_with_groq_streaming(message, chat_history, meeting_context):
        yield token


# ==================== Translation Function ====================

async def translate_text(
    text: str,
    target_language: str,
    source_language: str = "auto"
) -> str:
    """Translate text to target language using Groq LLM - Optimized for speed"""
    if not groq_client:
        print("[Translation] ERROR: No Groq client available")
        return text  # Return original if no client
    
    if not text or len(text.strip()) < 2:
        return ""
    
    try:
        # Language name mapping for better prompts
        language_names = {
            "en": "English", "es": "Spanish", "fr": "French", "de": "German",
            "it": "Italian", "pt": "Portuguese", "ru": "Russian", "zh": "Chinese (Mandarin)",
            "ja": "Japanese", "ko": "Korean", "ar": "Arabic", "hi": "Hindi",
            "te": "Telugu", "ta": "Tamil", "bn": "Bengali", "nl": "Dutch",
            "pl": "Polish", "tr": "Turkish", "vi": "Vietnamese", "th": "Thai"
        }
        
        target_name = language_names.get(target_language, target_language)
        
        # Optimized prompt - shorter and more direct
        messages = [
            {"role": "system", "content": f"Translate to {target_name} only. Output translation only, no explanations."},
            {"role": "user", "content": f"Translate: {text}"}
        ]
        
        # Safe print that handles non-ASCII characters
        try:
            print(f"[Translation] Translating to {target_name}: '{text[:40]}...'")
        except UnicodeEncodeError:
            print(f"[Translation] Translating to {target_name}: [non-ASCII input]")

        
        loop = asyncio.get_event_loop()
        
        # Use fastest model first for translation (speed is priority)
        fast_models = ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "gemma2-9b-it"]
        
        for model in fast_models:
            result = None
            try:
                response = await loop.run_in_executor(
                    None,
                    lambda m=model: groq_client.chat.completions.create(
                        model=m,
                        messages=messages,
                        temperature=0.1,  # Lower temp for faster, more consistent translation
                        max_tokens=100,   # Reduced for speed
                    )
                )
                
                result = response.choices[0].message.content.strip()
                # Remove quotes if present
                if result.startswith('"') and result.endswith('"'):
                    result = result[1:-1]
                if result.startswith("'") and result.endswith("'"):
                    result = result[1:-1]
                
                # Safe print that handles non-ASCII characters
                try:
                    print(f"[Translation] Success: {len(result)} chars")
                except:
                    pass
                return result
                
            except Exception as e:
                error_msg = str(e)
                # Check if it's an encoding error (translation likely succeeded)
                if "charmap" in error_msg.lower() or "encode" in error_msg.lower():
                    if result:
                        print(f"[Translation] Success (with encoding warning)")
                        return result
                    continue
                    
                try:
                    print(f"[Translation] Error with {model}: {error_msg[:80]}")
                except:
                    print(f"[Translation] Error with {model}")
                    
                if "not found" in error_msg.lower() or "does not exist" in error_msg.lower() or "decommissioned" in error_msg.lower():
                    continue
                if "rate" in error_msg.lower():
                    await asyncio.sleep(0.5)  # Reduced wait time
                    continue
                continue
        
        return text  # Return original if all models fail
        
    except Exception as e:
        print(f"[Translation] Exception: {e}")
        return text  # Return original on error


# ==================== Text-to-Speech Function ====================

# Voice mapping for different languages (Azure Neural voices)
LANGUAGE_VOICES = {
    "en": "en-US-JennyNeural",
    "es": "es-ES-ElviraNeural",
    "fr": "fr-FR-DeniseNeural",
    "de": "de-DE-KatjaNeural",
    "it": "it-IT-ElsaNeural",
    "pt": "pt-BR-FranciscaNeural",
    "ru": "ru-RU-SvetlanaNeural",
    "zh": "zh-CN-XiaoxiaoNeural",
    "ja": "ja-JP-NanamiNeural",
    "ko": "ko-KR-SunHiNeural",
    "ar": "ar-SA-ZariyahNeural",
    "hi": "hi-IN-SwaraNeural",
    "te": "te-IN-ShrutiNeural",
    "ta": "ta-IN-PallaviNeural",
    "bn": "bn-IN-TanishaaNeural",
    "nl": "nl-NL-ColetteNeural",
    "pl": "pl-PL-AgnieszkaNeural",
    "tr": "tr-TR-EmelNeural",
    "vi": "vi-VN-HoaiMyNeural",
    "th": "th-TH-PremwadeeNeural",
}

async def text_to_speech(text: str, language: str = "en") -> Optional[bytes]:
    """
    Convert text to speech using Azure Cognitive Services TTS.
    Returns audio bytes (MP3 format) or None if failed.
    Optimized for low latency.
    """
    if not AZURE_SPEECH_KEY or not AZURE_SPEECH_REGION:
        print("[TTS] ERROR: Azure Speech credentials not configured")
        return None
    
    if not text or len(text.strip()) < 1:
        return None
    
    try:
        # Get the appropriate voice for the language
        voice = LANGUAGE_VOICES.get(language, "en-US-JennyNeural")
        
        # Azure TTS endpoint
        endpoint = f"https://{AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1"
        
        # SSML format for Azure TTS - faster speech rate (1.15x) for quicker response
        ssml = f"""<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='{language}'>
            <voice name='{voice}'>
                <prosody rate='1.15' pitch='0%'>
                    {text}
                </prosody>
            </voice>
        </speak>"""
        
        headers = {
            "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-16khz-64kbitrate-mono-mp3",  # Faster: smaller file
            "User-Agent": "VideoCallAI"
        }
        
        # Use reusable session for connection pooling (faster!)
        session = await get_tts_session()
        async with session.post(endpoint, headers=headers, data=ssml.encode('utf-8'), timeout=aiohttp.ClientTimeout(total=10)) as response:
            if response.status == 200:
                audio_data = await response.read()
                print(f"[TTS] Done ({len(audio_data)} bytes)")
                return audio_data
            else:
                error_text = await response.text()
                print(f"[TTS] ERROR: Status {response.status}")
                return None
                    
    except Exception as e:
        print(f"[TTS] Exception: {e}")
        return None


async def translate_and_speak(
    text: str,
    target_language: str
) -> Tuple[str, Optional[bytes]]:
    """
    Translate text and convert to speech.
    Returns tuple of (translated_text, audio_bytes).
    """
    # First translate
    translated = await translate_text(text, target_language)
    
    if not translated:
        return ("", None)
    
    # Then convert to speech
    audio = await text_to_speech(translated, target_language)
    
    return (translated, audio)


# ==================== Main API Functions ====================

async def transcribe_audio(audio_data: bytes, source_language: str = "en") -> str:
    """Main transcription function - uses Groq Whisper. Defaults to English."""
    print(f"[Transcribe] Processing {len(audio_data)} bytes (lang: {source_language})")
    return await transcribe_with_groq_whisper(audio_data, source_language)


async def process_message(
    message: str,
    chat_history: Optional[List[dict]] = None,
    meeting_context: Optional[List[str]] = None
) -> str:
    """Main message processing function - uses Groq LLM"""
    print(f"[Process] Message: {message[:50]}...")
    return await process_with_groq(message, chat_history, meeting_context)


async def generate_meeting_summary_with_minutes(
    transcript: str,
    participants: List[str],
    duration: str
) -> dict:
    """
    Generate comprehensive meeting summary with minutes of meeting
    Returns dict with summary, minutes, key_points, action_items, decisions
    """
    if not groq_client:
        print("[Summary] ERROR: No Groq client available")
        return {
            "summary": "Summary generation not available.",
            "minutes": {},
            "key_points": [],
            "action_items": [],
            "decisions": []
        }
    
    if not transcript or len(transcript.strip()) < 10:
        return {
            "summary": "No transcript available for summary.",
            "minutes": {},
            "key_points": [],
            "action_items": [],
            "decisions": []
        }
    
    try:
        participants_str = ", ".join(participants) if participants else "Unknown"
        
        prompt = f"""Generate a comprehensive meeting summary and minutes from this transcript.

Meeting Details:
- Participants: {participants_str}
- Duration: {duration}

Transcript:
{transcript}

Please provide a structured response in the following JSON format:
{{
    "summary": "A concise 2-3 paragraph summary of the entire meeting",
    "key_points": ["Point 1", "Point 2", "Point 3"],
    "action_items": [{{"item": "Action description", "assignee": "Person name or 'All'", "due_date": "Date if mentioned or 'TBD'"}}],
    "decisions": ["Decision 1", "Decision 2"],
    "topics_discussed": ["Topic 1", "Topic 2", "Topic 3"]
}}

Be thorough and extract all important information. If information is not available, use "N/A" or empty arrays."""

        messages = [
            {"role": "system", "content": "You are a professional meeting minutes generator. Always respond with valid JSON only, no additional text."},
            {"role": "user", "content": prompt}
        ]
        
        loop = asyncio.get_event_loop()
        
        # Use a capable model for better structured output
        for model in ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile"]:
            try:
                print(f"[Summary] Generating summary with {model}...")
                response = await loop.run_in_executor(
                    None,
                    lambda m=model: groq_client.chat.completions.create(
                        model=m,
                        messages=messages,
                        temperature=0.3,  # Lower temp for more consistent structured output
                        max_tokens=2000,
                        response_format={"type": "json_object"} if "70b" in model else None
                    )
                )
                
                result_text = response.choices[0].message.content.strip()
                
                # Try to parse JSON
                try:
                    # Remove markdown code blocks if present
                    if result_text.startswith("```"):
                        result_text = result_text.split("```")[1]
                        if result_text.startswith("json"):
                            result_text = result_text[4:]
                    result_text = result_text.strip()
                    
                    import json
                    result = json.loads(result_text)
                    
                    # Ensure all required fields exist
                    summary_data = {
                        "summary": result.get("summary", "Summary not available."),
                        "key_points": result.get("key_points", []),
                        "action_items": result.get("action_items", []),
                        "decisions": result.get("decisions", []),
                        "topics_discussed": result.get("topics_discussed", [])
                    }
                    
                    # Create minutes structure
                    minutes = {
                        "meeting_date": datetime.now().strftime("%Y-%m-%d"),
                        "duration": duration,
                        "participants": participants,
                        "summary": summary_data["summary"],
                        "key_points": summary_data["key_points"],
                        "action_items": summary_data["action_items"],
                        "decisions": summary_data["decisions"],
                        "topics_discussed": summary_data["topics_discussed"]
                    }
                    
                    summary_data["minutes"] = minutes
                    
                    print(f"[Summary] Successfully generated summary")
                    return summary_data
                    
                except json.JSONDecodeError as e:
                    print(f"[Summary] JSON parse error: {e}")
                    print(f"[Summary] Response was: {result_text[:200]}")
                    # Fall through to next model
                    continue
                    
            except Exception as e:
                error_msg = str(e)
                print(f"[Summary] Error with {model}: {error_msg[:100]}")
                if "not found" in error_msg.lower() or "does not exist" in error_msg.lower():
                    continue
                if "rate" in error_msg.lower():
                    await asyncio.sleep(1)
                    continue
                continue
        
        # Fallback: generate simple summary
        print("[Summary] Using fallback simple summary")
        simple_prompt = f"Summarize this meeting transcript in 3-4 sentences:\n\n{transcript}"
        simple_summary = await process_with_groq(simple_prompt)
        
        return {
            "summary": simple_summary,
            "minutes": {
                "meeting_date": datetime.now().strftime("%Y-%m-%d"),
                "duration": duration,
                "participants": participants,
                "summary": simple_summary,
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
        
    except Exception as e:
        print(f"[Summary] Exception: {e}")
        return {
            "summary": f"Error generating summary: {str(e)}",
            "minutes": {},
            "key_points": [],
            "action_items": [],
            "decisions": []
        }
