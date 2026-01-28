import { useState, useEffect, useCallback, useRef } from 'react';
import * as CallLogsService from '@/services/callLogs';

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
}

export interface CallMetadata {
  callId: string;
  doctorId: string;
  patientId: string;
  callType: 'audio' | 'video';
  callMode: 'scheduled' | 'emergency' | 'instant';
  appointmentId?: string;
  userRole: 'doctor' | 'patient';
}

export interface WebRTCConnection {
  peerConnection: RTCPeerConnection | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isConnected: boolean;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  connectionState: RTCPeerConnectionState;
  callMetadata: CallMetadata | null;
}

export interface UseWebRTCReturn extends WebRTCConnection {
  initializeMedia: (video: boolean, audio: boolean) => Promise<boolean>;
  initializeCall: (metadata: CallMetadata) => Promise<boolean>;
  createOffer: () => Promise<RTCSessionDescriptionInit | null>;
  createAnswer: (offer: RTCSessionDescriptionInit) => Promise<RTCSessionDescriptionInit | null>;
  setRemoteDescription: (description: RTCSessionDescriptionInit) => Promise<void>;
  addIceCandidate: (candidate: RTCIceCandidateInit) => Promise<void>;
  toggleAudio: () => void;
  toggleVideo: () => void;
  cleanup: (reason?: string) => void;
  onIceCandidate: (callback: (candidate: RTCIceCandidate) => void) => void;
  onTrack: (callback: (stream: MediaStream) => void) => void;
}

// Initialize ICE servers with Twilio TURN as backup
let DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

const DEFAULT_CONFIG: WebRTCConfig = {
  iceServers: DEFAULT_ICE_SERVERS
};

