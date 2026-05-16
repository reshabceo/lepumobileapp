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
const STUN_ONLY_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

const DEFAULT_CONFIG: WebRTCConfig = {
  iceServers: STUN_ONLY_ICE_SERVERS
};

export const useWebRTC = (config: WebRTCConfig = DEFAULT_CONFIG): UseWebRTCReturn => {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  // Fetch Twilio TURN credentials once on mount.
  // iceReadyRef holds the pending Promise so initializeMedia can await it before
  // creating the RTCPeerConnection — ensuring TURN servers are always included.
  // Without TURN, calls fail on mobile networks behind symmetric NAT.
  const iceServersRef = useRef<RTCIceServer[]>(STUN_ONLY_ICE_SERVERS);
  const iceReadyRef = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    iceReadyRef.current = import('@/config/webrtc')
      .then(({ getICEServers }) => getICEServers())
      .then(servers => {
        iceServersRef.current = servers;
        console.log('[WebRTC] TURN credentials loaded, ICE servers:', servers.length);
      })
      .catch(e => console.warn('[WebRTC] Failed to fetch TURN credentials, using STUN only:', e));
  }, []);
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

  const setupPcHandlers = useCallback((pc: RTCPeerConnection) => {
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] ICE candidate generated:', event.candidate.type);
        if (iceCandidateCallbackRef.current) {
          iceCandidateCallbackRef.current(event.candidate);
        }
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote track received:', event.track.kind);
      const stream = event.streams[0];
      setRemoteStream(stream);
      if (trackCallbackRef.current) {
        trackCallbackRef.current(stream);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setIsConnected(true);
      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setIsConnected(false);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      setConnectionState(pc.connectionState);
    };
  }, []);

  // Get or create peer connection synchronously (STUN-only for speed)
  const getOrCreatePc = useCallback((): RTCPeerConnection => {
    if (pcRef.current && pcRef.current.signalingState !== 'closed') {
      return pcRef.current;
    }
    console.log('[WebRTC] Creating peer connection with', iceServersRef.current.length, 'ICE servers...');
    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current,
      iceCandidatePoolSize: 10
    });
    setupPcHandlers(pc);
    pcRef.current = pc;
    setPeerConnection(pc);
    return pc;
  }, [setupPcHandlers]);

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
      console.log('[WebRTC] Requesting media access...', { video, audio });

      // Wait for TURN credentials to load before creating the RTCPeerConnection.
      // getOrCreatePc() is called below — if it ran before this await, the PC
      // would be created with STUN-only servers and TURN would never be used.
      await iceReadyRef.current;

      if (!navigator.mediaDevices?.getUserMedia) {
        console.error('[WebRTC] navigator.mediaDevices.getUserMedia not available');
        return false;
      }

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

      console.log('[WebRTC] Media stream obtained:', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      });

      setLocalStream(stream);
      setIsAudioEnabled(audio);
      setIsVideoEnabled(video);

      const pc = getOrCreatePc();
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
        console.log('[WebRTC] Track added to peer connection:', track.kind);
      });

      return true;
    } catch (error) {
      console.error('[WebRTC] Error accessing media:', error);
      return false;
    }
  }, [getOrCreatePc]);

  // Create an offer
  const createOffer = useCallback(async (): Promise<RTCSessionDescriptionInit | null> => {
    try {
      const pc = getOrCreatePc();
      console.log('[WebRTC] Creating offer...');
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);
      console.log('[WebRTC] Offer created and set as local description');
      return offer;
    } catch (error) {
      console.error('[WebRTC] Error creating offer:', error);
      return null;
    }
  }, [getOrCreatePc]);

  // Create an answer
  const createAnswer = useCallback(async (offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> => {
    try {
      const pc = getOrCreatePc();
      console.log('[WebRTC] Setting remote description (offer)...');
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('[WebRTC] Creating answer...');
      const answer = await pc.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(answer);
      console.log('[WebRTC] Answer created and set as local description');
      return answer;
    } catch (error) {
      console.error('[WebRTC] Error creating answer:', error);
      return null;
    }
  }, [getOrCreatePc]);

  // Set remote description
  const setRemoteDescription = useCallback(async (description: RTCSessionDescriptionInit): Promise<void> => {
    try {
      const pc = getOrCreatePc();
      console.log('[WebRTC] Setting remote description...');
      await pc.setRemoteDescription(new RTCSessionDescription(description));
      console.log('[WebRTC] Remote description set');
    } catch (error) {
      console.error('[WebRTC] Error setting remote description:', error);
    }
  }, [getOrCreatePc]);

  // Add ICE candidate
  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit): Promise<void> => {
    try {
      const pc = getOrCreatePc();
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[WebRTC] ICE candidate added');
    } catch (error) {
      console.error('[WebRTC] Error adding ICE candidate:', error);
    }
  }, [getOrCreatePc]);

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
    console.log('[WebRTC] Cleaning up WebRTC connection...');

    if (callLogInitialized.current && callMetadata) {
      const endedBy = callMetadata.userRole;
      CallLogsService.endCall(
        callMetadata.callId,
        endedBy,
        reason || 'Call ended by user'
      );
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
      setPeerConnection(null);
    }

    setRemoteStream(null);
    setIsConnected(false);
    setConnectionState('closed');
    setCallMetadata(null);
    callLogInitialized.current = false;
  }, [localStream, callMetadata]);

  // Set callbacks
  const onIceCandidate = useCallback((callback: (candidate: RTCIceCandidate) => void) => {
    iceCandidateCallbackRef.current = callback;
  }, []);

  const onTrack = useCallback((callback: (stream: MediaStream) => void) => {
    trackCallbackRef.current = callback;
  }, []);

  // Cleanup peer connection on unmount
  useEffect(() => {
    return () => {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
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
