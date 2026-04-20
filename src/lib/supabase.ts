import { createClient } from '@supabase/supabase-js'
import { Capacitor, CapacitorHttp } from '@capacitor/core'

// Get environment variables
// Export Supabase credentials for direct REST uploads when needed (e.g., native file uploads)
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables:')
  console.error('VITE_SUPABASE_URL:', supabaseUrl)
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '***' : 'missing')
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
}

console.log('🔍 Supabase Debug - URL:', supabaseUrl)
console.log('🔍 Supabase Debug - Anon Key:', supabaseAnonKey.substring(0, 20) + '...')

// On some iOS simulator environments, WKWebView fetch can intermittently fail
// with "TypeError: Load failed". To make auth/network calls robust, route
// Supabase requests through Capacitor's native HTTP on native platforms.
const isNative = Capacitor?.isNativePlatform?.() === true

const nativeFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const isReqObj = typeof input !== 'string' && !(input instanceof URL)
  const req = isReqObj ? (input as Request) : undefined
  const url = isReqObj ? req!.url : String(input)
  const method = (init?.method || req?.method || 'GET').toUpperCase()

  // Check if this is a file upload (FormData or Blob/File)
  const isFileUpload = init?.body instanceof FormData || 
                       init?.body instanceof Blob || 
                       init?.body instanceof File ||
                       req?.body instanceof FormData ||
                       req?.body instanceof Blob ||
                       req?.body instanceof File

  // For file uploads on native platforms, use default fetch (Supabase handles it internally)
  // CapacitorHttp doesn't handle FormData/File uploads well, so fallback to default fetch
  if (isFileUpload) {
    console.log('📤 File upload detected - using default fetch for native platform');
    return fetch(input, init);
  }

  // Normalize headers to a plain object
  const headerEntries = new Headers(init?.headers || req?.headers)
  const headers: Record<string, string> = {}
  headerEntries.forEach((value, key) => { headers[key] = value })

  // Parse JSON body when provided as string; CapacitorHttp expects an object for JSON
  let data: any
  if (init?.body) {
    try {
      data = typeof init.body === 'string' ? JSON.parse(init.body) : init.body
    } catch {
      // Fallback to raw string if not JSON
      data = init.body
    }
  }

  const response = await CapacitorHttp.request({ url, method, headers, data })

  // Construct a fetch-compatible Response
  const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
  const respHeaders = new Headers()
  // Copy known headers if available
  if (response.headers) {
    Object.entries(response.headers).forEach(([k, v]) => {
      try { if (typeof v === 'string') respHeaders.set(k, v) } catch { /* no-op */ }
    })
  }
  // Ensure JSON content-type when body is JSON
  if (body && !respHeaders.has('content-type') && typeof response.data !== 'string') {
    respHeaders.set('content-type', 'application/json')
  }

  return new Response(body, { status: response.status, headers: respHeaders })
}

console.log('🔍 Supabase Debug - Using native fetch:', isNative)

// Use Capacitor HTTP on native platforms to fix "TypeError: Load failed" errors
// On web, use default fetch
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: isNative ? nativeFetch : undefined, // Use Capacitor HTTP on native, default fetch on web
  },
  auth: {
    // Use localStorage for both web and native (works on iOS via WKWebView)
    storage: {
      getItem: (key: string) => {
        try {
          return localStorage.getItem(key);
        } catch (error) {
          console.error('❌ [Supabase] localStorage.getItem error:', error);
          return null;
        }
      },
      setItem: (key: string, value: string) => {
        try {
          localStorage.setItem(key, value);
        } catch (error) {
          console.error('❌ [Supabase] localStorage.setItem error:', error);
        }
      },
      removeItem: (key: string) => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.error('❌ [Supabase] localStorage.removeItem error:', error);
        }
      },
    },
    persistSession: true,
    autoRefreshToken: true,
  },
})

