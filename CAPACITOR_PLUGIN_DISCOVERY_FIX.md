# Capacitor Plugin Discovery Fix

## Problem
Capacitor cannot find the `WellueSDK` plugin, returning `UNIMPLEMENTED` errors:
```
❌ [LEPU SDK] Failed to initialize: {"code":"UNIMPLEMENTED"}
Error: "LepuSDK" plugin is not implemented on ios
```

The plugin's `load()` method is never called, meaning Capacitor never discovers the plugin.

## Root Cause
The `CAP_PLUGIN` macro registers the plugin, but if the plugin class isn't properly linked at runtime, Capacitor's plugin discovery mechanism can't find it. The `_forceLinkWellueSDK()` function was defined but never executed.

## Solution Applied

### 1. Added Constructor Function to Force Execution
**File:** `ios/App/App/WellueSDKPlugin.m`

Added `__attribute__((constructor))` to ensure the force link function executes at load time:

```objc
// CRITICAL: Actually call the force link function to ensure it's not optimized away
// This must execute at load time to register the plugin
__attribute__((constructor)) static void _registerWellueSDK() {
    _forceLinkWellueSDK();
}
```

### 2. Enhanced AppDelegate Registration
**File:** `ios/App/App/AppDelegate.swift`

Added explicit type reference to ensure the plugin class is loaded:

```swift
// Explicitly register the plugin to ensure Capacitor discovers it
let _ = type(of: WellueSDK.self)
```

## Why This Works

1. **Constructor Function**: The `__attribute__((constructor))` ensures the function runs when the library loads, before Capacitor initializes
2. **Force Link**: The function ensures the Swift class is available to Objective-C runtime
3. **Type Reference**: The explicit type reference in AppDelegate ensures the class is loaded early
4. **CAP_PLUGIN Macro**: The macro registers the plugin with Capacitor's plugin registry

## Next Steps

1. **Clean Build** in Xcode:
   - Product → Clean Build Folder (Cmd+Shift+K)

2. **Rebuild**:
   - Product → Build (Cmd+B)
   - Product → Run (Cmd+R)

3. **Verify**:
   - Check console for: `Plugin loaded - starting initialization`
   - No more `UNIMPLEMENTED` errors
   - Plugin `initialize()` method should work

## Expected Result

After rebuild, you should see:
```
⚡️  Plugin loaded - starting initialization
⚡️  ✅ [WELLUE SDK] Initialize called from JavaScript
⚡️  ✅ [WELLUE SDK] Plugin initialized successfully
```

## Technical Details

### How Capacitor Discovers Plugins

1. **Build Time**: `CAP_PLUGIN` macro generates plugin registration code
2. **Load Time**: Constructor functions execute, ensuring classes are linked
3. **Runtime**: Capacitor's plugin registry looks up plugins by ID
4. **Discovery**: If plugin class isn't linked, Capacitor returns `UNIMPLEMENTED`

### Why Previous Builds Worked

If it worked before, likely:
- The plugin was accidentally linked through other code paths
- Build settings changed
- Xcode optimization removed "unused" code
- Derived data cache had stale registration

### Why Clean Build is Required

- Forces recompilation of all plugin files
- Regenerates Capacitor's plugin registry
- Ensures constructor functions execute
- Relinks all symbols properly



