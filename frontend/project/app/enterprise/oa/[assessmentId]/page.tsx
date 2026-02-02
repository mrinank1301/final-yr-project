"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Copy, Check, ArrowLeft, Share2 } from "lucide-react";
import { useState, useEffect } from "react";

export default function OAShareLinkPage() {
  const params = useParams();
  const assessmentId = params.assessmentId as string;
  const [shareableUrl, setShareableUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setShareableUrl(
      `${window.location.origin}/enterprise/oa/take/${assessmentId}`
    );
  }, [assessmentId]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-xl mx-auto px-4 py-10">
        <Link
          href="/enterprise/oa"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to OA setup
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Share2 className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              Shareable link ready
            </h1>
            <p className="text-gray-400 text-sm">
              Send this link to candidates to start the assessment.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
          <p className="text-xs text-gray-500 mb-2">Assessment link</p>
          <p className="text-sm text-gray-300 break-all font-mono mb-4">
            {shareableUrl || "/enterprise/oa/take/..."}
          </p>
          <button
            onClick={copyLink}
            disabled={!shareableUrl}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy link
              </>
            )}
          </button>
        </div>

        <p className="mt-6 text-gray-500 text-sm">
          When a candidate opens the link, they’ll be asked for mic/camera
          permissions, optional QR scan for phone camera, then the assessment
          will start. Code and tab switches are recorded.
        </p>

        <div className="mt-8 flex gap-3">
          <Link
            href={`/enterprise/oa/take/${assessmentId}`}
            className="px-4 py-2 text-emerald-400 hover:text-emerald-300 text-sm"
          >
            Preview as candidate →
          </Link>
          <Link
            href="/enterprise"
            className="px-4 py-2 text-gray-400 hover:text-white text-sm"
          >
            Back to Enterprise
          </Link>
        </div>
      </div>
    </main>
  );
}
