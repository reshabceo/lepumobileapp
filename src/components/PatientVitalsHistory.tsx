import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Heart, Activity, Droplets, Thermometer, Wind, ArrowLeft, Calendar, Clock, List, LineChart as LineChartIcon, BarChart3 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

interface VitalReading {
  id: string;
  measurement_type: string;
  device_type: string;
  data: any;
  reading_timestamp: string;
  source: string;
}

export const PatientVitalsHistory = () => {
  const navigate = useNavigate();
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'trend'>('list');

  useEffect(() => {
    fetchVitals();
  }, []);

  const fetchVitals = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Please login to view vitals');
        setLoading(false);
        return;
      }

      // Get patient ID
      const { data: patientData } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!patientData) {
        toast.error('Patient profile not found');
        setLoading(false);
        return;
      }

      // Fetch all vitals
      const { data, error } = await supabase
        .from('vital_signs')
        .select('*')
        .eq('patient_id', patientData.id)
        .order('reading_timestamp', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching vitals:', error);
        toast.error('Failed to load vitals');
        return;
      }

      setVitals(data || []);
    } catch (err) {
      console.error('Error:', err);
      toast.error('Failed to load vitals');
    } finally {
      setLoading(false);
    }
  };

  const getVitalIcon = (type: string) => {
    switch (type) {
      case 'blood_pressure':
        return <Heart className="w-5 h-5 text-red-400" />;
      case 'heart_rate':
        return <Activity className="w-5 h-5 text-pink-400" />;
      case 'spo2':
        return <Wind className="w-5 h-5 text-blue-400" />;
      case 'temperature':
        return <Thermometer className="w-5 h-5 text-orange-400" />;
      case 'blood_glucose':
        return <Droplets className="w-5 h-5 text-purple-400" />;
      default:
        return <Activity className="w-5 h-5 text-emerald-400" />;
    }
  };

  const formatVitalValue = (vital: VitalReading) => {
    const { measurement_type, data } = vital;

    switch (measurement_type) {
      case 'blood_pressure':
        return `${data.systolic}/${data.diastolic} mmHg ${data.pulseRate ? `• ${Math.round(data.pulseRate)} bpm` : ''}`;
      case 'heart_rate':
        return `${Math.round(data.pulseRate || data.heartRate)} bpm`;
      case 'spo2':
        return `${Math.round(data.oxygenSaturation || data.spo2)}% ${data.pulseRate ? `• ${Math.round(data.pulseRate)} bpm` : ''}`;
      case 'temperature':
        return `${data.temperature}°${data.unit === 'fahrenheit' ? 'F' : 'C'}`;
      case 'blood_glucose':
        return `${data.glucose} ${data.unit || 'mg/dL'}`;
      default:
        return 'N/A';
    }
  };

  const formatMeasurementType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const filteredVitals = filter === 'all' 
    ? vitals 
    : vitals.filter(v => v.measurement_type === filter);

  const measurementTypes = ['all', ...Array.from(new Set(vitals.map(v => v.measurement_type)))];

  const extractNumericSeries = (type: string) => {
    const rows = vitals.filter((v) => v.measurement_type === type);
    const out: { t: string; v: number; v2?: number; label: string }[] = [];
    for (const vital of rows) {
      const ts = vital.reading_timestamp;
      const d = vital.data || {};
      if (type === 'blood_pressure' && d.systolic != null && d.diastolic != null) {
        out.push({
          t: ts,
          v: Number(d.systolic),
          v2: Number(d.diastolic),
          label: `${d.systolic}/${d.diastolic}`,
        });
      } else if (type === 'heart_rate') {
        const hr = d.pulseRate ?? d.heartRate;
        if (hr != null) out.push({ t: ts, v: Number(hr), label: String(hr) });
      } else if (type === 'spo2') {
        const o = d.oxygenSaturation ?? d.spo2;
        if (o != null) out.push({ t: ts, v: Number(o), label: String(o) });
      } else if (type === 'temperature' && d.temperature != null) {
        out.push({ t: ts, v: Number(d.temperature), label: String(d.temperature) });
      } else if (type === 'blood_glucose' && d.glucose != null) {
        out.push({ t: ts, v: Number(d.glucose), label: String(d.glucose) });
      }
    }
    return out.sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());
  };

  const normalRangeFor = (type: string): { lo?: number; hi?: number } => {
    switch (type) {
      case 'heart_rate':
        return { lo: 60, hi: 100 };
      case 'spo2':
        return { lo: 95, hi: undefined };
      case 'blood_pressure':
        return { lo: 90, hi: 140 };
      case 'temperature':
        return { lo: 36.1, hi: 37.2 };
      default:
        return {};
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080D1A] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080D1A] text-white font-inter select-none p-4 pt-safe-top">
      <div className="max-w-2xl mx-auto pb-20">
        {/* Standardized Header */}
        <header className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95 text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-900/70 flex items-center justify-center border border-blue-400/50">
              <BarChart3 className="h-6 w-6 text-blue-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Vitals History</h1>
              <p className="text-xs text-gray-400">Your recorded vital signs and measurements</p>
            </div>
          </div>
        </header>

        {/* View Selection & Filters */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 active:scale-95 ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10'
                  : 'bg-[#1A243D] text-gray-300 border border-slate-700/40 hover:bg-[#1A243D]/80'
              }`}
            >
              <List className="w-4 h-4" />
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('trend')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 active:scale-95 ${
                viewMode === 'trend'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10'
                  : 'bg-[#1A243D] text-gray-300 border border-slate-700/40 hover:bg-[#1A243D]/80'
              }`}
            >
              <LineChartIcon className="w-4 h-4" />
              Trend
            </button>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {measurementTypes.map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 whitespace-nowrap active:scale-95 ${
                  filter === type
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg'
                    : 'bg-[#1A243D] text-gray-300 border border-slate-700/40 hover:bg-[#1A243D]/80'
                }`}
              >
                {type === 'all' ? 'All' : formatMeasurementType(type)}
              </button>
            ))}
          </div>
        </div>

        {/* Trend View */}
        {viewMode === 'trend' && filter !== 'all' && (() => {
          const series = extractNumericSeries(filter);
          const { lo, hi } = normalRangeFor(filter);
          if (series.length === 0) {
            return (
              <div className="bg-[#1A243D] p-8 rounded-3xl border border-slate-700/40 text-center text-gray-400">
                No numeric points for this vital type yet.
              </div>
            );
          }
          const chartData = series.map((r) => ({
            ...r,
            timeLabel: format(parseISO(r.t), 'MMM d HH:mm'),
          }));
          return (
            <div className="bg-[#1A243D] p-5 rounded-3xl border border-slate-700/40 shadow-sm mb-6" style={{ height: 320 }}>
              <h2 className="text-white font-semibold mb-4 text-base">{formatMeasurementType(filter)}</h2>
              <ResponsiveContainer width="100%" height="90%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="timeLabel" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend />
                  {lo != null && <ReferenceLine y={lo} stroke="#38bdf8" strokeDasharray="4 4" label={{ value: 'Low ref', fill: '#7dd3fc', fontSize: 10 }} />}
                  {hi != null && <ReferenceLine y={hi} stroke="#f472b6" strokeDasharray="4 4" label={{ value: 'High ref', fill: '#f9a8d4', fontSize: 10 }} />}
                  <Line type="monotone" dataKey="v" name={filter === 'blood_pressure' ? 'Systolic' : 'Value'} stroke="#3b82f6" dot={false} strokeWidth={2.5} />
                  {filter === 'blood_pressure' && (
                    <Line type="monotone" dataKey="v2" name="Diastolic" stroke="#8b5cf6" dot={false} strokeWidth={2.5} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })()}

        {viewMode === 'trend' && filter === 'all' && (
          <div className="bg-[#1A243D] p-6 rounded-3xl border border-blue-500/30 text-blue-200 mb-6 text-sm">
            Select a vital type above to view its trend chart.
          </div>
        )}

        {/* Vitals List */}
        {viewMode === 'list' && filteredVitals.length === 0 ? (
          <div className="bg-[#1A243D] p-8 rounded-3xl border border-slate-700/40 shadow-sm text-center">
            <Activity className="w-16 h-16 text-blue-500/50 mx-auto mb-4 animate-pulse" />
            <p className="text-white font-semibold text-lg">No vital signs recorded yet</p>
            <p className="text-gray-400 text-sm mt-2">Start submitting your vitals to track your health</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-3">
            {filteredVitals.map((vital) => (
              <div
                key={vital.id}
                className="bg-[#1A243D] p-4 rounded-3xl border border-slate-700/40 hover:border-blue-500/30 transition-all duration-300 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 rounded-2xl bg-blue-950/70 border border-blue-500/30 text-blue-400 flex-shrink-0">
                      {getVitalIcon(vital.measurement_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-bold text-base mb-0.5">
                        {formatMeasurementType(vital.measurement_type)}
                      </h3>
                      <p className="text-blue-400 text-lg font-bold mb-2">
                        {formatVitalValue(vital)}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{format(parseISO(vital.reading_timestamp), 'MMM dd, yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{format(parseISO(vital.reading_timestamp), 'h:mm a')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};







