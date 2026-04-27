// WebRTC Server Configuration
import { supabase } from '@/lib/supabase';

export const WEBRTC_SERVER_URL =
  import.meta.env.VITE_WEBRTC_SERVER_URL || 'wss://web-m4g9.onrender.com';

export const WEBRTC_SERVER_URL_DEV = 'ws://localhost:3000';

export const getWebRTCServerURL = () => {
  if (import.meta.env.PROD) {
    return 'wss://web-m4g9.onrender.com';
  }
  return import.meta.env.VITE_WEBRTC_SERVER_URL || 'wss://web-m4g9.onrender.com';
};

/** Twilio TURN credentials are issued by Supabase Edge Function (server-side Twilio secret). */
export const getTwilioTurnCredentials = async (): Promise<
  RTCIceServer[] | null
> => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return null;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      console.warn('Supabase URL/anon key missing; cannot fetch TURN credentials');
      return null;
    }

    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, '')}/functions/v1/twilio-turn-credentials`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('TURN credentials request failed:', response.status, errText);
      return null;
    }

    const data = await response.json();
    const servers = data.ice_servers;
    return Array.isArray(servers) ? servers : null;
  } catch (error) {
    console.error('Error getting Twilio TURN credentials:', error);
    return null;
  }
};

export const getICEServers = async (): Promise<RTCIceServer[]> => {
  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ];

  try {
    const twilioServers = await getTwilioTurnCredentials();
    if (twilioServers && twilioServers.length > 0) {
      iceServers.push(...twilioServers);
    }
  } catch (error) {
    console.warn('Could not add Twilio TURN servers:', error);
  }

  return iceServers;
};
