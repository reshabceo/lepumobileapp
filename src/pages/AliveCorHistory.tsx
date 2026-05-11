import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Activity, Calendar, Heart, Timer, RefreshCw, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getAliveCorToken, getAliveCorRecordings, getAliveCorRecordingDetail, db, supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

const AliveCorHistory = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Detailed view state
  const [selectedRecording, setSelectedRecording] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [recordingDetail, setRecordingDetail] = useState<any | null>(null);

  const fetchRecordings = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Get patient profile to get the ID
      const { data: profile } = await db.getPatientProfile(user.id);
      if (!profile) throw new Error("Patient profile not found");

      // 2. Get AliveCor token which also returns the MRN
      const { patientMrn } = await getAliveCorToken(profile.id);
      
      // 3. Fetch recordings using the MRN
      console.log(`[AliveCorHistory] Fetching recordings for MRN: ${patientMrn}`);
      const data = await getAliveCorRecordings(patientMrn);
      setRecordings(data.recordings || []);
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
    setRecordingDetail(null);
    setIsDetailLoading(true);
    try {
      const data = await getAliveCorRecordingDetail(rec.id);
      setRecordingDetail(data.recording || data);
    } catch (err: any) {
      console.error("[AliveCorHistory] Detail Fetch Error:", err);
      toast({
        title: "Error",
        description: "Failed to load detailed waveform data.",
        variant: "destructive",
      });
    } finally {
      setIsDetailLoading(false);
    }
  };

  const prepareChartData = (rawJson: any) => {
    if (!rawJson) return [];
    
    // AliveCor raw_ecg_json often contains a "leads" object with arrays
    // or a single array if it's a single-lead recording.
    let samples: number[] = [];
    
    if (Array.isArray(rawJson)) {
      samples = rawJson;
    } else if (rawJson.leads?.I) {
      samples = rawJson.leads.I;
    } else if (rawJson.waveform_mv) {
      samples = rawJson.waveform_mv;
    }
    
    // Limit to first 1500 points (~5 seconds at 300Hz) for performance
    return samples.slice(0, 1500).map((val, idx) => ({
      time: idx,
      value: val
    }));
  };

  useEffect(() => {
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
    <div className="bg-[#0a0a0f] min-h-screen text-white p-4 font-inter">
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
                        <Badge className={rec.determination === 'NORMAL_SINUS_RHYTHM' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-orange-500/20 text-orange-400 border-orange-500/30'}>
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
                    {rec.average_heart_rate && (
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-rose-500 font-bold text-xl">
                          <Heart className="w-4 h-4 fill-current" />
                          {rec.average_heart_rate}
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

      {/* Detailed ECG View Modal */}
      <Dialog open={!!selectedRecording} onOpenChange={(open) => !open && setSelectedRecording(null)}>
        <DialogContent className="max-w-2xl bg-[#121214] border-white/10 text-white p-0 overflow-hidden">
          <div className="p-6 pb-0">
            <DialogHeader>
              <div className="flex justify-between items-start mb-2">
                <div className="space-y-1">
                  <Badge className={selectedRecording?.determination === 'NORMAL_SINUS_RHYTHM' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-orange-500/20 text-orange-400 border-orange-500/30'}>
                    {selectedRecording?.determination?.replace(/_/g, ' ') || 'UNCLASSIFIED'}
                  </Badge>
                  <DialogTitle className="text-xl font-bold text-white">
                    {selectedRecording && formatDate(selectedRecording.created_at)}
                  </DialogTitle>
                </div>
                {selectedRecording?.average_heart_rate && (
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-rose-500 font-bold text-2xl">
                      <Heart className="w-5 h-5 fill-current" />
                      {selectedRecording.average_heart_rate}
                    </div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Average BPM</span>
                  </div>
                )}
              </div>
              <DialogDescription className="text-gray-400 text-sm">
                Recorded using {selectedRecording?.device_type?.replace(/_/g, ' ') || 'KardiaMobile'} · {selectedRecording?.lead_config === 'six' ? '6-Lead Mode' : 'Single Lead Mode'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 pt-4 space-y-6">
            {/* Graph Container */}
            <div className="bg-black/40 rounded-2xl border border-white/5 p-4 h-[240px] relative overflow-hidden">
              {isDetailLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-black/20 backdrop-blur-sm">
                  <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
                  <p className="text-xs text-gray-400">Fetching high-resolution waveform...</p>
                </div>
              ) : recordingDetail?.raw_ecg_json || recordingDetail?.waveform_mv || recordingDetail?.waveform_leads ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={prepareChartData(recordingDetail.raw_ecg_json || recordingDetail.waveform_mv || recordingDetail.waveform_leads)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                    <XAxis dataKey="time" hide />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: '8px' }}
                      itemStyle={{ color: '#E11D48' }}
                      labelStyle={{ display: 'none' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#E11D48" 
                      strokeWidth={1.5} 
                      dot={false} 
                      isAnimationActive={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 text-gray-500">
                  <Activity className="w-8 h-8 opacity-20" />
                  <p className="text-sm">Waveform data not available for this record</p>
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Duration</p>
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-rose-400" />
                  <span className="font-semibold">{selectedRecording?.ecg_recordings?.duration_seconds || '--'}s</span>
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Sample Rate</p>
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-400" />
                  <span className="font-semibold">{selectedRecording?.ecg_recordings?.sample_rate || '--'}Hz</span>
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Lead Type</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] border-rose-500/30 text-rose-400 h-5">
                    {selectedRecording?.lead_config?.toUpperCase() || 'SINGLE'}
                  </Badge>
                </div>
              </div>
            </div>

            <Button 
              className="w-full bg-rose-600 hover:bg-rose-500 text-white h-12 rounded-xl font-bold transition-all"
              onClick={() => setSelectedRecording(null)}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AliveCorHistory;
