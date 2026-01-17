"use client";

import { Bot, X, Send, Mic, MicOff, Loader2, Volume2, Radio, Headphones, Languages, FileText } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRemoteParticipants } from "@livekit/components-react";
import { Track } from "livekit-client";

interface Message {
  id: string;
  role: "user" | "assistant" | "meeting" | "transcription" | "translation";
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

export function AISidebar({ onClose }: AISidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListeningToMeeting, setIsListeningToMeeting] = useState(false);
  
  // Live Transcription state
  const [isLiveTranscribing, setIsLiveTranscribing] = useState(false);
  
  // Live Translation state
  const [isLiveTranslating, setIsLiveTranslating] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<string>("");
  
  // Active feature mode: 'ai' | 'transcription' | 'translation'
  const [activeMode, setActiveMode] = useState<'ai' | 'transcription' | 'translation'>('ai');
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const meetingRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const meetingAudioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const clientIdRef = useRef<string>("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const meetingStreamRef = useRef<MediaStream | null>(null);
  const messageIdCounter = useRef<number>(0);
  
  // Generate unique message ID
  const generateMessageId = () => {
    messageIdCounter.current += 1;
    return `msg_${Date.now()}_${messageIdCounter.current}`;
  };

  // Get remote participants for meeting audio
  const remoteParticipants = useRemoteParticipants();

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Full cleanup function (only for unmount)
  const cleanupAllModes = useCallback(() => {
    setIsListeningToMeeting(false);
    setIsLiveTranscribing(false);
    setIsLiveTranslating(false);
    setActiveMode('ai');
    setTargetLanguage("");
    
    if (meetingRecorderRef.current && meetingRecorderRef.current.state !== "inactive") {
      try {
        meetingRecorderRef.current.stop();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
    
    if (meetingStreamRef.current) {
      meetingStreamRef.current.getTracks().forEach(track => track.stop());
      meetingStreamRef.current = null;
    }
  }, []);

  // Connect to WebSocket
  useEffect(() => {
    // Generate client ID
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    clientIdRef.current = clientId;
    
    const pythonServerUrl = process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://localhost:5000";
    const wsUrl = `${pythonServerUrl.replace('http', 'ws')}/ws/ai-chat/${clientId}`;
    
    const connectWebSocket = () => {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log("Connected to AI chat");
        setIsConnected(true);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
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
              // Show the transcribed speech
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
              
            case "meeting_transcription":
              // Show meeting transcription (from other participants)
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
              
            case "question_detected":
              // A question was detected and AI is answering
              setMessages((prev) => [
                ...prev,
                {
                  id: generateMessageId(),
                  role: "meeting",
                  content: `❓ Question: ${data.question}`,
                  speaker: "Question Detected",
                  isTranscription: true,
                },
              ]);
              break;
              
            case "speech_detected":
              // Speech detected (not a question) and AI is responding
              setMessages((prev) => [
                ...prev,
                {
                  id: generateMessageId(),
                  role: "meeting",
                  content: `💬 ${data.question}`,
                  speaker: "Speech Detected",
                  isTranscription: true,
                },
              ]);
              break;
              
            case "live_transcription":
              // Live transcription only (no AI response)
              setMessages((prev) => [
                ...prev,
                {
                  id: generateMessageId(),
                  role: "transcription",
                  content: data.content,
                  speaker: data.speaker || "Participant",
                  isTranscription: true,
                },
              ]);
              break;
              
            case "live_translation":
              // Live translation result
              setMessages((prev) => [
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
              break;
              
            case "typing":
              setIsTyping(data.status);
              break;
              
            case "status":
              if (data.status === "transcribing") {
                setIsProcessing(true);
              } else if (data.status === "listening") {
                // Meeting listening status update
              }
              break;
              
            case "error":
              setMessages((prev) => [
                ...prev,
                {
                  id: generateMessageId(),
                  role: "assistant",
                  content: `⚠️ ${data.content}`,
                },
              ]);
              setIsProcessing(false);
              break;
              
            case "cleared":
              setMessages([]);
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
        setIsConnected(false);
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };
      
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
      
      wsRef.current = ws;
    };
    
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      cleanupAllModes();
    };
  }, [cleanupAllModes]);

  // Capture and send meeting audio periodically (shared by all modes)
  const captureMeetingAudio = useCallback(async () => {
    // Check if any capture mode is active
    const isCapturing = isListeningToMeeting || isLiveTranscribing || isLiveTranslating;
    if (!isCapturing || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      console.log(`[Audio] Checking ${remoteParticipants.length} remote participants for audio... (mode: ${activeMode})`);
      
      // Collect all active audio tracks from remote participants
      const audioTracks: MediaStreamTrack[] = [];
      
      remoteParticipants.forEach((participant) => {
        console.log(`[Audio] Participant: ${participant.identity}`);
        const audioTrack = participant.getTrackPublication(Track.Source.Microphone);
        const track = audioTrack?.track?.mediaStreamTrack;
        
        if (track && track.readyState === "live") {
          audioTracks.push(track);
          console.log(`[Audio] Added live audio track from ${participant.identity}`);
        } else {
          console.log(`[Audio] Track not available or not live for ${participant.identity}`);
        }
      });

      if (audioTracks.length === 0) {
        console.log("[Audio] No remote audio tracks available - need another participant with mic enabled");
        return;
      }
      
      console.log(`[Audio] Capturing audio from ${audioTracks.length} track(s) using Web Audio API...`);

      // Create or resume AudioContext
      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        audioContextRef.current = new AudioContext();
      }
      
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }
      
      const audioContext = audioContextRef.current;
      
      // Create a destination node for recording
      const destination = audioContext.createMediaStreamDestination();
      
      // Connect each audio track through the AudioContext
      audioTracks.forEach((track) => {
        try {
          const sourceStream = new MediaStream([track]);
          const source = audioContext.createMediaStreamSource(sourceStream);
          source.connect(destination);
        } catch (e) {
          console.warn(`[Audio] Failed to connect track:`, e);
        }
      });
      
      // Use the destination stream for recording (this stream is always recordable)
      const recordableStream = destination.stream;
      meetingStreamRef.current = recordableStream;

      // Find supported mimeType
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
        ""  // Default (let browser choose)
      ];
      
      let selectedMimeType = "";
      for (const mimeType of mimeTypes) {
        if (mimeType === "" || MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log(`[Audio] Using mimeType: ${mimeType || "default"}`);
          break;
        }
      }

      // Create MediaRecorder with supported mimeType
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

      // Capture current mode for closure
      const currentMode = activeMode;
      const currentTargetLang = targetLanguage;

      mediaRecorder.onstop = async () => {
        if (meetingAudioChunksRef.current.length === 0) return;
        
        const blobType = selectedMimeType || "audio/webm";
        const audioBlob = new Blob(meetingAudioChunksRef.current, { type: blobType });
        
        // Only send if blob has meaningful size (more than ~1kb means actual audio)
        if (audioBlob.size > 1000) {
          console.log(`[Audio] Sending ${audioBlob.size} bytes of audio (mode: ${currentMode})...`);
          const reader = new FileReader();
          reader.onloadend = () => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              const base64Audio = (reader.result as string).split(",")[1];
              
              // Send different message types based on active mode
              if (currentMode === 'transcription') {
                wsRef.current.send(JSON.stringify({
                  type: "live_transcription_audio",
                  data: base64Audio,
                }));
              } else if (currentMode === 'translation') {
                wsRef.current.send(JSON.stringify({
                  type: "live_translation_audio",
                  data: base64Audio,
                  target_language: currentTargetLang,
                }));
              } else {
                // Default: AI meeting mode
                wsRef.current.send(JSON.stringify({
                  type: "meeting_audio",
                  data: base64Audio,
                }));
              }
              console.log(`[Audio] Audio sent successfully (mode: ${currentMode})`);
            }
          };
          reader.readAsDataURL(audioBlob);
        } else {
          console.log(`[Audio] Audio blob too small (${audioBlob.size} bytes), skipping`);
        }
      };

      meetingRecorderRef.current = mediaRecorder;
      mediaRecorder.start();

      // Record for 6 seconds to capture full questions/sentences
      setTimeout(() => {
        if (mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        }
      }, 6000);

    } catch (error) {
      console.error("Error capturing audio:", error);
    }
  }, [isListeningToMeeting, isLiveTranscribing, isLiveTranslating, activeMode, targetLanguage, remoteParticipants]);

  // Set up interval for audio capture (shared by all modes)
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    const isCapturing = isListeningToMeeting || isLiveTranscribing || isLiveTranslating;

    if (isCapturing && isConnected) {
      // Start capturing immediately
      captureMeetingAudio();
      // Then capture every 6.5 seconds (6s recording + 0.5s gap) to get full sentences
      intervalId = setInterval(captureMeetingAudio, 6500);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isListeningToMeeting, isLiveTranscribing, isLiveTranslating, isConnected, captureMeetingAudio]);

  // Helper to stop recorder without resetting states
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
    // Stop recorder and other modes
    stopRecorderOnly();
    setIsLiveTranscribing(false);
    setIsLiveTranslating(false);
    
    // Set AI mode
    setIsListeningToMeeting(true);
    setActiveMode('ai');
    
    // Send status to server
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
          ? `🎧 **AI Assistant Active!**\n\nCapturing audio from ${remoteParticipants.length} participant(s).\n\n• I'll transcribe what they say\n• Instant AI responses via Groq\n• Perfect for interviews!`
          : `⚠️ **No Other Participants Yet**\n\nI need another person in the call to listen to their audio.\n\n• Open this room in another browser/tab\n• Or invite someone to join\n• Make sure they enable their microphone`,
      },
    ]);
  };

  const stopMeetingListening = useCallback(() => {
    stopRecorderOnly();
    setIsListeningToMeeting(false);
    
    // Send status to server
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "stop_listening",
      }));
    }
  }, [stopRecorderOnly]);

  // ==================== Live Transcription Mode ====================
  const toggleLiveTranscription = () => {
    if (isLiveTranscribing) {
      stopLiveTranscription();
    } else {
      startLiveTranscription();
    }
  };

  const startLiveTranscription = () => {
    // Stop recorder and other modes
    stopRecorderOnly();
    setIsListeningToMeeting(false);
    setIsLiveTranslating(false);
    
    // Set transcription mode
    setIsLiveTranscribing(true);
    setActiveMode('transcription');
    
    // Send status to server
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "start_transcription",
      }));
    }
    
    setMessages((prev) => [
      ...prev,
      {
        id: generateMessageId(),
        role: "assistant",
        content: remoteParticipants.length > 0 
          ? `📝 **Live Transcription Active!**\n\nTranscribing audio from ${remoteParticipants.length} participant(s).\n\n• Real-time speech-to-text\n• No AI responses - just transcription\n• Great for note-taking!`
          : `⚠️ **No Other Participants Yet**\n\nI need another person in the call to transcribe.\n\n• Open this room in another browser/tab\n• Or invite someone to join\n• Make sure they enable their microphone`,
      },
    ]);
  };

  const stopLiveTranscription = useCallback(() => {
    stopRecorderOnly();
    setIsLiveTranscribing(false);
    
    // Send status to server
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "stop_transcription",
      }));
    }
  }, [stopRecorderOnly]);

  // ==================== Live Translation Mode ====================
  const toggleLiveTranslation = () => {
    if (isLiveTranslating) {
      stopLiveTranslation();
    } else {
      // Show language selector first
      setShowLanguageSelector(true);
    }
  };

  const startLiveTranslation = (selectedLanguage: string) => {
    // Stop recorder and other modes
    stopRecorderOnly();
    setIsListeningToMeeting(false);
    setIsLiveTranscribing(false);
    
    // Set translation mode
    setTargetLanguage(selectedLanguage);
    setIsLiveTranslating(true);
    setActiveMode('translation');
    setShowLanguageSelector(false);
    
    const langName = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.name || selectedLanguage;
    
    // Send status to server
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "start_translation",
        target_language: selectedLanguage,
      }));
    }
    
    setMessages((prev) => [
      ...prev,
      {
        id: generateMessageId(),
        role: "assistant",
        content: remoteParticipants.length > 0 
          ? `🌐 **Live Translation Active!**\n\nTranslating to **${langName}** from ${remoteParticipants.length} participant(s).\n\n• Real-time speech translation\n• Original + translated text shown\n• Perfect for multilingual meetings!`
          : `⚠️ **No Other Participants Yet**\n\nI need another person in the call to translate.\n\n• Open this room in another browser/tab\n• Or invite someone to join\n• Make sure they enable their microphone`,
      },
    ]);
  };

  const stopLiveTranslation = useCallback(() => {
    stopRecorderOnly();
    setIsLiveTranslating(false);
    setTargetLanguage("");
    
    // Send status to server
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "stop_translation",
      }));
    }
  }, [stopRecorderOnly]);

  // Send text message
  const sendMessage = useCallback(() => {
    if (!inputText.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Add user message to UI immediately
    setMessages((prev) => [
      ...prev,
      {
        id: generateMessageId(),
        role: "user",
        content: inputText,
      },
    ]);
    
    // Send to server
    wsRef.current.send(JSON.stringify({
      type: "text",
      content: inputText,
    }));
    
    setInputText("");
  }, [inputText]);

  // Handle Enter key
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
      
      // Find supported mimeType
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
        
        // Convert to base64 and send
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
        
        // Stop all tracks
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

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Toggle recording
  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Get current status text
  const getStatusText = () => {
    if (!isConnected) return "Reconnecting...";
    if (isListeningToMeeting) return "AI Assistant Active";
    if (isLiveTranscribing) return "Live Transcription";
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
            <h3 className="font-bold text-white">AI Assistant</h3>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
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
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-8">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500/20 to-indigo-600/20 rounded-2xl flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-indigo-400" />
            </div>
            <p className="text-sm mb-2">Your AI meeting assistant is ready!</p>
            <p className="text-xs text-gray-500 max-w-xs mb-3">Use the buttons below:</p>
            <div className="text-xs text-gray-500 space-y-1.5 text-left">
              <p>🎧 <strong className="text-emerald-400">AI Assistant</strong> - Transcribe + AI answers</p>
              <p>📝 <strong className="text-amber-400">Transcribe</strong> - Speech to text only</p>
              <p>🌐 <strong className="text-blue-400">Translate</strong> - Real-time translation</p>
            </div>
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
                  : message.role === "transcription"
                  ? "bg-gradient-to-br from-amber-500/30 to-orange-500/30"
                  : message.role === "translation"
                  ? "bg-gradient-to-br from-blue-500/30 to-cyan-500/30"
                  : "bg-gradient-to-br from-blue-500 to-blue-600"
              }`}
            >
              {message.role === "assistant" ? (
                <Bot className="w-4 h-4 text-indigo-400" />
              ) : message.role === "meeting" ? (
                <Radio className="w-4 h-4 text-emerald-400" />
              ) : message.role === "transcription" ? (
                <FileText className="w-4 h-4 text-amber-400" />
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
                  : message.role === "transcription"
                  ? "bg-amber-900/30 text-amber-100 rounded-tl-none border border-amber-700/30 backdrop-blur-sm"
                  : message.role === "translation"
                  ? "bg-blue-900/30 text-blue-100 rounded-tl-none border border-blue-700/30 backdrop-blur-sm"
                  : "bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-tr-none shadow-lg shadow-blue-500/20"
              }`}
            >
              {message.role === "meeting" && message.speaker && (
                <span className="text-xs text-emerald-300 opacity-70 block mb-1">
                  🎤 {message.speaker}:
                </span>
              )}
              {message.role === "transcription" && message.speaker && (
                <span className="text-xs text-amber-300 opacity-70 block mb-1">
                  📝 {message.speaker}:
                </span>
              )}
              {message.role === "translation" && (
                <>
                  <span className="text-xs text-blue-300 opacity-70 block mb-1">
                    🌐 {message.speaker} → {SUPPORTED_LANGUAGES.find(l => l.code === message.targetLanguage)?.name || message.targetLanguage}:
                  </span>
                  {message.originalText && (
                    <div className="text-xs text-blue-300/50 italic mb-2 pb-2 border-b border-blue-700/30">
                      Original: {message.originalText}
                    </div>
                  )}
                </>
              )}
              {message.isTranscription && message.role === "user" && (
                <span className="text-xs text-blue-200 opacity-70 block mb-1">🎤 Voice message:</span>
              )}
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          </div>
        ))}
        
        {/* Typing indicator */}
        {(isTyping || isProcessing) && (
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
        {/* Status indicator for active modes */}
        {(isListeningToMeeting || isLiveTranscribing || isLiveTranslating) && (
          <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${
            isListeningToMeeting ? 'bg-emerald-500/10 border border-emerald-500/30' : 
            isLiveTranscribing ? 'bg-amber-500/10 border border-amber-500/30' : 
            'bg-blue-500/10 border border-blue-500/30'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                isListeningToMeeting ? 'bg-emerald-400' : 
                isLiveTranscribing ? 'bg-amber-400' : 
                'bg-blue-400'
              }`} />
              <span className={`text-xs font-medium ${
                isListeningToMeeting ? 'text-emerald-400' : 
                isLiveTranscribing ? 'text-amber-400' : 
                'text-blue-400'
              }`}>
                {isListeningToMeeting && 'AI Assistant Active'}
                {isLiveTranscribing && 'Transcribing...'}
                {isLiveTranslating && `Translating to ${SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)?.name}`}
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

        {/* Three Feature Buttons - SEPARATE */}
        <div className="grid grid-cols-3 gap-2">
          {/* AI Assistant Button */}
          <button
            onClick={toggleMeetingListening}
            disabled={!isConnected}
            title="AI Assistant - Transcribe & Get AI Answers"
            className={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl transition-all duration-200 ${
              isListeningToMeeting
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                : isConnected
                ? "bg-gray-800 text-gray-400 hover:bg-emerald-500/20 hover:text-emerald-400 border border-gray-700 hover:border-emerald-500/50"
                : "bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700"
            }`}
          >
            <Headphones className={`w-5 h-5 ${isListeningToMeeting ? 'animate-pulse' : ''}`} />
            <span className="text-[10px] font-medium">AI Assistant</span>
          </button>

          {/* Live Transcription Button */}
          <button
            onClick={toggleLiveTranscription}
            disabled={!isConnected}
            title="Live Transcription - Speech to Text Only"
            className={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl transition-all duration-200 ${
              isLiveTranscribing
                ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30"
                : isConnected
                ? "bg-gray-800 text-gray-400 hover:bg-amber-500/20 hover:text-amber-400 border border-gray-700 hover:border-amber-500/50"
                : "bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700"
            }`}
          >
            <FileText className={`w-5 h-5 ${isLiveTranscribing ? 'animate-pulse' : ''}`} />
            <span className="text-[10px] font-medium">Transcribe</span>
          </button>

          {/* Live Translation Button */}
          <button
            onClick={toggleLiveTranslation}
            disabled={!isConnected}
            title="Live Translation - Translate to Your Language"
            className={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl transition-all duration-200 ${
              isLiveTranslating
                ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                : isConnected
                ? "bg-gray-800 text-gray-400 hover:bg-blue-500/20 hover:text-blue-400 border border-gray-700 hover:border-blue-500/50"
                : "bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700"
            }`}
          >
            <Languages className={`w-5 h-5 ${isLiveTranslating ? 'animate-pulse' : ''}`} />
            <span className="text-[10px] font-medium">Translate</span>
          </button>
        </div>
        
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
