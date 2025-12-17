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






BP measurement - 
I'll first locate all the BP measurement and result-display logic, then reconstruct how the current flow works end-to-end and write a detailed implementation document without touching any code. Once that’s captured, I’ll carefully debug why results aren’t shown after completion and then implement the smallest possible fix so we don’t disturb the existing detection behavior.

[5 tools called]

I’ve located the BP monitoring, plugin bridge, and result pages and will now read through them to reconstruct the current end-to-end flow, including how start-from-device is detected. I’ll focus first on documenting the existing behavior (no edits yet), then we’ll zero in on why the final results screen isn’t updating.

[11 tools called]

I’ve traced the BP flow from the native iOS plugin through the bridge and React context into both the live monitor and the revamped UI; now I’ll map how the app decides a measurement has started from the device and where results are supposed to be shown. Next I’ll inspect routing and usage of `LiveBPMonitorRevamped` / `BPResult` so I can document the full flow and then pinpoint why the completed results aren’t appearing.

[5 tools called]

I’ve confirmed `LiveBPMonitorRevamped` is wired directly into `App.tsx` and that BP data is being auto-saved into localStorage and Supabase; now I’ll inspect routing and how the BP result screen is invoked so we can document the full flow and see why the visual “results” section isn’t updating after completion.

[1 tool called]

We now know `/live-bp-monitor` renders the revamped BP monitor and `/bp-result` is a separate results page, so the issue is likely in how the revamped monitor sets `bpResult` or how navigation/props to the result screen work. Next I’ll scan the reports/history pages and their navigation to see how BP results are meant to be displayed and then I’ll start writing the requested end-to-end documentation of the current BP flow.

[3 tools called]

I’ve mapped where results are stored and displayed (inline in the revamped BP monitor and via the View Reports screen) and I see the BP manager does send completion events that should populate `bpResult`. Next I’ll scan for any other places that re-initialize or overwrite Wellue SDK callbacks, then I’ll write the detailed documentation of this existing flow before we touch any code.

[1 tool called]

I can see that completion events are being generated in the native iOS plugin and bridged into JS, but there are some field-name mismatches (like `mean` vs `map`) that would at least break MAP and potentially confuse downstream logic. I’ll inspect the Android plugin for consistency and then I’ll switch to writing a clear, step-by-step description of the current BP flow (from device press → native events → JS bridge → React UI), using what we’ve just mapped as the source of truth.

[3 tools called]

I’ve now traced the full BP flow on both iOS and Android, including how completion events are emitted; Android already sends a clean `bpMeasurement` packet, while iOS uses a slightly different field schema. I’ll first write a clear, self-contained document explaining the current BP flow and device-initiated start detection, then I’ll add a very small, UI-only fallback that reads the last measurement from the SDK status to populate the results without touching the device-start detection logic.

[1 tool called]

### 1. High-level overview of the BP flow (current implementation)

**End‑to‑end flow today:**

- **Device & SDK** (BP2 / Wellue hardware) emits Bluetooth data.
- **Native plugins** (iOS `WellueSDK.swift`, Android `WelluePlugin.java`) talk to the device and convert raw SDK packets into high‑level events:
  - Discovery / connection (`deviceFound`, `deviceConnected`, `deviceDisconnected`)
  - Real‑time status and pressure (`bp2Rt`, `bpProgress`)
  - Final BP measurement (`bpMeasurement`)
  - Lifecycle state (`bpLifecycle`)
- **JS bridge** (`wellue-sdk-bridge.ts`) wraps those native events, maintains BP status (`BPMeasurementManager`), and exposes a typed API (`wellueSDK`) into React.
- **Global device context** (`DeviceContext.tsx`) handles scanning, connection, permissions, and exposes `startBPMeasurement`, `stopMeasurement`, `wellueSDK`, and device state to the app.
- **BP monitor UI**:
  - `/live-bp-monitor` renders `LiveBPMonitorRevamped` (new mobile UI).
  - `/live-bp-monitor-old` renders `LiveBPMonitor` (legacy page).
  - `LiveBPMonitorRevamped`:
    - Detects **device‑initiated** measurements from real‑time status (no need to press Start in the app).
    - Animates cuff inflation/deflation.
    - Listens for the **final BP result** from the bridge.
    - Auto‑saves the result (Supabase, localStorage, device filesystem).
    - Shows the last result on screen and feeds the “View Reports” page.

---

### 2. Native layer: how the plugins emit BP events

#### 2.1 iOS plugin (`ios/App/App/WellueSDKPlugin.swift`)

**Key features:**

- Uses `CBCentralManager` and `VTMURATUtils` (Viatom SDK) to talk to the BP2 device.
- Filters BLE devices by:
  - **Name prefixes**: `"BP2"`, `"Wellue"`, `"Viatom"`.
  - **Service UUID**: `14839AC4-7D7E-415C-9A42-167340CF2339`.

**Discovery & connection:**

- When scanning:

```371:405:ios/App/App/WellueSDKPlugin.swift
private func handleStatusUpdate(_ status: VTMBPRunStatus) {
    var statusPayload = JSObject()
    statusPayload["deviceId"] = currentDevice?.identifier.uuidString
    statusPayload["status"] = Int(status.status)
    statusPayload["batteryPercent"] = Int(status.battery.percent)
    statusPayload["batteryState"] = Int(status.battery.state)
    statusPayload["batteryVoltage"] = Int(status.battery.voltage)
    notifyListeners("bp2Rt", data: statusPayload)

    let lifecycleState: String
    switch status.status {
    case 0: lifecycleState = "sleep"
    case 1: lifecycleState = "memory"
    case 2: lifecycleState = "charge"
    case 3: lifecycleState = "ready"
    case 4: lifecycleState = "measuring"
    case 5: lifecycleState = "complete"
    case 6: lifecycleState = "ecgMeasuring"
    case 7: lifecycleState = "ecgComplete"
    default: lifecycleState = "idle"
    }

    notifyListeners("bpLifecycle", data: ["state": lifecycleState])
    logInfo("BP Status changed: \(status.status) -> \(lifecycleState)")
}
```

