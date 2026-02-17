"use client";

import { Bot, X, Send, Mic, MicOff, Loader2, Volume2, VolumeX, Radio, Headphones, Languages, Zap } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRemoteParticipants } from "@livekit/components-react";
import { Track } from "livekit-client";

interface Message {
  id: string;
  role: "user" | "assistant" | "meeting" | "translation";
  content: string;
  isTranscription?: boolean;
  speaker?: string;
  originalText?: string;
  targetLanguage?: string;
}

interface AISidebarProps {
  onClose: () => void;
}

// Supported languages for translation
const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "te", name: "Telugu" },
  { code: "ta", name: "Tamil" },
  { code: "bn", name: "Bengali" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "tr", name: "Turkish" },
  { code: "vi", name: "Vietnamese" },
  { code: "th", name: "Thai" },
];

// ---------------------------------------------------------------------------
// Audio utility functions (PCM conversion for OpenAI Realtime API)
// ---------------------------------------------------------------------------

/**
 * Downsample a Float32Array from fromRate to toRate using linear interpolation.
 * Used to convert browser's native 48kHz to OpenAI's required 24kHz.
 */
function downsampleTo24k(buffer: Float32Array, fromRate: number): Float32Array {
  const toRate = 24000;
  if (fromRate === toRate) return buffer;
  const ratio = fromRate / toRate;
  const newLen = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const srcIdx = i * ratio;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, buffer.length - 1);
    const frac = srcIdx - lo;
    result[i] = buffer[lo] * (1 - frac) + buffer[hi] * frac;
  }
  return result;
}

/**
 * Convert Float32 PCM → Int16 PCM → base64 string.
 * OpenAI Realtime API expects little-endian PCM16.
 */
