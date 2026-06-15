import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getPlatformCheckoutPriceDisplay, payAndFulfil, type PaymentType } from '@/lib/payment';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Calendar, Clock, AlertCircle, CheckCircle2, XCircle, Stethoscope, MapPin, Phone, ArrowLeft } from 'lucide-react';
import { format, addDays, isAfter, parseISO } from 'date-fns';
import { toast } from '@/components/ui/sonner';

interface AvailableSlot {
  start_time: string;
  end_time: string;
  availability_id: string;
}

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  reason: string | null;
}

interface AlternativeDoctor {
  doctor_id: string;
  doctor_name: string;
  specialty: string;
  years_experience: number;
  hospital: string;
  phone_number: string;
  is_available_now: boolean;
  next_available_time: string | null;
  video_consultation_fee: number | null;
  audio_consultation_fee: number | null;
  consultation_fee: number | null;
}

interface DoctorInfo {
  id: string;
  full_name: string;
  specialty: string;
  is_available: boolean;
  /** Consultation fee in rupees (from doctor). Used for video/audio pay amount. */
  consultation_fee: number | null;
  video_consultation_fee?: number | null;
  audio_consultation_fee?: number | null;
}

export const AppointmentBooking = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [reason, setReason] = useState<string>('');
  const [callMode, setCallMode] = useState<'audio' | 'video'>('video');
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [doctorInfo, setDoctorInfo] = useState<DoctorInfo | null>(null);
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [showMyAppointments, setShowMyAppointments] = useState(false);
  const [showAlternativeDoctors, setShowAlternativeDoctors] = useState(false);
  const [alternativeDoctors, setAlternativeDoctors] = useState<AlternativeDoctor[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientReports, setPatientReports] = useState<any[]>([]);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);

  useEffect(() => {
    loadDoctorId();
    loadMyAppointments();
    loadPatientReports();
  }, [user]);

  useEffect(() => {
    if (doctorId && selectedDate) {
      loadAvailableSlots();
    }
  }, [doctorId, selectedDate]);

  const loadDoctorId = async () => {
    try {
      const { data: patient, error } = await supabase
        .from('patients')
        .select('id, assigned_doctor_id, assigned_doctor:doctors!patients_assigned_doctor_id_fkey(id, full_name, specialty, consultation_fee, video_consultation_fee, audio_consultation_fee)')
        .eq('auth_user_id', user?.id)
        .single();

      if (error) throw error;
      setPatientId(patient?.id || null);
      setDoctorId(patient?.assigned_doctor_id || null);
      
      if (patient?.assigned_doctor) {
        const doctor = patient.assigned_doctor as any;
        setDoctorInfo({
          id: doctor.id,
          full_name: doctor.full_name,
          specialty: doctor.specialty,
          is_available: false,
          consultation_fee: doctor.consultation_fee ?? null,
          video_consultation_fee: doctor.video_consultation_fee ?? null,
          audio_consultation_fee: doctor.audio_consultation_fee ?? null,
        });
      }
    } catch (error: any) {
      console.error('Error loading doctor:', error);
      if (error.code !== 'PGRST116') { // Not found error
        toast.error('Failed to load doctor information');
      }
    }
  };

  const loadAvailableSlots = async () => {
    if (!doctorId) return;

    try {
      setLoadingSlots(true);
      const { data, error } = await supabase.rpc('get_available_slots', {
        p_doctor_id: doctorId,
        p_date: selectedDate
      });

      if (error) throw error;
      setAvailableSlots(data || []);
      
      // Update doctor availability status
      if (doctorInfo) {
        setDoctorInfo({
          ...doctorInfo,
          is_available: (data || []).length > 0
        });
      }
    } catch (error: any) {
      console.error('Error loading available slots:', error);
      toast.error('Failed to load available time slots');
      setAvailableSlots([]);
      if (doctorInfo) {
        setDoctorInfo({
          ...doctorInfo,
          is_available: false
        });
      }
    } finally {
      setLoadingSlots(false);
    }
  };

  const loadAlternativeDoctors = async () => {
    if (!patientId || !doctorInfo) return;

    try {
      setLoadingAlternatives(true);
      const { data: doctors, error } = await supabase.rpc('find_available_emergency_doctors', {
        p_patient_id: patientId,
        p_required_specialty: doctorInfo.specialty || null,
        p_limit: 5
      });

      if (error) throw error;

      // Fetch pricing for each doctor
      if (doctors && doctors.length > 0) {
        const doctorIds = doctors.map((d: any) => d.doctor_id);
        const { data: pricingData } = await supabase
          .from('doctors')
          .select('id, video_consultation_fee, audio_consultation_fee, consultation_fee')
          .in('id', doctorIds);

        const pricingMap = new Map(
          pricingData?.map(d => [
            d.id, 
            { 
              video_consultation_fee: d.video_consultation_fee,
              audio_consultation_fee: d.audio_consultation_fee,
              consultation_fee: d.consultation_fee 
            }
          ]) || []
        );

        const doctorsWithPricing = doctors.map((doc: any) => ({
          ...doc,
          video_consultation_fee: pricingMap.get(doc.doctor_id)?.video_consultation_fee,
          audio_consultation_fee: pricingMap.get(doc.doctor_id)?.audio_consultation_fee,
          consultation_fee: pricingMap.get(doc.doctor_id)?.consultation_fee
        }));

        setAlternativeDoctors(doctorsWithPricing);
      } else {
        setAlternativeDoctors([]);
      }
      
      setShowAlternativeDoctors(true);
    } catch (error: any) {
      console.error('Error loading alternative doctors:', error);
      toast.error('Failed to load alternative doctors');
    } finally {
      setLoadingAlternatives(false);
    }
  };

  const handleBookWithAlternative = async (alternativeDoctorId: string) => {
    if (!reason.trim() || !user) {
      toast.error('Please provide a reason for the appointment');
      return;
    }

    try {
      setLoading(true);

      // Get patient ID
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (patientError) throw patientError;

      // Get alternative doctor pricing
      const { data: altDoctor, error: altDocError } = await supabase
        .from('doctors')
        .select('full_name, consultation_fee, video_consultation_fee, audio_consultation_fee')
        .eq('id', alternativeDoctorId)
        .single();

      if (altDocError || !altDoctor) {
        toast.error('Could not load doctor information');
        setLoading(false);
        return;
      }

      const videoFee = altDoctor.video_consultation_fee ?? altDoctor.consultation_fee;
      const audioFee = altDoctor.audio_consultation_fee ?? altDoctor.consultation_fee;
      const feeRupees = callMode === 'video' ? videoFee : audioFee;
      const amountPaise = feeRupees != null ? Math.round(Number(feeRupees) * 100) : 0;
      
      if (amountPaise < 100) {
        toast.error('This doctor has not set a consultation fee. Please try another doctor.');
        setLoading(false);
        return;
      }

      // Get next available slot for alternative doctor
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      
      const { data: slots, error: slotsError } = await supabase.rpc('get_available_slots', {
        p_doctor_id: alternativeDoctorId,
        p_date: today
      });

      if (slotsError) throw slotsError;

      let appointmentDate = selectedDate;
      let appointmentTime = '09:00:00';

      if (slots && slots.length > 0) {
        // Use first available slot today
        appointmentDate = today;
        appointmentTime = slots[0].start_time;
      } else {
        // Try tomorrow
        const tomorrow = format(addDays(now, 1), 'yyyy-MM-dd');
        const { data: tomorrowSlots } = await supabase.rpc('get_available_slots', {
          p_doctor_id: alternativeDoctorId,
          p_date: tomorrow
        });

        if (tomorrowSlots && tomorrowSlots.length > 0) {
          appointmentDate = tomorrow;
          appointmentTime = tomorrowSlots[0].start_time;
        }
      }

      const appointmentPayload = {
        doctor_id: alternativeDoctorId,
        patient_id: patient.id,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        duration_minutes: 30,
        status: 'scheduled',
        appointment_type: 'regular',
        call_mode: callMode,
        reason: `Original doctor unavailable. ${reason.trim()}`,
        patient_notes: `Booked with alternative doctor due to assigned doctor unavailability`,
        attached_report_ids: selectedReportIds
      };

      const paymentType = callMode === 'video' ? 'appointment_video' : 'appointment_audio';

      await payAndFulfil({
        type: paymentType,
        amount_paise: amountPaise,
        metadata: { appointment: appointmentPayload, amount_paise: amountPaise, doctor_name: altDoctor.full_name || null },
        onSuccess: () => {
          toast.success('Appointment booked with alternative doctor!', {
            description: `Your appointment is scheduled for ${format(parseISO(`${appointmentDate}T${appointmentTime}`), 'EEEE, MMMM d, yyyy at h:mm a')}`
          });
          setSelectedSlot(null);
          setReason('');
          setSelectedReportIds([]);
          setShowAlternativeDoctors(false);
          loadMyAppointments();
        },
        onError: (err) => toast.error(err.message || 'Payment or booking failed'),
      });
    } catch (error: any) {
      console.error('Error booking with alternative doctor:', error);
      toast.error(error.message || 'Failed to book appointment');
    } finally {
      setLoading(false);
    }
  };

  const loadMyAppointments = async () => {
    if (!user) return;

    try {
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (patientError) throw patientError;

      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', patient.id)
        .in('status', ['scheduled', 'rescheduled'])
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      if (appointmentsError) throw appointmentsError;
      setMyAppointments(appointments || []);
    } catch (error: any) {
      console.error('Error loading appointments:', error);
    }
  };

  const loadPatientReports = async () => {
    if (!user) return;

    try {
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (patientError) throw patientError;

      const { data: reports, error: reportsError } = await supabase
        .from('patient_reports')
        .select('id, title, report_type, created_at')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (reportsError) throw reportsError;
      setPatientReports(reports || []);
    } catch (error: any) {
      console.error('Error loading patient reports:', error);
    }
  };

  const handleBookAppointment = async () => {
    if (!selectedSlot || !reason.trim() || !doctorId || !user) {
      toast.error('Please select a time slot and provide a reason');
      return;
    }

    try {
      setLoading(true);

      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (patientError) throw patientError;

      const [startTime] = selectedSlot.split(' - ');

      const { data: conflictCheck, error: conflictError } = await supabase.rpc(
        'check_appointment_conflict',
        {
          p_doctor_id: doctorId,
          p_appointment_date: selectedDate,
          p_appointment_time: startTime,
          p_duration_minutes: 30,
          p_exclude_appointment_id: null
        }
      );

      if (conflictError) console.warn('Conflict check error:', conflictError);
      if (conflictCheck) {
        toast.error('This time slot is no longer available. Please select another time.');
        loadAvailableSlots();
        setLoading(false);
        return;
      }

      const appointmentPayload = {
        doctor_id: doctorId,
        patient_id: patient.id,
        appointment_date: selectedDate,
        appointment_time: startTime,
        duration_minutes: 30,
        status: 'scheduled',
        appointment_type: 'regular',
        call_mode: callMode,
        reason: reason.trim(),
        patient_notes: null,
        attached_report_ids: selectedReportIds
      };

      const videoFee = doctorInfo?.video_consultation_fee ?? doctorInfo?.consultation_fee;
      const audioFee = doctorInfo?.audio_consultation_fee ?? doctorInfo?.consultation_fee;
      const feeRupees = callMode === 'video' ? videoFee : audioFee;
      const amountPaise = feeRupees != null ? Math.round(Number(feeRupees) * 100) : 0;
      if (amountPaise < 100) {
        toast.error('Doctor has not set a consultation fee. Please contact your doctor.');
        setLoading(false);
        return;
      }

      const paymentType = callMode === 'video' ? 'appointment_video' : 'appointment_audio';

      await payAndFulfil({
        type: paymentType,
        amount_paise: amountPaise,
        metadata: { appointment: appointmentPayload, amount_paise: amountPaise, doctor_name: doctorInfo?.full_name || null },
        onSuccess: () => {
          toast.success('Appointment booked successfully!', {
            description: `Your appointment is scheduled for ${format(parseISO(`${selectedDate}T${startTime}`), 'EEEE, MMMM d, yyyy at h:mm a')}`
          });
          setSelectedSlot(null);
          setReason('');
          setSelectedReportIds([]);
          loadAvailableSlots();
          loadMyAppointments();
        },
        onError: (err) => toast.error(err.message || 'Payment or booking failed'),
      });
    } catch (error: any) {
      console.error('Error booking appointment:', error);
      toast.error(error.message || 'Failed to book appointment');
    } finally {
      setLoading(false);
    }
  };

  const getMinDate = () => {
    return format(addDays(new Date(), 1), 'yyyy-MM-dd');
  };

  const getMaxDate = () => {
    return format(addDays(new Date(), 90), 'yyyy-MM-dd');
  };

  const formatConsultFeeLabel = (
    feeRupees: number | null | undefined,
    mode: 'video' | 'audio' = callMode,
  ) => {
    if (feeRupees == null) return '—';
    const netPaise = Math.round(Number(feeRupees) * 100);
    const paymentType: PaymentType = mode === 'video' ? 'appointment_video' : 'appointment_audio';
    const display = getPlatformCheckoutPriceDisplay(paymentType, netPaise, false);
    return `₹${display.exactTotalRupees.toLocaleString('en-IN')}`;
  };

  if (!doctorId) {
    return (
      <div className="space-y-4 p-4 pt-safe-top w-full bg-[#080D1A] min-h-screen text-white">
        {/* Standard Header */}
        <header className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95 text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-orange-900/70 flex items-center justify-center border border-orange-400/50">
              <Calendar className="h-6 w-6 text-orange-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Book Appointment</h1>
              <p className="text-xs text-gray-400">Schedule an appointment with your doctor</p>
            </div>
          </div>
        </header>

        <Card className="bg-[#1A243D] border-slate-700/40 text-white shadow-xl rounded-3xl">
          <CardContent className="p-8">
            <div className="text-center text-slate-350">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50 text-orange-400" />
              <p className="text-white font-bold">No doctor assigned</p>
              <p className="text-sm mt-2 text-slate-400">Please contact support to get assigned to a doctor</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 pt-safe-top w-full bg-[#080D1A] min-h-screen text-white">
      {/* Standard Header */}
      <header className="space-y-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95 text-white flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-orange-900/70 flex items-center justify-center border border-orange-400/50 flex-shrink-0">
              <Calendar className="h-6 w-6 text-orange-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Book Appointment</h1>
              <p className="text-xs text-gray-400">Schedule an appointment with your doctor</p>
            </div>
          </div>
        </div>
        
        {/* My Appointments Button */}
        <div className="pl-12">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMyAppointments(!showMyAppointments)}
            className="border-orange-500/30 text-orange-300 hover:bg-orange-600/20 text-xs rounded-xl"
          >
            {showMyAppointments ? 'Hide' : 'Show'} Appointments
          </Button>
        </div>
      </header>

      <Card className="bg-[#1A243D] border-slate-700/40 text-white shadow-xl rounded-3xl w-full overflow-visible">
        <CardContent className="space-y-6 p-3 sm:p-6 overflow-x-hidden">
          {showMyAppointments && myAppointments.length > 0 && (
            <div className="border border-emerald-500/20 rounded-xl p-4 bg-gradient-to-br from-emerald-900/20 to-green-900/10">
              <h3 className="font-semibold mb-3 text-emerald-100">My Upcoming Appointments</h3>
              <div className="space-y-2">
                {myAppointments.map((appointment) => {
                  const appointmentDateTime = parseISO(`${appointment.appointment_date}T${appointment.appointment_time}`);
                  return (
                    <div key={appointment.id} className="flex items-center justify-between p-3 bg-emerald-950/40 rounded-lg border border-emerald-500/10 hover:border-emerald-400/20 transition-all">
                      <div>
                        <p className="font-medium text-emerald-100">
                          {format(appointmentDateTime, 'EEEE, MMMM d, yyyy')}
                        </p>
                        <p className="text-sm text-emerald-300/70">
                          {format(appointmentDateTime, 'h:mm a')}
                        </p>
                        {appointment.reason && (
                          <p className="text-xs text-emerald-300/60 mt-1 italic">
                            Reason: {appointment.reason}
                          </p>
                        )}
                      </div>
                      <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-500/30">Scheduled</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="appointmentDate" className="text-emerald-200">Select Date</Label>
            <Input
              id="appointmentDate"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedSlot(null);
              }}
              min={getMinDate()}
              max={getMaxDate()}
              className="bg-emerald-950/40 border-emerald-500/30 text-emerald-100 focus:border-emerald-400 w-full"
            />
            <p className="text-xs text-emerald-300/60">
              Select a date between tomorrow and 90 days from now
            </p>
          </div>

          {/* Call Mode Selection */}
          <div className="space-y-2">
            <Label className="text-emerald-200">Call Type (pay to confirm)</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCallMode('video')}
                className={`p-4 border rounded-xl transition-all ${
                  callMode === 'video'
                    ? 'border-emerald-500 bg-emerald-600/20 text-emerald-100'
                    : 'border-emerald-500/30 bg-emerald-950/40 text-emerald-200 hover:border-emerald-400/50 hover:bg-emerald-600/10'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="font-medium">Video Call</span>
                  <span className="text-xs opacity-70">
                    {doctorInfo?.video_consultation_fee != null || doctorInfo?.consultation_fee != null
                      ? `₹${doctorInfo?.video_consultation_fee ?? doctorInfo?.consultation_fee ?? '—'} • Audio + Video`
                      : 'Set by doctor • Audio + Video'}
                  </span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setCallMode('audio')}
                className={`p-4 border rounded-xl transition-all ${
                  callMode === 'audio'
                    ? 'border-emerald-500 bg-emerald-600/20 text-emerald-100'
                    : 'border-emerald-500/30 bg-emerald-950/40 text-emerald-200 hover:border-emerald-400/50 hover:bg-emerald-600/10'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="font-medium">Audio Call</span>
                  <span className="text-xs opacity-70">
                    {doctorInfo?.audio_consultation_fee != null || doctorInfo?.consultation_fee != null
                      ? `₹${doctorInfo?.audio_consultation_fee ?? doctorInfo?.consultation_fee ?? '—'} • Audio Only`
                      : 'Set by doctor • Audio Only'}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Doctor Availability Status */}
          {doctorInfo && (
            <div className={`border rounded-xl p-4 ${
              doctorInfo.is_available 
                ? 'bg-gradient-to-br from-emerald-900/30 to-green-900/20 border-emerald-500/30' 
                : 'bg-gradient-to-br from-orange-900/30 to-red-900/20 border-orange-500/30'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {doctorInfo.is_available ? (
                    <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center border border-emerald-500/30 flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-orange-600/20 flex items-center justify-center border border-orange-500/30 flex-shrink-0">
                      <XCircle className="w-5 h-5 text-orange-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-emerald-100 truncate">
                      Dr. {doctorInfo.full_name}
                    </p>
                    <p className="text-sm text-emerald-300/70 truncate">
                      {doctorInfo.specialty}
                    </p>
                  </div>
                </div>
                <Badge className={
                  `flex-shrink-0 ${
                    doctorInfo.is_available 
                      ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30' 
                      : 'bg-orange-600/20 text-orange-300 border-orange-500/30'
                  }`
                }>
                  {doctorInfo.is_available ? 'Available' : 'Not Available'}
                </Badge>
              </div>
              {!doctorInfo.is_available && (
                <div className="mt-3 pt-3 border-t border-emerald-500/20">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadAlternativeDoctors}
                    disabled={loadingAlternatives}
                    className="w-full border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/20"
                  >
                    {loadingAlternatives ? (
                      <>
                        <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mr-2" />
                        Finding alternatives...
                      </>
                    ) : (
                      <>
                        <Stethoscope className="w-4 h-4 mr-2" />
                        Find Alternative Doctors
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Alternative Doctors */}
          {showAlternativeDoctors && alternativeDoctors.length > 0 && (
            <div className="border border-blue-500/20 rounded-xl p-4 bg-gradient-to-br from-blue-900/20 to-indigo-900/10">
              <div className="flex items-center justify-between mb-4 gap-2">
                <h3 className="font-semibold text-blue-100 text-sm sm:text-base flex-1 min-w-0">Alternative Available Doctors</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAlternativeDoctors(false)}
                  className="text-blue-300 hover:bg-blue-600/20 flex-shrink-0"
                >
                  Hide
                </Button>
              </div>
              <div className="space-y-3">
                {alternativeDoctors.map((doctor) => (
                  <div
                    key={doctor.doctor_id}
                    className="border border-blue-500/10 rounded-lg p-3 bg-blue-950/40 hover:border-blue-400/20 transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="font-semibold text-blue-100 text-sm sm:text-base">{doctor.doctor_name}</h4>
                          {doctor.is_available_now && (
                            <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-500/30 text-xs whitespace-nowrap">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Available Now
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1 text-sm text-blue-300/70">
                          <div className="flex items-center gap-2">
                            <Stethoscope className="w-3 h-3 text-blue-400" />
                            <span>{doctor.specialty}</span>
                            {doctor.years_experience > 0 && (
                              <span>• {doctor.years_experience} years experience</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3 text-blue-400" />
                            <span>{doctor.hospital}</span>
                          </div>
                          {doctor.phone_number && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-3 h-3 text-blue-400" />
                              <span>{doctor.phone_number}</span>
                            </div>
                          )}
                          {!doctor.is_available_now && doctor.next_available_time && (
                            <div className="flex items-center gap-2 text-orange-400">
                              <Clock className="w-3 h-3" />
                              <span>Next available: {format(parseISO(`2000-01-01T${doctor.next_available_time}`), 'h:mm a')}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-xs text-emerald-300/90 font-semibold mt-2">
                            <span>Video: ₹{doctor.video_consultation_fee ?? doctor.consultation_fee ?? '—'}</span>
                            <span>•</span>
                            <span>Audio: ₹{doctor.audio_consultation_fee ?? doctor.consultation_fee ?? '—'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleBookWithAlternative(doctor.doctor_id)}
                      disabled={loading}
                      size="sm"
                      className={`w-full mt-2 ${
                        doctor.is_available_now
                          ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white'
                          : 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/20'
                      }`}
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Opening payment...
                        </>
                      ) : (() => {
                        const fee = callMode === 'video' 
                          ? (doctor.video_consultation_fee ?? doctor.consultation_fee)
                          : (doctor.audio_consultation_fee ?? doctor.consultation_fee);
                        return doctor.is_available_now
                          ? `Pay & Book Now ${fee != null ? `(${formatConsultFeeLabel(fee)})` : ''}`
                          : `Pay & Book Next Available ${fee != null ? `(${formatConsultFeeLabel(fee)})` : ''}`;
                      })()}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-emerald-200">Available Time Slots</Label>
            {loadingSlots ? (
              <div className="flex items-center justify-center p-8">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="text-center p-8 text-emerald-200/60 border border-emerald-500/20 rounded-xl bg-emerald-950/20">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50 text-emerald-400/50" />
                <p className="text-emerald-100">No available time slots for this date</p>
                <p className="text-sm mt-2 text-emerald-300/70">Please select another date or use alternative doctors above</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availableSlots.map((slot, index) => {
                  const slotKey = `${slot.start_time} - ${slot.end_time}`;
                  const isSelected = selectedSlot === slotKey;
                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedSlot(slotKey)}
                      className={`p-3 border rounded-lg text-left transition-all ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-600/20 text-emerald-100'
                          : 'border-emerald-500/30 bg-emerald-950/40 text-emerald-200 hover:border-emerald-400/50 hover:bg-emerald-600/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {format(parseISO(`2000-01-01T${slot.start_time}`), 'h:mm a')}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason" className="text-emerald-200">Reason for Appointment *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please describe the reason for your appointment..."
              rows={4}
              className="bg-emerald-950/40 border-emerald-500/30 text-emerald-100 placeholder:text-emerald-300/50 focus:border-emerald-400"
            />
          </div>

          {/* Attach Reports Section */}
          {patientReports.length > 0 && (
            <div className="space-y-2">
              <Label className="text-emerald-200">Attach Medical Reports (Optional)</Label>
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-3 max-h-48 overflow-y-auto">
                {patientReports.map((report) => (
                  <label
                    key={report.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-emerald-600/10 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedReportIds.includes(report.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedReportIds([...selectedReportIds, report.id]);
                        } else {
                          setSelectedReportIds(selectedReportIds.filter(id => id !== report.id));
                        }
                      }}
                      className="w-4 h-4 rounded border-emerald-500/50 bg-emerald-950/60 text-emerald-500 focus:ring-emerald-500/50"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-emerald-100 truncate">{report.title}</p>
                      <p className="text-xs text-emerald-300/60">
                        {report.report_type} • {format(parseISO(report.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-emerald-300/60">
                Selected reports will be shared with the doctor for review
              </p>
            </div>
          )}

          <Button
            onClick={handleBookAppointment}
            disabled={!selectedSlot || !reason.trim() || loading}
            className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Opening payment...
              </>
            ) : (() => {
              const v = callMode === 'video' ? (doctorInfo?.video_consultation_fee ?? doctorInfo?.consultation_fee) : (doctorInfo?.audio_consultation_fee ?? doctorInfo?.consultation_fee);
              return v != null ? `Pay & Book (${formatConsultFeeLabel(v)})` : 'Pay & Book';
            })()}
          </Button>

          <div className="bg-gradient-to-br from-blue-900/20 to-indigo-900/10 border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-100 mb-1">
                  Emergency Appointments
                </p>
                <p className="text-blue-300/80">
                  For emergency cases, please use the emergency button in the app. 
                  Emergency appointments bypass the regular schedule and are always available.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

