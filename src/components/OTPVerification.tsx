import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface OTPVerificationProps {
  email: string;
  type: 'signup' | 'recovery';
  onVerified: () => void;
  onBack: () => void;
}

export const OTPVerification: React.FC<OTPVerificationProps> = ({
  email,
  type,
  onVerified,
  onBack
}) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    // Countdown timer for resend button
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (newOtp.every(digit => digit !== '')) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    
    // Check if pasted data is 6 digits
    if (/^\d{6}$/.test(pastedData)) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      inputRefs.current[5]?.focus();
      // Auto-submit
      handleVerify(pastedData);
    }
  };

  const handleVerify = async (otpCode: string) => {
    setLoading(true);
    try {
      if (type === 'signup') {
        // Verify email OTP for signup
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: otpCode,
          type: 'signup'
        });

        if (error) throw error;

        if (data.session) {
          toast({
            title: "Email Verified!",
            description: "Your account has been successfully verified.",
          });
          onVerified();
        }
      } else {
        // Verify recovery OTP for password reset
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: otpCode,
          type: 'recovery'
        });

        if (error) throw error;

        if (data.session) {
          toast({
            title: "Code Verified!",
            description: "Please set your new password.",
          });
          onVerified();
        }
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : 'Invalid or expired code',
        variant: "destructive",
      });
      // Clear OTP on error
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setResending(true);
    try {
      if (type === 'signup') {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
      }

      toast({
        title: "Code Resent!",
        description: "A new verification code has been sent to your email.",
      });
      setTimer(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (error) {
      toast({
        title: "Resend Failed",
        description: error instanceof Error ? error.message : 'Failed to resend code',
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>

        {/* Glassmorphic Form Container */}
        <div className="backdrop-blur-xl bg-black/20 border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/40">
          {/* Email Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-blue-600/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-blue-500/30">
              <Mail className="w-10 h-10 text-blue-400" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-white text-center mb-2">
            Verify Your Email
          </h2>
          <p className="text-gray-400 text-center mb-8">
            We've sent a 6-digit code to<br />
            <span className="text-blue-400 font-medium">{email}</span>
          </p>

          {/* OTP Input */}
          <div className="flex gap-3 justify-center mb-8">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={el => inputRefs.current[index] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleOtpChange(index, e.target.value)}
                onKeyDown={e => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                className="w-14 h-14 text-center text-2xl font-bold bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300"
                disabled={loading}
              />
            ))}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center gap-2 mb-6">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              <span className="text-gray-400">Verifying...</span>
            </div>
          )}

          {/* Resend Button */}
          <div className="text-center mb-6">
            {timer > 0 ? (
              <p className="text-gray-400 text-sm">
                Resend code in <span className="text-blue-400 font-medium">{timer}s</span>
              </p>
            ) : (
              <button
                onClick={handleResendOTP}
                disabled={resending}
                className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {resending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </span>
                ) : (
                  'Resend Code'
                )}
              </button>
            )}
          </div>

          {/* Help Text */}
          <p className="text-gray-500 text-xs text-center">
            Didn't receive the code? Check your spam folder or click resend.
          </p>
        </div>
      </div>
    </div>
  );
};

