"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Video, Code2 } from "lucide-react";

export default function InterviewPage() {
  const router = useRouter();
  const [roomName, setRoomName] = useState("");
  const [joinLink, setJoinLink] = useState("");
  const [mode, setMode] = useState<"create" | "join">("create");

  const handleCreate = () => {
    const id = roomName.trim() || `interview-${Date.now()}`;
    router.push(`/room/${id}?name=Interviewer&mode=interview`);
  };

  const handleJoin = () => {
    try {
      const url = new URL(joinLink.trim());
      const pathParts = url.pathname.split("/");
      const roomId = pathParts[pathParts.indexOf("room") + 1];
      if (roomId) {
        const name = url.searchParams.get("name") || "Candidate";
        router.push(`/room/${roomId}?name=${encodeURIComponent(name)}&mode=interview`);
      }
    } catch {
      router.push(`/room/${joinLink.trim() || "interview-room"}?name=Guest&mode=interview`);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-lg mx-auto px-4 py-10">
        <Link
          href="/enterprise"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Enterprise
        </Link>

        <h1 className="text-2xl font-bold text-white mb-2">Interview</h1>
        <p className="text-gray-400 text-sm mb-8">
          Start a video call. Once in the room, you can open{" "}
          <strong className="text-emerald-400">Codepair</strong> to paste the
          question and share a live code editor with the candidate.
        </p>

        <div className="flex gap-2 p-1 bg-gray-900 rounded-xl mb-8">
          <button
            onClick={() => setMode("create")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              mode === "create"
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Create room
          </button>
          <button
            onClick={() => setMode("join")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              mode === "join"
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Join with link
          </button>
        </div>

        {mode === "create" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Room name
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g. john-doe-interview"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <button
              onClick={handleCreate}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Video className="w-5 h-5" />
              Start video call
            </button>
            <p className="text-gray-500 text-sm text-center">
              In the call you’ll see an option to open Codepair (shared code +
              question).
            </p>
          </div>
        )}

        {mode === "join" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Meeting link or room ID
              </label>
              <input
                type="text"
                value={joinLink}
                onChange={(e) => setJoinLink(e.target.value)}
                placeholder="https://.../room/abc123 or room ID"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <button
              onClick={handleJoin}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Video className="w-5 h-5" />
              Join call
            </button>
          </div>
        )}

        <div className="mt-10 p-4 rounded-xl bg-gray-900 border border-gray-800">
          <div className="flex items-center gap-2 text-emerald-400 mb-2">
            <Code2 className="w-5 h-5" />
            <span className="font-medium">Codepair</span>
          </div>
          <p className="text-gray-400 text-sm">
            After joining the video call, click the code editor / Codepair
            button to open the shared view: you paste the question on the left,
            the candidate codes on the right — both see the same code in real
            time.
          </p>
          <Link
            href="/enterprise/interview/codepair/demo"
            className="inline-block mt-3 text-sm text-emerald-400 hover:text-emerald-300"
          >
            Preview Codepair layout →
          </Link>
        </div>
      </div>
    </main>
  );
}
