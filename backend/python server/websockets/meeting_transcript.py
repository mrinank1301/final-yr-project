"""
Meeting Transcript WebSocket - Always-on background transcription

Runs for the entire duration of a meeting, receiving 5-second audio chunks
from the frontend and transcribing them via Sarvam STT. All transcriptions
are stored in meeting_storage so the post-meeting summary has full context.
"""
import base64
from fastapi import WebSocket, WebSocketDisconnect

from services.ai_service import transcribe_audio
from services.meeting_service import add_transcript_to_meeting, get_or_create_meeting


def _is_duplicate(text: str, prev: str, threshold: float = 0.7) -> bool:
    if not text or not prev:
        return False
    t1, t2 = text.lower().strip(), prev.lower().strip()
    if t1 == t2 or t1 in t2 or t2 in t1:
        return True
    w1, w2 = set(t1.split()), set(t2.split())
    if not w1 or not w2:
        return False
    return (len(w1 & w2) / max(len(w1), len(w2))) >= threshold


async def websocket_meeting_transcript(websocket: WebSocket, room_id: str):
    """
    Lightweight WebSocket that only does: receive audio -> transcribe -> store.
    No LLM calls, no AI responses — just background transcript accumulation.
    """
    await websocket.accept()

    participant_name = "Participant"
    last_text = ""

    get_or_create_meeting(room_id, participant_name)
    print(f"[Transcript] Background transcription started for room {room_id}")

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "set_participant":
                participant_name = data.get("name", "Participant")
                get_or_create_meeting(room_id, participant_name)

            elif msg_type == "audio_chunk":
                audio_b64 = data.get("data", "")
                if not audio_b64:
                    continue

                try:
                    audio_bytes = base64.b64decode(audio_b64)
                    text = await transcribe_audio(audio_bytes)

                    if text and len(text.strip()) > 3:
                        if _is_duplicate(text, last_text):
                            continue
                        last_text = text
                        add_transcript_to_meeting(room_id, text, participant_name)
                except Exception as e:
                    print(f"[Transcript] STT error: {e}")

    except WebSocketDisconnect:
        print(f"[Transcript] Client disconnected from room {room_id}")
    except Exception as e:
        print(f"[Transcript] Error in room {room_id}: {e}")
