# camerabridge.aar (native RTSP→WHIP)

This file is the Go camera bridge compiled with gomobile. It is **git-ignored / not
committed** because it is a large platform binary — build it once on a machine that
has the Android SDK + NDK:

```bash
cd ../../../../camera-bridge-core      # the camera-bridge-core repo
export ANDROID_HOME="$HOME/Library/Android/sdk"   # adjust to your SDK
make aar                                # → lepumobileapp/android/app/libs/camerabridge.aar
```

`android/app/build.gradle` already includes `libs/camerabridge.aar` automatically
**when it exists**. If it is missing the app still builds, but the native RTSP
bridge stays disabled (the plugin emits `Native camerabridge.aar missing`).

After building: `npx cap sync android` then build in Android Studio.

Requirements: Android SDK with NDK installed (Android Studio → SDK Manager → SDK
Tools → NDK), and `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) exported.
