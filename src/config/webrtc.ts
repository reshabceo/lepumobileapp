// WebRTC Server Configuration

// Use the deployed Render server
export const WEBRTC_SERVER_URL = import.meta.env.VITE_WEBRTC_SERVER_URL || 'wss://web-m4g9.onrender.com';

// Development fallback
export const WEBRTC_SERVER_URL_DEV = 'ws://localhost:3000';

// Get the appropriate URL based on environment
export const getWebRTCServerURL = () => {
  // In production, always use the Render deployed server
  if (import.meta.env.PROD) {
    return 'wss://web-m4g9.onrender.com';
  }

  // In development, use env variable or fallback to Render
  return import.meta.env.VITE_WEBRTC_SERVER_URL || 'wss://web-m4g9.onrender.com';
};

// Twilio TURN Server Configuration
// Credentials should be set in environment variables for security
export const TWILIO_CONFIG = {
  accountSid: import.meta.env.VITE_TWILIO_ACCOUNT_SID || '',
  authToken: import.meta.env.VITE_TWILIO_AUTH_TOKEN || ''
};

// Get Twilio TURN server credentials
export const getTwilioTurnCredentials = async () => {
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_CONFIG.accountSid}/Tokens.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${TWILIO_CONFIG.accountSid}:${TWILIO_CONFIG.authToken}`),
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get Twilio TURN credentials');
    }

    const data = await response.json();
    return data.ice_servers;
  } catch (error) {
    console.error('Error getting Twilio TURN credentials:', error);
    return null;
  }
};

// Default ICE servers configuration (STUN + TURN)
export const getICEServers = async (): Promise<RTCIceServer[]> => {
  const iceServers: RTCIceServer[] = [
    // Google STUN servers (free, public)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ];

  // Try to get Twilio TURN servers as backup
  try {
    const twilioServers = await getTwilioTurnCredentials();
    if (twilioServers && Array.isArray(twilioServers)) {
      console.log('✅ Twilio TURN servers added as backup');
      iceServers.push(...twilioServers);
    }
  } catch (error) {
    console.warn('⚠️ Could not add Twilio TURN servers, using STUN only:', error);
  }

  return iceServers;
};
