import { createClient } from '@supabase/supabase-js'

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables:')
  console.error('VITE_SUPABASE_URL:', supabaseUrl)
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '***' : 'missing')
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
}

console.log('🔍 Supabase Debug - URL:', supabaseUrl)
console.log('🔍 Supabase Debug - Anon Key:', supabaseAnonKey.substring(0, 20) + '...')

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

// Auth helper functions
export const auth = {
  // Sign up
  signUp: async (email: string, password: string, userData: any) => {
    console.log('🔍 Auth Debug - Signing up user:', email)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
        // Email confirmation enabled for patients (same as doctors)
      }
    })

    if (error) {
      console.error('❌ Signup error:', error)
    } else {
      console.log('✅ Signup successful:', data.user?.email)
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

// Database helper functions
export const db = {
  // Get patient profile
  getPatientProfile: async (authUserId: string) => {
    console.log('🔍 DB Debug - Getting patient profile for:', authUserId)

    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('auth_user_id', authUserId)
        .limit(1)

      if (error) {
        console.error('❌ Get patient profile error:', error)
        return { data: null, error }
      }

      // Handle case where no patient found or multiple patients found
      if (!data || data.length === 0) {
        console.log('ℹ️ No patient profile found for user:', authUserId)
        return { data: null, error: null }
      }

      const patientProfile = data[0]
      console.log('✅ Patient profile found:', patientProfile)
      return { data: patientProfile, error: null }

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

  // Assign doctor to patient
  assignDoctorToPatient: async (patientId: string, doctorCode: string) => {
    const { data, error } = await supabase.rpc('assign_doctor_to_patient', {
      patient_id: patientId,
      doctor_code_input: doctorCode
    })

    return { data, error }
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

  // Get patient's assigned doctor
  getPatientDoctor: async (patientId: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
        doctor_id,
        doctor:doctor_id (
          name,
          doctor_code
        )
      `)
      .eq('id', patientId)
      .single()

    return { data, error }
  }
}
