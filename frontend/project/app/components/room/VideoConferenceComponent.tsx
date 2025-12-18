import {
  useTracks,
  GridLayout,
  ParticipantTile,
  Chat,
  RoomAudioRenderer,
  useRoomContext,
  useLocalParticipant,
} from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";
import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { AISidebar } from "./AISidebar";
import { ParticipantList } from "./ParticipantList";
import { CustomControlBar } from "./CustomControlBar";
import { CodeEditorSidebar } from "./CodeEditorSidebar";

// Message types for code editor synchronization
interface CodeEditorMessage {
  type: "code_editor_open" | "code_editor_close" | "code_editor_fullscreen";
  participantName: string;
  isFullScreen?: boolean;
}

export function VideoConferenceComponent() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const roomId = room?.name || "default-room";

  const [activeSidebar, setActiveSidebar] = useState<
    "none" | "chat" | "participants" | "ai" | "code"
  >("none");
  const [isCodeEditorFullScreen, setIsCodeEditorFullScreen] = useState(false);
  const [codeEditorStartedBy, setCodeEditorStartedBy] = useState<string | null>(null);
  const isProcessingRemoteEventRef = useRef(false);

  // Broadcast code editor state to all participants
  const broadcastCodeEditorState = useCallback((message: CodeEditorMessage) => {
    if (!room || isProcessingRemoteEventRef.current) return;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(message));
    
    room.localParticipant.publishData(data, {
      reliable: true,
    });
  }, [room]);

  // Listen for code editor messages from other participants
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const message: CodeEditorMessage = JSON.parse(decoder.decode(payload));
        
        isProcessingRemoteEventRef.current = true;
        
        if (message.type === "code_editor_open") {
          setCodeEditorStartedBy(message.participantName);
          setActiveSidebar("code");
          setIsCodeEditorFullScreen(message.isFullScreen || false);
        } else if (message.type === "code_editor_close") {
          setActiveSidebar("none");
          setCodeEditorStartedBy(null);
        } else if (message.type === "code_editor_fullscreen") {
          setIsCodeEditorFullScreen(message.isFullScreen || false);
        }
        
        // Reset the flag after a short delay
        setTimeout(() => {
          isProcessingRemoteEventRef.current = false;
        }, 100);
      } catch (e) {
        console.error("Error parsing code editor message:", e);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  const toggleSidebar = (sidebar: "chat" | "participants" | "ai" | "code") => {
    if (sidebar === "code") {
      if (activeSidebar !== "code") {
        // Opening code editor - broadcast to all
        setIsCodeEditorFullScreen(false);
        setCodeEditorStartedBy(localParticipant?.identity || "Someone");
        setActiveSidebar("code");
        broadcastCodeEditorState({
          type: "code_editor_open",
          participantName: localParticipant?.identity || "Someone",
          isFullScreen: false,
        });
      } else {
        // Closing code editor - broadcast to all
        setActiveSidebar("none");
        setCodeEditorStartedBy(null);
        broadcastCodeEditorState({
          type: "code_editor_close",
          participantName: localParticipant?.identity || "Someone",
        });
      }
    } else {
      setActiveSidebar(activeSidebar === sidebar ? "none" : sidebar);
    }
  };

  const toggleCodeEditorFullScreen = () => {
    const newFullScreenState = !isCodeEditorFullScreen;
    setIsCodeEditorFullScreen(newFullScreenState);
    broadcastCodeEditorState({
      type: "code_editor_fullscreen",
      participantName: localParticipant?.identity || "Someone",
      isFullScreen: newFullScreenState,
    });
  };

  const closeCodeEditor = () => {
    setActiveSidebar("none");
    setCodeEditorStartedBy(null);
    broadcastCodeEditorState({
      type: "code_editor_close",
      participantName: localParticipant?.identity || "Someone",
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 flex overflow-hidden">
        {/* Main Video Area - hidden when code editor is full screen */}
        {!(activeSidebar === "code" && isCodeEditorFullScreen) && (
          <div className="flex-1 p-4">
            <div className="h-full rounded-3xl overflow-hidden bg-gray-900 shadow-2xl border border-gray-800 relative">
              <GridLayout tracks={tracks}>
                <ParticipantTile />
              </GridLayout>
            </div>
          </div>
        )}

        {/* Sidebar / Full Screen Code Editor */}
        <AnimatePresence mode="wait">
          {activeSidebar !== "none" && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ 
                width: activeSidebar === "code" && isCodeEditorFullScreen ? "100%" : activeSidebar === "code" ? 600 : 400, 
                opacity: 1 
              }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="h-full bg-gray-900 border-l border-gray-800 shadow-xl z-10 flex flex-col"
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
              {activeSidebar === "code" && (
                <CodeEditorSidebar 
                  onClose={closeCodeEditor} 
                  roomId={roomId}
                  isFullScreen={isCodeEditorFullScreen}
                  onToggleFullScreen={toggleCodeEditorFullScreen}
                  startedBy={codeEditorStartedBy}
                />
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
