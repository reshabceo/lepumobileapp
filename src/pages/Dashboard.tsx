
import React from 'react';
import { MobileAppContainer } from '../components/MobileAppContainer';
import { HealthDashboard } from '../components/HealthDashboard';

const Dashboard = () => {
  return (
    <MobileAppContainer>
      <HealthDashboard />
      {/* Debug: Direct navigation to new BP monitor */}
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => window.location.href = '/live-bp-monitor'}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg"
        >
          New BP Monitor
        </button>
      </div>
    </MobileAppContainer>
  );
};

export default Dashboard;
