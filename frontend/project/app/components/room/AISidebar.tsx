import { Bot, X, Send } from "lucide-react";

export function AISidebar({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400">
            <Bot className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white">AI Assistant</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900">
        <div className="flex gap-3">
          <div className="w-8 h-8 bg-indigo-500/20 rounded-full flex items-center justify-center shrink-0 mt-1">
            <Bot className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="bg-gray-800 p-3 rounded-2xl rounded-tl-none text-sm text-gray-300 border border-gray-700">
            Hello! I'm your AI meeting assistant. I'm listening to the conversation and can help you with summaries, translations, or answering questions.
          </div>
        </div>
        
        <div className="flex gap-3 flex-row-reverse">
           <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shrink-0 mt-1">
            <span className="text-xs font-bold text-white">ME</span>
          </div>
          <div className="bg-blue-600 text-white p-3 rounded-2xl rounded-tr-none text-sm">
            Can you summarize the last 5 minutes?
          </div>
        </div>

         <div className="flex gap-3">
          <div className="w-8 h-8 bg-indigo-500/20 rounded-full flex items-center justify-center shrink-0 mt-1">
            <Bot className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="bg-gray-800 p-3 rounded-2xl rounded-tl-none text-sm text-gray-300 border border-gray-700">
            Sure! In the last 5 minutes, the team discussed the new landing page design. Key points:
            <ul className="list-disc ml-4 mt-2 space-y-1">
              <li>Approved the white/minimal aesthetic.</li>
              <li>Decided to use Framer Motion for animations.</li>
              <li>Agreed on the 5 key AI features to highlight.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-800 bg-gray-900">
        <div className="relative">
          <input
            type="text"
            placeholder="Ask AI something..."
            className="w-full pl-4 pr-10 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-white placeholder-gray-500"
          />
          <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
