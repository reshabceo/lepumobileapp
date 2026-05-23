#!/usr/bin/env bash
#
# Builds the native RTSP→WHIP camera bridge (Go → gomobile) for Android and iOS.
# Run this ONCE before `npx cap sync`. It is safe to re-run.
#
#   ./scripts/build-camera-bridge.sh            # build whatever this machine can
#   ./scripts/build-camera-bridge.sh android    # Android AAR only
#   ./scripts/build-camera-bridge.sh ios        # iOS XCFramework only
#
# Requirements:
#   - Go 1.21+            (https://go.dev/dl)
#   - Android AAR  → Android SDK + NDK, and ANDROID_HOME (or ANDROID_SDK_ROOT) exported
#   - iOS framework → macOS + Xcode + CocoaPods
#
# gomobile is installed automatically if missing.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Prefer the vendored Go source; fall back to a sibling camera-bridge-core checkout.
if [ -d "$REPO_ROOT/native/camera-bridge-core/mobile" ]; then
  SRC="$REPO_ROOT/native/camera-bridge-core"
elif [ -d "$REPO_ROOT/../camera-bridge-core/mobile" ]; then
  SRC="$(cd "$REPO_ROOT/../camera-bridge-core" && pwd)"
else
  echo "ERROR: camera-bridge-core Go source not found (looked in native/ and ../)." >&2
  exit 1
fi

TARGET="${1:-all}"
GOBIN="$(go env GOPATH)/bin"
export PATH="$GOBIN:$PATH"

ensure_gomobile() {
  if ! command -v gomobile >/dev/null 2>&1; then
    echo "[bridge] installing gomobile…"
    go install golang.org/x/mobile/cmd/gomobile@latest
    go install golang.org/x/mobile/cmd/gobind@latest
    gomobile init
  fi
}

build_android() {
  if [ -z "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ]; then
    echo "[bridge] SKIP android: ANDROID_HOME/ANDROID_SDK_ROOT not set (need SDK + NDK)." >&2
    return 0
  fi
  ensure_gomobile
  mkdir -p "$REPO_ROOT/android/app/libs"
  ( cd "$SRC" && GOSUMDB=off gomobile bind -target=android -androidapi 24 \
      -o "$REPO_ROOT/android/app/libs/camerabridge.aar" ./mobile )
  echo "[bridge] ✅ android/app/libs/camerabridge.aar"
}

build_ios() {
  if [ "$(uname -s)" != "Darwin" ] || ! xcodebuild -version >/dev/null 2>&1; then
    echo "[bridge] SKIP ios: needs macOS + Xcode." >&2
    return 0
  fi
  ensure_gomobile
  mkdir -p "$REPO_ROOT/ios/App/Frameworks"
  ( cd "$SRC" && GOSUMDB=off gomobile bind -target=ios \
      -o "$REPO_ROOT/ios/App/Frameworks/Mobile.xcframework" ./mobile )
  echo "[bridge] ✅ ios/App/Frameworks/Mobile.xcframework"
  echo "[bridge]    next: (cd ios/App && pod install)"
}

case "$TARGET" in
  android) build_android ;;
  ios)     build_ios ;;
  all)     build_android; build_ios ;;
  *) echo "usage: $0 [android|ios|all]" >&2; exit 2 ;;
esac

echo "[bridge] done. Now run: npx cap sync"
