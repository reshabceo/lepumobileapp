# iOS SDK Implementation - Revised Plan

Based on analysis of the official VTProductLib SDK (v1.5.2) from GitHub and comparison with current implementation.

## SDK Overview

**Repository**: https://github.com/viatom-dev/VTProductLib  
**Version**: 1.5.2 (from Podfile.lock)  
**Framework**: VTMProductLib.xcframework  
**Integration**: CocoaPods (local path: `../../VTProductLib_Pods`)

---

## Key SDK Components

### 1. Main Communication Class: `VTMURATUtils`

**Purpose**: Handles all Bluetooth communication with Viatom devices

**Key Properties**:
```swift
var peripheral: CBPeripheral?  // Connected peripheral
var delegate: VTMURATUtilsDelegate?  // Command callbacks
var deviceDelegate: VTMURATDeviceDelegate?  // Connection callbacks
var currentType: VTMDeviceType  // Detected device type
```

**Key Methods for BP2**:
- `requestDeviceInfo()` - Get device information
- `requestBatteryInfo()` - Get battery status
- `requestBPRealData()` - Get real-time BP data (Command 0x08)
- `bp_requestRealStatus()` - Get run status (Command 0x06)
- `requestChangeBPState(_ state: UInt8)` - Change device state (Command 0x09)
- `requestBPConfig()` - Get BP configuration
- `syncBPConfig(_ config: VTMBPConfig)` - Sync BP configuration
- `syncTime(_ date: Date?)` - Sync device time

### 2. Data Parser: `VTMBLEParser`

**Purpose**: Parse raw protocol data into structured types

**Key Parsing Methods for BP2**:
```swift
// Real-time data parsing
parseBPRealTimeData(_ data: Data) -> VTMBPRealTimeData
parseBPRealTimeStatus(_ data: Data) -> VTMBPRunStatus
parseBPRealTimePressure(_ data: Data) -> VTMRealTimePressure
parseBPMeasuringData(_ data: Data) -> VTMBPMeasuringData
parseBPEndMeasureData(_ data: Data) -> VTMBPEndMeasureData

// File parsing
parseBPResult(_ data: Data) -> VTMBPBPResult
parseECGResult(_ data: Data) -> VTMBPECGResult
parseBPPoints(_ data: Data) -> [NSNumber]  // ECG waveform points

// Utility
bpMvFromShort(_ n: Int16) -> Float  // Convert ECG sample to mV
```

### 3. Delegates

#### `VTMURATDeviceDelegate`
```swift
// Called when SDK handshake completes
func utilDeployCompletion(_ util: VTMURATUtils)

// Called if deployment fails
func utilDeployFailed(_ util: VTMURATUtils)

// RSSI updates
func util(_ util: VTMURATUtils, updateDeviceRSSI rssi: NSNumber)
```

#### `VTMURATUtilsDelegate`
```swift
// Command completion with response data
func util(_ util: VTMURATUtils, 
          commandCompletion cmdType: UInt8, 
          deviceType: VTMDeviceType, 
          response: Data?)

// Command failed
func util(_ util: VTMURATUtils, 
          commandFailed cmdType: UInt8, 
          deviceType: VTMDeviceType, 
          failedType: VTMBLEPkgType)

// Command send failed (peripheral issues)
func util(_ util: VTMURATUtils, commandSendFailed errorCode: UInt8)
```

### 4. Enums and Constants

**Device Types**:
```swift
enum VTMDeviceType: UInt8 {
    case unknown = 0
    case ECG = 1      // ER1/ER2/VBeat/DuoEK
    case BP = 2       // BP2/BP2A/BP2T/BP2W/BP2Pro
    case scale = 3
    case ER3 = 4
    // ...
}
```

**BP Commands**:
```swift
enum VTMBPCmd: UInt8 {
    case getConfig = 0x00
    case getRealPressure = 0x05
    case getRealStatus = 0x06
    case getRealWave = 0x07
    case getRealData = 0x08      // Main real-time data command
    case swiRunStatus = 0x09     // Switch device status
    case startMeasure = 0x0A
    case setConfig = 0x0B
}
```

