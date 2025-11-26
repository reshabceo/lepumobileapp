# Install Updated App and Test BP2 Connection

✅ **Build Complete!** Your app has been rebuilt with the BP2 connection fix.

Android Studio is now opening...

---

## 📱 Step 1: Connect Your Android Phone

**Before Android Studio finishes loading:**

1. **Enable Developer Mode on your phone:**
   - Go to Settings > About Phone
   - Tap "Build Number" 7 times
   - You'll see "You are now a developer!"

2. **Enable USB Debugging:**
   - Go to Settings > System > Developer Options
   - Enable "USB Debugging"
   - Enable "Install via USB" (if available)

3. **Connect phone to computer:**
   - Use a USB cable
   - When prompted on phone, tap "Allow USB Debugging"
   - Check "Always allow from this computer"

---

## 🔨 Step 2: Build and Install in Android Studio

**Once Android Studio opens (may take 1-2 minutes):**

1. **Wait for Gradle sync to complete**
   - Look at bottom of Android Studio
   - Wait for "Gradle sync finished" message
   - This may take 2-5 minutes on first open

2. **Select your device:**
   - Look at top toolbar
   - Click device dropdown (next to green play button ▶️)
   - Your phone should appear in the list
   - If not showing, try:
     - Unplug and replug USB cable
     - Check phone for "Allow USB Debugging" popup
     - Click "Refresh" button in device dropdown

3. **Run the app:**
   - Click the green "Run" button ▶️ at top
   - **OR** press `Shift + F10` (keyboard shortcut)
   - Wait for build to complete (2-5 minutes first time)

4. **Watch the build progress:**
   - Bottom of Android Studio shows build status
   - Wait for "BUILD SUCCESSFUL"
   - App will automatically install and launch on your phone

---

## 🩺 Step 3: Prepare Your BP2 Device

**IMPORTANT: Do this BEFORE scanning in the app**

1. **Turn OFF your BP2 device completely**
   - Press and hold power button until it turns off
   - Wait 5 seconds

2. **Put BP2 in pairing mode:**
   - Press power button once to turn ON
   - **Immediately** press and hold power button for 3-5 seconds
   - Release when LED starts blinking
   - **LED should blink rapidly** = pairing mode active

3. **Keep device close:**
   - Place BP2 within 1-2 meters of your phone
   - No metal obstacles between them
   - Keep it there during scanning

4. **Timing is critical:**
   - BP2 pairing mode usually lasts 30-60 seconds
   - If LED stops blinking, repeat step 2
   - Start scan in app **within 30 seconds** of entering pairing mode

---

## 🔍 Step 4: Open Logcat (IMPORTANT!)

**This shows you what's happening behind the scenes:**

1. **In Android Studio, look at bottom tabs**
2. **Click "Logcat" tab**
3. **In the filter box at top, type:** `WelluePlugin`
4. **Clear old logs:** Click trash icon (🗑️) on left
5. **Keep Logcat visible** while testing

**What you should see in Logcat:**
```
🔍 Starting native Bluetooth scan...
SDK startScan via Companion OK
🛰️ System BLE scanner started - scanning for ALL devices (no UUID filter)
```

---

## 🎯 Step 5: Test BP2 Connection

**On your phone (with app running):**

1. **Go to Health Dashboard** (main screen with vitals)

2. **Look for BP2 device status** (top of screen)
   - Should show "BP2 - Not Connected"

3. **Tap the "Connect" button**

4. **Watch your phone screen AND Android Studio Logcat**

5. **Expected behavior:**

   **On Phone:**
   ```
   Scanning for devices...
   Refreshing scan...
   ✅ Found 1 device(s) on attempt 1
   Connecting to [Device Name]...
   ✅ Connected! Successfully connected to [Device Name]
   ```

   **In Logcat:**
   ```
   🛰️ ===== BLUETOOTH DEVICE FOUND =====
   🛰️ Device Name: BP2
   🛰️ MAC Address: AA:BB:CC:DD:EE:FF
   🛰️ Signal Strength (RSSI): -65 dBm
   🩺 ⭐ POSSIBLE BP2 DEVICE DETECTED! ⭐
   🛰️ =====================================
   ```

---

## ✅ Success Indicators

### You'll know it's working when:

**1. In Logcat you see:**
- ✅ "System BLE scanner started - scanning for ALL devices"
- ✅ "BLUETOOTH DEVICE FOUND"
- ✅ Device Name shown (BP2, Viatom, Lepu, or even "Unknown")
- ✅ MAC Address shown (like AA:BB:CC:DD:EE:FF)

**2. On your phone you see:**
- ✅ "Found X device(s)" message
- ✅ Device name appears
- ✅ "Connecting to..." message
- ✅ Green checkmark: "✅ Connected!"
- ✅ BP2 status changes from red to green

