# iOS Plugin Detection Fix - UNIMPLEMENTED Error

## Root Cause Analysis

**Error:**
```
❌ [LEPU SDK] Failed to initialize: {"code":"UNIMPLEMENTED"}
Error: "LepuSDK" plugin is not implemented on ios
```

**Problem:**
Capacitor cannot find the `WellueSDK` plugin at runtime, even though:
- ✅ Plugin is registered correctly: `CAP_PLUGIN(WellueSDK, "WellueSDK", ...)`
- ✅ Bridging header is configured: `SWIFT_OBJC_BRIDGING_HEADER = "App/App-Bridging-Header.h"`
- ✅ Plugin files are in Xcode project
- ✅ Plugin class has `@objc(WellueSDK)` annotation

**Why This Happens:**
1. **Stale Build Cache**: Xcode may have cached an old build where the plugin wasn't registered
2. **Plugin Not Linked**: The plugin class might not be included in the final binary
3. **Capacitor Plugin Registry**: The plugin registry might not be updated with the new plugin

## Solution: Clean Build Required

The app needs to be **completely rebuilt** from scratch to ensure:
1. The plugin is compiled into the binary
2. Capacitor's plugin registry includes WellueSDK
3. All linking is correct

## Step-by-Step Fix

### Step 1: Clean Build Folder in Xcode
1. Open Xcode (workspace should already be open)
2. **Product → Clean Build Folder** (or press `Cmd+Shift+K`)
3. Wait for clean to complete

### Step 2: Delete Derived Data (Optional but Recommended)
1. In Xcode: **Xcode → Settings → Locations**
2. Click the arrow next to "Derived Data" path
3. Delete the folder for your project (or all derived data)
4. This ensures a completely fresh build

### Step 3: Rebuild the App
1. Select your iPhone device in the device selector
2. **Product → Build** (or press `Cmd+B`)
3. Wait for build to complete
4. **Product → Run** (or press `Cmd+R`) to install on device

### Step 4: Verify Plugin Detection
After rebuild, check console logs for:
```
✅ Plugin loaded - starting initialization
✅ [WELLUE SDK] Initialize called from JavaScript
✅ [WELLUE SDK] Plugin initialized successfully
```

**NOT:**
```
❌ [LEPU SDK] Failed to initialize: {"code":"UNIMPLEMENTED"}
```

## Alternative: Command Line Clean Build

If Xcode UI doesn't work, use command line:

```bash
cd /Users/reshab/Desktop/lepumobileapp/ios/App

# Clean build folder
xcodebuild clean -workspace App.xcworkspace -scheme App

# Remove derived data
rm -rf ~/Library/Developer/Xcode/DerivedData/App-*

# Rebuild
xcodebuild -workspace App.xcworkspace \
  -scheme App \
  -configuration Debug \
  -destination 'generic/platform=iOS' \
  build
```

## Why Clean Build Fixes It

1. **Forces Recompilation**: All Swift/Objective-C files are recompiled
2. **Rebuilds Plugin Registry**: Capacitor regenerates its plugin registry
3. **Relinks Everything**: Ensures all symbols are properly linked
4. **Clears Caches**: Removes any stale build artifacts

## Verification Checklist

After clean rebuild, verify:
- [ ] No "UNIMPLEMENTED" errors in console
- [ ] Plugin `load()` method executes (check logs)
- [ ] `initialize()` method can be called from JavaScript
- [ ] Bluetooth permissions are requested
- [ ] Device scanning works

## Expected Logs After Fix

```
⚡️  [log] - Plugin loaded - starting initialization
⚡️  [log] - 🚀 [LEPU SDK] Starting initialization...
⚡️  [log] - 🔵 [LEPU SDK] Calling native plugin initialize()...
⚡️  [log] - ✅ [LEPU SDK] Native plugin initialize() completed
⚡️  [log] - ✅ [WELLUE SDK BRIDGE] Native initialization completed
```

## If Still Not Working

If clean build doesn't fix it, check:
1. **Plugin Registration**: Verify `CAP_PLUGIN` macro in `WellueSDKPlugin.m`
2. **Bridging Header**: Verify `SWIFT_OBJC_BRIDGING_HEADER` in build settings
3. **File Inclusion**: Verify `WellueSDKPlugin.swift` and `.m` are in "Compile Sources"
4. **Capacitor Version**: Ensure Capacitor 7.x is being used
5. **Pod Installation**: Run `pod install` again in `ios/App` directory



