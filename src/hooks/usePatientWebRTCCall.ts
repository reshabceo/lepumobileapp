import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebRTC } from './useWebRTC';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { getWebRTCServerURL } from '@/config/webrtc';

export interface IncomingCall {
  id: string;
  doctorId: string;
  doctorName: string;
  callType: 'video' | 'audio';
  offer: RTCSessionDescriptionInit;
}

export interface ActiveCall {
  id: string;
  doctorId: string;
  doctorName: string;
  callType: 'video' | 'audio';
  status: 'ringing' | 'connected' | 'ended';
  startedAt: Date;
  endedAt?: Date;
  canReconnect?: boolean;
}

interface UsePatientWebRTCCallReturn {
  incomingCall: IncomingCall | null;
  activeCall: ActiveCall | null;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  initiateEmergencyCall: (doctorId: string, doctorName: string) => Promise<void>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  toggleAudio: () => void;
  toggleVideo: () => void;
  connectionState: string;
}

const WS_URL = getWebRTCServerURL();

export const usePatientWebRTCCall = (patientId: string | null): UsePatientWebRTCCallReturn => {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const reconnectAttemptRef = useRef<number>(0);

  const {
    localStream,
    remoteStream,
    isAudioEnabled,
    isVideoEnabled,
    connectionState,
    initializeMedia,
    createAnswer,
    createOffer,
    setRemoteDescription,
    addIceCandidate,
    toggleAudio,
    toggleVideo,
    cleanup,
    onIceCandidate,
    onTrack
  } = useWebRTC();

  // Check for existing call on mount (reconnection support)
  useEffect(() => {
    if (!patientId) return;
    
    const savedCall = localStorage.getItem('webrtc_active_call');
    if (savedCall) {
      try {
        const callData = JSON.parse(savedCall);
        console.log('[Patient WebRTC] 🔄 Found saved call, attempting reconnection...', callData);
        
        setActiveCall({
          ...callData,
          canReconnect: true,
          status: 'ringing'
        });
      } catch (error) {
        console.error('[Patient WebRTC] Failed to parse saved call:', error);
        localStorage.removeItem('webrtc_active_call');
      }
    }
  }, [patientId]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!patientId) return;

    console.log('[Patient WebRTC] 🔌 Connecting to signaling server...');
    const ws = new WebSocket(WS_URL);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('[Patient WebRTC] ✅ WebSocket connected');
      // Login to signaling server
      ws.send(JSON.stringify({
        type: 'LOGIN',
        userId: `patient_${patientId}`,
        userType: 'patient',
        userName: 'Patient' // You can get actual name from context
      }));
      
      // Check if we need to reconnect to an existing call
      const savedCall = localStorage.getItem('webrtc_active_call');
      if (savedCall && activeCall?.canReconnect) {
        try {
          const callData = JSON.parse(savedCall);
          console.log('[Patient WebRTC] 🔄 Attempting to reconnect to call:', callData.id);
          
          // Request reconnection data from server
          ws.send(JSON.stringify({
            type: 'RECONNECT',
            userId: `patient_${patientId}`,
            callId: callData.id
          }));
        } catch (error) {
          console.error('[Patient WebRTC] Failed to reconnect:', error);
          localStorage.removeItem('webrtc_active_call');
        }
      }
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[Patient WebRTC] 📨 Received message:', data.type);

        switch (data.type) {
          case 'LOGIN_SUCCESS':
            console.log('[Patient WebRTC] ✅ Logged in to signaling server');
            break;

          case 'OFFER':
            // Incoming call from doctor
            console.log('[Patient WebRTC] 📞 Incoming call from doctor');
            const newIncomingCall = {
              id: data.callId,
              doctorId: data.from.replace('doctor_', ''),
              doctorName: data.doctorName || 'Doctor',
              callType: data.callType || 'video',
              offer: data.offer
            };
            
            setIncomingCall(newIncomingCall);
            
            // Save to localStorage for reconnection
            localStorage.setItem('webrtc_active_call', JSON.stringify({
              id: data.callId,
              doctorId: newIncomingCall.doctorId,
              doctorName: newIncomingCall.doctorName,
              callType: newIncomingCall.callType,
              status: 'ringing',
              startedAt: new Date().toISOString()
            }));
            
            // Show notification
            toast.info(`Incoming ${data.callType} call from ${data.doctorName || 'Doctor'}`);
            
            // Update call status in database
            if (data.callId) {
              await supabase
                .from('video_calls')
                .update({ status: 'ringing' })
                .eq('id', data.callId);
            }
            break;

          case 'RECONNECT_DATA':
            // Handle reconnection data
            console.log('[Patient WebRTC] 🔄 Received reconnection data');
            if (data.call && activeCall?.canReconnect) {
              // Reinitialize media
              const isVideoCall = data.call.callType === 'video';
              await initializeMedia(isVideoCall, true);
              
              // Recreate the answer
              if (data.call.offer) {
                const answer = await createAnswer(data.call.offer);
                if (answer && socketRef.current?.readyState === WebSocket.OPEN) {
                  socketRef.current.send(JSON.stringify({
                    type: 'ANSWER',
                    from: `patient_${patientId}`,
                    to: `doctor_${activeCall.doctorId}`,
                    answer,
                    callId: activeCall.id
                  }));
                }
              }
              
              // Add stored ICE candidates
              if (data.call.candidates) {
                for (const candidate of data.call.candidates) {
                  await addIceCandidate(candidate);
                }
              }
              
              setActiveCall(prev => prev ? { ...prev, status: 'connected', canReconnect: false } : null);
              toast.success('Reconnected to call');
            }
            break;

          case 'RECONNECT_FAILED':
            console.log('[Patient WebRTC] ❌ Reconnection failed');
            localStorage.removeItem('webrtc_active_call');
            setActiveCall(null);
            toast.error('Could not reconnect to call');
            break;

          case 'ICE':
            // Received ICE candidate
            if (data.candidate) {
              if (activeCall?.status === 'connected') {
                await addIceCandidate(data.candidate);
              } else {
                // Store for later if call not yet connected
                pendingIceCandidatesRef.current.push(data.candidate);
              }
            }
            break;

          case 'END_CALL':
          case 'CALL_ENDED':
            console.log('[Patient WebRTC] 📞 Call ended by doctor');
            toast.info('Doctor ended the call');
            await handleCallEnd();
            break;

          case 'USER_OFFLINE':
            console.log('[Patient WebRTC] ❌ Doctor is offline');
            toast.error('Doctor is not available');
            await handleCallEnd();
            break;

          default:
            console.log('[Patient WebRTC] ℹ️  Unhandled message type:', data.type);
        }
      } catch (error) {
        console.error('[Patient WebRTC] ❌ Error processing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[Patient WebRTC] ❌ WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('[Patient WebRTC] 📴 WebSocket disconnected');
      if (activeCall) {
        toast.error('Connection lost');
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [patientId]);

  // Setup ICE candidate handler
  useEffect(() => {
    onIceCandidate((candidate) => {
      if (socketRef.current?.readyState === WebSocket.OPEN && activeCall) {
        console.log('[Patient WebRTC] 📤 Sending ICE candidate to doctor');
        socketRef.current.send(JSON.stringify({
          type: 'ICE',
          from: `patient_${patientId}`,
          to: `doctor_${activeCall.doctorId}`,
          candidate: candidate.toJSON()
        }));
      }
    });
  }, [onIceCandidate, activeCall, patientId]);

  // Setup track handler
  useEffect(() => {
    onTrack((stream) => {
      console.log('[Patient WebRTC] 📺 Remote stream received');
      toast.success('Video connected!');
    });
  }, [onTrack]);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!incomingCall || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      toast.error('Cannot accept call');
      return;
    }

    try {
      console.log('[Patient WebRTC] ✅ Accepting call...');

      // For audio calls, NEVER request video - only audio
      const isVideoCall = incomingCall.callType === 'video';
      console.log(`[Patient WebRTC] Call type: ${incomingCall.callType}, requesting video: ${isVideoCall}`);
      
      // Initialize media - video only if it's a video call
      const mediaReady = await initializeMedia(isVideoCall, true);
      
      if (!mediaReady) {
        toast.error('Failed to access microphone');
        return;
      }

      // Create answer to the offer
      const answer = await createAnswer(incomingCall.offer);
      if (!answer) {
        toast.error('Failed to create answer');
        return;
      }

      // Send answer to doctor with callId
      socketRef.current.send(JSON.stringify({
        type: 'ANSWER',
        from: `patient_${patientId}`,
        to: `doctor_${incomingCall.doctorId}`,
        answer,
        callId: incomingCall.id
      }));

      // Add pending ICE candidates
      for (const candidate of pendingIceCandidatesRef.current) {
        await addIceCandidate(candidate);
      }
      pendingIceCandidatesRef.current = [];

      // Update call state
      const newActiveCall = {
        id: incomingCall.id,
        doctorId: incomingCall.doctorId,
        doctorName: incomingCall.doctorName,
        callType: incomingCall.callType,
        status: 'connected' as const,
        startedAt: new Date()
      };
      
      setActiveCall(newActiveCall);
      setIncomingCall(null);
      
      // Save to localStorage for reconnection support
      localStorage.setItem('webrtc_active_call', JSON.stringify({
        ...newActiveCall,
        startedAt: newActiveCall.startedAt.toISOString()
      }));

      // Update call status in database
      await supabase
        .from('video_calls')
        .update({ 
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', incomingCall.id);

      toast.success('Call connected!');
    } catch (error) {
      console.error('[Patient WebRTC] ❌ Error accepting call:', error);
      toast.error('Failed to accept call');
    }
  }, [incomingCall, patientId, initializeMedia, createAnswer, addIceCandidate]);

  // Decline incoming call
  const declineCall = useCallback(async () => {
    if (!incomingCall || !socketRef.current) {
      return;
    }

    try {
      console.log('[Patient WebRTC] ❌ Declining call...');

      // Notify doctor
      if (socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'DECLINE_CALL',
          from: `patient_${patientId}`,
          to: `doctor_${incomingCall.doctorId}`,
          callId: incomingCall.id
        }));
      }

      // Update call status in database
      await supabase
        .from('video_calls')
        .update({ 
          status: 'declined',
          ended_at: new Date().toISOString()
        })
        .eq('id', incomingCall.id);

      setIncomingCall(null);
      localStorage.removeItem('webrtc_active_call');
      toast.info('Call declined');
    } catch (error) {
      console.error('[Patient WebRTC] ❌ Error declining call:', error);
    }
  }, [incomingCall, patientId]);

  // End active call - ONLY when user explicitly clicks end button
  const endCall = useCallback(async () => {
    if (!activeCall) return;

    console.log('[Patient WebRTC] 🔚 User clicked End Call button');

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      // Notify doctor via WebSocket
      socketRef.current.send(JSON.stringify({
        type: 'END_CALL',
        from: `patient_${patientId}`,
        to: `doctor_${activeCall.doctorId}`,
        callId: activeCall.id
      }));
    }

    await handleCallEnd();
  }, [activeCall, patientId]);

  // Handle call end (cleanup) - ONLY called when user explicitly ends
  const handleCallEnd = useCallback(async () => {
    if (activeCall) {
      // Update call in database
      const endTime = new Date();
      const duration = activeCall.startedAt 
        ? Math.floor((endTime.getTime() - activeCall.startedAt.getTime()) / 1000)
        : 0;

      await supabase
        .from('video_calls')
        .update({
          status: 'ended',
          ended_at: endTime.toISOString(),
          call_duration: duration
        })
        .eq('id', activeCall.id);
    }

    // Cleanup
    cleanup();
    setActiveCall(null);
    setIncomingCall(null);
    pendingIceCandidatesRef.current = [];
    localStorage.removeItem('webrtc_active_call');

    toast.info('Call ended');
  }, [activeCall, cleanup]);

  // Initiate emergency call to doctor
  const initiateEmergencyCall = useCallback(async (
    doctorId: string,
    doctorName: string
  ) => {
    if (!patientId || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      toast.error('Cannot initiate call - not connected');
      return;
    }

    try {
      console.log('[Patient WebRTC] 🚨 Initiating emergency call...');

      // Initialize media
      const mediaReady = await initializeMedia(true, true);
      if (!mediaReady) {
        toast.error('Failed to access camera/microphone');
        return;
      }

      // Create call record in database
      const { data: callData, error: callError } = await supabase
        .from('video_calls')
        .insert({
          doctor_id: doctorId,
          patient_id: patientId,
          call_type: 'video',
          status: 'pending',
          initiated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (callError || !callData) {
        console.error('[Patient WebRTC] ❌ Failed to create call record:', callError);
        toast.error('Failed to initiate call');
        return;
      }

      // Create offer
      const offer = await createOffer();
      if (!offer) {
        toast.error('Failed to create call offer');
        return;
      }

      // Send offer to doctor
      socketRef.current.send(JSON.stringify({
        type: 'OFFER',
        from: `patient_${patientId}`,
        to: `doctor_${doctorId}`,
        offer,
        callId: callData.id,
        callType: 'video',
        isEmergency: true
      }));

      setActiveCall({
        id: callData.id,
        doctorId,
        doctorName,
        callType: 'video',
        status: 'ringing',
        startedAt: new Date()
      });

      toast.info(`Calling ${doctorName}...`);
    } catch (error) {
      console.error('[Patient WebRTC] ❌ Error initiating emergency call:', error);
      toast.error('Failed to initiate call');
    }
  }, [patientId, initializeMedia, createOffer]);

  // DON'T cleanup on unmount - allow reconnection
  // Calls only end when user explicitly clicks end button
  useEffect(() => {
    return () => {
      // Don't automatically end calls on component unmount
      // This allows page refresh without ending the call
      console.log('[Patient WebRTC] Component unmounting - call preserved for reconnection');
    };
  }, []);

  return {
    incomingCall,
    activeCall,
    acceptCall,
    declineCall,
    endCall,
    initiateEmergencyCall,
    localStream,
    remoteStream,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
    connectionState
  };
};
