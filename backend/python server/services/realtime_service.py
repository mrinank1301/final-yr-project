"""
OpenAI Realtime API Service - Manages WebSocket connection for real-time
audio-to-text AI assistant conversations.

Features:
  - Auto-reconnects up to 3 times when the connection drops
  - Text-only output (no audio output) to minimize cost
  - Server-side VAD for automatic turn detection
  - Input audio transcription (what was heard)
"""
import json
import asyncio
import traceback
from typing import Callable, Optional, Awaitable
import aiohttp

from config import OPENAI_API_KEY

REALTIME_MODEL = "gpt-4o-mini-realtime-preview"
REALTIME_URL = f"wss://api.openai.com/v1/realtime?model={REALTIME_MODEL}"

# English-only, concise meeting assistant instructions
REALTIME_INSTRUCTIONS = """You are an AI meeting assistant listening to a live video call.

RULES:
1. ALWAYS respond in English only.
2. Keep answers concise: 1-3 sentences.
3. Give direct, actionable answers.
4. For interview questions: give a confident, professional answer.
5. For technical questions: give accurate, practical explanations.
6. Do NOT repeat what was said. Just answer.
7. Do NOT add disclaimers or meta-commentary.
8. If audio is unclear, respond: "[unclear audio]"
"""

MAX_RECONNECT_ATTEMPTS = 3


