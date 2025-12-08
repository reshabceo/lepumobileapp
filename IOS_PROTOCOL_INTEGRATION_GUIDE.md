# iOS Protocol Integration Guide

This guide explains how the Viatom Product Communication Protocol documentation relates to the iOS implementation and how it can help troubleshoot connectivity issues.

## Overview

The iOS implementation uses the **VTMProductLib SDK** (Viatom SDK) which handles the low-level protocol communication internally. However, understanding the protocol specification is crucial for:

1. **Debugging** - Understanding what commands are being sent
2. **Troubleshooting** - Identifying protocol-level issues
3. **Data Parsing** - Understanding response data structures
4. **Fallback Implementation** - Building direct protocol communication if SDK fails

---

## Protocol to iOS Implementation Mapping

### Bluetooth Service & Characteristics

The protocol documentation specifies:

```
Service UUID: 14839ac4-7d7e-415c-9a42-16740cf2339
Write Characteristic UUID: 8b00ace7-eb0b-49b0-bbe9-9aee0a26e1a3
Notify Characteristic UUID: 0734594a-a8e7-4b1a-a6b1-cd5243059a57
```

**iOS Implementation** (`WellueSDKPlugin.swift`):
```swift
private let BP2_SERVICE_UUID = CBUUID(string: "14839AC4-7D7E-415C-9A42-167340CF2339")
private let BP2_WRITE_CHAR_UUID = CBUUID(string: "8B00ACE7-EB0B-49B0-BBE9-9AEE0A26E1A3")
private let BP2_NOTIFY_CHAR_UUID = CBUUID(string: "0734594A-A8E7-4B1A-A6B1-CD5243059A57")
```

✅ **Status**: Correctly implemented - UUIDs match protocol specification

---

## Command Mapping

### Universal Commands (0xE0-0xFF)

| Protocol CMD | Command Name | iOS SDK Method | Purpose |
|-------------|--------------|----------------|----------|
| 0xE0 | Echo | Not directly exposed | Test connectivity |
| 0xE1 | Get device info | `deviceInfo(_:)` delegate | Get device information |
| 0xE2 | Reset | Not directly exposed | Reset device |
| 0xE3 | Factory Reset | Not directly exposed | Factory reset |
| 0xE4 | Battery | `batteryInfo(_:)` delegate | Get battery status |
| 0xF1 | Get file list | SDK file methods | List files on device |
| 0xF2 | Read file start | SDK file methods | Start reading file |
| 0xF3 | Read file content | SDK file methods | Read file chunk |
| 0xF4 | Read file end | SDK file methods | End file read |
| 0xEC | Set time | Not directly exposed | Set device time |

### BP2 Private Commands (0x00-0xDF)

| Protocol CMD | Command Name | iOS SDK Method | Purpose |
|-------------|--------------|----------------|----------|
| 0x08 | Get real-time data | `bp_requestRealData()` | Get BP measuring data |
| 0x09 | Switch device status | `bp_startMeasure()` | Start/stop measurement |

**iOS Implementation** (`WellueSDKPlugin.swift`):
```swift
// Command 0x08 - Get real-time data
case VTMBPCmdGetRealData.rawValue: // 0x08
    let measure = VTMBLEParser.parseBPMeasuring(data)
    // Emits bp2Rt event with pressure, pulse, isDeflating

// Command 0xE4 - Battery
case VTMBLECmdGetBattery.rawValue: // 0xE4
    let bat = VTMBLEParser.parseBatteryInfo(data)
    // Emits batteryInfo event
```

---

## Protocol Packet Structure

According to the documentation, every packet follows this structure:

```
[Head: 0xA5] [CMD] [~CMD] [Pkg. Type] [Pkg. No.] [Length: 2 bytes] [Data: variable] [CRC: 1 byte]
```