**BP Status Values**:
```swift
enum VTMBPStatus: UInt8 {
    case sleep = 0
    case memery = 1              // Browser records
    case charge = 2               // Charging
    case ready = 3                // Power on, ready
    case bpMeasuring = 4          // BP measuring
    case bpMeasureEnd = 5         // BP measure finished
    case ecgMeasuring = 6         // ECG measuring
    case ecgMeasureEnd = 7        // ECG measure finished
}
```

**Target Status (for Command 0x09)**:
```swift
enum VTMBPTargetStatus: UInt8 {
    case bp = 0        // Start BP measurement
    case ecg = 1       // Start ECG measurement
    case history = 2   // Browser records
    case start = 3     // Power on
    case end = 4       // Power off
}
```

---

## Current Implementation Analysis

### ✅ What's Working Correctly

1. **SDK Initialization**: 
   ```swift
   viatomUtils = VTMURATUtils()
   viatomUtils?.delegate = self
   ```
   ✅ Correct

2. **Connection Flow**:
   ```swift
   viatomUtils?.peripheral = peripheral
   viatomUtils?.deviceDelegate = self
   ```
   ✅ Correct - SDK handles service discovery automatically

3. **Deployment Callback**:
   ```swift
   func utilDeployCompletion(_ util: VTMURATUtils) {
       isSdkDeployed = true
       // Device ready
   }
   ```
   ✅ Correct

4. **Real-Time Data Request**:
   ```swift
   viatomUtils?.requestBPRealData()
   ```
   ✅ Correct

5. **Command Parsing**:
   ```swift
   case VTMBPCmdGetRealData.rawValue: // 0x08
       let measure = VTMBLEParser.parseBPMeasuring(data)
   ```
   ✅ Correct

### ⚠️ Issues Found

1. **Missing Method**: `bp_startMeasure()` doesn't exist in SDK
   - **Current**: `viatomUtils?.bp_startMeasure()`
   - **Should be**: `viatomUtils?.requestChangeBPState(0)` (0 = start BP measurement)

2. **Incorrect Parser Method**: `parseBPMeasuring()` doesn't exist
   - **Current**: `VTMBLEParser.parseBPMeasuring(data)`
   - **Should be**: `VTMBLEParser.parseBPMeasuringData(data)`

3. **Status Request**: Method name mismatch
   - **Current**: `bp_requestRealStatus()` ✅ (This is correct!)

4. **Missing Status Parsing**: Not parsing run status correctly
   - Should use `parseBPRealTimeStatus()` for status-only responses

5. **Real-Time Data Structure**: Not using full `VTMBPRealTimeData` structure
   - Should parse complete structure, not just measuring data

---

## Revised Implementation Plan

### Phase 1: Fix Critical Issues

#### 1.1 Fix Start Measurement Method

**Current (WRONG)**:
```swift
viatomUtils?.bp_startMeasure()  // ❌ Method doesn't exist
```

**Correct**:
```swift
// Start BP measurement (state = 0)
viatomUtils?.requestChangeBPState(0)

// Start ECG measurement (state = 1)
viatomUtils?.requestChangeBPState(1)

// Enter history mode (state = 2)
viatomUtils?.requestChangeBPState(2)
```

**Implementation**:
```swift
@objc public func startBPMeasurement(_ call: CAPPluginCall) {
    guard let utils = viatomUtils, isSdkDeployed else {
        call.reject("SDK not ready")
        return
    }
    
    // Request change to BP measuring state
    utils.requestChangeBPState(0)  // 0 = start BP measurement
    
    call.resolve(["success": true])
}
```

#### 1.2 Fix Parser Method Names

**Current (WRONG)**:
```swift
let measure = VTMBLEParser.parseBPMeasuring(data)  // ❌ Method doesn't exist
```

**Correct**:
```swift
let measure = VTMBLEParser.parseBPMeasuringData(data)  // ✅ Correct method
```

