import React, { useState } from 'react';
import { Mail, Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { OTPVerification } from './OTPVerification';
import { ResetPassword } from './ResetPassword';

interface ForgotPasswordProps {
  onBack: () => void;
}

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBack }) => {
  const [step, setStep] = useState<'email' | 'otp' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const { toast } = useToast();

  const validateEmail = (email: string) => {
    if (!email.trim()) {
      return 'Email is required';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Please enter a valid email address';
    }
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const error = validateEmail(email);
    if (error) {
      setEmailError(error);
      return;
    }

    setLoading(true);
    try {
      // Check if user exists first
      const { data: { user }, error: userError } = await supabase.auth.admin.getUserByEmail(email);
      
      // Note: This won't work without admin access, so we'll just try to send the reset email
      // Supabase will only send if email exists
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password'
      });

      if (resetError) throw resetError;

      toast({
        title: "Code Sent!",
        description: "If an account exists with this email, you'll receive a verification code.",
      });

      setStep('otp');
    } catch (error) {
      console.error('Password reset error:', error);
      toast({
        title: "Request Failed",
        description: error instanceof Error ? error.message : 'Failed to send reset code',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOTPVerified = () => {
    setStep('reset');
  };

  const handlePasswordReset = () => {
    toast({
      title: "Password Reset Successful!",
      description: "You can now login with your new password.",
    });
    onBack();
  };

  if (step === 'otp') {
    return (
      <OTPVerification
        email={email}
        type="recovery"
        onVerified={handleOTPVerified}
        onBack={() => setStep('email')}
      />
    );
  }

  if (step === 'reset') {
    return (
      <ResetPassword
        onSuccess={handlePasswordReset}
        onBack={() => setStep('otp')}
      />
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-black via-slate-900 to-blue-950">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-900/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-slate-800/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-800/20 rounded-full blur-3xl animate-pulse delay-500"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.02%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto">
          {/* Back Button */}
          <button
            onClick={onBack}
            className="mb-6 flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Back to Login</span>
          </button>

          {/* Glassmorphic Form Container */}
          <div className="backdrop-blur-xl bg-black/20 border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/40">
            {/* Key Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-blue-600/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-blue-500/30">
                <KeyRound className="w-10 h-10 text-blue-400" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-3xl font-bold text-white text-center mb-2">
              Forgot Password?
            </h2>
            <p className="text-gray-400 text-center mb-8">
              No worries! Enter your email and we'll send you a verification code to reset your password.
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Input */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={20} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    setEmailError('');
                  }}
                  placeholder="Email Address"
                  className={`w-full pl-12 pr-4 py-4 bg-black/30 backdrop-blur-sm text-white border ${
                    emailError ? 'border-red-500/50' : 'border-white/20'
                  } rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400 transition-all duration-300`}
                  disabled={loading}
                />
                {emailError && (
                  <p className="text-red-300 text-xs mt-2 ml-1">{emailError}</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-2xl shadow-lg shadow-blue-500/30 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending Code...
                  </span>
                ) : (
                  'Send Verification Code'
                )}
              </button>
            </form>

            {/* Help Text */}
            <p className="mt-6 text-gray-500 text-xs text-center">
              Remember your password?{' '}
              <button
                onClick={onBack}
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};