function float32ToPCM16Base64(float32: Float32Array): string {
  const buf = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    // Write as little-endian Int16 explicitly (guarantees byte order)
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AISidebar({ onClose }: AISidebarProps) {
  // Tab system: AI Assistant and Translation have separate message histories
  const [currentTab, setCurrentTab] = useState<'ai' | 'translation'>('ai');
  const [aiMessages, setAiMessages] = useState<Message[]>([]);
  const [translationMessages, setTranslationMessages] = useState<Message[]>([]);

  const [inputText, setInputText] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListeningToMeeting, setIsListeningToMeeting] = useState(false);
  
  // Streaming state - for real-time token-by-token display
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingHeard, setStreamingHeard] = useState("");
  const streamingContentRef = useRef<string>("");
  const streamingPrefixRef = useRef<string>("");
  
  // Live Translation state
  const [isLiveTranslating, setIsLiveTranslating] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<string>("");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const audioEnabledRef = useRef(true);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const meetingRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const meetingAudioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const clientIdRef = useRef<string>("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const meetingStreamRef = useRef<MediaStream | null>(null);
  const messageIdCounter = useRef<number>(0);
  
  // Token batching for smoother rendering
  const tokenBatchRef = useRef<string>("");
  const tokenFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // PCM streaming refs (AI Assistant mode — OpenAI Realtime API)
  // Every Web Audio node must be stored in a ref to prevent garbage collection
  const pcmAudioCtxRef = useRef<AudioContext | null>(null);
  const pcmProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmSourceNodesRef = useRef<MediaStreamAudioSourceNode[]>([]);
  const pcmGainRef = useRef<GainNode | null>(null);
  const isStreamingPCMRef = useRef(false);
  
  const generateMessageId = () => {
    messageIdCounter.current += 1;
    return `msg_${Date.now()}_${messageIdCounter.current}`;
  };

  const remoteParticipants = useRemoteParticipants();

  // Derive which messages to show based on current tab
  const messages = currentTab === 'ai' ? aiMessages : translationMessages;

  // Scroll to bottom when new messages arrive or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages, translationMessages, streamingContent]);

  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  // ------------------------------------------------------------------
  // PCM streaming for AI Assistant (OpenAI Realtime API)
  // ------------------------------------------------------------------

  /** Tear down ScriptProcessorNode and associated audio graph. */
  const stopPCMStreaming = useCallback(() => {
    isStreamingPCMRef.current = false;

    if (pcmProcessorRef.current) {
      try { pcmProcessorRef.current.disconnect(); } catch { /* ok */ }
      pcmProcessorRef.current.onaudioprocess = null;
      pcmProcessorRef.current = null;
    }
    pcmSourceNodesRef.current.forEach((src) => {
      try { src.disconnect(); } catch { /* ok */ }
    });
    pcmSourceNodesRef.current = [];
    if (pcmGainRef.current) {
      try { pcmGainRef.current.disconnect(); } catch { /* ok */ }
      pcmGainRef.current = null;
    }
    if (pcmAudioCtxRef.current && pcmAudioCtxRef.current.state !== "closed") {
      pcmAudioCtxRef.current.close().catch(() => {});
      pcmAudioCtxRef.current = null;
    }
    console.log("[PCM] Streaming stopped, all nodes cleaned up");
  }, []);

  /**
   * Set up continuous PCM16 24kHz mono audio streaming from remote
   * participant tracks to the backend via WebSocket.
   *
   * Pipeline (simplified for reliability):
   *   participant tracks → source nodes → ScriptProcessor → silent gain → destination
   *   (multiple sources mix automatically at the processor input)
   *
   * Key: Always use browser's NATIVE sample rate (48kHz) and resample
   * to 24kHz in JavaScript. Do NOT create AudioContext at 24kHz — it
   * causes garbled audio when WebRTC tracks at 48kHz are connected.
   */
  const startPCMStreaming = useCallback(async () => {
    stopPCMStreaming();

    const audioTracks: MediaStreamTrack[] = [];
    remoteParticipants.forEach((participant) => {
      const pub = participant.getTrackPublication(Track.Source.Microphone);
      const track = pub?.track?.mediaStreamTrack;
      if (track && track.readyState === "live") {
        audioTracks.push(track);
      }
    });

    if (audioTracks.length === 0) {
      console.warn("[PCM] No remote audio tracks available");
      return;
    }

    // Always use browser's native sample rate (usually 48kHz).
    // We resample to 24kHz ourselves — this is MORE reliable than
    // asking the browser to resample WebRTC tracks.
    const ctx = new AudioContext();
    pcmAudioCtxRef.current = ctx;

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const nativeSR = ctx.sampleRate;
    console.log(`[PCM] AudioContext sample rate: ${nativeSR}Hz`);

    // ScriptProcessor: 4096 samples at 48kHz ≈ 85ms, mono in, mono out
    const processor = ctx.createScriptProcessor(4096, 1, 1);

    // Connect ALL participant tracks directly to the processor.
    // Web Audio mixes multiple inputs automatically.
    const sourceNodes: MediaStreamAudioSourceNode[] = [];
    audioTracks.forEach((track) => {
      try {
        const src = ctx.createMediaStreamSource(new MediaStream([track]));
        src.connect(processor);
        sourceNodes.push(src);
      } catch (e) {
        console.warn("[PCM] Could not connect track:", e);
      }
    });
    pcmSourceNodesRef.current = sourceNodes;

    // ScriptProcessor must be connected to ctx.destination to fire.
    // Use a silent GainNode so we don't play audio twice.
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;
    processor.connect(silentGain);
    silentGain.connect(ctx.destination);

    pcmGainRef.current = silentGain;
    pcmProcessorRef.current = processor;

    let chunkCount = 0;

    processor.onaudioprocess = (e) => {
      if (!isStreamingPCMRef.current) return;
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      const raw = e.inputBuffer.getChannelData(0);

      // Always resample from native rate to 24kHz
      const samples24k = downsampleTo24k(raw, nativeSR);

      // Convert to PCM16 little-endian and base64 encode
      const b64 = float32ToPCM16Base64(samples24k);

      wsRef.current.send(JSON.stringify({
        type: "audio_stream",
        data: b64,
      }));

      chunkCount++;
      // Log periodically + audio level for debugging
      if (chunkCount % 60 === 1) {
        let maxAmp = 0;
        for (let i = 0; i < raw.length; i++) {
          const a = Math.abs(raw[i]);
          if (a > maxAmp) maxAmp = a;
        }
        console.log(`[PCM] chunk #${chunkCount}, peak=${maxAmp.toFixed(4)}, ` +
          `in=${raw.length}@${nativeSR} -> out=${samples24k.length}@24000`);
      }
    };

    isStreamingPCMRef.current = true;
    console.log(`[PCM] Streaming: ${sourceNodes.length} track(s), ${nativeSR}Hz -> 24kHz`);
  }, [remoteParticipants, stopPCMStreaming]);

  // Start / stop PCM streaming when AI Assistant mode toggles
  useEffect(() => {
    if (isListeningToMeeting && isConnected) {
      startPCMStreaming();
    } else {
      stopPCMStreaming();
    }
    return () => {
      stopPCMStreaming();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListeningToMeeting, isConnected, startPCMStreaming]);

  // Full cleanup function (only for unmount)
  const cleanupAllModes = useCallback(() => {
    setIsListeningToMeeting(false);
    setIsLiveTranslating(false);
    setTargetLanguage("");
    setIsStreaming(false);
    setStreamingContent("");
    setStreamingHeard("");
    streamingContentRef.current = "";
    
    if (tokenFlushTimerRef.current) {
      clearTimeout(tokenFlushTimerRef.current);
      tokenFlushTimerRef.current = null;
    }

    // Stop PCM streaming
    stopPCMStreaming();
    
    if (meetingRecorderRef.current && meetingRecorderRef.current.state !== "inactive") {
      try {
        meetingRecorderRef.current.stop();
      } catch {
        // Ignore errors during cleanup
      }
    }
    
    if (meetingStreamRef.current) {
      meetingStreamRef.current.getTracks().forEach(track => track.stop());
      meetingStreamRef.current = null;
    }
  }, [stopPCMStreaming]);

  // Connect to WebSocket
  useEffect(() => {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    clientIdRef.current = clientId;
    
    const pythonServerUrl =
      typeof window !== "undefined" && (process.env.NEXT_PUBLIC_PYTHON_API_URL || "").trim() === ""
        ? window.location.origin
        : process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://localhost:5000";
    const wsUrl = `${pythonServerUrl.replace('https', 'wss').replace('http', 'ws')}/ws/ai-chat/${clientId}`;
    
    const connectWebSocket = () => {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log("Connected to AI chat (hybrid realtime mode)");
        setIsConnected(true);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            // ====== STREAMING TOKEN MESSAGES ======
            case "stream_start":
              setIsStreaming(true);
              setIsTyping(false);
              setIsProcessing(false);
              streamingPrefixRef.current = data.prefix || "";
              streamingContentRef.current = data.prefix || "";
              tokenBatchRef.current = "";
              setStreamingContent(data.prefix || "");
              setStreamingHeard(data.heard || "");
              break;
              
            case "stream_token":
              tokenBatchRef.current += data.token;
              if (tokenFlushTimerRef.current) {
                clearTimeout(tokenFlushTimerRef.current);
              }
              tokenFlushTimerRef.current = setTimeout(() => {
                if (tokenBatchRef.current) {
                  streamingContentRef.current += tokenBatchRef.current;
                  setStreamingContent(streamingContentRef.current);
                  tokenBatchRef.current = "";
                }
              }, 30);
              break;
              
            case "stream_end": {
              if (tokenFlushTimerRef.current) {
                clearTimeout(tokenFlushTimerRef.current);
                tokenFlushTimerRef.current = null;
              }
              if (tokenBatchRef.current) {
                streamingContentRef.current += tokenBatchRef.current;
                tokenBatchRef.current = "";
              }
              
              const heardText = data.heard || "";
              const isQ = data.is_question || false;
              
              setIsStreaming(false);
              setStreamingContent("");
              setStreamingHeard("");
              streamingContentRef.current = "";
              streamingPrefixRef.current = "";
              
              const finalContent = heardText
                ? `**${isQ ? "Q" : "Heard"}:** *${heardText}*\n\n${data.full_content}`
                : data.full_content;
              
              // AI responses always go to the AI tab
              setAiMessages((prev) => [
                ...prev,
                {
                  id: generateMessageId(),
                  role: "assistant",
                  content: finalContent,
                },
              ]);
              break;
            }

            // ====== REALTIME API EVENTS (AI Assistant) ======
            case "heard":
              setStreamingHeard(data.transcript || "");
              break;

            case "speech_started":
              break;
              
            // ====== REGULAR MESSAGES ======
            case "message":
              // Welcome / general messages go to AI tab
              setAiMessages((prev) => [
                ...prev,
                {
                  id: generateMessageId(),
                  role: data.role,
                  content: data.content,
                },
              ]);
              break;
              
            case "transcription":
              setAiMessages((prev) => [
                ...prev,
                {
                  id: generateMessageId(),
                  role: "user",
                  content: data.content,
                  isTranscription: true,
                },
              ]);
              break;
              
            case "live_transcription":
              setAiMessages((prev) => [
                ...prev,
                {
                  id: generateMessageId(),
                  role: "meeting",
                  content: data.content,
                  speaker: data.speaker || "Participant",
                  isTranscription: true,
                },
              ]);
              break;
              
            case "live_translation":
              // Translation messages go to the Translation tab
              setTranslationMessages((prev) => [
                ...prev,
                {
                  id: generateMessageId(),
                  role: "translation",
                  content: data.translated,
                  originalText: data.original,
                  targetLanguage: data.target_language,
                  speaker: data.speaker || "Participant",
                  isTranscription: true,
                },
              ]);
              
              if (data.audio && data.has_audio && audioEnabledRef.current) {
                try {
                  const audioBlob = new Blob(
                    [Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))],
                    { type: 'audio/mp3' }
                  );
                  const audioUrl = URL.createObjectURL(audioBlob);
                  const audio = new Audio(audioUrl);
                  audio.volume = 1.0;
                  audio.play().catch(e => console.error('Audio playback error:', e));
                  audio.onended = () => URL.revokeObjectURL(audioUrl);
                } catch (e) {
                  console.error('Error playing translation audio:', e);
                }
              }
              break;
              
            case "typing":
              setIsTyping(data.status);
              break;
              
            case "status":
              if (data.status === "transcribing") {
                setIsProcessing(true);
              }
              break;
              
            case "error":
              // Errors go to AI tab (most common source)
              setAiMessages((prev) => [
                ...prev,
                {
                  id: generateMessageId(),
                  role: "assistant",
                  content: data.content,
                },
              ]);
              setIsProcessing(false);
              setIsStreaming(false);
              break;
              
            case "cleared":
              setAiMessages([]);
              setTranslationMessages([]);
              setIsStreaming(false);
              setStreamingContent("");
              setStreamingHeard("");
              break;
          }
          
          if (data.type === "message" || data.type === "error") {
            setIsTyping(false);
            setIsProcessing(false);
          }
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      };
      
      ws.onclose = () => {
        console.log("Disconnected from AI chat");
        if (mountedRef.current) setIsConnected(false);
        if (mountedRef.current) {
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
        }
      };
      
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
      
      wsRef.current = ws;
    };
    
    mountedRef.current = true;
    connectWebSocket();

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      cleanupAllModes();
    };
  }, [cleanupAllModes]);

  // ------------------------------------------------------------------
  // Translation mode: chunked MediaRecorder capture (unchanged)
  // ------------------------------------------------------------------

  const captureMeetingAudio = useCallback(async () => {
    if (!isLiveTranslating || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const audioTracks: MediaStreamTrack[] = [];
      
      remoteParticipants.forEach((participant) => {
        const audioTrack = participant.getTrackPublication(Track.Source.Microphone);
        const track = audioTrack?.track?.mediaStreamTrack;
        
        if (track && track.readyState === "live") {
          audioTracks.push(track);
        }
      });

      if (audioTracks.length === 0) {
        return;
      }

      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        audioContextRef.current = new AudioContext();
      }
      
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }
      
      const audioContext = audioContextRef.current;
      const destination = audioContext.createMediaStreamDestination();
      
      audioTracks.forEach((track) => {
        try {
          const sourceStream = new MediaStream([track]);
          const source = audioContext.createMediaStreamSource(sourceStream);
          source.connect(destination);
        } catch (e) {
          console.warn(`[Audio] Failed to connect track:`, e);
        }
      });
      
      const recordableStream = destination.stream;
      meetingStreamRef.current = recordableStream;

      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
        ""
      ];
      
      let selectedMimeType = "";
      for (const mimeType of mimeTypes) {
        if (mimeType === "" || MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      const recorderOptions: MediaRecorderOptions = {};
      if (selectedMimeType) {
        recorderOptions.mimeType = selectedMimeType;
      }
      
      const mediaRecorder = new MediaRecorder(recordableStream, recorderOptions);

      meetingAudioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          meetingAudioChunksRef.current.push(event.data);
        }
      };

      const currentTargetLang = targetLanguage;

      mediaRecorder.onstop = async () => {
        if (meetingAudioChunksRef.current.length === 0) return;
        
        const blobType = selectedMimeType || "audio/webm";
        const audioBlob = new Blob(meetingAudioChunksRef.current, { type: blobType });
        
        if (audioBlob.size > 1000) {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              const base64Audio = (reader.result as string).split(",")[1];
              wsRef.current.send(JSON.stringify({
                type: "live_translation_audio",
                data: base64Audio,
                target_language: currentTargetLang,
              }));
            }
          };
          reader.readAsDataURL(audioBlob);
        }
      };

      meetingRecorderRef.current = mediaRecorder;
      mediaRecorder.start();

      // 2.5s chunks for translation
      setTimeout(() => {
        if (mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        }
      }, 2500);

    } catch (error) {
      console.error("Error capturing audio:", error);
    }
  }, [isLiveTranslating, targetLanguage, remoteParticipants]);

  // Interval for translation mode only
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (isLiveTranslating && isConnected) {
      captureMeetingAudio();
      intervalId = setInterval(captureMeetingAudio, 3000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isLiveTranslating, isConnected, captureMeetingAudio]);

  const stopRecorderOnly = useCallback(() => {
    if (meetingRecorderRef.current && meetingRecorderRef.current.state !== "inactive") {
      try {
        meetingRecorderRef.current.stop();
      } catch (e) {
        console.warn("Error stopping recorder:", e);
      }
    }
    if (meetingStreamRef.current) {
      meetingStreamRef.current.getTracks().forEach(track => track.stop());
      meetingStreamRef.current = null;
    }
  }, []);

  // ==================== AI Assistant Mode ====================
  const toggleMeetingListening = () => {
    if (isListeningToMeeting) {
      stopMeetingListening();
    } else {
      startMeetingListening();
    }
  };

  const startMeetingListening = () => {
    stopRecorderOnly();
    setIsLiveTranslating(false);
    
    setIsListeningToMeeting(true);
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "start_listening",
      }));
    }
    
    setCurrentTab('ai');
    setAiMessages((prev) => [
      ...prev,
      {
        id: generateMessageId(),
        role: "assistant",
        content: remoteParticipants.length > 0 
          ? `**AI Assistant Active (Realtime)**\n\nStreaming audio from ${remoteParticipants.length} participant(s) directly to AI. Responses appear as they speak.`
          : `**No Other Participants Yet**\n\nI need another person in the call to listen to.\n\n- Open this room in another browser/tab\n- Or invite someone to join\n- Make sure they enable their microphone`,
      },
    ]);
  };

  const stopMeetingListening = useCallback(() => {
    stopPCMStreaming();
    stopRecorderOnly();
    setIsListeningToMeeting(false);
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "stop_listening",
      }));
    }
  }, [stopPCMStreaming, stopRecorderOnly]);

  // ==================== Live Translation Mode ====================
  const toggleLiveTranslation = () => {
    if (isLiveTranslating) {
      stopLiveTranslation();
    } else {
      setShowLanguageSelector(true);
    }
  };

  const startLiveTranslation = (selectedLanguage: string) => {
    stopRecorderOnly();
    stopPCMStreaming();
    setIsListeningToMeeting(false);
    
    setTargetLanguage(selectedLanguage);
    setIsLiveTranslating(true);
    setShowLanguageSelector(false);
    
    const langName = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.name || selectedLanguage;
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "start_translation",
        target_language: selectedLanguage,
      }));
    }
    
    setCurrentTab('translation');
    setTranslationMessages((prev) => [
      ...prev,
      {
        id: generateMessageId(),
        role: "assistant",
        content: remoteParticipants.length > 0 
          ? `**Live Translation Active!**\n\nTranslating to **${langName}** from ${remoteParticipants.length} participant(s).`
          : `**No Other Participants Yet**\n\nI need another person in the call to translate.\n\n- Open this room in another browser/tab\n- Or invite someone to join\n- Make sure they enable their microphone`,
      },
    ]);
  };

  const stopLiveTranslation = useCallback(() => {
    stopRecorderOnly();
    setIsLiveTranslating(false);
    setTargetLanguage("");
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "stop_translation",
      }));
    }
  }, [stopRecorderOnly]);

  // Send text message (always goes to AI tab)
  const sendMessage = useCallback(() => {
    if (!inputText.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    
    setCurrentTab('ai');
    setAiMessages((prev) => [
      ...prev,
      {
        id: generateMessageId(),
        role: "user",
        content: inputText,
      },
    ]);
    
    wsRef.current.send(JSON.stringify({
      type: "text",
      content: inputText,
    }));
    
    setInputText("");
  }, [inputText]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Start recording (personal mic)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
        ""
      ];
      
      let selectedMimeType = "";
      for (const mimeType of mimeTypes) {
        if (mimeType === "" || MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }
      
      const recorderOptions: MediaRecorderOptions = {};
      if (selectedMimeType) {
        recorderOptions.mimeType = selectedMimeType;
      }
      
      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const blobType = selectedMimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
        
        const reader = new FileReader();
        reader.onloadend = () => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const base64Audio = (reader.result as string).split(",")[1];
            wsRef.current.send(JSON.stringify({
              type: "audio",
              data: base64Audio,
            }));
            setIsProcessing(true);
          }
        };
        reader.readAsDataURL(audioBlob);
        
        stream.getTracks().forEach((track) => track.stop());
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Could not access microphone. Please grant permission and try again.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const getStatusText = () => {
    if (!isConnected) return "Reconnecting...";
    if (isStreaming) return "Streaming response...";
    if (isListeningToMeeting) return "AI Assistant Active (Realtime)";
    if (isLiveTranslating) {
      const langName = SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)?.name || targetLanguage;
      return `Translating to ${langName}`;
    }
    return "Connected";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Language Selector Modal */}
      {showLanguageSelector && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <Languages className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white">Select Language</h3>
                <p className="text-xs text-gray-400">Choose your preferred language</p>
              </div>
            </div>
            
            <div className="max-h-64 overflow-y-auto space-y-1 mb-4">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => startLiveTranslation(lang.code)}
                  className="w-full text-left px-4 py-2.5 rounded-lg text-sm text-gray-200 hover:bg-gray-800 hover:text-white transition-colors flex items-center justify-between group"
                >
                  <span>{lang.name}</span>
                  <span className="text-xs text-gray-500 group-hover:text-gray-400">{lang.code.toUpperCase()}</span>
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setShowLanguageSelector(false)}
              className="w-full py-2.5 px-4 bg-gray-800 text-gray-300 rounded-xl hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-white">AI Meeting Hub</h3>
              {isStreaming && (
                <Zap className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${
                isStreaming ? "bg-yellow-400 animate-pulse" : 
                isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"
              }`} />
              <span className="text-xs text-gray-400">{getStatusText()}</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-gray-800 bg-gray-900/80">
        <button
          onClick={() => setCurrentTab('ai')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2 ${
            currentTab === 'ai'
              ? 'border-emerald-400 text-emerald-400 bg-emerald-500/5'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          <Headphones className="w-3.5 h-3.5" />
          AI Assistant
          {isListeningToMeeting && (
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>
        <button
          onClick={() => setCurrentTab('translation')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2 ${
            currentTab === 'translation'
              ? 'border-blue-400 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          <Languages className="w-3.5 h-3.5" />
          Translation
          {isLiveTranslating && (
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          )}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-900 to-gray-950">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-8">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500/20 to-indigo-600/20 rounded-2xl flex items-center justify-center mb-4">
              {currentTab === 'ai' ? (
                <Headphones className="w-8 h-8 text-emerald-400" />
              ) : (
                <Languages className="w-8 h-8 text-blue-400" />
              )}
            </div>
            {currentTab === 'ai' ? (
              <>
                <p className="text-sm mb-2">AI Assistant</p>
                <p className="text-xs text-gray-500 max-w-xs">
                  Click <strong className="text-emerald-400">Start</strong> below to stream audio directly to AI. Get real-time answers as participants speak.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm mb-2">Live Translation</p>
                <p className="text-xs text-gray-500 max-w-xs">
                  Click <strong className="text-blue-400">Start</strong> below and choose a language. Speech will be translated and spoken in real-time.
                </p>
              </>
            )}
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                message.role === "assistant"
                  ? "bg-gradient-to-br from-violet-500/30 to-indigo-600/30"
                  : message.role === "meeting"
                  ? "bg-gradient-to-br from-emerald-500/30 to-teal-600/30"
                  : message.role === "translation"
                  ? "bg-gradient-to-br from-blue-500/30 to-cyan-500/30"
                  : "bg-gradient-to-br from-blue-500 to-blue-600"
              }`}
            >
              {message.role === "assistant" ? (
                <Bot className="w-4 h-4 text-indigo-400" />
              ) : message.role === "meeting" ? (
                <Radio className="w-4 h-4 text-emerald-400" />
              ) : message.role === "translation" ? (
                <Languages className="w-4 h-4 text-cyan-400" />
              ) : message.isTranscription ? (
                <Volume2 className="w-4 h-4 text-white" />
              ) : (
                <span className="text-xs font-bold text-white">ME</span>
              )}
            </div>
            <div
              className={`p-3 rounded-2xl text-sm max-w-[85%] ${
                message.role === "assistant"
                  ? "bg-gray-800/80 text-gray-200 rounded-tl-none border border-gray-700/50 backdrop-blur-sm"
                  : message.role === "meeting"
                  ? "bg-emerald-900/30 text-emerald-100 rounded-tl-none border border-emerald-700/30 backdrop-blur-sm"
                  : message.role === "translation"
                  ? "bg-blue-900/30 text-blue-100 rounded-tl-none border border-blue-700/30 backdrop-blur-sm"
                  : "bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-tr-none shadow-lg shadow-blue-500/20"
              }`}
            >
              {message.role === "meeting" && message.speaker && (
                <span className="text-xs text-emerald-300 opacity-70 block mb-1">
                  {message.speaker}:
                </span>
              )}
              {message.role === "translation" && (
                <>
                  <span className="text-xs text-blue-300 opacity-70 block mb-1">
                    {message.speaker} {"->"} {SUPPORTED_LANGUAGES.find(l => l.code === message.targetLanguage)?.name || message.targetLanguage}:
                  </span>
                  {message.originalText && (
                    <div className="text-xs text-blue-300/50 italic mb-2 pb-2 border-b border-blue-700/30">
                      Original: {message.originalText}
                    </div>
                  )}
                </>
              )}
              {message.isTranscription && message.role === "user" && (
                <span className="text-xs text-blue-200 opacity-70 block mb-1">Voice message:</span>
              )}
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          </div>
        ))}
        
        {/* ====== STREAMING MESSAGE - Real-time token display ====== */}
        {isStreaming && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500/30 to-indigo-600/30 rounded-full flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="p-3 rounded-2xl rounded-tl-none text-sm max-w-[85%] bg-gray-800/80 text-gray-200 border border-indigo-500/30 backdrop-blur-sm">
              {streamingHeard && (
                <div className="text-xs text-gray-400 italic mb-2 pb-1.5 border-b border-gray-700/50">
                  Heard: &ldquo;{streamingHeard}&rdquo;
                </div>
              )}
              <div className="whitespace-pre-wrap">
                {streamingContent || ""}
                <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse ml-0.5 align-middle rounded-sm" />
              </div>
            </div>
          </div>
        )}
        
        {/* Typing/Processing indicator (shown when not streaming) */}
        {(isTyping || isProcessing) && !isStreaming && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500/30 to-indigo-600/30 rounded-full flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="bg-gray-800/80 border border-gray-700/50 p-3 rounded-2xl rounded-tl-none backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                <span className="text-sm text-gray-400">
                  {isProcessing ? "Processing audio..." : "AI is thinking..."}
                </span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-gray-800 bg-gray-900 space-y-3">
        {/* ===== AI TAB CONTROLS ===== */}
        {currentTab === 'ai' && (
          <>
            {/* Active status */}
            {isListeningToMeeting && (
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full animate-pulse bg-emerald-400" />
                  <span className="text-xs font-medium text-emerald-400">
                    Realtime AI Streaming
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {remoteParticipants.length > 0 ? `${remoteParticipants.length} participant(s)` : 'No participants'}
                </span>
              </div>
            )}

            {/* Recording indicator */}
            {isRecording && (
              <div className="flex items-center justify-center gap-2 py-2 px-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-red-400 font-medium">Recording... Click mic to stop</span>
              </div>
            )}

            {/* AI Start/Stop button */}
            <button
              onClick={toggleMeetingListening}
              disabled={!isConnected}
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all duration-200 font-medium text-sm ${
                isListeningToMeeting
                  ? "bg-red-500/90 text-white hover:bg-red-600 shadow-lg shadow-red-500/20"
                  : isConnected
                  ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                  : "bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700"
              }`}
            >
              <Headphones className={`w-4 h-4 ${isListeningToMeeting ? 'animate-pulse' : ''}`} />
              {isListeningToMeeting ? 'Stop AI Assistant' : 'Start AI Assistant'}
            </button>
          </>
        )}

        {/* ===== TRANSLATION TAB CONTROLS ===== */}
        {currentTab === 'translation' && (
          <>
            {/* Active status */}
            {isLiveTranslating && (
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full animate-pulse bg-blue-400" />
                  <span className="text-xs font-medium text-blue-400">
                    Translating to {SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)?.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAudioEnabled(!audioEnabled)}
                    title={audioEnabled ? "Mute audio" : "Enable audio"}
                    className={`p-1.5 rounded-lg transition-all ${
                      audioEnabled 
                        ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' 
                        : 'bg-gray-700 text-gray-500 hover:bg-gray-600'
                    }`}
                  >
                    {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  </button>
                  <span className="text-xs text-gray-500">
                    {remoteParticipants.length > 0 ? `${remoteParticipants.length} participant(s)` : 'No participants'}
                  </span>
                </div>
              </div>
            )}

            {/* Translation Start/Stop button */}
            <button
              onClick={toggleLiveTranslation}
              disabled={!isConnected}
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all duration-200 font-medium text-sm ${
                isLiveTranslating
                  ? "bg-red-500/90 text-white hover:bg-red-600 shadow-lg shadow-red-500/20"
                  : isConnected
                  ? "bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/20"
                  : "bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700"
              }`}
            >
              <Languages className={`w-4 h-4 ${isLiveTranslating ? 'animate-pulse' : ''}`} />
              {isLiveTranslating ? 'Stop Translation' : 'Start Translation'}
            </button>
          </>
        )}
        
        {/* Text input row */}
        <div className="flex gap-2">
          {/* Microphone button */}
          <button
            onClick={toggleRecording}
            disabled={!isConnected}
            title="Voice Input"
            className={`p-3 rounded-xl transition-all duration-200 ${
              isRecording
                ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                : isConnected
                ? "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700"
                : "bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700"
            }`}
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          
          {/* Text input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isConnected ? "Type a message..." : "Connecting..."}
              disabled={!isConnected}
              className="w-full pl-4 pr-12 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm text-white placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            />
            <button
              onClick={sendMessage}
              disabled={!inputText.trim() || !isConnected}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
