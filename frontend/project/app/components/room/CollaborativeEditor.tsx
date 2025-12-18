"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { oneDark } from "@codemirror/theme-one-dark";
import * as Y from "yjs";
import { yCollab } from "y-codemirror.next";
import { WebsocketProvider } from "y-websocket";
import type { ViewUpdate } from "@codemirror/view";

export type SupportedLanguage = "javascript" | "python" | "cpp" | "java";

interface CollaborativeEditorProps {
  roomId: string;
  language: SupportedLanguage;
  participantName: string;
  onCodeChange?: (code: string) => void;
}

// Consistent colors for collaborators based on name hash
const collaboratorColors = [
  "#f87171", // red
  "#fb923c", // orange
  "#fbbf24", // amber
  "#a3e635", // lime
  "#34d399", // emerald
  "#22d3ee", // cyan
  "#60a5fa", // blue
  "#a78bfa", // violet
  "#f472b6", // pink
  "#38bdf8", // sky
];

const getColorForName = (name: string) => {
  // Generate consistent color based on name hash
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % collaboratorColors.length;
  return collaboratorColors[index];
};

const getLanguageExtension = (lang: SupportedLanguage) => {
  switch (lang) {
    case "javascript":
      return javascript({ jsx: true, typescript: true });
    case "python":
      return python();
    case "cpp":
      return cpp();
    case "java":
      return java();
    default:
      return javascript();
  }
};

const getDefaultCode = (lang: SupportedLanguage): string => {
  switch (lang) {
    case "javascript":
      return `// JavaScript Code
// Start coding here...

function main() {
  console.log("Hello, World!");
}

main();
`;
    case "python":
      return `# Python Code
# Start coding here...

def main():
    print("Hello, World!")

if __name__ == "__main__":
    main()
`;
    case "cpp":
      return `// C++ Code
// Start coding here...

#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}
`;
    case "java":
      return `// Java Code
// Start coding here...

public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
`;
    default:
      return "// Start coding here...\n";
  }
};

