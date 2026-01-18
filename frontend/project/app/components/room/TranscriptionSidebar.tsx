"use client";

import { FileText, X, Mic, MicOff, Trash2, Download, Copy, Check } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

interface TranscriptEntry {
  id: string;
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

interface TranscriptionSidebarProps {
  onClose: () => void;
}

// Declare the Web Speech API types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function TranscriptionSidebar({ onClose }: TranscriptionSidebarProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptsEndRef = useRef<HTMLDivElement>(null);
  const entryIdCounter = useRef<number>(0);
  
  // Generate unique entry ID
  const generateEntryId = () => {
    entryIdCounter.current += 1;
    return `entry_${Date.now()}_${entryIdCounter.current}`;
  };

  // Scroll to bottom when new transcripts arrive
  useEffect(() => {
    transcriptsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts, interimTranscript]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      setError("Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        
        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }

      // Add final transcript to the list
      if (finalTranscript) {
        setTranscripts(prev => [
          ...prev,
          {
            id: generateEntryId(),
            text: finalTranscript.trim(),
            timestamp: new Date(),
            isFinal: true,
          }
        ]);
      }

      // Update interim transcript
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      
      if (event.error === "not-allowed") {
        setError("Microphone access denied. Please allow microphone permissions.");
      } else if (event.error === "no-speech") {
        // This is normal, just restart
        setError(null);
      } else if (event.error === "network") {
        setError("Network error. Please check your connection.");
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
      
      setIsListening(false);
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening
      if (recognitionRef.current && isListening) {
        try {
          recognition.start();
        } catch (e) {
          console.log("Recognition restart failed:", e);
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
    };
  }, []);

  // Re-attach the isListening check for auto-restart
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = () => {
        if (isListening) {
          try {
            recognitionRef.current?.start();
          } catch (e) {
            console.log("Recognition restart failed:", e);
            setIsListening(false);
          }
        }
      };
    }
  }, [isListening]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    try {
      setInterimTranscript("");
      setError(null);
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      console.error("Failed to start recognition:", e);
      setError("Failed to start speech recognition. Please try again.");
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    try {
      recognitionRef.current.stop();
      setIsListening(false);
      setInterimTranscript("");
    } catch (e) {
      console.error("Failed to stop recognition:", e);
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const clearTranscripts = () => {
    setTranscripts([]);
    setInterimTranscript("");
  };

  const copyToClipboard = async () => {
    const fullText = transcripts.map(t => t.text).join("\n");
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  const downloadTranscript = () => {
    const fullText = transcripts.map(t => {
      const time = t.timestamp.toLocaleTimeString();
      return `[${time}] ${t.text}`;
    }).join("\n\n");
    
    const blob = new Blob([fullText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white">Live Transcription</h3>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isListening ? "bg-emerald-400 animate-pulse" : "bg-gray-500"}`} />
              <span className="text-xs text-gray-400">
                {isListening ? "Listening..." : "Click to start"}
              </span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Not Supported Message */}
      {!isSupported && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <FileText className="w-8 h-8 text-amber-400" />
            </div>
            <p className="text-amber-400 font-medium mb-2">Browser Not Supported</p>
            <p className="text-sm text-gray-400 max-w-xs">
              Speech recognition is not available in your browser. Please use Chrome, Edge, or Safari for best results.
            </p>
          </div>
        </div>
      )}

      {/* Transcript Area */}
      {isSupported && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-gray-900 to-gray-950">
          {transcripts.length === 0 && !interimTranscript && !isListening && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-8">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-amber-400" />
              </div>
              <p className="text-sm mb-2">Real-time Speech-to-Text</p>
              <p className="text-xs text-gray-500 max-w-xs">
                Click the microphone button below to start transcribing. Your speech will be converted to text in real-time.
              </p>
            </div>
          )}

          {transcripts.length === 0 && !interimTranscript && isListening && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-8">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center mb-4 animate-pulse">
                <Mic className="w-8 h-8 text-amber-400" />
              </div>
              <p className="text-sm mb-2 text-amber-400">Listening...</p>
              <p className="text-xs text-gray-500 max-w-xs">
                Start speaking and your words will appear here.
              </p>
            </div>
          )}

          {/* Transcript entries */}
          {transcripts.map((entry) => (
            <div
              key={entry.id}
              className="p-3 rounded-xl bg-amber-900/20 border border-amber-700/30 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs text-amber-400/70">{formatTime(entry.timestamp)}</span>
              </div>
              <p className="text-sm text-amber-100 whitespace-pre-wrap">{entry.text}</p>
            </div>
          ))}

          {/* Interim (live) transcript */}
          {interimTranscript && (
            <div className="p-3 rounded-xl bg-gray-800/50 border border-gray-700/30 backdrop-blur-sm animate-pulse">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                <span className="text-xs text-gray-400">Speaking...</span>
              </div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap italic">{interimTranscript}</p>
            </div>
          )}

          <div ref={transcriptsEndRef} />
        </div>
      )}

      {/* Controls */}
      {isSupported && (
        <div className="p-4 border-t border-gray-800 bg-gray-900 space-y-3">
          {/* Status indicator */}
          {isListening && (
            <div className="flex items-center justify-center gap-2 py-2 px-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-xs text-amber-400 font-medium">
                Transcribing... Speak clearly into your microphone
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {/* Main mic button */}
            <button
              onClick={toggleListening}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all duration-200 font-medium ${
                isListening
                  ? "bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600"
                  : "bg-amber-500 text-white shadow-lg shadow-amber-500/30 hover:bg-amber-600"
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-5 h-5" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  <span>Start Transcribing</span>
                </>
              )}
            </button>
          </div>

          {/* Secondary actions */}
          {transcripts.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={copyToClipboard}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors text-sm"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? "Copied!" : "Copy"}</span>
              </button>
              
              <button
                onClick={downloadTranscript}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
              
              <button
                onClick={clearTranscripts}
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gray-800 text-red-400 hover:bg-red-500/20 transition-colors text-sm"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

