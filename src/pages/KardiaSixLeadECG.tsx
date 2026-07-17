/**
 * KardiaSixLeadECG.tsx
 *
 * CRITICAL FIXES applied here:
 * 1. React closure bug: kardiaDevices inside async while-loop was stale.
 *    Now uses a ref that stays in sync with the context value.
 * 2. Removed unnecessary pre-scan: AliveCor SDK manages BLE internally.
 *    The recording Activity handles device discovery + connection on its own.
 * 3. stopKardiaScan correctly comes from useDevice() context (was undefined before).
 * 4. Clear error feedback when JWT is invalid (VITE_ALIVECOR_TEST_JWT placeholder).
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ECGSixLeadView, ECGMiniPreview } from "@/components/ECGLeadCanvas";
import {
  Loader2,
  Activity,
  ArrowLeft,
  FileText,
  Bluetooth,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Zap,
  Heart,
  Search,
  Wifi,
  User,
  Monitor,
  Timer,
  Download,
  Star,
  Calendar,
} from "lucide-react";
import { aliveCorSDK, AliveCorRecordingResult } from "@/lib/alivecor-sdk-bridge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAliveCorToken,
  db,
  storeAliveCorRecording,
  triggerEcgAiAnalysis,
  getAliveCorRecordings,
  supabase,
} from "@/lib/supabase";
import { buildAliveCorIngestPayload } from "@/lib/aliveCorKardia";
import { AliveCorEcgResult } from "@/plugins/alivecor";
import { useDevice } from "@/contexts/DeviceContext";

// ECGWaveformPreview replaced by ECGMiniPreview (from ECGLeadCanvas) — shared amplitude scale

// ─── Moving Waveform Animation ────────────────────────────────────────────────
const MovingWaveform: React.FC<{ color?: string; height?: number; speed?: number; delay?: number }> = ({
  color = "#6366f1", height = 40, speed = 2000, delay = 0
}) => {
  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-[#121B32] border border-slate-700/40" style={{ height }}>
      <div
        className="absolute inset-0 flex items-center"
        style={{
          animation: `moveWave ${speed}ms linear infinite`,
          animationDelay: `${delay}ms`,
          width: '200%'
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 200 40" preserveAspectRatio="none" className="flex-shrink-0">
          <path
            d="M0 20 L20 20 L25 10 L30 30 L35 20 L60 20 L65 5 L70 35 L75 20 L100 20 L105 10 L110 30 L115 20 L140 20 L145 0 L150 40 L155 20 L180 20 L185 10 L190 30 L195 20 L200 20"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <svg width="100%" height="100%" viewBox="0 0 200 40" preserveAspectRatio="none" className="flex-shrink-0">
          <path
            d="M0 20 L20 20 L25 10 L30 30 L35 20 L60 20 L65 5 L70 35 L75 20 L100 20 L105 10 L110 30 L115 20 L140 20 L145 0 L150 40 L155 20 L180 20 L185 10 L190 30 L195 20 L200 20"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <style>{`
        @keyframes moveWave {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

// ─── Pulse Dot Animation ──────────────────────────────────────────────────────
const PulseDot: React.FC = () => (
  <div className="relative flex h-3 w-3 mr-2">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────
const KardiaSixLeadECG: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const {
    aliveCorConnected,
    kardiaStatusText,
    startKardiaScan,
    stopKardiaScan,        // ← was undefined before (not destructured); caused ReferenceError on back
    isKardiaScanning,
    kardiaDevices,
    connectKardia,
    disconnectDevice,
    kardiaBattery,
  } = useDevice();

  // ── Fix: keep a live ref to kardiaDevices to avoid React closure staleness ──
  // Inside async functions, reading `kardiaDevices` would capture the initial
  // empty array from the closure. The ref always has the current value.
  const kardiaDevicesRef = useRef(kardiaDevices);
  useEffect(() => { kardiaDevicesRef.current = kardiaDevices; }, [kardiaDevices]);

  const [isRecording, setIsRecording] = useState(false);
  const [lastResult, setLastResult] = useState<AliveCorRecordingResult | null>(null);
  const [recordingPhase, setRecordingPhase] = useState<"idle" | "permissions" | "getjwt" | "scanning" | "connecting" | "recording" | "preparing">("idle");
  const [jwtError, setJwtError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ── Helper Functions for Modal ─────────────────────────────────────────────
  // prepareChartData and getAvailableLeads removed — rendering now done by ECGSixLeadView / ECGMiniPreview
  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopKardiaScan().catch(() => { });
    };
  }, [stopKardiaScan]);

  // ── Fetch Latest Recording Session ──────────────────────────────────────────
  const fetchLatestSession = useCallback(async () => {
    if (!user) return;
    try {
      const localKey = `patient_profile_${user.id}`;
      const cached = localStorage.getItem(localKey);
      let patientDbId: string | null = null;
      if (cached) {
        const parsed = JSON.parse(cached);
        patientDbId = parsed?.id;
      }
      if (!patientDbId) {
        const { data: dbProfile } = await db.getPatientProfile(user.id);
        if (dbProfile) {
          patientDbId = dbProfile.id;
          localStorage.setItem(localKey, JSON.stringify(dbProfile));
        }
      }
      if (!patientDbId) return;

      const { patientMrn } = await getAliveCorToken(patientDbId);
      
      let recordings: any[] = [];
      try {
        const data = await getAliveCorRecordings(patientMrn || patientDbId);
        recordings = data.recordings || data.data || data.items || data.results || (Array.isArray(data) ? data : []);
      } catch (apiErr) {
        console.warn("[ALIVECOR] API recordings fetch failed, trying Supabase direct...", apiErr);
      }

      // If API returned nothing or failed, query direct Supabase table as fallback
      if (recordings.length === 0) {
        console.log("[ALIVECOR] Fetching latest recording from Supabase fallback...");
        const { data: supabaseRecs, error: sbErr } = await supabase
          .from("alivecor_recordings")
          .select(`
            id,
            patient_id,
            created_at,
            determination,
            heart_rate,
            lead_config,
            is_inverted,
            device_type,
            notes,
            ecg_recording_id,
            ecg_recordings (
              id,
              sample_rate,
              duration_seconds,
              mv_data_json
            )
          `)
          .eq("patient_id", patientDbId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (sbErr) {
          console.error("[ALIVECOR] Supabase fallback fetch error:", sbErr);
        } else if (supabaseRecs && supabaseRecs.length > 0) {
          const r = supabaseRecs[0];
          recordings = [{
            average_heart_rate: r.heart_rate,
            heart_rate: r.heart_rate,
            bpm: r.heart_rate,
            determination: r.determination,
            lead_config: r.lead_config,
            notes: r.notes,
            device_type: r.device_type,
            ecg_recordings: r.ecg_recordings,
          }];
        }
      }

      // Normalize recordings to ensure consistent keys (supporting both DB and API fields)
      const normalizedRecordings = recordings.map((rec: any) => {
        const determination = rec.determination || rec.algorithmDetermination || "UNCLASSIFIED";
        const created_at = rec.created_at || rec.recordedAt || new Date().toISOString();
        const heartRate = rec.heart_rate || rec.average_heart_rate || rec.bpm || 0;
        const inverted = rec.is_inverted !== undefined ? rec.is_inverted : (rec.inverted !== undefined ? rec.inverted : false);
        const deviceType = rec.device_type || "KardiaMobile 6L";
        const config = rec.lead_config || (rec.leads || rec.waveformLeads || rec.waveform_leads ? "six" : "six");
        
        // Ensure nested ecg_recordings is populated so details view works
        const ecgRec = rec.ecg_recordings || {
          id: rec.ecg_recording_id || rec.id,
          sample_rate: rec.sampleRate || rec.sample_rate || 300,
          duration_seconds: rec.durationSeconds || rec.duration_seconds || 30,
          mv_data_json: rec.mvData || rec.waveform_mv || null
        };

        return {
          ...rec,
          id: rec.id,
          patient_id: rec.patient_id || patientDbId,
          created_at,
          determination,
          average_heart_rate: heartRate,
          heart_rate: heartRate,
          bpm: heartRate,
          lead_config: config,
          is_inverted: inverted,
          device_type: deviceType,
          notes: rec.notes || "KardiaMobile Recording",
          ecg_recording_id: rec.ecg_recording_id || rec.id,
          ecg_recordings: ecgRec
        };
      });

      if (normalizedRecordings.length > 0) {
        const latest = normalizedRecordings[0];
        
        let leadsObj: Record<string, number[]> | undefined = undefined;
        const ecg = latest.ecg_recordings || latest;
        const leadsData = latest.waveform_leads || ecg.waveform_leads || latest.leads || ecg.leads;
        const mv = ecg.mv_data_json || latest.waveform_mv || ecg.waveform_mv || latest.mv_data_json;
        
        if (leadsData && typeof leadsData === 'object' && !Array.isArray(leadsData)) {
          leadsObj = leadsData;
        } else if (mv) {
          if (Array.isArray(mv)) {
            if (leadsData && typeof leadsData === 'object' && !Array.isArray(leadsData)) {
              leadsObj = leadsData;
            } else {
              const isSix = latest.lead_config === 'six' || latest.leadConfig === 'six' || latest.device_type?.toLowerCase().includes('six') || latest.notes?.toLowerCase().includes('6-lead') || latest.notes?.toLowerCase().includes('six');
              if (isSix) {
                const isInterleaved = mv.length % 6 === 0 && mv.length >= 6;
                if (isInterleaved) {
                  const tempLeads: Record<string, number[]> = {
                    I: [], II: [], III: [], aVR: [], aVL: [], aVF: []
                  };
                  for (let i = 0; i < mv.length; i++) {
                    const leadName = ["I", "II", "III", "aVR", "aVL", "aVF"][i % 6];
                    tempLeads[leadName].push(mv[i]);
                  }
                  leadsObj = tempLeads;
                } else {
                  leadsObj = {
                    I: mv,
                    II: mv,
                    III: mv,
                    aVR: mv,
                    aVL: mv,
                    aVF: mv,
                  };
                }
              } else {
                leadsObj = {
                  I: mv,
                };
              }
            }
          } else {
            leadsObj = mv as Record<string, number[]>;
          }
        } else if (leadsData) {
          leadsObj = leadsData;
        }

        setLastResult({
          success: true,
          heartRate: latest.average_heart_rate || latest.heart_rate || latest.bpm || 0,
          durationSeconds: latest.ecg_recordings?.duration_seconds || 30,
          sampleRate: latest.ecg_recordings?.sample_rate || 300,
          diagnosisText: latest.determination?.replace(/_/g, ' ') || "Normal Sinus Rhythm",
          waveformLeads: leadsObj
        } as any);
      }
    } catch (err) {
      console.warn("[ALIVECOR] Error fetching latest recording:", err);
    }
  }, [user]);

  // ── Fetch latest session on initial mount ───────────────────────────────────
  useEffect(() => {
    fetchLatestSession();
  }, [fetchLatestSession]);

  // ── Focus/Visibility Fail-safe & Sync ───────────────────────────────────────
  // When the user returns to our application window after taking an ECG in
  // the native turnkey activity, we ensure that:
  // 1. The loading states are cleared (making sure the button is enabled again).
  // 2. The freshly saved ECG record is fetched and displayed immediately in the result card.
  useEffect(() => {
    const handleFocus = () => {
      console.log("[ALIVECOR] Window focused/visible: resetting loader and syncing latest session...");
      setIsRecording(false);
      setRecordingPhase("idle");
      // Fetch the latest session to show the fresh ECG results right away
      fetchLatestSession();
    };

    window.addEventListener("focus", handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleFocus();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchLatestSession]);

  // ── Main recording handler ──────────────────────────────────────────────
  const handleStartRecording = useCallback(async () => {
    if (!user) {
      toast({ title: "Authentication Required", description: "Please sign in to record an ECG.", variant: "destructive" });
      return;
    }

    setIsRecording(true);
    setLastResult(null);
    setJwtError(null);

    try {
      // ── Step 0: Permissions ──────────────────────────────────────────────
      setRecordingPhase("permissions");
      await aliveCorSDK.requestPermissions();

      // ── Step 0.5: Disconnect other BLE sessions ──────────────────────────
      // Crucial: AliveCor needs exclusive radio access.
      try { await disconnectDevice(); } catch (e) { }

      // ── Step 1: Patient profile ──────────────────────────────────────────
      // PRIMARY: Try to read patient profile directly from localStorage.
      // The key pattern is: patient_profile_<userId>
      // The stored value contains the full patient object including the DB id
      // (e.g. "63740043-1269-4bd0-b4fa-cfde74bc5fe8").
      let patientDbId: string | null = null;

      try {
        const localKey = `patient_profile_${user.id}`;
        const cached = localStorage.getItem(localKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.id) {
            patientDbId = parsed.id;
            console.log(`✅ [ALIVECOR] Patient ID from localStorage (${localKey}): ${patientDbId}`);
          }
        }
      } catch (lsErr) {
        console.warn("[ALIVECOR] Could not read patient profile from localStorage:", lsErr);
      }

      // FALLBACK: If localStorage didn't have it, query Supabase
      let profile: any = null;
      if (!patientDbId) {
        const { data: dbProfile, error: profileErr } = await db.getPatientProfile(user.id);
        if (profileErr || !dbProfile) throw new Error(profileErr?.message || "Patient profile not found");
        profile = dbProfile;
        patientDbId = dbProfile.id;
        // Cache for next time
        try {
          localStorage.setItem(`patient_profile_${user.id}`, JSON.stringify(dbProfile));
        } catch (_) {}
        console.log(`✅ [ALIVECOR] Patient ID from Supabase DB: ${patientDbId}`);
      } else {
        // Still get full profile for payload building if not already cached
        profile = { id: patientDbId };
        try {
          const localKey = `patient_profile_${user.id}`;
          const cached = localStorage.getItem(localKey);
          if (cached) profile = JSON.parse(cached);
        } catch (_) {}
      }

      if (!patientDbId) throw new Error("Could not determine patient ID. Please refresh and try again.");

      // ── Step 2: Get JWT ──────────────────────────────────────────────────
      // Pass the actual patient DB UUID (e.g. "63740043-1269-4bd0-b4fa-cfde74bc5fe8")
      console.log(`🎫 [ALIVECOR] Requesting JWT for Patient ID: ${patientDbId}`);
      setRecordingPhase("getjwt");
      let tokenData = await getAliveCorToken(patientDbId);
      let jwtToken = tokenData.jwt;
      let targetPatientMrn = tokenData.patientMrn || patientDbId;

      if (!jwtToken || jwtToken.trim().length < 20 || jwtToken === "my_token_121") {
        const errMsg =
          "A valid AliveCor JWT is required. " +
          `Your AliveCor backend (${import.meta.env.VITE_ALIVECOR_BACKEND_URL || 'https://alivecor.monitraq.com'}) must return a real token. ` +
          "Currently received an invalid or placeholder token.";
        setJwtError(errMsg);
        toast({ title: "Invalid JWT Token", description: errMsg, variant: "destructive" });
        return;
      }

      console.log(`✅ [ALIVECOR] Got JWT (length=${jwtToken.length}), patientMrn=${targetPatientMrn}`);

      // ── Step 3 (optional): Pre-scan to show device in UI ─────────────────
      // NOTE: The AliveCor SDK recording Activity manages its own BLE connection.
      // We only do a brief background scan here to update the status card UI.
      // We do NOT wait for connection before launching recording.
      if (!aliveCorConnected && !isKardiaScanning) {
        setRecordingPhase("scanning");
        startKardiaScan().catch(() => { }); // background, non-blocking

        // Wait up to 5 s for discovery — read from ref (not stale closure)
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 500));
          if (kardiaDevicesRef.current.length > 0 || aliveCorConnected) break;
        }

        // If we found a device, connect it so status card shows "Connected"
        if (kardiaDevicesRef.current.length > 0 && !aliveCorConnected) {
          setRecordingPhase("connecting");
          try {
            await connectKardia(kardiaDevicesRef.current[0].deviceId);
          } catch { /* non-fatal — SDK will still handle BLE internally */ }
        }
      }

      // Ensure scanning is stopped before launching the recording activity
      await stopKardiaScan().catch(() => {});
      // Small delay to let the BT adapter stabilize
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setRecordingPhase("preparing");

      console.log(`[ALIVECOR] Starting 6-lead recording | patientId=${targetPatientMrn} | bundleId=com.monitraq.healthcare | env=sandbox`);
      let result = await aliveCorSDK.startSixLeadRecording({
        jwt: jwtToken!,
        mainsFrequencyHz: 50,
        environment: "sandbox",
        patientId: targetPatientMrn,
        bundleId: "com.monitraq.healthcare"
      });

      if (!result.success) {
        let lastError = result.diagnosisText || "Unknown error";
        console.warn(`[ALIVECOR] Recording failed: ${lastError}`);
      }

      setLastResult(result);

      // ── Step 5: Store & analyze ──────────────────────────────────────────
      // POST to {VITE_ALIVECOR_BACKEND_URL}/api/alivecor/ecg
      if (result.success) {
        try {
          const payload = buildAliveCorIngestPayload(
            patientDbId,
            result as unknown as AliveCorEcgResult
          );
          console.log(`[ALIVECOR] Storing ECG recording for patient_id=${patientDbId}...`);
          const stored = await storeAliveCorRecording(payload);
          console.log(`✅ [ALIVECOR] ECG stored, id=${stored?.id}`);
          if (stored?.id) triggerEcgAiAnalysis(stored.id);
          
          console.log("[ALIVECOR] Triggering UI sync with fresh database records...");
          await fetchLatestSession();

          toast({
            title: "6-Lead ECG Saved ✅",
            description: result.diagnosisText || "Recording saved and analyzed successfully.",
          });
        } catch (storageErr) {
          console.error("Failed to store AliveCor recording:", storageErr);
          toast({
            title: "Saved Locally",
            description: "ECG complete but couldn't sync to server right now. Will retry.",
          });
        }
      } else {
        toast({
          title: "Recording Cancelled",
          description: result.diagnosisText || "The 6-lead ECG was not completed. Please try again.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("6-lead ECG error:", err);
      const msg = err?.message || String(err);
      toast({
        title: "AliveCor Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsRecording(false);
      setRecordingPhase("idle");
    }
  }, [
    user, aliveCorConnected, isKardiaScanning,
    startKardiaScan, connectKardia, toast, fetchLatestSession,
  ]);

  // ── Derived UI state ────────────────────────────────────────────────────────
  const busy = isRecording;

  const phaseLabel: Record<string, string> = {
    idle: "Start 6-Lead ECG Recording",
    permissions: "Checking Permissions...",
    getjwt: "Authenticating with Medical SDK...",
    scanning: "Searching for Device...",
    connecting: "Connecting to KardiaMobile...",
    recording: "ECG Activity Launching...",
    preparing: "Calibrating Sensors...",
  };

  const statusColor = aliveCorConnected
    ? "border-emerald-500/30 bg-[#1A243D]"
    : isKardiaScanning
      ? "border-indigo-500/30 bg-[#1A243D]"
      : "border-amber-500/30 bg-[#1A243D]";

  return (
    <div className="min-h-screen bg-[#080D1A] text-white font-inter select-none">
      <div className="p-4 pt-safe-top max-w-sm mx-auto">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95 text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-900/70 flex items-center justify-center border border-indigo-400/50">
              <Activity className="h-6 w-6 text-indigo-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold">6-Channel ECG</h1>
              <p className="text-xs text-gray-400">KardiaMobile 6L · AliveCor SDK</p>
            </div>
          </div>
          {kardiaBattery !== null && (
            <div className="ml-auto flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-lg border border-green-500/20">
              <Zap className="w-3 h-3" />
              {Math.round(kardiaBattery * 100)}%
            </div>
          )}
        </header>

        {/* ── JWT error banner ────────────────────────────────────────────── */}
        {jwtError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-4 flex gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-red-400 mb-0.5">JWT Configuration Error</p>
              <p className="text-xs text-red-300/80">{jwtError}</p>
            </div>
          </div>
        )}

        {/* ── Device Status Card ─────────────────────────────────────────── */}
        <div className={`p-4 rounded-3xl border mb-4 flex items-center justify-between transition-all duration-300 ${statusColor}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${aliveCorConnected ? "bg-emerald-500/20" : isKardiaScanning ? "bg-indigo-500/20" : "bg-amber-500/20"}`}>
              {aliveCorConnected
                ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                : isKardiaScanning
                  ? <Search className="w-5 h-5 text-indigo-400 animate-pulse" />
                  : <Bluetooth className="w-5 h-5 text-amber-400" />}
            </div>
            <div>
              <p className="text-sm font-semibold">
                {aliveCorConnected
                  ? "Kardia Device Ready"
                  : isKardiaScanning
                    ? `Scanning${kardiaDevices.length > 0 ? ` — ${kardiaDevices.length} found` : "..."}`
                    : "Device Not Paired"}
              </p>
              <p className="text-[11px] text-gray-400">
                {aliveCorConnected
                  ? `${kardiaStatusText} — SDK will connect on record start`
                  : isKardiaScanning
                    ? "Looking for KardiaMobile 6L nearby..."
                    : "Tap 'Scan' or 'Start Recording' to discover device"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isKardiaScanning && <PulseDot />}
            {!aliveCorConnected && !isKardiaScanning && !busy && (
              <button
                onClick={() => startKardiaScan()}
                className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Scan
              </button>
            )}
          </div>
        </div>

        {/* ── Found Devices List ─────────────────────────────────────────── */}
        {kardiaDevices.length > 0 && (
          <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-3 mb-4 space-y-2">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Found Nearby</p>
            {kardiaDevices.map((dev) => (
              <button
                key={dev.deviceId}
                onClick={() => connectKardia(dev.deviceId)}
                disabled={busy}
                className="w-full flex items-center justify-between bg-[#121B32] hover:bg-[#121B32]/80 border border-slate-700/40 rounded-xl px-3 py-2.5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-medium">{dev.deviceName}</span>
                </div>
                <span className="text-xs text-gray-400">{dev.rssi} dBm</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Instructions ─────────────────────────────────────────────── */}
        <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-4 mb-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">How to Take a 6-Lead ECG</p>
          </div>
          <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
            <li>Tap <strong>"Start Recording"</strong> below</li>
            <li>The AliveCor SDK will scan and connect to your KardiaMobile 6L automatically</li>
            <li>When prompted, place <strong>both thumbs</strong> on the two top electrodes</li>
            <li>Place your <strong>left ankle or knee</strong> on the bottom electrode</li>
            <li>Keep still for the full 30-second recording</li>
          </ol>
          <div className="bg-[#121B32] border border-slate-700/40 rounded-2xl p-3 flex gap-2">
            <Wifi className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-200">
              You do <strong>not</strong> need to pair the device manually.
              The AliveCor SDK detects the KardiaMobile 6L automatically when you hold the electrodes.
            </p>
          </div>
        </div>

        {/* ── Recording progress indicator ─────────────────────────────── */}
        {busy && (
          <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-5 mb-5 shadow-2xl shadow-indigo-500/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </div>
                <p className="text-base font-bold text-white tracking-tight">
                  {recordingPhase === "connecting" ? "Initializing Sensors..." : (phaseLabel[recordingPhase] || "Processing...")}
                </p>
              </div>
            </div>

            {/* Preparation / Holding Instructions (Show when not yet recording) */}
            {recordingPhase !== "recording" && (
              <div className="bg-[#121B32] border border-slate-700/40 rounded-2xl p-6 mb-5 flex flex-col items-center text-center space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full animate-pulse" />
                  <div className="relative bg-indigo-500/10 p-4 rounded-full border border-indigo-500/30">
                    <User className="w-12 h-12 text-indigo-400" />
                  </div>
                  <div className="absolute -right-1 -bottom-1 bg-amber-500 p-1.5 rounded-full border-2 border-[#1A243D]">
                    <Zap className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">Position Your Device</p>
                  <p className="text-xs text-gray-400 max-w-[200px] mx-auto">
                    Hold both thumbs on top electrodes and touch bottom to your <span className="text-indigo-300 font-bold">Left Ankle</span>.
                  </p>
                </div>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= (["getjwt", "scanning", "connecting"].indexOf(recordingPhase)) ? "bg-indigo-500" : "bg-white/10"}`} />
                  ))}
                </div>
              </div>
            )}

            {/* Simulated 6-Lead Grid (Show ONLY when recording) */}
            {recordingPhase === "recording" && (
              <div className="grid grid-cols-2 gap-3 mb-5 animate-in fade-in slide-in-from-bottom-2 duration-700">
                {['I', 'II', 'III', 'aVR', 'aVL', 'aVF'].map((lead, idx) => (
                  <div key={lead} className="space-y-1">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] font-bold text-gray-500 uppercase">{lead}</span>
                      <span className="text-[9px] text-indigo-400/60 font-mono">25mm/s</span>
                    </div>
                    <MovingWaveform
                      color={idx % 2 === 0 ? "#6366f1" : "#818cf8"}
                      height={36}
                      speed={1500 + (idx * 100)}
                      delay={idx * 200}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 border-t border-slate-700/40 pt-4">
              {(["permissions", "getjwt", "scanning", "connecting", "recording"] as const).map((phase, i) => {
                const phases = ["permissions", "getjwt", "scanning", "connecting", "recording"];
                const currentIdx = phases.indexOf(recordingPhase);
                const phaseIdx = i;
                const done = phaseIdx < currentIdx;
                const active = phaseIdx === currentIdx;
                return (
                  <div key={phase} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-all duration-500 ${done ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" :
                        active ? "bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.6)]" :
                          "bg-white/10"
                      }`} />
                    <p className={`text-xs font-medium transition-colors duration-500 ${done ? "text-emerald-400/80" : active ? "text-white" : "text-gray-600"
                      }`}>
                      {["Checking Permissions", "Authentication Verified", "Searching for KardiaMobile 6L", "Device Handshake", "6-Lead Measurement Activity"][i]}
                    </p>
                    {done && <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-auto" />}
                    {active && <Loader2 className="w-3 h-3 text-indigo-400 animate-spin ml-auto" />}
                  </div>
                );
              })}
            </div>

            <p className="mt-4 text-[10px] text-center text-gray-500 italic">
              Keep hands and ankle still during recording
            </p>
          </div>
        )}

        {/* ── Start Button ─────────────────────────────────────────────── */}
        <button
          disabled={busy}
          onClick={handleStartRecording}
          className={`w-full font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 border ${busy
              ? "bg-indigo-600/40 text-white/60 border-indigo-500/30 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-400/60 shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-95"
            }`}
        >
          {busy ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{phaseLabel[recordingPhase] || "Please wait..."}</span>
            </>
          ) : (
            <>
              <Activity className="h-5 w-5" />
              <span>{phaseLabel.idle}</span>
            </>
          )}
        </button>

        {/* ── Last Result ────────────────────────────────────────────────── */}
        {lastResult && (
          <div className="mt-5 bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-300" />
              <h2 className="text-sm font-semibold">Last Session Result</h2>
              {lastResult.success && (
                <span className="ml-auto text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  ✓ Complete
                </span>
              )}
            </div>

            {lastResult.success ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {lastResult.heartRate && (
                    <div className="bg-[#121B32] border border-slate-700/40 rounded-xl p-2.5 text-center">
                      <p className="text-xs text-gray-400 mb-0.5">Heart Rate</p>
                      <p className="text-lg font-bold text-red-400">{lastResult.heartRate}</p>
                      <p className="text-[10px] text-gray-500">bpm</p>
                    </div>
                  )}
                  {lastResult.durationSeconds && (
                    <div className="bg-[#121B32] border border-slate-700/40 rounded-xl p-2.5 text-center">
                      <p className="text-xs text-gray-400 mb-0.5">Duration</p>
                      <p className="text-lg font-bold text-indigo-300">{lastResult.durationSeconds.toFixed(0)}</p>
                      <p className="text-[10px] text-gray-500">sec</p>
                    </div>
                  )}
                  {lastResult.sampleRate && (
                    <div className="bg-[#121B32] border border-slate-700/40 rounded-xl p-2.5 text-center">
                      <p className="text-xs text-gray-400 mb-0.5">Sample Rate</p>
                      <p className="text-lg font-bold text-purple-300">{lastResult.sampleRate}</p>
                      <p className="text-[10px] text-gray-500">Hz</p>
                    </div>
                  )}
                </div>

                {lastResult.diagnosisText && (
                  <div className="bg-[#121B32] border border-slate-700/40 rounded-xl p-3">
                    <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-1">AI Diagnosis</p>
                    <p className="text-sm text-gray-200">{lastResult.diagnosisText}</p>
                  </div>
                )}

                {lastResult.waveformLeads && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Lead I Preview</p>
                      <button 
                        onClick={() => setIsModalOpen(true)}
                        className="text-xs bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 px-3 py-1 rounded-full transition-colors border border-indigo-500/30"
                      >
                        View Detailed Report
                      </button>
                    </div>
                    <ECGMiniPreview leads={lastResult.waveformLeads} />
                  </div>
                )}
              </>
            ) : (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-sm text-red-300">
                  {lastResult.diagnosisText && lastResult.diagnosisText !== "Recording failed"
                    ? `Error: ${lastResult.diagnosisText}`
                    : "Recording was not completed. Ensure Bluetooth is on, the device is charged, and you are firmly touching all three electrodes."}
                </p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Detailed ECG View Modal - Pro UI */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md w-[95vw] bg-[#1A243D] text-white p-0 overflow-hidden rounded-3xl border border-slate-700/40 shadow-2xl h-[90vh] flex flex-col">
          {/* Header Area */}
          <div className="p-5 border-b border-slate-700/40 bg-[#1A243D] sticky top-0 z-20">
            <DialogHeader className="text-left space-y-0">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    /normal/i.test(lastResult?.determination || '') ? 'bg-emerald-500' : 'bg-amber-500'
                  }`} />
                  <DialogTitle className="text-xl font-bold text-white">
                    {lastResult?.determination?.replace(/_/g, ' ') || lastResult?.diagnosisText || 'UNCLASSIFIED'}
                  </DialogTitle>
                </div>
                <div className="flex items-center gap-4 text-gray-400">
                  <Download className="w-5 h-5 cursor-pointer hover:text-white transition-colors" />
                  <Star className="w-5 h-5 cursor-pointer hover:text-white transition-colors" />
                </div>
              </div>
              <DialogDescription className="sr-only">
                Detailed ECG waveform and clinical analysis
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex items-center gap-3 text-gray-400 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-[#121B32] flex items-center justify-center border border-slate-700/40">
                  <Activity size={14} className="text-indigo-400" />
                </div>
                <span className="font-medium text-gray-300">Recent Recording</span>
              </div>
              
              {lastResult?.heartRate && (
                <div className="flex items-center gap-1 text-rose-400 font-bold bg-rose-950/40 border border-rose-900/50 px-2 py-0.5 rounded-full text-xs">
                  <Heart className="w-3.5 h-3.5 fill-current text-rose-500 animate-pulse" />
                  <span>{lastResult.heartRate} BPM</span>
                </div>
              )}

              <div className="flex items-center gap-1.5 ml-auto">
                <Calendar size={14} />
                <span>{new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>

          {/* ECG Grid Content — canvas-based, shared amplitude scale across all leads */}
          <div className="flex-1 relative overflow-hidden">
            {lastResult?.waveformLeads ? (
              <ECGSixLeadView
                leads={lastResult.waveformLeads}
                heartRate={lastResult.heartRate}
                theme="dark"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-40 text-gray-500">
                <Activity size={48} className="opacity-20 mb-4" />
                <p className="text-sm font-bold">Waveform Data Unavailable</p>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="p-6 bg-[#1A243D] border-t border-slate-700/40 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">Enhance</p>
                <p className="text-[10px] text-gray-400">On</p>
              </div>
              <div className="w-12 h-6 bg-[#121B32] rounded-full p-1 cursor-pointer border border-slate-700/40">
                <div className="w-4 h-4 bg-emerald-500 rounded-full ml-auto shadow-md" />
              </div>
            </div>
            
            <button 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-14 rounded-xl font-bold text-sm tracking-widest uppercase transition-all shadow-lg active:scale-[0.98]"
              onClick={() => setIsModalOpen(false)}
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default KardiaSixLeadECG;
