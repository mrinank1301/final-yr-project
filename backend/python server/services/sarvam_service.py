"""
Sarvam AI Service — Indian-language Speech-to-Text, Translation, and Text-to-Speech.

Uses the Sarvam REST APIs directly via aiohttp for async, low-latency calls:
  - STT:        POST https://api.sarvam.ai/speech-to-text-translate  (Saaras v3)
  - Translate:  POST https://api.sarvam.ai/translate                 (Sarvam-Translate v1)
  - TTS:        POST https://api.sarvam.ai/text-to-speech            (Bulbul v3)
"""

import io
import base64
import aiohttp
from typing import Optional, Tuple

from config import SARVAM_API_KEY, SARVAM_LANGUAGE_MAP, SARVAM_TTS_LANGUAGES

_SARVAM_BASE = "https://api.sarvam.ai"

# Reusable session (connection-pooled)
_session: Optional[aiohttp.ClientSession] = None


async def _get_session() -> aiohttp.ClientSession:
    global _session
    if _session is None or _session.closed:
        _session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(limit=10, keepalive_timeout=30),
        )
    return _session


def _to_sarvam_code(lang: str) -> str:
    """Convert an ISO 639-1 code (e.g. 'hi') or BCP-47 code (e.g. 'hi-IN') to Sarvam format."""
    if lang in SARVAM_LANGUAGE_MAP:
        return SARVAM_LANGUAGE_MAP[lang]
    if lang.endswith("-IN"):
        return lang
    return SARVAM_LANGUAGE_MAP.get(lang, "en-IN")


# ---------------------------------------------------------------------------
# Speech-to-Text (Saaras v3)
# ---------------------------------------------------------------------------

async def sarvam_transcribe(audio_data: bytes, language: str = None) -> str:
    """
    Transcribe audio using Sarvam STT (Saaras v3).
    Uses the /speech-to-text endpoint with mode=transcribe.
    Accepts WebM, WAV, MP3, OGG, etc.
    Returns transcription text or empty string on failure.
    """
    if not SARVAM_API_KEY:
        print("[Sarvam STT] ERROR: SARVAM_API_KEY not configured")
        return ""

    try:
        session = await _get_session()
        form = aiohttp.FormData()
        form.add_field(
            "file",
            io.BytesIO(audio_data),
            filename="audio.webm",
            content_type="audio/webm",
        )
        form.add_field("model", "saaras:v3")
        form.add_field("mode", "transcribe")

        if language:
            sarvam_lang = _to_sarvam_code(language)
            form.add_field("language_code", sarvam_lang)

        headers = {"api-subscription-key": SARVAM_API_KEY}

        print(f"[Sarvam STT] Transcribing {len(audio_data)} bytes (lang={language or 'auto'})...")
        async with session.post(
            f"{_SARVAM_BASE}/speech-to-text",
            data=form,
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                transcript = data.get("transcript", "").strip()
                detected = data.get("language_code", "unknown")
                if transcript and len(transcript) > 2:
                    print(f"[Sarvam STT] OK ({detected}): {transcript[:80]}")
                    return transcript
                print("[Sarvam STT] Empty/short transcript filtered")
                return ""
            else:
                err = await resp.text()
                print(f"[Sarvam STT] HTTP {resp.status}: {err[:200]}")
                return ""

    except Exception as e:
        print(f"[Sarvam STT] Exception: {e}")
        return ""


# ---------------------------------------------------------------------------
# Text Translation (Sarvam-Translate v1)
# ---------------------------------------------------------------------------

async def sarvam_translate(
    text: str,
    target_language: str,
    source_language: str = "auto",
) -> str:
    """
    Translate text via Sarvam Translate API.
    source_language can be 'auto' for auto-detection.
    Returns translated text, or original text on failure.
    """
    if not SARVAM_API_KEY:
        print("[Sarvam Translate] ERROR: SARVAM_API_KEY not configured")
        return text

    if not text or len(text.strip()) < 2:
        return ""

    try:
        session = await _get_session()
        target_code = _to_sarvam_code(target_language)
        source_code = "auto" if source_language == "auto" else _to_sarvam_code(source_language)

        payload = {
            "input": text,
            "source_language_code": source_code,
            "target_language_code": target_code,
            "model": "sarvam-translate:v1",
            "enable_preprocessing": True,
        }
        headers = {
            "api-subscription-key": SARVAM_API_KEY,
            "Content-Type": "application/json",
        }

        try:
            print(f"[Sarvam Translate] {source_code} -> {target_code}: '{text[:40]}...'")
        except UnicodeEncodeError:
            print(f"[Sarvam Translate] {source_code} -> {target_code}: [non-ASCII input]")

        async with session.post(
            f"{_SARVAM_BASE}/translate",
            json=payload,
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                translated = data.get("translated_text", "").strip()
                if translated:
                    print(f"[Sarvam Translate] OK: {len(translated)} chars")
                    return translated
                return text
            else:
                err = await resp.text()
                print(f"[Sarvam Translate] HTTP {resp.status}: {err[:200]}")
                return text

    except Exception as e:
        print(f"[Sarvam Translate] Exception: {e}")
        return text


# ---------------------------------------------------------------------------
# Text-to-Speech (Bulbul v3)
# ---------------------------------------------------------------------------

async def sarvam_tts(text: str, language: str = "en") -> Optional[bytes]:
    """
    Convert text to speech using Sarvam Bulbul TTS.
    Returns MP3 audio bytes or None on failure.
    Only supports Sarvam TTS-supported languages; returns None otherwise.
    """
    if not SARVAM_API_KEY:
        print("[Sarvam TTS] ERROR: SARVAM_API_KEY not configured")
        return None

    if not text or len(text.strip()) < 1:
        return None

    lang_code = _to_sarvam_code(language)
    if lang_code not in SARVAM_TTS_LANGUAGES:
        print(f"[Sarvam TTS] Language {lang_code} not supported for TTS")
        return None

    try:
        session = await _get_session()
        payload = {
            "inputs": [text],
            "target_language_code": lang_code,
            "speaker": "priya",
            "model": "bulbul:v3",
            "pitch": 0,
            "pace": 1.15,
            "loudness": 1.5,
            "speech_sample_rate": 16000,
            "enable_preprocessing": True,
        }
        headers = {
            "api-subscription-key": SARVAM_API_KEY,
            "Content-Type": "application/json",
        }

        print(f"[Sarvam TTS] Generating speech for {lang_code} ({len(text)} chars)...")
        async with session.post(
            f"{_SARVAM_BASE}/text-to-speech",
            json=payload,
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                audios = data.get("audios")
                if audios and len(audios) > 0:
                    audio_bytes = base64.b64decode(audios[0])
                    print(f"[Sarvam TTS] OK: {len(audio_bytes)} bytes")
                    return audio_bytes
                print("[Sarvam TTS] No audio in response")
                return None
            else:
                err = await resp.text()
                print(f"[Sarvam TTS] HTTP {resp.status}: {err[:200]}")
                return None

    except Exception as e:
        print(f"[Sarvam TTS] Exception: {e}")
        return None


# ---------------------------------------------------------------------------
# Combined: Translate + Speak
# ---------------------------------------------------------------------------

async def sarvam_translate_and_speak(
    text: str,
    target_language: str,
    source_language: str = "auto",
) -> Tuple[str, Optional[bytes]]:
    """
    Translate text then generate TTS audio.
    Returns (translated_text, audio_bytes_or_None).
    """
    translated = await sarvam_translate(text, target_language, source_language)
    if not translated:
        return ("", None)

    audio = await sarvam_tts(translated, target_language)
    return (translated, audio)
