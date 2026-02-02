"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, ArrowLeft } from "lucide-react";

export default function OASetupPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<string[]>([""]);

  const addQuestion = () => setQuestions((q) => [...q, ""]);
  const removeQuestion = (i: number) =>
    setQuestions((q) => q.filter((_, idx) => idx !== i));
  const updateQuestion = (i: number, value: string) =>
    setQuestions((q) => {
      const next = [...q];
      next[i] = value;
      return next;
    });

  const handleCreate = () => {
    // Static: use a fixed assessment id for demo
    const id = "demo-assessment";
    router.push(`/enterprise/oa/${id}?created=1`);
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link
          href="/enterprise"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Enterprise
        </Link>

        <h1 className="text-2xl font-bold text-white mb-2">
          Online Assessment — Set questions
        </h1>
        <p className="text-gray-400 text-sm mb-8">
          Add the questions for this assessment. You’ll get a shareable link to
          send to candidates.
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Assessment title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Backend OA — Feb 2025"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Questions
              </label>
              <button
                type="button"
                onClick={addQuestion}
                className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 text-sm"
              >
                <Plus className="w-4 h-4" />
                Add question
              </button>
            </div>
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div
                  key={i}
                  className="flex gap-2 items-start p-4 rounded-xl bg-gray-900 border border-gray-800"
                >
                  <span className="text-gray-500 text-sm mt-3 shrink-0">
                    Q{i + 1}.
                  </span>
                  <textarea
                    value={q}
                    onChange={(e) => updateQuestion(i, e.target.value)}
                    placeholder="Paste or type the question text..."
                    rows={3}
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeQuestion(i)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg shrink-0"
                    title="Remove question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex gap-3">
          <button
            onClick={handleCreate}
            className="px-6 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors"
          >
            Create & get shareable link
          </button>
          <Link
            href="/enterprise"
            className="px-6 py-3 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-800 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </div>
    </main>
  );
}
