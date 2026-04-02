"""
AI Chat WebSocket - Cost-Efficient Chunked Pipeline

AI Assistant mode:
  Frontend sends 3-second audio chunks (only when speech detected) ->
  Backend transcribes with Sarvam STT -> TurnAccumulator buffers chunks ->
  After 2s silence, flushes complete turn -> is_question check ->
  OpenAI GPT-4o-mini streams response (Groq fallback).

Translation mode:
  Unchanged chunked Sarvam STT + translate + TTS pipeline.

Text chat:
  Uses OpenAI GPT-4o-mini streaming (Groq fallback) for typed messages.
"""
import asyncio
import base64
import time
from typing import Awaitable, Callable, Dict, List, Optional
from fastapi import WebSocket, WebSocketDisconnect

from services.ai_service import (
    is_question,
    transcribe_audio,
    stream_message,
    translate_and_speak,
)


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


# ---------------------------------------------------------------------------
# TurnAccumulator - replaces Realtime API server-side VAD turn detection
# ---------------------------------------------------------------------------

class TurnAccumulator:
    """
    Accumulates transcription chunks into complete speaker turns.

    Flow: chunk transcriptions arrive every ~3s -> buffered -> after 2s of
    no new input the accumulated text is flushed as one complete turn and
    forwarded to the LLM for a response.  This replaces the Realtime API's
    server-side VAD which committed a turn after 700ms of silence.
    """
    FLUSH_DELAY = 2.0

    def __init__(self):
        self.buffer: List[str] = []
        self._flush_task: Optional[asyncio.Task] = None
        self.on_flush: Optional[Callable[[str], Awaitable[None]]] = None

    def add(self, text: str):
        self.buffer.append(text)
        if self._flush_task and not self._flush_task.done():
            self._flush_task.cancel()
        self._flush_task = asyncio.create_task(self._delayed_flush())

    async def _delayed_flush(self):
        try:
            await asyncio.sleep(self.FLUSH_DELAY)
            if self.buffer and self.on_flush:
                full_text = " ".join(self.buffer)
                self.buffer.clear()
                await self.on_flush(full_text)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"[TurnAccumulator] Flush error: {e}")

    def clear(self):
        self.buffer.clear()
        if self._flush_task and not self._flush_task.done():
            self._flush_task.cancel()


# ---------------------------------------------------------------------------
# Connection manager
# ---------------------------------------------------------------------------

class ChatConnectionManager:
    """Manages per-client WebSocket state for all modes."""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.chat_histories: Dict[str, List[dict]] = {}
        self.meeting_contexts: Dict[str, List[str]] = {}
        self.listening_status: Dict[str, bool] = {}

        # Turn accumulation (AI Assistant mode)
        self.turn_accumulators: Dict[str, TurnAccumulator] = {}

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
        acc = self.turn_accumulators.pop(client_id, None)
        if acc:
            acc.clear()

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

            # ---- Chunked audio from AI Assistant mode ----
            elif msg_type == "ai_audio_chunk":
                await _handle_ai_audio_chunk(data, client_id, websocket)

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
                chat_manager.transcription_status[client_id] = False
                chat_manager.translation_status[client_id] = False
                chat_manager.listening_status[client_id] = True
                chat_manager.last_transcription[client_id] = ""

                accumulator = TurnAccumulator()
                accumulator.on_flush = lambda text, cid=client_id, ws=websocket: (
                    _on_turn_complete(cid, ws, text)
                )
                chat_manager.turn_accumulators[client_id] = accumulator

                await websocket.send_json({"type": "status", "status": "listening"})
                print(f"[AI] Client {client_id} started AI assistant (chunked pipeline)")

            elif msg_type == "stop_listening":
                chat_manager.listening_status[client_id] = False
                acc = chat_manager.turn_accumulators.pop(client_id, None)
                if acc:
                    acc.clear()
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
# AI Assistant: chunked audio handler + turn flush callback
# ---------------------------------------------------------------------------

async def _handle_ai_audio_chunk(data: dict, client_id: str, websocket: WebSocket):
    """
    Process a 3-second audio chunk from the AI Assistant mode.
    Pipeline: Sarvam STT -> heard event -> accumulate in TurnAccumulator.
    The TurnAccumulator flushes complete turns to _on_turn_complete().
    """
    if not chat_manager.listening_status.get(client_id, False):
        return

    audio_b64 = data.get("data", "")
    if not audio_b64:
        return

    try:
        audio_data = base64.b64decode(audio_b64)
        transcription = await transcribe_audio(audio_data)

        if not transcription or len(transcription.strip()) < 3:
            return

        last = chat_manager.last_transcription.get(client_id, "")
        if is_similar_text(transcription, last, threshold=0.8):
            return
        chat_manager.last_transcription[client_id] = transcription

        await websocket.send_json({
            "type": "heard",
            "transcript": transcription,
        })

        chat_manager.add_to_context(client_id, transcription)

        acc = chat_manager.turn_accumulators.get(client_id)
        if acc:
            acc.add(transcription)

    except Exception as e:
        print(f"[AI Chunk] Error: {e}")


async def _on_turn_complete(client_id: str, websocket: WebSocket, full_turn: str):
    """
    Called by TurnAccumulator when a speaker finishes (2s silence).
    Checks if the accumulated turn is a question/request and streams
    an OpenAI GPT-4o-mini response if so.
    """
    if not chat_manager.listening_status.get(client_id, False):
        return

    chat_manager.add_to_history(client_id, "user", f"[Meeting] {full_turn}")

    if is_question(full_turn):
        try:
            await websocket.send_json({
                "type": "stream_start",
                "role": "assistant",
                "heard": full_turn,
                "is_question": True,
            })

            full_response = ""
            async for token in stream_message(
                full_turn,
                chat_manager.chat_histories.get(client_id, []),
                chat_manager.meeting_contexts.get(client_id, []),
            ):
                full_response += token
                await websocket.send_json({"type": "stream_token", "token": token})

            await websocket.send_json({
                "type": "stream_end",
                "full_content": full_response,
                "heard": full_turn,
                "is_question": True,
            })

            if full_response:
                chat_manager.add_to_history(client_id, "assistant", full_response)

        except Exception as e:
            print(f"[AI Turn] Error streaming response: {e}")
            try:
                await websocket.send_json({
                    "type": "stream_end",
                    "full_content": "AI failed to respond. Please try again.",
                    "heard": full_turn,
                    "is_question": True,
                })
            except Exception:
                pass


# ---------------------------------------------------------------------------
# Message handlers (text, mic audio, transcription, translation)
# ---------------------------------------------------------------------------

async def _handle_text(data: dict, client_id: str, websocket: WebSocket):
    """Handle typed text message — stream AI response."""
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
    """Handle personal mic audio (user presses mic button)."""
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