**Key Points:**
- **Head**: Always `0xA5`
- **CMD**: Command code (0xE0-0xFF for universal, 0x00-0xDF for private)
- **~CMD**: Inverse of CMD (for error detection)
- **Pkg. Type**: 
  - `0x00` = Regular Request
  - `0x01` = Regular Response
  - `0xA0-0xDF` = Irregular Private Package
  - `0xE0-0xFF` = Irregular Universal Package
- **Pkg. No.**: Serial number (0x00-0xFE, 0xFF reserved)
- **Length**: Data length (little endian, 2 bytes)
- **Data**: Variable length payload
- **CRC**: CRC8 checksum

**Note**: The iOS SDK handles packet construction/parsing internally. You don't need to manually construct packets unless implementing a fallback.

---

## Data Structure Mapping

### Real-Time Data (Command 0x08)

**Protocol Structure**:
```c
RealTimeData {
    RunStatus run_status;
    RealTimeWaveform rt_wav;
}

RunStatus {
    unsigned char status;  // 0=sleep, 1=memory, 2=charge, 3=ready, 
                           // 4=BP measuring, 5=BP measure end,
                           // 6=ECG measuring, 7=ECG measure end
    BatteryInfo battery;
    unsigned char reserved[4];
}

// Type = 0 (BP measuring)
Data {
    unsigned char is_deflating;  // 0=false, 1=true
    short pressure;              // real-time pressure
    unsigned char is_get_pulse;  // 0=false, 1=true
    unsigned short pulse_rate;   // pulse rate
    unsigned char reverse[14];   // reserved
}

// Type = 1 (BP measure finished)
Data {
    unsigned char is_deflating;
    short pressure;
    unsigned short systolic_pressure;
    unsigned short diastolic_pressure;
    unsigned short mean_pressure;
    unsigned short pulse_rate;
    unsigned char state_code;      // BP state code
    unsigned char medical_result;  // diagnostic result
    unsigned char reverse[7];
}
```

**iOS Implementation**:
```swift
// Parsed by SDK's VTMBLEParser.parseBPMeasuring()
case VTMBPCmdGetRealData.rawValue: // 0x08
    let measure = VTMBLEParser.parseBPMeasuring(data)
    var realTime = JSObject()
    realTime["pressure"] = Int(measure.pressure)
    realTime["pulse"] = Int(measure.pulse_rate)
    realTime["isDeflating"] = Int(measure.is_deflating) == 1
    notifyListeners("bp2Rt", data: realTime)
```

### Device Status Values

**Protocol Enum**:
```c
typedef enum {
    STATUS_SLEEP = 0,           // sleep
    STATUS_MEMERY,              // browser records
    STATUS_CHARGE,               // charging
    STATUS_READY,               // power on, ready
    STATUS_BP_MEASURING,        // BP measuring
    STATUS_BP_MEASURE_END,      // BP measure finished
    STATUS_ECG_MEASURING,        // ECG measuring
    STATUS_ECG_MEASURE_END,      // ECG measure finished
} status;
```

**iOS Implementation**:
```swift
// Status values are used in bpRealData delegate
if status == 4 {  // STATUS_BP_MEASURING
    viatomUtils?.bp_requestRealStatus()
    viatomUtils?.requestBPRealData()
}
```

### BP State Codes

**Protocol Values**:
```
0x00: regular (normal)
0x01: the sleeve is loose (unable analysis)
0x02: disturb detected
0x03: weak signal, no pulse detected
>=0x04: other error (device error)
```

**iOS Implementation**:
```swift
finalResult["state"] = Int(end.state_code)
// Emitted in bpMeasurement event
```

---

## Connection Flow with Protocol Context

### 1. Device Discovery

**Protocol**: Not specified (handled by BLE advertising)

**iOS Implementation**:
```swift
// Scans for peripherals
centralManager.scanForPeripherals(withServices: nil, options: [...])

// Filters by name (BP2, Wellue, Viatom)
if looksLikeWellue {
    notifyListeners("deviceFound", data: deviceData)
}
```

### 2. Connection

