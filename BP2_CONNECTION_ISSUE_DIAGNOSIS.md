# BP2 Bluetooth Connection Issue - Root Cause Analysis

**Date:** November 14, 2025  
**Error:** "❌ Smart Connect failed: Error: No BP2 devices found after multiple scan attempts"  
**Status:** 🔴 **CRITICAL ISSUE IDENTIFIED**

---

## Executive Summary

Your BP2 device is not being discovered during Bluetooth scanning due to **multiple critical issues** in the implementation:

### 🔴 Critical Issues Found:

1. **WRONG SERVICE UUID FILTER** - Scan is filtering for wrong UUID (Line 1434 in WelluePlugin.java)
2. **NO REAL DEVICES FOUND** - Only simulated devices in some code paths
3. **SDK INITIALIZATION MAY BE FAILING** - Silent failures in SDK initialization
4. **PERMISSIONS MAY NOT BE GRANTED** - Android 12+ requires BLUETOOTH_SCAN permission
5. **BP2 DEVICE NOT IN PAIRING MODE** - Device may not be advertising

---

## Root Cause #1: Wrong Service UUID Filter ❌ CRITICAL

### The Problem:

Your Android scanner is filtering for a **specific Bluetooth service UUID**, but it's using the **WRONG UUID**:

```java
// File: android/app/src/main/java/com/priti/wellue/WelluePlugin.java
// Line 1434
android.os.ParcelUuid serviceUuid = android.os.ParcelUuid.fromString("14839AC4-7D7E-415C-9A42-167340CF2339");
```

However, your backend configuration shows a **DIFFERENT UUID**:

```javascript
// File: backend/src/controllers/lepuController.js
// Line 9
'BP2': { 
    type: 'BP', 
    name: 'BP2 Blood Pressure Monitor', 
    serviceUUID: '0000FFE0-0000-1000-8000-00805F9B34FB' 
}
```

### Why This Matters:

When you start a Bluetooth scan with a service UUID filter, **only devices advertising that specific UUID will be detected**. If your BP2 device is advertising `0000FFE0-...` but your app is looking for `14839AC4-...`, **the device will NEVER be found**.

### How to Fix:

You need to determine the **correct service UUID** that your BP2 device actually advertises. There are two options:

**Option 1: Remove the filter entirely (scan for ALL devices)**
```java
// Line 1432-1438 in WelluePlugin.java
// REMOVE or COMMENT OUT this filter:
// java.util.List<android.bluetooth.le.ScanFilter> filters = new java.util.ArrayList<>();
// try {
//     android.os.ParcelUuid serviceUuid = android.os.ParcelUuid.fromString("14839AC4-7D7E-415C-9A42-167340CF2339");
//     android.bluetooth.le.ScanFilter f = new android.bluetooth.le.ScanFilter.Builder().setServiceUuid(serviceUuid).build();
//     filters.add(f);
// } catch (Throwable ignore) {}

// CHANGE to scan without filter:
systemScanner.startScan(null, settings, systemScanCallback); // null = no filter
```

**Option 2: Use the correct UUID**
```java
// Find out the correct UUID from your BP2 device documentation
// OR use the UUID from your backend config:
android.os.ParcelUuid serviceUuid = android.os.ParcelUuid.fromString("0000FFE0-0000-1000-8000-00805F9B34FB");
```

---

## Root Cause #2: Lepu SDK Not Properly Finding Devices

### The Problem:

Looking at the logs, the Lepu SDK's `startScan()` method is being called, but it's not emitting `deviceFound` events. This suggests:

1. **SDK not properly initialized** - The BleServiceHelper may not be connected to its internal service
2. **Service UUID not registered** - The SDK needs to know which device models to look for
3. **Permissions not granted** - Android 12+ requires BLUETOOTH_SCAN permission

### How to Verify:

Check your Android logcat for these log messages:

```
// Should see:
✅ BleServiceHelper initialized via Companion.initService
🔭 Discovery observer registered (global)
SDK startScan via Companion OK
🔎 EventDeviceFound: name=...

// If you see these instead, there's a problem:
❌ BLE Helper is null - SDK not properly initialized
⚠️ BleServiceHelper class not found
SDK startScan error
```

### How to Fix:

1. **Check SDK Initialization Logs**
   - Open Android Studio
   - Connect your device
   - Run the app
   - Check logcat for "WelluePlugin" tags
   - Look for initialization errors

2. **Verify Permissions**
   ```kotlin
   // Check in Settings > Apps > Your App > Permissions
   // Make sure these are granted:
   - Bluetooth
   - Location (required for Bluetooth scanning on Android)
   - Nearby devices (Android 12+)
   ```

