"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Video, Keyboard, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function HeroSection() {
  const [meetingCode, setMeetingCode] = useState("");
  const [userName, setUserName] = useState("");
  const router = useRouter();

  const handleCreateMeeting = () => {
    if (!userName.trim()) {
      alert("Please enter your name");
      return;
    }
    const roomId = Math.random().toString(36).substring(2, 10);
    router.push(`/room/${roomId}?name=${encodeURIComponent(userName)}`);
  };

  const handleJoinMeeting = () => {
    if (!userName.trim()) {
      alert("Please enter your name");
      return;
    }
    if (!meetingCode.trim()) {
      alert("Please enter a meeting code");
      return;
    }
    router.push(`/room/${meetingCode}?name=${encodeURIComponent(userName)}`);
  };

  return (
    <section className="pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-600 font-medium text-sm">
              <Sparkles className="w-4 h-4" />
              <span>AI-Powered Video Calls</span>
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-gray-900 leading-tight">
              Video calls, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                Reimagined.
              </span>
            </h1>
            
            <p className="text-xl text-gray-600 max-w-lg leading-relaxed">
              Experience the future of communication with real-time AI summarization, 
              attendance tracking, and voice translation.
            </p>

            <div className="p-6 bg-white rounded-2xl shadow-xl border border-gray-100 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-900"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleCreateMeeting}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all hover:shadow-lg hover:shadow-blue-600/20 font-medium group"
                >
                  <Video className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  New Meeting
                </button>
                
                <div className="flex-1 flex gap-2">
                  <div className="relative flex-1">
                    <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={meetingCode}
                      onChange={(e) => setMeetingCode(e.target.value)}
                      placeholder="Enter code"
                      className="w-full pl-10 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-900"
                    />
                  </div>
                  <button
                    onClick={handleJoinMeeting}
                    disabled={!meetingCode.trim()}
                    className="px-4 py-3.5 bg-gray-100 text-gray-900 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Content - Abstract Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="relative hidden lg:block"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-purple-600/20 rounded-full blur-3xl animate-pulse" />
            <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 p-4">
              <div className="aspect-square rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center relative overflow-hidden">
                {/* Decorative Elements */}
                <motion.div 
                  animate={{ y: [0, -20, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  className="absolute top-10 right-10 bg-white p-4 rounded-2xl shadow-lg flex items-center gap-3"
                >
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">AI Summary</div>
                    <div className="text-xs text-gray-500">Processing...</div>
                  </div>
                </motion.div>

                <motion.div 
                  animate={{ y: [0, 20, 0] }}
                  transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1 }}
                  className="absolute bottom-10 left-10 bg-white p-4 rounded-2xl shadow-lg flex items-center gap-3"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">HD Video</div>
                    <div className="text-xs text-gray-500">Active</div>
                  </div>
                </motion.div>

                {/* Center Circle */}
                <div className="w-48 h-48 bg-white rounded-full shadow-xl flex items-center justify-center relative z-10">
                  <div className="w-40 h-40 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
                     <Video className="w-16 h-16 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