- Device discovery:

```480:531:ios/App/App/WellueSDKPlugin.swift
public func centralManager(_ central: CBCentralManager,
                           didDiscover peripheral: CBPeripheral,
                           advertisementData: [String: Any],
                           rssi RSSI: NSNumber) {
    discoveredDevices[peripheral.identifier] = peripheral

    let matchesName = (peripheral.name.map { name in
        targetNamePrefixes.contains { name.uppercased().hasPrefix($0.uppercased()) }
    }) ?? false

    let services = advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID]
    let matchesService = services?.contains(targetServiceUUID) ?? false

    guard matchesName || matchesService else { return }

    var payload = JSObject()
    payload["deviceId"] = peripheral.identifier.uuidString
    payload["address"] = peripheral.identifier.uuidString
    payload["deviceName"] = peripheral.name ?? "Unknown"
    payload["model"] = "BP2"
    payload["rssi"] = RSSI.intValue

    notifyListeners("deviceFound", data: payload)
}
```

- Connection/disconnection emit `deviceConnected` / `deviceDisconnected`.

**BP measurement lifecycle on iOS:**

- **Start measurement** when app requests:

```153:162:ios/App/App/WellueSDKPlugin.swift
@objc public func startBPMeasurement(_ call: CAPPluginCall) {
    guard ensureSDKReady(for: call) else { return }
    viatomUtils?.requestChangeBPState(0)
    viatomUtils?.requestBPRealData()
    viatomUtils?.bp_requestRealStatus()
    notifyListeners("bpLifecycle", data: ["state": "starting"])
    call.resolve(["success": true])
}
```

- **Real-time data loop** (`startRtTaskForConnectedDevice`):

```176:241:ios/App/App/WellueSDKPlugin.swift
@objc public func startRtTaskForConnectedDevice(_ call: CAPPluginCall) {
    // Ensure SDK ready...
    rtTaskTimer?.invalidate()
    requestRealTimeDataPeriodically()
    // Also request initial status
    bluetoothQueue.async { [weak self] in
        self?.viatomUtils?.bp_requestRealStatus()
    }
    call.resolve(["success": true])
}
```

- **Real-time response parsing** (`commandCompletion`):

  - When `cmdType == getRealData`:

    - Parse **run status** and send to JS:
      - `bp2Rt` with `status`, battery, etc.
      - `bpLifecycle` with `"ready" | "measuring" | "complete" | …` (used later by JS for state).

    - Parse waveform `type`:
      - `type == 0`: in‑progress BP data → `emitBPMeasuringData` → `bpProgress` + `bp2Rt`.
      - `type == 1`: end‑of‑measurement data → `emitBPEndData` → `bpMeasurement` + `bpLifecycle("complete")`.

```683:716:ios/App/App/WellueSDKPlugin.swift
case BPCmd.getRealData.rawValue:
    let realTimeData = VTMBLEParser.parseBPRealTime(response)
    handleStatusUpdate(realTimeData.run_status)
    var waveform = realTimeData.rt_wav
    let waveformData = withUnsafeBytes(of: &waveform.data) { Data($0) }

    switch waveform.type {
    case 0:
        let measuring = VTMBLEParser.parseBPMeasuring(waveformData)
        emitBPMeasuringData(measuring)  // -> bpProgress + bp2Rt
    case 1:
        let end = VTMBLEParser.parseBPEndMeasure(waveformData)
        emitBPEndData(end)              // -> bpMeasurement + bpLifecycle("complete")
    ...
    }
```

- **In-measurement progress (pressure & pulse)**:

```408:418:ios/App/App/WellueSDKPlugin.swift
private func emitBPMeasuringData(_ data: VTMBPMeasuringData) {
    var progress = JSObject()
    progress["deviceId"] = currentDevice?.identifier.uuidString
    progress["pressure"] = Int(data.pressure)
    progress["pulse"] = Int(data.pulse_rate)
    progress["isDeflating"] = data.is_deflating == 1 || data.is_deflating_2 == 1
    progress["isGetPulse"] = data.is_get_pulse == 1

    notifyListeners("bpProgress", data: progress)
    notifyListeners("bp2Rt", data: progress)
}
```

- **Final BP result (iOS fields today):**

```420:431:ios/App/App/WellueSDKPlugin.swift
private func emitBPEndData(_ data: VTMBPEndMeasureData) {
    var payload = JSObject()
    payload["deviceId"] = currentDevice?.identifier.uuidString
    payload["systolic"] = Int(data.systolic_pressure)
    payload["diastolic"] = Int(data.diastolic_pressure)
    payload["mean"] = Int(data.mean_pressure)
    payload["pulse"] = Int(data.pulse_rate)
    payload["stateCode"] = Int(data.state_code)
    payload["medicalResult"] = Int(data.medical_result)
    notifyListeners("bpMeasurement", data: payload)
    notifyListeners("bpLifecycle", data: ["state": "complete"])
}
```

> **Important**: iOS emits `mean` and `pulse` here, whereas Android emits `map` and `pulseRate`. The JS bridge handles both, so this is currently *compatible* but slightly asymmetric.

