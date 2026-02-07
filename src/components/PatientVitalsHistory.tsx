import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Heart, Activity, Droplets, Thermometer, Wind, ArrowLeft, Calendar, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';

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

  useEffect(() => {
    fetchVitals();
  }, []);

  const fetchVitals = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Please login to view vitals');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700">
        <div className="relative flex items-center justify-between p-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-3 py-2 text-white bg-blue-600 hover:bg-blue-700 transition-colors touch-manipulation rounded-lg"
            style={{ minHeight: '40px', minWidth: '70px' }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back</span>
          </button>
          <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl font-semibold text-white">Vitals History</h1>
          <div className="w-16" />
        </div>
      </div>

      <div className="p-4 pb-20">
        <div className="max-w-4xl mx-auto">
          {/* Info */}
          <div className="mb-6">
            <p className="text-emerald-200/80">Your recorded vital signs and measurements</p>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {measurementTypes.map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 whitespace-nowrap ${
                  filter === type
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg'
                    : 'bg-white/10 text-emerald-200 hover:bg-white/20'
                }`}
              >
                {type === 'all' ? 'All' : formatMeasurementType(type)}
              </button>
            ))}
          </div>

          {/* Vitals List */}
          {filteredVitals.length === 0 ? (
            <div className="glass-card p-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center">
              <Activity className="w-16 h-16 text-emerald-400/50 mx-auto mb-4" />
              <p className="text-emerald-200/60 text-lg">No vital signs recorded yet</p>
              <p className="text-emerald-200/40 text-sm mt-2">Start submitting your vitals to track your health</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredVitals.map((vital) => (
                <div
                  key={vital.id}
                  className="glass-card p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:border-emerald-400/50 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                        {getVitalIcon(vital.measurement_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-lg mb-1">
                          {formatMeasurementType(vital.measurement_type)}
                        </h3>
                        <p className="text-emerald-100 text-lg font-medium mb-2">
                          {formatVitalValue(vital)}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-emerald-200/70">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{format(parseISO(vital.reading_timestamp), 'MMM dd, yyyy')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{format(parseISO(vital.reading_timestamp), 'h:mm a')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};







