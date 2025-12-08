# 🔧 Fix: Capacitor WellueSDK Plugin Not Registering

## Problem
The WellueSDK Capacitor plugin is not being registered, causing initialization failures. The issue is that Capacitor cannot find the plugin at runtime even though it's compiled into the binary.

## Root Cause
This is typically caused by one of these issues:
1. **Build cache** - Xcode is using cached builds that don't include the plugin
2. **Pod installation** - CocoaPods dependencies aren't properly linked
3. **Module visibility** - Swift class isn't visible to Objective-C runtime
4. **Capacitor sync** - The web build and native projects are out of sync

## Solution: Complete Rebuild

Follow these steps **in order**:

### Step 1: Clean Everything (Terminal)

```bash
# Navigate to project root
cd /Users/reshab/Desktop/lepumobileapp

# Stop any running processes
# Press Ctrl+C if any dev servers are running

# Clean web build
rm -rf dist
rm -rf node_modules/.vite

# Clean iOS build artifacts
rm -rf ios/App/build
rm -rf ios/App/DerivedData
rm -rf ios/App/Pods
rm -rf ios/App/Podfile.lock

# Clean Capacitor cache
npx cap clean ios
```

### Step 2: Rebuild Web Assets

```bash
# Build the web app (this creates the dist folder)
npm run build

# Verify dist folder was created
ls -la dist
# You should see index.html, assets/, etc.
```

### Step 3: Sync Capacitor

```bash
# This copies web assets to native projects AND updates plugin registration
npx cap sync ios

# Verify the sync completed without errors
# You should see: "✔ Copying web assets"
# and "✔ Updating iOS plugins"
```

### Step 4: Reinstall iOS Dependencies

```bash
# Navigate to iOS folder
cd ios/App

# Install/update CocoaPods dependencies
pod install --repo-update

# Verify WellueSDKPlugin files are present
ls -la App/WellueSDK*
# You should see:
# - WellueSDKPlugin.swift
# - WellueSDKPlugin.m

# Return to project root
cd ../..
```

### Step 5: Clean Build in Xcode

1. **Open Xcode:**
   ```bash
   npx cap open ios
   ```

2. **In Xcode menu bar:**
   - Click **Product** → **Clean Build Folder** (or press Shift+Cmd+K)
   - Wait for cleaning to complete

3. **Delete Derived Data:**
   - Click **Xcode** → **Preferences** (or Settings on newer Xcode)
   - Go to **Locations** tab
   - Click the arrow next to **Derived Data** path
   - Delete the **App-[random]** folder
   - Close the Finder window

4. **Verify Plugin Files in Xcode:**
   - In the left sidebar, expand the **App** folder
   - Verify these files exist:
     - ✅ `WellueSDKPlugin.swift`
     - ✅ `WellueSDKPlugin.m`
     - ✅ `App-Bridging-Header.h`
   - If any are missing or red, **stop here** and report back

5. **Check Build Settings:**
   - Click on **App** (blue icon) at the top of the left sidebar
   - Select **App** target
   - Go to **Build Settings** tab
   - Search for "Bridging Header"
   - Verify it shows: `App/App-Bridging-Header.h`
   - Search for "Swift Compiler"
   - Verify **Swift Language Version** is **5.0**

6. **Build the App:**
   - Click **Product** → **Build** (or press Cmd+B)
   - Watch the build output for errors
   - **Common errors to watch for:**
     - ❌ "Cannot find 'VTMProductLib'" → Run `pod install` again
     - ❌ "Module 'WellueSDK' not found" → Bridging header issue
     - ❌ "Undefined symbol" → Linking issue

7. **If Build Succeeds:**
   - Connect your iPhone via USB
   - Select your iPhone in the device dropdown (top bar)
   - Click **Product** → **Run** (or press Cmd+R)
   - The app will install and launch on your phone

### Step 6: Verify Plugin Registration

Once the app is running on your device:

1. **Open Safari on your Mac**
2. **Connect to device console:**
   - Safari menu → **Develop** → **[Your iPhone]** → **[Your App]**
3. **Check console logs for:**
   ```
   ✅ "🚀 [LEPU SDK PLUGIN] Constructor called"
   ✅ "🚀 [LEPU SDK PLUGIN] LepuSDK plugin object: [object Object]"
   ✅ "🚀 [NATIVE WELLUE PLUGIN] Plugin available check result: true"
   ```

4. **If you see these errors instead:**
   ```
   ❌ "Plugin WellueSDK does not have a web implementation"
   ❌ "Plugin WellueSDK is not available on this platform"
   ```
   → **The plugin still isn't registered** → Continue to Advanced Fix below

---

## Advanced Fix: Force Plugin Registration

If the above steps didn't work, the issue is that the Swift class isn't visible to the Objective-C runtime. Try this:

### Option A: Verify Swift Module Name

1. **In Xcode, check the Swift module name:**
   - Select **App** target → **Build Settings**
   - Search for "Product Module Name"
   - It should show: **App**