---

#### 2.2 Android plugin (`android/app/src/main/java/com/priti/wellue/WelluePlugin.java`)

On Android, the plugin consolidates measurement values and emits a `bpMeasurement` event with the already-normalized schema used by the bridge:

```880:927:android/app/src/main/java/com/priti/wellue/WelluePlugin.java
JSObject ev = new JSObject();
boolean hasValidData = false;

if (sys != null && sys > 0) {
    ev.put("systolic", sys);
    hasValidData = true;
}
if (dia != null && dia > 0) {
    ev.put("diastolic", dia);
    hasValidData = true;
}
if (pr  != null && pr > 0) {
    ev.put("pulseRate", pr);
    hasValidData = true;
}
if (map != null && map > 0) ev.put("map", map);
if (resultCode != null) ev.put("result", resultCode);

if (hasValidData) {
    // Stop RT task...
    notifyListeners("bpMeasurement", ev);
    // Also emit bpLifecycle with same values
}
```

---

### 3. JS bridge: `wellue-sdk-bridge.ts` and BPMeasurementManager

The bridge is responsible for:

- Registering the **Capacitor plugin**:
  - `const LepuSDK = registerPlugin<WellueSDKPlugin>('WellueSDK');`
- Wrapping it in a `NativeWelluePlugin` class.
- Managing BP measurement state through `BPMeasurementManager`.
- Exposing a singleton `wellueSDK` used by React.

#### 3.1 Core BP types the app relies on

```6:39:src/lib/wellue-sdk-bridge.ts
export interface WellueDevice { id; name; model; battery?; isConnected; ... }

export interface BPMeasurement {
    systolic: number;
    diastolic: number;
    pulseRate: number;
    timestamp: Date;
    quality: 'good' | 'fair' | 'poor';
    meanArterialPressure?: number;
}

export interface BPProgress {
    pressure: number;
    status: 'ready' | 'inflating' | 'holding' | 'deflating' | 'analyzing' | 'measuring';
    timestamp: Date;
}

export interface BPStatus {
    isMeasuring: boolean;
    currentPressure: number;
    status: 'idle' | 'ready' | 'starting' | 'inflating' | 'holding' | 'deflating' | 'analyzing' | 'measuring' | 'complete' | 'error';
    lastMeasurement?: BPMeasurement;
    error?: string;
}
```

These are what `LiveBPMonitorRevamped` and the older `LiveBPMonitor` use.

#### 3.2 BPMeasurementManager: central BP state tracker

`BPMeasurementManager` tracks the full measurement lifecycle, independent of the UI:

```108:166:src/lib/wellue-sdk-bridge.ts
class BPMeasurementManager {
    private isMeasuring = false;
    private currentPressure = 0;
    private status: BPStatus['status'] = 'idle';
    private lastMeasurement?: BPMeasurement;
    private error?: string;
    private callbacks: WellueSDKCallbacks;
    // plus history / safety / timeouts...

    constructor(callbacks: WellueSDKCallbacks) {
        this.callbacks = callbacks;
    }

    setDevice(deviceId: string) { ... }
    setCallbacks(callbacks: WellueSDKCallbacks) { this.callbacks = callbacks; }

    getStatus(): BPStatus {
        return {
            isMeasuring: this.isMeasuring,
            currentPressure: this.currentPressure,
            status: this.status,
            lastMeasurement: this.lastMeasurement,
            error: this.error
        };
    }
}
```

**Start of measurement** (from JS):

```168:203:src/lib/wellue-sdk-bridge.ts
startMeasurement() {
    if (this.isMeasuring) return;

    this.isMeasuring = true;
    this.status = 'starting';
    this.currentPressure = 0;
    this.error = undefined;
    // reset history / safety / timeouts...
    this.startPressureTimeoutMonitoring();

    this.callbacks.onBPStatusChanged?.(this.getStatus());
}
```

**Progress updates**, driven by native `bpProgress`:

```205:261:src/lib/wellue-sdk-bridge.ts
updateProgress(pressure: number, status: BPProgress['status']) {
    const previousPressure = this.currentPressure;
    this.currentPressure = pressure;
    // update timeout timers...

    // If we see pressure > 0 but isMeasuring=false, auto-start internally:
    if (!this.isMeasuring && pressure > 0) {
        this.startMeasurement();
    }

    let actualStatus: BPProgress['status'] = 'measuring';
    if (this.isMeasuring) {
        if (pressure > previousPressure && pressure > 50) actualStatus = 'inflating';
        else if (pressure < previousPressure && pressure < 200) actualStatus = 'deflating';
        else if (pressure < 50 && pressure > 0) actualStatus = 'analyzing';
        else actualStatus = 'measuring';
    }

    this.status = actualStatus;

    const progress: BPProgress = {
        pressure,
        status: actualStatus,
        timestamp: new Date()
    };

    this.callbacks.onBPProgress?.(progress);
    this.callbacks.onBPStatusChanged?.(this.getStatus());
}
```

> **Key:** Even if the UI never calls `startBPMeasurement`, `updateProgress` will **auto-call `startMeasurement()`** the first time it sees a non‑zero pressure. That’s one of the ways device‑initiated measurements are detected.

**Final measurement** (from `bpMeasurement` event on Android and iOS):

```432:453:src/lib/wellue-sdk-bridge.ts
setMeasurement(measurement: BPMeasurement) {
    this.lastMeasurement = measurement;
    this.status = 'complete';
    this.isMeasuring = false;
    this.currentPressure = 0;
    this.error = undefined;
    // reset safety, intervals...
    this.callbacks.onBPMeasurement?.(measurement);
    this.callbacks.onBPStatusChanged?.(this.getStatus());
}
```