**Full Implementation**:
```swift
case VTMBPCmdGetRealData.rawValue: // 0x08
    // Parse complete real-time data structure
    let realTimeData = VTMBLEParser.parseBPRealTimeData(data)
    let status = realTimeData.run_status
    let waveform = realTimeData.rt_wav
    
    // Handle based on status
    switch status.status {
    case VTMBPStatus.bpMeasuring.rawValue:  // 4
        // Parse measuring data from waveform.data
        let measureData = VTMBLEParser.parseBPMeasuringData(
            Data(bytes: waveform.data, count: 20)
        )
        // Emit pressure, pulse, etc.
        
    case VTMBPStatus.bpMeasureEnd.rawValue:  // 5
        // Parse end measure data
        let endData = VTMBLEParser.parseBPEndMeasureData(
            Data(bytes: waveform.data, count: 20)
        )
        // Emit final results
        
    default:
        // Other statuses
        break
    }
```

#### 1.3 Fix Status Parsing

**Current**:
```swift
case VTMBPCmdGetRealStatus.rawValue: // 0x06
    let status = VTMBLEParser.parseBPRealTimeStatus(data)
    // ✅ This is correct!
```

**Enhanced**:
```swift
case VTMBPCmdGetRealStatus.rawValue: // 0x06
    let status = VTMBLEParser.parseBPRealTimeStatus(data)
    
    var statusData = JSObject()
    statusData["status"] = Int(status.status)
    statusData["batteryPercent"] = Int(status.battery.percent)
    statusData["batteryState"] = Int(status.battery.state)
    statusData["batteryVoltage"] = Int(status.battery.voltage)
    
    notifyListeners("bp2Rt", data: statusData)
```

### Phase 2: Enhance Real-Time Data Handling

#### 2.1 Use Complete Real-Time Data Structure

**Current**: Only parsing measuring data  
**Should**: Parse complete `VTMBPRealTimeData` structure

```swift
public func util(_ util: VTMURATUtils, 
                 commandCompletion cmdType: UInt8, 
                 deviceType: VTMDeviceType, 
                 response: Data?) {
    
    guard deviceType == VTMDeviceTypeBP, let data = response else {
        return
    }
    
    switch cmdType {
    case VTMBPCmdGetRealData.rawValue: // 0x08
        // Parse complete structure
        let realTimeData = VTMBLEParser.parseBPRealTimeData(data)
        handleBPRealTimeData(realTimeData)
        
    case VTMBPCmdGetRealStatus.rawValue: // 0x06
        let status = VTMBLEParser.parseBPRealTimeStatus(data)
        handleBPStatus(status)
        
    case VTMBPCmdGetRealPressure.rawValue: // 0x05
        let pressure = VTMBLEParser.parseBPRealTimePressure(data)
        handleBPPressure(pressure)
        
    default:
        break
    }
}

private func handleBPRealTimeData(_ data: VTMBPRealTimeData) {
    let status = data.run_status
    let waveform = data.rt_wav
    
    // Emit status and battery info
    var statusData = JSObject()
    statusData["status"] = Int(status.status)
    statusData["batteryPercent"] = Int(status.battery.percent)
    statusData["batteryState"] = Int(status.battery.state)
    notifyListeners("bp2Rt", data: statusData)
    
    // Handle waveform data based on type
    switch waveform.type {
    case 0:  // BP measuring
        let measureData = VTMBLEParser.parseBPMeasuringData(
            Data(bytes: waveform.data, count: 20)
        )
        var measureObj = JSObject()
        measureObj["pressure"] = Int(measureData.pressure)
        measureObj["pulse"] = Int(measureData.pulse_rate)
        measureObj["isDeflating"] = measureData.is_deflating == 1
        measureObj["isGetPulse"] = measureData.is_get_pulse == 1
        notifyListeners("bpProgress", data: measureObj)
        
    case 1:  // BP measure finished
        let endData = VTMBLEParser.parseBPEndMeasureData(
            Data(bytes: waveform.data, count: 20)
        )
        var resultObj = JSObject()
        resultObj["systolic"] = Int(endData.systolic_pressure)
        resultObj["diastolic"] = Int(endData.diastolic_pressure)
        resultObj["mean"] = Int(endData.mean_pressure)
        resultObj["pulse"] = Int(endData.pulse_rate)
        resultObj["stateCode"] = Int(endData.state_code)
        resultObj["medicalResult"] = Int(endData.medical_result)
        notifyListeners("bpMeasurement", data: resultObj)
        
    case 2:  // ECG measuring
        let ecgData = VTMBLEParser.parseECGMeasuringData(
            Data(bytes: waveform.data, count: 20)
        )
        // Handle ECG measuring data
        
    case 3:  // ECG measure finished
        let ecgEnd = VTMBLEParser.parseECGEndMeasureData(
            Data(bytes: waveform.data, count: 20)
        )
        // Handle ECG end data
        
    default:
        break
    }
}
```

