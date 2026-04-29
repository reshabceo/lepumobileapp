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
  const [showTimeout, setShowTimeout] = React.useState(false);
  const location = useLocation();

  // Check if we're in the middle of signup flow
  const awaitingOTP = localStorage.getItem('awaiting_otp_verification') === 'true';
  const fromOTPVerification = localStorage.getItem('from_otp_verification') === 'true';
  const isInSignupFlow = awaitingOTP || fromOTPVerification;
  
  // Debug logging
  if (isInSignupFlow) {
    console.log('🛡️ ProtectedRoute - Signup flow detected, preventing redirect', { awaitingOTP, fromOTPVerification, isAuthenticated, requireAuth });
  }

  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoading) {
      timer = setTimeout(() => {
        setShowTimeout(true);
      }, 10000); // 10 seconds timeout
    } else {
      setShowTimeout(false);
    }
    return () => clearTimeout(timer);
  }, [isLoading]);

  const handleRefresh = () => {
    window.location.reload();
  };

  // Show loading spinner while checking authentication
  if (isLoading) {
    if (showTimeout) {
      return (
        <div className="bg-[#101010] min-h-screen text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#1A1A1A] border border-red-500/20 rounded-2xl p-8 text-center shadow-2xl shadow-red-500/10">
            <div className="bg-red-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Loader2 className="h-10 w-10 text-red-500" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Application Request Timeout</h3>
            <p className="text-gray-400 mb-8 leading-relaxed">
              The application is taking longer than usual to load. This might be due to a poor connection or session sync issue.
            </p>
            <button
              onClick={handleRefresh}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
              Reload App Properly
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#101010] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-green-500 mx-auto" />
          <div className="flex flex-col items-center">
            <p className="text-xl font-bold text-white tracking-tight">Loading Session...</p>
            <p className="text-gray-400 text-sm mt-1">This may take a moment</p>
          </div>
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
