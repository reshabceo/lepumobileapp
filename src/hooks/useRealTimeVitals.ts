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

// Read the localStorage cache synchronously so patientProfile is available on the very first
// render — prevents HealthDashboard from showing a spinner while patientProfile is null
// even when we have a perfectly fresh cached copy.
function readCachedProfile(userId: string): PatientProfile | null {
    try {
        const raw = localStorage.getItem(`patient_profile_${userId}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const cacheTime = parsed._cached_at || 0;
        if (Date.now() - cacheTime < 5 * 60 * 1000) return parsed as PatientProfile;
    } catch { /* ignore */ }
    return null;
}

export const useRealTimeVitals = () => {
    const { user } = useAuth();
    const [vitals, setVitals] = useState<VitalSign[]>([]);
    // Initialize synchronously from cache so the dashboard never flashes a spinner for cached users
    const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(
        () => user ? readCachedProfile(user.id) : null
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch patient profile and initial vitals
    useEffect(() => {
        if (!user) {
            setLoading(false);
            setPatientProfile(null);
            setVitals([]);
            setError(null);
            return;
        }

        let isMounted = true;
        let timeoutId: NodeJS.Timeout | null = null;

        const fetchPatientData = async () => {
            // 🚀 OPTIMIZATION: Check localStorage first for instant load
            const cacheKey = `patient_profile_${user.id}`;
            const cachedProfile = localStorage.getItem(cacheKey);
            let hasCache = false;
            // Keep ANY parsed cache around (even if stale) so we can fall back to it
            // if the network fetch hangs/times out — prevents the app getting stuck.
            let cachedParsed: any = null;

            if (cachedProfile) {
                try {
                    const parsed = JSON.parse(cachedProfile);
                    cachedParsed = parsed;
                    const cacheTime = parsed._cached_at || 0;
                    const now = Date.now();
                    // Use cache if less than 5 minutes old
                    if (now - cacheTime < 5 * 60 * 1000) {
                        console.log('✅ Using cached profile (instant load)');
                        if (isMounted) {
                            setPatientProfile(parsed);
                            // Set loading to false immediately if we have valid cache
                            setLoading(false);
                            hasCache = true;
                        }
                    }
                } catch (e) {
                    console.warn('Failed to parse cached profile', e);
                }
            }

            // Safety timeout to prevent infinite loading. 12s is long enough for a
            // slow mobile network but short enough that the user isn't stuck staring
            // at a spinner. On fire we fall back to stale cache if we have it.
            timeoutId = setTimeout(() => {
                if (isMounted) {
                    console.warn('⚠️ Loading timeout - forcing loading to false');
                    setLoading(false);
                    if (cachedParsed) {
                        console.warn('⚠️ Falling back to stale cached profile after timeout');
                        setPatientProfile(cachedParsed);
                        setError(null);
                    } else if (!hasCache) {
                        setError('Loading took too long. Please check your connection.');
                    }
                }
            }, 12000);

            try {
                if (isMounted && !hasCache) {
                    setLoading(true);
                    setError(null);
                }

                // 🚀 OPTIMIZED: Fetch profile with timeout protection + one retry.
                // The fetch is wrapped in a 10s timeout; if it hangs (common in
                // mobile webviews after backgrounding) we retry once before giving up.
                const fetchProfileWithTimeout = () => {
                    const profilePromise = db.getPatientProfile(user.id);
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
                    );
                    return Promise.race([
                        Promise.resolve(profilePromise).then(result => ({ status: 'fulfilled' as const, value: result })),
                        timeoutPromise.then(() => ({ status: 'rejected' as const, reason: new Error('Profile fetch timeout') }))
                    ]);
                };

                let profileResult = await fetchProfileWithTimeout();
                if (profileResult.status === 'rejected' && isMounted) {
                    console.warn('⚠️ Profile fetch timed out, retrying once...');
                    profileResult = await fetchProfileWithTimeout();
                }

                // Handle profile result
                if (profileResult.status === 'fulfilled') {
                    const profileData = profileResult.value;
                    if (profileData.error) {
                        throw new Error(typeof profileData.error === 'string' ? profileData.error : profileData.error.message);
                    }

                    if (!profileData.data) {
                        console.log('ℹ️ No patient profile found');
                        if (isMounted) {
                            setPatientProfile(null);
                            setLoading(false);
                        }
                        if (timeoutId) clearTimeout(timeoutId);
                        return;
                    }

                    // Cache the profile for instant future loads
                    const profileToCache = { ...profileData.data, _cached_at: Date.now() };
                    localStorage.setItem(cacheKey, JSON.stringify(profileToCache));
                    
                    if (isMounted) {
                        setPatientProfile(profileData.data);
                        setLoading(false); // Profile loaded - stop showing loading immediately
                    }

                    if (timeoutId) clearTimeout(timeoutId);

                    // Now fetch vitals in background (non-blocking, with error handling)
                    try {
                        const vitalsTimeout = setTimeout(() => {
                            console.warn('Vitals fetch taking too long, skipping...');
                        }, 5000);

                        const { data: vitalsData, error: vitalsError } = await supabase
                            .from('vital_signs')
                            .select('*')
                            .eq('patient_id', profileData.data.id)
                            .order('reading_timestamp', { ascending: false })
                            .limit(50);

                        clearTimeout(vitalsTimeout);

                        if (isMounted && !vitalsError && vitalsData) {
                            const mappedVitals = vitalsData.map(vital => ({
                                id: vital.id,
                                type: vital.device_type as VitalSign['type'],
                                data: vital.data,
                                reading_timestamp: vital.reading_timestamp,
                                device_id: vital.device_id
                            }));
                            setVitals(mappedVitals);
                        }
                    } catch (vitalsErr) {
                        console.warn('Failed to fetch vitals (non-critical):', vitalsErr);
                        // Don't set error for vitals failure - it's non-critical
                    }
                } else {
                    throw profileResult.reason;
                }

            } catch (err) {
                console.error('Error fetching patient data:', err);
                if (isMounted) {
                    // Never leave the app stuck: if we have ANY cached profile, use it
                    // so the UI stays usable without a manual reload/app restart.
                    if (cachedParsed) {
                        console.warn('⚠️ Using stale cached profile after fetch failure');
                        setPatientProfile(cachedParsed);
                        setError(null);
                    } else {
                        setError(err instanceof Error ? err.message : 'Failed to fetch patient data');
                    }
                    setLoading(false);
                }
            } finally {
                if (timeoutId) clearTimeout(timeoutId);
            }
        };

        fetchPatientData();

        return () => {
            isMounted = false;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [user?.id]); // Only depend on user.id to prevent unnecessary re-fetches

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
                        // 🚀 FIXED: Map incoming Supabase data to expected format
                        const mappedVital: VitalSign = {
                            id: payload.new.id,
                            type: payload.new.device_type as VitalSign['type'],
                            data: payload.new.data,
                            reading_timestamp: payload.new.reading_timestamp,
                            device_id: payload.new.device_id
                        };
                        setVitals(prev => [mappedVital, ...prev.slice(0, 49)]);
                        console.log('✅ [FIXED] Mapped and added new vital sign:', mappedVital);
                    } else if (payload.eventType === 'UPDATE') {
                        const mappedVital: VitalSign = {
                            id: payload.new.id,
                            type: payload.new.device_type as VitalSign['type'],
                            data: payload.new.data,
                            reading_timestamp: payload.new.reading_timestamp,
                            device_id: payload.new.device_id
                        };
                        setVitals(prev => prev.map(vital =>
                            vital.id === payload.new.id ? mappedVital : vital
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
            // 🚀 FIXED: Use correct Supabase structure
            await db.insertVitalSigns({
                device_type: type, // Map type to device_type
                measurement_type: type === 'BP' ? 'blood_pressure' : type.toLowerCase(),
                data,
                device_id: deviceId,
                reading_timestamp: new Date().toISOString()
            });

            console.log('✅ Vital sign added successfully with correct structure');
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

                    // 🚀 DEBUG: Log what we're finding
        console.log('🔍 [DEBUG] Latest vitals found:', {
            BP: latestBP?.data,
            ECG: latestECG?.data,
            Oximeter: latestOximeter?.data,
            Glucose: latestGlucose?.data
        });
        
        // 🚀 ENHANCED DEBUG: Check if ECG vital is found at all
        if (latestECG) {
            console.log('✅ [DEBUG] ECG vital found:', {
                id: latestECG.id,
                type: latestECG.type,
                data: latestECG.data,
                reading_timestamp: latestECG.reading_timestamp
            });
        } else {
            console.log('❌ [DEBUG] No ECG vital found in vitals array');
            console.log('🔍 [DEBUG] All available vitals:', vitals.map(v => ({ type: v.type, device_type: v.type })));
        }

        // 2. Extract BP data from Supabase JSONB structure
        let bloodPressure = null;
        if (latestBP) {
            // 🚀 FIXED: Extract BP data from the correct JSONB structure
            const bpData = latestBP.data;
            if (bpData && bpData.systolic && bpData.diastolic) {
                bloodPressure = `${bpData.systolic}/${bpData.diastolic}`;
                console.log('📊 [FIXED] BP from Supabase:', bloodPressure, 'Data:', bpData);
            } else {
                console.warn('⚠️ BP data structure incomplete:', bpData);
            }
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

        // 🚀 FIXED: Extract heart rate from ECG data with proper field mapping
        let heartRate = null;
        if (latestECG) {
            const ecgData = latestECG.data;
            if (ecgData) {
                // Try both field names (heart_rate from Supabase, heartRate from localStorage)
                heartRate = ecgData.heart_rate || ecgData.heartRate || null;
                console.log('📊 [FIXED] ECG data extracted:', ecgData, 'Heart Rate:', heartRate);
            }
        } else {
            // 🚀 FALLBACK: Check if there are any ECG records in the vitals array
            const allECGVitals = vitals.filter(v => v.type === 'ECG');
            if (allECGVitals.length > 0) {
                const mostRecentECG = allECGVitals[0];
                const ecgData = mostRecentECG.data;
                heartRate = ecgData?.heart_rate || ecgData?.heartRate || null;
                console.log('🔄 [FALLBACK] Found ECG in vitals array:', mostRecentECG, 'Heart Rate:', heartRate);
            } else {
                console.log('❌ [FALLBACK] No ECG records found in vitals array at all');
            }
        }

        return {
            bloodPressure,
            heartRate,
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
