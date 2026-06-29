import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Heart, Stethoscope, Shield, ExternalLink } from 'lucide-react';
import { MobileAppContainer } from '../components/MobileAppContainer';

const MedicalDisclaimer = () => {
  const navigate = useNavigate();

  return (
    <MobileAppContainer>
      <div className="bg-[#161B22] min-h-screen text-white font-inter">
        <div className="max-w-sm mx-auto min-h-screen bg-[#1C2128] flex flex-col relative">
          
          <div className="h-6"></div>
          
          <header className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center">
              <button onClick={() => navigate(-1)} className="text-gray-300 hover:text-white">
                <ArrowLeft size={24} />
              </button>
              <AlertTriangle size={24} className="mx-3 text-yellow-400" />
              <h1 className="text-lg font-semibold text-white">Medical Disclaimer</h1>
            </div>
          </header>

          <main className="flex-grow p-5 overflow-y-auto pb-10">
            <div className="space-y-6">
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-yellow-400 flex-shrink-0 mt-1" />
                  <div>
                    <h2 className="text-lg font-semibold text-yellow-300 mb-2">Important Medical Notice</h2>
                    <p className="text-yellow-200/90 text-sm leading-relaxed">
                      Monitraq assists with remote health monitoring. It does not replace professional medical advice, diagnosis, or treatment.
                    </p>
                  </div>
                </div>
              </div>

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
                    <Shield className="h-5 w-5 text-teal-400" />
                    <h3 className="text-base font-semibold text-white">Distribution & Jurisdiction</h3>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">
                    Monitraq is distributed on the App Store in the <strong className="text-white">United States</strong> and <strong className="text-white">India</strong> only. Supported medical hardware in this app is intended for use in regions where the device manufacturer holds applicable regulatory clearance.
                  </p>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Do not use a connected device unless it is cleared for use in your country. Regulatory documentation for supported hardware (AliveCor Kardia, Wellue BP2, O2 Ring) is available to App Review on request.
                  </p>
                </div>

                {/* AliveCor */}
                <div className="bg-[#2D333B] rounded-lg p-4">
                  <h3 className="text-base font-semibold text-white mb-2">AliveCor KardiaMobile 6L</h3>
                  <p className="text-gray-300 text-sm leading-relaxed mb-2">
                    FDA-cleared (United States) personal ECG device for detection of Atrial Fibrillation, Bradycardia, and Tachycardia. CE Marked for use in applicable European markets. Intended for use under physician guidance.
                  </p>
                  <a
                    href="https://alivecor.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-400 text-sm inline-flex items-center gap-1 hover:text-teal-300"
                  >
                    AliveCor manufacturer information <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Wellue BP2 */}
                <div className="bg-[#2D333B] rounded-lg p-4">
                  <h3 className="text-base font-semibold text-white mb-2">Wellue BP2 (Blood Pressure & ECG)</h3>
                  <p className="text-gray-300 text-sm leading-relaxed mb-2">
                    Wireless blood pressure monitor with optional ECG capability. Intended for wellness and home monitoring. Follow manufacturer instructions for cuff placement and measurement. Verify clinically significant readings with a healthcare professional.
                  </p>
                  <a
                    href="https://www.viatom.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-400 text-sm inline-flex items-center gap-1 hover:text-teal-300"
                  >
                    Viatom / Wellue manufacturer information <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* O2 Ring */}
                <div className="bg-[#2D333B] rounded-lg p-4">
                  <h3 className="text-base font-semibold text-white mb-2">Wellue O2 Ring (Pulse Oximeter)</h3>
                  <p className="text-gray-300 text-sm leading-relaxed mb-2">
                    Continuous SpO2 and pulse rate monitor for wellness tracking. Accuracy may be affected by motion, perfusion, and sensor fit. Not a substitute for clinical pulse oximetry in acute care.
                  </p>
                  <a
                    href="https://www.viatom.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-400 text-sm inline-flex items-center gap-1 hover:text-teal-300"
                  >
                    Viatom / Wellue manufacturer information <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="bg-[#2D333B] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="h-5 w-5 text-blue-400" />
                    <h3 className="text-base font-semibold text-white">Medical Information Sources</h3>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">
                    Default vital alert thresholds and health references in the app are based on publicly available clinical guidance:
                  </p>
                  <ul className="text-sm text-gray-300 space-y-2">
                    <li>
                      <a href="https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300 inline-flex items-center gap-1">
                        AHA — Blood pressure readings <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                    <li>
                      <a href="https://www.heart.org/en/health-topics/arrhythmia/about-arrhythmia/tachycardia" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300 inline-flex items-center gap-1">
                        AHA — Tachycardia <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                    <li>
                      <a href="https://www.who.int/health-topics/pulse-oximetry" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300 inline-flex items-center gap-1">
                        WHO — Pulse oximetry <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                  </ul>
                </div>

                <div className="bg-[#2D333B] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="h-5 w-5 text-blue-400" />
                    <h3 className="text-base font-semibold text-white">Medical Device Disclaimer</h3>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    This app connects to external medical hardware devices. The accuracy of readings depends on proper device usage, calibration, and user technique. Always verify readings with your healthcare provider and follow manufacturer instructions.
                  </p>
                </div>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-200 text-sm leading-relaxed font-medium">
                  <strong className="text-red-300">By using this app, you acknowledge that:</strong>
                </p>
                <ul className="text-red-200/90 text-sm mt-3 space-y-2 list-disc list-inside">
                  <li>You understand this app is not a substitute for professional medical care</li>
                  <li>You will consult with qualified healthcare professionals before making medical decisions</li>
                  <li>You will use medical devices according to manufacturer instructions</li>
                  <li>You understand that device readings should be verified by healthcare professionals</li>
                  <li>You are using medical hardware cleared for use in your specific jurisdiction (US or India)</li>
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
