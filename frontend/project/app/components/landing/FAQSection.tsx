"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";

const faqs = [
  {
    question: "Is Standby AI really free?",
    answer: "Yes! Standby AI is completely free for up to 100 participants per meeting. We believe in democratizing access to advanced communication tools."
  },
  {
    question: "How does the AI summarization work?",
    answer: "Our advanced AI listens to the meeting audio in real-time and generates a comprehensive summary, including key decisions and action items, immediately after the meeting ends."
  },
  {
    question: "Is my data secure?",
    answer: "Absolutely. We use end-to-end encryption for all video calls. AI processing happens securely, and we do not store your meeting data unless you explicitly choose to save recordings."
  },
  {
    question: "Do I need to install any software?",
    answer: "No installation required! Standby AI works directly in your modern web browser. Just share the link and start meeting."
  },
  {
    question: "What languages does the translation support?",
    answer: "We currently support real-time voice translation for over 30 major languages, including English, Spanish, French, German, Chinese, Japanese, and more."
  }
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Frequently Asked Questions
        </h2>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-medium text-gray-900">{faq.question}</span>
                {openIndex === index ? (
                  <Minus className="w-5 h-5 text-blue-600" />
                ) : (
                  <Plus className="w-5 h-5 text-gray-400" />
                )}
              </button>
              
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="px-6 pb-6 text-gray-600 leading-relaxed">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
