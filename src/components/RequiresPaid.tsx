import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier';

interface Props {
  children: ReactNode;
  featureLabel?: string;
}

export function RequiresPaid({ children, featureLabel }: Props) {
  const { tier, loading } = useSubscriptionTier();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-white/40 text-sm">Loading…</div>
      </div>
    );
  }

  if (tier === 'monitraq_plus') return <>{children}</>;

  // Single upgrade screen rule: redirect all locked routes to subscription page.
  const featureParam = featureLabel ? `?feature=${encodeURIComponent(featureLabel)}` : '';
  const from = `${location.pathname}${location.search || ''}`;
  return <Navigate to={`/subscription${featureParam}`} replace state={{ from }} />;
}
