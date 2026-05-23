# Mobile.xcframework (native RTSP→WHIP for iOS)

This is the Go camera bridge compiled with gomobile for iOS. It is **not committed**
(large platform binary) — build it once on a Mac with Xcode:

```bash
cd ../../../../camera-bridge-core      # the camera-bridge-core repo
make xcframework                       # → ios/App/Frameworks/Mobile.xcframework
cd ../lepumobileapp/ios/App && pod install
```

Wiring is automatic — no Xcode drag-and-drop needed:

- `CameraBridge.podspec` (in this folder) vendors `Mobile.xcframework`.
- `Podfile` adds the `CameraBridge` pod **only when `Mobile.xcframework` exists**,
  so `pod install` keeps working before you build it.
- `CameraBridgePlugin.swift` uses `#if canImport(Mobile)`, so it compiles either
  way: with the framework → full native RTSP→WHIP; without → falls back to the
  `usePhoneBridge` WebRTC path.

Module name is `Mobile` (the Go package), which is why the Swift uses `import Mobile`
and the classes are `MobileBridge` / `MobileStatusListener`.

Requirements: Xcode + command line tools, CocoaPods. After building, archive/run
the App target as usual.
