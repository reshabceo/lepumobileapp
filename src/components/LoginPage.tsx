import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, Activity, Droplets } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { SignupWizard } from './SignupWizard';

export const LoginPage = () => {
  const [isLoginMode, setIsLoginMode] = useState(true);
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
    
    // Clear error when user starts typing
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
      toast({
        title: "Login Failed",
        description: error instanceof Error ? error.message : 'Invalid credentials',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToSignup = () => {
    setIsLoginMode(false);
    setErrors({});
    setFormData({ email: '', password: '' });
  };

  const handleSwitchToLogin = () => {
    setIsLoginMode(true);
    setErrors({});
    setFormData({ email: '', password: '' });
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-black via-slate-900 to-blue-950">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        {/* Floating Orbs - Dark, sophisticated theme */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-900/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-slate-800/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-800/20 rounded-full blur-3xl animate-pulse delay-500"></div>
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.02%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto">
          {/* Logo and Branding Section - Only show during login */}
          {isLoginMode && (
            <div className="text-center mb-12">
              {/* Actual Monitraq Logo - Clean, no color overlay */}
              <div className="flex justify-center items-center mb-6">
                <div className="relative">
                  {/* Logo Container - Simple, elegant, lets logo colors shine */}
                  <div className="w-32 h-32 bg-white/5 backdrop-blur-sm rounded-3xl flex items-center justify-center shadow-2xl shadow-black/40 p-4 border border-white/10">
                    <img
                      src="/monitraq-logo.png"
                      alt="Monitraq Logo"
                      className="w-24 h-24 object-contain"
                    />
                  </div>
                  
                  {/* Subtle floating elements - dark, sophisticated theme */}
                  <div className="absolute -top-2 -right-2 w-3 h-3 bg-blue-600 rounded-full animate-pulse"></div>
                  <div className="absolute -bottom-2 -left-2 w-2 h-2 bg-slate-500 rounded-full animate-pulse delay-1000"></div>
                </div>
              </div>
              
              {/* Brand Name */}
              <h1 className="text-4xl font-bold mb-2">
                <span className="text-white">Monitraq</span>
              </h1>
              
              {/* Tagline */}
              <p className="text-lg text-gray-300 mb-2">
                Smart Health Monitoring
              </p>
              
              {/* Subtitle */}
              <p className="text-gray-400 text-sm">
                Welcome back! Please sign in to continue
              </p>
            </div>
          )}

          {/* Glassmorphic Form Container */}
          <div className="backdrop-blur-xl bg-black/20 border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/40">
            {isLoginMode ? (
              // Login Form
              <form className="space-y-6" onSubmit={handleSubmit}>
                {/* Email Input */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={20} />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Email Address"
                    className={`w-full pl-12 pr-4 py-4 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400 transition-all duration-300 ${
                      errors.email ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''
                    }`}
                    aria-label="Email Address"
                    required
                  />
                  {errors.email && (
                    <p className="text-red-300 text-xs mt-2 ml-1">{errors.email}</p>
                  )}
                </div>

                {/* Password Input */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={20} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Password"
                    className={`w-full pl-12 pr-12 py-4 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400 transition-all duration-300 ${
                      errors.password ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''
                    }`}
                    aria-label="Password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-300 transition-colors duration-200"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                  {errors.password && (
                    <p className="text-red-300 text-xs mt-2 ml-1">{errors.password}</p>
                  )}
                </div>

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-4 rounded-2xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-blue-500 mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>
            ) : (
              // Signup Wizard
              <SignupWizard onSwitchToLogin={handleSwitchToLogin} />
            )}

            {/* Switch between Login and Signup */}
            {isLoginMode ? (
              <div className="text-center mt-8 space-y-4">
                <p className="text-sm text-gray-300">
                  Don't have an account?{' '}
                  <button
                    onClick={handleSwitchToSignup}
                    className="font-medium text-blue-400 hover:text-blue-300 hover:underline focus:outline-none transition-colors duration-200"
                  >
                    Sign up here
                  </button>
                </p>
                <p className="text-sm text-gray-300">
                  Forgot your password?{' '}
                  <button
                    onClick={() => navigate('/reset-password')}
                    className="font-medium text-blue-400 hover:text-blue-300 hover:underline transition-colors duration-200"
                  >
                    Reset here
                  </button>
                </p>
              </div>
            ) : (
              <div className="text-center mt-8">
                <p className="text-sm text-gray-300">
                  Already have an account?{' '}
                  <button
                    onClick={handleSwitchToLogin}
                    className="font-medium text-blue-400 hover:text-blue-300 hover:underline focus:outline-none transition-colors duration-200"
                  >
                    Sign in here
                  </button>
                </p>
              </div>
            )}
          </div>


        </div>
      </div>
    </div>
  );
};
