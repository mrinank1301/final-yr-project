"use client";

import { useState, useRef, useCallback } from "react";
import {
  X,
  Code2,
  Play,
  Trash2,
  ChevronDown,
  Terminal,
  Loader2,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Users,
} from "lucide-react";
import { useLocalParticipant } from "@livekit/components-react";
import dynamic from "next/dynamic";
import type { SupportedLanguage } from "./CollaborativeEditor";

// Dynamically import the editor to avoid SSR issues
const CollaborativeEditor = dynamic(
  () => import("./CollaborativeEditor"),
  { ssr: false }
);

interface CodeEditorSidebarProps {
  onClose: () => void;
  roomId: string;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  startedBy?: string | null;
}

interface LanguageOption {
  id: SupportedLanguage;
  name: string;
  extension: string;
  icon: string;
}

const languages: LanguageOption[] = [
  { id: "javascript", name: "JavaScript", extension: "js", icon: "🟨" },
  { id: "python", name: "Python", extension: "py", icon: "🐍" },
  { id: "cpp", name: "C++", extension: "cpp", icon: "⚡" },
  { id: "java", name: "Java", extension: "java", icon: "☕" },
];

export function CodeEditorSidebar({
  onClose,
  roomId,
  isFullScreen = false,
  onToggleFullScreen,
  startedBy,
}: CodeEditorSidebarProps) {
  const { localParticipant } = useLocalParticipant();
  const participantName = localParticipant?.identity || "Anonymous";
  
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>("javascript");
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    "🖥️ Terminal ready. Click 'Run' to execute your code.",
  ]);
  const [isTerminalExpanded, setIsTerminalExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  
  const editorRef = useRef<HTMLDivElement & { getCode?: () => string }>(null);
  const codeRef = useRef<string>("");

  const handleCodeChange = useCallback((code: string) => {
    codeRef.current = code;
  }, []);

  const getCode = useCallback(() => {
    // Try to get code from editor ref
    if (editorRef.current?.getCode) {
      return editorRef.current.getCode();
    }
    return codeRef.current;
  }, []);

  const runCode = async () => {
    const code = getCode();
    if (!code.trim()) {
      setTerminalOutput((prev) => [...prev, "⚠️ No code to run."]);
      return;
    }

    setIsRunning(true);
    setTerminalOutput((prev) => [
      ...prev,
      "",
      `▶️ Running ${languages.find(l => l.id === selectedLanguage)?.name} code...`,
      "─".repeat(40),
    ]);

    try {
      const pythonServerUrl = process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://localhost:5000";
      const response = await fetch(`${pythonServerUrl}/api/execute-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          language: selectedLanguage,
        }),
      });

      const result = await response.json();

      if (result.success) {
        if (result.output) {
          setTerminalOutput((prev) => [...prev, result.output]);
        }
        if (result.error) {
          setTerminalOutput((prev) => [...prev, `❌ Error:\n${result.error}`]);
        }
        setTerminalOutput((prev) => [
          ...prev,
          "─".repeat(40),
          `✅ Execution completed (${result.execution_time || "N/A"})`,
        ]);
      } else {
        setTerminalOutput((prev) => [
          ...prev,
          `❌ Execution failed: ${result.error || "Unknown error"}`,
        ]);
      }
    } catch (error) {
      setTerminalOutput((prev) => [
        ...prev,
        `❌ Failed to connect to code execution server: ${error}`,
        "💡 Make sure the Python server is running and accessible.",
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  const clearTerminal = () => {
    setTerminalOutput(["🖥️ Terminal cleared."]);
  };

  const copyCode = async () => {
    const code = getCode();
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedLang = languages.find((l) => l.id === selectedLanguage)!;

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-gray-900">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white">Code Editor</h3>
            <span className="text-xs text-gray-400">
              {startedBy ? `Started by ${startedBy}` : "Collaborative IDE"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onToggleFullScreen && (
            <button
              onClick={onToggleFullScreen}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              title={isFullScreen ? "Exit full screen" : "Full screen"}
            >
              {isFullScreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Collaborative Session Banner */}
      <div className="px-3 py-2 bg-gradient-to-r from-emerald-900/50 to-teal-900/50 border-b border-emerald-800/50 flex items-center gap-2">
        <Users className="w-4 h-4 text-emerald-400" />
        <span className="text-xs text-emerald-300">
          🔴 Live collaborative session — All participants can see and edit this code with multiple cursors
        </span>
      </div>

      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between bg-gray-850">
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-white transition-colors"
            >
              <span>{selectedLang.icon}</span>
              <span>{selectedLang.name}</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {isLanguageDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                {languages.map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => {
                      setSelectedLanguage(lang.id);
                      setIsLanguageDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${
                      selectedLanguage === lang.id
                        ? "bg-gray-700 text-emerald-400"
                        : "text-white"
                    }`}
                  >
                    <span>{lang.icon}</span>
                    <span>{lang.name}</span>
                    <span className="text-gray-500 ml-auto">.{lang.extension}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Copy Button */}
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
            title="Copy code"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Run Button */}
          <button
            onClick={runCode}
            disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              isRunning
                ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/20"
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Run</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-hidden" ref={editorRef as React.RefObject<HTMLDivElement>}>
        <CollaborativeEditor
          roomId={roomId}
          language={selectedLanguage}
          participantName={participantName}
          onCodeChange={handleCodeChange}
        />
      </div>

      {/* Terminal */}
      <div
        className={`border-t border-gray-800 bg-gray-950 flex flex-col transition-all ${
          isTerminalExpanded ? "h-48" : "h-10"
        }`}
      >
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-900 border-b border-gray-800">
          <button
            onClick={() => setIsTerminalExpanded(!isTerminalExpanded)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <Terminal className="w-4 h-4" />
            <span>Terminal</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                isTerminalExpanded ? "rotate-180" : ""
              }`}
            />
          </button>
          <button
            onClick={clearTerminal}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
            title="Clear terminal"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Terminal Output */}
        {isTerminalExpanded && (
          <div className="flex-1 overflow-y-auto p-3 font-mono text-sm">
            {terminalOutput.map((line, idx) => (
              <div
                key={idx}
                className={`whitespace-pre-wrap ${
                  line.startsWith("❌")
                    ? "text-red-400"
                    : line.startsWith("✅")
                    ? "text-emerald-400"
                    : line.startsWith("▶️")
                    ? "text-blue-400"
                    : line.startsWith("⚠️")
                    ? "text-amber-400"
                    : line.startsWith("💡")
                    ? "text-purple-400"
                    : "text-gray-300"
                }`}
              >
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CodeEditorSidebar;
