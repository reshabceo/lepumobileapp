
import React from 'react';
import { MobileAppContainer } from '../components/MobileAppContainer';
import { HealthDashboard } from '../components/HealthDashboard';
import { UserProfile } from '../components/UserProfile';
import { AppNavigation } from '../components/AppNavigation';

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-[#161B22]">
      {/* Header */}
      <header className="bg-[#21262D] border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src="/lovable-uploads/c10ef7ff-117f-45d3-adc9-bb398f6816c8.png"
              alt="Health Logo"
              className="w-8 h-8"
            />
            <h1 className="text-xl font-semibold text-white">Vital Signs Monitor</h1>
          </div>
          <UserProfile />
        </div>
      </header>

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
