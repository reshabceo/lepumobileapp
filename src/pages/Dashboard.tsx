
import React from 'react';
import { Navigate } from 'react-router-dom';
import { MobileAppContainer } from '../components/MobileAppContainer';
import { HealthDashboard } from '../components/HealthDashboard';
import { AppNavigation } from '../components/AppNavigation';
import { useDpdpConsent } from '../hooks/useDpdpConsent';

const Dashboard = () => {
  // DPDP Act: required-purpose consent must exist for the active notice
  // version before the patient uses the app.
  const { loading: consentLoading, needsConsent } = useDpdpConsent();
  if (!consentLoading && needsConsent) {
    return <Navigate to="/privacy-consent" replace />;
  }
  return (
    <div className="min-h-screen bg-[#161B22]">
      {/* Main Content */}
      <MobileAppContainer>
        <HealthDashboard />
      </MobileAppContainer>

      {/* Bottom Navigation */}
      {/* <AppNavigation /> */}
    </div>
  );
};

export default Dashboard;
