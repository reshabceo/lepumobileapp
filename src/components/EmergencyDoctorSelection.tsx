import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { payAndFulfil } from '@/lib/payment';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Stethoscope, Clock, MapPin, Phone, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { format, parseISO } from 'date-fns';

interface AlternativeDoctor {
  doctor_id: string;
  doctor_name: string;
  specialty: string;
  years_experience: number;
  hospital: string;
  phone_number: string;
  is_available_now: boolean;
  next_available_time: string | null;
  emergency_fee: number | null;
  consultation_fee: number | null;
}

interface EmergencyDoctorSelectionProps {
  patientId: string;
  assignedDoctorId: string | null;
  requiredSpecialty: string;
  onDoctorSelected: (doctorId: string) => void;
  onCancel: () => void;
  useExistingPayment?: boolean; // If true, use existing payment session instead of charging again
}

export const EmergencyDoctorSelection = ({
  patientId,
  assignedDoctorId,
  requiredSpecialty,
  onDoctorSelected,
  onCancel,
  useExistingPayment = false
}: EmergencyDoctorSelectionProps) => {
  const [alternativeDoctors, setAlternativeDoctors] = useState<AlternativeDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingDoctorId, setBookingDoctorId] = useState<string | null>(null);
  const [paymentSession, setPaymentSession] = useState<any>(null);

  useEffect(() => {
    loadAlternativeDoctors();
    if (useExistingPayment) {
      loadPaymentSession();
    }
  }, [patientId, requiredSpecialty, useExistingPayment]);

  const loadPaymentSession = async () => {
    try {
      const { data, error } = await supabase.rpc('get_active_emergency_session', {
        p_patient_id: patientId
      });

      if (error) throw error;
      if (data && data.length > 0) {
        setPaymentSession(data[0]);
      }
    } catch (error: any) {
      console.error('Error loading payment session:', error);
    }
  };

  const loadAlternativeDoctors = async () => {
    try {
      setLoading(true);
      const { data: doctors, error } = await supabase.rpc('find_available_emergency_doctors', {
        p_patient_id: patientId,
        p_required_specialty: requiredSpecialty || null, // Pass null if no specialty
        p_limit: 5
      });

      if (error) throw error;

      // Fetch pricing for each doctor
      if (doctors && doctors.length > 0) {
        const doctorIds = doctors.map((d: any) => d.doctor_id);
        const { data: pricingData } = await supabase
          .from('doctors')
          .select('id, emergency_fee, consultation_fee')
          .in('id', doctorIds);

        const pricingMap = new Map(
          pricingData?.map(d => [d.id, { emergency_fee: d.emergency_fee, consultation_fee: d.consultation_fee }]) || []
        );

        const doctorsWithPricing = doctors.map((doc: any) => ({
          ...doc,
          emergency_fee: pricingMap.get(doc.doctor_id)?.emergency_fee,
          consultation_fee: pricingMap.get(doc.doctor_id)?.consultation_fee
        }));

        setAlternativeDoctors(doctorsWithPricing);
      } else {
        setAlternativeDoctors([]);
      }
    } catch (error: any) {
      console.error('Error loading alternative doctors:', error);
      toast.error('Failed to load available doctors');
    } finally {
      setLoading(false);
    }
  };

  const handleBookEmergencyAppointment = async (doctorId: string) => {
    try {
      setBookingDoctorId(doctorId);

      const now = new Date();
      const appointmentDate = format(now, 'yyyy-MM-dd');
      const appointmentTime = format(now, 'HH:mm:ss');

      const appointmentPayload = {
        doctor_id: doctorId,
        patient_id: patientId,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        duration_minutes: 30,
        status: 'scheduled',
        appointment_type: 'emergency',
        reason: 'Emergency appointment - assigned doctor unavailable',
        patient_notes: 'Emergency case - patient needs immediate attention'
      };

      const alertPayload = {
        patient_id: patientId,
        doctor_id: doctorId,
        alert_type: 'patient_triggered',
        severity: 'high',
        title: 'Emergency Appointment Booked',
        description: `Emergency appointment booked with alternative doctor due to assigned doctor unavailability`
      };

      // If using existing payment, book directly
      if (useExistingPayment && paymentSession) {
        // Update payment session with new doctor
        await supabase
          .from('emergency_payment_sessions')
          .update({
            attempted_doctor_ids: [...(paymentSession.attempted_doctor_ids || []), doctorId]
          })
          .eq('session_id', paymentSession.session_id);

        // Create appointment
        const { error: appErr } = await supabase.from('appointments').insert({
          ...appointmentPayload,
          payment_session_id: paymentSession.session_id
        });

        if (appErr) throw appErr;

        // Create alert
        await supabase.from('emergency_alerts').insert(alertPayload);

        toast.success('Switched to alternative doctor successfully!', {
          description: 'The new doctor has been notified. No additional payment required!'
        });
        onDoctorSelected(doctorId);
      } else {
        // Regular payment flow
        const { data: doctor, error: docError } = await supabase
          .from('doctors')
          .select('consultation_fee, emergency_fee')
          .eq('id', doctorId)
          .single();

        if (docError || !doctor) {
          toast.error('Could not load doctor fee');
          setBookingDoctorId(null);
          return;
        }

        const feeRupees = doctor.emergency_fee ?? doctor.consultation_fee;
        const amountPaise = feeRupees != null ? Math.round(Number(feeRupees) * 100) : 0;
        if (amountPaise < 100) {
          toast.error('This doctor has not set an emergency fee. Please contact support.');
          setBookingDoctorId(null);
          return;
        }

        await payAndFulfil({
          type: 'emergency',
          amount_paise: amountPaise,
          metadata: { 
              appointment: appointmentPayload, 
              alert: alertPayload,
              amount_paise: amountPaise 
          },
          onSuccess: () => {
            toast.success('Emergency appointment booked successfully!', {
              description: 'The doctor has been notified and will respond immediately.'
            });
            onDoctorSelected(doctorId);
          },
          onError: (err) => toast.error(err.message || 'Payment or booking failed'),
        });
      }
    } catch (error: any) {
      console.error('Error booking emergency appointment:', error);
      toast.error(error.message || 'Failed to book emergency appointment');
    } finally {
      setBookingDoctorId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (alternativeDoctors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            No Alternative Doctors Available
          </CardTitle>
          <CardDescription>
            Your assigned doctor is not available, and we couldn't find alternative doctors with the same specialty at this time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-900 dark:text-red-100 font-medium mb-2">
              Immediate Action Required:
            </p>
            <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
              <li>Call emergency services (911/112) if this is a life-threatening emergency</li>
              <li>Go to the nearest emergency room</li>
              <li>Contact your assigned doctor's hospital directly</li>
            </ul>
          </div>
          <Button onClick={onCancel} variant="outline" className="w-full">
            Go Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stethoscope className="w-5 h-5" />
          Available Alternative Doctors
        </CardTitle>
        <CardDescription>
          {requiredSpecialty 
            ? `Your assigned doctor is not available right now. Here are ${alternativeDoctors.length} alternative doctor${alternativeDoctors.length > 1 ? 's' : ''} with the same specialty (${requiredSpecialty}), sorted by experience:`
            : `Here are ${alternativeDoctors.length} available doctor${alternativeDoctors.length > 1 ? 's' : ''}, sorted by experience:`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {alternativeDoctors.map((doctor) => (
          <div
            key={doctor.doctor_id}
            className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-lg">{doctor.doctor_name}</h3>
                  {doctor.is_available_now && (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Available Now
                    </Badge>
                  )}
                </div>

                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4" />
                    <span>{doctor.specialty}</span>
                    {doctor.years_experience > 0 && (
                      <span className="ml-2">• {doctor.years_experience} years experience</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{doctor.hospital}</span>
                  </div>
                  {doctor.phone_number && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      <span>{doctor.phone_number}</span>
                    </div>
                  )}
                  {!doctor.is_available_now && doctor.next_available_time && (
                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                      <Clock className="w-4 h-4" />
                      <span>Next available: {format(parseISO(`2000-01-01T${doctor.next_available_time}`), 'h:mm a')}</span>
                    </div>
                  )}
                  {(doctor.emergency_fee || doctor.consultation_fee) && (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold">
                      <span>Emergency Fee: ₹{doctor.emergency_fee ?? doctor.consultation_fee}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={() => handleBookEmergencyAppointment(doctor.doctor_id)}
              disabled={bookingDoctorId === doctor.doctor_id}
              className="w-full"
              variant={doctor.is_available_now ? 'default' : 'outline'}
            >
              {bookingDoctorId === doctor.doctor_id ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  {useExistingPayment ? 'Switching doctor...' : 'Opening payment...'}
                </>
              ) : useExistingPayment ? (
                doctor.is_available_now 
                  ? '✅ Book Emergency Now (No Extra Charge)'
                  : '✅ Book for Next Available (No Extra Charge)'
              ) : (() => {
                const fee = doctor.emergency_fee ?? doctor.consultation_fee;
                return doctor.is_available_now 
                  ? `Pay & Book Emergency Now ${fee ? `(₹${fee})` : ''}`
                  : `Pay & Book for Next Available ${fee ? `(₹${fee})` : ''}`;
              })()}
            </Button>
          </div>
        ))}

        <div className="pt-4 border-t">
          <Button onClick={onCancel} variant="outline" className="w-full">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

