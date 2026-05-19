import React, { useState } from 'react';
import { Mail, Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { OTPVerification } from './OTPVerification';
import { ResetPassword } from './ResetPassword';

interface ForgotPasswordProps {
  onBack: () => void;
  embedded?: boolean;
}

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBack, embedded = false }) => {
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
      // Send password reset email with OTP
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
        embedded={embedded}
      />
    );
  }

  if (step === 'reset') {
    return (
      <ResetPassword
        onSuccess={handlePasswordReset}
        onBack={() => setStep('otp')}
        embedded={embedded}
      />
    );
  }

  const forgotPasswordContent = (
    <div className={embedded ? "space-y-4" : "space-y-6"}>
      {/* Key Icon */}
      <div className="flex justify-center">
        <div className={`${embedded ? "w-14 h-14" : "w-20 h-20"} bg-blue-600/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-blue-500/30`}>
          <KeyRound className={`${embedded ? "w-7 h-7" : "w-10 h-10"} text-blue-400`} />
        </div>
      </div>

      {/* Title */}
      <h2 className={`${embedded ? "text-xl" : "text-3xl"} font-bold text-white text-center mb-1`}>
        Forgot Password?
      </h2>
      <p className="text-gray-400 text-center text-xs mb-5 px-2">
        Enter your email and we'll send you a verification code to reset your password.
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email Input */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Mail className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={18} />
          </div>
          <input
            type="email"
            value={email}
            onChange={e => {
              setEmail(e.target.value);
              setEmailError('');
            }}
            placeholder="Email Address"
            className={`w-full pl-11 pr-4 py-3.5 bg-black/30 backdrop-blur-sm text-white border ${
              emailError ? 'border-red-500/50' : 'border-white/20'
            } rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-500 transition-all duration-300 text-sm`}
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
          className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-2xl shadow-lg shadow-blue-500/30 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending Code...
            </span>
          ) : (
            'Send Verification Code'
          )}
        </button>
      </form>

      {/* Help Text */}
      <p className="mt-5 text-gray-500 text-xs text-center">
        Remember your password?{' '}
        <button
          onClick={onBack}
          className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
        >
          Sign In
        </button>
      </p>
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} />
          <span>Back to Login</span>
        </button>

        <div className="backdrop-blur-xl bg-black/40 border border-white/10 rounded-3xl p-5 shadow-2xl">
          {forgotPasswordContent}
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
            {forgotPasswordContent}
          </div>
        </div>
      </div>
    </div>
  );
};