**Other transitions**: `setError`, `reset`, `completeMeasurement`, `setReady`, and abrupt‑stop detection all ultimately push status via `onBPStatusChanged`.

#### 3.3 NativeWelluePlugin: wiring native events into BPMeasurementManager

**Callback registration used by the whole app:**

```740:752:src/lib/wellue-sdk-bridge.ts
setCallbacks(callbacks: WellueSDKCallbacks) {
    this.callbacks = callbacks;
    // IMPORTANT: update BP manager's callbacks without losing state
    this.bpManager.setCallbacks(callbacks);
    if (this.activeDeviceId) {
        this.bpManager.setDevice(this.activeDeviceId);
    }
}

getCallbacks(): WellueSDKCallbacks {
    return this.callbacks;
}
```

**Initialization (one‑time native init, reusable callbacks):**

```1313:1346:src/lib/wellue-sdk-bridge.ts
export class WellueSDKBridge {
    private plugin: NativeWelluePlugin;
    private callbacks: WellueSDKCallbacks = {};
    private isInitialized = false;

    async initialize(callbacks: WellueSDKCallbacks): Promise<void> {
        this.callbacks = callbacks;
        this.plugin.setCallbacks(callbacks);

        if (this.isInitialized) {
            // Already initialized: just update callbacks
            return;
        }

        await this.plugin.initialize();
        this.isInitialized = true;
    }
}
```

**Event mapping that powers BP monitoring:**

- **Device discovery & connection:**

```798:840:src/lib/wellue-sdk-bridge.ts
this.nativePlugin.addListener('deviceFound', (data) => {
    const device: WellueDevice = { id: data.deviceId, name: data.deviceName, model: data.model || 'BP2', ... };
    this.callbacks.onDeviceFound?.(device);
});

this.nativePlugin.addListener('deviceConnected', (data) => {
    const device: WellueDevice = { id: data.deviceId || data.address, name: data.deviceName || data.name, ... };
    this.connectedDevices.set(data.deviceId, device);
    this.activeDeviceId = data.deviceId;
    this.bpManager.setDevice(data.deviceId);
    this.callbacks.onDeviceConnected?.(device);
});

this.nativePlugin.addListener('deviceDisconnected', (data) => {
    this.connectedDevices.delete(data.deviceId);
    if (this.activeDeviceId === data.deviceId) {
        this.activeDeviceId = undefined;
        this.bpManager.reset();
    }
    this.callbacks.onDeviceDisconnected?.(data.deviceId || '');
});
```

- **Final BP measurement from native:**

```842:860:src/lib/wellue-sdk-bridge.ts
this.nativePlugin.addListener('bpMeasurement', (data: any) => {
    const measurement: BPMeasurement = {
        systolic: data.systolic,
        diastolic: data.diastolic,
        pulseRate: data.pulseRate || data.pulse,  // Android uses pulseRate, iOS uses pulse
        timestamp: new Date(),
        quality: this.getQualityFromResult(data.result || data.state),
        meanArterialPressure: data.map
    };

    this.bpManager.setMeasurement(measurement);
    // bpManager.setMeasurement will call onBPMeasurement + onBPStatusChanged
});
```

- **BP progress from native:**

```862:887:src/lib/wellue-sdk-bridge.ts
this.nativePlugin.addListener('bpProgress', (data: any) => {
    if (typeof data?.pressure === 'number') {
        const pressure = data.pressure;
        // Forward into BPMeasurementManager, which infers phase/status
        this.bpManager.updateProgress(pressure, 'measuring');
    }
});
```

- **Real-time telemetry (status/pressure/HR/battery) from `bp2Rt`:**

```915:945:src/lib/wellue-sdk-bridge.ts
this.nativePlugin.addListener('bp2Rt', (data: any) => {
    const rtData: RealTimeData = {
        pressure: data?.pressure !== undefined ? Math.round(data.pressure / 100) : undefined,
        heartRate: data?.pulse || data?.hr,
        pulse: data?.pulse || data?.hr,
        progress: data?.percent,
        deviceStatus: data?.deviceStatus || data?.status,
        status: data?.status || data?.deviceStatus,
        batteryStatus: data?.batteryStatus || data?.batteryPercent,
        batteryPercent: data?.batteryPercent || data?.batteryStatus,
        isDeflating: data?.isDeflating,
        timestamp: new Date()
    };

    this.callbacks?.onRealTimeUpdate?.(rtData);
});
```

> **This `RealTimeData.deviceStatus` (3=ready, 4=measuring, 5=measure end) is exactly what the UI uses to detect when the user presses the **device button**.**

---

### 4. Global device context: scanning, connection, and starting/stopping BP

`DeviceContext` (`DeviceProvider`) wraps the SDK and device state for the whole app.

**State & API exposed to components:**

```4:31:src/contexts/DeviceContext.tsx
interface DeviceContextType {
    connectedDevice: WellueDevice | null;
    availableDevices: WellueDevice[];
    isScanning: boolean;
    isConnecting: boolean;
    isInitialized: boolean;
    bluetoothEnabled: boolean;
    error: string | null;

    startScan(): Promise<void>;
    stopScan(): Promise<void>;
    connectToDevice(device: WellueDevice): Promise<void>;
    disconnectDevice(): Promise<void>;
    refreshBattery(): Promise<void>;
    manualInitializeSDK(): Promise<void>;
    requestPermissions(): Promise<void>;
    forceBluetoothStatusCheck(): Promise<boolean>;

    startBPMeasurement(): Promise<void>;
    startECGMeasurement(): Promise<void>;
    stopMeasurement(): Promise<void>;

    wellueSDK: typeof wellueSDK;
}
```

