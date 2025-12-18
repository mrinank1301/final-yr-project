import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MessageSquare,
  Users,
  Bot,
  PhoneOff,
  Code2,
} from "lucide-react";
import { useState } from "react";
import { ControlButton } from "./ControlButton";
import { DeviceMenu } from "./DeviceMenu";

interface CustomControlBarProps {
  activeSidebar: string;
  onToggleSidebar: (sidebar: "chat" | "participants" | "ai" | "code") => void;
}

export function CustomControlBar({
  activeSidebar,
  onToggleSidebar,
}: CustomControlBarProps) {
  const { localParticipant } = useLocalParticipant();
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const toggleMic = async () => {
    if (localParticipant) {
      const newState = !isMicOn;
      await localParticipant.setMicrophoneEnabled(newState);
      setIsMicOn(newState);
    }
  };

  const toggleCam = async () => {
    if (localParticipant) {
      const newState = !isCamOn;
      await localParticipant.setCameraEnabled(newState);
      setIsCamOn(newState);
    }
  };

  const toggleScreenShare = async () => {
    if (localParticipant) {
      const newState = !isScreenSharing;
      await localParticipant.setScreenShareEnabled(newState);
      setIsScreenSharing(newState);
    }
  };

  const room = useRoomContext();

  return (
    <div className="h-20 bg-gray-900 border-t border-gray-800 px-4 flex items-center justify-between shrink-0 z-20">
      <div className="flex-1 hidden md:block text-sm font-medium text-gray-400">
        {room?.name || "Meeting Room"}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center bg-gray-800 rounded-xl p-1">
          <ControlButton
            onClick={toggleMic}
            isActive={!isMicOn}
            activeClass="bg-red-500/20 text-red-500 hover:bg-red-500/30"
            inactiveClass="text-gray-300 hover:bg-gray-700"
            className="rounded-lg"
          >
            {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </ControlButton>
          <DeviceMenu kind="audioinput" />
        </div>

        <div className="flex items-center bg-gray-800 rounded-xl p-1">
          <ControlButton
            onClick={toggleCam}
            isActive={!isCamOn}
            activeClass="bg-red-500/20 text-red-500 hover:bg-red-500/30"
            inactiveClass="text-gray-300 hover:bg-gray-700"
            className="rounded-lg"
          >
            {isCamOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </ControlButton>
          <DeviceMenu kind="videoinput" />
        </div>

        <ControlButton
          onClick={toggleScreenShare}
          isActive={isScreenSharing}
          activeClass="bg-green-500/20 text-green-500 hover:bg-green-500/30"
          inactiveClass="bg-gray-800 text-gray-300 hover:bg-gray-700"
        >
          <Monitor className="w-5 h-5" />
        </ControlButton>

        <div className="w-px h-8 bg-gray-700 mx-2" />

        <ControlButton
          onClick={() => onToggleSidebar("chat")}
          isActive={activeSidebar === "chat"}
          activeClass="bg-blue-600 text-white hover:bg-blue-700 "
          inactiveClass="bg-gray-800 text-gray-300 hover:bg-gray-700"
        >
          <MessageSquare className="w-5 h-5" />
        </ControlButton>

        <ControlButton
          onClick={() => onToggleSidebar("participants")}
          isActive={activeSidebar === "participants"}
          activeClass="bg-blue-600 text-white hover:bg-blue-700"
          inactiveClass="bg-gray-800 text-gray-300 hover:bg-gray-700"
        >
          <Users className="w-5 h-5" />
        </ControlButton>

        <ControlButton
          onClick={() => onToggleSidebar("ai")}
          isActive={activeSidebar === "ai"}
          activeClass="bg-indigo-600 text-white hover:bg-indigo-700"
          inactiveClass="bg-gray-800 text-gray-300 hover:bg-gray-700"
        >
          <Bot className="w-5 h-5" />
        </ControlButton>

        <ControlButton
          onClick={() => onToggleSidebar("code")}
          isActive={activeSidebar === "code"}
          activeClass="bg-emerald-600 text-white hover:bg-emerald-700"
          inactiveClass="bg-gray-800 text-gray-300 hover:bg-gray-700"
        >
          <Code2 className="w-5 h-5" />
        </ControlButton>

        <div className="w-px h-8 bg-gray-700 mx-2" />

        <button
          onClick={() => {
            room.disconnect();
            // The onDisconnected prop in LiveKitRoom will handle the redirect
          }}
          className="p-3 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 hidden md:flex justify-end">
        {/* Additional controls or info could go here */}
      </div>
    </div>
  );
}
