# 🔍 BP2 Connection Troubleshooting Guide

## ✅ What Was Just Fixed

I've updated the iOS plugin to properly discover and connect to BP2 devices using the **official Viatom BLE profile**:

### BP2 Service & Characteristics (from Viatom LepuDemo)
- **Service UUID**: `14839AC4-7D7E-415C-9A42-167340CF2339`
- **Write Characteristic**: `8B00ACE7-EB0B-49B0-BBE9-9AEE0A26E1A3`
- **Notify Characteristic**: `0734594A-A8E7-4B1A-A6B1-CD5243059A57`

### What the Plugin Now Does
1. ✅ Scans for all BLE devices (not just filtered by service)
2. ✅ Connects to device when you tap "Connect"
3. ✅ **Discovers the BP2 service** after connection
4. ✅ **Finds the Write and Notify characteristics**
5. ✅ **Enables notifications** on the Notify characteristic
6. ✅ Emits `deviceReady` event when fully configured

---

## 🧪 Testing Steps

### Step 1: Prepare Your BP2 Device
1. **Power OFF** the BP2 completely
2. **Wait 5 seconds**
3. **Power ON** the BP2
4. Watch for **Bluetooth icon blinking** (indicates advertising)
5. **DO NOT** open ViHealth or any other Wellue app

### Step 2: Prepare Your iPhone
1. Go to **Settings** → **Bluetooth**
2. If you see "BP2" or any Wellue device in "My Devices":
   - Tap the (i) icon next to it
   - Tap **"Forget This Device"**
3. **Close Settings**
4. **Kill the Monitraq app** if running (swipe up from bottom, swipe Monitraq away)