class RealtimeService:
    """
    Manages a single OpenAI Realtime API WebSocket session with auto-reconnect.
    """

    def __init__(self, on_event: Callable[[dict], Awaitable[None]]):
        self.on_event = on_event
        self._session: Optional[aiohttp.ClientSession] = None
        self._ws: Optional[aiohttp.ClientWebSocketResponse] = None
        self._listen_task: Optional[asyncio.Task] = None
        self._connected = False
        self._intentional_disconnect = False
        self._instructions = REALTIME_INSTRUCTIONS
        self._reconnect_count = 0
        self._audio_chunks_sent = 0

    async def connect(self, system_instructions: str = ""):
        """Open WebSocket to OpenAI Realtime API and configure the session."""
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not set. Add it to your .env file.")

        if system_instructions:
            self._instructions = system_instructions

        self._intentional_disconnect = False
        self._audio_chunks_sent = 0

        try:
            # Clean up any previous session
            await self._cleanup_session()

            self._session = aiohttp.ClientSession()
            self._ws = await self._session.ws_connect(
                REALTIME_URL,
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "OpenAI-Beta": "realtime=v1",
                },
                heartbeat=20.0,  # keep-alive ping every 20s
            )
            self._connected = True
            print(f"[Realtime] Connected to OpenAI ({REALTIME_MODEL})")

            # Wait for the initial session.created event
            init_msg = await asyncio.wait_for(self._ws.receive(), timeout=10.0)
            if init_msg.type == aiohttp.WSMsgType.TEXT:
                init_data = json.loads(init_msg.data)
                print(f"[Realtime] {init_data.get('type', 'unknown')}")

            # Configure session: text-only output, VAD on, input transcription on
            session_config = {
                "type": "session.update",
                "session": {
                    "modalities": ["text"],
                    "instructions": self._instructions,
                    "input_audio_format": "pcm16",
                    "input_audio_transcription": {
                        "model": "whisper-1",
                        "language": "en",
                    },
                    "turn_detection": {
                        "type": "server_vad",
                        "threshold": 0.3,
                        "prefix_padding_ms": 400,
                        "silence_duration_ms": 700,
                    },
                },
            }
            await self._ws.send_str(json.dumps(session_config))
            print("[Realtime] Session config sent")

            self._listen_task = asyncio.create_task(self._listen_loop())

        except Exception as e:
            print(f"[Realtime] Connection failed: {e}")
            self._connected = False
            await self._cleanup_session()
            raise

    async def send_audio(self, base64_pcm: str):
        """Forward a base64-encoded PCM16 24kHz mono chunk to OpenAI."""
        if not self._connected or not self._ws or self._ws.closed:
            return
        try:
            await self._ws.send_str(json.dumps({
                "type": "input_audio_buffer.append",
                "audio": base64_pcm,
            }))
            self._audio_chunks_sent += 1
            if self._audio_chunks_sent % 100 == 1:
                print(f"[Realtime] Audio chunks sent: {self._audio_chunks_sent} "
                      f"(latest size: {len(base64_pcm)} chars)")
        except Exception as e:
            print(f"[Realtime] send_audio error: {e}")

    async def disconnect(self):
        """Intentionally close the WebSocket and cancel the listener."""
        self._intentional_disconnect = True
        self._connected = False

        if self._listen_task and not self._listen_task.done():
            self._listen_task.cancel()
            try:
                await self._listen_task
            except asyncio.CancelledError:
                pass
            self._listen_task = None

        await self._cleanup_session()
        print("[Realtime] Disconnected (intentional)")

    @property
    def connected(self) -> bool:
        return self._connected

    async def _cleanup_session(self):
        """Close the aiohttp WebSocket and session."""
        if self._ws and not self._ws.closed:
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None

        if self._session and not self._session.closed:
            try:
                await self._session.close()
            except Exception:
                pass
            self._session = None

    # ------------------------------------------------------------------
    # Auto-reconnect
    # ------------------------------------------------------------------

    async def _auto_reconnect(self):
        """Attempt to reconnect to OpenAI after an unexpected disconnect."""
        if self._intentional_disconnect:
            return

        for attempt in range(1, MAX_RECONNECT_ATTEMPTS + 1):
            self._reconnect_count += 1
            print(f"[Realtime] Reconnecting... attempt {attempt}/{MAX_RECONNECT_ATTEMPTS}")

            try:
                await self.on_event({
                    "type": "reconnecting",
                    "attempt": attempt,
                    "max_attempts": MAX_RECONNECT_ATTEMPTS,
                })
            except Exception:
                pass

            await asyncio.sleep(1.5 * attempt)

            try:
                await self.connect()
                print(f"[Realtime] Reconnected successfully (attempt {attempt})")
                try:
                    await self.on_event({"type": "reconnected"})
                except Exception:
                    pass
                return
            except Exception as e:
                print(f"[Realtime] Reconnect attempt {attempt} failed: {e}")

        print("[Realtime] All reconnection attempts exhausted")
        try:
            await self.on_event({
                "type": "error",
                "error": "Connection lost after multiple retries. Please restart AI Assistant.",
            })
        except Exception:
            pass

    # ------------------------------------------------------------------
    # Event listener
    # ------------------------------------------------------------------

    async def _listen_loop(self):
        """Read events from OpenAI and translate them into normalised callbacks."""
        response_text = ""
        heard_text = ""

        try:
            async for msg in self._ws:
                if not self._connected:
                    break

                if msg.type == aiohttp.WSMsgType.ERROR:
                    print(f"[Realtime] WS error: {self._ws.exception()}")
                    break

                if msg.type == aiohttp.WSMsgType.CLOSED:
                    print("[Realtime] WS closed by server")
                    break

                if msg.type != aiohttp.WSMsgType.TEXT:
                    continue

                try:
                    ev = json.loads(msg.data)
                    t = ev.get("type", "")

                    # --- session lifecycle ---
                    if t == "session.updated":
                        sess = ev.get("session", {})
                        mods = sess.get("modalities", [])
                        td = sess.get("turn_detection", {})
                        print(f"[Realtime] Session OK: modalities={mods}, "
                              f"turn_detection={td.get('type', '?')}, "
                              f"silence_ms={td.get('silence_duration_ms', '?')}")

                    # --- VAD speech detection ---
                    elif t == "input_audio_buffer.speech_started":
                        response_text = ""
                        heard_text = ""
                        print("[Realtime] >> Speech started")
                        await self.on_event({"type": "speech_started"})

                    elif t == "input_audio_buffer.speech_stopped":
                        print("[Realtime] << Speech stopped")

                    elif t == "input_audio_buffer.committed":
                        print("[Realtime] Buffer committed")

                    # --- input transcription ---
                    elif t == "conversation.item.input_audio_transcription.completed":
                        transcript = ev.get("transcript", "").strip()
                        if transcript:
                            heard_text = transcript
                            print(f"[Realtime] Heard: \"{transcript}\"")
                            await self.on_event({
                                "type": "heard",
                                "transcript": transcript,
                            })
                        else:
                            print("[Realtime] Transcription empty")

                    elif t == "conversation.item.input_audio_transcription.failed":
                        err = ev.get("error", {})
                        print(f"[Realtime] Transcription FAILED: {err}")

                    # --- response lifecycle ---
                    elif t == "response.created":
                        response_text = ""
                        print(f"[Realtime] Response started (heard so far: \"{heard_text}\")")
                        await self.on_event({
                            "type": "stream_start",
                            "heard": heard_text,
                        })

                    elif t in ("response.text.delta", "response.output_text.delta"):
                        delta = ev.get("delta", "")
                        if delta:
                            response_text += delta
                            await self.on_event({
                                "type": "stream_token",
                                "token": delta,
                            })

                    elif t in ("response.text.done", "response.output_text.done"):
                        pass

                    elif t == "response.done":
                        status = ev.get("response", {}).get("status", "unknown")
                        print(f"[Realtime] Response done: status={status}, "
                              f"text={len(response_text)} chars")
                        await self.on_event({
                            "type": "stream_end",
                            "full_content": response_text,
                            "heard": heard_text,
                        })
                        response_text = ""
                        heard_text = ""

                    # --- errors ---
                    elif t == "error":
                        err = ev.get("error", {})
                        print(f"[Realtime] API ERROR: {json.dumps(err, indent=2)}")
                        await self.on_event({
                            "type": "error",
                            "error": str(err),
                        })

                    # Ignore known noisy lifecycle events
                    elif t in (
                        "response.output_item.added",
                        "response.output_item.done",
                        "response.content_part.added",
                        "response.content_part.done",
                        "conversation.item.created",
                        "conversation.item.added",
                        "conversation.item.done",
                        "rate_limits.updated",
                    ):
                        pass

                    else:
                        print(f"[Realtime] Unhandled: {t}")

                except json.JSONDecodeError:
                    print("[Realtime] Non-JSON message")
                except Exception as inner:
                    print(f"[Realtime] Event error: {inner}")
                    traceback.print_exc()

        except asyncio.CancelledError:
            return  # intentional cancel, don't reconnect
        except Exception as e:
            print(f"[Realtime] Listen loop crashed: {e}")
            traceback.print_exc()
        finally:
            was_connected = self._connected
            self._connected = False

            # Auto-reconnect if the disconnect was unexpected
            if was_connected and not self._intentional_disconnect:
                print("[Realtime] Unexpected disconnect, attempting auto-reconnect...")
                await self._auto_reconnect()
