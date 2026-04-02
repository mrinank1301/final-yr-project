"use client";

import { Bot, X, Send, Mic, MicOff, Loader2, Volume2, Radio, Headphones, Zap } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRemoteParticipants } from "@livekit/components-react";
import { Track } from "livekit-client";

interface Message {
  id: string;
  role: "user" | "assistant" | "meeting";
  content: string;
  isTranscription?: boolean;
  speaker?: string;
}

interface AISidebarProps {
  onClose: () => void;
}

const CHUNK_DURATION_MS = 3000;

export function AISidebar({ onClose }: AISidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);

  const [inputText, setInputText] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListeningToMeeting, setIsListeningToMeeting] = useState(false);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingHeard, setStreamingHeard] = useState("");
  const streamingContentRef = useRef<string>("");
  const streamingPrefixRef = useRef<string>("");
  
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const clientIdRef = useRef<string>("");
  const messageIdCounter = useRef<number>(0);
  
  const tokenBatchRef = useRef<string>("");
  const tokenFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chunked audio capture refs (AI Assistant mode)
  const audioContextRef = useRef<AudioContext | null>(null);
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const generateMessageId = () => {
    messageIdCounter.current += 1;
    return `msg_${Date.now()}_${messageIdCounter.current}`;
  };

  const remoteParticipants = useRemoteParticipants();
  const remoteParticipantsRef = useRef(remoteParticipants);
  useEffect(() => {
    remoteParticipantsRef.current = remoteParticipants;
  }, [remoteParticipants]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // ------------------------------------------------------------------
  // Chunked audio capture for AI Assistant (Sarvam STT + OpenAI LLM)
  // ------------------------------------------------------------------

  const stopChunkedCapture = useCallback(() => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  // Stable capture function: reads remoteParticipants from ref (not closure)
  // so it never changes identity and the interval doesn't get torn down.
  const captureMeetingAudio = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const participants = remoteParticipantsRef.current;
    const audioTracks: MediaStreamTrack[] = [];
    participants.forEach((p) => {
      const pub = p.getTrackPublication(Track.Source.Microphone);
      const track = pub?.track?.mediaStreamTrack;
      if (track && track.readyState === "live") audioTracks.push(track);
    });
    if (audioTracks.length === 0) return;

    try {
      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") await ctx.resume();

      const destination = ctx.createMediaStreamDestination();
      audioTracks.forEach((track) => {
        try {
          const src = ctx.createMediaStreamSource(new MediaStream([track]));
          src.connect(destination);
        } catch { /* connect error */ }
      });

      const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4", ""];
      let selectedMime = "";
      for (const mt of mimeTypes) {
        if (mt === "" || MediaRecorder.isTypeSupported(mt)) { selectedMime = mt; break; }
      }

      const opts: MediaRecorderOptions = {};
      if (selectedMime) opts.mimeType = selectedMime;

      const recorder = new MediaRecorder(destination.stream, opts);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const ws = wsRef.current;
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: selectedMime || "audio/webm" });
        if (blob.size < 1000) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            const b64 = (reader.result as string).split(",")[1];
            ws.send(JSON.stringify({ type: "ai_audio_chunk", data: b64 }));
          }
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, CHUNK_DURATION_MS);
    } catch (e) {
      console.warn("[Chunked] Capture error:", e);
    }
  }, []); // stable — all dynamic values read from refs

  // Start/stop chunked capture when AI assistant mode toggles
  useEffect(() => {
    if (isListeningToMeeting && isConnected) {
      console.log("[Chunked] Starting capture interval");
      captureMeetingAudio();
      captureIntervalRef.current = setInterval(captureMeetingAudio, CHUNK_DURATION_MS);
    }
    return () => {
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
        captureIntervalRef.current = null;
      }
    };
  }, [isListeningToMeeting, isConnected, captureMeetingAudio]);

  const cleanupAllModes = useCallback(() => {
    setIsListeningToMeeting(false);
    setIsStreaming(false);
    setStreamingContent("");
    setStreamingHeard("");
    streamingContentRef.current = "";
    
    if (tokenFlushTimerRef.current) {
      clearTimeout(tokenFlushTimerRef.current);
      tokenFlushTimerRef.current = null;
    }

    stopChunkedCapture();
  }, [stopChunkedCapture]);

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
        console.log("Connected to AI chat (chunked pipeline)");
        setIsConnected(true);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
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
              
              setMessages((prev) => [
                ...prev,
                {
                  id: generateMessageId(),
                  role: "assistant",
                  content: finalContent,
                },
              ]);
              break;
            }

            case "heard":
              setStreamingHeard(data.transcript || "");
              break;

            case "speech_started":
              break;
              
            case "message":
              setMessages((prev) => [
                ...prev,
                {
                  id: generateMessageId(),
                  role: data.role,
                  content: data.content,
                },
              ]);
              break;
              
            case "transcription":
              setMessages((prev) => [
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
              setMessages((prev) => [
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
              setMessages((prev) => [
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
              setMessages([]);
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

  // ==================== AI Assistant Mode ====================
  const toggleMeetingListening = () => {
    if (isListeningToMeeting) {
      stopMeetingListening();
    } else {
      startMeetingListening();
    }
  };

  const startMeetingListening = () => {
    setIsListeningToMeeting(true);
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "start_listening",
      }));
    }
    
    setMessages((prev) => [
      ...prev,
      {
        id: generateMessageId(),
        role: "assistant",
        content: remoteParticipants.length > 0 
          ? `**AI Assistant Active**\n\nListening to ${remoteParticipants.length} participant(s). I'll transcribe speech and answer questions automatically.`
          : `**No Other Participants Yet**\n\nI need another person in the call to listen to.\n\n- Open this room in another browser/tab\n- Or invite someone to join\n- Make sure they enable their microphone`,
      },
    ]);
  };

  const stopMeetingListening = useCallback(() => {
    stopChunkedCapture();
    setIsListeningToMeeting(false);
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "stop_listening",
      }));
    }
  }, [stopChunkedCapture]);

  const sendMessage = useCallback(() => {
    if (!inputText.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    
    setMessages((prev) => [
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

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
    if (isListeningToMeeting) return "AI Assistant Active";
    return "Connected";
  };

  return (
    <div className="flex flex-col h-full">
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-900 to-gray-950">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-8">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500/20 to-indigo-600/20 rounded-2xl flex items-center justify-center mb-4">
              <Headphones className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-sm mb-2">AI Assistant</p>
            <p className="text-xs text-gray-500 max-w-xs">
              Click <strong className="text-emerald-400">Start</strong> below to stream audio directly to AI. Get real-time answers as participants speak.
            </p>
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
                  : "bg-gradient-to-br from-blue-500 to-blue-600"
              }`}
            >
              {message.role === "assistant" ? (
                <Bot className="w-4 h-4 text-indigo-400" />
              ) : message.role === "meeting" ? (
                <Radio className="w-4 h-4 text-emerald-400" />
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
                  : "bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-tr-none shadow-lg shadow-blue-500/20"
              }`}
            >
              {message.role === "meeting" && message.speaker && (
                <span className="text-xs text-emerald-300 opacity-70 block mb-1">
                  {message.speaker}:
                </span>
              )}
              {message.isTranscription && message.role === "user" && (
                <span className="text-xs text-blue-200 opacity-70 block mb-1">Voice message:</span>
              )}
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          </div>
        ))}
        
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
        {isListeningToMeeting && (
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse bg-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">
                AI Listening
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {remoteParticipants.length > 0 ? `${remoteParticipants.length} participant(s)` : 'No participants'}
            </span>
          </div>
        )}

        {isRecording && (
          <div className="flex items-center justify-center gap-2 py-2 px-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-red-400 font-medium">Recording... Click mic to stop</span>
          </div>
        )}

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
        
        <div className="flex gap-2">
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
          
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
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
