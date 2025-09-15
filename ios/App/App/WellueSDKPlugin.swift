import Foundation
import Capacitor
import CoreBluetooth
import VTMProductLib

@objc(WellueSDK)
public class WellueSDK: CAPPlugin, CBCentralManagerDelegate, VTMURATDeviceDelegate, VTMURATUtilsDelegate {
    private var centralManager: CBCentralManager?
    private var isBluetoothEnabled = false
    private var discoveredDevices: [String: CBPeripheral] = [:]
    private var connectedDevice: CBPeripheral?
    private var isScanning = false
    
    // Viatom SDK integration
    private var viatomUtils: VTMURATUtils?
    private var currentDevice: CBPeripheral?
    private var isConnected = false
    private var isMeasuring = false
    
    // Debug logging
    private let debugPrefix = "🔵 [WELLUE SDK]"
    private let errorPrefix = "❌ [WELLUE SDK]"
    private let successPrefix = "✅ [WELLUE SDK]"
    private let warningPrefix = "⚠️ [WELLUE SDK]"

    public override func load() {
        debugLog("Plugin loaded - Starting initialization")
        centralManager = CBCentralManager(delegate: self, queue: nil)
        debugLog("CBCentralManager initialized")
        
        // Initialize Viatom SDK
        viatomUtils = VTMURATUtils()
        viatomUtils?.delegate = self
        debugLog("Viatom SDK initialized successfully")
        debugLog("SDK version check: \(String(describing: viatomUtils))")
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
    }
    
    public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi: NSNumber) {
        let deviceName = peripheral.name ?? "Unknown Device"
        let deviceId = peripheral.identifier.uuidString
        
        debugLog("Discovered device: \(deviceName) (ID: \(deviceId))")
        debugLog("Advertisement data: \(advertisementData)")
        debugLog("RSSI: \(rssi)")
        
        // Filter for Wellue devices
        if deviceName.contains("BP2") || deviceName.contains("Wellue") || deviceName.contains("Viatom") {
            discoveredDevices[deviceId] = peripheral
            successLog("Wellue device found: \(deviceName)")
            
            var deviceData = JSObject()
            deviceData["id"] = deviceId
            deviceData["deviceId"] = deviceId
            deviceData["address"] = deviceId
            deviceData["name"] = deviceName
            deviceData["deviceName"] = deviceName
            deviceData["rssi"] = rssi.intValue
            // Skip raw advertisementData as it is not JSValue-compatible
            
            debugLog("Notifying listeners of discovered device (deviceFound)")
            notifyListeners("deviceFound", data: deviceData)
        } else {
            debugLog("Non-Wellue device ignored: \(deviceName)")
        }
    }
    
    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        successLog("Successfully connected to device: \(peripheral.name ?? "Unknown")")
        isConnected = true
        connectedDevice = peripheral
        currentDevice = peripheral
        
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
        
        var result = JSObject()
        result["deviceId"] = peripheral.identifier.uuidString
        result["deviceName"] = peripheral.name ?? "Unknown Device"
        result["connected"] = false
        result["error"] = error?.localizedDescription
        
        debugLog("Notifying listeners of disconnection")
        notifyListeners("deviceDisconnected", data: result)
    }

    // MARK: - VTMURATDeviceDelegate & VTMURATUtilsDelegate
    public func utilDeployCompletion(_ util: VTMURATUtils) {
        successLog("Viatom SDK deployment completion callback received")
        viatomUtils = util
        debugLog("Requesting device info to verify connection")
        viatomUtils?.requestDeviceInfo()
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
    }
    
    public func bpRealData(_ realData: VTMBPRealTimeData) {
        debugLog("BP Real Data received")
        let percent = Int(realData.run_status.battery.percent)
        let waveType = Int(realData.rt_wav.type)

        var realTimeData = JSObject()
        realTimeData["batteryPercent"] = percent
        realTimeData["waveType"] = waveType
        realTimeData["deviceId"] = currentDevice?.identifier.uuidString

        debugLog("Notifying listeners of real-time BP data (bp2Rt)")
        notifyListeners("bp2Rt", data: realTimeData)
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

    // MARK: - Plugin API
    @objc public func initialize(_ call: CAPPluginCall) {
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
        debugLog("Start scan called from JavaScript")
        
        guard let centralManager = centralManager else {
            errorLog("CBCentralManager not initialized")
            call.reject("Bluetooth not initialized", "BLUETOOTH_NOT_INITIALIZED")
            return
        }
        
        guard centralManager.state == .poweredOn else {
            errorLog("Bluetooth not enabled, current state: \(centralManager.state.rawValue)")
            call.reject("Bluetooth not enabled", "BLUETOOTH_NOT_ENABLED")
            return
        }
        
        if isScanning {
            warningLog("Scan already in progress")
            call.resolve()
            return
        }
        
        discoveredDevices.removeAll()
        debugLog("Starting Core Bluetooth scan for Wellue devices")
        centralManager.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
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
        guard let deviceId = call.getString("deviceId") else {
            errorLog("No device ID provided for connection")
            call.reject("Device ID required", "MISSING_DEVICE_ID")
            return
        }
        
        debugLog("Connect called for device: \(deviceId)")
        
        guard let peripheral = discoveredDevices[deviceId] else {
            errorLog("Device not found in discovered devices: \(deviceId)")
            call.reject("Device not found", "DEVICE_NOT_FOUND")
            return
        }
        
        guard let centralManager = centralManager else {
            errorLog("CBCentralManager not initialized")
            call.reject("Bluetooth not initialized", "BLUETOOTH_NOT_INITIALIZED")
            return
        }
        
        debugLog("Attempting to connect to device: \(peripheral.name ?? "Unknown")")
        
        // Configure Viatom SDK
        viatomUtils?.peripheral = peripheral
        viatomUtils?.deviceDelegate = self
        debugLog("Viatom SDK configured with peripheral")
        
        centralManager.connect(peripheral, options: nil)
        connectedDevice = peripheral
        currentDevice = peripheral
        debugLog("Connection request sent to peripheral")
        call.resolve()
    }

    @objc public func disconnect(_ call: CAPPluginCall) {
        debugLog("Disconnect called from JavaScript")
        
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
        viatomUtils.requestECGRealData()
        isMeasuring = true
        successLog("ECG measurement started successfully")
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

    @objc public func getBatteryLevel(_ call: CAPPluginCall) {
        debugLog("Get battery level called from JavaScript")
        
        guard let viatomUtils = viatomUtils else {
            errorLog("Viatom SDK not initialized")
            call.reject("SDK not initialized", "SDK_NOT_INITIALIZED")
            return
        }
        
        debugLog("Requesting battery info from device")
        viatomUtils.requestBatteryInfo()
        call.resolve()
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
        call.resolve()
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
        call.resolve()
    }
}