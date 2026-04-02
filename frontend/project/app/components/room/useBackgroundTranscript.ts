"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRemoteParticipants, useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";

const CHUNK_INTERVAL_MS = 5000;

/**
 * Always-on background hook that captures all meeting audio (remote + local)
 * and sends it to the backend for transcription. The backend stores transcripts
 * per room_id so the post-meeting summary page always has data.
 */
export function useBackgroundTranscript(roomId: string) {
  const remoteParticipants = useRemoteParticipants();
  const { localParticipant } = useLocalParticipant();
  const remoteRef = useRef(remoteParticipants);
  const localRef = useRef(localParticipant);
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => { remoteRef.current = remoteParticipants; }, [remoteParticipants]);
  useEffect(() => { localRef.current = localParticipant; }, [localParticipant]);

  const captureChunk = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const tracks: MediaStreamTrack[] = [];

    // Remote participants
    remoteRef.current.forEach((p) => {
      const pub = p.getTrackPublication(Track.Source.Microphone);
      const t = pub?.track?.mediaStreamTrack;
      if (t && t.readyState === "live") tracks.push(t);
    });

    // Local participant
    const localPub = localRef.current?.getTrackPublication(Track.Source.Microphone);
    const localTrack = localPub?.track?.mediaStreamTrack;
    if (localTrack && localTrack.readyState === "live") tracks.push(localTrack);

    if (tracks.length === 0) return;

    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") await ctx.resume();

      const dest = ctx.createMediaStreamDestination();
      tracks.forEach((t) => {
        try {
          ctx.createMediaStreamSource(new MediaStream([t])).connect(dest);
        } catch { /* ignore */ }
      });

      const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4", ""];
      let mime = "";
      for (const m of mimeTypes) {
        if (m === "" || MediaRecorder.isTypeSupported(m)) { mime = m; break; }
      }

      const opts: MediaRecorderOptions = {};
      if (mime) opts.mimeType = mime;

      const recorder = new MediaRecorder(dest.stream, opts);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      const ws = wsRef.current;
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mime || "audio/webm" });
        if (blob.size < 1000) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            const b64 = (reader.result as string).split(",")[1];
            ws.send(JSON.stringify({ type: "audio_chunk", data: b64 }));
          }
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, CHUNK_INTERVAL_MS - 500);
    } catch {
      // capture error — skip this chunk
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const pythonServerUrl =
      typeof window !== "undefined" && (process.env.NEXT_PUBLIC_PYTHON_API_URL || "").trim() === ""
        ? window.location.origin
        : process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://localhost:5000";
    const wsUrl = `${pythonServerUrl.replace("https", "wss").replace("http", "ws")}/ws/meeting-transcript/${roomId}`;

    const connect = () => {
      if (!mountedRef.current) return;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[BackgroundTranscript] Connected for room", roomId);
        const name = localRef.current?.identity || "Participant";
        ws.send(JSON.stringify({ type: "set_participant", name }));

        captureChunk();
        intervalRef.current = setInterval(captureChunk, CHUNK_INTERVAL_MS);
      };

      ws.onclose = () => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        if (mountedRef.current) setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [roomId, captureChunk]);
}
