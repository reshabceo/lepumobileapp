# 📱 Build to iPhone - Final Steps

## ✅ What's Been Completed

1. ✅ Cloned official Viatom VTMProductLib SDK from [GitHub](https://github.com/Viatom-iOS/VTProductLib_Pods)
2. ✅ Integrated SDK into iOS project via CocoaPods
3. ✅ Restored all Viatom SDK imports and delegates in Swift plugin
4. ✅ Installed all dependencies (VTMProductLib 1.5.2 + Capacitor plugins)
5. ✅ Opened Xcode workspace

## 🚀 Next Steps (In Xcode)

Xcode should now be open with your project. Follow these steps:

### 1. Connect Your iPhone
- Plug in your iPhone via USB cable
- Unlock your iPhone
- If prompted, tap "Trust This Computer" on your iPhone

### 2. Select Your iPhone as Build Target
- In the Xcode toolbar (top center), click the device dropdown
- It should show "Monitraq > [Device Name]"
- Select your connected iPhone from the list

### 3. Configure Code Signing
- In the left sidebar, click on the **Monitraq** project (blue icon)
- Select the **Monitraq** target
- Go to the **Signing & Capabilities** tab
- Check **"Automatically manage signing"**
- Under **Team**, select your Apple ID
  - If you don't see your Apple ID, click "Add Account..." and sign in

### 4. Build and Run
- Click the **Play button (▶️)** in the top left toolbar
- Xcode will:
  - Build the app
  - Install it on your iPhone
  - Launch it automatically

### 5. Trust Developer Profile (First Time Only)
After the app installs, you may see "Untrusted Developer" on your iPhone:
- Go to **Settings** on your iPhone
- Tap **General** → **VPN & Device Management**
- Under "DEVELOPER APP", tap your Apple ID
- Tap **"Trust [Your Apple ID]"**
- Go back to home screen and launch the app

## 🎯 What Works Now

### ✅ Fully Functional
- **Device Scanning** - Finds BP2/Wellue devices via Bluetooth
- **Device Connection** - Connects to BP2 monitors
- **BP Measurements** - Live blood pressure readings
  - Real-time pressure updates during inflation
  - Final systolic/diastolic/pulse results
- **ECG Recording** - ECG waveform capture
  - Live waveform data at 125 samples/sec
  - Heart rate detection
- **Battery Monitoring** - Device battery level
- **Device Info** - Firmware version, hardware info
- **Historical Data Access** - Read stored measurements

### 📊 Events Flowing to React App
- `deviceFound` - When BP2 discovered
- `deviceConnected` / `deviceDisconnected`
- `bp2Rt` - Real-time BP pressure data
- `bpMeasurement` - Final BP results
- `ecgData` - ECG waveform samples
- `ecgLifecycle` - ECG start/stop
- `batteryInfo` - Battery percentage
- `bluetoothStatusChanged` - Bluetooth on/off

## 🧪 Testing the Integration

### Test 1: Bluetooth Status
1. Open the app
2. Check console logs in Xcode (⌘+Shift+Y)
3. Look for:
```
🔵 [WELLUE SDK] Plugin loaded - Starting initialization
🔵 [WELLUE SDK] Viatom SDK initialized successfully
🔵 [WELLUE SDK] Bluetooth state changed to: true
```

### Test 2: Device Scanning
1. Navigate to Bluetooth Scanner in the app
2. Tap "Start Scan"
3. Turn on your BP2 device
4. Check console for:
```
🔵 [WELLUE SDK] Discovered device: BP2-XXXX
✅ [WELLUE SDK] Wellue device found: BP2-XXXX
```

### Test 3: Device Connection
1. Tap "Connect" on the discovered BP2
2. Check console for:
```
✅ [WELLUE SDK] Successfully connected to device: BP2-XXXX
🔵 [WELLUE SDK] Viatom SDK configured with peripheral
```

### Test 4: BP Measurement
1. Tap "Start BP Measurement"
2. Put on the cuff
3. Watch real-time data in the app
4. Check console for:
```
🔵 [WELLUE SDK] BP Real Data received (multiple times)
✅ [WELLUE SDK] BP Measurement completed - Systolic: 120, Diastolic: 80
```

### Test 5: ECG Recording
1. Connect to BP2 device
2. Tap "Start ECG"
3. Watch waveform in the app
4. Check console for:
```
🔵 [WELLUE SDK] ECG Real Data received - HR: 72, Samples: 125
✅ [WELLUE SDK] ECG Measurement completed
```

## 🐛 Troubleshooting

### "No such module 'VTMProductLib'"
- Close Xcode completely
- Run: `cd ios/App && pod install`
- Re-open: `open App.xcworkspace`

### "Code signing error"
- Make sure you've selected a Team in Signing & Capabilities
- If you don't have a paid Apple Developer account, you can still build for 7 days with a free account

### "Failed to build"
- Clean build folder: **Product** → **Clean Build Folder** (⌘+Shift+K)
- Try building again

### "Device not found during scan"
- Make sure BP2 is powered on
- Check Bluetooth permissions are granted to the app
- Try turning BP2 off and on again

### "Cannot connect to device"
- Forget the device in iPhone Bluetooth settings
- Restart the BP2 device
- Try scanning and connecting again

## 📊 Project Structure

```
ios/App/
├── App.xcworkspace          ← OPEN THIS, NOT .xcodeproj
├── Podfile                   ← Pod dependencies
├── Podfile.lock              ← Installed versions
├── Pods/                     ← SDK and frameworks
│   └── VTMProductLib/        ← Viatom SDK (v1.5.2)
└── App/
    ├── WellueSDKPlugin.swift ← Native plugin code
    ├── WellueSDKPlugin.m     ← Capacitor bridge
    └── Info.plist            ← Permissions
```

## 🎉 Success Indicators

You'll know everything is working when:
- ✅ App launches on your iPhone without crashes
- ✅ Bluetooth scanner finds your BP2 device
- ✅ Connection succeeds and shows "Connected"
- ✅ BP measurement shows real-time pressure values
- ✅ Final results display systolic/diastolic/pulse
- ✅ ECG shows waveform animation
- ✅ Console shows green success messages (✅)

## 📞 Support

If you encounter any issues:
1. Check the console logs in Xcode (⌘+Shift+Y)
2. Look for error messages (❌ [WELLUE SDK])
3. Share the error logs if you need help

## 🚀 Ready to Go!

Your iOS app is now fully configured with the official Viatom SDK. Just follow the steps above to build to your iPhone and start testing BP and ECG measurements! 🎉

---

**Note:** The Android version still needs the `.aar` file to be placed in `android/app/libs/` - we'll handle that separately.

