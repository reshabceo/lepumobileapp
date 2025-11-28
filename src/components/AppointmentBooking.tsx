import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Calendar, Clock, AlertCircle, CheckCircle2, XCircle, Stethoscope, MapPin, Phone } from 'lucide-react';
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
}

interface DoctorInfo {
  id: string;
  full_name: string;
  specialty: string;
  is_available: boolean;
}

export const AppointmentBooking = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [reason, setReason] = useState<string>('');
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

  useEffect(() => {
    loadDoctorId();
    loadMyAppointments();
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
        .select('id, assigned_doctor_id, assigned_doctor:doctors!patients_assigned_doctor_id_fkey(id, full_name, specialty)')
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
          is_available: false // Will be checked when loading slots
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
      const { data, error } = await supabase.rpc('find_available_emergency_doctors', {
        p_patient_id: patientId,
        p_required_specialty: doctorInfo.specialty || null,
        p_limit: 5
      });

      if (error) throw error;
      setAlternativeDoctors(data || []);
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

      // Create appointment with alternative doctor
      const { error: insertError } = await supabase
        .from('appointments')
        .insert({
          doctor_id: alternativeDoctorId,
          patient_id: patient.id,
          appointment_date: appointmentDate,
          appointment_time: appointmentTime,
          duration_minutes: 30,
          status: 'scheduled',
          appointment_type: 'regular',
          reason: `Original doctor unavailable. ${reason.trim()}`,
          patient_notes: `Booked with alternative doctor due to assigned doctor unavailability`
        });

      if (insertError) throw insertError;

      toast.success('Appointment booked with alternative doctor!', {
        description: `Your appointment is scheduled for ${format(parseISO(`${appointmentDate}T${appointmentTime}`), 'EEEE, MMMM d, yyyy at h:mm a')}`
      });

      // Reset form
      setSelectedSlot(null);
      setReason('');
      setShowAlternativeDoctors(false);
      loadMyAppointments();
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

  const handleBookAppointment = async () => {
    if (!selectedSlot || !reason.trim() || !doctorId || !user) {
      toast.error('Please select a time slot and provide a reason');
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

      // Parse the selected slot
      const [startTime] = selectedSlot.split(' - ');

      // Check for conflicts
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

      if (conflictError) {
        console.warn('Conflict check error:', conflictError);
      }

      if (conflictCheck) {
        toast.error('This time slot is no longer available. Please select another time.');
        loadAvailableSlots();
        return;
      }

      // Create appointment
      const { error: insertError } = await supabase
        .from('appointments')
        .insert({
          doctor_id: doctorId,
          patient_id: patient.id,
          appointment_date: selectedDate,
          appointment_time: startTime,
          duration_minutes: 30,
          status: 'scheduled',
          appointment_type: 'regular',
          reason: reason.trim(),
          patient_notes: null
        });

      if (insertError) throw insertError;

      toast.success('Appointment booked successfully!', {
        description: `Your appointment is scheduled for ${format(parseISO(`${selectedDate}T${startTime}`), 'EEEE, MMMM d, yyyy at h:mm a')}`
      });

      // Reset form
      setSelectedSlot(null);
      setReason('');
      loadAvailableSlots();
      loadMyAppointments();
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

  if (!doctorId) {
    return (
      <div className="p-4">
        <Card className="glass border-white/10 bg-gradient-to-br from-emerald-950/50 via-green-900/30 to-emerald-950/50">
          <CardContent className="p-8">
            <div className="text-center text-emerald-200/60">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50 text-emerald-400/50" />
              <p className="text-emerald-100">No doctor assigned</p>
              <p className="text-sm mt-2 text-emerald-300/70">Please contact support to get assigned to a doctor</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <Card className="glass border-white/10 bg-gradient-to-br from-emerald-950/50 via-green-900/30 to-emerald-950/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-emerald-100">
                <Calendar className="w-5 h-5 text-emerald-400" />
                Book Appointment
              </CardTitle>
              <CardDescription className="text-emerald-200/70">
                Schedule an appointment with your doctor
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowMyAppointments(!showMyAppointments)}
              className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/20"
            >
              {showMyAppointments ? 'Hide' : 'Show'} My Appointments
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
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
              className="bg-emerald-950/40 border-emerald-500/30 text-emerald-100 focus:border-emerald-400"
            />
            <p className="text-xs text-emerald-300/60">
              Select a date between tomorrow and 90 days from now
            </p>
          </div>

          {/* Doctor Availability Status */}
          {doctorInfo && (
            <div className={`border rounded-xl p-4 ${
              doctorInfo.is_available 
                ? 'bg-gradient-to-br from-emerald-900/30 to-green-900/20 border-emerald-500/30' 
                : 'bg-gradient-to-br from-orange-900/30 to-red-900/20 border-orange-500/30'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {doctorInfo.is_available ? (
                    <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center border border-emerald-500/30">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-orange-600/20 flex items-center justify-center border border-orange-500/30">
                      <XCircle className="w-5 h-5 text-orange-400" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-emerald-100">
                      Dr. {doctorInfo.full_name}
                    </p>
                    <p className="text-sm text-emerald-300/70">
                      {doctorInfo.specialty}
                    </p>
                  </div>
                </div>
                <Badge className={
                  doctorInfo.is_available 
                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30' 
                    : 'bg-orange-600/20 text-orange-300 border-orange-500/30'
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-blue-100">Alternative Available Doctors</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAlternativeDoctors(false)}
                  className="text-blue-300 hover:bg-blue-600/20"
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
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-blue-100">{doctor.doctor_name}</h4>
                          {doctor.is_available_now && (
                            <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-500/30">
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
                      {loading ? 'Booking...' : doctor.is_available_now ? 'Book Now' : 'Book Next Available'}
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
              <div className="grid grid-cols-2 gap-2">
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

          <Button
            onClick={handleBookAppointment}
            disabled={!selectedSlot || !reason.trim() || loading}
            className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Booking...
              </>
            ) : (
              'Book Appointment'
            )}
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

