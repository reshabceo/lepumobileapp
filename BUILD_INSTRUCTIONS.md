# iOS Build Instructions

## ⚠️ CRITICAL: WellueSDK Plugin Registration Issue

**Problem:** When running `npx cap copy ios`, Capacitor strips `WellueSDK` from the root `packageClassList` in the generated `capacitor.config.json`, even though it's correctly defined in `capacitor.config.ts`.

**Solution:** Use the automated build script that fixes this every time.

---

## 🚀 Quick Build & Deploy (Recommended)

```bash
npm run build:ios
```

This single command:
1. ✅ Builds web assets
2. ✅ Copies to iOS
3. ✅ **Fixes WellueSDK registration automatically**
4. ✅ Builds iOS app
5. ✅ Installs on device
6. ✅ Launches app

---

## 📋 Manual Build (If Needed)

If you need to build manually:

```bash
# 1. Build web assets
npm run build

# 2. Copy to iOS
export LANG=en_US.UTF-8
npx cap copy ios

# 3. ⚠️ CRITICAL: Fix the packageClassList
# Edit ios/App/App/capacitor.config.json
# Ensure "WellueSDK" is the FIRST item in the root packageClassList:

{
  ...
  "packageClassList": [
    "WellueSDK",    // ← MUST BE HERE!
    "BluetoothLe",
    "FilesystemPlugin",
    "ScreenOrientationPlugin",
    "SharePlugin"
  ]
}

# 4. Build iOS app
cd ios/App
xcodebuild -workspace App.xcworkspace \
           -scheme App \
           -configuration Debug \
           -destination 'platform=iOS,id=00008140-001C65993AE3001C' \
           build

# 5. Install on device
xcrun devicectl device install app \
      --device 00008140-001C65993AE3001C \
      ~/Library/Developer/Xcode/DerivedData/App-cvvdaoljxzghrlezsanitckwqigw/Build/Products/Debug-iphoneos/App.app

# 6. Launch app
xcrun devicectl device process launch \
      --device 00008140-001C65993AE3001C \
      com.monitraq.app
```

---

## 🔍 Verify Plugin Registration

After build, check Safari Web Inspector console:

✅ **Should see:**
```
🚀 [LEPU SDK] Starting initialization...
✅ SDK initialized successfully
```

❌ **Should NOT see:**
```
❌ [LEPU SDK] Failed to initialize: Error: "WellueSDK" plugin is not implemented on ios
```

---

## 🐛 Troubleshooting

### Plugin Not Registered Error

**Symptoms:**
```
Error: "WellueSDK" plugin is not implemented on ios
```

**Fix:**
1. Check `ios/App/App/capacitor.config.json`
2. Verify `"WellueSDK"` is in **root** `packageClassList`
3. Rebuild and reinstall

**Quick fix:**
```bash
# Add WellueSDK to root packageClassList
perl -i -0777 -pe 's/("packageClassList": \[(?!\s*"WellueSDK"))/\1\n\t\t"WellueSDK",/g' ios/App/App/capacitor.config.json

# Rebuild
cd ios/App
xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug -destination 'platform=iOS,id=00008140-001C65993AE3001C' build

# Reinstall
xcrun devicectl device install app --device 00008140-001C65993AE3001C ~/Library/Developer/Xcode/DerivedData/App-cvvdaoljxzghrlezsanitckwqigw/Build/Products/Debug-iphoneos/App.app

# Launch
xcrun devicectl device process launch --device 00008140-001C65993AE3001C com.monitraq.app
```

---

## 📱 BP Measurement Testing

After successful build and plugin registration:

1. Navigate to BP Monitor page
2. Connect BP2A device  
3. Press START button on device (not in app)
4. Observe logs in Safari Web Inspector:

```
📊 [BP2RT BRIDGE] onRealTimeUpdate exists: true
📱 [REALTIME] Device status update: 4
🎯 USER PRESSED DEVICE BUTTON! Status 4 (BPMeasuring) detected
🩺 Device-initiated measurement detected, starting measurement
📊 [BP PROGRESS] Pressure: 120 mmHg
🩺 BP Measurement result received
✅ Processed BP measurement: {systolic: 120, diastolic: 80, ...}
```

5. Results should display automatically after measurement completes

---

## 📝 Key Files

- `capacitor.config.ts` - Source config (correct)
- `ios/App/App/capacitor.config.json` - Generated config (needs fixing)
- `build-ios.sh` - Automated build script with fix
- `ios/App/App/WellueSDKPlugin.swift` - Native plugin implementation
- `ios/App/App/WellueSDKPlugin.m` - Plugin registration (Obj-C)
- `src/lib/wellue-sdk-bridge.ts` - JavaScript bridge

---

## 🔧 Production Fixes Applied

1. ✅ Callback merging (prevents callback loss)
2. ✅ bpLifecycle("measuring") starts measurement
3. ✅ Field mapping for iOS (mean) vs Android (map)
4. ✅ Lifecycle event handling improvements
5. ✅ Automated build script with config fix

---

## 💡 Remember

**ALWAYS use `npm run build:ios` instead of manual `npx cap copy` to ensure WellueSDK stays registered!**

