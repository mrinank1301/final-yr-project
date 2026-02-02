"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Video,
  VideoOff,
  BarChart3,
  Settings,
  PhoneOff,
  Plus,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  ChevronDown,
  Save,
  Play,
  ClipboardList,
  Terminal,
  Flag,
} from "lucide-react";

interface CodepairLayoutProps {
  roomId: string;
  /** If true, show as standalone page (with back link). If false, embedded in room. */
  standalone?: boolean;
}

export function CodepairLayout({ roomId, standalone = true }: CodepairLayoutProps) {
  const [question, setQuestion] = useState("");
  const [code, setCode] = useState(`def addNumbers(a,b):
    sum = a + b
    return sum

num1 = int(input())
num2 = int(input())
print("The sum is", addNumbers(num1, num2))`);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [language, setLanguage] = useState("Python 3");
  const [videoOn, setVideoOn] = useState(false);
  const [fontFamily, setFontFamily] = useState("Arial");

  const updateCursor = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.target as HTMLTextAreaElement;
    const pos = el.selectionStart;
    const lines = code.slice(0, pos).split("\n");
    setCursorPos({
      line: lines.length,
      col: (lines[lines.length - 1]?.length ?? 0) + 1,
    });
  };

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e] text-white font-sans">
      {/* Top navigation bar */}
      <header className="h-14 border-b border-gray-700 flex items-center justify-between px-4 bg-[#252526] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-emerald-500 flex items-center justify-center text-white font-bold text-sm">
            H
          </div>
          <div className="flex items-center border-l border-gray-600 pl-3 ml-1">
            <span className="text-sm font-medium text-white">Coding 1</span>
            <span className="w-0.5 h-4 bg-emerald-500 ml-2 rounded-full" />
          </div>
          <button className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
            <MessageSquare className="w-5 h-5" />
          </button>
          <button
            onClick={() => setVideoOn(!videoOn)}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
              videoOn
                ? "bg-gray-700 text-gray-300"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {videoOn ? (
              <VideoOff className="w-4 h-4" />
            ) : (
              <Video className="w-4 h-4" />
            )}
            {videoOn ? "Stop Video" : "Start Video"}
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-emerald-400 font-medium">
            <BarChart3 className="w-4 h-4" />
            Interviewer
          </button>
          <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
            <Settings className="w-5 h-5" />
          </button>
          <button className="px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-700">
            Invite
          </button>
          <button className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 flex items-center gap-2">
            <PhoneOff className="w-4 h-4" />
            Exit
          </button>
        </div>
      </header>

      {/* Main content: question left, code right */}
      <div className="flex-1 flex min-h-0">
        {/* Left panel - Question editor */}
        <div className="w-1/2 flex flex-col border-r border-gray-700 bg-[#252526]">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-white">
                Create your question
              </h2>
              <button className="text-sm text-blue-400 hover:text-blue-300">
                Library
              </button>
            </div>
            {/* Rich text toolbar */}
            <div className="flex items-center gap-1 flex-wrap">
              <ToolbarButton icon={<Bold className="w-4 h-4" />} title="Bold" />
              <ToolbarButton icon={<Italic className="w-4 h-4" />} title="Italic" />
              <ToolbarButton icon={<Underline className="w-4 h-4" />} title="Underline" />
              <ToolbarButton icon={<Strikethrough className="w-4 h-4" />} title="Strikethrough" />
              <span className="w-px h-5 bg-gray-600 mx-1" />
              <ToolbarButton icon={<List className="w-4 h-4" />} title="Bullet list" />
              <ToolbarButton icon={<ListOrdered className="w-4 h-4" />} title="Numbered list" />
              <span className="w-px h-5 bg-gray-600 mx-1" />
              <button className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-gray-700 text-gray-300 text-sm hover:bg-gray-600">
                <span className="font-serif">Aa</span> {fontFamily}
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col p-4">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Start writing your question here..."
              className="flex-1 w-full min-h-[200px] p-3 bg-[#1e1e1e] border border-gray-700 rounded-lg text-gray-300 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none text-sm"
            />
            <div className="pt-4">
              <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm font-medium">
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Right panel - Code editor */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e]">
          <div className="px-4 py-2 border-b border-gray-700 flex items-center justify-between">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700">
              {language}
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden flex">
            <div className="w-10 shrink-0 bg-[#1e1e1e] border-r border-gray-800 flex flex-col items-end pr-2 py-2 text-gray-500 font-mono text-sm select-none">
              {code.split("\n").map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onSelect={updateCursor}
              onClick={updateCursor}
              onKeyUp={updateCursor}
              className="flex-1 min-w-0 p-4 pl-2 font-mono text-sm text-gray-200 bg-transparent resize-none focus:outline-none leading-relaxed"
              spellCheck={false}
            />
          </div>

          {/* Bottom bar */}
          <div className="h-10 border-t border-gray-700 flex items-center justify-between px-4 bg-[#252526] text-sm text-gray-400">
            <button className="flex items-center gap-2 text-gray-400 hover:text-white">
              <Save className="w-4 h-4" />
              Save
            </button>
            <span>
              Line: {cursorPos.line} Col: {cursorPos.col}
            </span>
            <button className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700">
              <Play className="w-4 h-4" />
              Run Code
            </button>
          </div>
        </div>

        {/* Right sidebar - utility icons */}
        <div className="w-12 border-l border-gray-700 flex flex-col items-center py-3 gap-2 bg-[#252526]">
          <button className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg" title="Problem / Test cases">
            <ClipboardList className="w-5 h-5" />
          </button>
          <button className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg" title="Input/Output">
            <Terminal className="w-5 h-5" />
          </button>
          <button className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg" title="Bookmark">
            <Flag className="w-5 h-5" />
          </button>
        </div>
      </div>

      {standalone && (
        <div className="absolute top-4 left-4 z-10">
          <Link
            href="/enterprise/interview"
            className="text-sm text-gray-400 hover:text-white"
          >
            ← Back to Interview
          </Link>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <button
      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
      title={title}
    >
      {icon}
    </button>
  );
}

export default CodepairLayout;