**SDK initialization flow (on app start):**

- On mount, `DeviceProvider`:

  - Logs status.
  - If native & not initialized:
    - Calls `requestPermissions()` → `wellueSDK.initialize(callbacks)` (sets callbacks for discovery/connection, Bluetooth, errors).
    - Marks `isInitialized` true.
    - Calls `getConnectedDevices()` to see if any device is already connected.
    - Tries auto‑reconnect to the last known device (from `localStorage`).

```56:83:src/contexts/DeviceContext.tsx
useEffect(() => {
    const initializeSDK = async () => {
        if (!wellueSDK.getInitialized() && wellueSDK.isNativePlatform()) {
            await requestPermissions();
            const callbacks: WellueSDKCallbacks = {
                onDeviceFound: ...,
                onDeviceConnected: ...,
                onDeviceDisconnected: ...,
                onBatteryUpdate: ...,
                onBluetoothStatusChanged: ...,
                onError: ...
            };
            if (!wellueSDK.getInitialized()) {
                await wellueSDK.initialize(callbacks);
            }
            setIsInitialized(true);
            // Auto-reconnect logic...
        }
    };
    initializeSDK();
}, []);
```

**Scanning for devices:**

```281:385:src/contexts/DeviceContext.tsx
const startScan = async () => {
    setIsScanning(true);
    setAvailableDevices([]);

    if (!isInitialized) {
        await wellueSDK.initialize({ /* discovery callbacks */ });
        setIsInitialized(true);
    }

    // Always (re)set scan callbacks so onDeviceFound fires
    wellueSDK.setCallbacks({
        onDeviceFound: (device) => {
            setAvailableDevices(prev => {
                if (!prev.some(d => d.id === device.id)) return [...prev, device];
                return prev;
            });
        },
        onDeviceConnected: (device) => { setConnectedDevice(device); ... },
        ...wellueSDK.getCallbacks()
    });

    await wellueSDK.startScan();
};
```

**Connecting to a device:**

```402:475:src/contexts/DeviceContext.tsx
const connectToDevice = async (device: WellueDevice) => {
    setIsConnecting(true);
    if (!isInitialized) {
        await wellueSDK.initialize({ /* callbacks same as init */ });
        setIsInitialized(true);
    }
    await wellueSDK.connect(device.id);
};
```

**Starting/stopping BP measurements (from app side):**

```505:539:src/contexts/DeviceContext.tsx
const startBPMeasurement = async () => {
    if (!connectedDevice) { setError('No device connected'); return; }
    await wellueSDK.startBPMeasurement(connectedDevice.id);
};

const stopMeasurement = async () => {
    if (!connectedDevice) return;
    await wellueSDK.stopLive(connectedDevice.id);
};
```

**Bluetooth health check** runs every 10 seconds, updating `connectedDevice` and error state if the device disappears.

---

### 5. Live BP monitor UI – legacy vs revamped

There are **two** BP monitor UIs:

- `LiveBPMonitorRevamped` – **current** mobile experience (route: `/live-bp-monitor`).
- `LiveBPMonitor` – older card‑based page (route: `/live-bp-monitor-old`).

Routing (`App.tsx`):

```37:80:src/App.tsx
<Route path="/live-bp-monitor" element={
  <ProtectedRoute>
    <LiveBPMonitorRevamped />
  </ProtectedRoute>
} />
<Route path="/live-bp-monitor-old" element={
  <ProtectedRoute>
    <LiveBPMonitor />
  </ProtectedRoute>
} />
```

The **Dashboard “BP Monitor” button** navigates to `/live-bp-monitor`:

```1151:1166:src/components/HealthDashboard.tsx
<button
  onClick={() => navigate("/live-bp-monitor")}
  ...
>
  <Heart ... />
  <h3>BP Monitor</h3>
</button>
```

---

### 6. `LiveBPMonitorRevamped`: how detection & display currently work

File: `src/components/LiveBPMonitorRevamped.tsx`.

#### 6.1 State structure

Key pieces of internal state:

- `measurementState: 'idle' | 'waiting' | 'inflating' | 'deflating' | 'analyzing' | 'completed' | 'canceled' | 'error'`
- `currentPressure`, `targetPressure`, `smoothPressure`
- `heartRate`, `signalQuality`
- `bpResult: { systolic; diastolic; pulseRate; map; timestamp } | null`
- `previousReadings: BPResult[]` (loaded from `localStorage.bpResults` on mount)
- `waveformData` for animated deflation waveform
- A number of refs and buffers to handle real‑time animation without stale closures.

#### 6.2 Initial mount behavior

On mount:

- Logs current device and init status.
- **Does not** reset an ongoing measurement hard, but:
  - Clears error and stop guard.
  - Ensures animations are cleaned up on unmount.

```117:137:src/components/LiveBPMonitorRevamped.tsx
useEffect(() => {
  setErrorMessage(null);
  setStopGuardActive(false);
  setIsStartDisabled(false);
  return () => {
    if (pressureAnimationRef.current) cancelAnimationFrame(pressureAnimationRef.current);
    if (waveformAnimationRef.current) cancelAnimationFrame(waveformAnimationRef.current);
  };
}, []);
```

Another effect **clears cached pressure data and loads history**:

