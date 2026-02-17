"""
AI Chat WebSocket - Hybrid Realtime Pipeline

AI Assistant mode:
  Frontend sends continuous PCM16 24kHz audio -> Backend relays to OpenAI
  Realtime API -> OpenAI handles VAD + STT + LLM -> streamed text tokens
  flow back to the frontend.

Translation mode:
  Unchanged chunked Groq Whisper + LLM translate + Azure TTS pipeline.

Text chat:
  Still uses Groq streaming LLM for typed messages.
"""
import base64
import time
from typing import Dict, List, Optional
from fastapi import WebSocket, WebSocketDisconnect

from services.ai_service import (
    is_question,
    transcribe_audio,
    stream_message,
    translate_and_speak,
)
from services.realtime_service import RealtimeService


def is_similar_text(text1: str, text2: str, threshold: float = 0.7) -> bool:
    """Check if two texts are similar (to avoid duplicate responses)."""
    if not text1 or not text2:
        return False
    t1 = text1.lower().strip()
    t2 = text2.lower().strip()
    if t1 == t2 or t1 in t2 or t2 in t1:
        return True
    words1 = set(t1.split())
    words2 = set(t2.split())
    if not words1 or not words2:
        return False
    overlap = len(words1 & words2)
    total = max(len(words1), len(words2))
    return (overlap / total) >= threshold


class ChatConnectionManager:
    """Manages per-client WebSocket state, including the OpenAI Realtime session."""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.chat_histories: Dict[str, List[dict]] = {}
        self.meeting_contexts: Dict[str, List[str]] = {}
        self.listening_status: Dict[str, bool] = {}

        # Realtime API session per client (AI Assistant mode)
        self.realtime_services: Dict[str, RealtimeService] = {}

        # Live Transcription mode
        self.transcription_status: Dict[str, bool] = {}
        self.last_transcription: Dict[str, str] = {}

        # Live Translation mode
        self.translation_status: Dict[str, bool] = {}
        self.translation_target: Dict[str, str] = {}

    def connect(self, client_id: str, websocket: WebSocket):
        self.active_connections[client_id] = websocket
        self.chat_histories[client_id] = []
        self.meeting_contexts[client_id] = []
        self.listening_status[client_id] = False
        self.transcription_status[client_id] = False
        self.translation_status[client_id] = False
        self.translation_target[client_id] = ""
        self.last_transcription[client_id] = ""

    async def disconnect(self, client_id: str):
        # Tear down any active Realtime session
        if client_id in self.realtime_services:
            try:
                await self.realtime_services[client_id].disconnect()
            except Exception:
                pass
            del self.realtime_services[client_id]

        for store in [
            self.active_connections, self.chat_histories,
            self.meeting_contexts, self.listening_status,
            self.transcription_status, self.translation_status,
            self.translation_target, self.last_transcription,
        ]:
            store.pop(client_id, None)

    def add_to_history(self, client_id: str, role: str, content: str):
        if client_id in self.chat_histories:
            self.chat_histories[client_id].append({"role": role, "content": content})

    def add_to_context(self, client_id: str, transcription: str):
        if client_id in self.meeting_contexts:
            self.meeting_contexts[client_id].append(transcription)
            if len(self.meeting_contexts[client_id]) > 50:
                self.meeting_contexts[client_id] = self.meeting_contexts[client_id][-50:]


chat_manager = ChatConnectionManager()


# ---------------------------------------------------------------------------
# Main WebSocket handler
# ---------------------------------------------------------------------------

