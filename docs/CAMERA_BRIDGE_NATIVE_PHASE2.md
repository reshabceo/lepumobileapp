# Phase 2 native camera bridge

The WebView cannot open Reolink RTSP directly. Use this path for true home-camera streaming:

1. **FFmpegKit** (Maven) inside `CameraBridgeStubPlugin` (Kotlin) to decode RTSP locally.
2. **Android Foreground Service** with ongoing notification ("Monitraq is monitoring…") so Android does not kill the bridge.
3. Reuse WHIP ingestion against `camera-stream-service` (`POST /whip/{patient_id}`) from native Kotlin or a thin Go JNI helper.

`CameraBridgeStubPlugin` is registered from `MainActivity`. Replace `echo()` with methods such as `startBridge({ rtspUrl, patientId })` wired to FFmpeg output tracks.
