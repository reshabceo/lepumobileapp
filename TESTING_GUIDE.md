# Testing Guide for Rewritten BP Measurement Functionality

## Overview
This guide will help you test the completely rewritten BP measurement functionality to ensure everything works as expected. The new implementation provides a clean, modular architecture with proper separation of concerns.

## Prerequisites
1. **Device**: Wellue BP2 device with fresh batteries
2. **Android Device**: Physical Android device (not emulator) with Bluetooth 4.0+
3. **App**: Built and installed from the latest code
4. **Permissions**: Bluetooth, Location, and Storage permissions granted

## Testing Checklist

### 1. Initial Setup and Permissions ✅
- [ ] App launches without crashes
- [ ] Bluetooth permission request appears
- [ ] Location permission request appears
- [ ] All permissions are granted
- [ ] Bluetooth is enabled on device

### 2. Device Discovery and Connection ✅
- [ ] Open `WellueSDKScanner` component
- [ ] Click "Start Scan" button
- [ ] Device appears in scan results within 10 seconds
- [ ] Device shows correct name and RSSI
- [ ] Click on device to connect
- [ ] Connection status shows "Connected"
- [ ] Device appears in connected devices list

### 3. BP Measurement Initiation from App ✅
- [ ] Navigate to `LiveBPMonitor` page
- [ ] Ensure device is connected
- [ ] Click "Start BP Measurement" button
- [ ] Device should start inflating cuff
- [ ] UI shows "Starting" status
- [ ] Progress updates appear (inflating → holding → deflating → analyzing)
- [ ] Real-time pressure values update
- [ ] Measurement completes with results

### 4. Device-Initiated BP Measurement Detection ✅
- [ ] Keep app open on `LiveBPMonitor` page
- [ ] **On the device**: Press the start button to begin measurement
- [ ] App should automatically detect the measurement start
- [ ] UI should update to show "Starting" status
- [ ] Progress updates should appear as measurement progresses
- [ ] Results should be displayed when complete

### 5. BP Measurement Results Display ✅
- [ ] Systolic pressure displayed correctly
- [ ] Diastolic pressure displayed correctly
- [ ] Pulse rate displayed correctly
- [ ] Quality indicator shows (good/fair/poor)
- [ ] Timestamp is accurate
- [ ] Results are saved/historical data accessible

### 6. Real-time Updates During Measurement ✅
- [ ] Pressure values update in real-time
- [ ] Status changes are reflected immediately
- [ ] Progress bar/indicator updates smoothly
- [ ] No UI freezing or lag during measurement

### 7. Error Handling ✅
- [ ] Disconnect device during measurement
- [ ] App should show appropriate error message
- [ ] Measurement state should reset properly
- [ ] Reconnection should work after error

### 8. ECG Monitoring Integration ✅
- [ ] Navigate to `ECGMonitor` page
- [ ] Device connection maintained
- [ ] ECG measurement can be started
- [ ] Real-time ECG data displayed
- [ ] Stored ECG files can be accessed

### 9. Battery and Device Status ✅
- [ ] Battery level displayed correctly
- [ ] Device status updates in real-time
- [ ] Connection status remains stable
- [ ] Device info accessible

### 10. Cross-Platform Compatibility ✅
- [ ] Works on different Android versions
- [ ] Works with different screen sizes
- [ ] UI adapts to orientation changes
- [ ] No crashes on background/foreground transitions

## Common Issues and Solutions

### Issue: Device Not Found During Scan
**Symptoms**: Scan runs but no devices appear
**Solutions**:
- Ensure device is in pairing mode
- Check Bluetooth permissions
- Verify device has fresh batteries
- Try restarting Bluetooth on Android device

### Issue: Connection Fails
**Symptoms**: Device appears but connection fails
**Solutions**:
- Check if device is already connected to another app
- Ensure device is not in measurement mode
- Try forgetting device in Bluetooth settings and re-pairing
- Restart the app

### Issue: BP Measurement Won't Start
**Symptoms**: Button click doesn't initiate measurement
**Solutions**:
- Verify device is connected and ready
- Check device battery level
- Ensure no other measurement is in progress
- Try disconnecting and reconnecting device

### Issue: No Real-time Updates
**Symptoms**: Measurement starts but no progress updates
**Solutions**:
- Check console for error messages
- Verify event listeners are properly set up
- Ensure device is sending progress data
- Check Bluetooth connection stability

### Issue: App Crashes During Measurement
**Symptoms**: App closes unexpectedly during BP measurement
**Solutions**:
- Check device memory usage
- Verify all permissions are granted
- Check console for crash logs
- Try on a different device

## Performance Benchmarks

### Expected Response Times
- **Device Discovery**: < 10 seconds
- **Connection**: < 5 seconds
- **Measurement Start**: < 2 seconds
- **Real-time Updates**: < 100ms delay
- **Results Display**: < 1 second after completion

### Memory Usage
- **Idle State**: < 100MB
- **During Scan**: < 150MB
- **During Measurement**: < 200MB
- **Peak Usage**: < 250MB

## Testing Scenarios

### Scenario 1: Normal Flow
1. Launch app → Grant permissions → Scan → Connect → Start BP → Complete → View results
2. **Expected**: Smooth flow with all steps working

### Scenario 2: Interrupted Measurement
1. Start BP measurement → Disconnect device mid-measurement → Reconnect → Check state
2. **Expected**: Error handling, state reset, reconnection works

### Scenario 3: Multiple Measurements
1. Complete BP measurement → Start another immediately → Complete → Check history
2. **Expected**: Multiple measurements work, history maintained

### Scenario 4: Background/Foreground
1. Start measurement → Put app in background → Return to app → Check state
2. **Expected**: Measurement continues, state preserved

### Scenario 5: Device-Initiated Measurement
1. Keep app open → Start measurement on device → Observe app response
2. **Expected**: App detects and displays measurement progress

## Success Criteria

The implementation is considered successful when:
- ✅ All 10 testing checklist items pass
- ✅ No crashes or critical errors occur
- ✅ Performance meets benchmark requirements
- ✅ All testing scenarios work as expected
- ✅ UI remains responsive throughout
- ✅ Data is accurately captured and displayed

## Reporting Issues

If you encounter issues during testing:
1. **Document the exact steps** that led to the issue
2. **Note the device model and Android version**
3. **Check console logs** for error messages
4. **Take screenshots** of any error states
5. **Test on different devices** if possible

## Next Steps After Testing

Once testing is complete and all functionality works:
1. **Performance optimization** if needed
2. **UI/UX improvements** based on testing feedback
3. **Additional features** like data export, cloud sync
4. **Documentation updates** for end users
5. **Production deployment** preparation

---

**Note**: This testing guide covers the core BP measurement functionality. Additional testing may be needed for specific use cases or edge conditions.
