"""
AI Chat WebSocket - Real-time AI chat with Groq AI for ultra-fast responses
"""
import base64
import time
from typing import Dict, List, Optional
from fastapi import WebSocket, WebSocketDisconnect

from services.ai_service import (
    is_question,
    transcribe_audio,
    process_message,
    translate_text,
    translate_and_speak
)


def is_similar_text(text1: str, text2: str, threshold: float = 0.7) -> bool:
    """Check if two texts are similar (to avoid duplicate responses)"""
    if not text1 or not text2:
        return False
    
    t1 = text1.lower().strip()
    t2 = text2.lower().strip()
    
    # Exact match
    if t1 == t2:
        return True
    
    # One contains the other
    if t1 in t2 or t2 in t1:
        return True
    
    # Simple word overlap check
    words1 = set(t1.split())
    words2 = set(t2.split())
    
    if not words1 or not words2:
        return False
    
    overlap = len(words1 & words2)
    total = max(len(words1), len(words2))
    
    return (overlap / total) >= threshold


class ChatConnectionManager:
    """Manages AI chat WebSocket connections and state"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.chat_histories: Dict[str, List[dict]] = {}
        self.meeting_contexts: Dict[str, List[str]] = {}
        self.listening_status: Dict[str, bool] = {}
        # Deduplication: track last transcription and response time
        self.last_transcription: Dict[str, str] = {}
        self.last_response_time: Dict[str, float] = {}
        self.response_cooldown = 5.0  # seconds between responses
        
        # Live Transcription mode
        self.transcription_status: Dict[str, bool] = {}
        
        # Live Translation mode
        self.translation_status: Dict[str, bool] = {}
        self.translation_target: Dict[str, str] = {}  # Target language code
    
    def connect(self, client_id: str, websocket: WebSocket):
        """Register a new connection"""
        self.active_connections[client_id] = websocket
        self.chat_histories[client_id] = []
        self.meeting_contexts[client_id] = []
        self.listening_status[client_id] = False
        self.last_transcription[client_id] = ""
        self.last_response_time[client_id] = 0
        self.transcription_status[client_id] = False
        self.translation_status[client_id] = False
        self.translation_target[client_id] = ""
    
    def disconnect(self, client_id: str):
        """Clean up on disconnect"""
        for store in [self.active_connections, self.chat_histories, 
                      self.meeting_contexts, self.listening_status,
                      self.last_transcription, self.last_response_time,
                      self.transcription_status, self.translation_status,
                      self.translation_target]:
            if client_id in store:
                del store[client_id]
    
    def add_to_history(self, client_id: str, role: str, content: str):
        """Add message to chat history"""
        if client_id in self.chat_histories:
            self.chat_histories[client_id].append({
                "role": role,
                "content": content
            })
    
    def add_to_context(self, client_id: str, transcription: str):
        """Add transcription to meeting context"""
        if client_id in self.meeting_contexts:
            self.meeting_contexts[client_id].append(transcription)
            if len(self.meeting_contexts[client_id]) > 50:
                self.meeting_contexts[client_id] = self.meeting_contexts[client_id][-50:]
    
    def should_respond(self, client_id: str, transcription: str) -> bool:
        """Check if we should respond to this transcription (deduplication)"""
        now = time.time()
        
        # Check cooldown
        last_time = self.last_response_time.get(client_id, 0)
        if now - last_time < self.response_cooldown:
            print(f"[AI] Cooldown active, skipping response ({self.response_cooldown - (now - last_time):.1f}s remaining)")
            return False
        
        # Check if similar to last transcription
        last_text = self.last_transcription.get(client_id, "")
        if is_similar_text(transcription, last_text):
            print(f"[AI] Similar to previous transcription, skipping")
            return False
        
        return True
    
    def mark_responded(self, client_id: str, transcription: str):
        """Mark that we responded to this transcription"""
        self.last_transcription[client_id] = transcription
        self.last_response_time[client_id] = time.time()


# Global connection manager instance
chat_manager = ChatConnectionManager()


async def generate_response_for_speech(
    transcription: str,
    client_id: str,
    websocket: WebSocket
) -> bool:
    """Generate AI response for transcribed speech from meeting"""
    if not transcription or len(transcription.strip()) < 5:
        return False
    
    # Check for deduplication
    if not chat_manager.should_respond(client_id, transcription):
        return False
    
    print(f"[AI] Processing speech: {transcription}")
    
    # Determine if it's a question or statement
    is_q = is_question(transcription)
    
    # Send notification about what was heard
    await websocket.send_json({
        "type": "question_detected" if is_q else "speech_detected",
        "question": transcription
    })
    
    # Send typing indicator
    await websocket.send_json({
        "type": "typing",
        "status": True
    })
    
    # Get meeting context
    context = chat_manager.meeting_contexts.get(client_id, [])
    
    # Prepare prompt based on what was said
    if is_q:
        prompt = f"""The interviewer/other person asked: "{transcription}"

