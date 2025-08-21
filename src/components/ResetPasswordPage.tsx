import React, { useState } from 'react';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

export const ResetPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password-confirm`,
      });

      if (error) {
        throw error;
      }

      setEmailSent(true);
      toast({
        title: "Reset Email Sent",
        description: "Check your email for password reset instructions",
      });
    } catch (error) {
      console.error('Password reset error:', error);
      setError(error instanceof Error ? error.message : 'Failed to send reset email');
      toast({
        title: "Reset Failed",
        description: "Unable to send password reset email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/');
  };

  if (emailSent) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-black via-slate-900 to-blue-950">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-900/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-slate-800/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-800/20 rounded-full blur-3xl animate-pulse delay-500"></div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md mx-auto text-center">
            {/* Success Icon */}
            <div className="flex justify-center items-center mb-8">
              <div className="w-24 h-24 bg-green-500/20 backdrop-blur-sm rounded-3xl flex items-center justify-center border border-green-500/30">
                <CheckCircle className="w-12 h-12 text-green-400" />
              </div>
            </div>

            {/* Success Message */}
            <h1 className="text-3xl font-bold text-white mb-4">
              Check Your Email
            </h1>
            
            <p className="text-lg text-gray-300 mb-6">
              We've sent password reset instructions to:
            </p>
            
            <div className="bg-black/20 backdrop-blur-sm p-4 rounded-2xl border border-white/10 mb-8">
              <p className="text-blue-400 font-mono text-lg break-all">{email}</p>
            </div>

            <p className="text-gray-400 mb-8">
              Click the link in your email to reset your password. If you don't see it, check your spam folder.
            </p>

            {/* Action Buttons */}
            <div className="space-y-4">
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-4 rounded-2xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Mail className="w-5 h-5" />
                Resend Email
              </button>

              <button
                onClick={handleBackToLogin}
                className="w-full bg-white/10 backdrop-blur-sm text-white font-semibold py-4 rounded-2xl hover:bg-white/20 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-white/50 border border-white/20"
              >
                <ArrowLeft className="w-5 h-5 inline mr-2" />
                Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-black via-slate-900 to-blue-950">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-900/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-slate-800/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-800/20 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <button
              onClick={handleBackToLogin}
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-200 mb-6"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Login
            </button>

            <h1 className="text-3xl font-bold text-white mb-2">
              Reset Password
            </h1>
            
            <p className="text-gray-400 text-sm">
              Enter your email address and we'll send you a link to reset your password
            </p>
          </div>

          {/* Reset Form */}
          <div className="backdrop-blur-xl bg-black/20 border border-white/20 rounded-3xl p-8 shadow-2xl shadow-black/20">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Email Input */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={20} />
                </div>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className={`w-full pl-12 pr-4 py-4 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400 transition-all duration-300 ${
                    error ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''
                  }`}
                  aria-label="Email Address"
                  required
                />
                {error && (
                  <p className="text-red-300 text-xs mt-2 ml-1">{error}</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-4 rounded-2xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-blue-500 mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Sending Reset Email...
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5" />
                    Send Reset Email
                  </>
                )}
              </button>
            </form>

            {/* Additional Info */}
            <div className="text-center mt-6">
              <p className="text-sm text-gray-400">
                Remember your password?{' '}
                <button
                  onClick={handleBackToLogin}
                  className="font-medium text-blue-400 hover:text-blue-300 hover:underline focus:outline-none transition-colors duration-200"
                >
                  Sign in here
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