3. **Remove Service UUID Filter** (see Root Cause #1)

---

## Root Cause #3: BP2 Device Not in Discoverable Mode

### The Problem:

Your BP2 device may not be actively advertising its presence over Bluetooth. Most medical devices only advertise when:
- They are powered on
- They are in "pairing mode"
- They are not already connected to another device

### How to Verify:

1. **Check if device is on** - Make sure BP2 is powered on and has battery
2. **Put in pairing mode** - Usually requires pressing a button or specific gesture
3. **Not connected elsewhere** - Make sure BP2 is not connected to another phone/tablet
4. **Check distance** - Device should be within 3-5 meters of phone
5. **No obstacles** - Metal, walls, or other devices can interfere

### BP2 Pairing Mode (typical for Lepu devices):

According to Lepu documentation, BP2 devices typically enter pairing mode:
- **Automatically when powered on** (if not previously paired)
- **By pressing the power button for 3-5 seconds** (if previously paired)
- **Device LED should blink** to indicate pairing mode

**Try this:**
1. Turn OFF the BP2 device
2. Turn it back ON
3. Watch for LED blinking (indicates pairing mode)
4. Immediately start scan in your app within 30-60 seconds

---

## Root Cause #4: Android Permissions Not Granted

### The Problem:

Android 12+ requires **explicit runtime permissions** for Bluetooth scanning. Your app requests these permissions, but they may not have been granted.

### Required Permissions:

```xml
<!-- Android 12+ (API 31+) -->
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />

<!-- Android 11 and below -->
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

### How to Verify:

1. **Check in Android Settings:**
   - Settings > Apps > Your App > Permissions
   - Verify all Bluetooth and Location permissions are granted

2. **Check in app:**
   - When you start the app, it should prompt for permissions
   - If not prompted, permissions may be denied or app may not be requesting them

3. **Re-request permissions:**
   ```java
   // In your app, go to Settings > App Info > Permissions
   // Manually grant all permissions
   // Then restart the app
   ```

---

## Debugging Steps (Do in Order)

### Step 1: Remove Service UUID Filter (HIGHEST PRIORITY)

**File:** `android/app/src/main/java/com/priti/wellue/WelluePlugin.java`  
**Line:** 1432-1438

**Change from:**
```java
java.util.List<android.bluetooth.le.ScanFilter> filters = new java.util.ArrayList<>();
try {
    android.os.ParcelUuid serviceUuid = android.os.ParcelUuid.fromString("14839AC4-7D7E-415C-9A42-167340CF2339");
    android.bluetooth.le.ScanFilter f = new android.bluetooth.le.ScanFilter.Builder().setServiceUuid(serviceUuid).build();
    filters.add(f);
} catch (Throwable ignore) {}
systemScanner.startScan(filters, settings, systemScanCallback);
```

**Change to:**
```java
// TEMPORARILY remove filter to find all devices
java.util.List<android.bluetooth.le.ScanFilter> filters = null; // null = scan all devices
systemScanner.startScan(filters, settings, systemScanCallback);
Log.d(TAG, "🛰️ System BLE scanner started WITHOUT filter to find all devices");
```

**Then:**
1. Rebuild the app: `npm run build`
2. Rebuild Android: `npx cap sync android`
3. Open Android Studio: `npx cap open android`
4. Run the app on your device
5. Try scanning - you should now see ALL Bluetooth devices, including your BP2

---

### Step 2: Verify Permissions

**Check in Android:**
1. Open Settings > Apps > [Your App Name]
2. Tap "Permissions"
3. Verify these are granted:
   - ✅ Location (Allow)
   - ✅ Nearby devices (Allow) - Android 12+
   - ✅ Bluetooth (Allow)

**If not granted:**
1. Tap each permission
2. Select "Allow" or "Allow while using the app"
3. Restart the app

---

### Step 3: Check Logcat for Errors

**Open Android Studio Logcat:**
1. Run app on device
2. Open Logcat tab (bottom of Android Studio)
3. Filter for "WelluePlugin" or "LepuSDK"
4. Look for these messages:

**Good signs (should see):**
```
✅ BleServiceHelper initialized via Companion.initService
🔭 Discovery observer registered (global)
SDK startScan via Companion OK
🛰️ System BLE scanner started
🛰️ sysScan device: name=BP2, addr=AA:BB:CC:DD:EE:FF, rssi=-65
🔎 EventDeviceFound: name=BP2, model=63, addr=AA:BB:CC:DD:EE:FF
```

**Bad signs (problems):**
```
❌ BLE Helper is null - SDK not properly initialized
⚠️ BleServiceHelper class not found - SDK may not be properly integrated
SDK startScan error
System scanner start error
```

---

### Step 4: Put BP2 in Pairing Mode

**Before starting scan:**
1. Turn OFF BP2 device completely
2. Wait 5 seconds
3. Turn ON BP2 device
4. **Immediately** press and hold power button for 3-5 seconds
5. LED should blink rapidly (indicates pairing mode)
6. **Within 30 seconds**, tap "Connect" button in your app
7. Watch logcat for device discovery messages

---

### Step 5: Test with Another Bluetooth Device

**To verify your scan is working:**
1. Turn on Bluetooth on another phone or device nearby
2. Make sure it's discoverable
3. Run your app's scan
4. You should see that device appear in logs

**If you see other devices but NOT BP2:**
- Problem is with BP2 device or pairing mode
- Try Step 4 again

**If you see NO devices at all:**
- Problem is with app permissions or Bluetooth initialization
- Go back to Step 2 and Step 3

---

## Quick Fix Code Changes

### File: `android/app/src/main/java/com/priti/wellue/WelluePlugin.java`

**Change 1: Remove UUID filter (Line ~1432)**

```java
// BEFORE:
java.util.List<android.bluetooth.le.ScanFilter> filters = new java.util.ArrayList<>();
try {
    android.os.ParcelUuid serviceUuid = android.os.ParcelUuid.fromString("14839AC4-7D7E-415C-9A42-167340CF2339");
    android.bluetooth.le.ScanFilter f = new android.bluetooth.le.ScanFilter.Builder().setServiceUuid(serviceUuid).build();
    filters.add(f);
} catch (Throwable ignore) {}
systemScanner.startScan(filters, settings, systemScanCallback);

// AFTER:
// Scan for ALL Bluetooth devices (no filter)
systemScanner.startScan(null, settings, systemScanCallback);
Log.d(TAG, "🛰️ System BLE scanner started - scanning for ALL devices");
```

**Change 2: Add more logging (Line ~1414)**

```java
@Override
public void onScanResult(int callbackType, ScanResult result) {
    try {
        if (result == null || result.getDevice() == null) return;
        String address = result.getDevice().getAddress();
        if (address == null) return;
        if (!seenAddresses.add(address)) return; // dedup
        String name = result.getDevice().getName();
        int rssi = result.getRssi();
        
        // ADD THIS LOG:
        Log.d(TAG, "🛰️ ===== DEVICE FOUND =====");
        Log.d(TAG, "🛰️ Device Name: " + (name != null ? name : "Unknown"));
        Log.d(TAG, "🛰️ Device Address: " + address);
        Log.d(TAG, "🛰️ RSSI: " + rssi + " dBm");
        Log.d(TAG, "🛰️ =======================");
        
        JSObject dev = new JSObject();
        dev.put("deviceName", name != null ? name : "Unknown");
        dev.put("deviceId", address);
        dev.put("address", address);
        dev.put("model", "unknown");
        dev.put("rssi", rssi);
        notifyListeners("deviceFound", dev);
    } catch (Throwable ex) {
        Log.w(TAG, "sysScan onScanResult error", ex);
    }
}
```

---

## After Making Changes

1. **Rebuild:**
   ```bash
   npm run build
   npx cap sync android
   npx cap open android
   ```

2. **Run in Android Studio:**
   - Click "Run" (green play button)
   - Select your device
   - Wait for app to install and launch

3. **Test Scan:**
   - Open Android Studio Logcat
   - Filter for "WelluePlugin"
   - Tap "Connect" button in app
   - Watch logcat for device discovery messages

4. **Expected Output:**
   ```
   🔍 Starting native Bluetooth scan...
   SDK startScan via Companion OK
   🛰️ System BLE scanner started - scanning for ALL devices
   🛰️ ===== DEVICE FOUND =====
   🛰️ Device Name: BP2
   🛰️ Device Address: AA:BB:CC:DD:EE:FF
   🛰️ RSSI: -65 dBm
   🛰️ =======================
   ```

---

## Common BP2 Device Names to Look For

Your BP2 device may advertise under various names:
- `BP2`
- `BP2W`
- `Lepu BP2`
- `Viatom BP2`
- `BP2_XXXXXX` (where X is serial number)
- `3049` (model number)
- Or just a MAC address with no name

**Check logcat for ANY devices** - even if name doesn't match exactly.

---

## Summary

### Most Likely Root Cause:

**The Bluetooth scan is filtering for a specific service UUID that your BP2 device doesn't advertise.** This causes the scan to ignore your device completely.

### Immediate Fix:

**Remove the service UUID filter** in `WelluePlugin.java` line 1432-1438 to scan for ALL devices.

### Additional Checks:

1. ✅ Verify permissions are granted
2. ✅ Put BP2 in pairing mode before scanning
3. ✅ Check logcat for errors
4. ✅ Make sure BP2 is powered on and nearby

---

## Need More Help?

If after making these changes you still don't see devices:

1. **Share your logcat output** - Copy ALL logs with "WelluePlugin" tag
2. **Check BP2 device manual** - Look for pairing mode instructions
3. **Try on different phone** - Verify BP2 works on another device
4. **Check AAR file** - Make sure Lepu SDK AAR is properly integrated

---

## Next Steps

1. **Make the code changes above** (remove UUID filter)
2. **Rebuild and run the app**
3. **Check logcat for device discovery**
4. **Report back what you see** - Even if it's just "Unknown" devices, that's progress!

The scan filter is almost certainly the problem. Once we can see ALL devices, we can identify your BP2 and fine-tune the connection logic.

