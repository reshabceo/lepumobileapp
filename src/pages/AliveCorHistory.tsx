import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Activity, Calendar, Heart, Timer, RefreshCw, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getAliveCorToken, getAliveCorRecordings, getAliveCorRecordingDetail, db, supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ECGSixLeadView, getLeadsFromRecording } from "@/components/ECGLeadCanvas";
import { Download, Star } from "lucide-react";

const AliveCorHistory = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [recordings, setRecordings] = useState<any[]>([]);
  const [patientName, setPatientName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Detailed view state
  const [selectedRecording, setSelectedRecording] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [recordingDetail, setRecordingDetail] = useState<any | null>(null);
  // selectedLead kept for potential future use but rendering is now canvas-based
  const [selectedLead, setSelectedLead] = useState<string>("I");

  const fetchRecordings = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Get patient profile to get the ID
      const { data: profile } = await db.getPatientProfile(user.id);
      if (!profile) throw new Error("Patient profile not found");
      setPatientName(profile.full_name || "");

      // 2. Get AliveCor token which also returns the MRN (needed for other things maybe)
      const { patientMrn } = await getAliveCorToken(profile.id);
      
      // 3. Fetch recordings using the Supabase patient_id
      console.log(`[AliveCorHistory] Fetching recordings for patient_id: ${profile.id} (MRN: ${patientMrn})`);
      
      let recordings: any[] = [];
      
      try {
        const apiResponse = await getAliveCorRecordings(patientMrn || profile.id);
        console.log("[AliveCorHistory] Backend API response:", JSON.stringify(apiResponse).substring(0, 500));
        
        // The backend may return different shapes depending on version.
        // Handle: { recordings: [] }, { data: [] }, { items: [] }, { results: [] }, or flat []
        if (Array.isArray(apiResponse)) {
          recordings = apiResponse;
        } else if (Array.isArray(apiResponse?.recordings)) {
          recordings = apiResponse.recordings;
        } else if (Array.isArray(apiResponse?.data)) {
          recordings = apiResponse.data;
        } else if (Array.isArray(apiResponse?.items)) {
          recordings = apiResponse.items;
        } else if (Array.isArray(apiResponse?.results)) {
          recordings = apiResponse.results;
        } else {
          console.warn("[AliveCorHistory] Unknown API response shape:", apiResponse);
          recordings = [];
        }
      } catch (backendErr: any) {
        console.warn("[AliveCorHistory] Backend API call failed:", backendErr?.message);
        recordings = [];
      }

      // 4. If backend returned nothing, fall back to direct Supabase query.
      //    This ensures recordings stored in ecg_recordings / alivecor_recordings
      //    are always visible even if the backend proxy has issues.
      if (recordings.length === 0) {
        console.log("[AliveCorHistory] Backend returned no recordings — falling back to Supabase direct query...");
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
          .eq("patient_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(30);

        if (sbErr) {
          console.error("[AliveCorHistory] Supabase fallback error:", sbErr);
        } else if (supabaseRecs && supabaseRecs.length > 0) {
          console.log(`[AliveCorHistory] Supabase fallback: found ${supabaseRecs.length} recordings`);
          // Normalise the Supabase rows to match the shape the UI expects
          recordings = supabaseRecs.map((r: any) => ({
            id: r.id,
            patient_id: r.patient_id,
            created_at: r.created_at,
            determination: r.determination || "NORMAL",
            average_heart_rate: r.heart_rate,
            heart_rate: r.heart_rate,
            bpm: r.heart_rate,
            lead_config: r.lead_config,
            is_inverted: r.is_inverted,
            device_type: r.device_type,
            notes: r.notes,
            ecg_recording_id: r.ecg_recording_id,
            ecg_recordings: r.ecg_recordings,
          }));
        } else {
          console.log("[AliveCorHistory] Supabase fallback: no recordings found either.");
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
          patient_id: rec.patient_id || profile.id,
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

      console.log(`[AliveCorHistory] Total recordings to display: ${normalizedRecordings.length}`);
      setRecordings(normalizedRecordings);
    } catch (err: any) {
      console.error("[AliveCorHistory] Error:", err);
      setError(err.message || "Failed to load recordings");
      toast({
        title: "Error",
        description: "Could not fetch ECG records. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = async (rec: any) => {
    setSelectedRecording(rec);
    setSelectedLead("I");

    // Check if data is already available in the nested ecg_recordings object
    const hasWaves = rec.ecg_recordings?.mv_data_json || rec.raw_ecg_json || rec.waveform_mv;
    
    if (hasWaves) {
      console.log("[AliveCorHistory] Data present in list response, skipping fetch.");
      setRecordingDetail(rec);
      setIsDetailLoading(false);
      return;
    }

    setRecordingDetail(null);
    setIsDetailLoading(true);
    
    // Try multiple possible IDs to be safe
    const idsToTry = [rec.id, rec.ecg_recording_id].filter(Boolean);
    let success = false;

    for (const id of idsToTry) {
      try {
        console.log(`[AliveCorHistory] Fetching detail for ID: ${id}`);
        // Pass patient_id for authorization
        const data = await getAliveCorRecordingDetail(rec.patient_id, id);
        const detail = data.recording || data.data || data;
        setRecordingDetail(detail);
        success = true;
        break;
      } catch (err: any) {
        console.warn(`[AliveCorHistory] Detail Fetch Error for ID ${id}:`, err);
      }
    }

    if (!success) {
      toast({
        title: "Access Restricted",
        description: "Could not load high-resolution waves. (Permissions or Not Found)",
        variant: "destructive",
      });
    }
    setIsDetailLoading(false);
  };  // Lead extraction delegated to ECGLeadCanvas utility (getLeadsFromRecording)

  useEffect(() => {
    // 1. Initial fetch on mount / user session load
    if (!authLoading && user) {
      fetchRecordings();
    } else if (!authLoading && !user) {
      // Fallback: Check if user exists directly from supabase if context is empty
      (async () => {
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        if (supabaseUser) {
           fetchRecordings();
        } else {
           setLoading(false);
           setError("Please sign in to view your ECG records.");
        }
      })();
    }

    // 2. Auto-refresh when the window becomes visible or focused
    // (e.g. returning from the native AliveCor ECG Recording Activity)
    const handleRefreshEvents = () => {
      if (document.visibilityState === 'visible' && user) {
        console.log("[AliveCorHistory] Tab became visible or focused, refreshing recordings...");
        fetchRecordings();
      }
    };

    window.addEventListener("focus", handleRefreshEvents);
    document.addEventListener("visibilitychange", handleRefreshEvents);

    return () => {
      window.removeEventListener("focus", handleRefreshEvents);
      document.removeEventListener("visibilitychange", handleRefreshEvents);
    };
  }, [user, authLoading]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-[#080D1A] min-h-screen text-white p-4 pt-safe-top font-inter">
      <div className="max-w-sm mx-auto space-y-6 pb-10">
        {/* Header */}
        <header className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-rose-900/70 flex items-center justify-center border border-rose-400/50">
              <Activity className="h-6 w-6 text-rose-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold">ECG Records</h1>
              <p className="text-xs text-gray-400">AliveCor History</p>
            </div>
          </div>
          <button 
            onClick={fetchRecordings} 
            disabled={loading}
            className="ml-auto p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </header>

        {/* Status Section */}
        {loading && recordings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Activity className="w-12 h-12 text-purple-500 animate-pulse" />
            <p className="text-gray-400">Loading your ECG records...</p>
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <Button onClick={fetchRecordings} variant="outline" className="border-red-500/50 hover:bg-red-500/10 text-white">
              Try Again
            </Button>
          </div>
        ) : recordings.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center space-y-4">
            <div className="bg-white/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium">No records found</h3>
              <p className="text-gray-400 text-sm">When you take an ECG with KardiaMobile, it will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {recordings.map((rec) => (
              <Card 
                key={rec.id} 
                className="bg-[#1A1A1A] border-white/10 hover:border-rose-500/50 transition-all group overflow-hidden cursor-pointer active:scale-[0.98]"
                onClick={() => handleCardClick(rec)}
              >
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className={/normal/i.test(rec.determination || '') ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-orange-500/20 text-orange-400 border-orange-500/30'}>
                          {rec.determination?.replace(/_/g, ' ') || 'UNCLASSIFIED'}
                        </Badge>
                        {rec.lead_config === 'six' && (
                          <Badge variant="outline" className="border-purple-500/50 text-purple-400">6-Lead</Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg mt-1 text-white">
                        {formatDate(rec.created_at)}
                      </CardTitle>
                    </div>
                    {(rec.average_heart_rate || rec.heart_rate || rec.bpm) && (
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-rose-500 font-bold text-xl">
                          <Heart className="w-4 h-4 fill-current" />
                          {rec.average_heart_rate || rec.heart_rate || rec.bpm}
                        </div>
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">BPM Avg</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400 mt-4">
                    <div className="flex items-center gap-1">
                      <Timer className="w-4 h-4" />
                      {rec.ecg_recordings?.duration_seconds || '--'}s
                    </div>
                    <div className="flex items-center gap-1">
                      <Activity className="w-4 h-4" />
                      {rec.ecg_recordings?.sample_rate || '--'} Hz
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detailed ECG View Modal - Pro UI */}
      <Dialog open={!!selectedRecording} onOpenChange={(open) => !open && setSelectedRecording(null)}>
        <DialogContent className="max-w-md w-[95vw] bg-white text-slate-900 p-0 overflow-hidden rounded-3xl border-none shadow-2xl h-[90vh] flex flex-col">
          {/* Header Area */}
          <div className="p-5 border-b border-slate-100 bg-white sticky top-0 z-20">
            <DialogHeader className="text-left space-y-0">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    /normal/i.test(selectedRecording?.determination || '') ? 'bg-emerald-500' : 'bg-amber-500'
                  }`} />
                  <DialogTitle className="text-xl font-bold text-slate-800">
                    {selectedRecording?.determination?.replace(/_/g, ' ') || 'UNCLASSIFIED'}
                  </DialogTitle>
                </div>
                <div className="flex items-center gap-4 text-slate-400">
                  <Download className="w-5 h-5 cursor-pointer hover:text-slate-600 transition-colors" />
                  <Star className="w-5 h-5 cursor-pointer hover:text-slate-600 transition-colors" />
                </div>
              </div>
              <DialogDescription className="sr-only">
                Detailed ECG waveform and clinical analysis
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex items-center gap-3 text-slate-500 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                  <Activity size={14} className="text-slate-600" />
                </div>
                <span className="font-medium text-slate-700">{patientName || "Patient"}</span>
              </div>
              
              {(selectedRecording?.average_heart_rate || selectedRecording?.heart_rate || selectedRecording?.bpm) && (
                <div className="flex items-center gap-1 text-rose-500 font-bold bg-rose-50 px-2 py-0.5 rounded-full text-xs">
                  <Heart className="w-3.5 h-3.5 fill-current text-rose-500 animate-pulse" />
                  <span>{selectedRecording.average_heart_rate || selectedRecording.heart_rate || selectedRecording.bpm} BPM</span>
                </div>
              )}

              <div className="flex items-center gap-1.5 ml-auto">
                <Calendar size={14} />
                <span>{selectedRecording && formatDate(selectedRecording.created_at)}</span>
              </div>
            </div>
          </div>

          {/* ECG Grid Content */}
          <div className="flex-1 relative overflow-hidden">
            {isDetailLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-white/60 backdrop-blur-sm z-30">
                <RefreshCw className="w-10 h-10 text-rose-500 animate-spin" />
                <p className="text-sm font-bold text-slate-400 animate-pulse uppercase tracking-widest">Processing Waveform...</p>
              </div>
            ) : (() => {
              const ecgLeads = getLeadsFromRecording(recordingDetail);
              return ecgLeads ? (
                <ECGSixLeadView
                  leads={ecgLeads}
                  heartRate={selectedRecording?.average_heart_rate || selectedRecording?.heart_rate || selectedRecording?.bpm}
                  theme="light"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-40 text-slate-300">
                  <Activity size={48} className="opacity-20 mb-4" />
                  <p className="text-sm font-bold">Waveform Data Unavailable</p>
                </div>
              );
            })()}
          </div>

          {/* Footer Controls */}
          <div className="p-6 bg-white border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-800">Enhance</p>
                <p className="text-[10px] text-slate-400">On</p>
              </div>
              <div className="w-12 h-6 bg-slate-100 rounded-full p-1 cursor-pointer">
                <div className="w-4 h-4 bg-rose-500 rounded-full ml-auto shadow-md" />
              </div>
            </div>
            
            <button 
              className="w-full bg-[#1A2B3B] hover:bg-[#121E2A] text-white h-14 rounded-xl font-bold text-sm tracking-widest uppercase transition-all shadow-lg active:scale-[0.98]"
              onClick={() => setSelectedRecording(null)}
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default AliveCorHistory;
