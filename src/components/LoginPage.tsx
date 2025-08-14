import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { SignupForm } from './SignupForm';

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
    <div className="bg-[#161B22] min-h-screen flex flex-col items-center justify-center font-sans p-4">
      <div className="w-full max-w-xs mx-auto">
        {/* Logo and Subtitle Section */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center mb-2">
            <img
              src="/lovable-uploads/c10ef7ff-117f-45d3-adc9-bb398f6816c8.png"
              alt="Health Logo"
              className="w-40 h-auto"
            />
          </div>
          <p className="text-gray-400 text-sm">
            {isLoginMode ? 'Please sign in to continue' : 'Create your account'}
          </p>
        </div>

        <div className="bg-[#161B22] p-4 rounded-lg">
          {isLoginMode ? (
            // Login Form
            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* Email Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="text-gray-500" size={20} />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Email Address"
                  className={`w-full pl-12 pr-4 py-3 bg-[#21262D] text-white border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-500 ${
                    errors.email ? 'border-red-500' : 'border-gray-700'
                  }`}
                  aria-label="Email Address"
                  required
                />
                {errors.email && (
                  <p className="text-red-400 text-xs mt-1 ml-1">{errors.email}</p>
                )}
              </div>

              {/* Password Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="text-gray-500" size={20} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Password"
                  className={`w-full pl-12 pr-12 py-3 bg-[#21262D] text-white border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-500 ${
                    errors.password ? 'border-red-500' : 'border-gray-700'
                  }`}
                  aria-label="Password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
                {errors.password && (
                  <p className="text-red-400 text-xs mt-1 ml-1">{errors.password}</p>
                )}
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#238636] text-white font-semibold py-3 rounded-lg hover:bg-[#2EA043] transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#161B22] focus:ring-green-500 mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
            // Signup Form
            <SignupForm onSwitchToLogin={handleSwitchToLogin} />
          )}

          {/* Switch between Login and Signup */}
          {isLoginMode && (
            <div className="text-center mt-6 space-y-3">
              <p className="text-sm text-gray-500">
                Don't have an account?{' '}
                <button
                  onClick={handleSwitchToSignup}
                  className="font-medium text-[#58A6FF] hover:underline focus:outline-none"
                >
                  Sign up here
                </button>
              </p>
              <p className="text-sm text-gray-500">
                Forgot your password?{' '}
                <a href="#" className="font-medium text-[#58A6FF] hover:underline">
                  Reset here
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
