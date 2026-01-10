import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, X, User } from 'lucide-react';
import { usePatientWebRTCCall } from '@/hooks/usePatientWebRTCCall';
import { useAuth } from '@/contexts/AuthContext';

interface PatientWebRTCInterfaceProps {
  patientId: string;
  onCallEnd?: () => void;
}

export const PatientWebRTCInterface: React.FC<PatientWebRTCInterfaceProps> = ({
  patientId,
  onCallEnd
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  const {
    incomingCall,
    activeCall,
    acceptCall,
    declineCall,
    endCall,
    localStream,
    remoteStream,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
    connectionState
  } = usePatientWebRTCCall(patientId);

  // Set up local video
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Set up remote video
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Play ringtone for incoming call
  useEffect(() => {
    if (incomingCall) {
      // Create audio element for ringtone
      ringtoneRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OWhUBELTKXh8bllHgU2jdXvypQxByZ6x+/glEILE16y5+ypWBUIQ5zd8L9pJAUuhM/y2Ik3CBlsu/Ho0qVcFQ1NoOHwuWUdBTWN1e/KlDEHJnrH7+CUQgsUXrLn7KlZFQhDnN3wv2kkBS6Ez/HYijYIG2y77eeNRBMMUKvn7qRcFQ1NouDvuGEcBjaN1+/KlDIIJnrH7+GUQgsUX7Hn7KlYFQlDnN3wv2kkBS6Ez/HYijYIG2y67eeMRBMMUKvn7qRcFQ1NouDvuGEcBjaN1+/KlDIIJnrH7+GUQgsUX7Hn7KlYFQlDnN3wv2kkBS+Ez/HYijcHG2y77eeNRRMMT6zn7qRcFQ1NouDvuGEcBjaN1+/KlDIHJnrH7+GUQgsUX7Hn7KlYFQlCnN3wv2kkBS+Ez/HYijcHG2y77eeNRRMMT6zn7qRcFQ1NouDvuGEcBjaN1+/KlDIHJnrH7+GUQgsUX7Hn7KlYFQlCnN3wv2kkBS+Ez/HYijcHG2y77eeNRRMMT6zn7qRcFQ1NouDvuGEcBjaN1+/KlDIHJnrH7+GUQgsUX7Hn7KlYFQlCnN3wv2kkBS+Ez/HYijcHG2y77eeNRRMMT6zn7qRcFQ1NouDvuGEcBjaN1+/KlDIHJnrH7+GUQgsUX7Hn7KlYFQlCnN3wv2kkBS+Ez/HYijcHG2y77eeNRRMMT6zn7qRcFQ1NouDvuGEcBjaN1+/KlDIHJnrH7+GUQgsUX7Hn7KlYFQlCnN3wv2kkBS+Ez/HYijcHG2y77eeNRRMMT6zn7qRcFQ1NouDvuGEcBjaN1+/KlDIHJnrH7+GUQgsUX7Hn7KlYFQlCnN3wv2kkBS+Ez/HYijcHG2y77eeNRRMMT6zn7qRcFQ1NouDvuGEcBjaN1+/KlDIHJnrH7+GUQgsUX7Hn7KlYFQlCnN3wv2kkBS+Ez/HYijcHG2y77eeNRRMMT6zn7qRcFQ1NouDvuGEcBjaN1+/KlDIHJnrH7+GUQgsUX7Hn7KlYFQlCnN3wv2kkBS+Ez/HYijcHG2y77eeNRRMMT6zn7qRcFQ1NouDvuGEcBjaN1+/KlDIHJnrH7+GUQgsUX7Hn7KlYFQlCnN3wv2kkBS+Ez/HYijcHG2y77eeNRRMMT6zn7qRcFQ1NouDvuGEcBjaN1+/KlDIHJnrH7+GUQgsUX7Hn7KlYFQlCnN3wv2kkBS+Ez/HYijcHG2y77eeNRRMMT6zn7qRcFQ1NouDvuGEcBjaN1+/KlDIHJnrH7+GUQgsUX7Hn7KlYFQlCnN3wv2kkBS+Ez/HYijcHG2y77eeNRRMMT6zn7qRcFQ1NouDvuGEcBjaN1+/KlDIHJnrH7+GUQgsUX7Hn7KlYFQlCnN3wv2kkBS+Ez/HYijcHG2y77eeNRRMMT6zn7qRcFQ1NouDvuGEcBjaN1+/KlDIHJnrH7+GUQgsUX7Hn7KlYFQlCnN3wv2kkBS+Ez/HYijcHG2y77eeNRRMMT6zn7qRcFQ1NouDvuGEcBjaN1+/KlDIHJnrH7+GUQgsUX7Hn7KlYFQlCnN3wv2kkBS+Ez/HYijcHG2y77eeNRRMMT6zn7qRcFQ1NouDvuGEcBjaN1+/KlDIHJnrH7+GUQg==');
      ringtoneRef.current.loop = true;
      ringtoneRef.current.play().catch(e => console.log('Cannot play ringtone:', e));

      return () => {
        if (ringtoneRef.current) {
          ringtoneRef.current.pause();
          ringtoneRef.current = null;
        }
      };
    }
  }, [incomingCall]);

  const handleEndCall = async () => {
    await endCall();
    if (onCallEnd) {
      onCallEnd();
    }
  };

  const handleAcceptCall = async () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
    }
    await acceptCall();
  };

  const handleDeclineCall = async () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
    }
    await declineCall();
  };

  // Show incoming call screen
  if (incomingCall && !activeCall) {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-blue-600 to-blue-800 flex flex-col items-center justify-center p-6">
        <div className="text-center text-white mb-8">
          <div className="w-32 h-32 rounded-full bg-white/20 mx-auto mb-6 flex items-center justify-center animate-pulse">
            <User className="w-16 h-16" />
          </div>
          <h1 className="text-3xl font-bold mb-2">{incomingCall.doctorName}</h1>
          <p className="text-xl text-blue-100">
            Incoming {incomingCall.callType} call
          </p>
        </div>

        <div className="flex space-x-6 mt-8">
          <Button
            size="lg"
            variant="destructive"
            className="rounded-full w-20 h-20 p-0 bg-red-500 hover:bg-red-600"
            onClick={handleDeclineCall}
          >
            <X className="w-8 h-8" />
          </Button>
          <Button
            size="lg"
            className="rounded-full w-20 h-20 p-0 bg-green-500 hover:bg-green-600"
            onClick={handleAcceptCall}
          >
            <Phone className="w-8 h-8" />
          </Button>
        </div>
      </div>
    );
  }

  // Show active call screen
  if (activeCall) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900">
        {/* Remote Video (Main) */}
        <div className="absolute inset-0">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-800">
              <div className="text-center text-white">
                <div className="w-24 h-24 rounded-full bg-gray-700 mx-auto mb-4 flex items-center justify-center">
                  <User className="w-12 h-12 text-gray-400" />
                </div>
                <p className="text-xl">{activeCall.doctorName}</p>
                <p className="text-gray-400 mt-2">
                  {activeCall.status === 'ringing' && 'Calling...'}
                  {activeCall.status === 'connected' && 'Connecting video...'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Local Video (PiP) */}
        {activeCall.callType === 'video' && localStream && (
          <div className="absolute top-4 right-4 w-32 h-44 bg-gray-800 rounded-lg overflow-hidden shadow-2xl border-2 border-white/20 z-10">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover transform -scale-x-100"
            />
            <div className="absolute bottom-1 left-1 bg-black/60 px-2 py-1 rounded text-xs text-white">
              You
            </div>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-lg text-white z-10">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              activeCall.status === 'connected' ? 'bg-green-500 animate-pulse' :
              activeCall.status === 'ringing' ? 'bg-yellow-500 animate-pulse' :
              'bg-gray-500'
            }`} />
            <span className="text-sm">
              {activeCall.status === 'connected' && 'Connected'}
              {activeCall.status === 'ringing' && 'Calling'}
            </span>
          </div>
        </div>

        {/* Doctor Info */}
        <div className="absolute top-16 left-4 text-white z-10">
          <p className="text-lg font-semibold">{activeCall.doctorName}</p>
          <p className="text-sm text-gray-300">
            {activeCall.callType === 'video' ? 'Video Call' : 'Audio Call'}
          </p>
        </div>

        {/* Call Controls */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
          <Card className="bg-black/80 backdrop-blur-lg border-white/10 px-4 py-3">
            <div className="flex items-center space-x-3">
              {/* Microphone Toggle */}
              <Button
                size="lg"
                variant={isAudioEnabled ? "secondary" : "destructive"}
                className="rounded-full w-12 h-12 p-0"
                onClick={toggleAudio}
              >
                {isAudioEnabled ? (
                  <Mic className="w-5 h-5" />
                ) : (
                  <MicOff className="w-5 h-5" />
                )}
              </Button>

              {/* Camera Toggle (only for video calls) */}
              {activeCall.callType === 'video' && (
                <Button
                  size="lg"
                  variant={isVideoEnabled ? "secondary" : "destructive"}
                  className="rounded-full w-12 h-12 p-0"
                  onClick={toggleVideo}
                >
                  {isVideoEnabled ? (
                    <Video className="w-5 h-5" />
                  ) : (
                    <VideoOff className="w-5 h-5" />
                  )}
                </Button>
              )}

              {/* End Call */}
              <Button
                size="lg"
                variant="destructive"
                className="rounded-full w-12 h-12 p-0 bg-red-600 hover:bg-red-700"
                onClick={handleEndCall}
              >
                <PhoneOff className="w-5 h-5" />
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // No call active
  return null;
};

export default PatientWebRTCInterface;
