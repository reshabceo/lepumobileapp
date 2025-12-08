# Android Bluetooth Connection Guide

This guide explains how the Bluetooth connection to BP2 devices works on Android, including all required setup, dependencies, and troubleshooting steps.

## Table of Contents
1. [Overview](#overview)
2. [Required Dependencies](#required-dependencies)
3. [SDK Initialization](#sdk-initialization)
4. [Permissions Setup](#permissions-setup)
5. [Connection Flow](#connection-flow)
6. [Key Components](#key-components)
7. [Troubleshooting](#troubleshooting)

---

## Overview

The Android app uses the **Lepu BLE Pro SDK** (version 1.0.8) to connect to Wellue BP2 devices. The connection process involves:

1. **SDK Initialization** - BleServiceHelper must be initialized in MainApplication
2. **Permissions** - Bluetooth and location permissions must be granted
3. **Device Scanning** - Uses both SDK scanner and Android system scanner
4. **Connection** - Uses SDK's connect method with proper interface setup
5. **Connection Monitoring** - Polls GATT connections every 2 seconds

---

## Required Dependencies

### 1. AAR File
The SDK AAR file must be present:
- **File**: `lepu-blepro-1.0.8.aar`
- **Location**: `android/app/libs/` directory
- **Alternative Location**: `android/capacitor-cordova-android-plugins/src/main/libs/`

### 2. Gradle Dependencies
In `android/app/build.gradle`:

```gradle
dependencies {
    // Live event bus for SDK communication
    implementation 'io.github.jeremyliao:live-event-bus-x:1.8.0'
    
    // Lepu BLE Pro SDK AAR for BP2 support
    implementation(name: 'lepu-blepro-1.0.8', ext: 'aar')
    
    // Nordic BLE library (optional, for future use)
    implementation 'no.nordicsemi.android:ble:2.2.4'
}
```

### 3. Repository Configuration
In `android/app/build.gradle`:

```gradle
repositories {
    flatDir {
        dirs '../capacitor-cordova-android-plugins/src/main/libs', 'libs'
    }
    google()
    mavenCentral()
}
```

---

## SDK Initialization

### Critical: MainApplication Setup

The SDK **MUST** be initialized in `MainApplication.onCreate()`. This is the most common issue if connection fails.

**File**: `android/app/src/main/java/com/priti/app/MainApplication.java`

```java
@Override
public void onCreate() {
    super.onCreate();
    try {
        Class<?> helper = Class.forName("com.lepu.blepro.ext.BleServiceHelper");
        // Access singleton via Companion or static accessor
        Object companion = helper.getField("Companion").get(null);
        try {
            companion.getClass().getMethod("initService", Application.class)
                .invoke(companion, this);
        } catch (NoSuchMethodException ex) {
            // Fallback to instance method path if needed
            Object instance = helper.getDeclaredConstructor().newInstance();
            helper.getMethod("initService", Application.class).invoke(instance, this);
        }
        Log.d(TAG, "BleServiceHelper initialized via reflection");
    } catch (Throwable t) {
        Log.e(TAG, "Failed to init BleServiceHelper", t);
    }
}
```

**⚠️ IMPORTANT**: Without this initialization, the SDK will not work and connections will fail silently.

---

## Permissions Setup

### AndroidManifest.xml

**File**: `android/app/src/main/AndroidManifest.xml`

```xml
<!-- BLE feature declaration -->
<uses-feature android:name="android.hardware.bluetooth_le" android:required="true" />

<!-- Bluetooth permissions for API <= 30 (Android 11 and below) -->
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

<!-- Bluetooth permissions for API >= 31 (Android 12+) -->
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```

### Plugin Permissions

The WelluePlugin declares permissions in the `@CapacitorPlugin` annotation:

```java
@CapacitorPlugin(
    name = "WellueSDK",
    permissions = {
        @Permission(strings = { Manifest.permission.ACCESS_FINE_LOCATION }, alias = "location"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_SCAN }, alias = "bl_scan"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "bl_connect")
    }
)
```

### Runtime Permission Handling

The plugin checks permissions before operations:

- **Android 12+ (API 31+)**: Requires `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, and `ACCESS_FINE_LOCATION`
- **Android 11 and below**: Requires `ACCESS_FINE_LOCATION` only

---

## Connection Flow

### Step 1: Initialize Plugin

```javascript
// From JavaScript/TypeScript
await WellueSDK.initialize();
```

**What happens:**
1. Checks if Bluetooth adapter is available
2. Requests runtime permissions if needed
3. Marks plugin as initialized
4. Returns Bluetooth status

**Java Implementation** (`WelluePlugin.initialize()`):
- Gets BluetoothManager from system service
- Checks BluetoothAdapter availability
- Ensures permissions are granted
- Sets `isWellueSDKInitialized = true`

### Step 2: Start Scanning

```javascript
await WellueSDK.startScan();
```

**What happens:**
1. Stops any existing scan
2. Sets SDK interface to BP2 model
3. Starts SDK scanner via `BleServiceHelper.startScan()`
4. Starts Android system BLE scanner as fallback
5. Registers LiveEventBus observer for device discovery

**Java Implementation** (`WelluePlugin.startScan()`):

```java
// Set interface for BP2 model
helper.getClass().getMethod("setInterfaces", int.class, boolean.class)
    .invoke(helper, Bluetooth.MODEL_BP2, true);

// Start SDK scan
helper.getClass().getMethod("startScan", Integer.class, boolean.class)
    .invoke(helper, null, true);

// Register discovery observer
LiveEventBus.get(EventMsgConst.Discovery.EventDeviceFound, Bluetooth.class)
    .observeForever(bt -> {
        // Emit deviceFound event to JavaScript
        notifyListeners("deviceFound", dev);
    });
```

**Device Discovery:**
- SDK scanner finds devices via `EventDeviceFound` event
- System scanner finds devices via `ScanCallback.onScanResult()`
- Both emit `deviceFound` events to JavaScript
- Devices are deduplicated by MAC address

### Step 3: Connect to Device

```javascript
await WellueSDK.connect({ address: "AA:BB:CC:DD:EE:FF" });
```

**What happens:**
1. Stops scanning
2. Sets interface to BP2 model for the device
3. Gets BluetoothDevice from adapter
4. Calls SDK's connect method
5. Starts connection polling (every 2 seconds)
6. Saves MAC address to SharedPreferences for auto-reconnect

**Java Implementation** (`WelluePlugin.connect()`):

```java
// Stop scanning
stopScan(null);

// Set interface
int modelBp2 = Bluetooth.MODEL_BP2;
helper.getClass().getMethod("setInterfaces", int.class, boolean.class)
    .invoke(helper, modelBp2, true);

// Get device
BluetoothDevice device = bluetoothAdapter.getRemoteDevice(deviceAddress);

// Connect via SDK
helper.getClass().getMethod("connect", 
    Context.class, 
    int.class, 
    BluetoothDevice.class, 
    boolean.class, 
    boolean.class)
    .invoke(helper, getContext(), modelBp2, device, true, true);
```

### Step 4: Connection Monitoring

A background handler polls GATT connections every 2 seconds:

```java
private final Runnable connPoller = new Runnable() {
    @Override public void run() {
        BluetoothManager manager = (BluetoothManager) getContext()
            .getSystemService(Context.BLUETOOTH_SERVICE);
        List<BluetoothDevice> list = manager.getConnectedDevices(BluetoothProfile.GATT);
        
        // Check for newly connected devices
        for (BluetoothDevice d : list) {
            if (!connectedAddrsSnapshot.contains(d.getAddress())) {
                notifyListeners("deviceConnected", dev);
                activeWellueAddress = d.getAddress();
            }
        }
        
        // Check for disconnected devices
        for (String prev : connectedAddrsSnapshot) {
            if (!current.contains(prev)) {
                notifyListeners("deviceDisconnected", dev);
                activeWellueAddress = null;
            }
        }
        
        connHandler.postDelayed(this, 2000); // Poll every 2 seconds
    }
};
```

**Connection Events:**
- `deviceConnected` - Emitted when device connects
- `deviceDisconnected` - Emitted when device disconnects

---

## Key Components

### 1. BleServiceHelper

The SDK's main class for Bluetooth operations. Obtained via reflection:

```java
private Object getBleHelper() {
    if (bleHelperInstance != null) {
        return bleHelperInstance;
    }
    try {
        Class<?> helper = Class.forName("com.lepu.blepro.ext.BleServiceHelper");
        
        // Try Companion.getBleServiceHelper()
        try {
            Object companion = helper.getField("Companion").get(null);
            for (Method m : companion.getClass().getMethods()) {
                if (m.getReturnType() == helper && 
                    m.getParameterCount() == 0 && 
                    m.getName().toLowerCase().contains("bleservicehelper")) {
                    bleHelperInstance = m.invoke(companion);
                    break;
                }
            }
        } catch (Throwable ignore) {
            // Fallback: construct instance directly
            bleHelperInstance = helper.getDeclaredConstructor().newInstance();
        }
    } catch (Throwable t) {
        Log.e(TAG, "Failed to obtain BleServiceHelper instance", t);
    }
    return bleHelperInstance;
}
```

**Key Methods:**
- `initService(Application)` - Initialize SDK (called in MainApplication)
- `setInterfaces(int model, boolean enable)` - Set device model interface
- `startScan(Integer model, boolean enable)` - Start scanning
- `stopScan()` - Stop scanning
- `connect(Context, int model, BluetoothDevice, boolean, boolean)` - Connect to device
- `disconnect(boolean)` - Disconnect from device

### 2. LiveEventBus

Used for SDK event communication:

```java
// Device discovery
LiveEventBus.get(EventMsgConst.Discovery.EventDeviceFound, Bluetooth.class)
    .observeForever(bt -> { /* handle device found */ });

// Service ready
LiveEventBus.get(EventMsgConst.Ble.EventServiceConnectedAndInterfaceInit, Boolean.class)
    .observeForever(ready -> { /* handle service ready */ });

// Real-time data
LiveEventBus.get(InterfaceEvent.BP2.EventBp2RtData, Object.class)
    .observeForever(data -> { /* handle real-time data */ });
```

### 3. Connection Poller

Monitors GATT connections via Android's BluetoothManager:

```java
BluetoothManager manager = (BluetoothManager) getContext()
    .getSystemService(Context.BLUETOOTH_SERVICE);
List<BluetoothDevice> connected = manager.getConnectedDevices(BluetoothProfile.GATT);
```

This is necessary because the SDK doesn't always emit connection events reliably.

---

## Troubleshooting

### Issue 1: Connection Never Happens

**Symptoms:**
- `connect()` resolves successfully but `deviceConnected` event never fires
- Device appears in scan but won't connect

**Solutions:**

1. **Check MainApplication initialization:**
   ```bash
   # Check logs for:
   adb logcat | grep "BleServiceHelper initialized"
   ```
   If missing, the SDK is not initialized. Check `MainApplication.java`.

2. **Verify AAR file exists:**
   ```bash
   ls -la android/app/libs/lepu-blepro-1.0.8.aar
   ```
   If missing, add the AAR file to the libs directory.

3. **Check permissions:**
   ```bash
   adb shell dumpsys package com.priti.app | grep permission
   ```
   Verify `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, and `ACCESS_FINE_LOCATION` are granted.

4. **Check SDK logs:**
   ```bash
   adb logcat | grep "WelluePlugin"
   ```
   Look for errors like "BleServiceHelper unavailable" or "SDK connect error".

### Issue 2: Devices Not Found in Scan

**Symptoms:**
- `startScan()` resolves but no `deviceFound` events
- Device is visible in system Bluetooth settings

**Solutions:**

1. **Check if both scanners are running:**
   ```bash
   adb logcat | grep -E "SDK startScan|System BLE scanner"
   ```
   Both should log success messages.

2. **Verify Bluetooth is enabled:**
   ```javascript
   const { enabled } = await WellueSDK.isBluetoothEnabled();
   console.log('Bluetooth enabled:', enabled);
   ```

3. **Check device is in pairing mode:**
   - BP2 devices need to be in pairing/discoverable mode
   - Some devices require button press to enter pairing mode

4. **Try system scanner only:**
   - Temporarily disable SDK scanner to test if system scanner works
   - This helps isolate the issue

### Issue 3: Connection Drops Immediately

**Symptoms:**
- `deviceConnected` fires but `deviceDisconnected` fires right after
- Connection appears successful but doesn't persist

**Solutions:**

1. **Check connection poller:**
   ```bash
   adb logcat | grep "GATT connected|GATT disconnected"
   ```
   Verify the poller is detecting connections correctly.

2. **Check device battery:**
   - Low battery can cause disconnections
   - Verify device has sufficient charge

3. **Check Android version compatibility:**
   - Some Android versions have BLE bugs
   - Test on different Android versions if possible

4. **Verify interface is set correctly:**
   ```java
   // Should be called before connect
   helper.getClass().getMethod("setInterfaces", int.class, boolean.class)
       .invoke(helper, Bluetooth.MODEL_BP2, true);
   ```

### Issue 4: SDK Methods Not Found

**Symptoms:**
- `NoSuchMethodException` in logs
- Reflection errors when calling SDK methods

**Solutions:**

1. **Verify AAR version:**
   - Current version: `lepu-blepro-1.0.8.aar`
   - Different versions may have different method signatures
   - Check SDK documentation for correct method names

2. **Check Companion vs Instance:**
   - SDK may use Kotlin Companion object or instance methods
   - Code tries both approaches automatically

3. **Rebuild project:**
   ```bash
   cd android
   ./gradlew clean
   ./gradlew build
   ```

### Issue 5: Permissions Not Requested

**Symptoms:**
- App crashes or connection fails silently
- No permission dialog appears

**Solutions:**

1. **Check AndroidManifest.xml:**
   - All required permissions must be declared
   - Verify `maxSdkVersion` attributes are correct

2. **Check plugin registration:**
   - WelluePlugin must be registered in Capacitor
   - Check `MainActivity.java` for plugin registration

3. **Manual permission check:**
   ```java
   // In Android settings, manually grant:
   // - Location permission
   // - Bluetooth permission (Android 12+)
   ```

---

## Common Setup Checklist

Before testing, verify:

- [ ] AAR file `lepu-blepro-1.0.8.aar` is in `android/app/libs/`
- [ ] `MainApplication.java` initializes `BleServiceHelper` in `onCreate()`
- [ ] All permissions are declared in `AndroidManifest.xml`
- [ ] Gradle dependencies include `live-event-bus-x:1.8.0`
- [ ] `flatDir` repository is configured in `build.gradle`
- [ ] Bluetooth is enabled on device
- [ ] Location permission is granted (required for BLE scanning)
- [ ] App is built with `./gradlew clean build`

---

## Testing Connection

### Step-by-Step Test:

1. **Initialize:**
   ```javascript
   const result = await WellueSDK.initialize();
   console.log('Initialized:', result);
   ```

2. **Check Bluetooth:**
   ```javascript
   const { enabled } = await WellueSDK.isBluetoothEnabled();
   console.log('Bluetooth enabled:', enabled);
   ```

3. **Start Scan:**
   ```javascript
   await WellueSDK.startScan();
   
   // Listen for devices
   WellueSDK.addListener('deviceFound', (device) => {
       console.log('Device found:', device);
   });
   ```

4. **Connect:**
   ```javascript
   await WellueSDK.connect({ address: 'AA:BB:CC:DD:EE:FF' });
   
   // Listen for connection
   WellueSDK.addListener('deviceConnected', (device) => {
       console.log('Device connected:', device);
   });
   ```

5. **Monitor Logs:**
   ```bash
   adb logcat | grep -E "WelluePlugin|BleServiceHelper|GATT"
   ```

---

## Key Files Reference

- **Main Plugin**: `android/app/src/main/java/com/priti/wellue/WelluePlugin.java`
- **SDK Initialization**: `android/app/src/main/java/com/priti/app/MainApplication.java`
- **Manifest**: `android/app/src/main/AndroidManifest.xml`
- **Build Config**: `android/app/build.gradle`
- **BP2 Plugin**: `android/app/src/main/java/com/priti/app/plugins/Bp2Plugin.java`

---

## Additional Notes

1. **Connection Polling**: The 2-second polling interval is necessary because the SDK doesn't always emit connection events reliably. This ensures the JavaScript layer is notified of connection state changes.

2. **Dual Scanner**: Both SDK scanner and system scanner run in parallel for maximum device discovery reliability.

3. **Model Detection**: The plugin automatically detects BP2 vs BP2W models and uses appropriate SDK methods.

4. **Auto-Reconnect**: The last connected MAC address is saved to SharedPreferences for potential auto-reconnect features.

5. **Reflection Usage**: The code uses reflection extensively to avoid hard dependencies on SDK internals, making it more resilient to SDK version changes.

---

## Support

If connection issues persist:

1. Check Android logs: `adb logcat | grep -E "Wellue|BLE|Bluetooth"`
2. Verify device compatibility with BP2
3. Test on multiple Android devices/versions
4. Check SDK documentation for any version-specific requirements
5. Ensure device firmware is up to date

