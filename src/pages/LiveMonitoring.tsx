import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Video, ToggleLeft, ToggleRight, Router,
  User, Lock, Globe, Copy, Check, Eye, EyeOff, Database, Server, Info, X, Shield,
} from "lucide-react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { MobileAppContainer } from "@/components/MobileAppContainer";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePhoneBridge } from "@/hooks/usePhoneBridge";
import { useNativeCameraBridge } from "@/hooks/useNativeCameraBridge";
import { getCameraSFUOrigin } from "@/config/cameraStream";
import { getICEServers } from "@/config/webrtc";

// ── Pi provisioning helpers ────────────────────────────────────────────────
const provisionDefaultOrigin = (): string =>
  ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_PI_PROVISION_ORIGIN || "http://192.168.42.1:8888").replace(/\/$/, "");

async function pairingIceJson(): Promise<string> {
  const ice = await getICEServers();
  return JSON.stringify(
    ice.map((s) => {
      const legacy = s as RTCIceServer & { username?: string; credential?: string };
      const row: Record<string, unknown> = { urls: s.urls };
      if (legacy.username) row.username = legacy.username;
      if (legacy.credential) row.credential = legacy.credential;
      return row;
    }),
  );
}

export default function LiveMonitoringPage() {
  const navigate = useNavigate();
  const plat = Capacitor.getPlatform();
  const isNativeNote = Capacitor.isNativePlatform();

  // ── Auth / patient ────────────────────────────────────────────────────────
  const [patientId, setPatientId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  // ── Camera setup state ───────────────────────────────────────────────────
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedRtsp, setGeneratedRtsp] = useState("");
  const [generatedRtspSub, setGeneratedRtspSub] = useState("");
  const [isCopiedMain, setIsCopiedMain] = useState(false);
  const [isCopiedSub, setIsCopiedSub] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // ── Live monitoring state ────────────────────────────────────────────────
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  // null = nothing selected (default), "phone" or "pi_box" once the user picks
  const [bridgeType, setBridgeType] = useState<"phone" | "pi_box" | null>(null);

  // ── Pi pairing state ─────────────────────────────────────────────────────
  const [hwSerial, setHwSerial] = useState("");
  const [pairToken, setPairToken] = useState("");
  const [wifiSSID, setWifiSSID] = useState("");
  const [wifiPSK, setWifiPSK] = useState("");
  const provisionBase = provisionDefaultOrigin();

  // ── Bridge hooks ──────────────────────────────────────────────────────────
  const phone = usePhoneBridge(patientId);
  const native = useNativeCameraBridge(patientId);
  const useNativeRtsp = native.supported;
  const streamStatus = useNativeRtsp ? native.status : phone.status;
  const streamError = useNativeRtsp ? native.error : phone.error;
  const sfuConfigured = Boolean(getCameraSFUOrigin());

  // ── Load patient + saved prefs ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (!uid) { navigate("/dashboard"); return; }

        const { data: p, error: pe } = await supabase.from("patients").select("id").eq("auth_user_id", uid).single();
        if (pe || !p?.id) { toast.error("Patient profile not found"); navigate("/dashboard"); return; }

        if (!cancelled) setPatientId(p.id);

        const { data: cam } = await supabase
          .from("patient_cameras")
          .select("is_monitoring_enabled, bridge_type, camera_username, camera_password, ip_address, rtsp_url, rtsp_url_sub")
          .eq("patient_id", p.id)
          .maybeSingle();

        if (!cancelled && cam) {
          setMonitoringEnabled(Boolean(cam.is_monitoring_enabled));
          // Only restore saved bridge type — never default to one the user didn't pick
          const bt = cam.bridge_type === "pi_box" ? "pi_box" : cam.bridge_type === "phone" ? "phone" : null;
          setBridgeType(bt);
          if (cam.camera_username) setUsername(cam.camera_username);
          if (cam.camera_password) setPassword(cam.camera_password);
          if (cam.ip_address) setIpAddress(cam.ip_address);
          if (cam.rtsp_url) setGeneratedRtsp(cam.rtsp_url);
          if (cam.rtsp_url_sub) setGeneratedRtspSub(cam.rtsp_url_sub);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  // ── Auto-generate RTSP links ──────────────────────────────────────────────
  useEffect(() => {
    const u = username.trim();
    const ip = ipAddress.trim();
    if (!u || !ip) { setGeneratedRtsp(""); setGeneratedRtspSub(""); return; }
    const p = password ? encodeURIComponent(password) : "YOUR_PASSWORD";
    setGeneratedRtsp(`rtsp://${u}:${p}@${ip}:554/h264Preview_01_main`);
    setGeneratedRtspSub(`rtsp://${u}:${p}@${ip}:554/h264Preview_01_sub`);
  }, [username, password, ipAddress]);

  // ── Camera save ───────────────────────────────────────────────────────────
  const handleSaveCamera = async () => {
    if (!username.trim()) { toast.error("Enter camera username"); return; }
    if (!password.trim()) { toast.error("Enter camera password"); return; }
    if (!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ipAddress.trim())) {
      toast.error("Enter a valid IP address (e.g. 192.168.1.100)"); return;
    }
    try {
      setSaving(true);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data: pat } = await supabase.from("patients").select("id").eq("auth_user_id", u.user.id).single();
      if (!pat?.id) throw new Error("Patient profile not found");
      const { error } = await supabase.from("patient_cameras").upsert({
        patient_id: pat.id,
        camera_username: username.trim(),
        camera_password: password.trim(),
        ip_address: ipAddress.trim(),
        rtsp_url: generatedRtsp,
        rtsp_url_sub: generatedRtspSub,
        camera_model: "reolink_e1_pro",
        updated_at: new Date().toISOString(),
      }, { onConflict: "patient_id" });
      if (error) throw error;
      toast.success("Camera saved.");
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (text: string, isSub: boolean) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    isSub ? setIsCopiedSub(true) : setIsCopiedMain(true);
    setTimeout(() => isSub ? setIsCopiedSub(false) : setIsCopiedMain(false), 2000);
    toast.success("Copied!");
  };

  // ── Monitoring toggle ─────────────────────────────────────────────────────
  const persistPrefs = async (enabled: boolean, bt: "phone" | "pi_box" | null) => {
    if (!patientId) return false;
    const { data: cam } = await supabase.from("patient_cameras").select("id").eq("patient_id", patientId).maybeSingle();
    if (!cam?.id) { toast.error("Save your camera first before enabling live monitoring."); return false; }
    const { error } = await supabase.from("patient_cameras").update({
      is_monitoring_enabled: enabled,
      bridge_type: bt ?? null,
      updated_at: new Date().toISOString(),
    }).eq("patient_id", patientId);
    if (error) { toast.error(error.message); return false; }
    setMonitoringEnabled(enabled);
    toast.success(enabled ? "Live monitoring enabled for your doctor." : "Live monitoring paused.");
    return true;
  };

  const handleToggleMonitoring = async (next: boolean) => {
    if (!next && streamStatus === "live") await (useNativeRtsp ? native.stop() : phone.stop());
    await persistPrefs(next, bridgeType);
  };

  const selectBridge = async (t: "phone" | "pi_box") => {
    setBridgeType(t);
    if (!patientId) return;
    await supabase.from("patient_cameras").update({ bridge_type: t, updated_at: new Date().toISOString() }).eq("patient_id", patientId);
  };

  // ── Stream controls ───────────────────────────────────────────────────────
  const handleStartStream = async () => {
    if (!monitoringEnabled) { toast.error("Enable monitoring first."); return; }
    if (!sfuConfigured) { toast.error("Camera server URL not configured."); return; }
    if (useNativeRtsp) await native.start(); else await phone.start();
  };

  const handleStopStream = async () => {
    if (useNativeRtsp) await native.stop(); else await phone.stop();
  };

  // ── Pi pairing ────────────────────────────────────────────────────────────
  const canGenerateToken = useMemo(() => hwSerial.trim().length >= 4 && !!patientId, [hwSerial, patientId]);

  const generatePairToken = async () => {
    if (!patientId) return;
    const hw = hwSerial.trim();
    await supabase.from("camera_bridges").delete().eq("patient_id", patientId).eq("hardware_serial", hw);
    const token = crypto.randomUUID();
    const { error } = await supabase.from("camera_bridges").insert({ patient_id: patientId, hardware_serial: hw, pairing_token: token });
    if (error) { toast.error(error.message); return; }
    setPairToken(token);
    toast.success("Pairing token created.");
  };

  const sendToPi = async () => {
    if (!patientId || !sfuConfigured) { toast.error("SFU URL missing."); return; }
    const hw = hwSerial.trim();
    const tok = pairToken.trim();
    if (!hw || !tok || !wifiSSID.trim() || !wifiPSK.trim()) {
      toast.error("Fill in serial, token, Wi-Fi SSID and password."); return;
    }
    const { data: sess } = await supabase.auth.getSession();
    const jwt = sess?.session?.access_token;
    if (!jwt) { toast.error("Not signed in."); return; }
    const sfu = getCameraSFUOrigin()!.replace(/\/$/, "");
    try {
      const reg = await fetch(`${sfu}/bridges/register`, {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: patientId, hardware_serial: hw, pairing_token: tok }),
      });
      if (!reg.ok) { toast.error(await reg.text()); return; }
      const { bridge_jwt: bridgeJwt } = (await reg.json()) as { bridge_jwt?: string };
      if (!bridgeJwt) { toast.error("Missing bridge_jwt in response."); return; }

      const { data: cam } = await supabase.from("patient_cameras").select("rtsp_url_sub, rtsp_url").eq("patient_id", patientId).maybeSingle();
      const rtsp = (cam?.rtsp_url_sub || cam?.rtsp_url || "").trim();
      if (!rtsp.startsWith("rtsp://")) { toast.error("Save your camera RTSP URL first (Camera Setup section above)."); return; }

      const ice_json = await pairingIceJson();
      const res = await fetch(`${provisionBase}/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wifi_ssid: wifiSSID.trim(), wifi_psk: wifiPSK.trim(), patient_id: patientId, bridge_jwt: bridgeJwt, sfu_origin: sfu, rtsp_url: rtsp, ice_json }),
      });
      const bodyText = await res.text().catch(() => "");
      if (!res.ok) { toast.error(bodyText || `Pi setup failed (${res.status})`); return; }
      await supabase.from("patient_cameras").update({ bridge_type: "pi_box", bridge_id: hw, updated_at: new Date().toISOString() }).eq("patient_id", patientId);
      toast.success("Pi captured credentials. Power-cycle to connect.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Network error.");
    }
  };

  if (loading || !patientId) {
    return (
      <MobileAppContainer>
        <div className="min-h-screen bg-[#080D1A] flex items-center justify-center text-white">Loading...</div>
      </MobileAppContainer>
    );
  }

  return (
    <MobileAppContainer>
      <div className="min-h-screen bg-[#080D1A] text-white pt-safe-top px-4 pb-10">

        {/* Header */}
        <div className="flex items-center gap-3 py-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <div className="h-10 w-10 rounded-2xl bg-indigo-900/70 flex items-center justify-center border border-indigo-400/50">
              <Video className="h-5 w-5 text-indigo-300" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Live RPM Monitoring</h1>
              <p className="text-xs text-slate-400">Camera setup &amp; live stream controls</p>
            </div>
          </div>
        </div>

        {/* ── SECTION 1: Camera Setup ──────────────────────────────────── */}
        <div className="bg-[#1A243D] border border-slate-700/40 rounded-3xl p-5 mb-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-indigo-300 uppercase tracking-wider">Camera Setup</h2>
            <button
              onClick={() => setShowGuide(true)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" /> Guide
            </button>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" /> Camera Username
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin"
              autoCapitalize="off"
              autoCorrect="off"
              className="bg-[#121B32] border-slate-700/40 text-white placeholder-gray-500 rounded-xl focus:border-indigo-500"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-400" /> Camera Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Camera account password"
                className="bg-[#121B32] border-slate-700/40 text-white placeholder-gray-500 rounded-xl pr-10 focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* IP Address */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-400" /> Camera IP Address
            </label>
            <Input
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="e.g. 192.168.1.100"
              autoCapitalize="off"
              autoCorrect="off"
              className="bg-[#121B32] border-slate-700/40 text-white placeholder-gray-500 rounded-xl focus:border-indigo-500"
            />
          </div>

          {/* Save button */}
          <button
            onClick={() => void handleSaveCamera()}
            disabled={saving}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? (
              <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Saving...</>
            ) : (
              <><Database className="w-4 h-4" /> Generate &amp; Save Stream Link</>
            )}
          </button>

          {/* Generated links */}
          {generatedRtsp && (
            <div className="rounded-2xl border border-indigo-500/30 bg-[#121B32] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5" /> Your RTSP Stream Links
                </span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-200">Ready</span>
              </div>
              {[{ url: generatedRtsp, label: "Main stream", isSub: false, copied: isCopiedMain },
                { url: generatedRtspSub, label: "Sub stream", isSub: true, copied: isCopiedSub }].map(({ url, label, isSub, copied }) => (
                <div key={label} className="space-y-1">
                  <span className="text-[11px] text-slate-400">{label}</span>
                  <div className="flex items-center gap-2 bg-black/30 rounded-xl p-2.5 border border-slate-700/40">
                    <code className="text-[10px] text-emerald-300 break-all flex-1 font-mono">{url}</code>
                    <button onClick={() => handleCopy(url, isSub)} className="p-1.5 text-slate-400 hover:text-white">
                      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── SECTION 2: Live Monitoring Controls ─────────────────────── */}
        <div className="bg-[#1A243D] border border-slate-700/40 rounded-3xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-indigo-300 uppercase tracking-wider">Live Stream</h2>

          {/* Allow doctor toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm">Allow doctor live view</div>
              <div className="text-xs text-slate-400 mt-0.5">Doctors can watch only while this is on &amp; your bridge is pushing video.</div>
            </div>
            <button type="button" onClick={() => void handleToggleMonitoring(!monitoringEnabled)} className="text-emerald-400 ml-3 shrink-0">
              {monitoringEnabled ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10 text-slate-500" />}
            </button>
          </div>

          {/* Bridge selector — default: neither selected */}
          <div>
            <p className="text-xs text-slate-400 mb-2">Select bridge type</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void selectBridge("phone")}
                className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-colors ${
                  bridgeType === "phone" ? "bg-indigo-600 text-white" : "bg-white/8 text-slate-400 border border-white/10 hover:bg-white/12"
                }`}
              >
                Phone
              </button>
              <button
                type="button"
                onClick={() => void selectBridge("pi_box")}
                className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-colors ${
                  bridgeType === "pi_box" ? "bg-indigo-600 text-white" : "bg-white/8 text-slate-400 border border-white/10 hover:bg-white/12"
                }`}
              >
                Pi Kit
              </button>
            </div>
          </div>

          {/* Phone bridge controls */}
          {bridgeType === "phone" && (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-slate-400">
                Stream status: <span className="text-white capitalize">{streamStatus}</span>
                {useNativeRtsp && streamStatus === "live" ? (
                  <span className="text-slate-500"> · {(native.bytesTransferred / (1024 * 1024)).toFixed(1)} MB egress</span>
                ) : null}
              </p>
              {streamError && <p className="text-xs text-red-400">{streamError}</p>}
              <Button
                className="w-full"
                disabled={!monitoringEnabled || !sfuConfigured || streamStatus === "live"}
                onClick={() => void handleStartStream()}
              >
                {streamStatus === "live" ? "Streaming..." : "Push live ingest"}
              </Button>
              <Button
                variant="destructive"
                className="w-full"
                disabled={streamStatus !== "live"}
                onClick={() => void handleStopStream()}
                type="button"
              >
                Stop ingest
              </Button>
              <p className="text-[11px] text-slate-500">
                {plat === "android"
                  ? "Native ingest runs in a foreground service so you can briefly background the phone."
                  : "Keep the screen unlocked while pushing. Plug in charger for extended sessions."}
              </p>
            </div>
          )}

          {/* Pi Kit pairing inline */}
          {bridgeType === "pi_box" && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2 text-xs rounded-xl bg-amber-950/40 border border-amber-500/40 px-3 py-2.5 text-amber-100">
                <Router className="w-4 h-4 shrink-0" />
                <span>Power the Pi hotspot (usually <strong>MONITRAQ-SETUP</strong>){isNativeNote ? " and join it from this phone." : "."}</span>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs text-slate-400">Hardware serial (from sticker)</span>
                <input
                  value={hwSerial}
                  onChange={(e) => setHwSerial(e.target.value)}
                  className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-slate-500"
                  placeholder="e.g. mq-pi-xxxx"
                  autoCapitalize="off"
                  autoCorrect="off"
                />
              </label>

              <button
                type="button"
                disabled={!canGenerateToken}
                onClick={() => void generatePairToken()}
                className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                Mint pairing token
              </button>

              {pairToken && (
                <p className="text-[11px] text-emerald-300 break-all font-mono bg-black/30 rounded-lg px-3 py-2 border border-emerald-500/20">
                  Token (keep private): {pairToken}
                </p>
              )}

              <label className="block space-y-1.5">
                <span className="text-xs text-slate-400">Wi-Fi SSID Pi should join</span>
                <input
                  value={wifiSSID}
                  onChange={(e) => setWifiSSID(e.target.value)}
                  className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-slate-500"
                  placeholder="MyHomeWiFi"
                  autoCapitalize="off"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs text-slate-400">Wi-Fi password</span>
                <input
                  type="password"
                  value={wifiPSK}
                  onChange={(e) => setWifiPSK(e.target.value)}
                  className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-slate-500"
                  placeholder="••••••••"
                />
              </label>

              <button
                type="button"
                disabled={!pairToken}
                onClick={() => void sendToPi()}
                className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-bold transition-colors"
              >
                Send credentials to Pi
              </button>
              <p className="text-[11px] text-slate-500">
                Power-cycle the Pi after sending credentials. It will join your Wi-Fi and start pushing video automatically.
              </p>
            </div>
          )}

          {/* Nothing selected hint */}
          {bridgeType === null && (
            <p className="text-xs text-slate-500 text-center py-2">Select a bridge type above to see stream controls.</p>
          )}
        </div>
      </div>

      {/* Guide modal */}
      {showGuide && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A243D] border border-slate-700/40 text-white w-full max-w-lg rounded-3xl flex flex-col max-h-[85vh] shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-[#121B32]/40">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2 text-indigo-300">
                  <Shield className="w-4 h-4" /> Reolink Camera Setup Guide
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Steps to configure your camera inside the Reolink app.</p>
              </div>
              <button onClick={() => setShowGuide(false)} className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {[
                { n: "1", title: "Create Camera Account", path: "Camera Settings → Advanced Settings → Camera Account", note: "Create a username and password — enter these in the form." },
                { n: "2", title: "Enable RTSP Compatibility", path: "Advanced Settings → Camera Account / Third Party Compatibility → Enable", note: "Allows third-party apps to stream the camera feed." },
                { n: "3", title: "Find Camera IP Address", path: "Camera Settings → Device Info → IP Address", note: 'Usually looks like 192.168.0.100.' },
              ].map(({ n, title, path, note }) => (
                <div key={n} className="space-y-1.5">
                  <h4 className="font-bold text-indigo-300 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-[9px] flex items-center justify-center text-indigo-200 font-extrabold font-mono shrink-0">{n}</span>
                    {title}
                  </h4>
                  <p className="pl-7 bg-[#121B32] p-2.5 rounded-xl border border-slate-700/40 font-mono text-[10px] text-emerald-300">{path}</p>
                  <p className="pl-7 text-slate-400 text-[10px]">{note}</p>
                </div>
              ))}
              <div className="border-t border-slate-800 pt-3 space-y-1.5">
                <h4 className="font-bold text-indigo-300 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Browser Integration</h4>
                <p className="text-slate-400 text-[10px]">Browsers can't play RTSP natively. Use go2rtc or MediaMTX to transcode to WebRTC for your web dashboard.</p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-800 bg-[#121B32]/40">
              <button onClick={() => setShowGuide(false)} className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors">
                Got it, Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileAppContainer>
  );
}
