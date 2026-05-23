import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Heart, Droplets, Thermometer, Wind, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface VitalRangeRule {
  moderateMin: number;
  moderateMax: number;
  highMin: number;
  highMax: number;
}

interface VitalRiskCriteria {
  heartRate?: VitalRangeRule;
  oxygenSaturation?: VitalRangeRule;
  temperature?: VitalRangeRule;
  bloodSugar?: VitalRangeRule;
  bloodPressure?: {
    systolic?: VitalRangeRule;
    diastolic?: VitalRangeRule;
  };
}

interface ThresholdRow {
  vital: string;
  icon: React.ReactNode;
  normalRange: string;
  warningRange: string;
  unit: string;
  color: string;
}

export const MyThresholds = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [criteria, setCriteria] = useState<VitalRiskCriteria | null>(null);
  const [loading, setLoading] = useState(true);
  const [patientId, setPatientId] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchThresholds();
  }, [user]);

  const fetchThresholds = async () => {
    setLoading(true);
    try {
      // Resolve patient id
      const { data: profile } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user!.id)
        .maybeSingle();

      if (!profile) { setLoading(false); return; }
      setPatientId(profile.id);

      const { data } = await supabase
        .from('patient_vital_risk_criteria')
        .select('criteria')
        .eq('patient_id', profile.id)
        .maybeSingle();

      setCriteria((data?.criteria as VitalRiskCriteria) ?? null);
    } catch (e) {
      console.error('Error loading thresholds:', e);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (v?: number) => (v !== undefined ? String(v) : '—');

  const rows: ThresholdRow[] = criteria
    ? [
        {
          vital: 'Heart Rate',
          icon: <Heart className="w-5 h-5 text-pink-400" />,
          normalRange: `${fmt(criteria.heartRate?.moderateMin)}–${fmt(criteria.heartRate?.moderateMax)}`,
          warningRange: `< ${fmt(criteria.heartRate?.highMin)} or > ${fmt(criteria.heartRate?.highMax)}`,
          unit: 'bpm',
          color: 'border-pink-500/30 bg-pink-500/5',
        },
        {
          vital: 'Blood Oxygen (SpO₂)',
          icon: <Wind className="w-5 h-5 text-blue-400" />,
          normalRange: `${fmt(criteria.oxygenSaturation?.moderateMin)}–${fmt(criteria.oxygenSaturation?.moderateMax)}`,
          warningRange: `< ${fmt(criteria.oxygenSaturation?.highMin)}`,
          unit: '%',
          color: 'border-blue-500/30 bg-blue-500/5',
        },
        {
          vital: 'Blood Pressure (Systolic)',
          icon: <Activity className="w-5 h-5 text-red-400" />,
          normalRange: `${fmt(criteria.bloodPressure?.systolic?.moderateMin)}–${fmt(criteria.bloodPressure?.systolic?.moderateMax)}`,
          warningRange: `> ${fmt(criteria.bloodPressure?.systolic?.highMax)}`,
          unit: 'mmHg',
          color: 'border-red-500/30 bg-red-500/5',
        },
        {
          vital: 'Blood Pressure (Diastolic)',
          icon: <Activity className="w-5 h-5 text-orange-400" />,
          normalRange: `${fmt(criteria.bloodPressure?.diastolic?.moderateMin)}–${fmt(criteria.bloodPressure?.diastolic?.moderateMax)}`,
          warningRange: `> ${fmt(criteria.bloodPressure?.diastolic?.highMax)}`,
          unit: 'mmHg',
          color: 'border-orange-500/30 bg-orange-500/5',
        },
        {
          vital: 'Blood Sugar',
          icon: <Droplets className="w-5 h-5 text-purple-400" />,
          normalRange: `${fmt(criteria.bloodSugar?.moderateMin)}–${fmt(criteria.bloodSugar?.moderateMax)}`,
          warningRange: `< ${fmt(criteria.bloodSugar?.highMin)} or > ${fmt(criteria.bloodSugar?.highMax)}`,
          unit: 'mg/dL',
          color: 'border-purple-500/30 bg-purple-500/5',
        },
        {
          vital: 'Temperature',
          icon: <Thermometer className="w-5 h-5 text-yellow-400" />,
          normalRange: `${fmt(criteria.temperature?.moderateMin)}–${fmt(criteria.temperature?.moderateMax)}`,
          warningRange: `< ${fmt(criteria.temperature?.highMin)} or > ${fmt(criteria.temperature?.highMax)}`,
          unit: '°F',
          color: 'border-yellow-500/30 bg-yellow-500/5',
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-background p-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">My Vital Thresholds</h1>
          <p className="text-sm text-gray-400">Set by your doctor</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !criteria ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-gray-500" />
          <div>
            <p className="text-white font-medium">No thresholds configured</p>
            <p className="text-sm text-gray-400 mt-1">
              Your doctor hasn't set custom thresholds yet. Default clinical ranges are being used for alerts.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm text-blue-300">
              These are the personalised ranges your doctor has configured for you. Readings outside these ranges will trigger alerts.
            </p>
          </div>

          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.vital}
                className={`rounded-xl border p-4 ${row.color}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  {row.icon}
                  <span className="font-semibold text-white">{row.vital}</span>
                  <span className="ml-auto text-xs text-gray-400">{row.unit}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5">
                    <p className="text-xs text-emerald-400 font-medium mb-1">Normal range</p>
                    <p className="text-sm text-white font-mono">{row.normalRange}</p>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                    <p className="text-xs text-red-400 font-medium mb-1">Alert if</p>
                    <p className="text-sm text-white font-mono">{row.warningRange}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-xs text-gray-500 text-center">
            Contact your doctor to update these ranges.
          </p>
        </>
      )}
    </div>
  );
};

export default MyThresholds;
