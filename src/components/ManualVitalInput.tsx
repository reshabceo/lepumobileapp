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
  CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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

    // Validate ranges
    if (bloodPressureSystolic && (parseInt(bloodPressureSystolic) < 70 || parseInt(bloodPressureSystolic) > 250)) {
      toast({
        title: 'Invalid Blood Pressure',
        description: 'Systolic should be between 70-250 mmHg',
        variant: 'destructive'
      });
      return false;
    }

    if (heartRate && (parseInt(heartRate) < 30 || parseInt(heartRate) > 250)) {
      toast({
        title: 'Invalid Heart Rate',
        description: 'Heart rate should be between 30-250 bpm',
        variant: 'destructive'
      });
      return false;
    }

    if (spo2 && (parseInt(spo2) < 70 || parseInt(spo2) > 100)) {
      toast({
        title: 'Invalid SpO2',
        description: 'SpO2 should be between 70-100%',
        variant: 'destructive'
      });
      return false;
    }

    if (temperature && (parseFloat(temperature) < 35 || parseFloat(temperature) > 43)) {
      toast({
        title: 'Invalid Temperature',
        description: 'Temperature should be between 35-43°C',
        variant: 'destructive'
      });
      return false;
    }

    if (bloodSugar && (parseInt(bloodSugar) < 20 || parseInt(bloodSugar) > 600)) {
      toast({
        title: 'Invalid Blood Sugar',
        description: 'Blood sugar should be between 20-600 mg/dL',
        variant: 'destructive'
      });
      return false;
    }

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

      const timestamp = new Date().toISOString();
      const vitalsToInsert: any[] = [];

      // Blood Pressure - Match device format
      if (vitals.bloodPressureSystolic && vitals.bloodPressureDiastolic) {
        vitalsToInsert.push({
          patient_id: user.id,
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
          patient_id: user.id,
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
          patient_id: user.id,
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
          patient_id: user.id,
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
          patient_id: user.id,
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

    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'Failed to save vitals',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-green-900 to-emerald-950 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Manual Vital Input</h1>
          <p className="text-emerald-200/80">Enter your health readings manually - Basic Plan</p>
        </div>

        {/* Info Card */}
        <Card className="bg-blue-500/10 border-blue-500/30 mb-6">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-200">
                <p className="font-medium mb-1">Real-Time Monitoring</p>
                <p className="text-blue-200/80">
                  Your doctor will see these readings instantly. Fill in the vitals you measured at home.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Input Form */}
        <form onSubmit={handleSubmit}>
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Enter Your Vitals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
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
                      className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                    />
                    <p className="text-xs text-emerald-200/60 mt-1">Upper (70-250)</p>
                  </div>
                  <div>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="Diastolic (80)"
                      value={vitals.bloodPressureDiastolic}
                      onChange={(e) => handleInputChange('bloodPressureDiastolic', e.target.value)}
                      className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                    />
                    <p className="text-xs text-emerald-200/60 mt-1">Lower (40-150)</p>
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
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                />
                <p className="text-xs text-emerald-200/60">Normal: 60-100 bpm</p>
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
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                />
                <p className="text-xs text-emerald-200/60">Normal: 95-100%</p>
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
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                />
                <p className="text-xs text-emerald-200/60">Normal: 36.5-37.5°C</p>
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
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                />
                <p className="text-xs text-emerald-200/60">Fasting: 70-100 mg/dL | After meal: &lt;140 mg/dL</p>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold py-6 text-lg"
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
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <p className="text-xs text-emerald-200/90 leading-relaxed">
                  📱 <strong>Basic Plan:</strong> Manually enter your vitals measured at home. 
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

