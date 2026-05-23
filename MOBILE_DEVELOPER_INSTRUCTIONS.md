# Mobile Developer Instructions — Live Camera Streaming (RPM)

This document is for the mobile developer who is turning this React (Vite) app into
native Android/iOS builds with Capacitor. It covers **everything you need to make the
live camera streaming feature work**. The React code, native plugins, and build
tooling are already in the repo — your job is to build the two native binaries and
run the app.

If you only read one thing: run `npm install && npm run build:camera-bridge && npx cap sync`,
then build in Android Studio / Xcode. The rest of this doc explains the details and
how to fix problems.

---

## 1. What this feature does

The patient's phone acts as a **bridge**: it connects to a Reolink IP camera on the
home Wi-Fi, pulls the camera's RTSP video, and forwards it to our streaming server
(SFU) using WHIP (WebRTC). The doctor watches the live feed in the web dashboard
using WHEP.

```
Reolink camera ──RTSP(LAN)──> Patient phone (this app) ──WHIP──> SFU ──WHEP──> Doctor web
```

Important: **the phone is the bridge, not the camera**. The phone forwards the
Reolink feed. The phone's own camera is only used as a browser-preview fallback.

No static IP / port forwarding is required — the phone dials *out* to the SFU.

---

## 2. How it is built (architecture)

The RTSP→WHIP video pipeline is written once in Go (`native/camera-bridge-core/`)
and compiled to a native binary per platform with **gomobile**:

| Platform | Native binary produced            | Consumed by (already in repo)                              |
|----------|-----------------------------------|------------------------------------------------------------|
| Android  | `android/app/libs/camerabridge.aar` | `CameraBridgePlugin.kt` → `CameraBridgeService.kt` (foreground service) |
| iOS      | `ios/App/Frameworks/Mobile.xcframework` | `CameraBridgePlugin.swift` (`import Mobile`)            |

These binaries are **not committed to git** (they are large platform artifacts).
**You build them once** with the provided script. Everything else (plugin
registration, gradle/pod wiring, the React UI) is already done.

The Capacitor plugin is called `CameraBridge`. It is already registered:
- Android: `MainActivity.java` adds `CameraBridgePlugin.class` to `initialPlugins`.
- iOS: `CameraBridgePlugin.m` declares the `CAP_PLUGIN`.

You do **not** need to register anything or write any plugin code.

---

## 3. Prerequisites

| Tool | Needed for | Notes |
|------|-----------|-------|
| Node 18+ and npm | the React app | `npm install` |
| Go 1.21+ | building the native bridge | https://go.dev/dl (gomobile is auto-installed) |
| Android Studio | Android build | Install the **NDK** (SDK Manager → SDK Tools → NDK (Side by side)) |
| `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) env var | Android AAR build | e.g. `export ANDROID_HOME="$HOME/Library/Android/sdk"` |
| Xcode + Command Line Tools | iOS build | macOS only |
| CocoaPods | iOS pods | `sudo gem install cocoapods` |

The build script installs `gomobile` for you automatically the first time.

---

## 4. One-time setup (do this once)

```bash
# from the repo root
npm install

# build the native camera bridge for whatever this machine supports
npm run build:camera-bridge          # builds Android AAR and/or iOS XCFramework

# copy web assets + native config into the platforms
npx cap sync
```

`npm run build:camera-bridge` will:
- install gomobile if missing,
- build `android/app/libs/camerabridge.aar` **if** `ANDROID_HOME`/NDK is set,
- build `ios/App/Frameworks/Mobile.xcframework` **if** you're on macOS with Xcode,
- skip a platform gracefully (with a message) if its toolchain is missing.

Build a single platform if you prefer:
```bash
npm run build:camera-bridge android
npm run build:camera-bridge ios
```

---

## 5. Android — full steps

1. Install the NDK in Android Studio: **Settings → SDK Manager → SDK Tools → NDK (Side by side)**.
2. Export your SDK path (add to `~/.zshrc`):
   ```bash
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   ```
3. Build the AAR:
   ```bash
   npm run build:camera-bridge android
   ```
   You should see: `android/app/libs/camerabridge.aar` created.
4. Sync and open:
   ```bash
   npx cap sync android
   npx cap open android
   ```
5. Run on a **physical Android device** (camera/network features don't work on emulators
   reliably). Grant the foreground-service / notification permission when prompted.

`android/app/build.gradle` automatically picks up `libs/camerabridge.aar` when it
exists — no gradle edits needed. If the AAR is missing the app still builds, but the
live bridge is disabled and logs `Native camerabridge.aar missing`.

---

## 6. iOS — full steps

1. Build the framework (macOS + Xcode required):
   ```bash
   npm run build:camera-bridge ios
   ```
   You should see: `ios/App/Frameworks/Mobile.xcframework` created.
2. Install pods:
   ```bash
   cd ios/App && pod install && cd ../..
   ```
   The `Podfile` adds the `CameraBridge` pod **only when `Mobile.xcframework` exists**,
   so this works whether or not you've built it yet.
3. Sync and open the **workspace** (not the project):
   ```bash
   npx cap sync ios
   open ios/App/App.xcworkspace
   ```
4. Set your signing team, then run on a **physical iPhone**.

The Swift plugin uses `#if canImport(Mobile)`, so the app compiles even before you
build the framework — in that state iOS falls back to the WebRTC phone-camera path.
Once `Mobile.xcframework` is embedded, iOS uses the full native Reolink RTSP bridge.

