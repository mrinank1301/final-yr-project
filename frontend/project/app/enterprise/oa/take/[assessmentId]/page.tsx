"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Check,
  ArrowRight,
  QrCode,
  Smartphone,
} from "lucide-react";

type Step = "permissions" | "qr" | "test";

export default function OATakePage() {
  const params = useParams();
  const assessmentId = params.assessmentId as string;
  const [step, setStep] = useState<Step>("permissions");
  const [micAllowed, setMicAllowed] = useState(false);
  const [cameraAllowed, setCameraAllowed] = useState(false);

  const canProceedFromPermissions = micAllowed && cameraAllowed;

  const goNext = () => {
    if (step === "permissions" && canProceedFromPermissions) setStep("qr");
    else if (step === "qr") setStep("test");
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {step === "permissions" && (
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">
            Before you start
          </h1>
          <p className="text-gray-400 mb-10">
            Allow microphone and camera so we can proctor the assessment.
          </p>

          <div className="space-y-4 mb-10">
            <div
              className={`flex items-center justify-between p-4 rounded-xl border ${
                micAllowed ? "border-emerald-500/50 bg-emerald-500/10" : "border-gray-700 bg-gray-900"
              }`}
            >
              <div className="flex items-center gap-3">
                {micAllowed ? (
                  <Mic className="w-6 h-6 text-emerald-400" />
                ) : (
                  <MicOff className="w-6 h-6 text-gray-500" />
                )}
                <span className="text-white">Microphone</span>
              </div>
              <button
                onClick={() => setMicAllowed(!micAllowed)}
                className="text-sm text-emerald-400 hover:text-emerald-300"
              >
                {micAllowed ? "Allowed" : "Allow"}
              </button>
            </div>
            <div
              className={`flex items-center justify-between p-4 rounded-xl border ${
                cameraAllowed ? "border-emerald-500/50 bg-emerald-500/10" : "border-gray-700 bg-gray-900"
              }`}
            >
              <div className="flex items-center gap-3">
                {cameraAllowed ? (
                  <Video className="w-6 h-6 text-emerald-400" />
                ) : (
                  <VideoOff className="w-6 h-6 text-gray-500" />
                )}
                <span className="text-white">Camera</span>
              </div>
              <button
                onClick={() => setCameraAllowed(!cameraAllowed)}
                className="text-sm text-emerald-400 hover:text-emerald-300"
              >
                {cameraAllowed ? "Allowed" : "Allow"}
              </button>
            </div>
          </div>

          <button
            onClick={goNext}
            disabled={!canProceedFromPermissions}
            className="w-full py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === "qr" && (
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">
            Optional: Phone proctoring
          </h1>
          <p className="text-gray-400 mb-8">
            Scan the QR code with your phone to turn on your phone’s camera for
            additional proctoring (like LeetCode).
          </p>

          <div className="w-48 h-48 mx-auto mb-8 rounded-2xl bg-white flex items-center justify-center">
            <QrCode className="w-24 h-24 text-gray-800" />
          </div>

          <div className="flex items-center gap-2 justify-center mb-8 text-gray-400 text-sm">
            <Smartphone className="w-4 h-4" />
            <span>Scan with your phone — camera will turn on when scanned</span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("test")}
              className="flex-1 py-3 bg-gray-800 text-white font-medium rounded-xl hover:bg-gray-700 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={() => setStep("test")}
              className="flex-1 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              I scanned
            </button>
          </div>
        </div>
      )}

      {step === "test" && (
        <OATestView assessmentId={assessmentId} />
      )}
    </main>
  );
}

function OATestView({ assessmentId }: { assessmentId: string }) {
  const [code, setCode] = useState(`def addNumbers(a,b):\n    sum = a + b\n    return sum\n\nnum1 = int(input())\nnum2 = int(input())\nprint("The sum is", addNumbers(num1, num2))`);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [isRecording, setIsRecording] = useState(true);

  return (
    <div className="h-screen flex flex-col bg-gray-950 relative">
      {/* Top bar - minimal for OA */}
      <header className="h-14 border-b border-gray-800 flex items-center justify-between px-4 bg-gray-900 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-medium">Assessment</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-400 text-sm">
            {isRecording && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Recording
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="text-blue-400">Tab switches: {tabSwitchCount}</span>
          <span className="text-gray-600">|</span>
          <span>Line: {cursorPos.line} Col: {cursorPos.col}</span>
        </div>
      </header>

      {/* Main: question left, code right */}
      <div className="flex-1 flex min-h-0">
        <div className="w-1/2 border-r border-gray-800 flex flex-col bg-gray-900">
          <div className="p-4 border-b border-gray-800">
            <h2 className="font-semibold text-white">Question</h2>
          </div>
          <div className="flex-1 overflow-auto p-4 text-gray-300 text-sm whitespace-pre-wrap">
            {"Add two numbers.\n\nYou are given two integers. Return their sum.\n\nInput: two integers (one per line)\nOutput: one line \"The sum is <result>\""}
          </div>
        </div>
        <div className="w-1/2 flex flex-col bg-gray-950">
          <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
            <span className="text-gray-400 text-sm">Python 3</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onSelect={(e) => {
                const el = e.target as HTMLTextAreaElement;
                const pos = el.selectionStart;
                const lines = code.slice(0, pos).split("\n");
                setCursorPos({
                  line: lines.length,
                  col: (lines[lines.length - 1]?.length ?? 0) + 1,
                });
              }}
              className="w-full h-full p-4 font-mono text-sm text-gray-200 bg-transparent resize-none focus:outline-none"
              spellCheck={false}
            />
          </div>
          <div className="h-10 border-t border-gray-800 flex items-center justify-between px-4 bg-gray-900 text-sm text-gray-400">
            <span>Line: {cursorPos.line} Col: {cursorPos.col}</span>
            <button className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700">
              Run Code
            </button>
          </div>
        </div>
      </div>

      {/* Blue dot / tab switch indicator - static demo */}
      <div className="absolute top-20 right-6 flex flex-col gap-2">
        <button
          onClick={() => setTabSwitchCount((c) => c + 1)}
          className="text-xs text-gray-500 hover:text-blue-400"
        >
          Simulate tab switch
        </button>
        {tabSwitchCount > 0 && (
          <div className="w-3 h-3 rounded-full bg-blue-500" title="Tab switch detected" />
        )}
      </div>
    </div>
  );
}
