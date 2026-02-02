"use client";

import Link from "next/link";
import { FileQuestion, Video, ArrowRight } from "lucide-react";

export default function EnterprisePage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-14">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Enterprise
          </h1>
          <p className="text-gray-400 text-lg">
            Choose how you want to run your session
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Online Assessment */}
          <Link
            href="/enterprise/oa"
            className="group block p-8 rounded-2xl bg-gray-900 border border-gray-800 hover:border-emerald-500/50 hover:bg-gray-900/80 transition-all"
          >
            <div className="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-5 group-hover:bg-emerald-500/30 transition-colors">
              <FileQuestion className="w-7 h-7 text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Online Assessment (OA)
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Set questions, share a link with candidates. They complete the
              assessment with mic/camera and optional phone proctoring. Code and
              tab activity are recorded.
            </p>
            <span className="inline-flex items-center gap-2 text-emerald-400 text-sm font-medium">
              Set up assessment
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </Link>

          {/* Interview */}
          <Link
            href="/enterprise/interview"
            className="group block p-8 rounded-2xl bg-gray-900 border border-gray-800 hover:border-blue-500/50 hover:bg-gray-900/80 transition-all"
          >
            <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center mb-5 group-hover:bg-blue-500/30 transition-colors">
              <Video className="w-7 h-7 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Interview
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Live video call with the option to use Codepair — shared code
              editor where you paste the question and the candidate codes in
              real time (HackerRank-style).
            </p>
            <span className="inline-flex items-center gap-2 text-blue-400 text-sm font-medium">
              Start interview
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </Link>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/"
            className="text-gray-500 hover:text-gray-400 text-sm"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
