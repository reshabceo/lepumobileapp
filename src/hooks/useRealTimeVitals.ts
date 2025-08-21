import { useState, useEffect } from 'react';
import { supabase, db } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface VitalSign {
    id: string;
    type: 'BP' | 'ECG' | 'OXIMETER' | 'GLUCOSE';
    data: any;
    reading_timestamp: string;
    device_id?: string;
}

export interface PatientProfile {
    id: string;
    full_name: string;
    email: string;
    phone_number?: string;
    assigned_doctor_id: string;
    date_of_birth?: string;
    gender?: string;
    medical_conditions?: string[];
    profile_picture_url?: string;
    patient_code?: string;
    address?: string;
    blood_type?: string;
    allergies?: string[];
    current_medications?: string[];
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
}

export const useRealTimeVitals = () => {
    const [vitals, setVitals] = useState<VitalSign[]>([]);
    const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user } = useAuth();

    // Fetch patient profile and initial vitals
    useEffect(() => {
        if (!user) return;

        const fetchPatientData = async () => {
            try {
                setLoading(true);
                setError(null);

                // Get patient profile
                const profileData = await db.getPatientProfile(user.id);
                if (profileData.error) {
                    throw new Error(typeof profileData.error === 'string' ? profileData.error : profileData.error.message);
                }

                setPatientProfile(profileData.data);

                // Get vital signs for this patient
                const { data: vitalsData, error: vitalsError } = await supabase
                    .from('vital_signs')
                    .select('*')
                    .eq('patient_id', profileData.data?.id)
                    .order('reading_timestamp', { ascending: false })
                    .limit(50);

                if (vitalsError) {
                    throw new Error(vitalsError.message);
                }

                setVitals(vitalsData || []);

            } catch (err) {
                console.error('Error fetching patient data:', err);
                setError(err instanceof Error ? err.message : 'Failed to fetch patient data');
            } finally {
                setLoading(false);
            }
        };

        fetchPatientData();
    }, [user]);

    // Set up real-time subscription for vital signs
    useEffect(() => {
        if (!patientProfile) return;

        console.log('🔄 Setting up real-time vital signs subscription for patient:', patientProfile.id);

        const channel = supabase
            .channel('patient_vital_signs')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'vital_signs',
                    filter: `patient_id=eq.${patientProfile.id}`
                },
                (payload) => {
                    console.log('📊 Real-time vital signs update:', payload);

                    if (payload.eventType === 'INSERT') {
                        // Simple insert without complex filtering
                        setVitals(prev => [payload.new as VitalSign, ...prev.slice(0, 49)]);
                    } else if (payload.eventType === 'UPDATE') {
                        setVitals(prev => prev.map(vital =>
                            vital.id === payload.new.id ? payload.new as VitalSign : vital
                        ));
                    } else if (payload.eventType === 'DELETE') {
                        setVitals(prev => prev.filter(vital => vital.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            console.log('🔄 Unsubscribing from vital signs updates');
            channel.unsubscribe();
        };
    }, [patientProfile]);

    // Add new vital sign
    const addVitalSign = async (type: VitalSign['type'], data: any, deviceId?: string) => {
        if (!patientProfile) {
            throw new Error('Patient profile not loaded');
        }

        try {
            await db.insertVitalSigns({
                type,
                data,
                device_id: deviceId,
                timestamp: new Date().toISOString()
            });

            console.log('✅ Vital sign added successfully');
        } catch (err) {
            console.error('❌ Error adding vital sign:', err);
            throw err;
        }
    };

    // Get latest vital by type
    const getLatestVital = (type: VitalSign['type']): VitalSign | null => {
        return vitals.find(vital => vital.type === type) || null;
    };

    // Get vitals history by type
    const getVitalsByType = (type: VitalSign['type']): VitalSign[] => {
        return vitals.filter(vital => vital.type === type);
    };

    // Get latest readings for dashboard with hybrid strategy
    const getLatestReadings = () => {
        // 1. Try Supabase first (most recent)
        const latestBP = getLatestVital('BP');
        const latestECG = getLatestVital('ECG');
        const latestOximeter = getLatestVital('OXIMETER');
        const latestGlucose = getLatestVital('GLUCOSE');

        // 2. Fallback to localStorage if Supabase is empty for BP
        let bloodPressure = null;
        if (latestBP) {
            bloodPressure = `${latestBP.data.systolic}/${latestBP.data.diastolic}`;
        } else {
            // Try localStorage as fallback
            try {
                const localBPResults = JSON.parse(localStorage.getItem('bpResults') || '[]');
                if (localBPResults.length > 0) {
                    const latestLocal = localBPResults[0];
                    if (latestLocal.systolic && latestLocal.diastolic) {
                        bloodPressure = `${latestLocal.systolic}/${latestLocal.diastolic}`;
                        console.log('📊 [Fallback] Using BP from localStorage:', bloodPressure);
                    }
                }
            } catch (error) {
                console.warn('⚠️ Failed to read BP from localStorage fallback:', error);
            }
        }

        return {
            bloodPressure,
            heartRate: latestECG?.data?.heartRate || null,
            oxygenSaturation: latestOximeter?.data?.oxygenSaturation || null,
            bloodSugar: latestGlucose?.data?.glucose || null,
            lastUpdate: vitals[0]?.reading_timestamp || null
        };
    };

    return {
        vitals,
        patientProfile,
        loading,
        error,
        addVitalSign,
        getLatestVital,
        getVitalsByType,
        getLatestReadings
    };
};
