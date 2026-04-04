"use client";

import {
  X,
  FileText,
  Languages,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  ChevronDown,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRemoteParticipants } from "@livekit/components-react";
import { Track } from "livekit-client";
import { AnimatePresence, motion } from "framer-motion";

interface CaptionEntry {
  id: string;
  text: string;
  original?: string;
  speaker?: string;
  timestamp: number;
}

interface LiveCaptionsOverlayProps {
  mode: "transcription" | "translation";
  onClose: () => void;
}

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "te", name: "Telugu" },
  { code: "ta", name: "Tamil" },
  { code: "bn", name: "Bengali" },
  { code: "kn", name: "Kannada" },
  { code: "ml", name: "Malayalam" },
  { code: "mr", name: "Marathi" },
  { code: "gu", name: "Gujarati" },
  { code: "pa", name: "Punjabi" },
  { code: "od", name: "Odia" },
  { code: "ur", name: "Urdu" },
  { code: "as", name: "Assamese" },
  { code: "ne", name: "Nepali" },
  { code: "mai", name: "Maithili" },
  { code: "doi", name: "Dogri" },
  { code: "kok", name: "Konkani" },
  { code: "mni", name: "Manipuri" },
  { code: "sd", name: "Sindhi" },
  { code: "sa", name: "Sanskrit" },
  { code: "sat", name: "Santali" },
  { code: "ks", name: "Kashmiri" },
  { code: "brx", name: "Bodo" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ar", name: "Arabic" },
];


const MAX_VISIBLE_CAPTIONS = 3;
const CAPTION_LIFETIME_MS = 12000;