### Phase 3: Add Missing Features

#### 3.1 File Operations

**Get File List**:
```swift
@objc public func getFileList(_ call: CAPPluginCall) {
    guard let utils = viatomUtils, isSdkDeployed else {
        call.reject("SDK not ready")
        return
    }
    
    utils.requestFilelist()
    // Response comes via commandCompletion with VTMBLECmdGetFileList
}
```

**Read File**:
```swift
// In commandCompletion handler:
case VTMBLECmdGetFileList.rawValue:
    let fileList = VTMBLEParser.parseFileList(data)
    // Return file list to JavaScript
    
case VTMBLECmdStartRead.rawValue:
    let fileLength = VTMBLEParser.parseFileLength(data)
    // Start reading file
    
case VTMBLECmdReadFile.rawValue:
    // Accumulate file data
    fileData.append(data)
    // Continue reading if not complete
    
case VTMBLECmdEndRead.rawValue:
    // File read complete, parse based on type
    parseDownloadedFile(fileData)
```

#### 3.2 Device Configuration

**Get Config**:
```swift
viatomUtils?.requestBPConfig()
// Response: VTMBPCmdGetConfig -> parseBPConfig()
```

**Sync Config**:
```swift
var config = VTMBPConfig()
config.device_switch = 1  // Enable beeper
config.volume = 60        // Volume level
viatomUtils?.syncBPConfig(config)
```

#### 3.3 Time Synchronization

```swift
viatomUtils?.syncTime(Date())
// Response: VTMBLECmdSyncTime
```

### Phase 4: Error Handling Improvements

#### 4.1 Command Failure Handling

```swift
public func util(_ util: VTMURATUtils, 
                 commandFailed cmdType: UInt8, 
                 deviceType: VTMDeviceType, 
                 failedType: VTMBLEPkgType) {
    
    errorLog("Command 0x\(String(format: "%02X", cmdType)) failed: \(failedType.rawValue)")
    
    // Map error types
    var errorMessage = "Unknown error"
    switch failedType {
    case .notFound:
        errorMessage = "File not found"
    case .readFailed:
        errorMessage = "Read file failed"
    case .deviceOccupied:
        errorMessage = "Device busy"
    case .formatError:
        errorMessage = "Format error"
    case .formatUnsupport:
        errorMessage = "Command not supported"
    case .commonError:
        errorMessage = "General error"
    default:
        break
    }
    
    // Notify JavaScript
    var errorObj = JSObject()
    errorObj["error"] = errorMessage
    errorObj["cmdType"] = Int(cmdType)
    notifyListeners("commandError", data: errorObj)
}
```

#### 4.2 Command Send Failure

```swift
public func util(_ util: VTMURATUtils, commandSendFailed errorCode: UInt8) {
    var errorMsg = "Unknown error"
    switch errorCode {
    case 0:
        errorMsg = "Peripheral is nil"
    case 1:
        errorMsg = "Write characteristic is nil"
    case 2:
        errorMsg = "Peripheral not connected"
    case 3:
        errorMsg = "Command timeout"
    default:
        break
    }
    
    errorLog("Command send failed: \(errorMsg)")
    // Handle reconnection or retry logic
}
```

---

## Implementation Checklist

### Critical Fixes (Must Do)

