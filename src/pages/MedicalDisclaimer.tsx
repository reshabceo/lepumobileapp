import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Heart, Stethoscope, Shield } from 'lucide-react';
import { MobileAppContainer } from '../components/MobileAppContainer';

const MedicalDisclaimer = () => {
  const navigate = useNavigate();

  return (
    <MobileAppContainer>
      <div className="bg-[#161B22] min-h-screen text-white font-inter">
        <div className="max-w-sm mx-auto min-h-screen bg-[#1C2128] flex flex-col relative">
          
          {/* Status Bar Spacing */}
          <div className="h-6"></div>
          
          {/* Header */}
          <header className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center">
              <button onClick={() => navigate(-1)} className="text-gray-300 hover:text-white">
                <ArrowLeft size={24} />
              </button>
              <AlertTriangle size={24} className="mx-3 text-yellow-400" />
              <h1 className="text-lg font-semibold text-white">Medical Disclaimer</h1>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-grow p-5 overflow-y-auto">
            <div className="space-y-6">
              {/* Important Notice */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-yellow-400 flex-shrink-0 mt-1" />
                  <div>
                    <h2 className="text-lg font-semibold text-yellow-300 mb-2">Important Medical Notice</h2>
                    <p className="text-yellow-200/90 text-sm leading-relaxed">
                      This app is designed to assist with health monitoring and should not replace professional medical advice, diagnosis, or treatment.
                    </p>
                  </div>
                </div>
              </div>

              {/* Disclaimer Sections */}
              <div className="space-y-4">
                <div className="bg-[#2D333B] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Stethoscope className="h-5 w-5 text-teal-400" />
                    <h3 className="text-base font-semibold text-white">Consult Your Doctor</h3>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition. Never disregard professional medical advice or delay in seeking it because of something you have read or seen in this app.
                  </p>
                </div>

                <div className="bg-[#2D333B] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Heart className="h-5 w-5 text-red-400" />
                    <h3 className="text-base font-semibold text-white">Not for Emergency Use</h3>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    This app is not intended for use in emergency situations. If you think you may have a medical emergency, call your doctor or emergency services immediately.
                  </p>
                </div>

                <div className="bg-[#2D333B] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="h-5 w-5 text-blue-400" />
                    <h3 className="text-base font-semibold text-white">Medical Device Disclaimer</h3>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    This app connects to external medical hardware devices (blood pressure monitors, ECG devices, etc.). The accuracy of readings depends on proper device usage, calibration, and user technique. Always verify readings with your healthcare provider and follow manufacturer instructions for device use.
                  </p>
                </div>

                <div className="bg-[#2D333B] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-orange-400" />
                    <h3 className="text-base font-semibold text-white">Regulatory Information</h3>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-2">
                    The medical devices used with this app may have regulatory clearance in specific jurisdictions. Please ensure that any medical device you use complies with local regulations and has appropriate regulatory approval for use in your region.
                  </p>
                  <p className="text-gray-400 text-xs leading-relaxed italic">
                    For information about regulatory clearance of specific devices, please consult the device manufacturer or your healthcare provider.
                  </p>
                </div>

                <div className="bg-[#2D333B] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="h-5 w-5 text-purple-400" />
                    <h3 className="text-base font-semibold text-white">Data Accuracy</h3>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    While we strive to provide accurate information and reliable device connectivity, we cannot guarantee the accuracy, completeness, or timeliness of any information in this app. Medical conditions and treatments vary by individual, and information that may be appropriate for one person may not be appropriate for another.
                  </p>
                </div>
              </div>

              {/* Final Notice */}
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-200 text-sm leading-relaxed font-medium">
                  <strong className="text-red-300">By using this app, you acknowledge that:</strong>
                </p>
                <ul className="text-red-200/90 text-sm mt-3 space-y-2 list-disc list-inside">
                  <li>You understand this app is not a substitute for professional medical care</li>
                  <li>You will consult with qualified healthcare professionals before making medical decisions</li>
                  <li>You will use medical devices according to manufacturer instructions</li>
                  <li>You understand that device readings should be verified by healthcare professionals</li>
                </ul>
              </div>
            </div>
          </main>
        </div>
      </div>
    </MobileAppContainer>
  );
};

export default MedicalDisclaimer;