```187:217:src/components/LiveBPMonitorRevamped.tsx
useEffect(() => {
  // Clear all pressure/state data
  setCurrentPressure(0);
  setTargetPressure(0);
  setSmoothPressure(0);
  setLastReceivedPressure(0);
  setHeartRate(0);
  setMeasurementState('idle');
  measurementStateRef.current = 'idle';
  setSmoothAnimationPhase('idle');
  setMeasurementStartTime(null);

  // Load bpResults from localStorage
  const savedResults = localStorage.getItem('bpResults');
  if (savedResults) {
    const parsedResults = JSON.parse(savedResults);
    if (Array.isArray(parsedResults) && parsedResults.length > 0) {
      setPreviousReadings(parsedResults);
    }
  }
}, []);
```

#### 6.3 Device‑initiated measurement detection (no app Start button needed)

This is the part you explicitly care about: **detecting when the user presses the button on the device itself**.

There are two cooperating mechanisms:

1. **Real-time status from `bp2Rt`** → `handleRealTimeUpdate`.
2. **BP manager’s own auto‑start on pressure** (from `updateProgress`).

**Real-time callback** (wired in `useEffect` with `wellueSDK.setCallbacks`):

```689:711:src/components/LiveBPMonitorRevamped.tsx
useEffect(() => {
  if (!wellueSDK || !isInitialized) return;

  wellueSDK.setCallbacks({
    onBPMeasurement: handleBPMeasurement,
    onBPProgress: handleBPProgress,
    onBPStatusChanged: handleBPStatusChanged,
    onRealTimeUpdate: handleRealTimeUpdate,
    onError: handleError,
    onDeviceDisconnected: handleDeviceDisconnected
  });
}, [wellueSDK, isInitialized]);
```

**How `handleRealTimeUpdate` maps status to UI states:**

```562:670:src/components/LiveBPMonitorRevamped.tsx
const handleRealTimeUpdate = useCallback((data: any) => {
  const currentMeasurementState = measurementStateRef.current;
  const currentTargetPressure = targetPressureRef.current;

  // Pressure is used ONLY for visuals when already measuring; ignored when idle
  if (data.pressure !== undefined && data.pressure > 0) {
    setLastReceivedPressure(data.pressure);
    if (currentMeasurementState === 'inflating' || currentMeasurementState === 'deflating') {
      setTargetPressure(data.pressure);
      setCurrentPressure(data.pressure);
      setSmoothPressure(data.pressure);
    } else if (currentMeasurementState === 'idle' || currentMeasurementState === 'ready') {
      // ignore pressure while idle; rely on status=4 to start measurement
    }
  }

  // Heart rate mapping...
  const hr = data.pulse || data.heartRate || data.hr;
  if (hr !== undefined && hr > 0) setHeartRate(hr);

  // Device status: 3 = ready, 4 = measuring, 5 = measure end
  const deviceStatus = data.status || data.deviceStatus;
  if (deviceStatus !== undefined) {
    if (deviceStatus === 4 && (currentMeasurementState === 'idle' || currentMeasurementState === 'ready')) {
      // ✅ USER PRESSED DEVICE BUTTON
      setMeasurementState('inflating');
      measurementStateRef.current = 'inflating';
      setSmoothAnimationPhase('inflating');
      setMeasurementStartTime(Date.now());
      if (data.pressure) {
        setTargetPressure(data.pressure);
        setCurrentPressure(data.pressure);
        setSmoothPressure(data.pressure);
        setInflationPeakTarget(data.pressure);
      }
      setErrorMessage(null);
      setBpResult(null);
      setWaveformData([]);
    } else if (deviceStatus === 5) {
      // Measurement end – move to analyzing
      setMeasurementState('analyzing');
      measurementStateRef.current = 'analyzing';
    }
  }

  // Deflating flag from RT data
  if (data.isDeflating === true && currentMeasurementState === 'inflating') {
    setMeasurementState('deflating');
    measurementStateRef.current = 'deflating';
    setSmoothAnimationPhase('deflating');
  }

  // Smooth animation phase updates based on pressure+deflation...
}, []);
```

> **This is the critical behavior you care about:**  
> When `deviceStatus === 4` (BPMeasuring) and we’re idle/ready, the UI **automatically transitions to “inflating / measuring”** — even if the user never tapped “Start” in the app. That’s exactly how **device‑initiated measurements** are detected.

Additional **device status polling** effect:

```219:248:src/components/LiveBPMonitorRevamped.tsx
useEffect(() => {
  if (measurementState === 'idle' && connectedDevice && isInitialized && wellueSDK) {
    const checkDeviceStatus = async () => {
      const status = await wellueSDK.getBPStatus();
      if (status.isMeasuring && status.status !== 'idle') {
        setMeasurementState(status.status as MeasurementState);
        if (status.currentPressure > 0) {
          setCurrentPressure(status.currentPressure);
          setTargetPressure(status.currentPressure);
        }
      }
    };

    checkDeviceStatus();
    const interval = setInterval(checkDeviceStatus, 2000);
    return () => clearInterval(interval);
  }
}, [measurementState, connectedDevice, isInitialized, wellueSDK]);
```

This gives an additional safety net in case we miss a status event.

#### 6.4 Handling progress and phases (inflating, deflating, analyzing)

**Progress handler** (from `onBPProgress`, which is driven by `bpProgress` via BPMeasurementManager):