// ECG Data Storage Functions
export async function storeEcgRecording(ecgData: {
    patient_id: string;
    device_id?: string;
    recorded_at: string;
    sample_rate: number;
    scale_uv_per_lsb: number;
    duration_seconds: number;
    raw_data_base64?: string;
    mv_data_json?: number[];
    heart_rate?: number;
    quality_score?: number;
    notes?: string;
}) {
    try {
        const { data, error } = await supabase
            .from('ecg_recordings')
            .insert(ecgData);

        if (error) {
            console.error('❌ Failed to store ECG recording:', error);
            throw error;
        }

        console.log('✅ ECG recording stored successfully:', data);
        return data;
    } catch (error) {
        console.error('❌ Error storing ECG recording:', error);
        throw error;
    }
}

// --- AliveCor / Kardia SDK integration ---

const ALIVECOR_BACKEND_URL =
  import.meta.env.VITE_ALIVECOR_BACKEND_URL || 'http://localhost:8000';

/** Use either waveform_mv (single strip / interleaved) or waveform_leads (I–aVF object). */
export interface AliveCorEcgData {
  patient_id: string;
  device_id?: string;
  waveform_mv?: number[];
  /** Per-lead mV samples; use null for gaps. Keys: I, II, III, aVR, aVL, aVF */
  waveform_leads?: Record<string, (number | null)[]>;
  sample_rate: number;
  /** Required for waveform_mv; optional for waveform_leads (derived from length / sample_rate) */
  duration_seconds?: number;
  heart_rate?: number;
  quality_score?: number;
  determination?: string;
  modifier?: string;
  algorithm_package?: string;
  lead_config?: 'single' | 'six';
  device_type?: string;
  is_inverted?: boolean;
  raw_sdk_response?: Record<string, unknown>;
  notes?: string;
}

