# Android Build Guide - Lepu SDK Integration for BP2 Device

**Date:** November 14, 2025  
**SDK Source:** [https://github.com/viatom-develop/LepuDemo.git](https://github.com/viatom-develop/LepuDemo.git)  
**AAR Version:** lepu-blepro-1.0.8.aar (supports BP2, BP2A, BP2T devices)

---

## ✅ Integration Complete

The Android app has been properly configured to use the **official Lepu SDK** for BP2 device Bluetooth connections.

---

## Prerequisites

1. **AAR File:** `android/app/libs/lepu-blepro-1.0.8.aar` (3.6 MB)
   - ✅ File must exist in this location
   - ✅ Version 1.0.8 supports BP2 devices (as per official SDK docs)

2. **Dependencies:** Already configured in `build.gradle`
   - ✅ Nordic BLE: `2.10.0` (required by Lepu SDK)
   - ✅ LiveEventBus: `1.8.0` (required by Lepu SDK)
   - ✅ Lepu SDK AAR: `lepu-blepro-1.0.8`

3. **Permissions:** Already configured in `AndroidManifest.xml`
   - ✅ BLUETOOTH (API ≤ 30)
   - ✅ BLUETOOTH_ADMIN (API ≤ 30)
   - ✅ ACCESS_FINE_LOCATION
   - ✅ BLUETOOTH_SCAN (API ≥ 31)
   - ✅ BLUETOOTH_CONNECT (API ≥ 31)

---

## Build Instructions

### Step 1: Clean Build Directory

```bash
cd android
./gradlew clean
```

### Step 2: Sync Capacitor

```bash
cd ..
npx cap sync android
```

### Step 3: Build Debug APK

```bash
cd android
./gradlew assembleDebug
```

### Step 4: Install on Device

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

---

## Verification Checklist

### ✅ Before Building

- [ ] AAR file exists: `android/app/libs/lepu-blepro-1.0.8.aar`
- [ ] `build.gradle` has correct dependencies (Nordic BLE 2.10.0, LiveEventBus 1.8.0)
- [ ] `AndroidManifest.xml` has all required permissions
- [ ] `MainApplication.java` initializes `BleServiceHelper`
- [ ] `MainActivity.java` registers plugins BEFORE `super.onCreate()`

### ✅ After Building

Check logs for successful initialization:

```bash
adb logcat | grep -E "MainApplication|MainActivity|WelluePlugin|LepuSDK"
```

**Expected logs:**
```
MainApplication: ✅ Lepu SDK BleServiceHelper initialization completed
MainActivity: ✅ WelluePlugin (LepuSDK) added to initialPlugins
MainActivity: ✅ Bp2Plugin added to initialPlugins
MainActivity: MainActivity onCreate completed - Bridge created with Lepu SDK plugins
```

### ✅ Runtime Verification

1. **SDK Initialization:**
   - Check logs for: `✅ BleServiceHelper initialized`
   - Check logs for: `EventServiceConnectedAndInterfaceInit` (SDK service ready)

2. **Plugin Registration:**
   - No errors: `"LepuSDK" plugin is not implemented`
   - Plugin should be available in JavaScript

3. **BP2 Connection:**
   - Scan should find BP2 devices
   - Connect should succeed
   - Device should emit `EventBp2SyncTime` when connected

---

## Key Files Modified

### 1. `android/app/build.gradle`
- ✅ Updated Nordic BLE to version 2.10.0 (as per official SDK docs)
- ✅ Lepu SDK AAR dependency configured
- ✅ LiveEventBus dependency configured

### 2. `android/app/src/main/java/com/priti/app/MainApplication.java`
- ✅ Initializes `BleServiceHelper.initService()` in `onCreate()`
- ✅ Proper error handling and logging
- ✅ Follows official SDK documentation

### 3. `android/app/src/main/java/com/priti/app/MainActivity.java`
- ✅ **CRITICAL FIX:** Plugins registered BEFORE `super.onCreate()`
- ✅ Uses `initialPlugins.add()` to ensure plugins are included when bridge is created
- ✅ Proper error handling

### 4. `android/app/src/main/java/com/priti/wellue/WelluePlugin.java`
- ✅ Plugin name: `"LepuSDK"` (matches TypeScript registration)
- ✅ Uses Lepu SDK classes: `BleServiceHelper`, `EventMsgConst`, `InterfaceEvent`, `Bluetooth`
- ✅ BP2 connection follows official SDK documentation:
  - `stopScan()` before connect
  - `setInterfaces(model, true)` before connect
  - `connect(context, model, device, ...)` with correct parameters
- ✅ Listens for `EventBp2SyncTime` when device connects
- ✅ Handles real-time data via `EventBp2RtData`

---

## BP2 Device Connection Flow (Official SDK)

According to the [official Lepu SDK documentation](https://github.com/viatom-develop/LepuDemo.git):

### 1. SDK Initialization
```java
// In MainApplication.onCreate()
BleServiceHelper.Companion.initService(application)
```

**SDK Event:** `LiveEventBus.get<Boolean>(EventMsgConst.Ble.EventServiceConnectedAndInterfaceInit).post(true)`

### 2. Start Scan
```java
BleServiceHelper.startScan()
```

**SDK Event:** `LiveEventBus.get<Bluetooth>(EventMsgConst.Discovery.EventDeviceFound).post(bluetooth)`

### 3. Connect to BP2 Device
```java
// Stop scan first
BleServiceHelper.stopScan()

// Set interface
BleServiceHelper.setInterfaces(Bluetooth.MODEL_BP2)

// Connect
BleServiceHelper.connect(context, Bluetooth.MODEL_BP2, bluetoothDevice)
```

**SDK Event (when connected):** `LiveEventBus.get<InterfaceEvent>(InterfaceEvent.BP2.EventBp2SyncTime).post(InterfaceEvent(model, true))`

### 4. BP2 Device Specifications

- **Model Constant:** `Bluetooth.MODEL_BP2`
- **Service UUID:** `14839AC4-7D7E-415C-9A42-167340CF2339`
- **Write UUID:** `8B00ACE7-EB0B-49B0-BBE9-9AEE0A26E1A3`
- **Notify UUID:** `0734594A-A8E7-4B1A-A6B1-CD5243059A57`

### 5. Real-time Data

**Event:** `LiveEventBus.get<InterfaceEvent>(InterfaceEvent.BP2.EventBp2RtData).post(InterfaceEvent(model, data))`

**Data:** `com.lepu.blepro.ext.bp2.RtData`
- Sampling rate: 250HZ
- mV = n * 0.003098

---

## Troubleshooting

### Issue: "LepuSDK plugin is not implemented"

**Cause:** Plugin not registered before bridge creation

**Fix:** ✅ Already fixed - plugins are registered in `initialPlugins` BEFORE `super.onCreate()`

### Issue: BleServiceHelper class not found

**Cause:** AAR file missing or not included in build

**Fix:**
1. Verify AAR exists: `ls -lh android/app/libs/lepu-blepro-1.0.8.aar`
2. Clean and rebuild: `./gradlew clean assembleDebug`
3. Check `build.gradle` has: `implementation(name: 'lepu-blepro-1.0.8', ext: 'aar')`

### Issue: BP2 device not found in scan

**Check:**
1. Bluetooth enabled on device
2. Location permission granted (required for BLE scan)
3. BP2 device in pairing/discoverable mode
4. Check logs for `EventDeviceFound` events

### Issue: Connection fails

**Check:**
1. SDK service ready: Look for `EventServiceConnectedAndInterfaceInit`
2. Scan stopped before connect: Check logs
3. Interface set correctly: `setInterfaces(Bluetooth.MODEL_BP2)`
4. Connection event: Look for `EventBp2SyncTime`

---

## Testing BP2 Connection

### 1. Initialize SDK
```javascript
await LepuSDK.initialize();
```

### 2. Start Scan
```javascript
await LepuSDK.startScan();

// Listen for devices
LepuSDK.addListener('deviceFound', (device) => {
    console.log('BP2 device found:', device);
});
```

### 3. Connect to BP2 Device
```javascript
await LepuSDK.connect({ address: 'AA:BB:CC:DD:EE:FF' });

// Listen for connection
LepuSDK.addListener('deviceConnected', (device) => {
    console.log('BP2 device connected:', device);
});
```

### 4. Monitor Logs
```bash
adb logcat | grep -E "WelluePlugin|BleServiceHelper|BP2|EventBp2"
```

---

## Expected Log Sequence

When working correctly:

```
MainApplication: MainApplication onCreate - Initializing Lepu SDK BleServiceHelper
MainApplication: ✅ BleServiceHelper initialized via Companion.initService()
MainApplication: ✅ Lepu SDK BleServiceHelper initialization completed
MainActivity: MainActivity onCreate - Registering Lepu SDK plugins BEFORE bridge creation
MainActivity: ✅ WelluePlugin (LepuSDK) added to initialPlugins
MainActivity: ✅ Bp2Plugin added to initialPlugins
MainActivity: MainActivity onCreate completed - Bridge created with Lepu SDK plugins
WelluePlugin: ✅ Connection poller started immediately
WelluePlugin: ✅ SDK Service Connected and Interface Initialized
WelluePlugin: 🔍 Starting native Bluetooth scan...
WelluePlugin: 🔎 EventDeviceFound: name=BP2, model=1, addr=AA:BB:CC:DD:EE:FF
WelluePlugin: 🛑 Stopping scan before connecting...
WelluePlugin: ✅ Interface set successfully (2 params: model=1, enable=true)
WelluePlugin: 🔗 Calling SDK connect method (5 params...)
WelluePlugin: ✅ GATT connected: AA:BB:CC:DD:EE:FF (BP2)
WelluePlugin: ✅ BP2 SyncTime event received - Device connected!
```

---

## References

- **Official Lepu SDK Repository:** [https://github.com/viatom-develop/LepuDemo.git](https://github.com/viatom-develop/LepuDemo.git)
- **AAR Version:** 1.0.8 (supports BP2, BP2A, BP2T)
- **Nordic BLE Library:** [https://github.com/NordicSemiconductor/Android-BLE-Library](https://github.com/NordicSemiconductor/Android-BLE-Library)
- **LiveEventBus:** [https://github.com/JeremyLiao/LiveEventBus](https://github.com/JeremyLiao/LiveEventBus)

---

**Status:** ✅ Ready for Build and Testing

All files have been configured according to the official Lepu SDK documentation. The app is ready to connect to BP2 devices via Bluetooth.

