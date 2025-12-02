import {
  useTracks,
  GridLayout,
  ParticipantTile,
  Chat,
  RoomAudioRenderer,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { AISidebar } from "./AISidebar";
import { ParticipantList } from "./ParticipantList";
import { CustomControlBar } from "./CustomControlBar";

export function VideoConferenceComponent() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const [activeSidebar, setActiveSidebar] = useState<
    "none" | "chat" | "participants" | "ai"
  >("none");

  const toggleSidebar = (sidebar: "chat" | "participants" | "ai") => {
    setActiveSidebar(activeSidebar === sidebar ? "none" : sidebar);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 flex overflow-hidden">
        {/* Main Video Area */}
        <div className="flex-1 p-4">
          <div className="h-full rounded-3xl overflow-hidden bg-gray-900 shadow-2xl border border-gray-800 relative">
            <GridLayout tracks={tracks}>
              <ParticipantTile />
            </GridLayout>
          </div>
        </div>

        {/* Sidebar */}
        <AnimatePresence mode="wait">
          {activeSidebar !== "none" && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 400, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="h-full bg-gray-900 border-l border-gray-800 shadow-xl z-10 flex flex-col "
            >
              {activeSidebar === "ai" && (
                <AISidebar onClose={() => setActiveSidebar("none")} />
              )}
              {activeSidebar === "chat" && (
                <div className="flex flex-col h-full ">
                  <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                    <h3 className="font-bold text-white">Chat</h3>
                    <button onClick={() => setActiveSidebar("none")}>
                      <X className="w-5 h-5 text-gray-400 hover:text-white" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden custom-chat-container bg-gray-900 w-full">
                    <Chat style={{ height: '100%' }} />
                  </div>
                </div>
              )}
              {activeSidebar === "participants" && (
                <ParticipantList onClose={() => setActiveSidebar("none")} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Control Bar */}
      <CustomControlBar
        activeSidebar={activeSidebar}
        onToggleSidebar={toggleSidebar}
      />
      <RoomAudioRenderer />
    </div>
  );
}
