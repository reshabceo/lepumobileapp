import { useState, useEffect } from 'react';
import { supabase, db, resolvePatientId } from '@/lib/supabase';
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

        // ── Pure stale-while-revalidate. NO TIMERS, NO TIMEOUTS. ───────────────
        //
        // Design:
        //   1. Read cache (any age) → render instantly. Loading is false.
        //   2. Resolve patient id immediately as a fast fallback for consumers
        //      that only need the id (so heavy-page hooks like AddReports never
        //      block waiting on the full row).
        //   3. Fire the full-profile fetch in the background. Whatever it takes.
        //      On success → update state + cache silently.
        //      On error → log, keep the cached UI, never break anything.
        //
        // If the DB query is slow, that's a DB problem (see DB_ARCHITECTURE.md
        // section 9 — VOLATILE RLS helpers). It must never be papered over with
        // a frontend timer that makes the app give up on real data.

        const fetchPatientData = async () => {
            const cacheKey = `patient_profile_${user.id}`;

            // (1) Hydrate from cache — any age. If we have *anything*, render it.
            let cachedParsed: any = null;
            try {
                const raw = localStorage.getItem(cacheKey);
                if (raw) cachedParsed = JSON.parse(raw);
            } catch { /* ignore corrupt cache */ }

            const hasCache = !!cachedParsed;
            if (hasCache && isMounted) {
                setPatientProfile(cachedParsed);
                setLoading(false);
                setError(null);
            } else if (isMounted) {
                // Only show the spinner when we have literally nothing to show.
                setLoading(true);
                setError(null);
            }

            // (2) Resolve patient.id as a fast unblock for consumers that only
            //     need the id (deduped & cached inside resolvePatientId).
            if (!hasCache) {
                resolvePatientId(user.id).then((id) => {
                    if (id && isMounted) {
                        setPatientProfile((prev: any) => (prev?.id ? prev : { id }));
                        setLoading(false);
                    }
                }).catch(() => { /* swallow — the full fetch below is the real source */ });
            }

            // (3) Background revalidate. No timeout. No retry race.
            try {
                const { data, error: profileError } = await db.getPatientProfile(user.id);
                if (!isMounted) return;

                if (profileError) {
                    // DB error — keep the cached UI if we have one, otherwise surface it.
                    console.warn('Profile refresh failed:', profileError);
                    if (!hasCache) {
                        setError(typeof profileError === 'string' ? profileError : (profileError as any).message);
                        setLoading(false);
                    }
                    return;
                }

                if (!data) {
                    // No row for this user. Only clear the UI if we don't have a cache
                    // (otherwise the user briefly logged into a different account etc.)
                    if (!hasCache) {
                        setPatientProfile(null);
                        setLoading(false);
                    }
                    return;
                }

                // Fresh data — update state + cache.
                const profileToCache = { ...data, _cached_at: Date.now() };
                localStorage.setItem(cacheKey, JSON.stringify(profileToCache));
                setPatientProfile(data);
                setLoading(false);
                setError(null);

                // Fire vitals refresh — also no timeout, fully best-effort.
                try {
                    const { data: vitalsData, error: vitalsError } = await supabase
                        .from('vital_signs')
                        .select('*')
                        .eq('patient_id', data.id)
                        .order('reading_timestamp', { ascending: false })
                        .limit(50);

                    if (isMounted && !vitalsError && vitalsData) {
                        setVitals(vitalsData.map((vital: any) => ({
                            id: vital.id,
                            type: vital.device_type as VitalSign['type'],
                            data: vital.data,
                            reading_timestamp: vital.reading_timestamp,
                            device_id: vital.device_id
                        })));
                    }
                } catch (vitalsErr) {
                    console.warn('Vitals refresh failed (non-critical):', vitalsErr);
                }
            } catch (err) {
                console.warn('Profile refresh threw:', err);
                if (!hasCache && isMounted) {
                    setError(err instanceof Error ? err.message : 'Failed to fetch patient data');
                    setLoading(false);
                }
                // If we have cache, do nothing — user keeps seeing valid data.
            }
        };

        fetchPatientData();

        return () => { isMounted = false; };
    }, [user?.id]); // Only depend on user.id to prevent unnecessary re-fetches

    // Set up real-time subscription for vital signs.
    // Depend on the patient ID (a string) — NOT the patientProfile object — so the
    // subscription is created once per patient and not torn down/recreated on every
    // profile re-fetch. A unique channel name avoids duplicate-channel collisions.
    const patientId = patientProfile?.id;
    useEffect(() => {
        if (!patientId) return;

        console.log('🔄 Setting up real-time vital signs subscription for patient:', patientId);

        const channel = supabase
            .channel(`patient_vital_signs_${patientId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'vital_signs',
                    filter: `patient_id=eq.${patientId}`
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
            // removeChannel fully tears down AND unregisters the channel from the
            // client. Plain unsubscribe() leaves it registered → channels leak and
            // eventually break the realtime socket.
            void supabase.removeChannel(channel);
        };
    }, [patientId]);

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