**3. Connection is stable:**
- ✅ Can start BP measurement
- ✅ See pressure readings
- ✅ Get final BP results

---

## ⚠️ Troubleshooting

### Problem: "No devices found"

**Check Logcat:**

If you see NOTHING in Logcat:
- ❌ Logcat filter might be wrong - try removing filter (leave blank)
- ❌ App might not be running - check phone screen

If you see "Scan started" but NO "DEVICE FOUND":
- ❌ BP2 not in pairing mode - LED should be blinking
- ❌ BP2 is OFF or dead battery
- ❌ BP2 too far away - move closer (<2 meters)
- ❌ Permissions not granted - check next section

---

### Problem: "Bluetooth not available or disabled"

**In Logcat you see:**
```
❌ Bluetooth not available or disabled
```

**Fix:**
1. Open phone Settings > Bluetooth
2. Make sure Bluetooth is ON (blue toggle)
3. Try scan again

---

### Problem: "Bluetooth permissions not granted"

**In Logcat you see:**
```
❌ Bluetooth permissions not granted
startScan awaiting permissions...
```

**Fix:**
1. Open phone Settings
2. Go to Apps > Your App Name (Monitraq or Priti)
3. Tap Permissions
4. Grant these permissions:
   - ✅ Location → Allow all the time (or While using app)
   - ✅ Nearby devices → Allow (Android 12+)
   - ✅ Bluetooth → Allow
5. Restart the app
6. Try again

---

### Problem: See devices but none are BP2

**In Logcat you see:**
```
🛰️ Device Name: Unknown
🛰️ Device Name: Galaxy Watch
🛰️ Device Name: AirPods
```

**But NO BP2...**

**Try this:**
1. **Turn OFF BP2 completely**
2. **Clear Logcat** (click trash icon 🗑️)
3. **Turn ON BP2 + hold power button 3-5 seconds**
4. **Watch LED - must be blinking!**
5. **In app, tap "Connect" button again**
6. **Watch Logcat for NEW devices**

**If still no BP2:**
- BP2 might advertise as "Unknown" - check MAC addresses
- Try pressing BP2 power button multiple times
- Check BP2 battery - might be dead
- Test with "BLE Scanner" app from Play Store

---

### Problem: Device found but connection fails

**In Logcat you see:**
```
🛰️ ===== BLUETOOTH DEVICE FOUND =====
🛰️ Device Name: BP2
...then later...
❌ Failed to connect
```

**This means scan is working but connection logic has issues.**

**Copy the ENTIRE Logcat output and share it** - I'll help debug the connection logic.

---

## 📊 What to Report Back

**If it works:** 🎉
- ✅ "Connected successfully!"
- Tell me: Device name that worked
- Tell me: How long scan took to find it

**If it doesn't work:** 
Please share:
1. **Screenshot of your phone screen** (showing error message)
2. **Full Logcat output** (copy all text from Logcat tab)
3. **BP2 LED status** (off, solid, or blinking?)
4. **Any devices found?** (even if not BP2)
5. **Permissions granted?** (Settings > Apps > Permissions)

---

## 🎯 Quick Test Checklist

Before asking for help, verify:

- [ ] App installed from Android Studio (not old version)
- [ ] Phone connected via USB during test
- [ ] Logcat open and filter set to "WelluePlugin"
- [ ] Bluetooth enabled on phone (Settings > Bluetooth)
- [ ] BP2 device turned ON and LED blinking
- [ ] BP2 within 2 meters of phone
- [ ] Permissions granted (Location, Bluetooth, Nearby devices)
- [ ] Tapped "Connect" button in app
- [ ] Watched both phone screen AND Logcat
- [ ] Waited at least 15 seconds for scan

---

## 🚀 Expected Timeline

- **Android Studio opens:** 1-2 minutes
- **Gradle sync:** 2-5 minutes
- **App build & install:** 2-5 minutes
- **BP2 scan:** 4-10 seconds
- **Connection:** 2-5 seconds
- **Total:** ~10-15 minutes

---

## 💡 Pro Tips

1. **Keep Logcat open at all times** - It's your debugging window
2. **Clear Logcat before each test** - Easier to see new logs
3. **Take screenshots** - Helpful for troubleshooting
4. **Test multiple times** - Bluetooth can be flaky
5. **Keep BP2 close** - Signal strength matters
6. **Fresh pairing mode each time** - Turn BP2 off/on between attempts

---

## ✨ You're Ready!

The app is building now. Follow the steps above and let me know what you see!

**Most likely outcome:** You'll see your BP2 device in the logs and connect successfully! 🎉

**Good luck!** 🚀

---

**Need Help?** Share your Logcat output and I'll help debug further.