> If Xcode reports a missing symbol like `MobileBridge` or a method label mismatch,
> open `ios/App/Frameworks/Mobile.xcframework/.../Mobile.objc.h` and match the exact
> generated selector in `CameraBridgePlugin.swift` (`start(...)` args / listener
> method names). gomobile generates `MobileBridge` + `MobileStatusListener`; the
> labels follow the Go param names (`rtspUrl`, `sfuOrigin:`, `patientID:`, `jwt:`,
> `iceJSON:`, `useUDP:`, `hwSerial:`, `lst:`).

---

## 7. Environment configuration

The app needs to know the streaming server (SFU) URL.

- Variable: `VITE_CAMERA_SFU_URL`
- Default: `https://monitraq-camera-sfu.fly.dev` (set in `src/config/cameraStream.ts`)
- Override: put it in your `.env` / `.env.local` (see `env.example`).

If the backend team gives you a different SFU URL, set it here and rebuild the web
assets (`npm run build` then `npx cap sync`). If you do nothing, the deployed default
is used.

You do **not** need to change `.env` for the feature to work unless the backend uses
a different SFU host.

---

## 8. How to test end to end

You need: a Reolink camera on the same Wi-Fi as the phone, and a doctor account that
is assigned to the patient.

1. **Patient app → Connect Camera**: enter the Reolink username, password and LAN IP.
   Save. (This stores the RTSP URL in `patient_cameras`.)
2. **Patient app → Live RPM monitoring**: turn on "Allow doctor live view", keep
   "Phone bridge" selected, tap **Push live ingest**. Status should go
   `connecting → live`, and you'll see a foreground notification (Android).
3. **Doctor web app**: open the patient → the **Live camera** card → **Watch**. The
   video should appear within a few seconds.

---

## 9. Verification checklist

- [ ] `npm run build:camera-bridge` produced the AAR and/or XCFramework (check the paths).
- [ ] App installs and launches on a physical device.
- [ ] Connect Camera saves successfully (toast "saved").
- [ ] Live monitoring status reaches **live** (not stuck on connecting/error).
- [ ] Doctor sees the feed.
- [ ] Android shows the "Live RPM bridge" foreground notification while streaming.

---

## 10. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `Native camerabridge.aar missing` in logs | AAR not built. Set `ANDROID_HOME` + NDK, run `npm run build:camera-bridge android`, `npx cap sync android`. |
| iOS streams the phone camera instead of the Reolink | `Mobile.xcframework` not built/embedded. Run `npm run build:camera-bridge ios && cd ios/App && pod install`. |
| `VITE_CAMERA_SFU_URL is not set` | Empty SFU URL. Set it in `.env` or rely on the default in `src/config/cameraStream.ts`. |
| Status stuck on `connecting`, never `live` | Phone can't reach the Reolink RTSP (wrong IP/credentials, not same Wi-Fi), or can't reach the SFU. Verify the RTSP URL in VLC first; confirm the SFU is reachable (`https://<sfu>/healthz` → `ok`). |
| WHIP returns 403 `monitoring disabled` | Patient hasn't toggled "Allow doctor live view" on. |
| WHIP returns 401 `invalid jwt` | The SFU's `SUPABASE_JWT_SECRET` doesn't match the Supabase project. This is a backend config issue, not mobile. |
| Doctor sees "no heartbeat" | The bridge stopped pushing. Keep the app foregrounded (Android runs a foreground service; iOS has limited background time). |
| Some patients connect, others don't | The SFU needs a **TURN** server for strict NAT. Backend issue (`ICE_SERVERS_JSON`). |
| gomobile build fails | Ensure Go 1.21+; delete `~/go/bin/gomobile` and re-run to reinstall; for Android ensure NDK is installed. |

---

## 11. What you should NOT change

- Do **not** edit `.env` unless the backend gives you a new SFU URL.
- Do **not** modify the Go source in `native/camera-bridge-core/` unless coordinating
  with the backend team — it is the shared bridge used by Android, iOS, and the Pi kit.
- Do **not** commit the built binaries (`camerabridge.aar`, `Mobile.xcframework`) —
  they are git-ignored on purpose.

---

## 12. File reference (already in the repo)

| File | Purpose |
|------|---------|
| `native/camera-bridge-core/` | Go RTSP→WHIP bridge source (vendored, self-contained) |
| `scripts/build-camera-bridge.sh` | One-command native build (`npm run build:camera-bridge`) |
| `src/config/cameraStream.ts` | Resolves the SFU origin (`VITE_CAMERA_SFU_URL`) |
| `src/plugins/cameraBridge.ts` | Capacitor plugin TS interface |
| `src/hooks/useNativeCameraBridge.ts` | Native RTSP→WHIP control (Android + iOS) |
| `src/hooks/usePhoneBridge.ts` | Browser/phone-camera WHIP fallback |
| `src/pages/ConnectCamera.tsx` | Reolink credential entry UI |
| `src/pages/LiveMonitoring.tsx` | Consent toggle + start/stop ingest |
| `src/pages/PiPairing.tsx` | Raspberry Pi kit pairing (alternative bridge) |
| `android/app/src/main/java/com/monitraq/app/plugins/CameraBridgePlugin.kt` | Android plugin |
| `android/app/src/main/java/com/monitraq/app/plugins/CameraBridgeService.kt` | Android foreground service |
| `ios/App/App/CameraBridgePlugin.swift` | iOS plugin (uses `import Mobile`) |
| `ios/App/Frameworks/CameraBridge.podspec` | Vendors `Mobile.xcframework` |

---

## 13. Summary

1. `npm install`
2. `npm run build:camera-bridge` (needs Go; Android needs NDK; iOS needs Xcode)
3. `npx cap sync`
4. Android Studio / Xcode → run on a physical device
5. (Optional) set `VITE_CAMERA_SFU_URL` if the backend uses a custom SFU host

That's the whole job. Everything else is already wired.
