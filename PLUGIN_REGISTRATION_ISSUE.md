# WellueSDK Plugin Registration Issue - Root Cause Analysis

## Problem
The WellueSDK plugin is not being discovered by Capacitor on iOS, resulting in:
```
Error: "WellueSDK" plugin is not implemented on ios
```

## Current Status
- ✅ Plugin files exist: `WellueSDKPlugin.m` and `WellueSDKPlugin.swift`
- ✅ CAP_PLUGIN macro is correctly defined in `.m` file
- ✅ Swift class has `@objc(WellueSDK)` annotation
- ✅ Files are in Xcode project build phases
- ✅ Bridging header is configured
- ✅ Plugin is in `capacitor.config.ts` packageClassList
- ❌ **Capacitor sync shows only 4 plugins (WellueSDK not found)**
- ❌ **Plugin not discoverable at runtime**

## Why "Lepu" vs "Wellue"?
The JavaScript code uses variable name `LepuSDK` but registers plugin as `'WellueSDK'`:
```typescript
const LepuSDK = registerPlugin<WellueSDKPlugin>('WellueSDK');
```
This is just a naming inconsistency - the actual plugin name is "WellueSDK" everywhere.

## Root Cause
The `CAP_PLUGIN` macro should automatically register the plugin, but Capacitor isn't discovering it. This typically happens when:
1. The plugin class isn't properly exposed to Objective-C runtime
2. The CAP_PLUGIN macro isn't being compiled/linked correctly
3. Capacitor's plugin discovery mechanism isn't finding custom plugins

## Potential Solutions

### Solution 1: Verify Plugin is in Xcode Project
1. Open `ios/App/App.xcworkspace` in Xcode
2. Check that `WellueSDKPlugin.m` and `WellueSDKPlugin.swift` are in the project
3. Verify both files are in the "App" target's "Compile Sources" phase
4. Ensure the bridging header path is correct in Build Settings

### Solution 2: Check if Plugin Needs Explicit Registration
Some Capacitor versions require custom plugins to be explicitly registered. Check if we need to add the plugin to a registration list.

### Solution 3: Verify CAP_PLUGIN Macro is Working
The macro should generate Objective-C code that registers the plugin. We can verify this by:
1. Checking build logs for any errors related to the plugin
2. Verifying the plugin class is accessible at runtime
3. Testing if the plugin can be found using Objective-C runtime APIs

### Solution 4: Alternative Registration Method
If CAP_PLUGIN isn't working, we might need to manually register the plugin in AppDelegate or use a different registration mechanism.

## Next Steps
1. **Check Xcode project** - Verify all files are properly included
2. **Test plugin discovery** - Add debug logging to see if plugin is registered
3. **Check Capacitor version** - Some versions handle custom plugins differently
4. **Consider manual registration** - If automatic discovery fails, manually register in AppDelegate

## Files to Check
- `ios/App/App/WellueSDKPlugin.m` - Plugin registration macro
- `ios/App/App/WellueSDKPlugin.swift` - Plugin implementation
- `ios/App/App/App-Bridging-Header.h` - Bridging header
- `ios/App/App.xcodeproj/project.pbxproj` - Xcode project configuration
- `capacitor.config.ts` - Plugin configuration

