"use client";

import { Check } from "lucide-react";

export default function PricingSection() {
  return (
    <section id="pricing" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-black to-blue-900 mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-gray-600">
            Start for free, upgrade as you grow.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* General Plan */}
          <div className="p-8 bg-gray-50 rounded-3xl border border-gray-200 hover:shadow-xl transition-all relative">
             <h3 className="text-xl font-bold text-gray-900 mb-2">General Use</h3>
             <div className="flex items-baseline mb-6">
                <span className="text-5xl font-extrabold tracking-tight text-gray-900">$0</span>
                <span className="ml-1 text-xl font-semibold text-gray-500">/month</span>
             </div>
             <p className="text-gray-600 mb-8">Perfect for individuals and small teams.</p>
             <ul className="space-y-4 mb-8">
               {['AI Summarization', 'Live Translation','Live Transcription' ,'In-meeting Assistant', 'Unlimited Meetings','100 participants max'].map((feature) => (
                 <li key={feature} className="flex items-center text-gray-600">
                   <Check className="w-5 h-5 text-green-500 mr-2" />
                   {feature}
                 </li>
               ))}
             </ul>
             <button className="w-full py-3 px-6 rounded-xl bg-white text-gray-900 border border-gray-200 font-medium hover:bg-gray-50 transition-colors">
               Get Started
             </button>
          </div>

          {/* Enterprise Plan */}
          <div className="p-8 bg-gradient-to-br from-black to-blue-950 text-white rounded-3xl border border-gray-800 hover:shadow-2xl transition-all relative">
             <h3 className="text-xl font-bold text-white mb-2">Enterprise Use</h3>
             <div className="flex items-baseline mb-6">
                <span className="text-4xl font-extrabold tracking-tight text-white">Contact Sales</span>
             </div>
             <p className="text-gray-400 mb-8">For organizations requiring advanced tools.</p>
             <ul className="space-y-4 mb-8">
               {['All General Features','Unlimited Participants', 'Pair Programming', 'Online Assessments', 'Interview Mode', 'Priority Support'].map((feature) => (
                 <li key={feature} className="flex items-center text-gray-300">
                   <Check className="w-5 h-5 text-blue-400 mr-2" />
                   {feature}
                 </li>
               ))}
             </ul>
             <button className="w-full py-3 px-6 rounded-xl bg-white text-black font-medium hover:bg-gray-100 transition-colors shadow-lg">
               Contact Sales
             </button>
          </div>
        </div>
      </div>
    </section>
  );
}
