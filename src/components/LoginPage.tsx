import React, { useState } from 'react';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiService from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export const LoginPage = () => {
  const [savePassword, setSavePassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: 'test@test.com', // Pre-filled for demo
    password: 'qweqwe' // Pre-filled for demo
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  // Auto-login bypass for testing
  React.useEffect(() => {
    const autoLogin = async () => {
      try {
        // Simulate successful login
        const mockResponse = {
          success: true,
          token: 'mock-token-for-testing',
          user: {
            id: 'user-001',
            email: 'test@test.com',
            name: 'Dr. Smith',
            role: 'doctor'
          }
        };

        // Store the token
        apiService.setToken(mockResponse.token);

        // Show success message
        toast({
          title: "Auto Login Successful",
          description: `Welcome back, ${mockResponse.user?.name || 'Doctor'}! (Bypass Mode)`,
        });

        // Navigate to dashboard
        navigate('/dashboard');
      } catch (error) {
        console.error('Auto login failed:', error);
      }
    };

    // Auto-login after 1 second
    const timer = setTimeout(autoLogin, 1000);
    return () => clearTimeout(timer);
  }, [navigate, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiService.login(formData);

      if (response.success && response.token) {
        // Store the token
        apiService.setToken(response.token);

        // Show success message
        toast({
          title: "Login Successful",
          description: `Welcome back, ${response.user?.name || 'Doctor'}!`,
        });

        // Navigate to dashboard
        navigate('/dashboard');
      } else {
        throw new Error(response.error || 'Login failed');
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
          <p className="text-gray-400 text-sm">Please sign in to continue</p>
          
          {/* Auto-login bypass indicator */}
          <div className="mt-4 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-400 text-sm font-medium">🚀 Auto-Login Bypass Active</p>
            <p className="text-yellow-300 text-xs">Redirecting to dashboard in 1 second...</p>
          </div>
        </div>

        <div className="bg-[#161B22] p-4 rounded-lg">

          {/* Form Inputs */}
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
                className="w-full pl-12 pr-4 py-3 bg-[#21262D] text-white border border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-500"
                aria-label="Email Address"
                required
              />
            </div>

            {/* Password Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="text-gray-500" size={20} />
              </div>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Password"
                className="w-full pl-12 pr-4 py-3 bg-[#21262D] text-white border border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-500"
                aria-label="Password"
                required
              />
            </div>

            {/* Save Password Checkbox */}
            <div className="flex items-center pt-1">
              <input
                id="save-password"
                type="checkbox"
                checked={savePassword}
                onChange={() => setSavePassword(!savePassword)}
                className="w-4 h-4 text-green-500 bg-gray-800 border-gray-600 rounded focus:ring-green-600 cursor-pointer"
                style={{
                  boxShadow: 'none',
                }}
              />
              <label htmlFor="save-password" className="ml-2 text-sm font-medium text-gray-400 cursor-pointer">
                Save Password
              </label>
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

          {/* Demo Credentials & Forgot Password */}
          <div className="text-center mt-6 space-y-3">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <div className="text-xs text-blue-400 font-semibold mb-1">Demo Credentials</div>
              <div className="text-xs text-gray-300">
                Email: test@test.com<br />
                Password: qweqwe
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Forgot your password?{' '}
              <a href="#" className="font-medium text-[#58A6FF] hover:underline">
                Reset here
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
