"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Video, Keyboard, ArrowRight, Sparkles, CheckCircle, Play } from "lucide-react";
import { motion } from "framer-motion";

export default function HeroSection() {
  const [meetingCode, setMeetingCode] = useState("");
  const [userName, setUserName] = useState("");
  const [isInputVisible, setIsInputVisible] = useState(false);
  const router = useRouter();

  const handleStart = () => {
    // Reveal input or redirect if name is already set
    if (!isInputVisible) {
      setIsInputVisible(true);
      return;
    }
    
    if (!userName.trim()) {
      alert("Please enter your name");
      return;
    }
    const roomId = Math.random().toString(36).substring(2, 10);
    router.push(`/room/${roomId}?name=${encodeURIComponent(userName)}`);
  };

  const handleJoin = () => {
     if (!isInputVisible) {
      setIsInputVisible(true);
      return;
    }

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
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-white">
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 z-0 opacity-[0.03]" 
           style={{ 
             backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', 
             backgroundSize: '50px 50px' 
           }}>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        
        {/* Floating Avatars (Decorative) */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="absolute top-0 left-10 lg:left-40 hidden md:block"
        >
          <div className="flex items-center gap-2 bg-white p-2 rounded-full shadow-lg border border-gray-100">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" className="w-10 h-10 rounded-full bg-gray-100" />
            <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-white absolute -bottom-1 -right-1"></div>
            <div className="absolute -right-12 -top-6 bg-green-500 text-white text-xs px-2 py-1 rounded">Meghana</div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
          className="absolute top-35 right-10 lg:right-40 hidden md:block"
        >
          <div className="flex items-center gap-2 bg-white p-2 rounded-full shadow-lg border border-gray-100">
             <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka" alt="User" className="w-10 h-10 rounded-full bg-gray-100" />
             <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white absolute -bottom-1 -right-1"></div>
             <div className="absolute -left-12 -bottom-6 bg-blue-600 text-white text-xs px-2 py-1 rounded">Pushpender</div>
          </div>
        </motion.div>

         {/* Badge */}
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-600 text-xs font-semibold uppercase tracking-wider mb-8"
        >
          <Sparkles className="w-3 h-3 text-yellow-500" />
          <span>Create For Fast</span>
        </motion.div>

        {/* Headline */}
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl lg:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-black to-blue-900 leading-tight mb-6"
        >
          Where Real-Time Calls  <span className="underline decoration-green-400 decoration-4 underline-offset-4 text-gray-900">Meet</span> <br />
          Real Intelligence
        </motion.h1>
        
        {/* Subheadline */}
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-xl text-gray-600 max-w-3xl mx-auto mb-10 leading-relaxed"
        >
          One platform for intelligent conversationsfrom daily calls to enterprise workflows.
        </motion.p>
        
        {/* Helper Description for Inputs if visible */}
        {isInputVisible && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 max-w-md mx-auto space-y-4"
          >
             <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black transition-all text-gray-900"
            />
             <div className="flex gap-2">
                 <input
                  type="text"
                  value={meetingCode}
                  onChange={(e) => setMeetingCode(e.target.value)}
                  placeholder="Meeting Code (for joining)"
                  className="flex-1 px-4 py-3 bg-gray-50 border text-gray-900 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black transition-all"
                />
             </div>
          </motion.div>
        )}

        {/* Buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button 
            onClick={handleStart}
            className="px-8 py-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all font-medium text-lg shadow-lg hover:shadow-xl w-full sm:w-auto"
          >
            {isInputVisible ? "Create New Meeting" : "Start Now"}
          </button>
          <button 
             onClick={handleJoin}
             className="px-8 py-4 bg-white text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all font-medium text-lg w-full sm:w-auto"
          >
            {isInputVisible ? "Join Existing" : "Join a Meeting"}
          </button>
        </motion.div>
      </div>
    </section>
  );
}