**Protocol**: Standard BLE connection, then SDK handshake

**iOS Implementation**:
```swift
// 1. CoreBluetooth connect
centralManager.connect(peripheral, options: nil)

// 2. SDK takes over after connection
viatomUtils?.peripheral = peripheral
viatomUtils?.deviceDelegate = self
// SDK performs internal handshake (likely sends 0xE1 Get device info)
```

### 3. Service/Characteristic Discovery

**Protocol**: Standard BLE GATT discovery

**iOS Implementation**:
```swift
// Discover services
peripheral.discoverServices([BP2_SERVICE_UUID])

// Discover characteristics
peripheral.discoverCharacteristics([BP2_WRITE_CHAR_UUID, BP2_NOTIFY_CHAR_UUID], for: service)

// Enable notifications
peripheral.setNotifyValue(true, for: bp2NotifyCharacteristic)
```

### 4. SDK Deployment

**Protocol**: SDK performs internal initialization (likely multiple commands)

**iOS Implementation**:
```swift
// SDK calls utilDeployCompletion when ready
public func utilDeployCompletion(_ util: VTMURATUtils, deviceType: VTMDeviceType) {
    isSdkDeployed = true
    // Device is ready for commands
}
```

### 5. Real-Time Data Request

**Protocol**: Command 0x08 (Get real-time data)

**iOS Implementation**:
```swift
// Request real-time data
viatomUtils?.requestBPRealData()

// Response comes via delegate
public func util(_ util: VTMURATUtils, commandCompletion cmdType: UInt8, ...) {
    case VTMBPCmdGetRealData.rawValue: // 0x08
        // Parse and emit data
}
```

### 6. Start Measurement

**Protocol**: Command 0x09 (Switch device status) with Target_status = 0x00

**iOS Implementation**:
```swift
// Start BP measurement
viatomUtils?.bp_startMeasure()

// Protocol equivalent: Send 0x09 with data = [0x00]
```

---

## Troubleshooting with Protocol Knowledge

### Issue 1: Device Connects But No Data

**Protocol Context**: 
- Device should respond to 0x08 (Get real-time data)
- Check if SDK is sending commands correctly

**Debug Steps**:
1. Check if `utilDeployCompletion` is called (SDK ready)
2. Verify `requestBPRealData()` is being called
3. Check if `commandCompletion` delegate is firing
4. Log raw data to see if protocol packets are received

**Protocol-Level Debugging**:
```swift
// Add logging to see raw protocol data
public func util(_ util: VTMURATUtils, commandCompletion cmdType: UInt8, ...) {
    debugLog("Command: 0x\(String(format: "%02X", cmdType))")
    if let data = response {
        debugLog("Raw data: \(data.map { String(format: "%02X", $0) }.joined(separator: " "))")
    }
}
```

### Issue 2: Status Values Don't Match Expected

**Protocol Context**:
- Status enum: 0=sleep, 1=memory, 2=charge, 3=ready, 4=measuring, 5=end, 6=ECG measuring, 7=ECG end

**Debug Steps**:
1. Log actual status values received
2. Compare with protocol specification
3. Check if SDK is parsing correctly

**Example**:
```swift
// Log status values
debugLog("Status received: \(status) (expected: 3=ready, 4=measuring, 5=end)")
```

### Issue 3: Measurement Doesn't Start

**Protocol Context**:
- Command 0x09 with Target_status = 0x00 should start measurement
- Device should transition to status 4 (measuring)

**Debug Steps**:
1. Verify `bp_startMeasure()` is called
2. Check if device status changes to 4
3. Monitor for real-time data (0x08 responses)

**Protocol-Level Check**:
```swift
// After starting measurement, poll status
viatomUtils?.bp_requestRealStatus()

// Should receive status = 4 (measuring) via delegate
```

### Issue 4: Data Parsing Errors

**Protocol Context**:
- All values are little endian
- Data structures have specific byte layouts
- CRC8 validation should pass

