import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

  useEffect(() => {
    // Get initial session
    // Get initial session
    const initializeAuth = async () => {
      // Safety timeout: Ensure loading state is eventually released
      const timeoutId = setTimeout(() => {
        setIsLoading(current => {
          if (current) {
            console.warn('⚠️ Auth initialization timed out - forcing release of loading state');
            return false;
          }
          return current;
        });
      }, 8000);

      try {
        const { user, error } = await auth.getCurrentUser();
        if (user && !error) {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          setUser(user);
          setSession(currentSession ?? null);
          console.log('🔍 Auth Debug - Initial user loaded:', user.email);
          
          // Check for doctor in background
          isDoctorByAuthId(user.id).then(async (isDoctor) => {
            if (isDoctor) {
              console.log('🚫 Patient app: doctor detected - signing out');
              await supabase.auth.signOut();
              setUser(null);
              setSession(null);
            }
          });
        } else {
          setUser(null);
          setSession(null);
        }
      } catch (error) {
        console.error('❌ Auth initialization failed:', error);
        setUser(null);
        setSession(null);
      } finally {
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Re-sync session when tab becomes visible (handles tab switching hang)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ App visible - re-syncing auth session');
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
        }
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
          // Optimistically set session if email is confirmed
          if (session.user.email_confirmed_at) {
            setSession(session);
            setUser(session.user);
            
            // Verify role in background
            isDoctorByAuthId(session.user.id).then(async (isDoctor) => {
              if (isDoctor) {
                console.log('🚫 Doctor detected - signing out of patient app');
                await supabase.auth.signOut();
                setSession(null);
                setUser(null);
              }
            });
          }
        } else if (event === 'SIGNED_OUT') {
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