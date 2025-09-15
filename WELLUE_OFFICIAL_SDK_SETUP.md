# Wellue Official SDK Setup Guide

## Overview
This guide explains how to properly integrate the official Wellue VTProductLib SDK for BP2 device support.

## Official SDK Information
- **Repository**: [viatom-dev/VTProductLib](https://github.com/viatom-dev/VTProductLib)
- **Device**: Wellue BP2 Blood Pressure Monitor
- **Platform**: iOS 9.0+
- **Language**: Objective-C/Swift

## Changes Made

### 1. Podfile Updates
```ruby
target 'App' do
  capacitor_pods
  pod 'VTProductLib'  # Official Wellue SDK for BP2 device
end
```

### 2. iOS Plugin Rewrite
- Replaced custom implementation with official VTProductLib integration
- Added proper VTMProductDelegate implementation
- Implemented BP2-specific device detection and communication
- Added real-time data handling for BP measurements

### 3. Permissions Updated
- Added comprehensive Bluetooth permissions for Wellue devices
- Updated permission descriptions to be device-specific

## Installation Steps

### 1. Install Dependencies
```bash
cd ios/App
pod install
```

### 2. Clean and Rebuild
1. Open `ios/App/App.xcworkspace` in Xcode
2. Product → Clean Build Folder
3. Build and run on physical device

### 3. Test Bluetooth Detection
1. Launch app on physical iOS device
2. Check if Bluetooth status shows "Enabled"
3. Try scanning for devices
4. Look for BP2 devices in the scan results

## Expected Behavior

### ✅ Bluetooth Status Detection
- App should detect when Bluetooth is ON/OFF
- Status should update in real-time
- "Check BT Status" button should work

### ✅ Device Discovery
- Scan should find Wellue BP2 devices
- Devices should appear in "Found Devices" list
- Device names should show as "BP2" or "Wellue"

### ✅ Device Connection
- Should be able to connect to discovered BP2 devices
- Connection status should update properly
- Battery level should be retrievable

### ✅ BP Measurement
- Should be able to start BP measurements
- Real-time pressure data should be received
- Final measurement results should be displayed

## Debugging

### Console Logs to Look For
```
🔵 WellueSDK Plugin loaded with VTProductLib
🔵 VTProductLib initialized
🔵 iOS Bluetooth state changed to: true
🔍 iOS discovered device: BP2 (UUID)
✅ VTProductLib: Device connected - BP2
🩺 BP Measurement result: SYS=120, DIA=80, HR=72
```

### Common Issues

1. **Bluetooth Not Detected**
   - Check if device has Bluetooth enabled
   - Verify permissions are granted
   - Check console for initialization errors

2. **No Devices Found**
   - Ensure BP2 device is in pairing mode
   - Check if device name contains "BP2" or "Wellue"
   - Verify Bluetooth scanning is working

3. **Connection Failed**
   - Check if device is already connected to another app
   - Verify device is in range
   - Check console for connection errors

## Key Differences from Custom Implementation

1. **Official SDK Integration**: Uses VTProductLib instead of custom CoreBluetooth
2. **Device-Specific**: Optimized for BP2 device communication
3. **Real-time Data**: Proper handling of live BP measurement data
4. **Battery Monitoring**: Accurate battery level reporting
5. **File Management**: Access to stored measurement files

## Next Steps

1. Test the integration on a physical device
2. Verify BP2 device detection and connection
3. Test BP measurement functionality
4. Monitor console logs for any issues
5. Update UI to reflect proper device status

## Support

- Official SDK Documentation: [VTProductLib GitHub](https://github.com/viatom-dev/VTProductLib)
- Device Compatibility: Wellue BP2 Blood Pressure Monitor
- iOS Version: 9.0 or later
