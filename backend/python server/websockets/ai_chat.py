"""
AI Chat WebSocket - Real-time AI chat with audio support
"""
import base64
from typing import Dict, List
from fastapi import WebSocket, WebSocketDisconnect

from services.ai_service import (
    is_question,
    process_text_with_gemini,
    transcribe_audio_with_gemini
)


class ChatConnectionManager:
    """Manages AI chat WebSocket connections and state"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.chat_histories: Dict[str, List[dict]] = {}
        self.meeting_contexts: Dict[str, List[str]] = {}
        self.listening_status: Dict[str, bool] = {}
    
    def connect(self, client_id: str, websocket: WebSocket):
        """Register a new connection"""
        self.active_connections[client_id] = websocket
        self.chat_histories[client_id] = []
        self.meeting_contexts[client_id] = []
        self.listening_status[client_id] = False
    
    def disconnect(self, client_id: str):
        """Clean up on disconnect"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.chat_histories:
            del self.chat_histories[client_id]
        if client_id in self.meeting_contexts:
            del self.meeting_contexts[client_id]
        if client_id in self.listening_status:
            del self.listening_status[client_id]
    
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
            # Keep only last 50 transcriptions
            if len(self.meeting_contexts[client_id]) > 50:
                self.meeting_contexts[client_id] = self.meeting_contexts[client_id][-50:]


# Global connection manager instance
chat_manager = ChatConnectionManager()


async def analyze_and_respond_to_question(
    transcription: str,
    client_id: str,
    websocket: WebSocket
) -> bool:
    """Analyze transcription for questions and respond if found"""
    if not transcription or len(transcription.strip()) < 5:
        return False
    
    if is_question(transcription):
        print(f"Question detected: {transcription}")
        
        # Notify about detected question
        await websocket.send_json({
            "type": "question_detected",
            "question": transcription
        })
        
        # Send typing indicator
        await websocket.send_json({
            "type": "typing",
            "status": True
        })
        
        # Get meeting context
        context = chat_manager.meeting_contexts.get(client_id, [])
        
        # Prepare question with context
        question_prompt = f"Someone in the meeting asked: \"{transcription}\"\n\nPlease provide a helpful, concise answer to this question."
        
        # Get AI response
        response = await process_text_with_gemini(
            question_prompt,
            chat_manager.chat_histories.get(client_id, []),
            context
        )
        
        # Add to chat history
        chat_manager.add_to_history(client_id, "user", f"[Meeting Question] {transcription}")
        chat_manager.add_to_history(client_id, "assistant", response)
        
        # Send response
        await websocket.send_json({
            "type": "typing",
            "status": False
        })
        
        await websocket.send_json({
            "type": "message",
            "role": "assistant",
            "content": f"📝 **Answer to the question:**\n\n{response}"
        })
        
        return True
    
    return False


async def websocket_ai_chat(websocket: WebSocket, client_id: str):
    """
    WebSocket endpoint for real-time AI chat with audio support
    
    Message types:
    - text: {"type": "text", "content": "user message"}
    - audio: {"type": "audio", "data": "base64_encoded_audio"}
    - meeting_audio: {"type": "meeting_audio", "data": "base64_encoded_audio"}
    - start_listening: {"type": "start_listening"}
    - stop_listening: {"type": "stop_listening"}
    - clear: {"type": "clear"} - Clear chat history
    """
    await websocket.accept()
    chat_manager.connect(client_id, websocket)
    
    # Send welcome message
    await websocket.send_json({
        "type": "message",
        "role": "assistant",
        "content": "Hello! I'm your AI meeting assistant. I can listen to your meeting and automatically answer questions. Click 'Listen to Meeting' to get started, or type/speak your questions directly!"
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
                
            elif msg_type == "start_listening":
                chat_manager.listening_status[client_id] = True
                await websocket.send_json({
                    "type": "status",
                    "status": "listening"
                })
                
            elif msg_type == "stop_listening":
                chat_manager.listening_status[client_id] = False
                await websocket.send_json({
                    "type": "status",
                    "status": "stopped"
                })
                
            elif msg_type == "clear":
                chat_manager.chat_histories[client_id] = []
                chat_manager.meeting_contexts[client_id] = []
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
    
    # Get AI response with meeting context
    response = await process_text_with_gemini(
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
        
        # Send processing status
        await websocket.send_json({
            "type": "status",
            "status": "transcribing"
        })
        
        # Transcribe audio
        transcription = await transcribe_audio_with_gemini(audio_data)
        
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
            
            # Get AI response
            response = await process_text_with_gemini(
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
    """Handle meeting audio (from other participants)"""
    if not chat_manager.listening_status.get(client_id, False):
        return
    
    audio_base64 = data.get("data", "")
    if not audio_base64:
        return
    
    try:
        # Decode audio
        audio_data = base64.b64decode(audio_base64)
        
        # Transcribe audio
        transcription = await transcribe_audio_with_gemini(audio_data)
        
        if transcription and len(transcription.strip()) > 3:
            # Add to meeting context
            chat_manager.add_to_context(client_id, transcription)
            
            # Send meeting transcription to user
            await websocket.send_json({
                "type": "meeting_transcription",
                "content": transcription,
                "speaker": "Meeting"
            })
            
            # Check if it's a question and respond
            await analyze_and_respond_to_question(transcription, client_id, websocket)
            
    except Exception as e:
        print(f"Error processing meeting audio: {e}")
