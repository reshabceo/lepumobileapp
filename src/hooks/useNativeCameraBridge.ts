/**
 * Native RTSP→WHIP via Capacitor CameraBridge (+ gomobile binary).
 * Android uses libs/camerabridge.aar; iOS uses Frameworks/Mobile.xcframework.
 * If the native binary is not embedded the start() call rejects and callers
 * may fall back to the WebRTC (usePhoneBridge) path.
 */
import { useCallback, useEffect, useState } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { Capacitor } from "@capacitor/core";
import { CameraBridge } from "@/plugins/cameraBridge";
import { supabase } from "@/lib/supabase";
import { getCameraSFUOrigin } from "@/config/cameraStream";
import { getICEServers } from "@/config/webrtc";

export type NativeBridgeStatus = "idle" | "connecting" | "live" | "error";

function iceServersToSFUJson(servers: RTCIceServer[]): string {
  const out = servers.map((s) => {
    const urlsVal = typeof s.urls === "string" ? s.urls : s.urls;
    const o: Record<string, unknown> = { urls: urlsVal };
    const legacy = s as RTCIceServer & { username?: string; credential?: string };
    if (legacy.username) o.username = legacy.username;
    if (legacy.credential) o.credential = legacy.credential;
    return o;
  });
  return JSON.stringify(out);
}

export function useNativeCameraBridge(patientId: string | undefined) {
  const [status, setStatus] = useState<NativeBridgeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [bytesTransferred, setBytesTransferred] = useState(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handlePromises: Promise<PluginListenerHandle>[] = [
      CameraBridge.addListener("cameraBridgeState", (e) => {
        const s = String(e?.state || "idle").toLowerCase();
        if (s === "live") setStatus("live");
        else if (s === "connecting") setStatus("connecting");
        else if (s === "idle") setStatus("idle");
      }),
      CameraBridge.addListener("cameraBridgeError", (e) => {
        setError(String(e?.error || ""));
        setStatus("error");
      }),
      CameraBridge.addListener("cameraBridgeBytes", (e) => {
        if (typeof e?.bytesTransferred === "number") setBytesTransferred(e.bytesTransferred);
      }),
    ];

    return () => {
      handlePromises.forEach((p) => void p.then((h) => h.remove()).catch(() => {}));
    };
  }, []);

  const stop = useCallback(async () => {
    const run = CameraBridge.stop();
    setStatus("idle");
    await run.catch(() => {});
  }, []);

  const startNative = useCallback(async () => {
    if (!patientId) return;
    setError(null);
    setBytesTransferred(0);
    await stop().catch(() => {});

    const sfu = getCameraSFUOrigin();
    if (!sfu) {
      setError("VITE_CAMERA_SFU_URL is not set");
      setStatus("error");
      return;
    }

    const { data: sess } = await supabase.auth.getSession();
    const jwt = sess?.session?.access_token;
    if (!jwt) {
      setError("Not signed in");
      setStatus("error");
      return;
    }

    const { data: cam, error: camErr } = await supabase
      .from("patient_cameras")
      .select("rtsp_url_sub, rtsp_url")
      .eq("patient_id", patientId)
      .maybeSingle();

    if (camErr || !cam) {
      setError("Configure your Reolink camera in Connect Camera first.");
      setStatus("error");
      return;
    }

    const rtspUrl = (cam.rtsp_url_sub || cam.rtsp_url || "").trim();
    if (!rtspUrl.startsWith("rtsp://")) {
      setError("Missing RTSP URL for your camera.");
      setStatus("error");
      return;
    }

    const ice = await getICEServers();
    const iceJson = iceServersToSFUJson(ice);

    try {
      setStatus("connecting");
      await CameraBridge.start({
        rtspUrl,
        patientId,
        sfuOrigin: sfu.replace(/\/$/, ""),
        jwt,
        iceJson,
        useUdp: false,
      });
      setStatus((s) => (s === "error" ? "error" : "connecting"));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e || "start failed");
      setError(msg);
      setStatus("error");
    }
  }, [patientId, stop]);

  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  return {
    // Both native platforms run the same Go RTSP→WHIP core (Android AAR / iOS XCFramework).
    supported: Capacitor.isNativePlatform(),
    status,
    error,
    bytesTransferred,
    start: startNative,
    stop,
  };
}
