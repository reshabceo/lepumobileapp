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
