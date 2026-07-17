import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, Activity, Droplets } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { SignupWizard } from './SignupWizard';
import { ForgotPassword } from './ForgotPassword';
import { MobileAppContainer } from './MobileAppContainer';

export const LoginPage = () => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();

  // Initialize mode from localStorage on mount to prevent remounts
  React.useEffect(() => {
    const awaitingOTP = localStorage.getItem('awaiting_otp_verification') === 'true';
    if (awaitingOTP && mode === 'login') {
      console.log('🔄 LoginPage - Initializing mode to signup from localStorage on mount');
      setMode('signup');
    }
  }, []); // Only run on mount
  
  // Prevent mode switching during signup flow (but don't cause remounts)
  React.useEffect(() => {
    const awaitingOTP = localStorage.getItem('awaiting_otp_verification') === 'true';
    if (awaitingOTP && mode !== 'signup') {
      console.log('⚠️ LoginPage - Signup flow detected but mode is not signup, fixing...');
      requestAnimationFrame(() => {
        setMode('signup');
      });
    }
  }, [mode]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const success = await login(formData.email, formData.password);
      
      if (success) {
        toast({
          title: "Login Successful",
          description: "Welcome back!",
        });
        navigate('/dashboard');
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Invalid credentials';
      const friendly =
        /failed to fetch|network|timeout|load failed/i.test(message)
          ? 'Network error. Please check your connection and try again.'
          : message;
      toast({
        title: "Login Failed",
        description: friendly,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToSignup = () => {
    setMode('signup');
    setErrors({});
    setFormData({ email: '', password: '' });
  };

  const handleSwitchToLogin = () => {
    setMode('login');
    setErrors({});
    setFormData({ email: '', password: '' });
  };

  const handleSwitchToForgot = () => {
    setMode('forgot');
    setErrors({});
    setFormData({ email: '', password: '' });
  };

  // Helper template for background
  const pageBackground = (
    <div className="absolute inset-0 pointer-events-none">
      {/* Premium Floating Orbs - constrained beautifully */}
      <div className="absolute top-10 left-10 w-44 h-44 bg-indigo-900/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-56 h-56 bg-purple-900/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-blue-900/15 rounded-full blur-3xl animate-pulse delay-500"></div>
      
      {/* Soft overlay grids */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.02%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-30"></div>
    </div>
  );

  if (mode === 'forgot') {
    return (
      <MobileAppContainer>
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-[#131024] to-slate-950 font-inter flex flex-col pt-safe-top">
          {pageBackground}
          <div className="relative z-10 flex-grow flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm mx-auto">
              <ForgotPassword onBack={handleSwitchToLogin} embedded={true} />
            </div>
          </div>
        </div>
      </MobileAppContainer>
    );
  }

  return (
    <MobileAppContainer>
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-[#131024] to-slate-950 font-inter flex flex-col pt-safe-top">
        {pageBackground}

        {/* Main Content Viewport */}
        <div className="relative z-10 flex-grow flex flex-col justify-center p-4">
          <div className="w-full max-w-sm mx-auto">
            
            {/* Logo and Branding (Clean elegance) */}
            {mode === 'login' && (
              <div className="text-center mb-6">
                <div className="flex justify-center items-center mb-4">
                  <div className="relative">
                    <div className="w-24 h-24 bg-white/5 backdrop-blur-sm rounded-3xl flex items-center justify-center shadow-xl border border-white/10 p-3">
                      <img
                        src="/monitraq-logo.png"
                        alt="Monitraq Logo"
                        className="w-18 h-18 object-contain"
                      />
                    </div>
                    {/* Tiny blinking green status notification */}
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse border-2 border-slate-950"></div>
                  </div>
                </div>
                
                <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-100 bg-clip-text text-transparent">
                  Monitraq
                </h1>
                <p className="text-xs text-indigo-300 font-medium mt-1">Smart Health Monitoring</p>
                <p className="text-[11px] text-gray-400 mt-2">Welcome back! Sign in to continue</p>
              </div>
            )}

            {/* Single Unified Card Layout */}
            {mode === 'signup' ? (
              <div className="backdrop-blur-xl bg-black/40 border border-white/10 rounded-3xl p-5 shadow-2xl">
                <SignupWizard 
                  onSwitchToLogin={handleSwitchToLogin}
                  embedded={true}
                />
              </div>
            ) : mode === 'login' ? (
              <div className="backdrop-blur-xl bg-black/40 border border-white/10 rounded-3xl p-5 shadow-2xl space-y-5">
                <form className="space-y-4" onSubmit={handleSubmit}>
                  
                  {/* Email Input */}
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="text-gray-400 group-focus-within:text-blue-400 transition-colors" size={18} />
                    </div>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Email Address"
                      className={`w-full pl-11 pr-4 py-3.5 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-500 transition-all text-sm ${
                        errors.email ? 'border-red-500/50' : ''
                      }`}
                      aria-label="Email Address"
                      required
                    />
                    {errors.email && (
                      <p className="text-red-300 text-xs mt-1.5 ml-1">{errors.email}</p>
                    )}
                  </div>

                  {/* Password Input */}
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="text-gray-400 group-focus-within:text-blue-400 transition-colors" size={18} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Password"
                      className={`w-full pl-11 pr-11 py-3.5 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-500 transition-all text-sm ${
                        errors.password ? 'border-red-500/50' : ''
                      }`}
                      aria-label="Password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    {errors.password && (
                      <p className="text-red-300 text-xs mt-1.5 ml-1">{errors.password}</p>
                    )}
                  </div>

                  {/* Sign In Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3.5 rounded-2xl hover:from-blue-700 hover:to-indigo-700 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 text-sm mt-5"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4.5 w-4.5 animate-spin" />
                        <span>Signing In...</span>
                      </>
                    ) : (
                      <span>Sign In</span>
                    )}
                  </button>
                </form>

                {/* Switch between Login and Signup */}
                <div className="text-center pt-3 border-t border-white/5 space-y-2">
                  <p className="text-xs text-gray-300">
                    Don't have an account?{' '}
                    <button
                      onClick={handleSwitchToSignup}
                      className="font-bold text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                    >
                      Sign up here
                    </button>
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Forgot your password?{' '}
                    <button
                      onClick={handleSwitchToForgot}
                      className="font-bold text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                    >
                      Reset here
                    </button>
                  </p>
                </div>
              </div>
            ) : null}

          </div>
        </div>
      </div>
    </MobileAppContainer>
  );
};
