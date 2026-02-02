"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bot, 
  FileText, 
  Mic,
  Languages, 
  Cpu,
  Code2,
  ClipboardList
} from "lucide-react";

const features = {
  general: [
    {
      icon: FileText,
      title: "AI Summarization",
      description: "Get comprehensive summaries and action items instantly after your call.",
      color: "bg-blue-100 text-blue-600"
    },
    {
      icon: Bot,
      title: "In-Meeting AI Assistant",
      description: "Your personal AI meeting assistant to schedule follow-ups and answer queries.",
      color: "bg-indigo-100 text-indigo-600"
    },
    {
      icon: Languages,
      title: "Live Translation",
      description: "Break language barriers with real-time voice-to-voice translation.",
      color: "bg-orange-100 text-orange-600"
    },
    {
      icon: Mic,
      title: "Live Transcription",
      description: "Accurate real-time transcription of every word spoken.",
      color: "bg-green-100 text-green-600"
    },
    {
      icon: Cpu, // Placeholder for Whiteboard if no icon available, or use something else
      title: "Whiteboard",
      description: "Collaborative whiteboard for brainstorming and visual planning.",
      color: "bg-purple-100 text-purple-600"
    }
  ],
  enterprise: [
    {
      icon: Code2,
      title: "Pair Programming",
      description: "Collaborative coding environment with syntax highlighting and shared terminals.",
      color: "bg-gray-100 text-gray-800"
    },
    {
      icon: ClipboardList,
      title: "Online Assessments",
      description: "Conduct technical interviews and assessments with automated grading tools.",
      color: "bg-red-100 text-red-600"
    }
  ]
};

export default function FeaturesSection() {
  const [activeTab, setActiveTab] = useState<'general' | 'enterprise'>('general');

  return (
    <section id="features" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Powerful Features for Every Team
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Choose the toolkit that fits your needs.
          </p>
          
          {/* Tabs */}
          <div className="inline-flex p-1 bg-gray-200 rounded-xl">
            <button
              onClick={() => setActiveTab('general')}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'general' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              General Use
            </button>
            <button
              onClick={() => setActiveTab('enterprise')}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'enterprise' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Enterprise Use
            </button>
          </div>
        </div>

        <div className="min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 justify-center"
            >
              {features[activeTab].map((feature, index) => (
                <div
                  key={index}
                  className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 flex flex-col items-start"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${feature.color}`}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
