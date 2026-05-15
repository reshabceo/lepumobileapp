import Foundation
import Capacitor
import CoreBluetooth
import VTMProductLib

@objc(WellueSDK)
public class WellueSDK: CAPPlugin, CBCentralManagerDelegate, CBPeripheralDelegate, VTMURATDeviceDelegate, VTMURATUtilsDelegate {
    private var centralManager: CBCentralManager?
    private var isBluetoothEnabled = false
    private var discoveredDevices: [String: CBPeripheral] = [:]
    private var connectedDevice: CBPeripheral?
    private var isScanning = false
    private var pendingScan = false
    
    // Viatom SDK integration
    private var viatomUtils: VTMURATUtils?
    private var currentDevice: CBPeripheral?
    private var isConnected = false
    private var isMeasuring = false
    private var pendingConnectCall: CAPPluginCall?  // Store connect call until SDK deploys
    private var pendingBatteryCall: CAPPluginCall?  // Store battery call until delegate returns
    
    // 🔥 Real-time data streaming timer
    private var realTimeDataTimer: Timer?
    private var isSdkDeployed = false  // Track if SDK handshake is complete
    private var deploymentTimer: Timer?  // Timeout for SDK deployment
    private var deploymentRetryCount = 0  // Track retry attempts
    private let MAX_DEPLOYMENT_RETRIES = 3
    
    // 🔥 SDK Health Monitoring (Watchdog)
    private var lastDataReceivedTime: Date?  // Track when we last received data
    private var healthCheckTimer: Timer?  // Periodic health check
    private let HEALTH_CHECK_INTERVAL = 3.0  // Check every 3 seconds
    private let DATA_TIMEOUT_THRESHOLD = 10.0  // If no data for 10 seconds, SDK is dead
    
    // BP2 Service and Characteristic UUIDs (from Viatom LepuDemo + Android implementation)
    private let BP2_SERVICE_UUID = CBUUID(string: "14839AC4-7D7E-415C-9A42-167340CF2339")
    private let BP2_WRITE_CHAR_UUID = CBUUID(string: "8B00ACE7-EB0B-49B0-BBE9-9AEE0A26E1A3")
    private let BP2_NOTIFY_CHAR_UUID = CBUUID(string: "0734594A-A8E7-4B1A-A6B1-CD5243059A57")
    
    // Alternative approach: Scan with BP2 service UUID filter (like Android does)
    private var scanWithServiceFilter = false  // Set to true to enable UUID filtering
    
    private var bp2WriteCharacteristic: CBCharacteristic?
    private var bp2NotifyCharacteristic: CBCharacteristic?
    
    // Debug logging
    private let debugPrefix = "🔵 [WELLUE SDK]"
    private let errorPrefix = "❌ [WELLUE SDK]"
    private let successPrefix = "✅ [WELLUE SDK]"
    private let warningPrefix = "⚠️ [WELLUE SDK]"

    public override func load() {
        NSLog("🚀🚀🚀🚀🚀 [WELLUE LOAD] ===========================================")
        NSLog("🚀🚀🚀🚀🚀 [WELLUE LOAD] PLUGIN LOAD() METHOD EXECUTED!!!!!!!!")
        NSLog("🚀🚀🚀🚀🚀 [WELLUE LOAD] ===========================================")
        print("🚀🚀🚀🚀🚀 [WELLUE LOAD] PLUGIN LOAD() METHOD EXECUTED!!!!!!!!")
        debugLog("Plugin loaded - Starting initialization")
        centralManager = CBCentralManager(delegate: self, queue: nil)
        debugLog("CBCentralManager initialized")
        
        // Initialize Viatom SDK
        viatomUtils = VTMURATUtils()
        viatomUtils?.delegate = self
        debugLog("Viatom SDK initialized successfully")
        debugLog("SDK version check: \(String(describing: viatomUtils))")
        NSLog("🚀🚀🚀🚀🚀 [WELLUE LOAD] Load method completed")
    }
    
    // MARK: - Debug Logging
    private func debugLog(_ message: String, function: String = #function, line: Int = #line) {
        print("\(debugPrefix) [\(function):\(line)] \(message)")
    }
    
    private func errorLog(_ message: String, function: String = #function, line: Int = #line) {
        print("\(errorPrefix) [\(function):\(line)] \(message)")
    }
    
    private func successLog(_ message: String, function: String = #function, line: Int = #line) {
        print("\(successPrefix) [\(function):\(line)] \(message)")
    }
    
    private func warningLog(_ message: String, function: String = #function, line: Int = #line) {
        print("\(warningPrefix) [\(function):\(line)] \(message)")
    }
    
    private func startCoreBluetoothScanIfPossible() {
        guard let centralManager = centralManager else {
            errorLog("CBCentralManager not initialized in startCoreBluetoothScanIfPossible")
            return
        }
        guard centralManager.state == .poweredOn else {
            warningLog("Bluetooth not powered on yet; deferring scan")
            pendingScan = true
            return
        }
        if isScanning {
            warningLog("Scan already in progress (startCoreBluetoothScanIfPossible)")
            return
        }
        discoveredDevices.removeAll()
        debugLog("Starting Core Bluetooth scan (auto)")
        centralManager.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
        isScanning = true
        successLog("Bluetooth scan started (auto)")
    }
    
    private func getBluetoothStateDescription(_ state: CBManagerState) -> String {
        switch state {
        case .unknown: return "Unknown"
        case .resetting: return "Resetting"
        case .unsupported: return "Unsupported"
        case .unauthorized: return "Unauthorized"
        case .poweredOff: return "Powered Off"
        case .poweredOn: return "Powered On"
        @unknown default: return "Unknown State"
        }
    }