- [ ] Replace `bp_startMeasure()` with `requestChangeBPState(0)`
- [ ] Fix `parseBPMeasuring()` to `parseBPMeasuringData()`
- [ ] Verify all parser method names match SDK headers
- [ ] Test real-time data parsing with complete structure
- [ ] Add proper error handling for command failures

### Enhancements (Should Do)

- [ ] Implement complete real-time data structure parsing
- [ ] Add file list and read operations
- [ ] Add device configuration methods
- [ ] Improve status change detection
- [ ] Add proper lifecycle management

### Nice to Have

- [ ] Add ECG measurement support
- [ ] Add file download progress tracking
- [ ] Add device configuration UI
- [ ] Add comprehensive logging

---

## Testing Plan

### 1. Connection Test
- [ ] Verify `utilDeployCompletion` is called
- [ ] Verify device info can be retrieved
- [ ] Verify battery info can be retrieved

### 2. Real-Time Data Test
- [ ] Start measurement with `requestChangeBPState(0)`
- [ ] Verify status changes to `bpMeasuring` (4)
- [ ] Verify real-time pressure data is received
- [ ] Verify measurement completion with results

### 3. Error Handling Test
- [ ] Test with device disconnected
- [ ] Test with invalid commands
- [ ] Test timeout scenarios

### 4. File Operations Test
- [ ] Get file list
- [ ] Read BP file
- [ ] Read ECG file
- [ ] Parse file data correctly

---

## Code Examples from SDK Demo

### Example: Starting BP Measurement (from VTMBPMenuVC.m)

```objective-c
// Request real-time data
[[VTMProductURATUtils sharedInstance] requestBPRealData];

// In commandCompletion:
if(cmdType == VTMBPCmdGetRealData) {
    VTMBPRealTimeData bpData = [VTMBLEParser parseBPRealTimeData:response];
    VTMBPRunStatus status = bpData.run_status;
    
    switch (status.status) {
        case DeviceStatusBPMeasuring:  // 4
            NSData *tempData = [NSData dataWithBytes:waveform.data 
                                               length:sizeof(waveform.data)];
            VTMBPMeasuringData measuringData = 
                [VTMBLEParser parseBPMeasuringData:tempData];
            // Use measuringData.pressure, pulse_rate, etc.
            break;
            
        case DeviceStatusBPMeasureEnd:  // 5
            VTMBPEndMeasureData endMeasureData = 
                [VTMBLEParser parseBPEndMeasureData:tempData];
            // Use endMeasureData.systolic_pressure, etc.
            break;
    }
}
```

### Example: Changing Device State

```objective-c
// To start BP measurement:
// Use requestChangeBPState with state = 0
// But this method is not directly exposed in the category
// Need to check if it's requestChangeBPState: or another method name
```

**Note**: The SDK header shows `requestChangeBPState:` but the example code doesn't show its usage. Need to verify the exact method signature.

---

## Key Differences from Android

| Feature | Android | iOS |
|---------|---------|-----|
| SDK Type | AAR (Java/Kotlin) | xcframework (Objective-C/Swift) |
| Initialization | `BleServiceHelper.initService()` in MainApplication | `VTMURATUtils()` instance |
| Connection | `connect()` method | Set `peripheral` property |
| Deployment | Automatic after connection | `utilDeployCompletion` callback |
| Real-time Data | `startRtTask()` | `requestBPRealData()` |
| Start Measurement | `bp_startMeasure()` | `requestChangeBPState(0)` |
| Event System | LiveEventBus | Delegate callbacks |

---

## Next Steps

1. **Update WellueSDKPlugin.swift** with corrected method names
2. **Test connection flow** with real device
3. **Verify real-time data parsing** matches SDK structures
4. **Add missing features** (file operations, config)
5. **Update documentation** with correct API usage

---

## References

- **SDK Headers**: `VTProductLib_Pods/VTMProductLib.xcframework/ios-arm64/VTMProductLib.framework/Headers/`
- **Example Code**: `VTProductLib/VTMProductSDK/VTMProductSDK/BP/VTMBPMenuVC.m`
- **Protocol Docs**: Viatom Product Communication Protocol
- **GitHub**: https://github.com/viatom-dev/VTProductLib

