import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  redirectTo = '/'
}) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Check if we're in the middle of signup flow
  const awaitingOTP = localStorage.getItem('awaiting_otp_verification') === 'true';
  const fromOTPVerification = localStorage.getItem('from_otp_verification') === 'true';
  const isInSignupFlow = awaitingOTP || fromOTPVerification;
  
  // Debug logging
  if (isInSignupFlow) {
    console.log('🛡️ ProtectedRoute - Signup flow detected, preventing redirect', { awaitingOTP, fromOTPVerification, isAuthenticated, requireAuth });
  }

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#161B22] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-green-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If authentication is required and user is not authenticated
  if (requireAuth && !isAuthenticated) {
    // Redirect to login page, but save the attempted location
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // If user is authenticated but trying to access login page, redirect to dashboard
  // BUT: Don't redirect if we're in the middle of signup/OTP verification flow
  if (!requireAuth && isAuthenticated && !isInSignupFlow) {
    return <Navigate to="/dashboard" replace />;
  }

  // User is authenticated and can access the protected route
  return <>{children}</>;
};
