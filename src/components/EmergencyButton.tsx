import React, { useState } from 'react';
import { Siren, Phone, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { payAndFulfil } from '@/lib/payment';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { EmergencyDoctorSelection } from './EmergencyDoctorSelection';
import { EmergencyWaitingMonitor } from './EmergencyWaitingMonitor';

interface EmergencyButtonProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const EmergencyButton: React.FC<EmergencyButtonProps> = ({
    size = 'md',
    className = ''
}) => {
    const [isTriggering, setIsTriggering] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showAlternativeDoctors, setShowAlternativeDoctors] = useState(false);
    const [showWaitingMonitor, setShowWaitingMonitor] = useState(false);
    const [currentAppointmentId, setCurrentAppointmentId] = useState<string | null>(null);
    const [patientData, setPatientData] = useState<{
        id: string;
        assigned_doctor_id: string | null;
        assigned_doctor_specialty: string | null;
    } | null>(null);
    const { user } = useAuth();
    const { toast } = useToast();

    const sizeClasses = {
        sm: 'p-2 text-sm',
        md: 'p-4 text-base',
        lg: 'p-6 text-lg'
    };

    const iconSizes = {
        sm: 16,
        md: 24,
        lg: 32
    };

    const checkDoctorAvailability = async () => {
        if (!user) {
            toast({
                title: "Authentication Required",
                description: "Please log in to trigger emergency alerts.",
                variant: "destructive",
            });
            return;
        }

        try {
            setIsTriggering(true);

            // Get patient profile with assigned doctor info
            const { data: patientProfile, error: patientError } = await supabase
                .from('patients')
                .select(`
                    id, 
                    assigned_doctor_id,
                    assigned_doctor:doctors!patients_assigned_doctor_id_fkey(specialty)
                `)
                .eq('auth_user_id', user.id)
                .single();

            if (patientError || !patientProfile) {
                throw new Error('Patient profile not found');
            }

            if (!patientProfile.assigned_doctor_id) {
                // No assigned doctor - show alternative doctors
                toast({
                    title: "No Doctor Assigned",
                    description: "Finding available doctors for you...",
                    variant: "default",
                });
                setPatientData({
                    id: patientProfile.id,
                    assigned_doctor_id: null,
                    assigned_doctor_specialty: null
                });
                setShowConfirm(false);
                setShowAlternativeDoctors(true);
                return;
            }

            const assignedDoctorId = patientProfile.assigned_doctor_id;
            const specialty = (patientProfile.assigned_doctor as any)?.specialty || null;

            // Check if assigned doctor is available right now
            const now = new Date();
            const currentDate = now.toISOString().split('T')[0];
            const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:mm format
            const currentDayOfWeek = now.getDay();

            // Get available slots for today
            const { data: availableSlots, error: availabilityError } = await supabase.rpc(
                'get_available_slots',
                {
                    p_doctor_id: assignedDoctorId,
                    p_date: currentDate
                }
            );

            if (availabilityError) {
                console.error('Error checking availability:', availabilityError);
            }

            // Check if current time falls within any available slot
            const isAvailable = availableSlots && availableSlots.length > 0 && 
                availableSlots.some((slot: any) => {
                    const slotStart = slot.start_time.substring(0, 5); // HH:mm
                    const slotEnd = slot.end_time.substring(0, 5); // HH:mm
                    return slotStart <= currentTime && slotEnd >= currentTime;
                });

            if (isAvailable) {
                // Doctor is available - proceed with normal emergency alert
                await triggerEmergencyAlert(patientProfile.id, assignedDoctorId);
            } else {
                // Doctor is not available - show alternative doctors
                setPatientData({
                    id: patientProfile.id,
                    assigned_doctor_id: assignedDoctorId,
                    assigned_doctor_specialty: specialty
                });
                setShowConfirm(false);
                setShowAlternativeDoctors(true);
            }
        } catch (error) {
            console.error('Emergency check error:', error);
            toast({
                title: "Emergency Check Failed",
                description: error instanceof Error ? error.message : "Failed to check doctor availability. Please call emergency services directly.",
                variant: "destructive",
            });
        } finally {
            setIsTriggering(false);
        }
    };

    const triggerEmergencyAlert = async (patientId: string, doctorId: string) => {
        try {
            // Get doctor's emergency fee
            const { data: doctor, error: docError } = await supabase
                .from('doctors')
                .select('consultation_fee, emergency_fee')
                .eq('id', doctorId)
                .single();

            if (docError || !doctor) {
                toast({
                    title: "Error",
                    description: "Could not load doctor information.",
                    variant: "destructive",
                });
                setIsTriggering(false);
                return;
            }

            const feeRupees = doctor.emergency_fee ?? doctor.consultation_fee;
            const amountPaise = feeRupees != null ? Math.round(Number(feeRupees) * 100) : 0;
            
            if (amountPaise < 100) {
                toast({
                    title: "Fee Not Set",
                    description: "Your doctor has not set an emergency fee. Please contact them directly.",
                    variant: "destructive",
                });
                setIsTriggering(false);
                return;
            }

            const now = new Date();
            const appointmentDate = now.toISOString().split('T')[0];
            const appointmentTime = now.toTimeString().split(' ')[0];

            const appointmentPayload = {
                doctor_id: doctorId,
                patient_id: patientId,
                appointment_date: appointmentDate,
                appointment_time: appointmentTime,
                duration_minutes: 30,
                status: 'scheduled',
                appointment_type: 'emergency',
                call_mode: 'video',
                reason: 'Emergency - patient triggered alert',
                patient_notes: 'Emergency case - immediate attention required'
            };

            const alertPayload = {
                patient_id: patientId,
                doctor_id: doctorId,
                alert_type: 'patient_triggered',
                severity: 'critical',
                title: '🚨 PATIENT EMERGENCY ALERT',
                description: 'Emergency alert triggered by patient. Immediate attention required!',
                is_resolved: false,
                call_initiated: false,
                ems_dispatched: false,
                hospital_notified: false
            };

            await payAndFulfil({
                type: 'emergency',
                amount_paise: amountPaise,
                metadata: { 
                    appointment: appointmentPayload, 
                    alert: alertPayload,
                    amount_paise: amountPaise 
                },
                onSuccess: async () => {
                    // Get the created appointment ID
                    const { data: appointments } = await supabase
                        .from('appointments')
                        .select('id')
                        .eq('patient_id', patientId)
                        .eq('doctor_id', doctorId)
                        .eq('appointment_type', 'emergency')
                        .order('created_at', { ascending: false })
                        .limit(1);

                    if (appointments && appointments.length > 0) {
                        setCurrentAppointmentId(appointments[0].id);
                        setPatientData({
                            id: patientId,
                            assigned_doctor_id: doctorId,
                            assigned_doctor_specialty: null
                        });
                        setShowConfirm(false);
                        setShowWaitingMonitor(true);
                    } else {
                        toast({
                            title: "🚨 Emergency Alert Sent!",
                            description: "Your doctor has been notified and payment confirmed.",
                            variant: "default",
                            duration: 5000,
                        });
                        setShowConfirm(false);
                    }
                },
                onError: (err) => {
                    toast({
                        title: "Payment Failed",
                        description: err.message || "Please try again or call emergency services.",
                        variant: "destructive",
                    });
                },
            });
        } catch (error) {
            console.error('Emergency alert error:', error);
            toast({
                title: "Failed to Process Emergency",
                description: error instanceof Error ? error.message : "Please try again or call your doctor directly.",
                variant: "destructive",
            });
        } finally {
            setIsTriggering(false);
        }
    };

    const handleDoctorSelected = (doctorId: string) => {
        setShowAlternativeDoctors(false);
        setShowConfirm(false);
        // Emergency appointment already booked in EmergencyDoctorSelection component
    };

    const handleEmergencyClick = () => {
        setShowConfirm(true);
    };

    if (showWaitingMonitor && patientData && currentAppointmentId) {
        return (
            <EmergencyWaitingMonitor
                appointmentId={currentAppointmentId}
                doctorId={patientData.assigned_doctor_id!}
                patientId={patientData.id}
                specialty={patientData.assigned_doctor_specialty || 'General Medicine'}
                onDoctorResponded={() => {
                    setShowWaitingMonitor(false);
                    toast({
                        title: "Doctor Responding!",
                        description: "Your doctor is now attending to your emergency.",
                        variant: "default",
                    });
                }}
                onCancel={() => {
                    setShowWaitingMonitor(false);
                    setCurrentAppointmentId(null);
                }}
            />
        );
    }

    if (showAlternativeDoctors && patientData) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                <div className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-2xl w-full mx-auto my-8">
                    <EmergencyDoctorSelection
                        patientId={patientData.id}
                        assignedDoctorId={patientData.assigned_doctor_id}
                        requiredSpecialty={patientData.assigned_doctor_specialty || 'General Medicine'}
                        onDoctorSelected={handleDoctorSelected}
                        onCancel={() => {
                            setShowAlternativeDoctors(false);
                            setShowConfirm(false);
                        }}
                    />
                </div>
            </div>
        );
    }

    if (showConfirm) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-auto">
                    <div className="text-center">
                        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Trigger Emergency Alert?
                        </h3>
                        <p className="text-gray-600 mb-6">
                            This will immediately notify your assigned doctor about a medical emergency.
                            Only use this for actual emergencies.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isTriggering}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={checkDoctorAvailability}
                                disabled={isTriggering}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isTriggering ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Siren className="w-4 h-4" />
                                        Send Alert
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <button
            onClick={handleEmergencyClick}
            className={`
        bg-red-600/90 backdrop-blur-sm hover:bg-red-700/90 text-white font-bold rounded-xl 
        flex items-center justify-center gap-2 transition-all duration-200 
        hover:scale-105 active:scale-95 border border-red-500/30 hover:border-red-500/50
        ${sizeClasses[size]} ${className}
      `}
        >
            <Siren size={iconSizes[size]} className="animate-pulse" />
            <span>Emergency</span>
        </button>
    );
};
