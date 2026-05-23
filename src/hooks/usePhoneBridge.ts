/**
 * Starts a WHIP publish session to camera-stream-service.
 * Phase 1: uses device camera (Reolink RTSP needs Pi/native FFmpeg plugin).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCameraSFUOrigin } from "@/config/cameraStream";
import { getICEServers } from "@/config/webrtc";

export type PhoneBridgeStatus = "idle" | "connecting" | "live" | "error";

export function usePhoneBridge(patientId: string | undefined) {
  const [status, setStatus] = useState<PhoneBridgeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const resourceRef = useRef<string | null>(null);
  const hbRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const startRef = useRef<(() => Promise<void>) | null>(null);
  const stoppedRef = useRef(true); // true = intentionally stopped, do NOT auto-reconnect
  const reconnectingRef = useRef(false);

  const stop = useCallback(async () => {
    stoppedRef.current = true;
    if (hbRef.current) {
      clearInterval(hbRef.current);
      hbRef.current = null;
    }
    const pc = pcRef.current;
    pcRef.current = null;
    if (pc) {
      try {
        pc.getSenders().forEach((s) => s.track && s.track.stop());
        await pc.close();
      } catch {
        /* ignore */
      }
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    const sfu = getCameraSFUOrigin();
    const resId = resourceRef.current;
    resourceRef.current = null;
    if (sfu && patientId && resId) {
      const { data: sess } = await supabase.auth.getSession();
      const tok = sess?.session?.access_token;
      if (tok) {
        await fetch(`${sfu}/whip/${patientId}/${resId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${tok}` },
        }).catch(() => {});
      }
    }
    setStatus("idle");
  }, [patientId]);

  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  const start = useCallback(async () => {
    if (!patientId) {
      setError("Missing patient id");
      setStatus("error");
      return;
    }
    const sfu = getCameraSFUOrigin();
    if (!sfu) {
      setError("VITE_CAMERA_SFU_URL is not set");
      setStatus("error");
      return;
    }
    setError(null);
    setStatus("connecting");
    await stop();
    // We're starting on purpose now — re-enable auto-reconnect.
    stoppedRef.current = false;

    const { data: sess } = await supabase.auth.getSession();
    const tok = sess?.session?.access_token;
    if (!tok) {
      setError("Not signed in");
      setStatus("error");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
    } catch (e: any) {
      setError(e?.message || "Camera permission denied");
      setStatus("error");
      return;
    }
    localStreamRef.current = stream;

    const ice = await getICEServers();
    const pc = new RTCPeerConnection({ iceServers: ice });
    pcRef.current = pc;

    pc.oniceconnectionstatechange = () => {
      if (pcRef.current !== pc) return;
      console.log("[PhoneBridge] ICE state:", pc.iceConnectionState);
    };
    pc.onconnectionstatechange = () => {
      if (pcRef.current !== pc) return; // ignore events from a replaced PC
      const st = pc.connectionState;
      console.log("[PhoneBridge] connection state:", st);
      // The publish dropped unexpectedly (network blip / TURN reset / tab throttle).
      // Auto-reconnect so the doctor's view recovers without the patient touching anything.
      if (st === "failed" && !stoppedRef.current && !reconnectingRef.current) {
        reconnectingRef.current = true;
        console.warn("[PhoneBridge] publish connection lost — reconnecting in 2s");
        setStatus("connecting");
        setTimeout(() => {
          reconnectingRef.current = false;
          if (!stoppedRef.current) void startRef.current?.();
        }, 2000);
      }
    };

    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const gatherDone = new Promise<void>((resolve) => {
      if (pc.iceGatheringState === "complete") return resolve();
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "complete") resolve();
      };
      setTimeout(resolve, 2500);
    });
    await gatherDone;

    let res: Response;
    try {
      res = await fetch(`${sfu}/whip/${patientId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tok}`,
          "Content-Type": "application/sdp",
        },
        body: pc.localDescription?.sdp || "",
      });
    } catch (e: any) {
      setError(e?.message || "Network error");
      setStatus("error");
      await stop();
      return;
    }

    const loc = res.headers.get("Location") || "";
    const parts = loc.split("/").filter(Boolean);
    resourceRef.current = parts[parts.length - 1] || null;

    if (!res.ok) {
      const t = await res.text();
      setError(t || `WHIP failed (${res.status})`);
      setStatus("error");
      await stop();
      return;
    }

    const answerSdp = await res.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

    hbRef.current = setInterval(() => {
      void fetch(`${sfu}/bridges/heartbeat/${patientId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${tok}` },
      }).catch(() => {});
    }, 15000);

    setStatus("live");
  }, [patientId, stop]);

  // Keep a live ref to start() so the reconnect timer always calls the latest version.
  useEffect(() => {
    startRef.current = start;
  }, [start]);

  return { status, error, start, stop };
}
