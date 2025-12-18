"use client";

import { motion } from "framer-motion";
import { Shield, Globe, Zap, Heart } from "lucide-react";

const reasons = [
  {
    icon: Shield,
    title: "Enterprise-Grade Security",
    description: "End-to-end encryption and advanced privacy controls keep your meetings secure."
  },
  {
    icon: Globe,
    title: "Global Low Latency",
    description: "Distributed edge network ensures crystal clear video and audio from anywhere."
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Optimized for performance with minimal CPU and memory usage."
  },
  {
    icon: Heart,
    title: "User Friendly",
    description: "Intuitive interface designed for everyone, from tech-savvy teams to grandparents."
  }
];

export default function WhyUsSection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Why choose Standby AI?
            </h2>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              We've rebuilt video conferencing from the ground up, integrating cutting-edge AI 
              to solve the biggest pain points of remote collaboration.
            </p>
            
            <div className="grid sm:grid-cols-2 gap-8">
              {reasons.map((reason, index) => (
                <div key={index} className="space-y-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                    <reason.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-gray-900">{reason.title}</h3>
                  <p className="text-sm text-gray-600">{reason.description}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-2xl rotate-3 opacity-10" />
            <div className="relative bg-gray-900 rounded-2xl p-8 shadow-2xl">
              {/* Abstract UI representation */}
              <div className="flex items-center justify-between mb-8 border-b border-gray-800 pb-4">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="h-2 w-20 bg-gray-800 rounded-full" />
              </div>
              
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-1/3 aspect-video bg-gray-800 rounded-lg animate-pulse" />
                  <div className="w-2/3 space-y-2">
                    <div className="h-2 w-full bg-gray-800 rounded-full" />
                    <div className="h-2 w-3/4 bg-gray-800 rounded-full" />
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-1/3 aspect-video bg-gray-800 rounded-lg animate-pulse delay-75" />
                  <div className="w-2/3 space-y-2">
                    <div className="h-2 w-full bg-gray-800 rounded-full" />
                    <div className="h-2 w-3/4 bg-gray-800 rounded-full" />
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-1/3 aspect-video bg-gray-800 rounded-lg animate-pulse delay-150" />
                  <div className="w-2/3 space-y-2">
                    <div className="h-2 w-full bg-gray-800 rounded-full" />
                    <div className="h-2 w-3/4 bg-gray-800 rounded-full" />
                  </div>
                </div>
              </div>

              <div className="mt-8 p-4 bg-gray-800 rounded-xl border border-gray-700">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs font-medium text-gray-300">AI Analysis Active</span>
                </div>
                <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full w-3/4 bg-blue-500 rounded-full" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