    // MARK: - CBCentralManagerDelegate
    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        let isEnabled = (central.state == .poweredOn)
        isBluetoothEnabled = isEnabled
        debugLog("Bluetooth state changed to: \(isEnabled) (state=\(central.state.rawValue))")
        debugLog("Bluetooth state details: \(getBluetoothStateDescription(central.state))")
        var result = JSObject()
        result["enabled"] = isEnabled
        notifyListeners("bluetoothStatusChanged", data: result)
        
        // If a scan was requested before power-on, start it now
        if isEnabled && pendingScan {
            debugLog("Pending scan detected after power-on; starting scan now")
            pendingScan = false
            startCoreBluetoothScanIfPossible()
        }
    }
    
    public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi: NSNumber) {
        let advLocalName = advertisementData[CBAdvertisementDataLocalNameKey] as? String
        let rawPeripheralName = peripheral.name
        let resolvedName = (advLocalName?.trimmingCharacters(in: .whitespacesAndNewlines)).flatMap { $0.isEmpty ? nil : $0 }
            ?? (rawPeripheralName?.trimmingCharacters(in: .whitespacesAndNewlines)).flatMap { $0.isEmpty ? nil : $0 }
            ?? "Unknown Device"
        let deviceId = peripheral.identifier.uuidString

        NSLog("📱📱📱 [BLE DISCOVERY] Device: \(resolvedName) UUID: \(deviceId) RSSI: \(rssi)")
        debugLog("Discovered device: \(resolvedName) (ID: \(deviceId))  RSSI=\(rssi)")
        if let advLocalName = advLocalName { 
            NSLog("📱 [BLE DISCOVERY] Adv name: \(advLocalName)")
            debugLog("Adv local name: \(advLocalName)") 
        }

        // Heuristic match for Wellue/Viatom BP devices using name
        let nameLower = resolvedName.lowercased()
        // More precise matching: BP2 at start/end, or wellue/viatom brand, but NOT airpods/headphones
        let startsWithBP = nameLower.hasPrefix("bp") || nameLower.hasPrefix("wellue") || nameLower.hasPrefix("viatom")
        let containsBP2 = nameLower.contains("bp2") || nameLower.contains("bp-2")
        let isBrandMatch = nameLower.contains("wellue") || nameLower.contains("viatom")
        let isNotAudio = !nameLower.contains("airpod") && !nameLower.contains("headphone") && !nameLower.contains("earbud")
        let looksLikeWellue = (startsWithBP || containsBP2 || isBrandMatch) && isNotAudio

        // Track peripheral so we can connect when requested
        discoveredDevices[deviceId] = peripheral

        // Only emit Wellue/BP2 devices to avoid connecting to random Bluetooth devices
        if looksLikeWellue {
            var deviceData = JSObject()
            deviceData["id"] = deviceId
            deviceData["deviceId"] = deviceId
            deviceData["address"] = deviceId
            deviceData["name"] = resolvedName
            deviceData["deviceName"] = resolvedName
            deviceData["rssi"] = rssi.intValue
            deviceData["wellueHint"] = true
            
            NSLog("✅ [BLE DISCOVERY] Wellue device detected, emitting to JS: \(resolvedName)")
            debugLog("Notifying listeners of discovered Wellue device (deviceFound)")
            notifyListeners("deviceFound", data: deviceData)
        } else {
            NSLog("⏭️ [BLE DISCOVERY] Skipping non-Wellue device: \(resolvedName)")
            debugLog("Skipping non-Wellue device: \(resolvedName)")
        }
    }
    
    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        successLog("Successfully connected to device: \(peripheral.name ?? "Unknown")")
        isConnected = true
        connectedDevice = peripheral
        currentDevice = peripheral
        
        // Hand-off connection/session management to Viatom SDK
        if let utils = viatomUtils {
            utils.peripheral = peripheral
            utils.deviceDelegate = self
            debugLog("Handing over to Viatom SDK after OS-level connect")
            // SDK will perform its proprietary handshake; no manual service discovery here
        }
        
        var result = JSObject()
        result["deviceId"] = peripheral.identifier.uuidString
        result["deviceName"] = peripheral.name ?? "Unknown Device"
        result["connected"] = true
        
        debugLog("Notifying listeners of successful connection")
        notifyListeners("deviceConnected", data: result)
    }
    
    public func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        errorLog("Failed to connect to device: \(peripheral.name ?? "Unknown")")
        if let error = error {
            errorLog("Connection error: \(error.localizedDescription)")
        }
        
        var result = JSObject()
        result["deviceId"] = peripheral.identifier.uuidString
        result["deviceName"] = peripheral.name ?? "Unknown Device"
        result["connected"] = false
        result["error"] = error?.localizedDescription ?? "Unknown error"
        
        debugLog("Notifying listeners of connection failure")
        notifyListeners("deviceConnectionFailed", data: result)
    }
    
    public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        warningLog("Device disconnected: \(peripheral.name ?? "Unknown")")
        if let error = error {
            warningLog("Disconnection error: \(error.localizedDescription)")
        }
        
        isConnected = false
        connectedDevice = nil
        currentDevice = nil
        isSdkDeployed = false  // Reset deployment flag on disconnect
        
        var result = JSObject()
        result["deviceId"] = peripheral.identifier.uuidString
        result["deviceName"] = peripheral.name ?? "Unknown Device"
        result["connected"] = false
        result["error"] = error?.localizedDescription
        
        debugLog("Notifying listeners of disconnection")
        notifyListeners("deviceDisconnected", data: result)
    }

    // MARK: - SDK Health Monitoring
    private func startHealthMonitoring() {
        NSLog("🏥 [HEALTH] Starting SDK health monitoring (check every \(HEALTH_CHECK_INTERVAL)s)")
        
        // Stop any existing health check
        healthCheckTimer?.invalidate()
        
        // Initialize last data time
        lastDataReceivedTime = Date()
        
        // Start periodic health check
        healthCheckTimer = Timer.scheduledTimer(withTimeInterval: HEALTH_CHECK_INTERVAL, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            self.performHealthCheck()
        }
    }
    
    private func stopHealthMonitoring() {
        NSLog("🏥 [HEALTH] Stopping SDK health monitoring")
        healthCheckTimer?.invalidate()
        healthCheckTimer = nil
        lastDataReceivedTime = nil
    }
    
    private func performHealthCheck() {
        guard let lastDataTime = lastDataReceivedTime else {
            NSLog("🏥 [HEALTH] No baseline data received yet")
            return
        }
        
        let timeSinceLastData = Date().timeIntervalSince(lastDataTime)
        
        if timeSinceLastData > DATA_TIMEOUT_THRESHOLD {
            NSLog("⚠️ [HEALTH] SDK TIMEOUT! No data for \(Int(timeSinceLastData)) seconds")
            NSLog("🔄 [HEALTH] SDK appears dead - triggering auto-recovery...")
            
            // Auto-recovery: Re-deploy SDK
            if isSdkDeployed {
                NSLog("🔄 [HEALTH] Marking SDK as not deployed, forcing re-deployment...")
                isSdkDeployed = false
                triggerSDKDeployment()
            }
            
            // Notify JavaScript layer
            var result = JSObject()
            result["error"] = "SDK timeout detected"
            result["timeSinceLastData"] = timeSinceLastData
            notifyListeners("sdkHealthWarning", data: result)
        } else {
            // SDK is healthy
            NSLog("✅ [HEALTH] SDK healthy - last data \(Int(timeSinceLastData))s ago")
        }
    }
    
    private func markDataReceived() {
        // Update timestamp whenever we receive ANY data from SDK
        lastDataReceivedTime = Date()
    }
    
    // MARK: - SDK Deployment Management
    private func triggerSDKDeployment() {
        guard let device = currentDevice else {
            NSLog("❌ [SDK DEPLOY] No device to deploy SDK for")
            return
        }
        
        guard let utils = viatomUtils else {
            NSLog("❌ [SDK DEPLOY] viatomUtils not initialized")
            return
        }
        
        NSLog("🔄 [SDK DEPLOY] Triggering SDK deployment for device: \(device.name ?? "Unknown")")
        NSLog("🔄 [SDK DEPLOY] Retry count: \(deploymentRetryCount)/\(MAX_DEPLOYMENT_RETRIES)")
        
        // Cancel existing deployment timer
        deploymentTimer?.invalidate()
        
        // Set a 5-second timeout for deployment completion
        deploymentTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: false) { [weak self] _ in
            guard let self = self else { return }
            
            if !self.isSdkDeployed {
                NSLog("⏰ [SDK DEPLOY] Timeout! utilDeployCompletion not called within 5 seconds")
                
                if self.deploymentRetryCount < self.MAX_DEPLOYMENT_RETRIES {
                    self.deploymentRetryCount += 1
                    NSLog("🔄 [SDK DEPLOY] Retrying deployment... (\(self.deploymentRetryCount)/\(self.MAX_DEPLOYMENT_RETRIES))")
                    
                    // Re-trigger deployment by re-setting peripheral
                    if let device = self.currentDevice {
                        utils.peripheral = device
                        self.triggerSDKDeployment()  // Recursive retry with new timer
                    }
                } else {
                    NSLog("❌ [SDK DEPLOY] Max retries reached. Deployment failed.")
                    // Notify JavaScript layer of failure
                    var result = JSObject()
                    result["error"] = "SDK deployment failed after \(self.MAX_DEPLOYMENT_RETRIES) attempts"
                    self.notifyListeners("sdkDeploymentFailed", data: result)
                }
            }
        }
        
        NSLog("⏰ [SDK DEPLOY] Deployment timeout timer started (5 seconds)")
    }
    
    // MARK: - VTMURATDeviceDelegate & VTMURATUtilsDelegate
    public func utilDeployCompletion(_ util: VTMURATUtils) {
        NSLog("🎉🎉🎉 [VIATOM SDK] DEPLOYMENT COMPLETED! SDK IS READY!")
        successLog("Viatom SDK deployment completion callback received")
        
        // Cancel deployment timeout timer
        deploymentTimer?.invalidate()
        deploymentTimer = nil
        deploymentRetryCount = 0  // Reset retry counter
        NSLog("✅ [SDK DEPLOY] Deployment successful, timer cancelled")
        
        viatomUtils = util
        isSdkDeployed = true  // ✅ SDK is now ready to accept commands
        
        // 🔥 Start health monitoring to ensure SDK stays alive
        startHealthMonitoring()
        
        // NOW resolve the pending connect call with device info
        if let call = pendingConnectCall, let device = currentDevice {
            var result = JSObject()
            result["deviceId"] = device.identifier.uuidString
            result["deviceName"] = device.name ?? "Unknown Device"
            result["name"] = device.name ?? "Unknown Device"
            result["address"] = device.identifier.uuidString
            result["model"] = "BP2"
            result["connected"] = true
            
            NSLog("🎉 [VIATOM SDK] Resolving pending connect call with device data: \(result)")
            call.resolve(result)
            pendingConnectCall = nil
            
            // Emit deviceConnected event
            notifyListeners("deviceConnected", data: result)
        }
        
        debugLog("Requesting device info to verify connection")
        viatomUtils?.requestDeviceInfo()
        
        // Begin real-time BP stream immediately so device-initiated measurements are detected
        debugLog("Requesting BP real-time data stream after deployment")
        viatomUtils?.requestBPRealData()

        // Request periodic status updates (battery, measuring state)
        viatomUtils?.bp_requestRealStatus()
    }

    // MARK: - VTMURATUtilsDelegate (generic command callbacks)
    public func util(_ util: VTMURATUtils, commandCompletion cmdType: UInt8, deviceType: VTMDeviceType, response: Data?) {
        // 🏥 Mark data as received (SDK is alive!)
        markDataReceived()
        
        debugLog("📊 [UTIL] ========================================")
        debugLog("📊 [UTIL] Command completion received!")
        debugLog("📊 [UTIL] cmdType: 0x\(String(format: "%02X", cmdType))")
        debugLog("📊 [UTIL] deviceType: \(deviceType.rawValue)")
        debugLog("📊 [UTIL] response data: \(response != nil ? "\(response!.count) bytes" : "nil")")
        debugLog("📊 [UTIL] ========================================")

        guard deviceType == VTMDeviceTypeBP else {
            debugLog("📊 [UTIL] ❌ Not a BP device, ignoring")
            return
        }

        guard let data = response else {
            errorLog("📊 [UTIL] ❌ No response data!")
            return
        }

        // Dispatch by command type
        switch cmdType {
        case VTMBPCmdGetRealData.rawValue: // 0x08 - measuring data
            let measure = VTMBLEParser.parseBPMeasuring(data)
            var realTime = JSObject()
            realTime["deviceId"] = currentDevice?.identifier.uuidString
            realTime["pressure"] = Int(measure.pressure)
            realTime["pulse"] = Int(measure.pulse_rate)
            realTime["isDeflating"] = Int(measure.is_deflating) == 1
            debugLog("📊 [0x08] Parsed BP measuring data: pressure=\(measure.pressure) pulse=\(measure.pulse_rate) isDeflating=\(measure.is_deflating)")
            debugLog("📊 [0x08] Sending bp2Rt event with data: \(realTime)")
            notifyListeners("bp2Rt", data: realTime)
            debugLog("📊 [0x08] ✅ bp2Rt event sent!")

        case VTMBPCmdGetRealStatus.rawValue: // 0x06 - run status + battery
            let status = VTMBLEParser.parseBPRealTimeStatus(data)
            var statusData = JSObject()
            statusData["deviceId"] = currentDevice?.identifier.uuidString
            statusData["status"] = Int(status.status)
            statusData["batteryPercent"] = Int(status.battery.percent)
            debugLog("📊 [0x06] Parsed BP status: status=\(status.status) battery=\(status.battery.percent)%")
            debugLog("📊 [0x06] Sending bp2Rt event with data: \(statusData)")
            notifyListeners("bp2Rt", data: statusData)
            debugLog("📊 [0x06] ✅ bp2Rt event sent!")

        case VTMBPCmdGetRealPressure.rawValue: // 0x05 - pressure only
            let p = VTMBLEParser.parseBPRealTimePressure(data)
            var obj = JSObject()
            obj["deviceId"] = currentDevice?.identifier.uuidString
            obj["pressure"] = Int(p.pressure)
            debugLog("📊 [0x05] Parsed BP pressure: pressure=\(p.pressure)")
            debugLog("📊 [0x05] Sending bp2Rt event with data: \(obj)")
            notifyListeners("bp2Rt", data: obj)
            debugLog("📊 [0x05] ✅ bp2Rt event sent!")

        case VTMBLECmdGetBattery.rawValue: // 0xE4 - battery info
            let bat = VTMBLEParser.parseBatteryInfo(data)
            var batteryData = JSObject()
            batteryData["batteryLevel"] = Int(bat.percent)
            batteryData["deviceId"] = currentDevice?.identifier.uuidString
            notifyListeners("batteryInfo", data: batteryData)
            if let call = pendingBatteryCall {
                call.resolve(["batteryLevel": Int(bat.percent)])
                pendingBatteryCall = nil
            }

        default:
            // Try to parse possible end-of-measure payloads
            let end = VTMBLEParser.parseBPEndMeasure(data)
            // Heuristic: non-zero systolic/diastolic indicates end result
            if end.systolic_pressure != 0 && end.diastolic_pressure != 0 {
                isMeasuring = false
                var finalResult = JSObject()
                finalResult["systolic"] = Int(end.systolic_pressure)
                finalResult["diastolic"] = Int(end.diastolic_pressure)
                finalResult["pulse"] = Int(end.pulse_rate)
                finalResult["state"] = Int(end.state_code)
                finalResult["deviceId"] = currentDevice?.identifier.uuidString
                successLog("Parsed BP end result: SYS=\(end.systolic_pressure) DIA=\(end.diastolic_pressure) PR=\(end.pulse_rate)")
                notifyListeners("bpMeasurement", data: finalResult)
            }
        }
    }

    public func util(_ util: VTMURATUtils, commandFailed cmdType: UInt8, deviceType: VTMDeviceType, failedType: VTMBLEPkgType) {
        errorLog("Command failed. cmdType=\(cmdType) deviceType=\(deviceType) failedType=\(failedType.rawValue)")
    }
    
    public func deviceInfo(_ deviceInfo: VTMDeviceInfo) {
        successLog("Device Info received")
        debugLog("Device type: \(deviceInfo.device_type)")
        debugLog("Firmware version(raw): \(deviceInfo.fw_version)")
        debugLog("Hardware version(raw): \(deviceInfo.hw_version)")

        var infoData = JSObject()
        infoData["deviceId"] = currentDevice?.identifier.uuidString
        infoData["deviceType"] = Int(deviceInfo.device_type)
        infoData["firmwareVersion"] = Int(deviceInfo.fw_version)
        infoData["hardwareVersion"] = Int(deviceInfo.hw_version)

        debugLog("Notifying listeners of device info")
        notifyListeners("deviceInfo", data: infoData)
    }
    
    public func batteryInfo(_ batteryLevel: Int) {
        successLog("Battery info received: \(batteryLevel)%")
        
        var batteryData = JSObject()
        batteryData["batteryLevel"] = batteryLevel
        batteryData["deviceId"] = currentDevice?.identifier.uuidString
        
        debugLog("Notifying listeners of battery info")
        notifyListeners("batteryInfo", data: batteryData)
        
        // If there's a pending direct request, resolve it now
        if let call = pendingBatteryCall {
            call.resolve(["batteryLevel": batteryLevel])
            pendingBatteryCall = nil
        }
    }
    
    public func bpRealData(_ realData: VTMBPRealTimeData) {
        NSLog("🔥🔥🔥 [BP REAL DATA] AUTOMATIC DELEGATE FIRED! 🔥🔥🔥")
        NSLog("📊 [BP REAL DATA] Status: \(realData.run_status.status)")
        NSLog("📊 [BP REAL DATA] Battery: \(realData.run_status.battery.percent)%")
        NSLog("📊 [BP REAL DATA] Waveform type: \(realData.rt_wav.type)")
        
        // Mark data received for health monitoring
        markDataReceived()
        
        let status = Int(realData.run_status.status)
        let battery = Int(realData.run_status.battery.percent)
        let waveType = Int(realData.rt_wav.type)

        var realTimeData = JSObject()
        realTimeData["status"] = status
        realTimeData["batteryPercent"] = battery
        realTimeData["waveType"] = waveType
        realTimeData["deviceId"] = currentDevice?.identifier.uuidString

        NSLog("📊 [BP REAL DATA] Sending bp2Rt event with status=\(status) battery=\(battery)%")
        notifyListeners("bp2Rt", data: realTimeData)
        NSLog("✅ [BP REAL DATA] bp2Rt event sent to JavaScript!")
        
        // When status changes to 4 (measuring), start requesting real-time pressure data
        if status == 4 {
            NSLog("🚀 [BP REAL DATA] Status=4 detected! Device is measuring, requesting real-time pressure data...")
            viatomUtils?.bp_requestRealStatus()
            viatomUtils?.requestBPRealData()
        }
    }
    
    public func bpMeasurementResult(_ result: VTMBPEndMeasureData) {
        successLog("BP Measurement completed")
        debugLog("Final result - Systolic: \(result.systolic_pressure), Diastolic: \(result.diastolic_pressure)")
        debugLog("Pulse: \(result.pulse_rate), State: \(result.state_code)")

        isMeasuring = false

        var finalResult = JSObject()
        finalResult["systolic"] = Int(result.systolic_pressure)
        finalResult["diastolic"] = Int(result.diastolic_pressure)
        finalResult["pulse"] = Int(result.pulse_rate)
        finalResult["state"] = Int(result.state_code)
        finalResult["deviceId"] = currentDevice?.identifier.uuidString

        debugLog("Notifying listeners of final BP result (bpMeasurement)")
        notifyListeners("bpMeasurement", data: finalResult)
    }
    
    // MARK: - ECG Delegate Methods
    // NOTE: ECG delegates commented out - VTMProductLib SDK doesn't expose ECG types yet
    // These will be re-enabled once we confirm the correct type names from the SDK
    
    /* Commented out until SDK types are confirmed
    public func ecgRealData(_ realData: VTMECGRealTimeData) {
        debugLog("ECG Real Data received")
        
        var waveformArray: [Int] = []
        
        if let waveDataPointer = realData.ecg_wav_data {
            let sampleCount = Int(realData.ecg_wav_num)
            for i in 0..<sampleCount {
                waveformArray.append(Int(waveDataPointer[i]))
            }
        }
        
        var ecgData = JSObject()
        ecgData["waveform"] = waveformArray
        ecgData["heartRate"] = Int(realData.heart_rate)
        ecgData["sampleRate"] = 125
        ecgData["mvPerCount"] = 1
        ecgData["deviceId"] = currentDevice?.identifier.uuidString
        
        debugLog("Notifying listeners of ECG real-time data (ecgData) - HR: \(realData.heart_rate), Samples: \(waveformArray.count)")
        notifyListeners("ecgData", data: ecgData)
    }
    
    public func ecgMeasurementResult(_ result: VTMECGEndMeasureData) {
        successLog("ECG Measurement completed")
        debugLog("Final ECG result - HR: \(result.heart_rate), State: \(result.state_code)")
        
        isMeasuring = false
        
        var finalResult = JSObject()
        finalResult["heartRate"] = Int(result.heart_rate)
        finalResult["state"] = Int(result.state_code)
        finalResult["deviceId"] = currentDevice?.identifier.uuidString
        
        var lifecycleData = JSObject()
        lifecycleData["state"] = "stop"
        lifecycleData["deviceId"] = currentDevice?.identifier.uuidString
        notifyListeners("ecgLifecycle", data: lifecycleData)
        
        debugLog("Notifying listeners of final ECG result and lifecycle stop")
    }
    */

    // MARK: - Plugin API
    @objc public func initialize(_ call: CAPPluginCall) {
        NSLog("🚀🚀🚀 [WELLUE INIT] INITIALIZE CALLED FROM JAVASCRIPT 🚀🚀🚀")
        print("🚀🚀🚀 [WELLUE INIT] INITIALIZE CALLED FROM JAVASCRIPT 🚀🚀🚀")
        debugLog("Initialize called from JavaScript")
        
        if centralManager == nil {
            debugLog("Creating new CBCentralManager instance")
            centralManager = CBCentralManager(delegate: self, queue: nil)
        } else {
            debugLog("Using existing CBCentralManager instance")
        }
        
        let isEnabled = (centralManager?.state == .poweredOn)
        debugLog("Bluetooth state after initialization: \(isEnabled) (state=\(centralManager?.state.rawValue ?? 0))")
        
        var result = JSObject()
        result["enabled"] = isEnabled
        notifyListeners("bluetoothStatusChanged", data: result)
        
        successLog("Initialization completed successfully")
        call.resolve()
    }

    @objc public func isBluetoothEnabled(_ call: CAPPluginCall) {
        let enabled = (centralManager?.state == .poweredOn)
        debugLog("Bluetooth status check requested: \(enabled) (state=\(centralManager?.state.rawValue ?? 0))")
        call.resolve(["enabled": enabled])
    }

    @objc public func startScan(_ call: CAPPluginCall) {
        NSLog("🔍🔍🔍 [WELLUE SCAN] START SCAN CALLED FROM JAVASCRIPT 🔍🔍🔍")
        print("🔍🔍🔍 [WELLUE SCAN] START SCAN CALLED FROM JAVASCRIPT 🔍🔍🔍")
        debugLog("Start scan called from JavaScript")
        
        guard let centralManager = centralManager else {
            errorLog("CBCentralManager not initialized")
            call.reject("Bluetooth not initialized", "BLUETOOTH_NOT_INITIALIZED")
            return
        }
        
        if centralManager.state != .poweredOn {
            warningLog("Bluetooth not enabled yet (state=\(centralManager.state.rawValue)); will start scan when powered on")
            pendingScan = true
            // Mark scanning as in progress so UI shows feedback
            isScanning = true
            // Proactively emit status so UI can reflect current state
            var status = JSObject()
            status["enabled"] = false
            notifyListeners("bluetoothStatusChanged", data: status)
            call.resolve()
            return
        }
        
        if isScanning {
            warningLog("Scan already in progress")
            call.resolve()
            return
        }
        
        discoveredDevices.removeAll()
        debugLog("Starting Core Bluetooth scan for Wellue devices")
        // Allow duplicates to improve discovery stability on some devices/firmware
        centralManager.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
        isScanning = true
        successLog("Bluetooth scan started successfully")
        call.resolve()
    }

    @objc public func stopScan(_ call: CAPPluginCall) {
        debugLog("Stop scan called from JavaScript")
        
        guard let centralManager = centralManager else {
            errorLog("CBCentralManager not initialized")
            call.reject("Bluetooth not initialized", "BLUETOOTH_NOT_INITIALIZED")
            return
        }
        
        if !isScanning {
            warningLog("No scan in progress")
            call.resolve()
            return
        }
        
        centralManager.stopScan()
        isScanning = false
        successLog("Bluetooth scan stopped successfully")
        call.resolve()
    }

    @objc public func connect(_ call: CAPPluginCall) {
        NSLog("🔗🔗🔗 [WELLUE CONNECT] CONNECT CALLED FROM JAVASCRIPT 🔗🔗🔗")
        print("🔗🔗🔗 [WELLUE CONNECT] CONNECT CALLED FROM JAVASCRIPT 🔗🔗🔗")
        
        guard let deviceId = call.getString("deviceId") else {
            NSLog("❌ [WELLUE CONNECT] No device ID provided")
            errorLog("No device ID provided for connection")
            call.reject("Device ID required", "MISSING_DEVICE_ID")
            return
        }
        
        NSLog("🔗 [WELLUE CONNECT] Device ID: \(deviceId)")
        debugLog("Connect called for device: \(deviceId)")
        
        var targetPeripheral: CBPeripheral? = discoveredDevices[deviceId]
        if targetPeripheral == nil {
            // Try to retrieve a known peripheral by UUID to avoid scan race conditions
            if let uuid = UUID(uuidString: deviceId) {
                let retrieved = centralManager?.retrievePeripherals(withIdentifiers: [uuid]) ?? []
                targetPeripheral = retrieved.first
                if let p = targetPeripheral {
                    debugLog("Retrieved peripheral by UUID: \(p.name ?? "Unknown")")
                    discoveredDevices[deviceId] = p
                } else {
                    warningLog("Could not retrieve peripheral by UUID: \(deviceId)")
                }
            } else {
                warningLog("Invalid UUID string for deviceId: \(deviceId)")
            }
        }
        guard let peripheral = targetPeripheral else {
            errorLog("Device not found: \(deviceId)")
            call.reject("Device not found", "DEVICE_NOT_FOUND")
            return
        }
        
        guard let centralManager = centralManager else {
            errorLog("CBCentralManager not initialized")
            call.reject("Bluetooth not initialized", "BLUETOOTH_NOT_INITIALIZED")
            return
        }
        
        // Stop scan before initiating connection, mirroring Android behavior
        if isScanning { 
            centralManager.stopScan()
            isScanning = false
            debugLog("Stopped scan prior to connect") 
        }
        
        debugLog("Attempting SDK-managed connect to device: \(peripheral.name ?? "Unknown")")
        
        // Set peripheral on Viatom SDK BEFORE CoreBluetooth connect
        // SDK will auto-discover services and call utilDeployCompletion when ready
        if let utils = viatomUtils {
            utils.peripheral = peripheral
            utils.deviceDelegate = self
            debugLog("Set peripheral on VTMURATUtils - SDK will handle service discovery after OS connect")
        } else {
            errorLog("Viatom SDK not initialized for connect")
        }
        
        // Store the call to resolve later after SDK deployment completes
        pendingConnectCall = call
        
        // Now initiate OS-level BLE connection
        // The SDK's peripheral property triggers internal observers that handle GATT setup
        centralManager.connect(peripheral, options: nil)
        connectedDevice = peripheral
        currentDevice = peripheral
        debugLog("OS-level connection request sent")
        NSLog("🔗 [WELLUE CONNECT] Connection initiated, waiting for utilDeployCompletion before resolving...")
        
        // 🔥 Start deployment timeout monitoring
        triggerSDKDeployment()
        
        // NOTE: We do NOT call.resolve() here!
        // The resolve happens in utilDeployCompletion() delegate after SDK is ready
    }

    @objc public func disconnect(_ call: CAPPluginCall) {
        debugLog("Disconnect called from JavaScript")
        
        // Stop real-time data polling timer
        realTimeDataTimer?.invalidate()
        realTimeDataTimer = nil
        debugLog("📊 [DISCONNECT] Stopped real-time data polling timer")
        
        // Stop health monitoring
        stopHealthMonitoring()
        
        guard let centralManager = centralManager else {
            errorLog("CBCentralManager not initialized")
            call.reject("Bluetooth not initialized", "BLUETOOTH_NOT_INITIALIZED")
            return
        }
        
        guard let peripheral = connectedDevice else {
            warningLog("No device connected to disconnect")
            call.resolve()
            return
        }
        
        debugLog("Disconnecting from device: \(peripheral.name ?? "Unknown")")
        centralManager.cancelPeripheralConnection(peripheral)
        call.resolve()
    }

    @objc public func startBPMeasurement(_ call: CAPPluginCall) {
        debugLog("Start BP measurement called from JavaScript")
        
        guard let device = currentDevice else {
            errorLog("No device connected for BP measurement")
            call.reject("No device connected", "NO_DEVICE_CONNECTED")
            return
        }
        
        guard let viatomUtils = viatomUtils else {
            errorLog("Viatom SDK not initialized")
            call.reject("SDK not initialized", "SDK_NOT_INITIALIZED")
            return
        }
        
        if isMeasuring {
            warningLog("Measurement already in progress")
            call.resolve()
            return
        }
        
        debugLog("Starting BP measurement on device: \(device.name ?? "Unknown")")
        // Switch device state to BP measurement and request streams
        viatomUtils.requestChangeBPState(0) // enter BP measure
        viatomUtils.bp_requestRealStatus()
        viatomUtils.requestBPRealData()
        isMeasuring = true
        successLog("BP measurement started successfully")
        call.resolve()
    }

    @objc public func startECGMeasurement(_ call: CAPPluginCall) {
        debugLog("Start ECG measurement called from JavaScript")
        
        guard let device = currentDevice else {
            errorLog("No device connected for ECG measurement")
            call.reject("No device connected", "NO_DEVICE_CONNECTED")
            return
        }
        
        guard let viatomUtils = viatomUtils else {
            errorLog("Viatom SDK not initialized")
            call.reject("SDK not initialized", "SDK_NOT_INITIALIZED")
            return
        }
        
        if isMeasuring {
            warningLog("Measurement already in progress")
            call.resolve()
            return
        }
        
        debugLog("Starting ECG measurement on device: \(device.name ?? "Unknown")")
        debugLog("Note: ECG delegates not yet implemented - awaiting SDK type definitions")
        viatomUtils.requestECGRealData()
        isMeasuring = true
        
        successLog("ECG measurement request sent (delegates pending)")
        call.resolve()
    }

    @objc public func stopMeasurement(_ call: CAPPluginCall) {
        debugLog("Stop measurement called from JavaScript")
        
        if !isMeasuring {
            warningLog("No measurement in progress to stop")
            call.resolve()
            return
        }
        
        isMeasuring = false
        successLog("Measurement stopped successfully")
        call.resolve()
    }
    
    @objc public func startRtTaskForConnectedDevice(_ call: CAPPluginCall) {
        debugLog("📊 [RT TASK] Start real-time task called from JavaScript")
        
        guard let device = currentDevice else {
            errorLog("No device connected for RT task")
            call.reject("No device connected", "NO_DEVICE_CONNECTED")
            return
        }
        
        guard viatomUtils != nil else {
            errorLog("Viatom SDK not initialized")
            call.reject("SDK not initialized", "SDK_NOT_INITIALIZED")
            return
        }
        
        // 🔥 CRITICAL FIX: Check SDK deployment status
        if !isSdkDeployed {
            NSLog("⚠️ [RT TASK] SDK not deployed yet!")
            NSLog("🔄 [RT TASK] Triggering lazy SDK deployment...")
            
            // Trigger deployment if not already in progress
            if deploymentTimer == nil {
                triggerSDKDeployment()
            }
            
            NSLog("⚠️ [RT TASK] SDK deployment in progress, will retry in 2 seconds...")
            
            // Wait 2 seconds and retry
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
                guard let self = self else { return }
                
                if self.isSdkDeployed {
                    NSLog("✅ [RT TASK] SDK deployed! Starting RT monitoring now...")
                    self.startRtTaskForConnectedDevice(call)  // Recursive retry
                } else {
                    NSLog("❌ [RT TASK] SDK still not deployed after 2 seconds")
                    call.reject("SDK not ready", "SDK_NOT_DEPLOYED")
                }
            }
            return
        }
        
        NSLog("📊 [RT TASK] ✅ SDK is deployed! Ready to receive automatic real-time data for device: \(device.name ?? "Unknown")")
        NSLog("📊 [RT TASK] The bpRealData delegate will automatically fire when device button is pressed")
        debugLog("📊 [RT TASK] No continuous polling needed - SDK sends data automatically during measurement")
        
        // No continuous polling needed! The bpRealData(_:) delegate fires automatically
        // when the device button is pressed and during active measurement
        
        call.resolve()
    }

    @objc public func getBatteryLevel(_ call: CAPPluginCall) {
        debugLog("Get battery level called from JavaScript")
        
        guard let viatomUtils = viatomUtils else {
            errorLog("Viatom SDK not initialized")
            call.reject("SDK not initialized", "SDK_NOT_INITIALIZED")
            return
        }
        
        debugLog("Requesting battery info from device")
        pendingBatteryCall = call
        viatomUtils.requestBatteryInfo()
    }

    @objc public func getBondedDevices(_ call: CAPPluginCall) {
        debugLog("Get bonded devices called from JavaScript")
        // iOS doesn't have a direct equivalent to Android's bonded devices
        // Return empty array for now
        call.resolve(["devices": []])
    }

    @objc public func getConnectedDevices(_ call: CAPPluginCall) {
        debugLog("Get connected devices called from JavaScript")
        
        if let device = connectedDevice {
            var deviceData = JSObject()
            deviceData["id"] = device.identifier.uuidString
            deviceData["name"] = device.name ?? "Unknown Device"
            deviceData["connected"] = true
            
            call.resolve(["devices": [deviceData]])
        } else {
            call.resolve(["devices": []])
        }
    }

    @objc public func isDeviceConnected(_ call: CAPPluginCall) {
        let connected = (connectedDevice != nil)
        debugLog("Device connection status: \(connected)")
        call.resolve(["connected": connected])
    }

    @objc public func getBp2FileList(_ call: CAPPluginCall) {
        debugLog("Get BP2 file list called from JavaScript")
        
        guard let viatomUtils = viatomUtils else {
            errorLog("Viatom SDK not initialized")
            call.reject("SDK not initialized", "SDK_NOT_INITIALIZED")
            return
        }
        
        debugLog("Requesting file list from device")
        viatomUtils.requestFilelist()
        // NOTE: The SDK returns the file list asynchronously via delegate callbacks.
        // Until those are wired, resolve with an empty list to avoid breaking callers.
        call.resolve(["files": []])
    }

    @objc public func bp2ReadFile(_ call: CAPPluginCall) {
        debugLog("BP2 read file called from JavaScript")
        
        guard let fileName = call.getString("fileName") else {
            errorLog("No file name provided for reading")
            call.reject("File name required", "MISSING_FILE_NAME")
            return
        }
        
        guard let viatomUtils = viatomUtils else {
            errorLog("Viatom SDK not initialized")
            call.reject("SDK not initialized", "SDK_NOT_INITIALIZED")
            return
        }
        
        debugLog("Preparing to read file: \(fileName)")
        viatomUtils.prepareReadFile(fileName)
        // NOTE: The SDK provides file data asynchronously via delegate callbacks.
        // Until those are wired, resolve with an empty payload to match bridge expectations.
        call.resolve(["fileType": 0, "fileContent": ""])
    }
    
    // MARK: - CBPeripheralDelegate (Service/Characteristic Discovery)
    
    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if let error = error {
            errorLog("Service discovery failed: \(error.localizedDescription)")
            return
        }
        
        debugLog("Services discovered: \(peripheral.services?.count ?? 0)")
        
        guard let services = peripheral.services else {
            warningLog("No services found on peripheral")
            return
        }
        
        for service in services {
            debugLog("Found service: \(service.uuid.uuidString)")
            
            if service.uuid == BP2_SERVICE_UUID {
                successLog("BP2 service found! Discovering characteristics...")
                peripheral.discoverCharacteristics([BP2_WRITE_CHAR_UUID, BP2_NOTIFY_CHAR_UUID], for: service)
            }
        }
    }
    
    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        if let error = error {
            errorLog("Characteristic discovery failed: \(error.localizedDescription)")
            return
        }
        
        debugLog("Characteristics discovered for service: \(service.uuid.uuidString)")
        
        guard let characteristics = service.characteristics else {
            warningLog("No characteristics found")
            return
        }
        
        for characteristic in characteristics {
            debugLog("Found characteristic: \(characteristic.uuid.uuidString)")
            
            if characteristic.uuid == BP2_WRITE_CHAR_UUID {
                successLog("BP2 Write characteristic found!")
                bp2WriteCharacteristic = characteristic
            } else if characteristic.uuid == BP2_NOTIFY_CHAR_UUID {
                successLog("BP2 Notify characteristic found! Enabling notifications...")
                bp2NotifyCharacteristic = characteristic
                peripheral.setNotifyValue(true, for: characteristic)
            }
        }
        
        // Check if we have both characteristics
        if bp2WriteCharacteristic != nil && bp2NotifyCharacteristic != nil {
            successLog("BP2 device fully configured and ready!")
            
            var readyData = JSObject()
            readyData["deviceId"] = peripheral.identifier.uuidString
            readyData["status"] = "ready"
            readyData["service"] = service.uuid.uuidString
            notifyListeners("deviceReady", data: readyData)
        }
    }
    
    public func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
        if let error = error {
            errorLog("Failed to enable notifications: \(error.localizedDescription)")
            return
        }
        
        if characteristic.isNotifying {
            successLog("Notifications enabled for characteristic: \(characteristic.uuid.uuidString)")
        } else {
            warningLog("Notifications disabled for characteristic: \(characteristic.uuid.uuidString)")
        }
    }
    
    public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        if let error = error {
            errorLog("Failed to read characteristic value: \(error.localizedDescription)")
            return
        }
        
        guard let value = characteristic.value else {
            debugLog("Characteristic updated but no value")
            return
        }
        
        debugLog("Received data on characteristic \(characteristic.uuid.uuidString): \(value.count) bytes")
        
        // Forward to Viatom SDK if it needs raw data
        // The VTMProductLib should handle parsing via its delegates
    }
}