### Step 3: Fresh Scan
1. **Open Monitraq app** on your iPhone
2. Navigate to the **Bluetooth Scanner** page
3. Click **"Start Scan"**
4. Keep the **app in foreground** (don't minimize)
5. Watch your terminal for logs (see below)

### Step 4: Connect to Device
1. When BP2 appears in the scan list, tap **"Connect"**
2. Watch terminal for service discovery logs
3. Wait for "BP2 device fully configured and ready!" message

---

## 📊 What to Look For in Logs

When you start the app, you should see:

```
🔵 [WELLUE SDK] Plugin loaded - Starting initialization
🔵 [WELLUE SDK] Viatom SDK initialized successfully
🔵 [WELLUE SDK] Bluetooth state changed to: true
```

When you click "Start Scan":

```
🔵 [WELLUE SDK] Starting Core Bluetooth scan
```

When BP2 is discovered:

```
🔵 [WELLUE SDK] Discovered device: BP2-XXXX (ID: YYYY) RSSI=-XX
🔵 [WELLUE SDK] Adv local name: BP2-XXXX
🔵 [WELLUE SDK] Notifying listeners of discovered device (deviceFound)
```

When you click "Connect":

```
🔵 [WELLUE SDK] Attempting to connect to device: BP2-XXXX
✅ [WELLUE SDK] Successfully connected to device: BP2-XXXX
🔵 [WELLUE SDK] Set peripheral delegate, discovering BP2 service...
🔵 [WELLUE SDK] Services discovered: X
🔵 [WELLUE SDK] Found service: 14839AC4-7D7E-415C-9A42-167340CF2339
✅ [WELLUE SDK] BP2 service found! Discovering characteristics...
🔵 [WELLUE SDK] Characteristics discovered for service: 14839AC4...
🔵 [WELLUE SDK] Found characteristic: 8B00ACE7-EB0B-49B0-BBE9-9AEE0A26E1A3
✅ [WELLUE SDK] BP2 Write characteristic found!
🔵 [WELLUE SDK] Found characteristic: 0734594A-A8E7-4B1A-A6B1-CD5243059A57
✅ [WELLUE SDK] BP2 Notify characteristic found! Enabling notifications...
✅ [WELLUE SDK] Notifications enabled for characteristic: 0734594A...
✅ [WELLUE SDK] BP2 device fully configured and ready!
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "No services found"
**Symptoms:** After connection, logs show "Services discovered: 0"

**Solutions:**
- Device is already connected to another app → Forget device in Settings
- Device is in sleep mode → Power cycle the BP2
- Device firmware is old → Check for Wellue firmware updates

### Issue 2: "Service found but no characteristics"
**Symptoms:** Service `14839AC4...` is found but characteristics discovery fails

**Solutions:**
- iOS cached old service data → Restart iPhone
- Device requires pairing/bonding → iOS should show pairing dialog automatically
- Signal too weak → Move iPhone closer to BP2

### Issue 3: "XPC connection invalid" errors
**Symptoms:** Logs show `CoreBluetooth XPC connection invalid`

**Solutions:**
- This is normal during init → Ignore these unless they persist
- If persistent → Restart iPhone Bluetooth (Settings → toggle off/on)

### Issue 4: Device appears but connection times out
**Symptoms:** Tap "Connect" but nothing happens for 30+ seconds

**Solutions:**
- Device is advertising but not accepting connections → Power cycle BP2
- Another device is connected → Check ViHealth app is closed
- iOS Bluetooth stack is stuck → Restart iPhone

### Issue 5: "CoreBluetooth authStatus: CBManagerAuthorizationAllowedAlways" but still no devices
**Symptoms:** Permission granted but scan finds nothing

**Solutions:**
- BP2 is not advertising → Check BP2 power and battery
- BP2 is in measurement mode → Let current measurement finish
- Scan timeout → Try stopping and starting scan again

---

## 🔧 Advanced Debugging

### Test with nRF Connect App
1. Download **nRF Connect** from App Store
2. Open it and scan for devices
3. Find your BP2 device
4. Tap "Connect"
5. Look for service `14839AC4-7D7E-415C-9A42-167340CF2339`
6. If you DON'T see this service → Device issue/firmware
7. If you DO see this service → App integration issue

### Check if Another App is Connected
```bash
# On your Mac, check if device is bonded/paired
system_profiler SPBluetoothDataType | grep -A 10 "BP2"
```

### Force Clear iOS Bluetooth Cache
1. **Settings** → **General** → **Transfer or Reset iPhone**
2. Tap **"Reset"**
3. Tap **"Reset Network Settings"** (WARNING: clears WiFi passwords too)
4. Enter passcode
5. This clears all Bluetooth pairings and cache

---

## 📱 Expected Behavior

### Correct Flow
```
1. Open app → Plugin loads → Viatom SDK initializes
2. Click "Start Scan" → CoreBluetooth scans → Devices appear
3. Click "Connect" → Connection establishes
4. Service discovery → BP2 service found
5. Characteristic discovery → Write + Notify chars found
6. Enable notifications → Ready for measurements
7. Click "Start BP" → Measurement begins → Real-time data flows
```

### What Logs Should Show
```
🔵 Init → ✅ Connected → 🔵 Discovering → ✅ Service found → ✅ Chars found → ✅ Ready
```

If you see all green checkmarks (✅) in sequence, the device is properly connected!

---

## 🎯 Quick Checklist Before Each Test

- [ ] BP2 is powered ON and blinking Bluetooth icon
- [ ] BP2 is NOT connected to ViHealth or other apps
- [ ] BP2 is NOT in iPhone Settings → Bluetooth paired devices
- [ ] Monitraq app is in FOREGROUND (not minimized)
- [ ] iPhone Bluetooth is ON
- [ ] You're watching terminal logs in real-time
- [ ] BP2 is within 3 feet of iPhone (good signal)

---

## 💡 If Still Not Working

Try this nuclear option:

1. **Completely reset BP2**:
   - Remove battery or long-press power to fully shut down
   - Wait 30 seconds
   - Power back on

2. **Reset iPhone Bluetooth**:
   - Settings → Bluetooth → Toggle OFF
   - Wait 10 seconds
   - Toggle back ON

3. **Relaunch app**:
   ```bash
   xcrun devicectl device process launch --device 00008140-001C65993AE3001C com.priti.app
   ```

4. **Test immediately** while watching logs

---

## 📞 Support References

- Viatom LepuDemo (shows BP2 UUIDs): https://github.com/viatom-develop/LepuDemo
- Wellue Connection Troubleshooting: https://getwellue.com/blogs/wellue-stories/how-to-set-up-o2ring-app
- Nordic BLE Connection Guide: https://devzone.nordicsemi.com/

---

## ✨ What's New in This Build

The app now:
- ✅ Scans for **all** BLE devices (not just those advertising BP2 service)
- ✅ **Discovers BP2 custom service** after connection
- ✅ **Subscribes to notifications** automatically
- ✅ **Logs every step** of the connection process
- ✅ **Emits `deviceReady` event** when fully configured

**The app is running on your iPhone now. Try the testing steps above!** 🚀

