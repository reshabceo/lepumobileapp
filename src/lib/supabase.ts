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
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.error('❌ Get user error:', error)
    } else {
      console.log('🔍 Auth Debug - Current user:', user?.email)
    }
    
    return { user, error }
  },

  // Listen to auth changes
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback)
  }
}

// Database helper functions
export const db = {
  // Get user profile
  getUserProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    return { data, error }
  },

  // Update user profile
  updateUserProfile: async (userId: string, updates: any) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)
    
    return { data, error }
  },

  // Insert vital signs data
  insertVitalSigns: async (vitalSignsData: any) => {
    const { data, error } = await supabase
      .from('vital_signs')
      .insert(vitalSignsData)
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
  }
}