export const useWebRTC = (config: WebRTCConfig = DEFAULT_CONFIG): UseWebRTCReturn => {
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [callMetadata, setCallMetadata] = useState<CallMetadata | null>(null);

  const iceCandidateCallbackRef = useRef<((candidate: RTCIceCandidate) => void) | null>(null);
  const trackCallbackRef = useRef<((stream: MediaStream) => void) | null>(null);
  const callLogInitialized = useRef(false);

  // Initialize peer connection with Twilio TURN backup
  const initializePeerConnection = useCallback(async () => {
    console.log('[WebRTC] 🔗 Initializing peer connection with Twilio TURN backup...');
    
    // Dynamically import getICEServers
    const { getICEServers } = await import('@/config/webrtc');
    const iceServers = await getICEServers();
    
    const configWithTurn = {
      ...config,
      iceServers,
      iceCandidatePoolSize: 10
    };
    
    console.log('[WebRTC] ICE Servers configured:', iceServers.length, 'servers');
    
    const pc = new RTCPeerConnection(configWithTurn);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] 📡 ICE candidate generated:', event.candidate.type);
        if (iceCandidateCallbackRef.current) {
          iceCandidateCallbackRef.current(event.candidate);
        }
      } else {
        console.log('[WebRTC] ✅ ICE gathering complete');
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] 📺 Remote track received:', event.track.kind);
      const stream = event.streams[0];
      setRemoteStream(stream);
      
      if (trackCallbackRef.current) {
        trackCallbackRef.current(stream);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] 📡 ICE connection state:', pc.iceConnectionState);
      
      // Update call log with connection state
      if (callLogInitialized.current && callMetadata) {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          CallLogsService.updateCallStatus(callMetadata.callId, {
            status: 'connected',
            iceConnectionState: pc.iceConnectionState
          });
          setIsConnected(true);
        } else if (pc.iceConnectionState === 'disconnected') {
          CallLogsService.incrementReconnectionAttempt(callMetadata.callId);
          setIsConnected(false);
        } else if (pc.iceConnectionState === 'failed') {
          CallLogsService.failCall(callMetadata.callId, 'ICE connection failed');
          setIsConnected(false);
        }
      } else {
        // Fallback if no call metadata
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setIsConnected(true);
        } else if (pc.iceConnectionState === 'disconnected') {
          setIsConnected(false);
        } else if (pc.iceConnectionState === 'failed') {
          setIsConnected(false);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] 🔌 Connection state:', pc.connectionState);
      setConnectionState(pc.connectionState);
      
      // Update call log with peer connection state
      if (callLogInitialized.current && callMetadata) {
        CallLogsService.updateCallStatus(callMetadata.callId, {
          peerConnectionState: pc.connectionState
        });
      }
    };

    setPeerConnection(pc);
    return pc;
  }, [config]);

  // Initialize call with metadata and logging
  const initializeCall = useCallback(async (metadata: CallMetadata): Promise<boolean> => {
    try {
      console.log('[WebRTC] 🎬 Initializing call with metadata:', metadata);
      
      // Store metadata
      setCallMetadata(metadata);
      
      // Initialize call log in database
      const result = await CallLogsService.initializeCallLog({
        callId: metadata.callId,
        appointmentId: metadata.appointmentId,
        doctorId: metadata.doctorId,
        patientId: metadata.patientId,
        callType: metadata.callType,
        callMode: metadata.callMode,
        clientInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform
        },
        networkInfo: {
          effectiveType: (navigator as any).connection?.effectiveType || 'unknown'
        }
      });
      
      if (result.success) {
        callLogInitialized.current = true;
        console.log('[WebRTC] ✅ Call log initialized in database');
        return true;
      } else {
        console.error('[WebRTC] ❌ Failed to initialize call log:', result.error);
        // Continue anyway - don't block call if logging fails
        return true;
      }
    } catch (error) {
      console.error('[WebRTC] ❌ Error initializing call:', error);
      // Continue anyway - don't block call if logging fails
      return true;
    }
  }, []);

  // Initialize media (camera and microphone)
  const initializeMedia = useCallback(async (video: boolean = true, audio: boolean = true): Promise<boolean> => {
    try {
      console.log('[WebRTC] 🎥 Requesting media access...', { video, audio });
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false,
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false
      });

      console.log('[WebRTC] ✅ Media stream obtained:', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      });

      setLocalStream(stream);
      setIsAudioEnabled(audio);
      setIsVideoEnabled(video);

      // Add tracks to peer connection if it exists
      if (peerConnection) {
        stream.getTracks().forEach(track => {
          peerConnection.addTrack(track, stream);
          console.log('[WebRTC] ➕ Track added to peer connection:', track.kind);
        });
      }

      return true;
    } catch (error) {
      console.error('[WebRTC] ❌ Error accessing media:', error);
      return false;
    }
  }, [peerConnection]);

  // Create an offer
  const createOffer = useCallback(async (): Promise<RTCSessionDescriptionInit | null> => {
    if (!peerConnection) {
      console.error('[WebRTC] ❌ No peer connection available');
      return null;
    }

    try {
      console.log('[WebRTC] 📤 Creating offer...');
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      await peerConnection.setLocalDescription(offer);
      console.log('[WebRTC] ✅ Offer created and set as local description');

      return offer;
    } catch (error) {
      console.error('[WebRTC] ❌ Error creating offer:', error);
      return null;
    }
  }, [peerConnection]);

  // Create an answer
  const createAnswer = useCallback(async (offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> => {
    if (!peerConnection) {
      console.error('[WebRTC] ❌ No peer connection available');
      return null;
    }

    try {
      console.log('[WebRTC] 📥 Setting remote description (offer)...');
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      console.log('[WebRTC] 📤 Creating answer...');
      const answer = await peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      await peerConnection.setLocalDescription(answer);
      console.log('[WebRTC] ✅ Answer created and set as local description');

      return answer;
    } catch (error) {
      console.error('[WebRTC] ❌ Error creating answer:', error);
      return null;
    }
  }, [peerConnection]);

  // Set remote description
  const setRemoteDescription = useCallback(async (description: RTCSessionDescriptionInit): Promise<void> => {
    if (!peerConnection) {
      console.error('[WebRTC] ❌ No peer connection available');
      return;
    }

    try {
      console.log('[WebRTC] 📥 Setting remote description...');
      await peerConnection.setRemoteDescription(new RTCSessionDescription(description));
      console.log('[WebRTC] ✅ Remote description set');
    } catch (error) {
      console.error('[WebRTC] ❌ Error setting remote description:', error);
    }
  }, [peerConnection]);

  // Add ICE candidate
  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit): Promise<void> => {
    if (!peerConnection) {
      console.error('[WebRTC] ❌ No peer connection available for ICE candidate');
      return;
    }

    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[WebRTC] ✅ ICE candidate added');
    } catch (error) {
      console.error('[WebRTC] ❌ Error adding ICE candidate:', error);
    }
  }, [peerConnection]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        console.log('[WebRTC] 🎤 Audio:', audioTrack.enabled ? 'ON' : 'OFF');
      }
    }
  }, [localStream]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        console.log('[WebRTC] 📹 Video:', videoTrack.enabled ? 'ON' : 'OFF');
      }
    }
  }, [localStream]);

  // Cleanup
  const cleanup = useCallback((reason?: string) => {
    console.log('[WebRTC] 🧹 Cleaning up WebRTC connection...');

    // Log call end to database
    if (callLogInitialized.current && callMetadata) {
      const endedBy = callMetadata.userRole; // 'doctor' or 'patient'
      CallLogsService.endCall(
        callMetadata.callId,
        endedBy,
        reason || 'Call ended by user'
      );
      console.log('[WebRTC] 📝 Call end logged to database');
    }

    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        console.log('[WebRTC] ⏹️  Stopped track:', track.kind);
      });
      setLocalStream(null);
    }

    if (peerConnection) {
      peerConnection.close();
      console.log('[WebRTC] 🔌 Peer connection closed');
      setPeerConnection(null);
    }

    setRemoteStream(null);
    setIsConnected(false);
    setConnectionState('closed');
    setCallMetadata(null);
    callLogInitialized.current = false;
  }, [localStream, peerConnection, callMetadata]);

  // Set callbacks
  const onIceCandidate = useCallback((callback: (candidate: RTCIceCandidate) => void) => {
    iceCandidateCallbackRef.current = callback;
  }, []);

  const onTrack = useCallback((callback: (stream: MediaStream) => void) => {
    trackCallbackRef.current = callback;
  }, []);

  // Initialize peer connection on mount
  useEffect(() => {
    const pc = initializePeerConnection();
    
    return () => {
      if (pc) {
        pc.close();
      }
    };
  }, []);

  return {
    peerConnection,
    localStream,
    remoteStream,
    isConnected,
    isAudioEnabled,
    isVideoEnabled,
    connectionState,
    callMetadata,
    initializeCall,
    initializeMedia,
    createOffer,
    createAnswer,
    setRemoteDescription,
    addIceCandidate,
    toggleAudio,
    toggleVideo,
    cleanup,
    onIceCandidate,
    onTrack
  };
};
