# Live Camera Streaming (RPM) — Mobile Build Guide

The patient phone pulls the **Reolink RTSP** feed on the home Wi-Fi and publishes it
to the SFU (`camera-stream-service`) via WHIP. The doctor watches via WHEP. No static
IP / port-forwarding needed — the phone dials out.

The video pipeline is shared Go code (`native/camera-bridge-core`) compiled to a
native binary per platform with **gomobile**:

| Platform | Native binary | Used by |
|----------|---------------|---------|
| Android  | `android/app/libs/camerabridge.aar`        | `CameraBridgePlugin.kt` → `CameraBridgeService.kt` |
| iOS      | `ios/App/Frameworks/Mobile.xcframework`    | `CameraBridgePlugin.swift` (`import Mobile`) |

These binaries are **not committed** (large platform artifacts). Build them once.

## One-time setup

```bash
npm install
npm run build:camera-bridge        # builds AAR (if Android SDK+NDK) and/or XCFramework (if Xcode)
npx cap sync
```

`build:camera-bridge` auto-installs gomobile and skips a platform gracefully if its
toolchain is missing. Build per platform with `npm run build:camera-bridge android`
or `... ios`.

### Android
- Needs Android SDK **with NDK** + `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) exported.
- `android/app/build.gradle` auto-includes `libs/camerabridge.aar` when present.
- Then: `npx cap sync android` → open in Android Studio → Run.

### iOS
- Needs macOS + Xcode + CocoaPods.
- `npm run build:camera-bridge ios` then `cd ios/App && pod install`.
- `Podfile` auto-adds the `CameraBridge` pod when `Mobile.xcframework` exists; the
  Swift plugin uses `#if canImport(Mobile)` so it compiles either way.
- Then open `ios/App/App.xcworkspace` → Run.

If a native binary is missing, the app still builds — Android disables the native
bridge, iOS falls back to the `usePhoneBridge` WebRTC path.

## Config

`VITE_CAMERA_SFU_URL` (see `env.example`) sets the SFU origin. Optional — defaults to
`https://monitraq-camera-sfu.fly.dev` (`src/config/cameraStream.ts`).

## Patient flow (already built in the React app)
1. **Connect Camera** — enter Reolink username / password / LAN IP → saved to `patient_cameras`.
2. **Live RPM monitoring** — toggle consent on, choose Phone bridge, tap *Push live ingest*.
3. Doctor sees the feed in `patient-watch-command` → `LivePatientCamera` (WHEP).

## Note on the camera
The phone is the **bridge**, not the source — it forwards a Reolink E1 Pro / Go (RTSP)
on the patient's LAN. The phone's own camera is only used as the browser-preview fallback.
