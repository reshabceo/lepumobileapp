import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { auth, db, supabase, isDoctorByAuthId } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (
    email: string,
    password: string,
    name: string,
    doctorCode?: string,
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
  ) => Promise<boolean>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Tracks which user id we've already run the doctor-role check for, so token
  // refreshes don't re-fire the DB query (and the state churn) on every event.
  const doctorCheckedIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Get initial session
    // Get initial session
    const initializeAuth = async () => {
      try {
        // getSession reads from localStorage — fast, no network call unless token expired
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          setUser(currentSession.user);
          setSession(currentSession);
        } else {
          setUser(null);
          setSession(null);
        }
      } catch (error) {
        console.error('❌ [Auth] Initialization error:', error);
        setUser(null);
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Re-sync session when tab becomes visible — read localStorage directly to avoid
    // acquiring the Supabase GoTrueClient lock (which blocks all concurrent DB queries)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        try {
          const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
          if (key) {
            const stored = JSON.parse(localStorage.getItem(key) || 'null');
            if (stored?.access_token && stored?.user && stored?.expires_at) {
              if (Date.now() < stored.expires_at * 1000) {
                // Only swap state when the token ACTUALLY changed. Setting a fresh
                // user object on every focus forces every user-dependent hook to
                // re-run and fire a burst of queries — which is what wedges the
                // Supabase client after the tab has been idle.
                setSession(prev => (prev && prev.access_token === stored.access_token ? prev : stored));
                setUser(prev => (prev && prev.id === stored.user.id ? prev : stored.user));
              }
            }
          }
        } catch (e) { /* ignore parse errors */ }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen to auth changes
    const { data: { subscription } } = auth.onAuthStateChange(async (event, session) => {
      console.log('🔍 Auth Debug - Auth state change:', event, session?.user?.email);

      try {
        const awaitingOTP = localStorage.getItem('awaiting_otp_verification') === 'true';
        
        if (event === 'SIGNED_UP' || (event === 'SIGNED_IN' && awaitingOTP && !session?.user?.email_confirmed_at)) {
          if (session) await supabase.auth.signOut();
          setIsLoading(false);
          return;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          // Optimistically set session if email is confirmed.
          if (session.user.email_confirmed_at) {
            // Keep the same object reference when the user/token is unchanged so a
            // background token refresh (which also fires SIGNED_IN) doesn't churn
            // every user-dependent hook.
            setSession(prev => (prev && prev.access_token === session.access_token ? prev : session));
            setUser(prev => (prev && prev.id === session.user.id ? prev : session.user));

            // Verify role only once per user id (not on every refresh event).
            if (doctorCheckedIdRef.current !== session.user.id) {
              doctorCheckedIdRef.current = session.user.id;
              isDoctorByAuthId(session.user.id).then(async (isDoctor) => {
                if (isDoctor) {
                  console.log('🚫 Doctor detected - signing out of patient app');
                  await supabase.auth.signOut();
                  setSession(null);
                  setUser(null);
                }
              });
            }
          }
        } else if (event === 'SIGNED_OUT') {
          doctorCheckedIdRef.current = null;
          setSession(null);
          setUser(null);
        }
      } catch (err) {
        console.error('❌ Error handling auth state change:', err);
      } finally {
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      console.log('🔍 Auth Debug - Attempting login with Supabase:', email);

      const { data, error } = await auth.signIn(email, password);

      if (error) {
        console.error('❌ Supabase login error:', error);
        throw error;
      }

      if (data.user) {
        const isDoctor = await isDoctorByAuthId(data.user.id);
        if (isDoctor) {
          console.log('🚫 Patient app: doctor login blocked - signing out');
          await supabase.auth.signOut();
          const err = new Error('This app is for patients only. Doctors must use the doctor portal.');
          (err as Error & { code?: string }).code = 'DOCTOR_NOT_ALLOWED';
          throw err;
        }
        setUser(data.user);
        setSession(data.session);
        console.log('✅ Supabase login successful:', data.user.email);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (
    email: string,
    password: string,
    name: string,
    doctorCode?: string,
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
  ): Promise<boolean> => {
    try {
      // CRITICAL: Check if flag is set before starting signup
      const awaitingOTP = localStorage.getItem('awaiting_otp_verification') === 'true';
      console.log('🔍 Auth Debug - Signup called, awaitingOTP flag:', awaitingOTP);
      
      setIsLoading(true);
      console.log('🔍 Auth Debug - Attempting signup with Supabase:', email, name);

      // IMPORTANT: Use OTP-based signup (not email confirmation links)
      // auth.signUp expects 3 arguments: email, password, userData
      const userData = {
        name: name,
        doctor_code: doctorCode || '',
        ...additionalData
      };
      
      const { data, error } = await auth.signUp(email, password, userData);

      if (error) {
        console.error('❌ Supabase signup error:', error);
        throw error;
      }

      if (data.user) {
        console.log('📧 OTP verification code sent to:', email);
        console.log('🔍 User confirmed?', data.user.email_confirmed_at ? 'YES' : 'NO');
        console.log('🔍 Session created?', data.session ? 'YES' : 'NO');
        
        // CRITICAL: If Supabase created a session during signup, sign out immediately
        // This prevents auto-login before OTP verification
        if (data.session) {
          console.log('⚠️ Session detected during signup - signing out to prevent auto-login');
          await supabase.auth.signOut();
        }
        
        // Store doctor code and additional data in localStorage for after OTP verification
        if (doctorCode) {
          localStorage.setItem('pending_doctor_code', doctorCode);
          localStorage.setItem('pending_user_name', name);
          if (additionalData) {
            localStorage.setItem('pending_patient_data', JSON.stringify(additionalData));
          }
        }

        // Do NOT set user or session here
        // The user needs to verify OTP first
        return true; // Signup successful, OTP sent
      }
      return false;
    } catch (error) {
      console.error('❌ Signup failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      console.log('🔍 Auth Debug - Attempting logout from Supabase');
      const { error } = await auth.signOut();

      if (error) {
        console.error('❌ Supabase logout error:', error);
        throw error;
      }

      setUser(null);
      setSession(null);
      console.log('✅ Supabase logout successful');
    } catch (error) {
      console.error('❌ Logout failed:', error);
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const value: AuthContextType = {
    user,
    session,
    isAuthenticated: !!user,
    isLoading,
    login,
    signup,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};