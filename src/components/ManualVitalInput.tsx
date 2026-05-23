import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Heart, 
  Droplets, 
  Thermometer, 
  Wind, 
  Activity,
  Save,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Edit3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface VitalInput {
  bloodPressureSystolic: string;
  bloodPressureDiastolic: string;
  heartRate: string;
  spo2: string;
  temperature: string;
  bloodSugar: string;
}

export const ManualVitalInput = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [vitals, setVitals] = useState<VitalInput>({
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    heartRate: '',
    spo2: '',
    temperature: '',
    bloodSugar: ''
  });

  const handleInputChange = (field: keyof VitalInput, value: string) => {
    // Only allow numbers and decimal points
    if (value && !/^\d*\.?\d*$/.test(value)) return;
    
    setVitals(prev => ({ ...prev, [field]: value }));
  };

  const validateInputs = (): boolean => {
    const { bloodPressureSystolic, bloodPressureDiastolic, heartRate, spo2, temperature, bloodSugar } = vitals;

    // At least one vital should be filled
    if (!bloodPressureSystolic && !bloodPressureDiastolic && !heartRate && !spo2 && !temperature && !bloodSugar) {
      toast({
        title: 'No Data Entered',
        description: 'Please enter at least one vital sign',
        variant: 'destructive'
      });
      return false;
    }

    // Validate BP if entered
    if ((bloodPressureSystolic && !bloodPressureDiastolic) || (!bloodPressureSystolic && bloodPressureDiastolic)) {
      toast({
        title: 'Incomplete Blood Pressure',
        description: 'Please enter both systolic and diastolic values',
        variant: 'destructive'
      });
      return false;
    }

    // Range validation removed per user request
    // Only non-negative numbers are allowed (handled by handleInputChange)

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateInputs()) return;

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: 'Error',
          description: 'Please login to submit vitals',
          variant: 'destructive'
        });
        return;
      }

      // Get the patient ID from the patients table using auth user ID
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (patientError || !patientData) {
        console.error('Error fetching patient:', patientError);
        toast({
          title: 'Error',
          description: 'Could not find patient profile. Please contact support.',
          variant: 'destructive'
        });
        return;
      }

      const patientId = patientData.id;
      const timestamp = new Date().toISOString();
      const vitalsToInsert: any[] = [];

      // Blood Pressure - Match device format
      if (vitals.bloodPressureSystolic && vitals.bloodPressureDiastolic) {
        vitalsToInsert.push({
          patient_id: patientId,
          measurement_type: 'blood_pressure',
          device_type: 'BP',
          data: {
            status: 'completed',
            systolic: parseFloat(vitals.bloodPressureSystolic),
            diastolic: parseFloat(vitals.bloodPressureDiastolic),
            pulseRate: vitals.heartRate ? parseFloat(vitals.heartRate) : null,
            deviceName: 'Manual Entry',
            source: 'manual'
          },
          reading_timestamp: timestamp,
          source: 'manual',
          is_emergency: false
        });
      }

      // Heart Rate (only if not included in BP)
      if (vitals.heartRate && !(vitals.bloodPressureSystolic && vitals.bloodPressureDiastolic)) {
        vitalsToInsert.push({
          patient_id: patientId,
          measurement_type: 'heart_rate',
          device_type: 'OXIMETER',
          data: {
            status: 'completed',
            pulseRate: parseFloat(vitals.heartRate),
            deviceName: 'Manual Entry',
            source: 'manual'
          },
          reading_timestamp: timestamp,
          source: 'manual',
          is_emergency: false
        });
      }

      // SpO2
      if (vitals.spo2) {
        vitalsToInsert.push({
          patient_id: patientId,
          measurement_type: 'spo2',
          device_type: 'OXIMETER',
          data: {
            status: 'completed',
            oxygenSaturation: parseFloat(vitals.spo2),
            pulseRate: vitals.heartRate ? parseFloat(vitals.heartRate) : null,
            deviceName: 'Manual Entry',
            source: 'manual'
          },
          reading_timestamp: timestamp,
          source: 'manual',
          is_emergency: false
        });
      }

      // Temperature
      if (vitals.temperature) {
        vitalsToInsert.push({
          patient_id: patientId,
          measurement_type: 'temperature',
          device_type: 'TEMPERATURE',
          data: {
            status: 'completed',
            temperature: parseFloat(vitals.temperature),
            unit: 'celsius',
            deviceName: 'Manual Entry',
            source: 'manual'
          },
          reading_timestamp: timestamp,
          source: 'manual',
          is_emergency: false
        });
      }

      // Blood Sugar
      if (vitals.bloodSugar) {
        vitalsToInsert.push({
          patient_id: patientId,
          measurement_type: 'blood_glucose',
          device_type: 'GLUCOSE',
          data: {
            status: 'completed',
            glucose: parseFloat(vitals.bloodSugar),
            unit: 'mg/dL',
            deviceName: 'Manual Entry',
            source: 'manual'
          },
          reading_timestamp: timestamp,
          source: 'manual',
          is_emergency: false
        });
      }

      // Insert all vitals
      const { error } = await supabase
        .from('vital_signs')
        .insert(vitalsToInsert);

      if (error) {
        console.error('Error saving vitals:', error);
        setSubmitting(false); // Stop loading on error
        toast({
          title: 'Error',
          description: 'Failed to save vitals. Please try again.',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Vitals Saved Successfully',
        description: `${vitalsToInsert.length} vital sign${vitalsToInsert.length !== 1 ? 's' : ''} recorded. Your doctor can see them now.`,
      });

      // Clear form
      setVitals({
        bloodPressureSystolic: '',
        bloodPressureDiastolic: '',
        heartRate: '',
        spo2: '',
        temperature: '',
        bloodSugar: ''
      });

      setSubmitting(false); // Stop loading after success

    } catch (error) {
      console.error('Error:', error);
      setSubmitting(false); // Stop loading on catch
      toast({
        title: 'Error',
        description: 'Failed to save vitals',
        variant: 'destructive'
      });
    }
  };

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
            <div className="h-10 w-10 rounded-2xl bg-emerald-900/70 flex items-center justify-center border border-emerald-400/50">
              <Edit3 className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Manual Vital Input</h1>
              <p className="text-xs text-gray-400">Enter your health readings manually - Basic Plan</p>
            </div>
          </div>
        </header>

        {/* Info Card */}
        <Card className="bg-[#1A243D] border border-blue-500/30 mb-6 rounded-3xl">
          <CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-blue-900/50 border border-blue-500/30 text-blue-400 flex-shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="text-sm text-gray-200">
                <p className="font-semibold text-white mb-0.5">Real-Time Monitoring</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Your doctor will see these readings instantly. Fill in the vitals you measured at home.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Input Form */}
        <form onSubmit={handleSubmit}>
          <Card className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-800/60 pb-4">
              <CardTitle className="text-lg font-semibold text-white">Enter Your Vitals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Blood Pressure */}
              <div className="space-y-2">
                <Label className="text-white flex items-center gap-2">
                  <Heart className="h-4 w-4 text-red-400" />
                  Blood Pressure (mmHg)
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="Systolic (120)"
                      value={vitals.bloodPressureSystolic}
                      onChange={(e) => handleInputChange('bloodPressureSystolic', e.target.value)}
                      className="bg-[#121B32] border border-slate-700/40 text-white placeholder-gray-500 rounded-xl py-5 px-4 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">Upper</p>
                  </div>
                  <div>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="Diastolic (80)"
                      value={vitals.bloodPressureDiastolic}
                      onChange={(e) => handleInputChange('bloodPressureDiastolic', e.target.value)}
                      className="bg-[#121B32] border border-slate-700/40 text-white placeholder-gray-500 rounded-xl py-5 px-4 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">Lower</p>
                  </div>
                </div>
              </div>

              {/* Heart Rate */}
              <div className="space-y-2">
                <Label className="text-white flex items-center gap-2">
                  <Activity className="h-4 w-4 text-pink-400" />
                  Heart Rate (bpm)
                </Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g., 72"
                  value={vitals.heartRate}
                  onChange={(e) => handleInputChange('heartRate', e.target.value)}
                  className="bg-[#121B32] border border-slate-700/40 text-white placeholder-gray-500 rounded-xl py-5 px-4 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all text-sm"
                />
                <p className="text-xs text-gray-400">Heart rate in beats per minute</p>
              </div>

              {/* SpO2 */}
              <div className="space-y-2">
                <Label className="text-white flex items-center gap-2">
                  <Wind className="h-4 w-4 text-blue-400" />
                  Oxygen Level - SpO2 (%)
                </Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g., 98"
                  value={vitals.spo2}
                  onChange={(e) => handleInputChange('spo2', e.target.value)}
                  className="bg-[#121B32] border border-slate-700/40 text-white placeholder-gray-500 rounded-xl py-5 px-4 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all text-sm"
                />
                <p className="text-xs text-gray-400">Oxygen saturation percentage</p>
              </div>

              {/* Temperature */}
              <div className="space-y-2">
                <Label className="text-white flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-orange-400" />
                  Body Temperature (°C)
                </Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g., 37.0"
                  value={vitals.temperature}
                  onChange={(e) => handleInputChange('temperature', e.target.value)}
                  className="bg-[#121B32] border border-slate-700/40 text-white placeholder-gray-500 rounded-xl py-5 px-4 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all text-sm"
                />
                <p className="text-xs text-gray-400">Body temperature in Celsius</p>
              </div>

              {/* Blood Sugar */}
              <div className="space-y-2">
                <Label className="text-white flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-purple-400" />
                  Blood Sugar (mg/dL)
                </Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g., 100"
                  value={vitals.bloodSugar}
                  onChange={(e) => handleInputChange('bloodSugar', e.target.value)}
                  className="bg-[#121B32] border border-slate-700/40 text-white placeholder-gray-500 rounded-xl py-5 px-4 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all text-sm"
                />
                <p className="text-xs text-gray-400">Blood glucose level</p>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all text-white font-semibold py-6 text-lg rounded-2xl"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5 mr-2" />
                    Submit Vitals
                  </>
                )}
              </Button>

              {/* Info Text */}
              <div className="bg-[#121B32] border border-slate-700/40 rounded-xl p-4">
                <p className="text-xs text-gray-400 leading-relaxed">
                  📱 <strong className="text-white">Basic Plan:</strong> Manually enter your vitals measured at home. 
                  Your doctor will see these readings instantly in real-time, just like device readings. 
                  All fields are optional - enter what you have measured.
                </p>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
};