export function LiveCaptionsOverlay({ mode, onClose }: LiveCaptionsOverlayProps) {
  const [captions, setCaptions] = useState<CaptionEntry[]>([]);
  const [interimText, setInterimText] = useState("");
  const [isActive, setIsActive] = useState(false);

  // Transcription-specific
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);

  // Translation-specific
  const [targetLanguage, setTargetLanguage] = useState("");
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isWsReady, setIsWsReady] = useState(false);
  const audioEnabledRef = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingStartRef = useRef<string | null>(null);
  const meetingRecorderRef = useRef<MediaRecorder | null>(null);
  const meetingStreamRef = useRef<MediaStream | null>(null);
  const meetingAudioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const captionIdRef = useRef(0);

  const remoteParticipants = useRemoteParticipants();

  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  const genId = () => {
    captionIdRef.current += 1;
    return `cap_${Date.now()}_${captionIdRef.current}`;
  };

  const addCaption = useCallback((text: string, original?: string, speaker?: string) => {
    const entry: CaptionEntry = {
      id: genId(),
      text,
      original,
      speaker,
      timestamp: Date.now(),
    };
    setCaptions((prev) => [...prev.slice(-(MAX_VISIBLE_CAPTIONS * 2)), entry]);
  }, []);

  // Auto-remove old captions
  useEffect(() => {
    const timer = setInterval(() => {
      const cutoff = Date.now() - CAPTION_LIFETIME_MS;
      setCaptions((prev) => prev.filter((c) => c.timestamp > cutoff));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // ==================== TRANSCRIPTION MODE (Web Speech API) ====================
  useEffect(() => {
    if (mode !== "transcription") return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (finalText) {
        addCaption(finalText.trim());
      }
      setInterimText(interim);
    };

    recognition.onerror = () => {};
    recognition.onend = () => {
      if (isListeningRef.current) {
        try {
          recognition.start();
        } catch {
          isListeningRef.current = false;
          setIsActive(false);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      isListeningRef.current = false;
      try {
        recognition.stop();
      } catch { /* ok */ }
    };
  }, [mode, addCaption]);

  const toggleTranscription = () => {
    if (!recognitionRef.current) return;
    if (isActive) {
      isListeningRef.current = false;
      recognitionRef.current.stop();
      setIsActive(false);
      setInterimText("");
    } else {
      isListeningRef.current = true;
      recognitionRef.current.start();
      setIsActive(true);
    }
  };

  // ==================== TRANSLATION MODE (WebSocket) ====================
  useEffect(() => {
    if (mode !== "translation") return;

    const clientId = `caption_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const pythonServerUrl =
      typeof window !== "undefined" && (process.env.NEXT_PUBLIC_PYTHON_API_URL || "").trim() === ""
        ? window.location.origin
        : process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://localhost:5000";
    const wsUrl = `${pythonServerUrl.replace("https", "wss").replace("http", "ws")}/ws/ai-chat/${clientId}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsWsReady(true);
      if (pendingStartRef.current) {
        ws.send(JSON.stringify({ type: "start_translation", target_language: pendingStartRef.current }));
        pendingStartRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "live_translation") {
          addCaption(data.translated, data.original, data.speaker || "Participant");

          if (data.audio && data.has_audio && audioEnabledRef.current) {
            try {
              const audioBlob = new Blob(
                [Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0))],
                { type: "audio/mp3" }
              );
              const audioUrl = URL.createObjectURL(audioBlob);
              const audio = new Audio(audioUrl);
              audio.volume = 1.0;
              audio.play().catch(() => {});
              audio.onended = () => URL.revokeObjectURL(audioUrl);
            } catch { /* audio play error */ }
          }
        }
      } catch { /* parse error */ }
    };

    ws.onclose = () => {
      setIsWsReady(false);
    };

    wsRef.current = ws;

    return () => {
      setIsWsReady(false);
      ws.close();
      wsRef.current = null;
    };
  }, [mode, addCaption]);

  // Audio capture for translation
  const captureMeetingAudio = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    try {
      const audioTracks: MediaStreamTrack[] = [];
      remoteParticipants.forEach((p) => {
        const pub = p.getTrackPublication(Track.Source.Microphone);
        const track = pub?.track?.mediaStreamTrack;
        if (track && track.readyState === "live") audioTracks.push(track);
      });

      if (audioTracks.length === 0) return;

      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        audioContextRef.current = new AudioContext();
      }
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      const ctx = audioContextRef.current;
      const destination = ctx.createMediaStreamDestination();
      audioTracks.forEach((track) => {
        try {
          const src = ctx.createMediaStreamSource(new MediaStream([track]));
          src.connect(destination);
        } catch { /* connect error */ }
      });

      const recordableStream = destination.stream;
      meetingStreamRef.current = recordableStream;

      const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4", ""];
      let selectedMimeType = "";
      for (const mt of mimeTypes) {
        if (mt === "" || MediaRecorder.isTypeSupported(mt)) {
          selectedMimeType = mt;
          break;
        }
      }

      const opts: MediaRecorderOptions = {};
      if (selectedMimeType) opts.mimeType = selectedMimeType;

      const recorder = new MediaRecorder(recordableStream, opts);
      meetingAudioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) meetingAudioChunksRef.current.push(e.data);
      };

      const lang = targetLanguage;
      recorder.onstop = async () => {
        if (meetingAudioChunksRef.current.length === 0) return;
        const blob = new Blob(meetingAudioChunksRef.current, {
          type: selectedMimeType || "audio/webm",
        });
        if (blob.size > 1000) {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              const b64 = (reader.result as string).split(",")[1];
              wsRef.current.send(
                JSON.stringify({ type: "live_translation_audio", data: b64, target_language: lang })
              );
            }
          };
          reader.readAsDataURL(blob);
        }
      };

      meetingRecorderRef.current = recorder;
      recorder.start();
      setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, 2500);
    } catch { /* capture error */ }
  }, [targetLanguage, remoteParticipants]);

  // Translation capture interval
  useEffect(() => {
    if (mode !== "translation" || !isActive || !targetLanguage) return;
    captureMeetingAudio();
    const interval = setInterval(captureMeetingAudio, 3000);
    return () => clearInterval(interval);
  }, [mode, isActive, targetLanguage, captureMeetingAudio]);

  const startTranslation = (langCode: string) => {
    setTargetLanguage(langCode);
    setShowLangPicker(false);
    setIsActive(true);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "start_translation", target_language: langCode }));
    } else {
      pendingStartRef.current = langCode;
    }
  };

  const stopTranslation = () => {
    setIsActive(false);
    setTargetLanguage("");

    if (meetingRecorderRef.current && meetingRecorderRef.current.state !== "inactive") {
      try { meetingRecorderRef.current.stop(); } catch { /* ok */ }
    }
    if (meetingStreamRef.current) {
      meetingStreamRef.current.getTracks().forEach((t) => t.stop());
      meetingStreamRef.current = null;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop_translation" }));
    }
  };

  const toggleTranslation = () => {
    if (isActive) {
      stopTranslation();
    } else {
      setShowLangPicker(true);
    }
  };

  const visibleCaptions = captions.slice(-MAX_VISIBLE_CAPTIONS);
  const langName = SUPPORTED_LANGUAGES.find((l) => l.code === targetLanguage)?.name || targetLanguage;
  const isTranscription = mode === "transcription";

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none">
      {/* Language Picker Modal */}
      {showLangPicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-auto">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-80 max-h-[70vh] shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Languages className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Translate to...</h3>
                <p className="text-xs text-gray-500">Select target language</p>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-0.5 mb-3">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => startTranslation(lang.code)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center justify-between"
                >
                  <span>{lang.name}</span>
                  <span className="text-[10px] text-gray-600 uppercase">{lang.code}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowLangPicker(false)}
              className="w-full py-2 bg-gray-800 text-gray-400 rounded-xl hover:bg-gray-700 text-sm"
            >
              Cancel
            </button>
          </motion.div>
        </div>
      )}

      {/* Captions Area */}
      <div className="px-4 pb-3 space-y-2 flex flex-col items-center">
        <AnimatePresence mode="popLayout">
          {visibleCaptions.map((cap) => (
            <motion.div
              key={cap.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="pointer-events-auto max-w-2xl w-full"
            >
              <div
                className={`px-5 py-3 rounded-2xl backdrop-blur-xl shadow-lg ${
                  isTranscription
                    ? "bg-black/70 border border-amber-500/20"
                    : "bg-black/70 border border-blue-500/20"
                }`}
              >
                {cap.original && (
                  <p className="text-[11px] text-gray-500 italic mb-1 truncate">
                    {cap.speaker && <span className="text-gray-400 not-italic">{cap.speaker}: </span>}
                    {cap.original}
                  </p>
                )}
                <p
                  className={`text-sm font-medium leading-relaxed ${
                    isTranscription ? "text-amber-50" : "text-blue-50"
                  }`}
                >
                  {cap.text}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Interim (live typing) for transcription */}
        {isTranscription && interimText && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            className="pointer-events-auto max-w-2xl w-full"
          >
            <div className="px-5 py-2.5 rounded-2xl bg-black/50 border border-gray-700/40 backdrop-blur-xl">
              <p className="text-sm text-gray-300 italic">{interimText}</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Control Strip */}
      <div className="pointer-events-auto">
        <div
          className={`mx-4 mb-3 flex items-center justify-between px-4 py-2.5 rounded-2xl backdrop-blur-xl shadow-lg ${
            isTranscription
              ? "bg-amber-950/80 border border-amber-500/30"
              : "bg-blue-950/80 border border-blue-500/30"
          }`}
        >
          {/* Left: mode icon + status */}
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isTranscription ? "bg-amber-500/20" : "bg-blue-500/20"
              }`}
            >
              {isTranscription ? (
                <FileText className="w-4 h-4 text-amber-400" />
              ) : (
                <Languages className="w-4 h-4 text-blue-400" />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-white leading-none">
                {isTranscription ? "Live Transcription" : "Live Translation"}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {isActive
                  ? isTranscription
                    ? "Listening..."
                    : `Translating to ${langName}`
                  : "Click Start to begin"}
              </p>
            </div>
            {isActive && (
              <div
                className={`w-2 h-2 rounded-full animate-pulse ${
                  isTranscription ? "bg-amber-400" : "bg-blue-400"
                }`}
              />
            )}
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-2">
            {/* Translation: language selector + volume */}
            {!isTranscription && isActive && (
              <>
                <button
                  onClick={() => setShowLangPicker(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 text-xs transition-colors"
                >
                  {langName}
                  <ChevronDown className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setAudioEnabled(!audioEnabled)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    audioEnabled
                      ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                      : "bg-gray-700 text-gray-500 hover:bg-gray-600"
                  }`}
                >
                  {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              </>
            )}

            {/* Start / Stop */}
            <button
              onClick={isTranscription ? toggleTranscription : toggleTranslation}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : isTranscription
                  ? "bg-amber-500 text-white hover:bg-amber-600"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
            >
              {isTranscription ? (
                isActive ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />
              ) : (
                <Languages className="w-3.5 h-3.5" />
              )}
              {isActive ? "Stop" : "Start"}
            </button>

            {/* Close */}
            <button
              onClick={() => {
                if (isActive) {
                  if (isTranscription) toggleTranscription();
                  else stopTranslation();
                }
                onClose();
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