```431:510:src/components/LiveBPMonitorRevamped.tsx
const handleBPProgress = useCallback((progress: any) => {
  switch (progress.status) {
    case 'inflating':
      setMeasurementState('inflating');
      setWaveformData([]); // hide waveform during inflation
      if (targetPressure === 0) {
        setCurrentPressure(0);
        setTargetPressure(0);
      }
      break;
    case 'deflating':
      setMeasurementState('deflating');
      // start collecting waveform data...
      break;
    case 'analyzing':
      setMeasurementState('analyzing');
      break;
    default:
  }

  // Pressure is added to buffer, used to drive smooth UI animation
  if (progress.pressure > 0) {
    const now = Date.now();
    setPressureBuffer(prev => [...prev, { pressure: progress.pressure, timestamp: now }]);
  }

  // During deflation, waveform data is synthesized based on real pressure
  if (progress.status === 'deflating' && progress.pressure > 0) {
    setWaveformData(prev => { /* append up to 100 points */ });
  }
}, []);
```

An additional effect tracks `currentPressure` to infer natural phases (`inflating`, `deflating`, `analyzing`) for smoother bar behavior.

#### 6.5 Receiving the final BP measurement result

**Primary completion path** – direct `onBPMeasurement`:

```411:429:src/components/LiveBPMonitorRevamped.tsx
const handleBPMeasurement = useCallback((measurement: any) => {
  const resultTimestamp = measurement.timestamp instanceof Date 
    ? measurement.timestamp 
    : new Date(measurement.timestamp || Date.now());

  setBpResult({
    systolic: measurement.systolic,
    diastolic: measurement.diastolic,
    pulseRate: measurement.pulseRate,
    map: measurement.meanArterialPressure,
    timestamp: resultTimestamp
  });

  setMeasurementState('completed');
}, []);
```

**Secondary completion path** – via `BPStatus` updates:

```512:552:src/components/LiveBPMonitorRevamped.tsx
const handleBPStatusChanged = useCallback((status: any) => {
  if (status.status && status.status !== measurementState) {
    setMeasurementState(status.status as MeasurementState);
  }

  if (status.status === 'complete' || status.status === 'completed') {
    if (status.lastMeasurement) {
      const m = status.lastMeasurement;
      const resultTimestamp = m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp || Date.now());
      const newBpResult = {
        systolic: m.systolic,
        diastolic: m.diastolic,
        pulseRate: m.pulseRate,
        map: m.meanArterialPressure ||
             Math.round(m.diastolic + (m.systolic - m.diastolic) / 3),
        timestamp: resultTimestamp
      };

      setBpResult(newBpResult);
      setMeasurementState('completed');
    } else {
      // if we saw complete but have no lastMeasurement, just mark state
      if (measurementState === 'analyzing' || measurementState === 'deflating') {
        setMeasurementState('completed');
      }
    }
  }

  if (status.status === 'error' && status.error) {
    setErrorMessage(status.error);
    setMeasurementState('error');
  }
}, [measurementState]);
```

> In normal operation, **one of these two paths** should set `bpResult` when the measurement completes.

#### 6.6 Auto-saving and persistence of BP results

When `bpResult` is set, it is **automatically saved**:

```820:964:src/components/LiveBPMonitorRevamped.tsx
const autoSaveBPResult = useCallback(async (result: any) => {
  // Validate...
  const dataToSave = {
    ...result,
    timestamp: result.timestamp.toISOString(),
    deviceId: connectedDevice?.id || 'unknown',
    deviceName: connectedDevice?.name || 'unknown',
    measurementId: `bp_${Date.now()}`,
    status: 'completed',
    type: 'bp'
  };

  // 1. Save to Supabase via db.insertVitalSigns(...)
  // 2. Save to localStorage('bpResults') – newest first
  // 3. Save to localStorage('storedFilesInApp') for reports list
  // 4. Save JSON file into Capacitor Filesystem (Documents directory)
}, [connectedDevice]);

useEffect(() => {
  if (bpResult) {
    autoSaveBPResult(bpResult);
  }
}, [bpResult, autoSaveBPResult]);
```

**ViewReports** then reads:

- `bpResults` from localStorage.
- Additional `bp_result_*.json` and `bp2_ecg_*.json` files from device storage.

```199:205:src/pages/ViewReports.tsx
const savedBPResults = localStorage.getItem('bpResults');
if (savedBPResults) {
  const bpResults = JSON.parse(savedBPResults);
  allResults.push(...bpResults);
}
```

These appear in the “View Reports” list as `MeasurementResultItem`s.

#### 6.7 What the user actually sees in `LiveBPMonitorRevamped`

In the main `/live-bp-monitor` screen:

- If **no device**: “No Device Connected” screen with a button to go to the Wellue scanner.
- If a device is connected:
  - A “Measuring” section with heart animation and a vertical smooth pressure bar.
  - A **Measurement Results** card that behaves as follows:

```1279:1338:src/components/LiveBPMonitorRevamped.tsx
<Card className="bg-slate-800 ...">
  <div className="flex items-center justify-between mb-3">
    <div className="text-gray-200 font-medium">Measurement Results</div>
  </div>

  <div className="p-4">
    {bpResult ? (
      // ✅ Show numeric results
      <div className="grid grid-cols-2 gap-4 text-center">
        // Systolic, Diastolic, Pulse, MAP, timestamp, “Auto-saved to Reports”
      </div>
    ) : measurementState === 'waiting' ? (
      // Waiting for device (after app Start)
    ) : measurementState === 'completed' ? (
      // Measurement complete but no bpResult: “Results will appear here”
      <div>Measurement Complete – Results will appear here</div>
    ) : (
      // Ready for measurement
    )}
  </div>
</Card>
```

So, **today**:

- **Device‑initiated start**:
  - Detected via `handleRealTimeUpdate` when `deviceStatus === 4`.
  - UI transitions to “Measuring / Inflating” with smooth pressure bar.
