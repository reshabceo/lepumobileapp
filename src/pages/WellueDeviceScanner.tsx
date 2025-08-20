import React from 'react';
import { WellueSDKScanner } from '@/components/WellueSDKScanner';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const WellueDeviceScanner = () => {
  const navigate = useNavigate();

  const handleBack = () => {
            navigate('/devices');
  };

  return (
    <div className="bg-[#101010] min-h-screen text-white p-4">
      <div className="max-w-sm mx-auto">
        {/* Status Bar Spacing */}
        <div className="h-6"></div>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleBack}
            className="bg-gray-700/80 hover:bg-gray-600 p-2 rounded-lg transition-all duration-200"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-white">Wellue BP2 Scanner</h1>
        </div>

        <WellueSDKScanner />
      </div>
    </div>
  );
};

export default WellueDeviceScanner;
