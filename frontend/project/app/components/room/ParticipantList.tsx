import { useParticipants } from "@livekit/components-react";
import { X, Mic, MicOff, Video, VideoOff } from "lucide-react";

export function ParticipantList({ onClose }: { onClose: () => void }) {
  const participants = useParticipants();

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-800 flex justify-between items-center">
        <h3 className="font-bold text-white">
          Participants ({participants.length})
        </h3>
        <button onClick={onClose}>
          <X className="w-5 h-5 text-gray-400 hover:text-white" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {participants.map((p) => (
          <div
            key={p.identity}
            className="flex items-center gap-3 p-3 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
              {p.name?.[0] || p.identity?.[0] || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {p.name || p.identity} {p.isLocal && "(You)"}
              </div>
              <div className="text-xs text-gray-400">
                {p.isSpeaking ? "Speaking..." : "In meeting"}
              </div>
            </div>
            <div className="flex gap-2">
              {!p.isMicrophoneEnabled ? (
                <MicOff className="w-4 h-4 text-red-400" />
              ) : (
                <Mic className="w-4 h-4 text-green-400" />
              )}
              {!p.isCameraEnabled ? (
                <VideoOff className="w-4 h-4 text-red-400" />
              ) : (
                <Video className="w-4 h-4 text-green-400" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
