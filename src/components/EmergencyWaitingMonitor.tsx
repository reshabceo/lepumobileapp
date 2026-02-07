import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { EmergencyDoctorSelection } from './EmergencyDoctorSelection';
import { AlertCircle, Clock } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface EmergencyWaitingMonitorProps {
  appointmentId: string;
  doctorId: string;
  patientId: string;
  specialty: string;
  onDoctorResponded?: () => void;
  onCancel?: () => void;
}

/**
 * Monitors emergency appointment and auto-redirects to alternative doctors
 * if the current doctor doesn't respond within 2 minutes.
 * Uses existing payment session - NO RE-PAYMENT required.
 */
export const EmergencyWaitingMonitor: React.FC<EmergencyWaitingMonitorProps> = ({
  appointmentId,
  doctorId,
  patientId,
  specialty,
  onDoctorResponded,
  onCancel
}) => {
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [doctorName, setDoctorName] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const checkRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Load doctor name
    const loadDoctor = async () => {
      const { data } = await supabase
        .from('doctors')
        .select('full_name')
        .eq('id', doctorId)
        .single();
      if (data) setDoctorName(data.full_name);
    };
    loadDoctor();
  }, [doctorId]);

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up - show alternatives
          setShowAlternatives(true);
          toast.error('Doctor did not respond in time. Showing alternative doctors.', {
            description: 'Your payment will be used for the alternative doctor - no extra charge!'
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Check if doctor responded or rejected
  useEffect(() => {
    const checkResponse = async () => {
      // Check appointment status
      const { data: appointment } = await supabase
        .from('appointments')
        .select('status, call_initiated')
        .eq('id', appointmentId)
        .single();

      if (appointment?.status === 'in-progress' || appointment?.call_initiated) {
        // Doctor responded!
        if (timerRef.current) clearInterval(timerRef.current);
        if (checkRef.current) clearInterval(checkRef.current);
        onDoctorResponded?.();
        return;
      }

      if (appointment?.status === 'cancelled' || appointment?.status === 'rejected') {
        // Doctor rejected!
        if (timerRef.current) clearInterval(timerRef.current);
        if (checkRef.current) clearInterval(checkRef.current);
        setShowAlternatives(true);
        toast.error('Doctor rejected the emergency call', {
          description: 'Showing alternative doctors. Your payment will be used - no extra charge!'
        });
        return;
      }

      // Check if there's an active call
      const { data: call } = await supabase
        .from('calls')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (call) {
        if (call.status === 'declined' || call.status === 'rejected') {
          // Call rejected
          if (timerRef.current) clearInterval(timerRef.current);
          if (checkRef.current) clearInterval(checkRef.current);
          setShowAlternatives(true);
          toast.error('Doctor declined the call', {
            description: 'Showing alternative doctors. Your payment will be used - no extra charge!'
          });
          return;
        }

        if (call.status === 'pending' || call.status === 'accepted' || call.status === 'active') {
          // Call initiated
          if (timerRef.current) clearInterval(timerRef.current);
          if (checkRef.current) clearInterval(checkRef.current);
          onDoctorResponded?.();
        }
      }
    };

    checkRef.current = setInterval(checkResponse, 3000); // Check every 3 seconds

    return () => {
      if (checkRef.current) clearInterval(checkRef.current);
    };
  }, [appointmentId, doctorId, patientId, onDoctorResponded]);

  if (showAlternatives) {
    const isTimeout = timeLeft === 0;
    const isRejection = timeLeft > 0;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-2xl w-full mx-auto my-8">
          <div className="mb-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-orange-900 dark:text-orange-100 mb-1">
                  {isRejection ? 'Doctor Rejected Emergency Call' : 'Doctor Did Not Respond'}
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  {isRejection 
                    ? `${doctorName || 'The doctor'} has rejected your emergency call. This may be because they are currently busy with another patient or unavailable.`
                    : `${doctorName || 'Your doctor'} did not respond to your emergency within 2 minutes.`
                  }
                  <strong className="block mt-1">Don't worry - your payment is safe!</strong> 
                  Select an alternative doctor below at no extra charge.
                </p>
              </div>
            </div>
          </div>
          
          <EmergencyDoctorSelection
            patientId={patientId}
            assignedDoctorId={doctorId}
            requiredSpecialty={specialty}
            onDoctorSelected={(newDoctorId) => {
              toast.success('Switched to alternative doctor successfully!');
              onDoctorResponded?.();
            }}
            onCancel={() => {
              setShowAlternatives(false);
              onCancel?.();
            }}
            useExistingPayment={true}
          />
        </div>
      </div>
    );
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm w-full mx-auto text-center">
        <div className="mx-auto w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
        
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          🚨 Emergency Alert Sent
        </h3>
        
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Waiting for {doctorName || 'doctor'} to respond...
        </p>

        <div className="flex items-center justify-center gap-2 text-lg font-mono font-semibold text-red-600 dark:text-red-400 mb-4">
          <Clock className="w-5 h-5" />
          <span>{minutes}:{seconds.toString().padStart(2, '0')}</span>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
          <p className="text-xs text-blue-900 dark:text-blue-100">
            If the doctor doesn't respond within 2 minutes, we'll automatically 
            show you alternative doctors at <strong>no extra charge</strong>.
          </p>
        </div>

        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          Cancel Emergency
        </button>
      </div>
    </div>
  );
};
