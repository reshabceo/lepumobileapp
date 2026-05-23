/**
 * Camera live-streaming (RPM) configuration.
 *
 * The patient phone (or Pi kit) pulls the Reolink RTSP feed on the LAN and
 * publishes it to the camera-stream-service SFU via WHIP. Doctors watch via
 * WHEP. This helper resolves the SFU origin used by both the native bridge
 * (useNativeCameraBridge), the web/iOS fallback (usePhoneBridge) and the Pi
 * pairing flow (PiPairing).
 *
 * Override per environment with VITE_CAMERA_SFU_URL. When unset we fall back to
 * the deployed Fly.io app (see camera-stream-service/fly.toml → app name).
 */

/** Deployed SFU (Fly.io app "monitraq-camera-sfu", region bom). */
export const DEFAULT_CAMERA_SFU_URL = "https://monitraq-camera-sfu.fly.dev";

/**
 * Returns the SFU origin without a trailing slash, or "" only if a build has
 * been explicitly configured with an empty VITE_CAMERA_SFU_URL.
 */
export const getCameraSFUOrigin = (): string => {
  const fromEnv = (import.meta.env.VITE_CAMERA_SFU_URL as string | undefined)?.trim();
  const origin = fromEnv !== undefined && fromEnv !== "" ? fromEnv : DEFAULT_CAMERA_SFU_URL;
  return origin.replace(/\/+$/, "");
};
