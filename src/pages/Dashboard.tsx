
import React from 'react';
import { MobileAppContainer } from '../components/MobileAppContainer';
import { HealthDashboard } from '../components/HealthDashboard';
import { AppNavigation } from '../components/AppNavigation';

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-[#161B22]">
      {/* Main Content */}
      <MobileAppContainer>
        <HealthDashboard />
      </MobileAppContainer>

      {/* Bottom Navigation */}
      <AppNavigation />
    </div>
  );
};

export default Dashboard;
