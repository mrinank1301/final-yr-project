"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  LiveKitRoom,
  ConnectionStateToast,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { VideoConferenceComponent } from "../../components/room/VideoConferenceComponent";

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const userName = searchParams.get("name") || "Guest";

  const [token, setToken] = useState<string>("");
  const [serverUrl, setServerUrl] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const response = await fetch(`${apiUrl}/api/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomName: roomId,
            participantName: userName,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch token");
        }

        const data = await response.json();
        setToken(data.token);
        setServerUrl(data.url);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching token:", err);
        setError(
          "Failed to connect to the server. Please make sure the backend is running."
        );
        setIsLoading(false);
      }
    };

    fetchToken();
  }, [roomId, userName]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400 text-lg">Connecting to room...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="text-center max-w-md p-8 bg-red-900/20 rounded-2xl border border-red-500/30">
          <h2 className="text-xl font-semibold text-red-400 mb-4">
            Connection Error
          </h2>
          <p className="text-red-300 mb-6">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (!token || !serverUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <p className="text-gray-400 text-lg">Initializing...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-950 text-white">
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={serverUrl}
        connect={true}
        onDisconnected={() => router.push("/")}
        data-lk-theme="default"
        className="h-full w-full"
      >
        <VideoConferenceComponent />
        <ConnectionStateToast />
      </LiveKitRoom>
    </div>
  );
}