async def websocket_ai_chat(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time AI chat with audio support."""
    await websocket.accept()
    chat_manager.connect(client_id, websocket)

    await websocket.send_json({
        "type": "message",
        "role": "assistant",
        "content": (
            "**AI Meeting Assistant Ready!**\n\n"
            "Choose a feature:\n\n"
            "- **AI Assistant** - Listens and gives real-time AI answers\n"
            "- **Live Translation** - Real-time speech translation"
        ),
    })

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "text")

            # ---- Text chat (typed messages) ----
            if msg_type == "text":
                await _handle_text(data, client_id, websocket)

            # ---- Personal mic audio ----
            elif msg_type == "audio":
                await _handle_audio(data, client_id, websocket)

            # ---- Continuous PCM audio stream (AI Assistant via Realtime API) ----
            elif msg_type == "audio_stream":
                await _handle_audio_stream(data, client_id)

            # ---- Live transcription ----
            elif msg_type == "live_transcription_audio":
                await _handle_live_transcription(data, client_id, websocket)

            # ---- Live translation ----
            elif msg_type == "live_translation_audio":
                await _handle_live_translation(data, client_id, websocket)

            # ================================================================
            # Mode toggles
            # ================================================================

            elif msg_type == "start_listening":
                # Stop other modes
                chat_manager.transcription_status[client_id] = False
                chat_manager.translation_status[client_id] = False
                chat_manager.listening_status[client_id] = True

                # Open OpenAI Realtime session
                await _start_realtime_session(client_id, websocket)

                await websocket.send_json({"type": "status", "status": "listening"})
                print(f"[AI] Client {client_id} started AI assistant (Realtime API)")

            elif msg_type == "stop_listening":
                chat_manager.listening_status[client_id] = False

                # Tear down Realtime session
                await _stop_realtime_session(client_id)

                await websocket.send_json({"type": "status", "status": "stopped"})
                print(f"[AI] Client {client_id} stopped AI assistant")

            elif msg_type == "start_transcription":
                chat_manager.listening_status[client_id] = False
                chat_manager.translation_status[client_id] = False
                chat_manager.transcription_status[client_id] = True
                chat_manager.last_transcription[client_id] = ""
                await websocket.send_json({"type": "status", "status": "transcribing"})

            elif msg_type == "stop_transcription":
                chat_manager.transcription_status[client_id] = False
                await websocket.send_json({"type": "status", "status": "stopped"})

            elif msg_type == "start_translation":
                chat_manager.listening_status[client_id] = False
                chat_manager.transcription_status[client_id] = False
                chat_manager.translation_status[client_id] = True
                chat_manager.translation_target[client_id] = data.get("target_language", "en")
                chat_manager.last_transcription[client_id] = ""
                await websocket.send_json({"type": "status", "status": "translating"})

            elif msg_type == "stop_translation":
                chat_manager.translation_status[client_id] = False
                chat_manager.translation_target[client_id] = ""
                await websocket.send_json({"type": "status", "status": "stopped"})

            elif msg_type == "clear":
                chat_manager.chat_histories[client_id] = []
                chat_manager.meeting_contexts[client_id] = []
                chat_manager.last_transcription[client_id] = ""
                await websocket.send_json({"type": "cleared", "content": "Chat history cleared"})

    except WebSocketDisconnect:
        print(f"Client {client_id} disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        await chat_manager.disconnect(client_id)


# ---------------------------------------------------------------------------
# Realtime API session management
# ---------------------------------------------------------------------------

async def _start_realtime_session(client_id: str, websocket: WebSocket):
    """Create a RealtimeService and open the OpenAI WebSocket."""
    # Tear down any existing session first
    await _stop_realtime_session(client_id)

    async def on_realtime_event(event: dict):
        """Callback: forward normalised events from OpenAI to the frontend."""
        try:
            etype = event.get("type", "")

            if etype == "stream_start":
                await websocket.send_json({
                    "type": "stream_start",
                    "role": "assistant",
                    "heard": event.get("heard", ""),
                    "is_question": False,
                })

            elif etype == "stream_token":
                await websocket.send_json({
                    "type": "stream_token",
                    "token": event.get("token", ""),
                })

            elif etype == "stream_end":
                full = event.get("full_content", "")
                heard = event.get("heard", "")
                await websocket.send_json({
                    "type": "stream_end",
                    "full_content": full,
                    "heard": heard,
                    "is_question": is_question(heard) if heard else False,
                })
                # Keep history
                if heard:
                    chat_manager.add_to_history(client_id, "user", f"[Meeting] {heard}")
                    chat_manager.add_to_context(client_id, heard)
                if full:
                    chat_manager.add_to_history(client_id, "assistant", full)

            elif etype == "heard":
                await websocket.send_json({
                    "type": "heard",
                    "transcript": event.get("transcript", ""),
                })

            elif etype == "speech_started":
                await websocket.send_json({
                    "type": "speech_started",
                })

            elif etype == "reconnecting":
                attempt = event.get("attempt", "?")
                max_att = event.get("max_attempts", "?")
                await websocket.send_json({
                    "type": "status",
                    "status": "reconnecting",
                    "message": f"Reconnecting to AI... ({attempt}/{max_att})",
                })

            elif etype == "reconnected":
                await websocket.send_json({
                    "type": "status",
                    "status": "listening",
                    "message": "Reconnected to AI successfully",
                })

            elif etype == "error":
                await websocket.send_json({
                    "type": "error",
                    "content": f"Realtime API error: {event.get('error', 'unknown')}",
                })

        except Exception as e:
            print(f"[AI] Error forwarding realtime event: {e}")

    service = RealtimeService(on_event=on_realtime_event)

    try:
        await service.connect()
        chat_manager.realtime_services[client_id] = service
        print(f"[AI] Realtime session active for {client_id}")
    except Exception as e:
        print(f"[AI] Failed to start realtime session: {e}")
        await websocket.send_json({
            "type": "error",
            "content": f"Failed to connect to OpenAI Realtime API: {e}",
        })


async def _stop_realtime_session(client_id: str):
    """Disconnect the RealtimeService for this client, if any."""
    service = chat_manager.realtime_services.pop(client_id, None)
    if service:
        await service.disconnect()
        print(f"[AI] Realtime session closed for {client_id}")


# ---------------------------------------------------------------------------
# Message handlers
# ---------------------------------------------------------------------------

async def _handle_audio_stream(data: dict, client_id: str):
    """Relay raw PCM audio from the frontend directly to OpenAI Realtime API."""
    if not chat_manager.listening_status.get(client_id, False):
        return

    service = chat_manager.realtime_services.get(client_id)
    if not service or not service.connected:
        return

    audio_b64 = data.get("data", "")
    if audio_b64:
        await service.send_audio(audio_b64)


async def _handle_text(data: dict, client_id: str, websocket: WebSocket):
    """Handle typed text message — stream AI response via Groq."""
    user_message = data.get("content", "")
    if not user_message.strip():
        return

    try:
        await websocket.send_json({
            "type": "stream_start",
            "role": "assistant",
            "heard": "",
            "is_question": False,
        })

        full_response = ""
        async for token in stream_message(
            user_message,
            chat_manager.chat_histories[client_id],
            chat_manager.meeting_contexts.get(client_id, []),
        ):
            full_response += token
            await websocket.send_json({"type": "stream_token", "token": token})

        await websocket.send_json({
            "type": "stream_end",
            "full_content": full_response,
            "heard": "",
            "is_question": False,
        })

        chat_manager.add_to_history(client_id, "user", user_message)
        chat_manager.add_to_history(client_id, "assistant", full_response)

    except Exception as e:
        print(f"[AI] Text error: {e}")
        try:
            await websocket.send_json({
                "type": "stream_end",
                "full_content": "AI failed to respond. Please try again.",
                "heard": "",
                "is_question": False,
            })
        except Exception:
            pass


async def _handle_audio(data: dict, client_id: str, websocket: WebSocket):
    """Handle personal mic audio (user presses mic button) — Groq pipeline."""
    audio_base64 = data.get("data", "")
    if not audio_base64:
        return

    try:
        audio_data = base64.b64decode(audio_base64)
        await websocket.send_json({"type": "status", "status": "transcribing"})
        transcription = await transcribe_audio(audio_data)

        if transcription:
            await websocket.send_json({"type": "transcription", "content": transcription})
            chat_manager.add_to_history(client_id, "user", transcription)

            await websocket.send_json({
                "type": "stream_start",
                "role": "assistant",
                "heard": "",
                "is_question": False,
            })

            full_response = ""
            async for token in stream_message(
                transcription,
                chat_manager.chat_histories[client_id],
                chat_manager.meeting_contexts.get(client_id, []),
            ):
                full_response += token
                await websocket.send_json({"type": "stream_token", "token": token})

            await websocket.send_json({
                "type": "stream_end",
                "full_content": full_response,
                "heard": "",
                "is_question": False,
            })

            chat_manager.add_to_history(client_id, "assistant", full_response)
        else:
            await websocket.send_json({
                "type": "error",
                "content": "Could not transcribe audio. Please try again.",
            })

    except Exception as e:
        print(f"[AI] Audio error: {e}")


async def _handle_live_transcription(data: dict, client_id: str, websocket: WebSocket):
    """Live transcription mode — just transcribe, no AI response."""
    if not chat_manager.transcription_status.get(client_id, False):
        return

    audio_base64 = data.get("data", "")
    if not audio_base64:
        return

    try:
        audio_data = base64.b64decode(audio_base64)
        transcription = await transcribe_audio(audio_data)

        if transcription and len(transcription.strip()) > 3:
            last_text = chat_manager.last_transcription.get(client_id, "")
            if is_similar_text(transcription, last_text, threshold=0.8):
                return

            chat_manager.last_transcription[client_id] = transcription
            await websocket.send_json({
                "type": "live_transcription",
                "content": transcription,
                "speaker": "Participant",
            })

    except Exception as e:
        print(f"[Transcription] Error: {e}")


async def _handle_live_translation(data: dict, client_id: str, websocket: WebSocket):
    """Live translation mode — transcribe, translate, speak."""
    if not chat_manager.translation_status.get(client_id, False):
        return

    audio_base64 = data.get("data", "")
    target_language = (
        data.get("target_language")
        or chat_manager.translation_target.get(client_id, "en")
    )
    if not audio_base64:
        return

    try:
        audio_data = base64.b64decode(audio_base64)
        transcription = await transcribe_audio(audio_data)

        if transcription and len(transcription.strip()) > 3:
            last_text = chat_manager.last_transcription.get(client_id, "")
            if is_similar_text(transcription, last_text, threshold=0.8):
                return

            chat_manager.last_transcription[client_id] = transcription

            translated, audio_bytes = await translate_and_speak(transcription, target_language)

            response_data = {
                "type": "live_translation",
                "original": transcription,
                "translated": translated,
                "target_language": target_language,
                "speaker": "Participant",
                "has_audio": audio_bytes is not None,
            }

            if audio_bytes:
                response_data["audio"] = base64.b64encode(audio_bytes).decode("utf-8")

            await websocket.send_json(response_data)

    except Exception as e:
        print(f"[Translation] Error: {e}")