**Debug Steps**:
1. Log raw byte arrays
2. Verify byte order (little endian)
3. Check data structure offsets match protocol

**Example Raw Data Logging**:
```swift
if let data = response {
    let hexString = data.map { String(format: "%02X", $0) }.joined(separator: " ")
    debugLog("Raw protocol data: \(hexString)")
    
    // Parse manually to verify SDK parsing
    if data.count >= 2 {
        let pressure = Int16(littleEndian: data.withUnsafeBytes { $0.load(fromByteOffset: X, as: Int16.self) })
        debugLog("Manual parse - pressure: \(pressure)")
    }
}
```

---

## Direct Protocol Implementation (Fallback)

If the SDK fails, you can implement direct protocol communication:

### 1. Packet Construction

```swift
func buildProtocolPacket(cmd: UInt8, data: Data, pkgNo: UInt8) -> Data {
    var packet = Data()
    
    // Head
    packet.append(0xA5)
    
    // CMD
    packet.append(cmd)
    
    // ~CMD (inverse)
    packet.append(~cmd)
    
    // Pkg. Type (0x00 = Regular Request)
    packet.append(0x00)
    
    // Pkg. No.
    packet.append(pkgNo)
    
    // Length (little endian, 2 bytes)
    let length = UInt16(data.count)
    packet.append(contentsOf: withUnsafeBytes(of: length.littleEndian) { Array($0) })
    
    // Data
    packet.append(data)
    
    // CRC8
    let crc = calculateCRC8(data: packet)
    packet.append(crc)
    
    return packet
}

func calculateCRC8(data: Data) -> UInt8 {
    var crc: UInt8 = 0
    let poly: UInt8 = 0x07
    
    for byte in data {
        crc ^= byte
        for _ in 0..<8 {
            if crc & 0x80 != 0 {
                crc = (crc << 1) ^ poly
            } else {
                crc = crc << 1
            }
        }
    }
    
    return crc
}
```

### 2. Send Command

```swift
func sendCommand(cmd: UInt8, data: Data = Data()) {
    guard let writeChar = bp2WriteCharacteristic,
          let peripheral = connectedDevice else {
        return
    }
    
    let packet = buildProtocolPacket(cmd: cmd, data: data, pkgNo: currentPkgNo)
    currentPkgNo = (currentPkgNo + 1) % 0xFF
    
    peripheral.writeValue(packet, for: writeChar, type: .withResponse)
}
```

### 3. Parse Response

```swift
func parseProtocolPacket(_ data: Data) -> (cmd: UInt8, pkgType: UInt8, payload: Data)? {
    guard data.count >= 7, data[0] == 0xA5 else {
        return nil
    }
    
    let cmd = data[1]
    let pkgType = data[3]
    let length = UInt16(littleEndian: data.withUnsafeBytes { $0.load(fromByteOffset: 5, as: UInt16.self) })
    
    guard data.count >= 7 + Int(length) + 1 else {
        return nil
    }
    
    let payload = data.subdata(in: 7..<7+Int(length))
    let crc = data[7 + Int(length)]
    
    // Verify CRC
    let calculatedCRC = calculateCRC8(data: data.subdata(in: 0..<7+Int(length)))
    guard crc == calculatedCRC else {
        return nil
    }
    
    return (cmd: cmd, pkgType: pkgType, payload: payload)
}
```

### 4. Example: Get Real-Time Data (0x08)

```swift
// Send command 0x08
sendCommand(cmd: 0x08, data: Data())

// Parse response in didUpdateValueFor characteristic
if let parsed = parseProtocolPacket(data) {
    if parsed.cmd == 0x08 && parsed.pkgType == 0x01 { // Response
        // Parse RealTimeData structure
        let status = parsed.payload[0]
        let batteryPercent = parsed.payload[1]
        let batteryVoltage = UInt16(littleEndian: parsed.payload.withUnsafeBytes { 
            $0.load(fromByteOffset: 2, as: UInt16.self) 
        })
        
        // Parse pressure data based on type
        // ...
    }
}
```

