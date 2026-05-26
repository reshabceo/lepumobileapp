import React from 'react';
import { Button } from '@/components/ui/button';
import { Video, Phone, X } from 'lucide-react';
import { usePatientWebRTCCall } from '@/hooks/usePatientWebRTCCall';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, resolvePatientId } from '@/lib/supabase';
import { useState, useEffect } from 'react';

export const PatientIncomingCallOverlay: React.FC = () => {
  const { user } = useAuth();
  const [patientId, setPatientId] = useState<string | null>(null);

  // Get patient ID from auth user (shared/deduped across all components).
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    resolvePatientId(user.id).then((id) => {
      if (!cancelled && id) setPatientId(id);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  const { incomingCall, acceptCall, declineCall } = usePatientWebRTCCall(patientId);

  if (!incomingCall) {
    return null;
  }

  const handleAcceptCall = async () => {
    await acceptCall();
    // The PatientWebRTCInterface will handle showing the active call
  };

  const handleDeclineCall = async () => {
    await declineCall();
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300" style={{ zIndex: 99999 }}>
      {/* Animated background pulse */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 animate-pulse" />
      
      <div className="relative z-10 text-center text-white mb-12">
        {/* Call Type Icon */}
        <div className="w-40 h-40 rounded-full bg-white/20 backdrop-blur-md mx-auto mb-8 flex items-center justify-center animate-pulse border-4 border-white/30">
          {incomingCall.callType === 'video' ? (
            <Video className="w-20 h-20 text-white" />
          ) : (
            <Phone className="w-20 h-20 text-white" />
          )}
        </div>
        
        {/* Caller Name */}
        <h1 className="text-4xl font-bold mb-4 drop-shadow-lg">{incomingCall.doctorName}</h1>
        
        {/* Call Type Badge */}
        <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-6 py-3 rounded-full mb-6">
          {incomingCall.callType === 'video' ? (
            <>
              <Video className="w-5 h-5" />
              <span className="text-xl font-semibold">Video Call</span>
            </>
          ) : (
            <>
              <Phone className="w-5 h-5" />
              <span className="text-xl font-semibold">Audio Call</span>
            </>
          )}
        </div>
        
        {/* Status Text */}
        <p className="text-lg text-blue-100 animate-pulse">Incoming Call...</p>
      </div>

      {/* Action Buttons */}
      <div className="relative z-10 flex items-center gap-8 mt-8">
        {/* Reject Button */}
        <Button
          size="lg"
          variant="destructive"
          className="rounded-full w-24 h-24 p-0 bg-red-600 hover:bg-red-700 shadow-2xl border-4 border-white/30 animate-in zoom-in duration-300"
          onClick={handleDeclineCall}
        >
          <X className="w-10 h-10" />
        </Button>
        
        {/* Accept Button */}
        <Button
          size="lg"
          className="rounded-full w-24 h-24 p-0 bg-green-600 hover:bg-green-700 shadow-2xl border-4 border-white/30 animate-in zoom-in duration-300 delay-100"
          onClick={handleAcceptCall}
        >
          <Phone className="w-10 h-10" />
        </Button>
      </div>
      
      {/* Call Type Indicator at Bottom */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white/80 text-sm">
        {incomingCall.callType === 'video' 
          ? '📹 Camera and microphone will be used'
          : '🎤 Only microphone will be used'}
      </div>
    </div>
  );
};

export default PatientIncomingCallOverlay;