async function aliveCorFetch(path: string, body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Not authenticated');

  const res = await fetch(`${ALIVECOR_BACKEND_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as { error?: string; detail?: string | string[] };
    const msg =
      errBody.error ||
      (Array.isArray(errBody.detail) ? errBody.detail.join(', ') : errBody.detail) ||
      `AliveCor backend error ${res.status}`;
    throw new Error(msg);
  }
  return res.json();
}

/**
 * Request a Kardia SDK JWT via the AliveCor backend proxy.
 * The backend forwards the request to the kardia-auth-server container.
 */
export async function getAliveCorToken(patientId: string): Promise<string> {
  const result = await aliveCorFetch('/api/alivecor/token', { patientId });
  return result.jwt;
}

/**
 * Store an AliveCor ECG recording through the backend, which writes to
 * ecg_recordings, alivecor_recordings, and vital_signs in Supabase.
 */
export async function storeAliveCorRecording(
  data: AliveCorEcgData
): Promise<{ id: string }> {
  const hasMv = data.waveform_mv && data.waveform_mv.length > 0
  const hasLeads =
    data.waveform_leads && Object.keys(data.waveform_leads).length > 0
  if (!hasMv && !hasLeads) {
    throw new Error('AliveCor ECG: provide waveform_mv or waveform_leads')
  }
  if (hasMv && hasLeads) {
    throw new Error('AliveCor ECG: use only one of waveform_mv or waveform_leads')
  }
  if (hasMv && (data.duration_seconds == null || data.duration_seconds <= 0)) {
    throw new Error('AliveCor ECG: duration_seconds required when using waveform_mv')
  }
  return aliveCorFetch('/api/alivecor/ecg', data as unknown as Record<string, unknown>)
}

// Auth helper functions
export const auth = {
  // Sign up
  signUp: async (email: string, password: string, userData: any) => {
    console.log('🔍 Auth Debug - Signing up user:', email)
    
    // IMPORTANT: Use emailRedirectTo to prevent auto-confirmation
    // This ensures OTP verification is required before user can sign in
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData,
        emailRedirectTo: undefined, // Don't use email link confirmation, use OTP instead
        // Explicitly disable auto-confirm - user must verify OTP
      }
    })

    if (error) {
      console.error('❌ Signup error:', error)
    } else {
      console.log('✅ Signup successful:', data.user?.email)
      console.log('🔍 User confirmed?', data.user?.email_confirmed_at ? 'YES' : 'NO')
      console.log('🔍 Session created?', data.session ? 'YES' : 'NO')
      
      // CRITICAL: If a session was created, sign out immediately
      // This prevents auto-login before OTP verification
      if (data.session) {
        console.log('⚠️ Session created during signup - signing out to prevent auto-login')
        await supabase.auth.signOut()
      }
    }

    return { data, error }
  },

  // Sign in
  signIn: async (email: string, password: string) => {
    console.log('🔍 Auth Debug - Signing in user:', email)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      console.error('❌ Signin error:', error)
    } else {
      console.log('✅ Signin successful:', data.user?.email)
    }

    return { data, error }
  },

  // Sign out
  signOut: async () => {
    console.log('🔍 Auth Debug - Signing out user')
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('❌ Signout error:', error)
    } else {
      console.log('✅ Signout successful')
    }

    return { error }
  },

  // Get current user
  getCurrentUser: async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error) {
        // Handle auth session missing gracefully
        if (error.message && error.message.includes('Auth session missing')) {
          console.log('ℹ️ No active session found (normal on first load)')
          return { user: null, error: null }
        } else {
          console.error('❌ Get user error:', error)
          return { user: null, error }
        }
      } else {
        console.log('🔍 Auth Debug - Current user:', user?.email)
        return { user, error: null }
      }
    } catch (err) {
      // Handle any unexpected errors
      if (err instanceof Error && err.message.includes('Auth session missing')) {
        console.log('ℹ️ No active session found (normal on first load)')
        return { user: null, error: null }
      } else {
        console.error('❌ Get user error:', err)
        return { user: null, error: err }
      }
    }
  },

  // Listen to auth changes
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback)
  }
}

// Check if an auth user is a doctor (patient app must block doctors)
export const isDoctorByAuthId = async (authUserId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('doctors')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (error) {
      console.warn('❌ isDoctor check error:', error);
      return false; // on error, allow through (don't block)
    }
    return !!data;
  } catch {
    return false;
  }
};

// Database helper functions
export const db = {
  // Get patient profile - OPTIMIZED for speed
  getPatientProfile: async (authUserId: string) => {
    try {
      // 🚀 OPTIMIZED: Use .single() for faster query and direct response
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('auth_user_id', authUserId)
        .single() // Faster than limit(1) - returns single object directly

      if (error) {
        // If error is "not found", return null data (not an error)
        if (error.code === 'PGRST116') {
          return { data: null, error: null }
        }
        console.error('❌ Get patient profile error:', error)
        return { data: null, error }
      }

      if (!data) {
        return { data: null, error: null }
      }

      return { data, error: null }

    } catch (err) {
      console.error('❌ Exception getting patient profile:', err)
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to get patient profile'
      }
    }
  },

  // Create patient profile
  createPatientProfile: async (
    authUserId: string,
    fullName: string,
    email: string,
    doctorCode: string,
    additionalData?: {
      dateOfBirth: string;
      gender: string;
      bloodType: string;
      address: string;
      phoneNumber: string;
      emergencyContactName: string;
      emergencyContactPhone: string;
      allergies?: string;
      medicalConditions?: string;
      currentMedications?: string;
      profilePictureUrl?: string;
    }
  ) => {
    console.log('🔍 DB Debug - Creating patient profile:', { authUserId, fullName, email, doctorCode, additionalData })

    try {
      const { data, error } = await supabase.rpc('create_patient_profile_enhanced', {
        auth_user_id: authUserId,
        full_name: fullName,
        email: email,
        doctor_code_input: doctorCode,
        date_of_birth: additionalData?.dateOfBirth || null,
        gender: additionalData?.gender || null,
        blood_type: additionalData?.bloodType || null,
        address: additionalData?.address || null,
        phone_number: additionalData?.phoneNumber || null,
        emergency_contact_name: additionalData?.emergencyContactName || null,
        emergency_contact_phone: additionalData?.emergencyContactPhone || null,
        profile_picture_url: additionalData?.profilePictureUrl || null,
        allergies: additionalData?.allergies ? additionalData.allergies.split(',').map(s => s.trim()).filter(s => s) : null,
        medical_conditions: additionalData?.medicalConditions ? additionalData.medicalConditions.split(',').map(s => s.trim()).filter(s => s) : null,
        current_medications: additionalData?.currentMedications ? additionalData.currentMedications.split(',').map(s => s.trim()).filter(s => s) : null
      })

      if (error) {
        console.error('❌ Create patient profile error:', error)
        return { data: null, error }
      }

      console.log('✅ Patient profile created:', data)
      return { data, error: null }
    } catch (err) {
      console.error('❌ Create patient profile exception:', err)
      return { data: null, error: err }
    }
  },

  // Insert vital signs data
  insertVitalSigns: async (vitalSignsData: any) => {
    // Get current user's patient profile to find assigned doctor
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: new Error('User not authenticated') }
    }

    // Get patient profile to find assigned doctor
    const { data: patientProfile } = await supabase
      .from('patients')
      .select('id, assigned_doctor_id')
      .eq('auth_user_id', user.id)
      .single()

    if (!patientProfile) {
      return { data: null, error: new Error('Patient profile not found') }
    }

    // Add patient_id and doctor_id to vital signs data
    const dataWithPatientAndDoctor = {
      ...vitalSignsData,
      patient_id: patientProfile.id,
      doctor_id: patientProfile.assigned_doctor_id,
      reading_timestamp: vitalSignsData.timestamp || new Date().toISOString()
    }

    // Remove the old timestamp field if it exists
    delete dataWithPatientAndDoctor.timestamp

    const { data, error } = await supabase
      .from('vital_signs')
      .insert(dataWithPatientAndDoctor)
      .select()

    return { data, error }
  },

  // Get vital signs for user
  getUserVitalSigns: async (userId: string, limit = 100) => {
    const { data, error } = await supabase
      .from('vital_signs')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(limit)

    return { data, error }
  },

  // Get vital signs for doctor's patients
  getDoctorPatientsVitalSigns: async (doctorId: string, limit = 100) => {
    const { data, error } = await supabase
      .from('vital_signs')
      .select(`
        *,
        user_profiles!user_id (
          name,
          role
        )
      `)
      .eq('doctor_id', doctorId)
      .order('timestamp', { ascending: false })
      .limit(limit)

    return { data, error }
  },

  // Assign doctor to patient (current schema uses doctors/patients tables)
  assignDoctorToPatient: async (authUserId: string, doctorCode: string) => {
    // 1) lookup doctor by code
    const { data: doctor, error: docErr } = await supabase
      .from('doctors')
      .select('id, doctor_code')
      .eq('doctor_code', doctorCode)
      .single()

    if (docErr || !doctor) {
      return { data: false, error: docErr || new Error('Doctor not found') }
    }

    // 2) update patient's assigned_doctor_id by auth user id
    const { error: updErr } = await supabase
      .from('patients')
      .update({ assigned_doctor_id: doctor.id })
      .eq('auth_user_id', authUserId)

    if (updErr) {
      return { data: false, error: updErr }
    }

    return { data: true, error: null }
  },

  // Generate doctor code for new doctors
  generateDoctorCode: async () => {
    const { data, error } = await supabase.rpc('generate_doctor_code')
    return { data, error }
  },

  // Get doctor's patients
  getDoctorPatients: async (doctorId: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, name, role, created_at')
      .eq('doctor_id', doctorId)
      .eq('role', 'user')

    return { data, error }
  },

  // Get patient's assigned doctor (current schema: patients -> assigned_doctor_id -> doctors)
  getPatientDoctor: async (authUserId: string) => {
    // 1) fetch patient's assigned_doctor_id
    const { data: patientRow, error: patientErr } = await supabase
      .from('patients')
      .select('assigned_doctor_id')
      .eq('auth_user_id', authUserId)
      .single()

    if (patientErr) {
      return { data: null as any, error: patientErr }
    }

    if (!patientRow?.assigned_doctor_id) {
      return { data: { doctor: null }, error: null }
    }

    // 2) fetch doctor info
    const { data: doctorRow, error: doctorErr } = await supabase
      .from('doctors')
      .select('id, full_name, doctor_code')
      .eq('id', patientRow.assigned_doctor_id)
      .single()

    if (doctorErr) {
      return { data: null as any, error: doctorErr }
    }

    return { data: { doctor: doctorRow }, error: null }
  }
}