Provide a professional, helpful answer that the user can read and respond with.
Keep it concise but complete. If it's an interview question, give a strong answer."""
    else:
        prompt = f"""The interviewer/other person said: "{transcription}"

Based on what they said, provide a helpful response or suggestion that the user can use.
If they made a statement, provide a relevant reply or talking point.
Keep it concise and professional."""
    
    # Get AI response using Groq (ultra-fast)
    response = await process_message(
        prompt,
        chat_manager.chat_histories.get(client_id, []),
        context
    )
    
    # Add to chat history
    chat_manager.add_to_history(client_id, "user", f"[Meeting] {transcription}")
    chat_manager.add_to_history(client_id, "assistant", response)
    
    # Mark as responded (for deduplication)
    chat_manager.mark_responded(client_id, transcription)
    
    # Send response
    await websocket.send_json({
        "type": "typing",
        "status": False
    })
    
    label = "Answer" if is_q else "Suggested Response"
    await websocket.send_json({
        "type": "message",
        "role": "assistant",
        "content": f"**{label}:**\n\n{response}"
    })
    
    return True


async def websocket_ai_chat(websocket: WebSocket, client_id: str):
    """
    WebSocket endpoint for real-time AI chat with audio support
    
    Uses Groq AI for ultra-fast LLM responses and Whisper for transcription
    
    Message types:
    - text: {"type": "text", "content": "user message"}
    - audio: {"type": "audio", "data": "base64_encoded_audio"}
    - meeting_audio: {"type": "meeting_audio", "data": "base64_encoded_audio"}
    - live_transcription_audio: {"type": "live_transcription_audio", "data": "base64"}
    - live_translation_audio: {"type": "live_translation_audio", "data": "base64", "target_language": "es"}
    - start_listening: {"type": "start_listening"}
    - stop_listening: {"type": "stop_listening"}
    - start_transcription: {"type": "start_transcription"}
    - stop_transcription: {"type": "stop_transcription"}
    - start_translation: {"type": "start_translation", "target_language": "es"}
    - stop_translation: {"type": "stop_translation"}
    - clear: {"type": "clear"} - Clear chat history
    """
    await websocket.accept()
    chat_manager.connect(client_id, websocket)
    
    # Send welcome message
    await websocket.send_json({
        "type": "message",
        "role": "assistant",
        "content": "**Meeting Assistant Ready!**\n\nChoose a feature:\n\n- 🎧 **AI Assistant** - AI answers questions\n- 📝 **Live Transcription** - Speech to text\n- 🌐 **Live Translation** - Real-time translation"
    })
    
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "text")
            
            if msg_type == "text":
                await _handle_text_message(data, client_id, websocket)
                
            elif msg_type == "audio":
                await _handle_audio_message(data, client_id, websocket)
                
            elif msg_type == "meeting_audio":
                await _handle_meeting_audio(data, client_id, websocket)
                
            elif msg_type == "live_transcription_audio":
                await _handle_live_transcription(data, client_id, websocket)
                
            elif msg_type == "live_translation_audio":
                await _handle_live_translation(data, client_id, websocket)
                
            # ========== AI Assistant Mode ==========
            elif msg_type == "start_listening":
                # Stop other modes
                chat_manager.transcription_status[client_id] = False
                chat_manager.translation_status[client_id] = False
                chat_manager.listening_status[client_id] = True
                # Reset deduplication on start
                chat_manager.last_transcription[client_id] = ""
                chat_manager.last_response_time[client_id] = 0
                await websocket.send_json({
                    "type": "status",
                    "status": "listening"
                })
                print(f"[AI] Client {client_id} started AI assistant mode")
                
            elif msg_type == "stop_listening":
                chat_manager.listening_status[client_id] = False
                await websocket.send_json({
                    "type": "status",
                    "status": "stopped"
                })
                print(f"[AI] Client {client_id} stopped AI assistant")
            
            # ========== Live Transcription Mode ==========
            elif msg_type == "start_transcription":
                # Stop other modes
                chat_manager.listening_status[client_id] = False
                chat_manager.translation_status[client_id] = False
                chat_manager.transcription_status[client_id] = True
                chat_manager.last_transcription[client_id] = ""
                await websocket.send_json({
                    "type": "status",
                    "status": "transcribing"
                })
                print(f"[Transcription] Client {client_id} started live transcription")
                
            elif msg_type == "stop_transcription":
                chat_manager.transcription_status[client_id] = False
                await websocket.send_json({
                    "type": "status",
                    "status": "stopped"
                })
                print(f"[Transcription] Client {client_id} stopped transcription")
            
            # ========== Live Translation Mode ==========
            elif msg_type == "start_translation":
                # Stop other modes
                chat_manager.listening_status[client_id] = False
                chat_manager.transcription_status[client_id] = False
                chat_manager.translation_status[client_id] = True
                chat_manager.translation_target[client_id] = data.get("target_language", "en")
                chat_manager.last_transcription[client_id] = ""
                await websocket.send_json({
                    "type": "status",
                    "status": "translating"
                })
                print(f"[Translation] Client {client_id} started translation to {data.get('target_language', 'en')}")
                
            elif msg_type == "stop_translation":
                chat_manager.translation_status[client_id] = False
                chat_manager.translation_target[client_id] = ""
                await websocket.send_json({
                    "type": "status",
                    "status": "stopped"
                })
                print(f"[Translation] Client {client_id} stopped translation")
                
            elif msg_type == "clear":
                chat_manager.chat_histories[client_id] = []
                chat_manager.meeting_contexts[client_id] = []
                chat_manager.last_transcription[client_id] = ""
                await websocket.send_json({
                    "type": "cleared",
                    "content": "Chat history cleared"
                })
                
    except WebSocketDisconnect:
        print(f"Client {client_id} disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        chat_manager.disconnect(client_id)


async def _handle_text_message(data: dict, client_id: str, websocket: WebSocket):
    """Handle text message from user"""
    user_message = data.get("content", "")
    if not user_message.strip():
        return
    
    # Add to history
    chat_manager.add_to_history(client_id, "user", user_message)
    
    # Send typing indicator
    await websocket.send_json({
        "type": "typing",
        "status": True
    })
    
    # Get AI response with meeting context using Groq
    response = await process_message(
        user_message,
        chat_manager.chat_histories[client_id],
        chat_manager.meeting_contexts.get(client_id, [])
    )
    
    # Add AI response to history
    chat_manager.add_to_history(client_id, "assistant", response)
    
    # Send response
    await websocket.send_json({
        "type": "typing",
        "status": False
    })
    
    await websocket.send_json({
        "type": "message",
        "role": "assistant",
        "content": response
    })


async def _handle_audio_message(data: dict, client_id: str, websocket: WebSocket):
    """Handle personal audio message (user speaking to AI directly)"""
    audio_base64 = data.get("data", "")
    if not audio_base64:
        return
    
    try:
        # Decode audio
        audio_data = base64.b64decode(audio_base64)
        print(f"[AI] Received personal audio: {len(audio_data)} bytes")
        
        # Send processing status
        await websocket.send_json({
            "type": "status",
            "status": "transcribing"
        })
        
        # Transcribe audio
        transcription = await transcribe_audio(audio_data)
        print(f"[AI] Personal audio transcription: {transcription}")
        
        if transcription:
            # Send transcription to user
            await websocket.send_json({
                "type": "transcription",
                "content": transcription
            })
            
            # Add transcription to history
            chat_manager.add_to_history(client_id, "user", transcription)
            
            # Send typing indicator
            await websocket.send_json({
                "type": "typing",
                "status": True
            })
            
            # Get AI response using Groq
            response = await process_message(
                transcription,
                chat_manager.chat_histories[client_id],
                chat_manager.meeting_contexts.get(client_id, [])
            )
            
            # Add AI response to history
            chat_manager.add_to_history(client_id, "assistant", response)
            
            # Send response
            await websocket.send_json({
                "type": "typing",
                "status": False
            })
            
            await websocket.send_json({
                "type": "message",
                "role": "assistant",
                "content": response
            })
        else:
            await websocket.send_json({
                "type": "error",
                "content": "Could not transcribe audio. Please try again or type your message."
            })
            
    except Exception as e:
        print(f"Error processing audio: {e}")
        await websocket.send_json({
            "type": "error",
            "content": "Error processing audio. Please try again."
        })


async def _handle_meeting_audio(data: dict, client_id: str, websocket: WebSocket):
    """Handle meeting audio (from other participants) - with deduplication"""
    if not chat_manager.listening_status.get(client_id, False):
        return
    
    audio_base64 = data.get("data", "")
    if not audio_base64:
        return
    
    try:
        # Decode audio
        audio_data = base64.b64decode(audio_base64)
        print(f"[AI] Received meeting audio: {len(audio_data)} bytes")
        
        # Transcribe audio
        transcription = await transcribe_audio(audio_data)
        
        if transcription and len(transcription.strip()) > 5:
            print(f"[AI] Meeting transcription: {transcription}")
            
            # Add to meeting context (always, for context awareness)
            chat_manager.add_to_context(client_id, transcription)
            
            # Send meeting transcription to user
            await websocket.send_json({
                "type": "meeting_transcription",
                "content": transcription,
                "speaker": "Other Participant"
            })
            
            # Generate response (with deduplication check inside)
            await generate_response_for_speech(transcription, client_id, websocket)
        else:
            print(f"[AI] No meaningful speech detected in meeting audio")
            
    except Exception as e:
        print(f"Error processing meeting audio: {e}")


async def _handle_live_transcription(data: dict, client_id: str, websocket: WebSocket):
    """Handle live transcription audio - transcription only, no AI response"""
    if not chat_manager.transcription_status.get(client_id, False):
        return
    
    audio_base64 = data.get("data", "")
    if not audio_base64:
        return
    
    try:
        # Decode audio
        audio_data = base64.b64decode(audio_base64)
        print(f"[Transcription] Received audio: {len(audio_data)} bytes")
        
        # Transcribe audio
        transcription = await transcribe_audio(audio_data)
        
        if transcription and len(transcription.strip()) > 3:
            # Check for duplicate (avoid repeating same text)
            last_text = chat_manager.last_transcription.get(client_id, "")
            if is_similar_text(transcription, last_text, threshold=0.8):
                print(f"[Transcription] Skipping duplicate: {transcription[:30]}...")
                return
            
            chat_manager.last_transcription[client_id] = transcription
            print(f"[Transcription] Result: {transcription}")
            
            # Send transcription to user (no AI response)
            await websocket.send_json({
                "type": "live_transcription",
                "content": transcription,
                "speaker": "Participant"
            })
        else:
            print(f"[Transcription] No meaningful speech detected")
            
    except Exception as e:
        print(f"[Transcription] Error: {e}")


async def _handle_live_translation(data: dict, client_id: str, websocket: WebSocket):
    """Handle live translation audio - transcribe, translate, and speak in target language"""
    if not chat_manager.translation_status.get(client_id, False):
        return
    
    audio_base64 = data.get("data", "")
    target_language = data.get("target_language") or chat_manager.translation_target.get(client_id, "en")
    
    if not audio_base64:
        return
    
    try:
        # Decode audio
        audio_data = base64.b64decode(audio_base64)
        print(f"[Translation] Received audio: {len(audio_data)} bytes, target: {target_language}")
        
        # First transcribe the audio
        transcription = await transcribe_audio(audio_data)
        
        if transcription and len(transcription.strip()) > 3:
            # Check for duplicate
            last_text = chat_manager.last_transcription.get(client_id, "")
            if is_similar_text(transcription, last_text, threshold=0.8):
                print(f"[Translation] Skipping duplicate: {transcription[:30]}...")
                return
            
            chat_manager.last_transcription[client_id] = transcription
            print(f"[Translation] Original: {transcription}")
            
            # Translate and convert to speech
            translated, audio_bytes = await translate_and_speak(transcription, target_language)
            print(f"[Translation] Translated: {translated}")
            
            # Prepare response with audio if available
            response_data = {
                "type": "live_translation",
                "original": transcription,
                "translated": translated,
                "target_language": target_language,
                "speaker": "Participant",
                "has_audio": audio_bytes is not None
            }
            
            # Add base64 encoded audio if available
            if audio_bytes:
                response_data["audio"] = base64.b64encode(audio_bytes).decode('utf-8')
                print(f"[Translation] Audio generated: {len(audio_bytes)} bytes")
            
            # Send to client
            await websocket.send_json(response_data)
        else:
            print(f"[Translation] No meaningful speech detected")
            
    except Exception as e:
        print(f"[Translation] Error: {e}")