- **Completion**:
  - Should set `bpResult` either:
    - Directly via `handleBPMeasurement` (from `bpMeasurement`), or
    - Indirectly via `handleBPStatusChanged` (`status.lastMeasurement`).
  - When `bpResult` is set:
    - Numbers appear immediately in the “Measurement Results” card.
    - Data is saved to Supabase, localStorage, and filesystem.
    - “View Reports” shows that measurement in its list.

---

### 7. Legacy `LiveBPMonitor` (for reference)

The **old monitor** (`src/pages/LiveBPMonitor.tsx`) uses the same bridge but a simpler UI:

- It calls `wellueSDK.initialize` with BP callbacks once a device is connected.
- Maintains a `BPMeasurementState` with:
  - `status: BPStatus`
  - `history: BPMeasurement[]`
- Renders:
  - Connection & Bluetooth status.
  - Start/Stop buttons wired to `DeviceContext.startBPMeasurement` / `stopMeasurement`.
  - Current pressure progress bar.
  - “Last Measurement” card and “Measurement History” list.

This older screen is **not** what the Dashboard button uses now, but it’s helpful as a backup reference if the revamped screen ever needs to be reverted.

---

### 8. Where things are fragile (what tends to break with changes)

To help you re‑stabilize this behavior if anything breaks in future:

- **Callback ownership is global and singleton**:
  - `wellueSDK` is a singleton; whoever last calls `setCallbacks` or `initialize(callbacks)` **replaces** the active callbacks used by `NativeWelluePlugin`.
  - If another component calls `wellueSDK.initialize(...)` with callbacks that **don’t include** `onBPMeasurement`, `onBPProgress`, or `onRealTimeUpdate`, then the BP monitor will stop receiving those events.
  - Best practice (used in `DeviceContext.startScan`) is to **merge** with `wellueSDK.getCallbacks()` so you don’t accidentally drop existing callbacks.

- **Device‑initiated detection depends on `bp2Rt` status codes:**
  - iOS `handleStatusUpdate` emits `bp2Rt.status` and `bpLifecycle.state`.
  - JS `RealTimeData.deviceStatus` uses `data.deviceStatus || data.status`.
  - `LiveBPMonitorRevamped.handleRealTimeUpdate` explicitly checks `status === 4` to detect a device‑initiated measurement.  
    If you ever change how `bp2Rt` is mapped in the bridge, **keep this mapping intact**.

- **Final results depend primarily on the `bpMeasurement` event:**
  - Native (iOS/Android) must emit `bpMeasurement` when final values are ready.
  - `NativeWelluePlugin` must keep the `bpMeasurement` listener wired, and **never** skip `this.bpManager.setMeasurement(measurement)`.
  - If `onBPMeasurement` isn’t registered correctly in JS, `bpResult` will not update even though native has values — but `BPStatus.lastMeasurement` will still be populated via `BPMeasurementManager`.

- **Auto‑save behavior is tied to `bpResult` state:**
  - `autoSaveBPResult` runs whenever `bpResult` becomes non‑null.
  - If you want to disable auto‑saving, do it inside `LiveBPMonitorRevamped` without touching the bridge or native layer.

---

### 9. How to restore this behavior if it breaks (checklist)

If in future some change breaks BP monitoring or result display, you can use this checklist:

1. **Check native events:**
   - On iOS, confirm `emitBPEndData` is still called and emits `bpMeasurement` with `systolic`, `diastolic`, and `pulse` fields.
   - On Android, confirm `bpMeasurement` is still emitted with `systolic`, `diastolic`, `pulseRate`, `map`, `result`.

2. **Verify JS bridge wiring:**
   - `NativeWelluePlugin.setupEventListeners()` has `bpMeasurement`, `bpProgress`, `bp2Rt`, and `bpLifecycle` listeners.
   - `bpMeasurement` listener must always call `this.bpManager.setMeasurement(measurement)`.

3. **Confirm callbacks are not overwritten:**
   - Make sure no new code calls `wellueSDK.initialize({...})` **without** merging existing callbacks via `getCallbacks()`.
   - The last `setCallbacks` call for BP monitoring should come from `LiveBPMonitorRevamped` and must include:
     - `onBPMeasurement`, `onBPProgress`, `onBPStatusChanged`, `onRealTimeUpdate`, `onError`, `onDeviceDisconnected`.

4. **Check device‑initiated detection logic:**
   - `handleRealTimeUpdate` **must continue to**:
     - Treat `status/deviceStatus === 4` as “user pressed button / measuring”.
     - Set `measurementState` to `'inflating'`.
     - Reset `bpResult` to `null` at measurement start.
   - `NativeWelluePlugin` must keep mapping `bp2Rt.status` from iOS / Android into `RealTimeData.status`.

5. **Verify `bpResult` setting:**
   - `handleBPMeasurement` should run on measurement completion and set `bpResult`.
   - `handleBPStatusChanged` should set `bpResult` from `status.lastMeasurement` when `status.status` is `complete/completed`.

With this document as a reference, you can always:

- Restore **device‑initiated measurement detection** by ensuring `bp2Rt.status` → `handleRealTimeUpdate` → `measurementState` mapping.
- Restore **result display** by ensuring `bpMeasurement` → `bpManager.setMeasurement` → `onBPMeasurement` / `onBPStatusChanged` → `bpResult`.

---

If you’d like, next I can implement a very small, conservative fix in `LiveBPMonitorRevamped` that uses the existing `wellueSDK.getBPStatus()` as a fallback to populate `bpResult` when a measurement completes, without touching the native or detection logic.