2. **The Objective-C code expects the Swift class at:**
   - `WellueSDK` (preferred)
   - `App.WellueSDK` (if module namespaced)
   - `_TtC3App9WellueSDK` (Swift mangled name)

3. **Update WellueSDKPlugin.m** to log which name works:

Add this **before** the `CAP_PLUGIN` macro:

```objective-c
// Test logging
@interface DebugPluginLoader : NSObject
@end

@implementation DebugPluginLoader

+ (void)load {
    NSLog(@"🔍 [DEBUG] Attempting to find WellueSDK class...");
    
    Class cls1 = NSClassFromString(@"WellueSDK");
    NSLog(@"🔍 [DEBUG] WellueSDK: %@", cls1 ? @"FOUND" : @"NOT FOUND");
    
    Class cls2 = NSClassFromString(@"App.WellueSDK");
    NSLog(@"🔍 [DEBUG] App.WellueSDK: %@", cls2 ? @"FOUND" : @"NOT FOUND");
    
    Class cls3 = NSClassFromString(@"_TtC3App9WellueSDK");
    NSLog(@"🔍 [DEBUG] _TtC3App9WellueSDK: %@", cls3 ? @"FOUND" : @"NOT FOUND");
}

@end
```

Rebuild and check the Xcode console for which class name is found.

### Option B: Use Capacitor 6 Auto-Registration (if available)

If using Capacitor 6+, you can register the plugin directly in Swift without the Objective-C bridge:

1. **Remove** the `CAP_PLUGIN` macro from `WellueSDKPlugin.m`
2. **Add** this to the end of `WellueSDKPlugin.swift`:

```swift
// Register plugin with Capacitor at module load
@_cdecl("CapacitorRegisterPlugin_WellueSDK")
public func capacitorRegisterWellueSDK() -> CAPPlugin.Type {
    return WellueSDK.self
}
```

3. **Update** `capacitor.config.ts` to manually register:

```typescript
const config: ExtendedCapacitorConfig = {
  // ... existing config ...
  ios: {
    // ... existing ios config ...
    plugins: {
      WellueSDK: {
        ios: {
          src: 'App'
        }
      }
    }
  }
};
```

---

## Verification Checklist

After completing the fix, verify:

- [ ] `npm run build` completes without errors
- [ ] `npx cap sync ios` completes without errors
- [ ] `pod install` completes without errors
- [ ] Xcode build succeeds (Cmd+B)
- [ ] App installs on device
- [ ] Safari console shows plugin constructor logs
- [ ] Plugin availability check returns `true`
- [ ] Bluetooth scanner page loads without errors

---

## If Still Not Working

If the plugin still isn't registering after all these steps:

### Quick Diagnostic Test

Add this to your `DeviceContext.tsx` initialization:

```typescript
useEffect(() => {
  const diagnosePlugin = async () => {
    console.log('🔍 [DIAGNOSTIC] Starting plugin diagnosis...');
    
    // Check if Capacitor is available
    console.log('🔍 [DIAGNOSTIC] Capacitor available:', !!Capacitor);
    console.log('🔍 [DIAGNOSTIC] Is native platform:', Capacitor.isNativePlatform());
    console.log('🔍 [DIAGNOSTIC] Platform:', Capacitor.getPlatform());
    
    // Check if plugin is registered
    const anyCap = Capacitor as any;
    if (typeof anyCap.isPluginAvailable === 'function') {
      const available = anyCap.isPluginAvailable('WellueSDK');
      console.log('🔍 [DIAGNOSTIC] Plugin available:', available);
    }
    
    // Try to call plugin
    try {
      const result = await wellueSDK.isBluetoothEnabled();
      console.log('✅ [DIAGNOSTIC] Plugin call succeeded:', result);
    } catch (error) {
      console.error('❌ [DIAGNOSTIC] Plugin call failed:', error);
    }
  };
  
  diagnosePlugin();
}, []);
```

Run the app and send me the console output from this diagnostic.

### Last Resort: Recreate iOS Platform

If nothing else works:

```bash
# Remove iOS platform completely
npx cap remove ios

# Re-add iOS platform
npx cap add ios

# Copy plugin files back
cp path/to/backup/WellueSDKPlugin.swift ios/App/App/
cp path/to/backup/WellueSDKPlugin.m ios/App/App/

# Sync and build
npx cap sync ios
cd ios/App && pod install && cd ../..
npx cap open ios
```

---

## Success Indicators

You'll know it's working when you see in the Safari console:

```
🚀 [LEPU SDK PLUGIN] Constructor called
🚀 [LEPU SDK PLUGIN] LepuSDK plugin object: [object Object]
🚀 [NATIVE WELLUE PLUGIN] Native plugin assigned: true
🚀 [NATIVE WELLUE PLUGIN] Plugin available check result: true
🚀 [NATIVE WELLUE PLUGIN] Creating BP measurement manager...
✅ Wellue SDK initialized successfully
```

And the Bluetooth scanner page will load without errors.