---

## Key Protocol Insights for iOS

### 1. Little Endian Format

**All multi-byte values are little endian**:
```swift
// Correct way to read UInt16
let value = UInt16(littleEndian: data.withUnsafeBytes { 
    $0.load(fromByteOffset: offset, as: UInt16.self) 
})

// Correct way to write UInt16
var bytes = withUnsafeBytes(of: value.littleEndian) { Array($0) }
```

### 2. Packet Numbering

- Packet numbers increment from 0x00 to 0xFE
- 0xFF is reserved
- Wrap around to 0x00 after 0xFE

### 3. Error Codes

**Irregular Package Types** (error indicators):
- `0xE0`: unable to find file
- `0xE1`: read file failed
- `0xE2`: write file failed
- `0xFB`: device busy
- `0xFC`: illegal package
- `0xFD`: package command not support
- `0xFF`: regular error

**Check in responses**:
```swift
if pkgType >= 0xE0 {
    // Error occurred
    errorLog("Protocol error: 0x\(String(format: "%02X", pkgType))")
}
```

### 4. Status Transitions

**Expected flow**:
1. Device connects → Status 3 (ready)
2. Start measurement (0x09) → Status 4 (measuring)
3. Measurement completes → Status 5 (end)
4. Result data received → Parse final values

**Monitor transitions**:
```swift
var lastStatus: UInt8 = 0
if status != lastStatus {
    debugLog("Status transition: \(lastStatus) → \(status)")
    lastStatus = status
}
```

---

## Testing Protocol Compliance

### 1. Echo Test (0xE0)

```swift
// Send echo command
sendCommand(cmd: 0xE0, data: Data())

// Should receive same data back
```

### 2. Device Info Test (0xE1)

```swift
// Send get device info
sendCommand(cmd: 0xE1, data: Data())

// Parse DeviceInfo structure
// Verify firmware version, device type, etc.
```

### 3. Battery Test (0xE4)

```swift
// Send battery command
sendCommand(cmd: 0xE4, data: Data())

// Parse BatteryInfo structure
// Verify battery percent, voltage, state
```

---

## Common Protocol Issues

### Issue: CRC Mismatch

**Cause**: Incorrect CRC calculation or data corruption

**Solution**:
- Verify CRC8 algorithm matches protocol spec
- Check if data is being modified before CRC calculation
- Ensure packet structure is correct

### Issue: Wrong Byte Order

**Cause**: Using big endian instead of little endian

**Solution**:
- Always use `.littleEndian` when reading/writing multi-byte values
- Verify with known test values

### Issue: Packet Number Wraparound

**Cause**: Not handling 0xFF reserved value

**Solution**:
- Wrap to 0x00 after 0xFE (not 0xFF)
- Track packet numbers correctly

### Issue: Missing Head Byte

**Cause**: Not including 0xA5 head in CRC calculation

**Solution**:
- Include all bytes from head to data in CRC calculation
- CRC is calculated on: [Head][CMD][~CMD][Pkg. Type][Pkg. No.][Length][Data]

---

## Summary

The protocol documentation is valuable for:

1. **Understanding SDK behavior** - Know what commands the SDK is sending
2. **Debugging** - Parse raw data to verify SDK parsing
3. **Fallback implementation** - Build direct protocol if SDK fails
4. **Data validation** - Verify received data matches protocol spec
5. **Error handling** - Understand error codes and responses

The iOS implementation currently relies on the VTMProductLib SDK, but having protocol knowledge enables:
- Better debugging
- Fallback implementation if needed
- Verification of SDK correctness
- Understanding of data structures

---

## References

- **Protocol Documentation**: Viatom Product Communication Protocol
- **File Parse Protocol**: Viatom File Parse Protocol
- **iOS SDK**: VTMProductLib framework
- **Implementation**: `ios/App/App/WellueSDKPlugin.swift`

