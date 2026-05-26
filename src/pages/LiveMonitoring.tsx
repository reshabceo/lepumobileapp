import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Router, Video, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { MobileAppContainer } from "@/components/MobileAppContainer";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { usePhoneBridge } from "@/hooks/usePhoneBridge";
import { useNativeCameraBridge } from "@/hooks/useNativeCameraBridge";
import { getCameraSFUOrigin } from "@/config/cameraStream";

export default function LiveMonitoringPage() {
  const navigate = useNavigate();
  const [patientId, setPatientId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [lockedPiMode, setLockedPiMode] = useState(false);
  const [bridgeType, setBridgeType] = useState<"phone" | "pi_box">("phone");

  const phone = usePhoneBridge(patientId);
  const native = useNativeCameraBridge(patientId);
  const plat = Capacitor.getPlatform();
  // On a real device (Android/iOS) use the native RTSP→WHIP bridge (Reolink LAN feed).
  // In the browser preview there is no native binary, so use the phone-camera WHIP fallback.
  const useNativeRtsp = native.supported;

  const streamStatus = useNativeRtsp ? native.status : phone.status;
  const streamError = useNativeRtsp ? native.error : phone.error;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (!uid) return navigate("/dashboard");
        const { data: p, error: pe } = await supabase.from("patients").select("id").eq("auth_user_id", uid).single();
        if (pe || !p?.id) {
          toast.error("Patient profile not found");
          navigate("/dashboard");
          return;
        }
        setPatientId(p.id);
        const { data: cam } = await supabase
          .from("patient_cameras")
          .select("is_monitoring_enabled, bridge_type")
          .eq("patient_id", p.id)
          .maybeSingle();
        if (!cancelled) {
          setMonitoringEnabled(Boolean(cam?.is_monitoring_enabled));
          const bt = (cam?.bridge_type as string) === "pi_box" ? "pi_box" : "phone";
          setBridgeType(bt);
          setLockedPiMode(bt === "pi_box");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const sfuConfigured = Boolean(getCameraSFUOrigin());

  const persistPrefs = async (enabled: boolean, bt: "phone" | "pi_box") => {
    if (!patientId) return false;
    const { data: cam } = await supabase.from("patient_cameras").select("id").eq("patient_id", patientId).maybeSingle();
    if (!cam?.id) {
      toast.error("Add your camera in Connect Camera before enabling live monitoring.");
      return false;
    }
    const { error } = await supabase
      .from("patient_cameras")
      .update({
        is_monitoring_enabled: enabled,
        bridge_type: bt,
        updated_at: new Date().toISOString(),
      })
      .eq("patient_id", patientId);
    if (error) {
      toast.error(error.message);
      return false;
    }
    setMonitoringEnabled(enabled);
    setBridgeType(bt);
    setLockedPiMode(bt === "pi_box");
    toast.success(enabled ? "Live monitoring allowed for your doctor." : "Live monitoring paused.");
    return true;
  };

  const handleToggleMonitoring = async (next: boolean) => {
    if (!next && streamStatus === "live") {
      await (useNativeRtsp ? native.stop() : phone.stop());
    }
    await persistPrefs(next, bridgeType);
  };

  const setBridgeChoice = async (t: "phone" | "pi_box") => {
    setBridgeType(t);
    if (!patientId) return;
    await supabase
      .from("patient_cameras")
      .update({ bridge_type: t, updated_at: new Date().toISOString() })
      .eq("patient_id", patientId);
    setLockedPiMode(t === "pi_box");
  };

  const handleStartStream = async () => {
    if (!monitoringEnabled) {
      toast.error("Enable monitoring first.");
      return;
    }
    if (!sfuConfigured) {
      toast.error("Camera server URL missing (set VITE_CAMERA_SFU_URL).");
      return;
    }
    if (bridgeType === "pi_box") {
      toast.info("Pi box bridge streams automatically when powered on.");
      return;
    }
    if (useNativeRtsp) await native.start();
    else await phone.start();
  };

  const handleStopStream = async () => {
    if (useNativeRtsp) await native.stop();
    else await phone.stop();
  };

  if (loading || !patientId) {
    return (
      <MobileAppContainer>
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading...</div>
      </MobileAppContainer>
    );
  }

  return (
    <MobileAppContainer>
      <div className="min-h-screen bg-[#080D1A] text-white p-4 pb-8">
        <div className="max-w-sm mx-auto">
          {/* Status Bar Spacing */}
          <div className="h-6"></div>

          {/* Header */}
          <header className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 flex-1">
              <div className="h-10 w-10 rounded-2xl bg-indigo-900/70 flex items-center justify-center border border-indigo-400/50">
                <Video className="h-6 w-6 text-indigo-300" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Live RPM</h1>
                <p className="text-xs text-gray-400">Live monitoring status</p>
              </div>
            </div>
          </header>

          {/* Explanation Card */}
          <div className="bg-[#1A243D]/50 border border-slate-700/40 rounded-2xl p-3.5 mb-5 text-xs text-slate-300 leading-relaxed shadow-sm">
            {lockedPiMode
              ? "This account is routed through the Raspberry Pi hardware bridge."
              : useNativeRtsp
                ? "Your phone pulls the Reolink camera over your Wi-Fi and forwards it to your doctor (RTSP→WHIP)."
                : "Browser preview streams this device camera via WHIP. Pi Kit uses WAN RTSP from the LAN."}
          </div>

          <div className="bg-[#1A243D] border border-slate-700/40 shadow-lg rounded-3xl p-5 space-y-4">
            {!sfuConfigured && (
              <p className="text-amber-200 text-xs">
                Deploy camera-stream-service and set <code>VITE_CAMERA_SFU_URL</code>.
              </p>
            )}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">Allow doctor live view</div>
                <div className="text-[11px] text-slate-400 leading-normal mt-0.5">
                  Doctors can watch only while this stays on & your bridge is pushing video.
                </div>
              </div>
              <button type="button" onClick={() => void handleToggleMonitoring(!monitoringEnabled)} className="text-emerald-400 flex-shrink-0">
                {monitoringEnabled ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10" />}
              </button>
            </div>

            {!lockedPiMode ? (
              <div className="flex gap-2">
                <button
                  onClick={() => void setBridgeChoice("phone")}
                  type="button"
                  className={`flex-1 h-10 rounded-xl text-xs font-bold transition-all duration-200 ${
                    bridgeType === "phone"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
                      : "bg-[#1E293B] border border-slate-700/40 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Phone bridge
                </button>
                <button
                  onClick={() => void setBridgeChoice("pi_box")}
                  type="button"
                  className={`flex-1 h-10 rounded-xl text-xs font-bold transition-all duration-200 ${
                    bridgeType === "pi_box"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
                      : "bg-[#1E293B] border border-slate-700/40 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Pi Kit
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs rounded-lg bg-amber-950/40 border border-amber-500/40 px-3 py-2.5 text-amber-100">
                  <Router className="w-4 h-4 shrink-0" />
                  Raspberry Pi pairing active — onboarding happens on the provisioning hotspot.
                </div>
                <button
                  type="button"
                  className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline"
                  onClick={() => void setBridgeChoice("phone")}
                >
                  Use phone ingest instead (clears Pi mode)
                </button>
              </div>
            )}

            {bridgeType === "phone" && (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-400">
                  Stream status: <span className="text-white capitalize">{streamStatus}</span>
                  {useNativeRtsp && streamStatus === "live" ? (
                    <span className="text-slate-500"> · {(native.bytesTransferred / (1024 * 1024)).toFixed(1)} MB egress</span>
                  ) : null}
                </p>
                {streamError && <p className="text-xs text-red-400">{streamError}</p>}
                <button
                  className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-500/20 text-xs active:scale-95 flex items-center justify-center gap-1.5"
                  disabled={!monitoringEnabled || !sfuConfigured || bridgeType !== "phone"}
                  onClick={() => void handleStartStream()}
                  type="button"
                >
                  Push live ingest
                </button>
                <button
                  className="w-full h-11 bg-[#E11D48] hover:bg-[#BE123C] text-white font-bold rounded-xl transition-all shadow-md shadow-red-950/20 text-xs active:scale-95 flex items-center justify-center gap-1.5"
                  onClick={() => void handleStopStream()}
                  type="button"
                >
                  Stop ingest
                </button>
                {plat !== "android" ? (
                  <p className="text-[11px] text-slate-500">
                    Keep the screen unlocked while pushing. Plug in charger for extended sessions.
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Native ingest runs in a foreground service so you can briefly background the phone.
                  </p>
                )}
              </div>
            )}
            {bridgeType === "pi_box" && (
              <div className="text-xs text-slate-400 space-y-3">
                <p className="text-[11px] text-slate-400 leading-normal">The Pi pushes WHIP using credentials from the provisioning flow.</p>
                <button
                  className="w-full h-11 bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold rounded-xl hover:from-amber-700 hover:to-amber-800 transition-all shadow-md shadow-amber-900/30 text-xs active:scale-95 flex items-center justify-center gap-1.5"
                  onClick={() => navigate("/pair-pi")}
                  type="button"
                >
                  Open pairing assistant
                </button>
                <p className="text-[11px] text-slate-500">Power the kit, join its hotspot, then walk through pairing while online.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </MobileAppContainer>
  );
}
