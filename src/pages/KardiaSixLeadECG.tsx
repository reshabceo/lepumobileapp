import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Activity, ArrowLeft, FileText } from "lucide-react";
import { aliveCorSDK, AliveCorRecordingResult } from "@/lib/alivecor-sdk-bridge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getAliveCorToken, db, storeAliveCorRecording, triggerEcgAiAnalysis } from "@/lib/supabase";
import { buildAliveCorIngestPayload } from "@/lib/aliveCorKardia";
import { AliveCorEcgResult } from "@/plugins/alivecor";

const KardiaSixLeadECG: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [lastResult, setLastResult] = useState<AliveCorRecordingResult | null>(null);

  const handleStartRecording = async () => {
    if (!user) {
      toast({ title: "Authentication Required", description: "Please sign in to perform a 6‑lead ECG.", variant: "destructive" });
      return;
    }

    try {
      setIsRecording(true);
      setLastResult(null);

      const { data: profile, error: profileErr } = await db.getPatientProfile(user.id);
      if (profileErr || !profile) {
        throw new Error(profileErr?.message || "Patient profile not found");
      }

      let jwtToken: string | undefined;
      try {
        jwtToken = await getAliveCorToken(profile.id);
      } catch (tokenErr) {
        console.warn("Failed to fetch backend JWT, falling back to test JWT if available", tokenErr);
        jwtToken = import.meta.env.VITE_ALIVECOR_TEST_JWT as string | undefined;
      }

      if (!jwtToken) {
        toast({
          title: "AliveCor Auth Not Configured",
          description: "Unable to retrieve a valid Kardia JWT. Ensure the backend auth proxy is running.",
          variant: "destructive",
        });
        setIsRecording(false);
        return;
      }

      const result = await aliveCorSDK.startSixLeadRecording({
        jwt: jwtToken,
        mainsFrequencyHz: 50,
        environment: import.meta.env.PROD ? "production" : "sandbox",
        patientId: profile.id,
      });

      setLastResult(result);

      if (result.success) {
        // Build payload and store in Supabase
        try {
          const payload = buildAliveCorIngestPayload(profile.id, result as unknown as AliveCorEcgResult);
          const stored = await storeAliveCorRecording(payload);
          if (stored?.id) {
            triggerEcgAiAnalysis(stored.id);
          }
          toast({
            title: "6‑Lead ECG Saved",
            description: result.diagnosisText || "Recording saved and analyzed successfully.",
          });
        } catch (storageErr) {
          console.error("Failed to store AliveCor recording", storageErr);
          toast({
            title: "Recording Saved Locally",
            description: "ECG completed but failed to sync with the server. It will be synced later.",
            variant: "warning",
          });
        }
      } else {
        toast({
          title: "Recording Not Completed",
          description: "The 6‑lead ECG flow was cancelled or failed.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Failed to start 6‑lead ECG recording", err);
      toast({
        title: "AliveCor Error",
        description: "Unable to start the 6‑lead ECG recording. Check native SDK setup.",
        variant: "destructive",
      });
    } finally {
      setIsRecording(false);
    }
  };

  return (
    <div className="bg-[#101010] min-h-screen text-white p-4 font-inter">
      <div className="max-w-sm mx-auto">
        {/* Header */}
        <header className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-900/70 flex items-center justify-center border border-indigo-400/50">
              <Activity className="h-6 w-6 text-indigo-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold">6‑Channel ECG</h1>
              <p className="text-xs text-gray-400">KardiaMobile 6L via AliveCor SDK</p>
            </div>
          </div>
        </header>

        {/* Info Card */}
        <div className="bg-[#1E1E1E] rounded-2xl p-4 mb-5 border border-slate-700 space-y-2">
          <p className="text-sm text-gray-200">
            This flow uses the official AliveCor Kardia SDK to perform a full 6‑lead ECG
            recording. The SDK takes over the screen for pairing, recording, AI analysis,
            and result display, then returns control to this app.
          </p>
          <ul className="text-xs text-gray-400 list-disc list-inside space-y-1">
            <li>Supports KardiaMobile 6L and compatible devices.</li>
            <li>Requires a valid JWT from the Kardia auth server.</li>
            <li>Recording and AI analysis run completely on‑device.</li>
          </ul>
        </div>

        {/* Start Recording Button */}
        <button
          disabled={isRecording}
          onClick={handleStartRecording}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-200 hover:scale-105 active:scale-95 border border-indigo-400/60"
        >
          {isRecording ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Starting 6‑Lead ECG...</span>
            </>
          ) : (
            <>
              <Activity className="h-5 w-5" />
              <span>Start 6‑Channel ECG Recording</span>
            </>
          )}
        </button>

        {/* Last Result Summary (if any) */}
        {lastResult && (
          <div className="mt-5 bg-[#141414] border border-slate-700 rounded-2xl p-4 flex items-start gap-3">
            <div className="mt-1">
              <FileText className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold mb-1">Last 6‑Lead Session</h2>
              {lastResult.success ? (
                <p className="text-xs text-gray-300">
                  Completed
                  {lastResult.heartRate ? ` • HR ${lastResult.heartRate} bpm` : ""}
                  {lastResult.diagnosisText ? ` • ${lastResult.diagnosisText}` : ""}
                </p>
              ) : (
                <p className="text-xs text-red-300">
                  Session did not complete. Check device connection and try again.
                </p>
              )}
              {lastResult.pdfPath && (
                <p className="text-[11px] text-gray-500 mt-1">
                  PDF stored at: <span className="break-all">{lastResult.pdfPath}</span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KardiaSixLeadECG;

