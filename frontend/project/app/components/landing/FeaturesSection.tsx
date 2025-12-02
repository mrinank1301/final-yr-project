"use client";

import { motion } from "framer-motion";
import { 
  Bot, 
  FileText, 
  Users, 
  MessageSquare, 
  Languages, 
  Zap 
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "AI Meeting Summarization",
    description: "Never take notes again. Get comprehensive summaries and action items instantly after your call.",
    color: "bg-blue-100 text-blue-600"
  },
  {
    icon: Users,
    title: "AI Agent Attendance",
    description: "Automated attendance tracking with facial recognition and participation analytics.",
    color: "bg-purple-100 text-purple-600"
  },
  {
    icon: MessageSquare,
    title: "Real-time AI Feedback",
    description: "Get live coaching on your presentation style, pacing, and engagement metrics.",
    color: "bg-green-100 text-green-600"
  },
  {
    icon: Languages,
    title: "Voice Translation",
    description: "Break language barriers with real-time voice-to-voice translation in 30+ languages.",
    color: "bg-orange-100 text-orange-600"
  },
  {
    icon: Zap,
    title: "Free for Everyone",
    description: "Host meetings with up to 100 participants completely free of charge. No credit card required.",
    color: "bg-pink-100 text-pink-600"
  },
  {
    icon: Bot,
    title: "Smart Assistant",
    description: "Your personal AI meeting assistant to schedule follow-ups and manage tasks.",
    color: "bg-indigo-100 text-indigo-600"
  }
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Supercharged with AI
          </h2>
          <p className="text-lg text-gray-600">
            Experience the next generation of video conferencing with our suite of powerful AI tools designed to make your meetings more productive.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100"
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
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
