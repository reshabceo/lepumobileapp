import React, { useState } from 'react';
import { Siren, Phone, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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

    const triggerEmergency = async () => {
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

            // Get patient profile
            const { data: patientProfile, error: patientError } = await supabase
                .from('patients')
                .select('id, assigned_doctor_id, full_name')
                .eq('auth_user_id', user.id)
                .single();

            if (patientError || !patientProfile) {
                throw new Error('Patient profile not found');
            }

            if (!patientProfile.assigned_doctor_id) {
                throw new Error('No doctor assigned to this patient');
            }

            // Create emergency alert
            const { error: alertError } = await supabase
                .from('emergency_alerts')
                .insert({
                    patient_id: patientProfile.id,
                    doctor_id: patientProfile.assigned_doctor_id,
                    alert_type: 'patient_triggered',
                    severity: 'high',
                    title: 'Patient Emergency Alert',
                    description: `Emergency alert triggered by ${patientProfile.full_name}`,
                    vital_signs_data: null, // Could include current vital signs if available
                });

            if (alertError) {
                throw alertError;
            }

            toast({
                title: "Emergency Alert Sent!",
                description: "Your doctor has been notified immediately.",
                variant: "default",
            });

            setShowConfirm(false);
        } catch (error) {
            console.error('Emergency alert error:', error);
            toast({
                title: "Emergency Alert Failed",
                description: error instanceof Error ? error.message : "Failed to send emergency alert. Please call emergency services directly.",
                variant: "destructive",
            });
        } finally {
            setIsTriggering(false);
        }
    };

    const handleEmergencyClick = () => {
        setShowConfirm(true);
    };

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
                                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                                disabled={isTriggering}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={triggerEmergency}
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
