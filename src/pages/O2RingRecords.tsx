import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Wind, 
  Heart, 
  Activity, 
  Timer, 
  Calendar, 
  Clock, 
  RefreshCw, 
  BarChart3, 
  List, 
  LineChart as LineChartIcon, 
  ShieldAlert,
  Smartphone,
  Info
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

interface O2Record {
  id: string;
  patient_id: string;
  device_id: string;
  device_type: string;
  measurement_type: string;
  data: {
    oxygenSaturation: number;
    pulseRate: number;
    pi: number;
    minSpo2?: number;
    maxHr?: number;
    durationSeconds?: number;
    deviceName?: string;
    status?: string;
    source?: string;
  };
  reading_timestamp: string;
}

const O2RingRecords: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [records, setRecords] = useState<O2Record[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'trend'>('list');

  const fetchRecords = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Get patient ID
      const { data: patientProfile, error: profileErr } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (profileErr || !patientProfile) {
        throw new Error("Patient profile not found");
      }

      // 2. Fetch records
      const { data, error: fetchErr } = await supabase
        .from('vital_signs')
        .select('*')
        .eq('patient_id', patientProfile.id)
        .eq('device_type', 'OXIMETER')
        .order('reading_timestamp', { ascending: false })
        .limit(100);

      if (fetchErr) {
        throw fetchErr;
      }

      setRecords((data as O2Record[]) || []);
    } catch (err: any) {
      console.error("Error fetching O2 Ring records:", err);
      setError(err.message || "Failed to load O2 Ring records");
      toast({
        title: "Error",
        description: "Could not fetch O2 Ring records.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [user]);

  const formatTimestamp = (dateString: string) => {
    try {
      return format(parseISO(dateString), "MMM dd, yyyy • h:mm a");
    } catch (e) {
      return new Date(dateString).toLocaleString();
    }
  };

  const formatDuration = (seconds?: number) => {
    if (seconds === undefined) return "N/A";
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}h ${remainingMins}m`;
  };

  // Prepare data for chart
  const prepareChartData = () => {
    return [...records]
      .reverse()
      .map(r => ({
        timestamp: r.reading_timestamp,
        dateLabel: format(parseISO(r.reading_timestamp), "MMM d HH:mm"),
        spo2: r.data.oxygenSaturation || 0,
        hr: r.data.pulseRate || 0,
        pi: r.data.pi || 0
      }));
  };

  return (
    <div className="bg-[#080D1A] min-h-screen text-white p-4 pt-safe-top font-inter select-none">
      <div className="max-w-md mx-auto space-y-5 pb-10">
        
        {/* Header */}
        <header className="flex items-center gap-3 mb-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95 text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
              <Wind className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">O2 Ring Records</h1>
              <p className="text-xs text-gray-400">Wellue Oximeter History</p>
            </div>
          </div>
          <button 
            onClick={fetchRecords} 
            disabled={loading}
            className="ml-auto p-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </header>

        {/* View Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'bg-[#1A243D]/60 text-gray-400 border border-slate-700/30 hover:bg-[#1A243D]/80'
            }`}
          >
            <List className="w-4 h-4" />
            List View
          </button>
          <button
            onClick={() => setViewMode('trend')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 ${
              viewMode === 'trend'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'bg-[#1A243D]/60 text-gray-400 border border-slate-700/30 hover:bg-[#1A243D]/80'
            }`}
          >
            <LineChartIcon className="w-4 h-4" />
            Trend Charts
          </button>
        </div>

        {/* Loader & Empty states */}
        {loading && records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Activity className="w-12 h-12 text-blue-500 animate-pulse" />
            <p className="text-gray-400 text-sm font-semibold">Loading oximeter history...</p>
          </div>
        ) : error ? (
          <div className="bg-red-950/20 border border-red-500/30 rounded-3xl p-6 text-center space-y-3">
            <ShieldAlert className="w-12 h-12 text-red-400 mx-auto" />
            <p className="text-red-300 text-sm">{error}</p>
            <Button onClick={fetchRecords} className="bg-red-500 hover:bg-red-600 text-white">
              Try Again
            </Button>
          </div>
        ) : records.length === 0 ? (
          <div className="bg-[#1A243D]/40 border border-slate-800 rounded-3xl p-10 text-center space-y-4">
            <div className="bg-blue-500/10 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto border border-blue-500/20">
              <Wind className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white">No oximeter data</h3>
              <p className="text-gray-400 text-xs mt-1.5 leading-relaxed">
                When you save oxygen levels or pulse rate sessions from your O2 Ring, they will be listed here.
              </p>
            </div>
            <Button onClick={() => navigate('/o2ring-monitor')} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
              Go to O2 Ring Monitor
            </Button>
          </div>
        ) : viewMode === 'list' ? (
          
          /* LIST VIEW */
          <div className="space-y-3">
            {records.map((r) => {
              const { oxygenSaturation, pulseRate, pi, minSpo2, maxHr, durationSeconds, deviceName } = r.data;
              return (
                <div
                  key={r.id}
                  className="bg-[#1A243D]/50 border border-slate-800 rounded-3xl p-4 space-y-4 hover:border-blue-500/20 transition-all duration-300 shadow-xl"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-extrabold py-0.5 px-2">
                          SpO₂ OK
                        </Badge>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Smartphone size={10} />
                          {deviceName || "O2 Ring"}
                        </span>
                      </div>
                      <div className="text-sm font-extrabold text-white mt-1">
                        {formatTimestamp(r.reading_timestamp)}
                      </div>
                    </div>
                    {durationSeconds !== undefined && (
                      <div className="flex items-center gap-1 text-[11px] font-extrabold text-slate-400 bg-slate-800/40 px-2.5 py-1 rounded-xl">
                        <Timer className="w-3.5 h-3.5 text-blue-400" />
                        <span>{formatDuration(durationSeconds)}</span>
                      </div>
                    )}
                  </div>

                  {/* Primary Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2.5">
                    {/* SpO2 Card */}
                    <div className="bg-[#080D1A]/50 border border-slate-800/40 p-3 rounded-2xl text-center flex flex-col justify-between">
                      <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Avg SpO₂</span>
                      <span className="text-lg font-black text-blue-400 my-0.5">{oxygenSaturation}%</span>
                      {minSpo2 !== undefined ? (
                        <span className="text-[9px] text-slate-500 font-medium">Min: {minSpo2}%</span>
                      ) : (
                        <span className="text-[9px] text-slate-500 font-medium">-</span>
                      )}
                    </div>

                    {/* HR Card */}
                    <div className="bg-[#080D1A]/50 border border-slate-800/40 p-3 rounded-2xl text-center flex flex-col justify-between">
                      <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Avg Pulse</span>
                      <span className="text-lg font-black text-rose-500 my-0.5">{pulseRate} <span className="text-[10px] font-normal">bpm</span></span>
                      {maxHr !== undefined ? (
                        <span className="text-[9px] text-slate-500 font-medium">Max: {maxHr}</span>
                      ) : (
                        <span className="text-[9px] text-slate-500 font-medium">-</span>
                      )}
                    </div>

                    {/* PI Card */}
                    <div className="bg-[#080D1A]/50 border border-slate-800/40 p-3 rounded-2xl text-center flex flex-col justify-between">
                      <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Avg PI %</span>
                      <span className="text-lg font-black text-emerald-400 my-0.5">{pi || 0}%</span>
                      <span className="text-[9px] text-slate-500 font-medium">Perfusion</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          
          /* TREND CHARTS VIEW */
          <div className="space-y-4">
            
            {/* SpO2 Trend */}
            <div className="bg-[#1A243D]/50 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-blue-400 uppercase tracking-wide">Oxygen Saturation (%)</h3>
                <p className="text-[10px] text-slate-400">Target limit &gt; 95%</p>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={prepareChartData()} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="dateLabel" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                    <YAxis domain={[80, 100]} tick={{ fill: '#94a3b8', fontSize: 9 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }} />
                    <ReferenceLine y={95} stroke="#38bdf8" strokeDasharray="3 3" label={{ value: '95% Limit', fill: '#7dd3fc', fontSize: 8, position: 'insideBottomLeft' }} />
                    <Line type="monotone" dataKey="spo2" name="SpO2" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pulse Rate Trend */}
            <div className="bg-[#1A243D]/50 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-rose-500 uppercase tracking-wide">Pulse Rate (BPM)</h3>
                <p className="text-[10px] text-slate-400">Normal Range: 60 - 100 bpm</p>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={prepareChartData()} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="dateLabel" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fill: '#94a3b8', fontSize: 9 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }} />
                    <ReferenceLine y={60} stroke="#f472b6" strokeDasharray="3 3" />
                    <ReferenceLine y={100} stroke="#f472b6" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="hr" name="Heart Rate" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
};

export default O2RingRecords;
