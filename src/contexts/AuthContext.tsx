import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, db } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
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
          console.error('❌ Auth initialization error:', error);
        }
      } catch (error) {
        console.error('❌ Auth initialization failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen to auth changes
    const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
      console.log('🔍 Auth Debug - Auth state change:', event, session?.user?.email);
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

  const signup = async (email: string, password: string, name: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      console.log('🔍 Auth Debug - Attempting signup with Supabase:', email, name);
      
      const { data, error } = await auth.signUp(email, password, { name });
      
      if (error) {
        console.error('❌ Supabase signup error:', error);
        throw error;
      }
      
      if (data.user) {
        setUser(data.user);
        setSession(data.session);
        
        // Create user profile in user_profiles table
        try {
          const { error: profileError } = await db.updateUserProfile(data.user.id, {
            name: name,
            role: 'user'
          });
          
          if (profileError) {
            console.error('❌ Profile creation error:', profileError);
          } else {
            console.log('✅ User profile created successfully');
          }
        } catch (profileError) {
          console.error('❌ Profile creation failed:', profileError);
        }
        
        console.log('✅ Supabase signup successful:', data.user.email);
        return true;
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
