import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, db, supabase } from '@/lib/supabase';
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
    const initializeAuth = async () => {
      try {
        const { user, error } = await auth.getCurrentUser();
        if (user && !error) {
          setUser(user);
          setSession(session);
          console.log('🔍 Auth Debug - Initial user loaded:', user.email);
        } else if (error) {
          // Handle specific auth errors gracefully
          if (error.message && error.message.includes('Auth session missing')) {
            console.log('ℹ️ No active session found (normal on first load)');
          } else {
            console.error('❌ Auth initialization error:', error);
          }
          setUser(null);
          setSession(null);
        }
      } catch (error) {
        // Handle session missing errors gracefully
        if (error instanceof Error && error.message.includes('Auth session missing')) {
          console.log('ℹ️ No active session found (normal on first load)');
        } else {
          console.error('❌ Auth initialization failed:', error);
        }
        setUser(null);
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen to auth changes
    const { data: { subscription } } = auth.onAuthStateChange(async (event, session) => {
      console.log('🔍 Auth Debug - Auth state change:', event, session?.user?.email);

      if (event === 'SIGNED_IN' && session?.user) {
        // Check if this is after email confirmation
        const pendingDoctorCode = localStorage.getItem('pending_doctor_code');
        const pendingUserName = localStorage.getItem('pending_user_name');
        const pendingPatientDataStr = localStorage.getItem('pending_patient_data');

        if (pendingDoctorCode && pendingUserName && session.user.email_confirmed_at) {
          console.log('📧 Email confirmed! Creating patient profile...');

          try {
            let pendingPatientData = null;
            if (pendingPatientDataStr) {
              try {
                pendingPatientData = JSON.parse(pendingPatientDataStr);
              } catch (e) {
                console.error('Error parsing pending patient data:', e);
              }
            }

            // Create patient profile now that email is confirmed
            const { data: profileResult, error: profileError } = await db.createPatientProfile(
              session.user.id,
              pendingUserName,
              session.user.email || '',
              pendingDoctorCode,
              pendingPatientData
            );

            if (profileError || !profileResult || !profileResult.success) {
              console.error('❌ Patient profile creation error after email confirmation:', profileError);
            } else {
              console.log('✅ Patient profile created after email confirmation:', profileResult);
            }

            // Clean up temporary storage
            localStorage.removeItem('pending_doctor_code');
            localStorage.removeItem('pending_user_name');
            localStorage.removeItem('pending_patient_data');
          } catch (err) {
            console.error('❌ Failed to create patient profile after email confirmation:', err);
          }
        }
      }

      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
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
      setIsLoading(true);
      console.log('🔍 Auth Debug - Attempting signup with Supabase:', email, name);

      const { data, error } = await auth.signUp(email, password, { name });

      if (error) {
        console.error('❌ Supabase signup error:', error);
        throw error;
      }

      if (data.user) {
        // For email confirmation flow, we don't set user/session immediately
        // The user will need to confirm their email first

        if (!data.user.email_confirmed_at) {
          console.log('📧 Email confirmation required. Check your inbox.');

          // Store doctor code and additional data temporarily for after email confirmation
          if (doctorCode) {
            localStorage.setItem('pending_doctor_code', doctorCode);
            localStorage.setItem('pending_user_name', name);
            if (additionalData) {
              localStorage.setItem('pending_patient_data', JSON.stringify(additionalData));
            }
          }

          return true; // Signup successful, but email confirmation needed
        } else {
          // Email already confirmed (shouldn't happen on new signup)
          setUser(data.user);
          setSession(data.session);
          console.log('✅ Email already confirmed, user logged in');
          return true;
        }
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
