# AliveCor KardiaMobile 6L Integration Readme

This document provides a technical overview of how the AliveCor SDK is integrated into the Monitraq mobile application for 6-lead ECG recordings.

## SDK Version
- **iOS**: AliveCorKitLite **1.7.3** (`ios/App/Frameworks/`)
- **Android**: AliveCorKitLite-core **1.7.3** (`android/app/libs/AliveCorKitLite-core-1.7.3-ec954cb3.aar`)
- **Bundle ID**: `com.monitraq.mobile` (iOS and Android)

## 🚀 Features
- **Turnkey Recording UI**: Uses the official AliveCor recording activity for medical-grade user experience.
- **6-Lead Support**: Configured for KardiaMobile 6L (TRIANGLE device) with leads I, II, III, aVR, aVL, and aVF.
- **Waveform Extraction**: Automatically extracts raw voltage samples from ATC files for downstream analysis.
- **Stabilized BLE**: Robust handling of Bluetooth radio contention between background scanners and the medical SDK.

## 🏗 Architecture
The integration uses a multi-layer approach:
1. **Frontend (`src/pages/KardiaSixLeadECG.tsx`)**: Orchestrates the UI, requests permissions, and triggers the recording flow.
2. **Bridge (`src/lib/alivecor-sdk-bridge.ts`)**: A TypeScript wrapper that exposes native plugin methods to the web layer.
3. **Capacitor Plugin (`android/.../AliveCorPlugin.java`)**: The native Java implementation that manages the AliveCor SDK lifecycle.
4. **Android SDK**: `AliveCorKitLite-core-1.7.3-ec954cb3.aar` integrated into the Android project.

## 📦 Dependencies
The following dependencies are critical for the SDK to run without crashes:
```gradle
dependencies {
    // Room Persistence (Required for SDK data storage)
    implementation 'androidx.room:room-runtime:2.7.1'
    implementation 'androidx.room:room-rxjava2:2.7.1'
    implementation 'androidx.sqlite:sqlite-framework:2.5.1'

    // AliveCor Transitive Dependencies
    implementation 'com.github.bosphere.android-filelogger:filelogger:1.0.7'
    implementation 'io.reactivex.rxjava2:rxandroid:2.1.1'
    implementation 'io.reactivex.rxjava2:rxjava:2.2.21'
}
```

## 🛠 Implementation Details

### 1. Permission Grouping
Permissions are requested as a single block to satisfy both legacy and modern Android requirements:
- `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `ACCESS_FINE_LOCATION`, and `RECORD_AUDIO`.

### 2. Launch Flow
The `startSixLeadRecording` function follows a strict sequence to ensure success:
1. **Stop Scans**: Calls `stopKardiaScan()` to release the BLE scanner.
2. **Clear Sessions**: Calls `disconnectDevice()` to free up the radio from other devices (e.g., Wellue).
3. **Stabilization Delay**: Waits **800ms** to allow the Bluetooth stack to cool down.
4. **JWT Init**: Initializes the SDK with a secure token from the Kardia auth server.
5. **Intent Launch**: Starts `EKGRecordActivity` with the `TRIANGLE` device identifier.

### 3. Data Processing
When a recording finishes, the native plugin:
- Receives a `RecordActivityResult`.
- Locates the `enhancedAtcPath`.
- Uses `ATCReader` to extract signal data for all 6 leads.
- Returns a JSON object containing `heartRate`, `diagnosisText`, and `waveformLeads`.

## ⚠️ Troubleshooting & Stability
- **Crash on Start**: Ensure `filelogger` and `rxjava` dependencies are in `build.gradle`.
- **"Could not start ECG"**: Usually caused by Bluetooth radio contention. Ensure background scans are stopped before launching.
- **Permission Denial**: Always perform a fresh install after manifest changes to ensure the OS recognizes new permission groups.

---
*Created by Antigravity AI for Monitraq*