export function CollaborativeEditor({
  roomId,
  language,
  participantName,
  onCodeChange,
}: CollaborativeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const languageCompartment = useRef(new Compartment());
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [peerCount, setPeerCount] = useState(0);
  const initRef = useRef(false);

  // Initialize the collaborative editor
  useEffect(() => {
    if (!editorRef.current || initRef.current) return;
    initRef.current = true;

    console.log(`[CodeEditor] Initializing collaborative editor for room: ${roomId}, user: ${participantName}`);

    // Create Yjs document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Get WebSocket URL from environment or default to localhost
    const pythonServerUrl = process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://localhost:5000";
    const wsUrl = pythonServerUrl.replace('http', 'ws').replace('https', 'wss');
    
    console.log(`[CodeEditor] Connecting to WebSocket: ${wsUrl}/ws/yjs/${roomId}`);

    // Create WebSocket provider connecting to our Python backend
    const provider = new WebsocketProvider(
      `${wsUrl}/ws/yjs`,
      roomId,
      ydoc,
      { connect: true }
    );
    providerRef.current = provider;

    // Set user awareness (cursor position, name, color)
    const userColor = getColorForName(participantName);
    provider.awareness.setLocalStateField("user", {
      name: participantName,
      color: userColor,
      colorLight: userColor + "33",
    });

    console.log(`[CodeEditor] User awareness set: ${participantName} with color ${userColor}`);

    // Track connection status
    provider.on("status", (event: { status: string }) => {
      console.log(`[CodeEditor] Connection status:`, event);
      if (event.status === "connected") {
        setConnectionStatus("connected");
      } else if (event.status === "disconnected") {
        setConnectionStatus("disconnected");
      } else {
        setConnectionStatus("connecting");
      }
    });

    // Also track synced status
    provider.on("sync", (isSynced: boolean) => {
      console.log(`[CodeEditor] Synced:`, isSynced);
      if (isSynced) {
        setConnectionStatus("connected");
      }
    });

    // Track connected peers via awareness
    const updatePeers = () => {
      const states = Array.from(provider.awareness.getStates().values());
      const peers: string[] = [];
      states.forEach((state) => {
        const userData = state as { user?: { name: string } };
        if (userData.user?.name) {
          peers.push(userData.user.name);
        }
      });
      setConnectedPeers(peers);
      setPeerCount(peers.length);
      console.log(`[CodeEditor] Connected peers:`, peers);
    };

    provider.awareness.on("change", updatePeers);
    provider.awareness.on("update", updatePeers);

    // Get the shared text type
    const ytext = ydoc.getText("codemirror");

    // Initialize with default code if empty (only on first user)
    const initTimeout = setTimeout(() => {
      if (ytext.toString() === "") {
        console.log(`[CodeEditor] Initializing with default code for ${language}`);
        ytext.insert(0, getDefaultCode(language));
      }
    }, 2000);

    // Create editor state with collaborative extensions
    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        languageCompartment.current.of(getLanguageExtension(language)),
        oneDark,
        yCollab(ytext, provider.awareness, { undoManager: new Y.UndoManager(ytext) }),
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (update.docChanged && onCodeChange) {
            onCodeChange(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": {
            height: "100%",
            fontSize: "14px",
          },
          ".cm-scroller": {
            overflow: "auto",
            fontFamily: "'Fira Code', 'Monaco', 'Menlo', monospace",
          },
          ".cm-gutters": {
            backgroundColor: "#1e1e1e",
            borderRight: "1px solid #333",
          },
          ".cm-activeLineGutter": {
            backgroundColor: "#2a2a2a",
          },
          // Yjs collaboration cursors - make them more visible
          ".cm-ySelectionInfo": {
            padding: "2px 6px",
            borderRadius: "4px",
            fontSize: "11px",
            fontFamily: "sans-serif",
            fontWeight: "600",
            opacity: "1",
            position: "absolute",
            top: "-1.5em",
            left: "0",
            whiteSpace: "nowrap",
            zIndex: 1000,
            pointerEvents: "none",
          },
          ".cm-ySelection": {
            opacity: "0.3",
          },
          ".cm-yLineSelection": {
            opacity: "0.2",
          },
          ".cm-yCursor": {
            position: "relative",
            borderLeft: "2px solid",
            borderRight: "none",
            marginLeft: "-1px",
            marginRight: "-1px",
          },
          ".cm-ySelectionCaret": {
            position: "relative",
            borderLeft: "2px solid",
            marginLeft: "-1px",
          },
        }),
      ],
    });

    // Create editor view
    const view = new EditorView({
      state,
      parent: editorRef.current,
    });
    viewRef.current = view;

    // Initial peer update
    updatePeers();

    return () => {
      console.log(`[CodeEditor] Cleaning up editor for room: ${roomId}`);
      clearTimeout(initTimeout);
      initRef.current = false;
      view.destroy();
      provider.awareness.off("change", updatePeers);
      provider.awareness.off("update", updatePeers);
      provider.disconnect();
      ydoc.destroy();
    };
  }, [roomId, participantName, language, onCodeChange]);

  // Update language when it changes
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: languageCompartment.current.reconfigure(
          getLanguageExtension(language)
        ),
      });
    }
  }, [language]);

  // Get current code
  const getCode = useCallback(() => {
    if (viewRef.current) {
      return viewRef.current.state.doc.toString();
    }
    return "";
  }, []);

  // Expose getCode method
  useEffect(() => {
    if (editorRef.current) {
      (editorRef.current as HTMLDivElement & { getCode?: () => string }).getCode = getCode;
    }
  }, [getCode]);

  return (
    <div className="flex flex-col h-full">
      {/* Connection status bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                connectionStatus === "connected" 
                  ? "bg-emerald-400 animate-pulse" 
                  : connectionStatus === "connecting"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-red-400"
              }`}
            />
            <span className="text-gray-400">
              {connectionStatus === "connected" 
                ? "Connected" 
                : connectionStatus === "connecting"
                ? "Connecting..."
                : "Disconnected"}
            </span>
          </div>
          {peerCount > 0 && (
            <span className="text-emerald-400 text-xs">
              ({peerCount} peer{peerCount !== 1 ? 's' : ''})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Collaborators:</span>
          <div className="flex items-center gap-1">
            {connectedPeers.length === 0 ? (
              <span className="text-gray-500 italic">Waiting for others...</span>
            ) : (
              <>
                {connectedPeers.slice(0, 5).map((peer, idx) => (
                  <span
                    key={`${peer}-${idx}`}
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ 
                      backgroundColor: getColorForName(peer) + "33",
                      color: getColorForName(peer),
                      border: `1px solid ${getColorForName(peer)}50`
                    }}
                    title={peer}
                  >
                    {peer === participantName ? `${peer} (You)` : peer.length > 10 ? peer.substring(0, 10) + "..." : peer}
                  </span>
                ))}
                {connectedPeers.length > 5 && (
                  <span className="text-gray-500">
                    +{connectedPeers.length - 5} more
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Editor container */}
      <div
        ref={editorRef}
        className="flex-1 overflow-hidden bg-[#1e1e1e]"
      />
    </div>
  );
}

export default CollaborativeEditor;
