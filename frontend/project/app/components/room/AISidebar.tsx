"use client";

import { Bot, X, Send, Mic, MicOff, Loader2, Volume2, Radio, Headphones } from "lucide-react";
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

export function AISidebar({ onClose }: AISidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListeningToMeeting, setIsListeningToMeeting] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const meetingRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const meetingAudioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const clientIdRef = useRef<string>("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const meetingStreamRef = useRef<MediaStream | null>(null);

  // Get remote participants for meeting audio
  const remoteParticipants = useRemoteParticipants();

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup function for meeting listening
  const cleanupMeetingListening = useCallback(() => {
    setIsListeningToMeeting(false);
    
    if (meetingRecorderRef.current && meetingRecorderRef.current.state !== "inactive") {
      meetingRecorderRef.current.stop();
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
                  id: `msg_${Date.now()}`,
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
                  id: `msg_${Date.now()}`,
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
                  id: `msg_${Date.now()}`,
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
                  id: `msg_${Date.now()}`,
                  role: "meeting",
                  content: `❓ ${data.question}`,
                  speaker: "Question Detected",
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
                  id: `msg_${Date.now()}`,
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
      cleanupMeetingListening();
    };
  }, [cleanupMeetingListening]);

  // Capture and send meeting audio periodically
  const captureMeetingAudio = useCallback(async () => {
    if (!isListeningToMeeting || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      // Create an AudioContext if we don't have one
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      // Get all audio tracks from remote participants
      const audioTracks: MediaStreamTrack[] = [];
      
      remoteParticipants.forEach((participant) => {
        const audioTrack = participant.getTrackPublication(Track.Source.Microphone);
        if (audioTrack?.track?.mediaStreamTrack) {
          audioTracks.push(audioTrack.track.mediaStreamTrack);
        }
      });

      if (audioTracks.length === 0) {
        console.log("No remote audio tracks available");
        return;
      }

      // Create a new stream from all audio tracks
      const combinedStream = new MediaStream(audioTracks);
      meetingStreamRef.current = combinedStream;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: "audio/webm;codecs=opus",
      });

      meetingAudioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          meetingAudioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (meetingAudioChunksRef.current.length === 0) return;
        
        const audioBlob = new Blob(meetingAudioChunksRef.current, { type: "audio/webm" });
        
        // Only send if blob has meaningful size (more than ~1kb means actual audio)
        if (audioBlob.size > 1000) {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              const base64Audio = (reader.result as string).split(",")[1];
              wsRef.current.send(JSON.stringify({
                type: "meeting_audio",
                data: base64Audio,
              }));
            }
          };
          reader.readAsDataURL(audioBlob);
        }
      };

      meetingRecorderRef.current = mediaRecorder;
      mediaRecorder.start();

      // Record for 5 seconds then stop and process
      setTimeout(() => {
        if (mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        }
      }, 5000);

    } catch (error) {
      console.error("Error capturing meeting audio:", error);
    }
  }, [isListeningToMeeting, remoteParticipants]);

  // Set up interval for meeting audio capture
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (isListeningToMeeting && isConnected) {
      // Start capturing immediately
      captureMeetingAudio();
      // Then capture every 6 seconds (5s recording + 1s gap)
      intervalId = setInterval(captureMeetingAudio, 6000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isListeningToMeeting, isConnected, captureMeetingAudio]);

  // Toggle meeting listening
  const toggleMeetingListening = () => {
    if (isListeningToMeeting) {
      stopMeetingListening();
    } else {
      startMeetingListening();
    }
  };

  const startMeetingListening = () => {
    setIsListeningToMeeting(true);
    
    // Send status to server
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "start_listening",
      }));
    }
    
    setMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: "🎧 Now listening to the meeting. I'll detect questions and provide answers automatically!",
      },
    ]);
  };

  const stopMeetingListening = useCallback(() => {
    cleanupMeetingListening();
    
    // Send status to server
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "stop_listening",
      }));
    }
  }, [cleanupMeetingListening]);

  // Send text message
  const sendMessage = useCallback(() => {
    if (!inputText.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Add user message to UI immediately
    setMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}`,
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
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        
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

  return (
    <div className="flex flex-col h-full">
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
              <span className="text-xs text-gray-400">
                {isConnected ? (isListeningToMeeting ? "Listening to meeting..." : "Connected") : "Reconnecting..."}
              </span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Meeting Listening Toggle */}
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/50">
        <button
          onClick={toggleMeetingListening}
          disabled={!isConnected}
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl transition-all duration-300 ${
            isListeningToMeeting
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
          }`}
        >
          {isListeningToMeeting ? (
            <>
              <Radio className="w-4 h-4 animate-pulse" />
              <span className="font-medium">Listening to Meeting</span>
              <span className="text-xs opacity-75">(Click to stop)</span>
            </>
          ) : (
            <>
              <Headphones className="w-4 h-4" />
              <span className="font-medium">Listen to Meeting</span>
            </>
          )}
        </button>
        {isListeningToMeeting && (
          <p className="text-xs text-emerald-400/80 text-center mt-2">
            🎧 Detecting questions from {remoteParticipants.length} participant(s)
          </p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-900 to-gray-950">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-8">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500/20 to-indigo-600/20 rounded-2xl flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-indigo-400" />
            </div>
            <p className="text-sm mb-2">Your AI meeting assistant is ready!</p>
            <p className="text-xs text-gray-500 max-w-xs">
              Click &ldquo;Listen to Meeting&rdquo; to auto-detect questions, or use the mic to ask directly
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
                  🎤 {message.speaker}:
                </span>
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
      <div className="p-4 border-t border-gray-800 bg-gray-900">
        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center justify-center gap-2 mb-3 py-2 px-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm text-red-400 font-medium">Recording... Click mic to stop</span>
          </div>
        )}
        
        <div className="flex gap-2">
          {/* Microphone button */}
          <button
            onClick={toggleRecording}
            disabled={!isConnected}
            className={`p-3 rounded-xl transition-all duration-300 ${
              isRecording
                ? "bg-red-500 text-white shadow-lg shadow-red-500/30 scale-110"
                : isConnected
                ? "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700"
                : "bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700"
            }`}
          >
            {isRecording ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>
          
          {/* Text input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isConnected ? "Ask AI something..." : "Connecting..."}
              disabled={!isConnected}
              className="w-full pl-4 pr-12 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm text-white placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            />
            <button
              onClick={sendMessage}
              disabled={!inputText.trim() || !isConnected}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <p className="text-xs text-gray-500 mt-2 text-center">
          Press Enter to send • Click 🎤 for voice input
        </p>
      </div>
    </div>
  );
}
