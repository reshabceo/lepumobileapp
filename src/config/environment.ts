// Environment configuration for the app
export const ENV = {
  // Development environment
  development: {
    supabase: {
      url: import.meta.env.VITE_SUPABASE_URL || 'https://xktewvqzmbkhnrbwtxjb.supabase.co',
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrdGV3dnF6bWJraG5yYnd0eGpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNjA5NzIsImV4cCI6MjA3MDczNjk3Mn0.ITPI2LGFEWBpQA1oeoAnek6T7Jine6ZFHTTYAXTvPyw'
    },
    debug: import.meta.env.VITE_DEBUG === 'true' || true
  },
  
  // Production environment
  production: {
    supabase: {
      url: import.meta.env.VITE_SUPABASE_URL || 'https://xktewvqzmbkhnrbwtxjb.supabase.co',
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrdGV3dnF6bWJraG5yYnd0eGpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNjA5NzIsImV4cCI6MjA3MDczNjk3Mn0.ITPI2LGFEWBpQA1oeoAnek6T7Jine6ZFHTTYAXTvPyw'
    },
    debug: import.meta.env.VITE_DEBUG === 'true' || false
  }
}

// Get current environment - FIXED for Vite
export const getCurrentEnv = () => {
  const mode = import.meta.env.MODE || 'development'
  console.log('🔍 Environment Debug - Mode:', mode)
  
  if (mode === 'production') {
    console.log('🔍 Environment Debug - Using PRODUCTION config')
    return ENV.production
  }
  
  console.log('🔍 Environment Debug - Using DEVELOPMENT config')
  return ENV.development
}

// Get Supabase config
export const getSupabaseConfig = () => {
  const env = getCurrentEnv()
  return env.supabase
}
