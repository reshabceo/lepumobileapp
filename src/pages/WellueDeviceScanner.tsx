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
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center gap-4">
        <Button onClick={handleBack} variant="outline" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Device List
        </Button>
        <h1 className="text-2xl font-bold">Wellue BP2 Device Scanner</h1>
      </div>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Important Notice</h3>
        <p className="text-yellow-700 text-sm">
          This scanner uses the <strong>native Wellue Android SDK</strong> for accurate device communication. 
          It will detect real Bluetooth status, monitor device connections, and provide accurate readings.
          <br /><br />
          <strong>Features:</strong>
          • Real Bluetooth status detection<br />
          • Accurate device connection monitoring<br />
          • Real-time battery level updates<br />
          • Proper BP and ECG measurements<br />
          • Full GATT service discovery<br />
          • Device disconnection detection
        </p>
      </div>

      <WellueSDKScanner />
    </div>
  );
};

export default WellueDeviceScanner;
