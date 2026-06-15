import Foundation
import Capacitor
import CoreBluetooth
import VTMProductLib

// Retroactively conform VTMURATUtils to CBPeripheralDelegate so Swift casts (as? CBPeripheralDelegate) succeed.
extension VTMURATUtils: CBPeripheralDelegate {}

// Retroactively conform VTMBLEDevice to CBPeripheralDelegate so Swift casts (as? CBPeripheralDelegate) succeed.
extension VTMBLEDevice: CBPeripheralDelegate {}


// MARK: - VTMProductURATUtils Singleton
// VTMProductURATUtils is defined in the Viatom demo project (VTMProductSDK/) but is NOT
// exported in VTMProductLib.xcframework's public headers. Every demo file uses this singleton
// to ensure all SDK operations route through the same VTMURATUtils instance, which is
// critical for txCharacteristic to be bound on the same object that sends commands.
// This Swift implementation is functionally identical to the ObjC demo version.
@objc public class VTMProductURATUtils: VTMURATUtils {
    @objc public static let shared: VTMProductURATUtils = VTMProductURATUtils()
    
    @objc public static func sharedInstance() -> VTMProductURATUtils {
        return shared
    }
    
    private override init() {
        super.init()
    }
    
    public override func setValue(_ value: Any?, forUndefinedKey key: String) {
        NSLog("⚠️ [VTMProductURATUtils KVC] Attempted to set undefined key: \(key)")
    }
    
    public override func value(forUndefinedKey key: String) -> Any? {
        NSLog("⚠️ [VTMProductURATUtils KVC] Attempted to get undefined key: \(key)")
        return nil
    }
}

@objc(WellueSDK)
public class WellueSDK: CAPPlugin, CBCentralManagerDelegate, CBPeripheralDelegate, VTMURATDeviceDelegate, VTMURATUtilsDelegate, VTO2CommunicateDelegate, VTO2A5RespDelegate {
    public static var shared: WellueSDK?
    private static var activePluginForJS: WellueSDK?
    
    // Direct references to characteristics
    private var o2RingTxChar: CBCharacteristic?
    private var o2RingRxChar: CBCharacteristic?

    // O2Ring real-time self-parse buffer.
    // This device streams 21-byte real-time frames (20-byte body + 1-byte CRC) with a 0x55
    // header that the Viatom SDK's A5 parser rejects (VTA5RespHeadError 0xCC). We assemble
    // and parse these frames ourselves and emit `o2RingRt` directly.
    private var o2RxBuffer = [UInt8]()
    private let O2_FRAME_HEADER: UInt8 = 0x55
    private let O2_FRAME_LEN = 21

    public override func notifyListeners(_ eventName: String, data: [String : Any]?, retainUntilConsumed retain: Bool) {
        let selfPtr = Unmanaged.passUnretained(self).toOpaque()
        if let active = WellueSDK.activePluginForJS, active !== self {
            NSLog("🔀 [FORWARD LISTENERS] Routing event '\(eventName)' from shared (\(selfPtr)) to active (\(Unmanaged.passUnretained(active).toOpaque()))")
            active.notifyListeners(eventName, data: data, retainUntilConsumed: retain)
            return
        }
        NSLog("📡 [LISTENERS] Emitting event '\(eventName)' from plugin instance (\(selfPtr))")
        super.notifyListeners(eventName, data: data, retainUntilConsumed: retain)
    }

    private var centralManager: CBCentralManager?
    private var isBluetoothEnabled = false
    private var discoveredDevices: [String: CBPeripheral] = [:]
    private var connectedDevice: CBPeripheral?
    private var isScanning = false
    private var pendingScan = false
    
    // Viatom SDK integration
    private var viatomUtils: VTMURATUtils?
    private var currentDevice: CBPeripheral?
    private func isO2RingDeviceName(_ name: String) -> Bool {
        let nameLower = name.lowercased()
        return nameLower.contains("o2") || nameLower.contains("ring") || nameLower.contains("oxy")
    }
    
    private func injectO2Chars(from service: CBService, into o2Comm: VTO2Communicate, peripheral: CBPeripheral) {
        guard let chars = service.characteristics else { return }
        for char in chars {
            let uuid = char.uuid.uuidString.uppercased()
            if uuid == "E8FB0002-A14B-98F9-831B-4E2941D01248" || uuid == "8B00ACE7-EB0B-49B0-BBE9-9AEE0A26E1A3" ||
               (o2Comm.txcharacteristic == nil && (char.properties.contains(.write) || char.properties.contains(.writeWithoutResponse))) {
                if o2Comm.txcharacteristic == nil {
                    o2Comm.txcharacteristic = char
                    self.o2RingTxChar = char
                    if let bleDevice = o2Comm.bleDevice {
                        bleDevice.a5_TxCharacteristic = char
                        bleDevice.aa_TxCharacteristic = char
                    }
                    NSLog("✅ [O2 INJECT HELPER] TX: \(char.uuid.uuidString)")
                }
            }
            if uuid == "E8FB0003-A14B-98F9-831B-4E2941D01248" || uuid == "0734594A-A8E7-4B1A-A6B1-CD5243059A57" ||
               (o2Comm.rxcharacteristic == nil && char.properties.contains(.notify)) {
                if o2Comm.rxcharacteristic == nil {
                    o2Comm.rxcharacteristic = char
                    self.o2RingRxChar = char
                    if let bleDevice = o2Comm.bleDevice {
                        bleDevice.a5_RxCharacteristic = char
                        bleDevice.aa_RxCharacteristic = char
                    }
                    if !char.isNotifying {
                        peripheral.setNotifyValue(true, for: char)
                    }
                    NSLog("✅ [O2 INJECT HELPER] RX: \(char.uuid.uuidString)")
                }
            }
        }
    }
    private var isConnectingO2Ring: Bool {
        if let model = targetModel, model == "O2Ring" {
            return true
        }
        let name = currentDevice?.name ?? connectedDevice?.name ?? targetName ?? ""
        return isO2RingDeviceName(name)
    }
    private var isConnected = false
    private var isMeasuring = false
    private var pendingConnectCall: CAPPluginCall?  // Store connect call until SDK deploys
    private var pendingBatteryCall: CAPPluginCall?  // Store battery call until delegate returns
    
    // 🔥 Real-time data streaming timer
    private var realTimeDataTimer: Timer?
    private var isSdkDeployed = false  // Track if SDK handshake is complete
    private var connectedModel = ""     // Track connected device model
    private var targetModel: String?    // Stored model from JS connection options
    private var targetName: String?     // Stored name from JS connection options
    private var deploymentTimer: Timer?  // Timeout for SDK deployment
    private var deploymentRetryCount = 0  // Track retry attempts
    private let MAX_DEPLOYMENT_RETRIES = 3
    
    // 🔥 SDK Health Monitoring (Watchdog)
    private var lastDataReceivedTime: Date?  // Track when we last received data
    private var healthCheckTimer: Timer?  // Periodic health check
    private let HEALTH_CHECK_INTERVAL = 3.0  // Check every 3 seconds
    private let DATA_TIMEOUT_THRESHOLD = 15.0  // If no data for 15 seconds, SDK is dead
    
    // BP2 Service and Characteristic UUIDs (from Viatom LepuDemo + Android implementation)
    private let BP2_SERVICE_UUID = CBUUID(string: "14839AC4-7D7E-415C-9A42-167340CF2339")
    private let BP2_WRITE_CHAR_UUID = CBUUID(string: "8B00ACE7-EB0B-49B0-BBE9-9AEE0A26E1A3")
    private let BP2_NOTIFY_CHAR_UUID = CBUUID(string: "0734594A-A8E7-4B1A-A6B1-CD5243059A57")
    
    // O2Ring (WOxi) Service and Characteristic UUIDs (from Viatom LepuDemo)
    private let O2RING_SERVICE_UUID = CBUUID(string: "E8FB0001-A14B-98F9-831B-4E2941D01248")
    private let O2RING_WRITE_CHAR_UUID = CBUUID(string: "E8FB0002-A14B-98F9-831B-4E2941D01248")
    private let O2RING_NOTIFY_CHAR_UUID = CBUUID(string: "E8FB0003-A14B-98F9-831B-4E2941D01248")
    
    // Alternative approach: Scan with BP2 service UUID filter (like Android does)
    private var scanWithServiceFilter = false  // Set to true to enable UUID filtering
    
    // Store SDK's VTMBLEDevice so we can forward peripheral delegate calls
    private weak var sdkBLEDeviceDelegate: CBPeripheralDelegate?
    
    // Debug logging
    private let debugPrefix = "🔵 [WELLUE SDK]"
    private let errorPrefix = "❌ [WELLUE SDK]"
    private let successPrefix = "✅ [WELLUE SDK]"
    private let warningPrefix = "⚠️ [WELLUE SDK]"

    private func dumpClassInfo(cls: AnyClass) {
        var ivarCount: UInt32 = 0
        if let ivars = class_copyIvarList(cls, &ivarCount) {
            for i in 0..<Int(ivarCount) {
                if let nameBytes = ivar_getName(ivars[i]) {
                    let name = String(cString: nameBytes)
                    NSLog("🔬 [IVAR DUMP] \(cls): \(name)")
                }
            }
            free(ivars)
        }
        
        var propCount: UInt32 = 0
        if let props = class_copyPropertyList(cls, &propCount) {
            for i in 0..<Int(propCount) {
                let name = String(cString: property_getName(props[i]))
                NSLog("🔬 [PROPERTY DUMP] \(cls): \(name)")
            }
            free(props)
        }
    }

    public override func load() {
        let selfPtr = Unmanaged.passUnretained(self).toOpaque()
        NSLog("🚀🚀🚀🚀🚀 [WELLUE LOAD] ===========================================")
        NSLog("🚀🚀🚀🚀🚀 [WELLUE LOAD] PLUGIN LOAD() METHOD EXECUTED self=\(selfPtr) !!!!!!!!!")
        NSLog("🚀🚀🚀🚀🚀 [WELLUE LOAD] ===========================================")
        
        if WellueSDK.shared == nil {
            WellueSDK.shared = self
            WellueSDK.activePluginForJS = self
            NSLog("🚀 [WELLUE LOAD] Set WellueSDK.shared to \(selfPtr)")
        } else {
            NSLog("⚠️ [WELLUE LOAD] Duplicate load() call for ptr=\(selfPtr). Current shared=\(Unmanaged.passUnretained(WellueSDK.shared!).toOpaque())")
            WellueSDK.activePluginForJS = self
            return
        }
        
        print("🚀🚀🚀🚀🚀 [WELLUE LOAD] PLUGIN LOAD() METHOD EXECUTED FOR REAL!!!!!!!!")
        debugLog("Plugin loaded - Starting initialization")
        centralManager = CBCentralManager(delegate: self, queue: nil)
        debugLog("CBCentralManager initialized")
        
        // Dump VTMURATUtils and VTO2Communicate structure
        dumpClassInfo(cls: VTMURATUtils.self)
        dumpClassInfo(cls: VTO2Communicate.self)
        
        // ✅ FIX #1: Use the SDK-provided singleton subclass.
        // VTMProductURATUtils is the singleton the SDK binary uses internally.
        // Every official demo uses [VTMProductURATUtils sharedInstance].
        // Creating VTMURATUtils() directly creates an orphan instance whose
        // txCharacteristic is never bound — causing commandSendFailed(errorCode=1).
        viatomUtils = VTMProductURATUtils.sharedInstance()
        viatomUtils?.extension = self   // extension first — SDK uses this for name-prefix type detection
        viatomUtils?.delegate = self
        let ptrAddr = viatomUtils.map { Unmanaged.passUnretained($0).toOpaque() }
        NSLog("🚀 [WELLUE LOAD] SDK singleton ptr=\(String(describing: ptrAddr))")
        debugLog("Viatom SDK singleton initialized successfully")
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
    
    private func forceDiscoverConnectedPeripheral(_ peripheral: CBPeripheral, isOxiService: Bool) {
        let deviceId = peripheral.identifier.uuidString
        self.discoveredDevices[deviceId] = peripheral
        
        var deviceData = JSObject()
        deviceData["id"] = deviceId
        deviceData["deviceId"] = deviceId
        deviceData["address"] = deviceId
        
        let name = peripheral.name ?? (isOxiService ? "O2Ring" : "Wellue Device")
        deviceData["name"] = name
        deviceData["deviceName"] = name
        deviceData["rssi"] = -50
        deviceData["wellueHint"] = true
        
        if isOxiService || self.isO2RingDeviceName(name) {
            deviceData["model"] = "O2Ring"
        } else {
            deviceData["model"] = "BP2"
        }
        
        NSLog("✅ [BLE DISCOVERY] Force discovering connected peripheral: \(name) (ID: \(deviceId)) model: \(deviceData["model"] ?? "")")
        self.notifyListeners("deviceFound", data: deviceData)
    }

    private func findAndEmitConnectedPeripherals() {
        guard let centralManager = centralManager else { return }
        let connectedBP2 = centralManager.retrieveConnectedPeripherals(withServices: [BP2_SERVICE_UUID])
        for peripheral in connectedBP2 {
            self.forceDiscoverConnectedPeripheral(peripheral, isOxiService: false)
        }
        let connectedO2 = centralManager.retrieveConnectedPeripherals(withServices: [O2RING_SERVICE_UUID])
        for peripheral in connectedO2 {
            self.forceDiscoverConnectedPeripheral(peripheral, isOxiService: true)
        }
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
            warningLog("Scan already in progress (startCoreBluetoothScanIfPossible) - restarting scan to sync state")
            centralManager.stopScan()
            isScanning = false
        }
        discoveredDevices.removeAll()
        debugLog("Starting Core Bluetooth scan (auto)")
        centralManager.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
        isScanning = true
        self.findAndEmitConnectedPeripherals()
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
        
        let advClean = advLocalName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let periClean = rawPeripheralName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        
        let advLower = advClean.lowercased()
        let periLower = periClean.lowercased()
        
        // Decide which name to prefer. We prefer a user-friendly name containing "o2", "ring", "bp" over serial numbers.
        let resolvedName: String
        let isPeriFriendly = periLower.contains("o2") || periLower.contains("ring") || periLower.contains("bp") || periLower.contains("oxy")
        
        if isPeriFriendly {
            resolvedName = periClean
        } else if !advClean.isEmpty {
            resolvedName = advClean
        } else {
            resolvedName = periClean.isEmpty ? "Unknown Device" : periClean
        }
        
        let deviceId = peripheral.identifier.uuidString

        NSLog("📱📱📱 [BLE DISCOVERY] Device: \(resolvedName) (rawName: \(periClean), advName: \(advClean)) UUID: \(deviceId) RSSI: \(rssi)")
        debugLog("Discovered device: \(resolvedName) (ID: \(deviceId))  RSSI=\(rssi)")
        if !advClean.isEmpty { 
            NSLog("📱 [BLE DISCOVERY] Adv name: \(advClean)")
            debugLog("Adv local name: \(advClean)") 
        }

        // Heuristic match for Wellue/Viatom BP devices using name
        let nameLower = resolvedName.lowercased()
        // More precise matching: BP2 at start/end, or wellue/viatom brand, but NOT airpods/headphones
        let startsWithBP = nameLower.hasPrefix("bp") || nameLower.hasPrefix("wellue") || nameLower.hasPrefix("viatom")
        let containsBP2 = nameLower.contains("bp2") || nameLower.contains("bp-2")
        let isBrandMatch = nameLower.contains("wellue") || nameLower.contains("viatom")
        let containsO2 = nameLower.contains("o2") || nameLower.contains("ring") || nameLower.contains("oxy")
        let isNotAudio = !nameLower.contains("airpod") && !nameLower.contains("headphone") && !nameLower.contains("earbud")
        let looksLikeWellue = (startsWithBP || containsBP2 || isBrandMatch || containsO2) && isNotAudio

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
            
            if containsO2 {
                deviceData["model"] = "O2Ring"
            } else if nameLower.contains("bp2a") {
                deviceData["model"] = "BP2A"
            } else if nameLower.contains("bp2t") {
                deviceData["model"] = "BP2T"
            } else {
                deviceData["model"] = "BP2"
            }
            
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
        
        // Hand-off connection/session management to Viatom SDK and start deployment timer
        triggerSDKDeployment()
        
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
        targetModel = nil
        targetName = nil
        
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
        // Only check health if we are actively expecting data (polling is active for O2Ring, or measuring for others)
        let expectingData = isSdkDeployed && (
                            (connectedModel == "O2Ring" && realTimeDataTimer != nil) || 
                            (connectedModel != "O2Ring" && isMeasuring)
                            )
                            
        if !expectingData {
            // Keep resetting the baseline received time so we don't instantly time out when we start expecting data
            lastDataReceivedTime = Date()
            return
        }

        guard let lastDataTime = lastDataReceivedTime else {
            NSLog("🏥 [HEALTH] No baseline data received yet")
            return
        }
        
        let timeSinceLastData = Date().timeIntervalSince(lastDataTime)
        
        if timeSinceLastData > DATA_TIMEOUT_THRESHOLD {
            NSLog("⚠️ [HEALTH] SDK TIMEOUT! No data for \(Int(timeSinceLastData)) seconds")
            NSLog("🔄 [HEALTH] SDK appears dead - triggering auto-recovery...")
            
            // First try: re-enable notifications (most common cause of data loss)
            if let rx = self.o2RingRxChar, let peripheral = self.currentDevice, peripheral.state == .connected {
                NSLog("🔄 [HEALTH] Re-enabling notifications on RX char...")
                peripheral.setNotifyValue(true, for: rx)
            }
            
            // Then re-deploy SDK as last resort
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
        lastDataReceivedTime = Date()
        directWriteRetryCount = 0
    }
    
    // MARK: - SDK Deployment Management
    private func triggerSDKDeployment() {
        guard let device = currentDevice else {
            NSLog("❌ [SDK DEPLOY] No device to deploy SDK for")
            return
        }
        
        guard device.state == .connected else {
            NSLog("⚠️ [SDK DEPLOY] Device state is \(device.state.rawValue) (not connected). Postponing.")
            return
        }
        
        let isO2Ring = self.isConnectingO2Ring
        
        // Instantiate the correct VTMURATUtils subclass based on device model
        if isO2Ring {
            NSLog("🔧 [SDK DEPLOY] Instantiating VTO2Communicate for O2 Ring...")
            let o2Comm = VTO2Communicate()
            o2Comm.o2Delegate = self
            o2Comm.a5Delegate = self
            viatomUtils = o2Comm
        } else {
            NSLog("🔧 [SDK DEPLOY] Using VTMProductURATUtils singleton for BP/ECG")
            viatomUtils = VTMProductURATUtils.sharedInstance()
        }
        
        guard let utils = viatomUtils else {
            NSLog("❌ [SDK DEPLOY] viatomUtils not initialized")
            return
        }
        
        // Reset deployment state to ensure we always run the handshake
        isSdkDeployed = false
        
        NSLog("🔄 [SDK DEPLOY] Triggering SDK deployment for device: \(device.name ?? "Unknown") isO2Ring=\(isO2Ring)")
        
        // Cancel any stale deployment timer
        deploymentTimer?.invalidate()
        deploymentRetryCount = 0
        
        // Set delegates BEFORE peripheral assignment (which triggers GATT discovery)
        utils.extension = self       // 1st: type-inference prefix map
        utils.deviceDelegate = self  // 2nd: deployment completion callback
        utils.delegate = self        // 3rd: command completion callbacks
        
        if let o2Comm = utils as? VTO2Communicate {
            o2Comm.o2Delegate = self
            o2Comm.a5Delegate = self
        }
        
        // For BP2, we act as peripheral delegate directly.
        // For O2Ring, SDK will set VTMBLEDevice as delegate when we assign .peripheral.
        // We'll capture and override in utilDeployCompletion.
        if !isO2Ring {
            device.delegate = self
        }
        
        // Assign peripheral LAST — this triggers SDK's internal discoverServices()
        utils.peripheral = device
        
        // For O2Ring: After SDK sets VTMBLEDevice as delegate, we'll intercept it in
        // utilDeployCompletion and install our forwarding delegate.
        if isO2Ring {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                guard let self = self else { return }
                if let existingDelegate = device.delegate, !(existingDelegate is WellueSDK) {
                    self.sdkBLEDeviceDelegate = existingDelegate
                    device.delegate = self
                    NSLog("🔧 [DELEGATE SETUP] Installed forwarding delegate after SDK setup. Captured: \(type(of: existingDelegate))")
                }
            }
        }
        
        // 15-second timeout for deployment
        deploymentTimer = Timer.scheduledTimer(withTimeInterval: 15.0, repeats: false) { [weak self] _ in
            guard let self = self else { return }
            
            if !self.isSdkDeployed {
                NSLog("⏰ [SDK DEPLOY] Timeout! utilDeployCompletion not received within 15 seconds")
                
                if let device = self.currentDevice {
                    let currentName = device.name ?? ""
                    if currentName.hasPrefix("BP2-") {
                        let cleanName = currentName.replacingOccurrences(of: "BP2-", with: "")
                        NSLog("🔧 [O2RING DEPLOY TIMEOUT] Restoring original name '\(cleanName)' to peripheral...")
                        device.setValue(cleanName, forKey: "name")
                    }
                }
                
                var result = JSObject()
                result["error"] = "SDK deployment timeout after 15 seconds"
                self.notifyListeners("sdkDeploymentFailed", data: result)
            }
        }
        
        NSLog("⏰ [SDK DEPLOY] Deployment started — 15-second timeout set")
    }
    
    // MARK: - VTMURATDeviceDelegate & VTMURATUtilsDelegate
    @objc public func utilDeployCompletion(_ util: VTMURATUtils) {
        let selfPtr = Unmanaged.passUnretained(self).toOpaque()
        NSLog("🎉🎉🎉 [VIATOM SDK] DEPLOYMENT COMPLETED! SDK IS READY! self=\(selfPtr)")
        
        guard !isSdkDeployed else {
            NSLog("⚠️ [SDK DEPLOY] utilDeployCompletion called but SDK is already marked deployed. Skipping. self=\(selfPtr)")
            return
        }
        
        successLog("Viatom SDK deployment completion callback received")
        
        // Cancel deployment timeout timer
        deploymentTimer?.invalidate()
        deploymentTimer = nil
        NSLog("✅ [SDK DEPLOY] Deployment successful, timer cancelled")
        
        // ✅ DIAGNOSTIC: Confirm the deployed util IS the singleton (addresses must match).
        let utilPtr  = Unmanaged.passUnretained(util).toOpaque()
        let localPtr  = viatomUtils.map { Unmanaged.passUnretained($0).toOpaque() }
        NSLog("🔬 [INSTANCE AUDIT] deployed util ptr = \(utilPtr)")
        NSLog("🔬 [INSTANCE AUDIT] local viatomUtils ptr = \(String(describing: localPtr))")
        NSLog("🔬 [INSTANCE AUDIT] Addresses match (singleton fix effective): \(localPtr.map { $0 == utilPtr } ?? false)")
        
        viatomUtils = util
        viatomUtils?.extension = self
        viatomUtils?.delegate = self
        if let o2Comm = util as? VTO2Communicate {
            o2Comm.o2Delegate = self
            o2Comm.a5Delegate = self
        }
        isSdkDeployed = true
        
        // Determine the connected device model
        if let device = currentDevice {
            let nameLower = (device.name ?? "").lowercased()
            let utilsType = util.currentType
            
            NSLog("🔬 [DEPLOY] util.currentType = \(utilsType.rawValue) (6=WOxi expected for O2Ring)")
            
            if utilsType == VTMDeviceTypeWOxi || self.isO2RingDeviceName(device.name ?? "") || self.targetModel == "O2Ring" || util is VTO2Communicate {
                self.connectedModel = "O2Ring"
            } else if nameLower.contains("bp2a") {
                self.connectedModel = "BP2A"
            } else if nameLower.contains("bp2t") {
                self.connectedModel = "BP2T"
            } else {
                self.connectedModel = "BP2"
            }
            NSLog("✅ [SDK DEPLOY] Determined connected device model: \(self.connectedModel)")
            NSLog("🔬 [DEPLOY] device.name=\(device.name ?? "nil"), services=\(device.services?.count ?? -1)")
            if let services = device.services {
                for svc in services {
                    let charCount = svc.characteristics?.count ?? 0
                    NSLog("🔬 [DEPLOY] Service: \(svc.uuid.uuidString) chars=\(charCount)")
                    if let chars = svc.characteristics {
                        for c in chars {
                            NSLog("🔬 [DEPLOY]   Char: \(c.uuid.uuidString) props=\(c.properties.rawValue)")
                        }
                    }
                }
            }
            
            if self.connectedModel == "O2Ring" {
                NSLog("🔧 [O2RING DEPLOY] Setting currentType to WOxi (6) post-handshake...")
                util.setValue(VTMDeviceTypeWOxi.rawValue, forKey: "currentType")
                
                // Restore original name to peripheral
                let currentName = device.name ?? ""
                if currentName.hasPrefix("BP2-") {
                    let cleanName = currentName.replacingOccurrences(of: "BP2-", with: "")
                    NSLog("🔧 [O2RING DEPLOY] Restoring original name '\(cleanName)' to peripheral...")
                    device.setValue(cleanName, forKey: "name")
                }
                
                // Cache characteristics from the SDK's discovered variables
                self.o2RingTxChar = util.txcharacteristic
                self.o2RingRxChar = util.rxcharacteristic
                
                NSLog("🔧 [O2RING DEPLOY] Cached characteristics. tx: \(self.o2RingTxChar?.uuid.uuidString ?? "nil"), rx: \(self.o2RingRxChar?.uuid.uuidString ?? "nil")")
                
                // PRIORITY: Copy characteristics from bleDevice's internal storage into o2Comm
                // Also cross-populate AA ↔ A5 so BOTH protocol paths have valid chars
                if let bleDevice = util.bleDevice {
                    NSLog("🔧 [O2RING DEPLOY] Checking bleDevice internal chars...")
                    if let tx = bleDevice.a5_TxCharacteristic {
                        util.txcharacteristic = tx
                        self.o2RingTxChar = tx
                        bleDevice.aa_TxCharacteristic = tx
                        NSLog("✅ [O2RING DEPLOY] Copied a5_TxCharacteristic from bleDevice: \(tx.uuid.uuidString) (also set aa_Tx)")
                    } else if let tx = bleDevice.aa_TxCharacteristic {
                        util.txcharacteristic = tx
                        self.o2RingTxChar = tx
                        bleDevice.a5_TxCharacteristic = tx
                        NSLog("✅ [O2RING DEPLOY] Copied aa_TxCharacteristic from bleDevice: \(tx.uuid.uuidString) (also set a5_Tx)")
                    }
                    if let rx = bleDevice.a5_RxCharacteristic {
                        util.rxcharacteristic = rx
                        self.o2RingRxChar = rx
                        bleDevice.aa_RxCharacteristic = rx
                        NSLog("🔔 [O2RING DEPLOY] RX char isNotifying=\(rx.isNotifying) — FORCING setNotifyValue(true)")
                        device.setNotifyValue(true, for: rx)
                        NSLog("✅ [O2RING DEPLOY] Copied a5_RxCharacteristic from bleDevice: \(rx.uuid.uuidString) (also set aa_Rx)")
                    } else if let rx = bleDevice.aa_RxCharacteristic {
                        util.rxcharacteristic = rx
                        self.o2RingRxChar = rx
                        bleDevice.a5_RxCharacteristic = rx
                        NSLog("🔔 [O2RING DEPLOY] RX char isNotifying=\(rx.isNotifying) — FORCING setNotifyValue(true)")
                        device.setNotifyValue(true, for: rx)
                        NSLog("✅ [O2RING DEPLOY] Copied aa_RxCharacteristic from bleDevice: \(rx.uuid.uuidString) (also set a5_Rx)")
                    }
                } else {
                    NSLog("🔧 [O2RING DEPLOY] bleDevice is nil — cannot copy chars")
                }
                
                // If SDK didn't bind chars internally, inject them from discovered services
                if util.txcharacteristic == nil || util.rxcharacteristic == nil {
                    NSLog("🔧 [O2RING DEPLOY] SDK chars still nil — performing manual injection from peripheral services...")
                    if let o2Cast = util as? VTO2Communicate, let services = device.services {
                        for service in services {
                            self.injectO2Chars(from: service, into: o2Cast, peripheral: device)
                        }
                    }
                    // If still nil after scanning existing services, temporarily become delegate to discover chars
                    if util.txcharacteristic == nil {
                        NSLog("🔧 [O2RING DEPLOY] Still nil — temporarily taking delegate to discover characteristics...")
                        let originalDelegate = device.delegate
                        device.delegate = self
                        if let services = device.services {
                            for service in services {
                                NSLog("🔧 [O2RING DEPLOY] Discovering chars for service: \(service.uuid.uuidString)")
                                device.discoverCharacteristics(nil, for: service)
                            }
                        }
                        // Restore delegate after discovery completes (give it 2s)
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
                            guard let self = self, let device = self.currentDevice else { return }
                            NSLog("🔧 [O2RING DEPLOY RETRY] Restoring delegate and checking chars...")
                            // Restore the SDK delegate
                            if let origDel = originalDelegate {
                                device.delegate = origDel
                                NSLog("🔧 [O2RING DEPLOY RETRY] Restored delegate to \(type(of: origDel))")
                            }
                            // Try injection one more time with whatever chars are now discovered
                            if let o2Cast = util as? VTO2Communicate, let services = device.services {
                                for service in services {
                                    self.injectO2Chars(from: service, into: o2Cast, peripheral: device)
                                }
                            }
                            if util.txcharacteristic != nil {
                                NSLog("✅ [O2RING DEPLOY RETRY] TX now set: \(util.txcharacteristic!.uuid.uuidString)")
                            } else {
                                NSLog("❌ [O2RING DEPLOY RETRY] TX still nil after retry")
                            }
                        }
                    }
                }
                
                if let tx = util.txcharacteristic {
                    NSLog("✅ [O2RING KVC FIX] Verification: txcharacteristic is now \(tx.uuid.uuidString)")
                } else {
                    NSLog("❌ [O2RING KVC FIX] Verification failed: txcharacteristic is still nil")
                }
                if let rx = util.rxcharacteristic {
                    NSLog("✅ [O2RING KVC FIX] Verification: rxcharacteristic is now \(rx.uuid.uuidString)")
                } else {
                    NSLog("❌ [O2RING KVC FIX] Verification failed: rxcharacteristic is still nil")
                }
                
                // FORWARDING DELEGATE: We become peripheral.delegate but forward ALL calls
                // to VTMBLEDevice so the SDK's packet assembly still works. This gives us
                // visibility into raw BLE data flow.
                if let existingDelegate = device.delegate, !(existingDelegate is WellueSDK) {
                    self.sdkBLEDeviceDelegate = existingDelegate
                    NSLog("🔧 [O2RING DEPLOY] Captured SDK's VTMBLEDevice delegate: \(type(of: existingDelegate))")
                    device.delegate = self
                    NSLog("🔧 [O2RING DEPLOY] Set plugin as peripheral.delegate (forwarding to VTMBLEDevice)")
                } else {
                    NSLog("🔧 [O2RING DEPLOY] peripheral.delegate already WellueSDK, forwarding already set up")
                }
            } else {
                // For BP2/ECG devices, we can safely be the delegate since we forward calls
                if let device = currentDevice {
                    device.delegate = self
                }
            }
        }
        
        // 🔥 Start health monitoring to ensure SDK stays alive
        startHealthMonitoring()
        
        // NOW resolve the pending connect call with device info
        if let call = pendingConnectCall, let device = currentDevice {
            var result = JSObject()
            result["deviceId"] = device.identifier.uuidString
            result["deviceName"] = device.name ?? "Unknown Device"
            result["name"] = device.name ?? "Unknown Device"
            result["address"] = device.identifier.uuidString
            result["model"] = self.connectedModel
            result["connected"] = true
            
            NSLog("🎉 [VIATOM SDK] Resolving pending connect call with device data: \(result)")
            call.resolve(result)
            pendingConnectCall = nil
            
            // Emit deviceConnected event
            notifyListeners("deviceConnected", data: result)
        }
        
        if self.connectedModel == "O2Ring" {
            NSLog("✅ [SDK DEPLOY] O2Ring deployed. Starting RT data polling after 2s delay.")
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
                guard let self = self else { return }
                self.startO2RingPollingTimer()
            }
        } else {
            debugLog("Requesting BP real-time data stream after deployment")
            viatomUtils?.requestBPRealData()
            viatomUtils?.bp_requestRealStatus()
        }
    }

    // MARK: - VTMURATUtilsDelegate (generic command callbacks)
    @objc public func util(_ util: VTMURATUtils, commandCompletion cmdType: u_char, deviceType: VTMDeviceType, response: Data?) {
        // 🏥 Mark data as received (SDK is alive!)
        markDataReceived()
        
        let data = response
        let currentType = util.currentType.rawValue
        
        // Log EVERY command so we can diagnose what the O2Ring actually sends back
        NSLog("📊 [CMD] COMPLETE: cmd=0x\(String(format: "%02X", cmdType)) devType=\(deviceType.rawValue) sdkCurrentType=\(currentType) connModel=\(self.connectedModel) bytes=\(data?.count ?? 0)")

        let isOximeter = (deviceType == VTMDeviceTypeWOxi) || (self.connectedModel == "O2Ring")
        if isOximeter {
            guard let data = data else {
                NSLog("❌ [OXI] No response data for cmd=0x\(String(format: "%02X", cmdType))")
                return
            }
            NSLog("📊 [OXI] CMD DATA: cmd=0x\(String(format: "%02X", cmdType)) size=\(data.count) bytes hex=\(data.prefix(8).map { String(format:"%02X",$0) }.joined(separator: " "))")
            if cmdType == 0x04 { // VTMWOxiCmdGetRealData
                let realData = VTMBLEParser.woxi_parseRealData(data)
                var rt = JSObject()
                rt["spo2"] = Int(realData.run_para.spo2)
                rt["pr"] = Int(realData.run_para.pr)
                rt["pi"] = Double(realData.run_para.pi) / 10.0
                rt["battery"] = Int(realData.run_para.battery_percent)
                rt["batteryState"] = Int(realData.run_para.battery_state)
                rt["state"] = Int(realData.run_para.sensor_state)
                rt["runStatus"] = Int(realData.run_para.run_status)
                
                NSLog("📡 [OXI] Emitting o2RingRt: spo2=\(realData.run_para.spo2) pr=\(realData.run_para.pr) pi=\(realData.run_para.pi) sensor=\(realData.run_para.sensor_state) runStatus=\(realData.run_para.run_status)")
                notifyListeners("o2RingRt", data: rt)
            } else if cmdType == 0x00 { // config response
                let config = VTMBLEParser.woxi_parseConfig(data)
                NSLog("📡 [OXI] Config: displayMode=\(config.display_mode) brightness=\(config.brightness) spo2Thr=\(config.spo2_thr)")
            } else if cmdType == VTMBLECmdGetBattery.rawValue {
                let bat = VTMBLEParser.parseBatteryInfo(data)
                var batteryData = JSObject()
                batteryData["batteryLevel"] = Int(bat.percent)
                batteryData["deviceId"] = currentDevice?.identifier.uuidString
                notifyListeners("batteryInfo", data: batteryData)
                if let call = pendingBatteryCall {
                    call.resolve(["batteryLevel": Int(bat.percent)])
                    pendingBatteryCall = nil
                }
            } else {
                NSLog("📡 [OXI] Other cmd=0x\(String(format: "%02X", cmdType)) size=\(data.count)")
            }
            return
        }

        guard deviceType == VTMDeviceTypeBP else {
            debugLog("📊 [UTIL] ❌ Not a BP device, ignoring")
            return
        }

        guard let data = data else {
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

    @objc public func util(_ util: VTMURATUtils, commandFailed cmdType: u_char, deviceType: VTMDeviceType, failedType: VTMBLEPkgType) {
        NSLog("❌ [UTIL] CMD FAILED: cmdType=0x\(String(format: "%02X", cmdType)), deviceType=\(deviceType.rawValue), failedType=\(failedType.rawValue)")
        errorLog("Command failed. cmdType=\(cmdType) deviceType=\(deviceType) failedType=\(failedType.rawValue)")
    }
    
    private var directWriteRetryCount: Int = 0

    @objc public func util(_ util: VTMURATUtils, commandSendFailed errorCode: u_char) {
        let pluginPtr = Unmanaged.passUnretained(self).toOpaque()
        let errorMeaning: String
        switch errorCode {
        case 0: errorMeaning = "peripheral is nil"
        case 1: errorMeaning = "txCharacteristic is nil — SDK cannot write to device"
        case 2: errorMeaning = "peripheral.state != connected"
        case 3: errorMeaning = "timeout"
        default: errorMeaning = "unknown"
        }
        NSLog("❌ [UTIL] SEND FAILED: errorCode=\(errorCode) (\(errorMeaning)) connectedModel=\(self.connectedModel) currentType=\(util.currentType.rawValue) plugin_ptr=\(pluginPtr)")

        if errorCode == 1, connectedModel == "O2Ring" {
            // Force re-inject characteristics into bleDevice for both protocols
            if let bleDevice = util.bleDevice, let tx = self.o2RingTxChar {
                bleDevice.a5_TxCharacteristic = tx
                bleDevice.aa_TxCharacteristic = tx
                if let rx = self.o2RingRxChar {
                    bleDevice.a5_RxCharacteristic = rx
                    bleDevice.aa_RxCharacteristic = rx
                }
                util.txcharacteristic = tx
                NSLog("🔧 [SEND FAIL] Re-injected chars into bleDevice. a5_Tx=\(tx.uuid.uuidString)")

                // Try direct peripheral write as last resort (max 3 retries per session)
                if directWriteRetryCount < 3, let peripheral = currentDevice, peripheral.state == .connected {
                    directWriteRetryCount += 1
                    NSLog("🔧 [SEND FAIL] Attempting direct peripheral write (retry \(directWriteRetryCount)/3)")
                    peripheral.writeValue(buildWOxiRealDataRequest(), for: tx, type: .withoutResponse)
                }
            }
        }

        let utilPtr = Unmanaged.passUnretained(util).toOpaque()
        let localPtr = viatomUtils.map { Unmanaged.passUnretained($0).toOpaque() }
        NSLog("🔬 [SEND FAIL DIAG] util ptr=\(utilPtr)  viatomUtils ptr=\(String(describing: localPtr))  Same=\(localPtr.map { $0 == utilPtr } ?? false)")
        NSLog("🔬 [SEND FAIL DIAG] peripheral.state=\(util.peripheral.state.rawValue) (2=connected)")
    }

    /// Builds an A5-protocol "get real data" command packet for WOxi devices.
    /// Format: [0xA5] [len_lo] [len_hi] [~len_lo] [~len_hi] [cmd=0x04] [type=0x00] [CRC8]
    private func buildWOxiRealDataRequest() -> Data {
        let cmd: UInt8 = 0x04  // VTMWOxiCmdGetRealData
        let pkgType: UInt8 = 0x00  // request
        let payload: [UInt8] = []
        let dataLen = UInt16(payload.count + 2) // cmd + pkgType + payload
        let lenLo = UInt8(dataLen & 0xFF)
        let lenHi = UInt8((dataLen >> 8) & 0xFF)
        var packet: [UInt8] = [0xA5, lenLo, lenHi, ~lenLo, ~lenHi, cmd, pkgType]
        packet.append(contentsOf: payload)
        // CRC8 over everything after header (len bytes + data)
        let crcData = Array(packet[1...])
        var crc: UInt8 = 0
        for byte in crcData { crc = crc &+ byte }
        packet.append(crc)
        NSLog("🔧 [DIRECT WRITE] Sending WOxi real data request: \(packet.map { String(format: "%02X", $0) }.joined(separator: " "))")
        return Data(packet)
    }

    @objc public func utilDeployFailed(_ util: VTMURATUtils) {
        errorLog("Viatom SDK deployment failed callback received")
        deploymentTimer?.invalidate()
        deploymentTimer = nil
        isSdkDeployed = false
        
        if let device = currentDevice {
            let currentName = device.name ?? ""
            if currentName.hasPrefix("BP2-") {
                let cleanName = currentName.replacingOccurrences(of: "BP2-", with: "")
                NSLog("🔧 [O2RING DEPLOY FAIL] Restoring original name '\(cleanName)' to peripheral...")
                device.setValue(cleanName, forKey: "name")
            }
        }
        
        if let call = pendingConnectCall {
            call.reject("SDK deployment failed", "SDK_DEPLOY_FAILED")
            pendingConnectCall = nil
        }
        
        var result = JSObject()
        result["error"] = "SDK deployment failed"
        notifyListeners("sdkDeploymentFailed", data: result)
    }

    @objc public func util(_ util: VTMURATUtils, updateDeviceRSSI RSSI: NSNumber) {
        debugLog("Device RSSI updated: \(RSSI)")
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
        WellueSDK.activePluginForJS = self
        if self !== WellueSDK.shared {
            NSLog("🔀 [FORWARD] initialize forwarded to shared instance")
            WellueSDK.shared?.initialize(call)
            return
        }
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
        WellueSDK.activePluginForJS = self
        if self !== WellueSDK.shared {
            NSLog("🔀 [FORWARD] isBluetoothEnabled forwarded to shared instance")
            WellueSDK.shared?.isBluetoothEnabled(call)
            return
        }
        let enabled = (centralManager?.state == .poweredOn)
        debugLog("Bluetooth status check requested: \(enabled) (state=\(centralManager?.state.rawValue ?? 0))")
        call.resolve(["enabled": enabled])
    }

    @objc public func startScan(_ call: CAPPluginCall) {
        WellueSDK.activePluginForJS = self
        if self !== WellueSDK.shared {
            NSLog("🔀 [FORWARD] startScan forwarded to shared instance")
            WellueSDK.shared?.startScan(call)
            return
        }
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
            warningLog("Scan already in progress – restarting scan to sync state")
            centralManager.stopScan()
            isScanning = false
        }
        
        discoveredDevices.removeAll()
        debugLog("Starting Core Bluetooth scan for Wellue devices")
        // Allow duplicates to improve discovery stability on some devices/firmware
        centralManager.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
        isScanning = true
        self.findAndEmitConnectedPeripherals()
        successLog("Bluetooth scan started successfully")
        call.resolve()
    }

    @objc public func stopScan(_ call: CAPPluginCall) {
        WellueSDK.activePluginForJS = self
        if self !== WellueSDK.shared {
            NSLog("🔀 [FORWARD] stopScan forwarded to shared instance")
            WellueSDK.shared?.stopScan(call)
            return
        }
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
        WellueSDK.activePluginForJS = self
        let selfPtr = Unmanaged.passUnretained(self).toOpaque()
        if self !== WellueSDK.shared {
            NSLog("🔀 [FORWARD] connect forwarded to shared instance from \(selfPtr)")
            WellueSDK.shared?.connect(call)
            return
        }
        NSLog("🔗🔗🔗 [WELLUE CONNECT] CONNECT CALLED FROM JAVASCRIPT 🔗🔗🔗 plugin_ptr=\(selfPtr)")
        print("🔗🔗🔗 [WELLUE CONNECT] CONNECT CALLED FROM JAVASCRIPT 🔗🔗🔗 plugin_ptr=\(selfPtr)")
        
        guard let deviceId = call.getString("deviceId") else {
            NSLog("❌ [WELLUE CONNECT] No device ID provided")
            errorLog("No device ID provided for connection")
            call.reject("Device ID required", "MISSING_DEVICE_ID")
            return
        }
        
        NSLog("🔗 [WELLUE CONNECT] Device ID: \(deviceId)")
        debugLog("Connect called for device: \(deviceId)")
        
        self.targetModel = call.getString("model")
        self.targetName = call.getString("name")
        
        if let current = connectedDevice,
           current.identifier.uuidString == deviceId,
           current.state == .connected,
           isSdkDeployed {
            NSLog("🔗 [WELLUE CONNECT] Already connected to device: \(deviceId). Returning success.")
            var result = JSObject()
            result["deviceId"] = deviceId
            result["deviceName"] = current.name ?? "Unknown Device"
            result["name"] = current.name ?? "Unknown Device"
            result["address"] = deviceId
            result["model"] = self.connectedModel
            result["connected"] = true
            call.resolve(result)
            return
        }
        
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
        
        if peripheral.state == .connected {
            NSLog("🔗 [WELLUE CONNECT] CoreBluetooth reports peripheral is already connected. Bypassing OS connection.")
            connectedDevice = peripheral
            currentDevice = peripheral
            isConnected = true
            pendingConnectCall = call
            
            triggerSDKDeployment()
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
        
        // Store the call to resolve later after SDK deployment completes
        pendingConnectCall = call
        
        // Now initiate OS-level BLE connection
        centralManager.connect(peripheral, options: nil)
        connectedDevice = peripheral
        currentDevice = peripheral
        debugLog("OS-level connection request sent")
        NSLog("🔗 [WELLUE CONNECT] Connection initiated, waiting for utilDeployCompletion before resolving...")
        
        // NOTE: We do NOT call.resolve() here!
        // The resolve happens in utilDeployCompletion() delegate after SDK is ready
    }

    @objc public func disconnect(_ call: CAPPluginCall) {
        WellueSDK.activePluginForJS = self
        if self !== WellueSDK.shared {
            NSLog("🔀 [FORWARD] disconnect forwarded to shared instance")
            WellueSDK.shared?.disconnect(call)
            return
        }
        debugLog("Disconnect called from JavaScript")
        
        // Stop real-time data polling timer
        realTimeDataTimer?.invalidate()
        realTimeDataTimer = nil
        debugLog("📊 [DISCONNECT] Stopped real-time data polling timer")
        
        // Stop health monitoring
        stopHealthMonitoring()
        
        targetModel = nil
        targetName = nil
        
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
        WellueSDK.activePluginForJS = self
        if self !== WellueSDK.shared {
            NSLog("🔀 [FORWARD] startBPMeasurement forwarded to shared instance")
            WellueSDK.shared?.startBPMeasurement(call)
            return
        }
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
        WellueSDK.activePluginForJS = self
        if self !== WellueSDK.shared {
            NSLog("🔀 [FORWARD] startECGMeasurement forwarded to shared instance")
            WellueSDK.shared?.startECGMeasurement(call)
            return
        }
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
        WellueSDK.activePluginForJS = self
        if self !== WellueSDK.shared {
            NSLog("🔀 [FORWARD] stopMeasurement forwarded to shared instance")
            WellueSDK.shared?.stopMeasurement(call)
            return
        }
        debugLog("Stop measurement called from JavaScript")
        
        // Stop oximeter polling timer if running
        realTimeDataTimer?.invalidate()
        realTimeDataTimer = nil
        
        if !isMeasuring {
            warningLog("No measurement in progress to stop")
            call.resolve()
            return
        }
        
        isMeasuring = false
        successLog("Measurement stopped successfully")
        call.resolve()
    }
    
    private func waitForDeploymentAndStartRtTask(_ call: CAPPluginCall, retryCount: Int) {
        if self.isSdkDeployed {
            NSLog("✅ [RT TASK] SDK deployed! Starting RT monitoring now...")
            self.startRtTaskForConnectedDevice(call)
        } else if retryCount >= 20 { // 10 seconds max (20 * 500ms)
            NSLog("❌ [RT TASK] SDK still not deployed after 10 seconds")
            call.reject("SDK not ready", "SDK_NOT_DEPLOYED")
        } else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                guard let self = self else { return }
                self.waitForDeploymentAndStartRtTask(call, retryCount: retryCount + 1)
            }
        }
    }
    
    /// Re-injects write/notify characteristics dynamically via KVC right before sending commands
    private func injectO2RingCharacteristics() {
        guard let util = viatomUtils else { return }
        
        let deviceName = self.currentDevice?.name ?? self.connectedDevice?.name ?? ""
        let isOxi = (util.currentType == VTMDeviceTypeWOxi) || 
                    (self.connectedModel == "O2Ring") ||
                    self.isO2RingDeviceName(deviceName)
        
        guard isOxi else { return }
        
        let txBefore = util.txcharacteristic
        let rxBefore = util.rxcharacteristic
        
        // Unconditionally use cached references first for maximum stability
        var injected = false
        if let cachedTx = self.o2RingTxChar {
            util.txcharacteristic = cachedTx
            injected = true
        }
        if let cachedRx = self.o2RingRxChar {
            util.rxcharacteristic = cachedRx
            if !cachedRx.isNotifying {
                util.peripheral.setNotifyValue(true, for: cachedRx)
            }
            injected = true
        }
        
        // If we didn't have them cached, try falling back to scanning the peripheral's services
        if self.o2RingTxChar == nil || self.o2RingRxChar == nil {
            if let services = util.peripheral.services {
                for service in services {
                    if service.uuid.uuidString.caseInsensitiveCompare(O2RING_SERVICE_UUID.uuidString) == .orderedSame {
                        if let characteristics = service.characteristics {
                            for char in characteristics {
                                if char.uuid.uuidString.caseInsensitiveCompare(O2RING_WRITE_CHAR_UUID.uuidString) == .orderedSame {
                                    util.txcharacteristic = char
                                    self.o2RingTxChar = char
                                    injected = true
                                } else if char.uuid.uuidString.caseInsensitiveCompare(O2RING_NOTIFY_CHAR_UUID.uuidString) == .orderedSame {
                                    util.rxcharacteristic = char
                                    self.o2RingRxChar = char
                                    NSLog("🔧 [O2RING KVC TIMER] rx characteristic \(char.uuid.uuidString) isNotifying: \(char.isNotifying)")
                                    if !char.isNotifying {
                                        NSLog("🔧 [O2RING KVC TIMER] Enabling notification on rx characteristic \(char.uuid.uuidString)...")
                                        util.peripheral.setNotifyValue(true, for: char)
                                    }
                                    injected = true
                                }
                            }
                        }
                    } else if service.uuid.uuidString.caseInsensitiveCompare(BP2_SERVICE_UUID.uuidString) == .orderedSame {
                        if let characteristics = service.characteristics {
                            for char in characteristics {
                                if char.uuid.uuidString.caseInsensitiveCompare(BP2_WRITE_CHAR_UUID.uuidString) == .orderedSame {
                                    util.txcharacteristic = char
                                    self.o2RingTxChar = char
                                    injected = true
                                } else if char.uuid.uuidString.caseInsensitiveCompare(BP2_NOTIFY_CHAR_UUID.uuidString) == .orderedSame {
                                    util.rxcharacteristic = char
                                    self.o2RingRxChar = char
                                    NSLog("🔧 [O2RING KVC TIMER] PO2 rx characteristic \(char.uuid.uuidString) isNotifying: \(char.isNotifying)")
                                    if !char.isNotifying {
                                        NSLog("🔧 [O2RING KVC TIMER] Enabling notification on PO2 rx characteristic \(char.uuid.uuidString)...")
                                        util.peripheral.setNotifyValue(true, for: char)
                                    }
                                    injected = true
                                }
                            }
                        }
                    }
                }
            }
        }
        
        if let bleDevice = util.bleDevice {
            if let tx = self.o2RingTxChar {
                bleDevice.a5_TxCharacteristic = tx
                bleDevice.aa_TxCharacteristic = tx
            }
            if let rx = self.o2RingRxChar {
                bleDevice.a5_RxCharacteristic = rx
                bleDevice.aa_RxCharacteristic = rx
            }
        }
        
        let txAfter = util.txcharacteristic
        let rxAfter = util.rxcharacteristic
        
        if injected && (txBefore == nil || rxBefore == nil) {
            NSLog("🔧 [O2RING KVC TIMER] Re-injected characteristics. tx: \(txBefore?.uuid.uuidString ?? "nil") -> \(txAfter?.uuid.uuidString ?? "nil"), rx: \(rxBefore?.uuid.uuidString ?? "nil") -> \(rxAfter?.uuid.uuidString ?? "nil")")
        }
    }
    
    private func sendO2RingRealDataRequestDirectly() {
        guard let peripheral = self.currentDevice ?? self.connectedDevice,
              peripheral.state == .connected,
              let txChar = self.o2RingTxChar else {
            NSLog("❌ [O2RING DIRECT WRITE] Cannot send: peripheral not connected or txChar is nil")
            return
        }
        
        // We will send three candidate packets that represent the Viatom get real-time data command:
        // 1. User's specific packet: A5 04 00 04 00
        let packet1 = Data([0xA5, 0x04, 0x00, 0x04, 0x00])
        
        // 2. Standard command format: A5 [CMD] [Length High] [Length Low] [XOR CRC]
        // CMD = 0x04, Length = 0x00 0x00, CRC = 0x04 ^ 0x00 ^ 0x00 = 0x04
        let packet2 = Data([0xA5, 0x04, 0x00, 0x00, 0x04])
        
        // 3. Alternative protocol command format: A5 [CMD] [~CMD] [Pkg Type] [Pkg No] [Length High] [Length Low] [CRC8]
        // CMD = 0x04, ~CMD = 0xFB, Pkg Type = 0x00, Pkg No = 0x00, Length = 0x00 0x00
        var packet3 = Data([0xA5, 0x04, 0xFB, 0x00, 0x00, 0x00, 0x00])
        let crc = calculateViatomCRC8(packet3.subdata(in: 1..<packet3.count))
        packet3.append(crc)
        
        NSLog("📡 [O2RING DIRECT WRITE] Writing direct real data request packets...")
        NSLog("   👉 Packet 1: \(packet1.map { String(format: "%02X", $0) }.joined(separator: " "))")
        peripheral.writeValue(packet1, for: txChar, type: .withoutResponse)
        
        NSLog("   👉 Packet 2: \(packet2.map { String(format: "%02X", $0) }.joined(separator: " "))")
        peripheral.writeValue(packet2, for: txChar, type: .withoutResponse)
        
        NSLog("   👉 Packet 3: \(packet3.map { String(format: "%02X", $0) }.joined(separator: " "))")
        peripheral.writeValue(packet3, for: txChar, type: .withoutResponse)
    }
    
    private func calculateViatomCRC8(_ data: Data) -> UInt8 {
        var bytes = [UInt8](data)
        return VTMCalibrate.calCRC8(&bytes, bufSize: UInt32(data.count))
    }
    
    /// Starts the O2Ring real-time polling timer. Safe to call multiple times (idempotent).
    private func startO2RingPollingTimer() {
        let selfPtr = Unmanaged.passUnretained(self).toOpaque()
        DispatchQueue.main.async {
            self.realTimeDataTimer?.invalidate()
            
            // Ensure o2Delegate AND a5Delegate are set for both protocol response paths
            if let o2Comm = self.viatomUtils as? VTO2Communicate {
                o2Comm.o2Delegate = self
                o2Comm.a5Delegate = self
                NSLog("✅ [O2RING] Confirmed o2Delegate + a5Delegate set on VTO2Communicate")
            } else {
                self.viatomUtils?.delegate = self
            }
            
            // ✅ CRITICAL: Do NOT override peripheral.delegate here.
            // VTO2Communicate's internal VTMBLEDevice must remain the CBPeripheralDelegate
            // to handle packet reassembly. We receive data via VTO2CommunicateDelegate.
            
            let currentType = self.viatomUtils?.currentType.rawValue ?? 0
            let peripheralDelegateClass = self.currentDevice?.delegate.map { type(of: $0) } ?? nil
            NSLog("✅ [O2RING] RT polling timer starting. currentType=\(currentType), peripheral=\(self.viatomUtils?.peripheral.name ?? "nil"), peripheralState=\(self.viatomUtils?.peripheral.state.rawValue ?? -1), peripheral.delegate=\(String(describing: peripheralDelegateClass)) plugin_ptr=\(selfPtr)")
            
            self.realTimeDataTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
                guard let self = self else { return }
                guard self.isSdkDeployed else {
                    NSLog("⏰ [RT TIMER] O2Ring poll tick – SDK not deployed, skipping")
                    return
                }
                guard self.connectedModel == "O2Ring" || self.viatomUtils?.currentType == VTMDeviceTypeWOxi || self.viatomUtils is VTO2Communicate else {
                    NSLog("⏰ [RT TIMER] O2Ring poll tick – not O2Ring, skipping")
                    return
                }
                
                // Ensure notifications are enabled on RX every poll tick
                if let rx = self.o2RingRxChar, let peripheral = self.currentDevice {
                    if !rx.isNotifying {
                        NSLog("🔔 [RT TIMER] RX not notifying! Enabling notifications...")
                        peripheral.setNotifyValue(true, for: rx)
                    }
                }

                if self.viatomUtils?.currentType != VTMDeviceTypeWOxi {
                    self.viatomUtils?.setValue(VTMDeviceTypeWOxi.rawValue, forKey: "currentType")
                }

                // beginGetRealData() is what actually makes THIS device emit its 0x55
                // real-time frame (woxi_requestWOxiRealData alone yields nothing). However the
                // device's reply fails the SDK's own parser (commandFailed 0xCC), so the AA
                // command never "completes" and the aa_cmdArr queue gets stuck — blocking every
                // subsequent request until a re-deploy. We clear the stuck command each tick so
                // the request can re-fire continuously (we parse the reply ourselves anyway).
                if let o2Comm = self.viatomUtils as? VTO2Communicate {
                    if let cmdArr = o2Comm.value(forKey: "aa_cmdArr") as? NSMutableArray, cmdArr.count > 0 {
                        cmdArr.removeAllObjects()
                    }
                    NSLog("⏰ [RT TIMER] O2Ring poll tick – beginGetRealData() + woxi_requestWOxiRealData()")
                    o2Comm.beginGetRealData()
                    self.viatomUtils?.woxi_requestWOxiRealData()
                } else {
                    NSLog("⏰ [RT TIMER] O2Ring poll tick – woxi_requestWOxiRealData() (A5 protocol)")
                    self.viatomUtils?.woxi_requestWOxiRealData()
                }
            }
            NSLog("✅ [O2RING] RT polling timer started (interval=2s)")
        }
    }
    
    @objc public func startRtTaskForConnectedDevice(_ call: CAPPluginCall) {
        WellueSDK.activePluginForJS = self
        let selfPtr = Unmanaged.passUnretained(self).toOpaque()
        if self !== WellueSDK.shared {
            NSLog("🔀 [FORWARD] startRtTaskForConnectedDevice forwarded to shared instance")
            WellueSDK.shared?.startRtTaskForConnectedDevice(call)
            return
        }
        NSLog("📊 [RT TASK] Start real-time task called from JavaScript plugin_ptr=\(selfPtr)")
        debugLog("📊 [RT TASK] Start real-time task called from JavaScript plugin_ptr=\(selfPtr)")
        
        guard let device = currentDevice else {
            NSLog("❌ [RT TASK] No device connected for RT task")
            errorLog("No device connected for RT task")
            call.reject("No device connected", "NO_DEVICE_CONNECTED")
            return
        }
        
        guard viatomUtils != nil else {
            NSLog("❌ [RT TASK] Viatom SDK not initialized")
            errorLog("Viatom SDK not initialized")
            call.reject("SDK not initialized", "SDK_NOT_INITIALIZED")
            return
        }
        
        NSLog("📊 [RT TASK] Device details - name: \(device.name ?? "nil"), uuid: \(device.identifier.uuidString), isSdkDeployed: \(isSdkDeployed), connectedModel: \(connectedModel)")
        
        // 🔥 CRITICAL FIX: Check SDK deployment status
        if !isSdkDeployed {
            NSLog("⚠️ [RT TASK] SDK not deployed yet! Starting deployment wait loop...")
            
            // Trigger deployment if not already in progress
            if deploymentTimer == nil {
                triggerSDKDeployment()
            }
            
            waitForDeploymentAndStartRtTask(call, retryCount: 0)
            return
        }
        
        let utilsType = viatomUtils?.currentType
        NSLog("📊 [RT TASK] utilsType: \(String(describing: utilsType?.rawValue))")
        let isOxy = (utilsType == VTMDeviceTypeWOxi) || 
                    (self.connectedModel == "O2Ring") ||
                    self.isO2RingDeviceName(device.name ?? "") ||
                    (self.viatomUtils is VTO2Communicate)
        
        NSLog("📊 [RT TASK] isOxy evaluated to: \(isOxy)")
        
        if isOxy {
            // Ensure delegate is set for VTO2Communicate callbacks
            if let o2Comm = self.viatomUtils as? VTO2Communicate {
                o2Comm.o2Delegate = self
                o2Comm.a5Delegate = self
                NSLog("📊 [RT TASK] VTO2Communicate o2Delegate + a5Delegate confirmed")
            } else {
                viatomUtils?.delegate = self
                // Only inject characteristics for the fallback (non-VTO2Communicate) path
                self.injectO2RingCharacteristics()
            }
            
            // Start (or restart) the RT polling timer
            self.startO2RingPollingTimer()
            NSLog("📊 [RT TASK] O2Ring detected, started/restarted polling timer")
        } else {
            NSLog("📊 [RT TASK] ✅ SDK is deployed! Ready to receive automatic real-time data for device: \(device.name ?? "Unknown")")
            NSLog("📊 [RT TASK] The bpRealData delegate will automatically fire when device button is pressed")
            debugLog("📊 [RT TASK] No continuous polling needed - SDK sends data automatically during measurement")
            
            viatomUtils?.requestBPRealData()
            viatomUtils?.bp_requestRealStatus()
        }
        
        call.resolve()
    }

    @objc public func getBatteryLevel(_ call: CAPPluginCall) {
        WellueSDK.activePluginForJS = self
        if self !== WellueSDK.shared {
            NSLog("🔀 [FORWARD] getBatteryLevel forwarded to shared instance")
            WellueSDK.shared?.getBatteryLevel(call)
            return
        }
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
        WellueSDK.activePluginForJS = self
        if self !== WellueSDK.shared {
            NSLog("🔀 [FORWARD] getBondedDevices forwarded to shared instance")
            WellueSDK.shared?.getBondedDevices(call)
            return
        }
        debugLog("Get bonded devices called from JavaScript")
        // iOS doesn't have a direct equivalent to Android's bonded devices
        // Return empty array for now
        call.resolve(["devices": []])
    }

    @objc public func getConnectedDevices(_ call: CAPPluginCall) {
        WellueSDK.activePluginForJS = self
        if self !== WellueSDK.shared {
            NSLog("🔀 [FORWARD] getConnectedDevices forwarded to shared instance")
            WellueSDK.shared?.getConnectedDevices(call)
            return
        }
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
        WellueSDK.activePluginForJS = self
        if self !== WellueSDK.shared {
            NSLog("🔀 [FORWARD] isDeviceConnected forwarded to shared instance")
            WellueSDK.shared?.isDeviceConnected(call)
            return
        }
        let connected = (connectedDevice != nil)
        debugLog("Device connection status: \(connected)")
        call.resolve(["connected": connected])
    }

    @objc public func getBp2FileList(_ call: CAPPluginCall) {
        WellueSDK.activePluginForJS = self
        if self !== WellueSDK.shared {
            NSLog("🔀 [FORWARD] getBp2FileList forwarded to shared instance")
            WellueSDK.shared?.getBp2FileList(call)
            return
        }
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
        WellueSDK.activePluginForJS = self
        if self !== WellueSDK.shared {
            NSLog("🔀 [FORWARD] bp2ReadFile forwarded to shared instance")
            WellueSDK.shared?.bp2ReadFile(call)
            return
        }
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
    
    // MARK: - CBPeripheralDelegate (FORWARDING for O2Ring, direct for BP2/ECG)
    // We intercept ALL BLE callbacks for diagnostics, then forward to VTMBLEDevice.
    
    @objc(peripheral:didUpdateValueForCharacteristic:error:)
    public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        let value = characteristic.value
        let dataLen = value?.count ?? 0
        // Log the FULL packet (not just a prefix) so the exact frame layout is always visible.
        let fullHex = value?.map { String(format: "%02X", $0) }.joined(separator: " ") ?? "nil"
        NSLog("📥 [BLE DATA] didUpdateValueFor: \(characteristic.uuid.uuidString) len=\(dataLen) data=\(fullHex)")
        if let error = error {
            NSLog("❌ [BLE DATA] error: \(error.localizedDescription)")
        }

        // SELF-PARSE: The Viatom SDK's A5 parser rejects this O2Ring's 0x55 frames
        // (commandFailed cmdType=0xCC). Parse the real-time stream ourselves and emit o2RingRt.
        if let value = value, dataLen > 0, isO2RingRxChar(characteristic) {
            handleO2RingRealtimeData(value)
        }

        // Forward to SDK's VTMBLEDevice for packet assembly (guard against self-recursion)
        if let fwd = self.sdkBLEDeviceDelegate, !(fwd is WellueSDK) {
            fwd.peripheral?(peripheral, didUpdateValueFor: characteristic, error: error)
        }
    }

    /// Returns true if the characteristic is the O2Ring/BP2-service notify characteristic.
    private func isO2RingRxChar(_ characteristic: CBCharacteristic) -> Bool {
        let uuid = characteristic.uuid.uuidString
        if uuid.caseInsensitiveCompare(BP2_NOTIFY_CHAR_UUID.uuidString) == .orderedSame { return true }
        if uuid.caseInsensitiveCompare(O2RING_NOTIFY_CHAR_UUID.uuidString) == .orderedSame { return true }
        if let rx = self.o2RingRxChar, rx.uuid == characteristic.uuid { return true }
        return false
    }

    /// Accumulates BLE notification fragments and extracts complete 21-byte O2Ring real-time
    /// frames (0x55 header). Each complete frame is parsed and emitted as `o2RingRt`.
    private func handleO2RingRealtimeData(_ chunk: Data) {
        // Any inbound notification means the stream is alive — keep the health watchdog calm
        // so it stops the destructive re-deploy churn.
        markDataReceived()

        o2RxBuffer.append(contentsOf: chunk)
        if o2RxBuffer.count > 512 {
            o2RxBuffer.removeFirst(o2RxBuffer.count - 512)
        }

        // Resync to the 0x55 frame header and extract fixed-length frames.
        while true {
            guard let start = o2RxBuffer.firstIndex(of: O2_FRAME_HEADER) else {
                o2RxBuffer.removeAll(keepingCapacity: true)
                break
            }
            if start > 0 { o2RxBuffer.removeFirst(start) }
            guard o2RxBuffer.count >= O2_FRAME_LEN else { break }
            let frame = Array(o2RxBuffer.prefix(O2_FRAME_LEN))
            parseAndEmitO2Frame(frame)
            o2RxBuffer.removeFirst(O2_FRAME_LEN)
        }
    }

    /// Parses a raw 21-byte O2Ring real-time frame. Layout decoded from the live device stream:
    ///   [0]   = 0x55  frame header
    ///   [1-2] = 0x00 0xFF  (cmd / ~cmd)
    ///   [3-4] = 0x00 0x00
    ///   [5]   = 0x0D  payload length (13)
    ///   [6]   = 0x00
    ///   [7]   = SpO2 (%)
    ///   [8-9] = PR (bpm, little-endian)
    ///   [14]  = battery (%)
    ///   [16]  = PI (×10, e.g. 0x36 → 5.4)
    ///   [20]  = checksum
    private func parseAndEmitO2Frame(_ frame: [UInt8]) {
        NSLog("🧬 [O2 FRAME] len=\(frame.count) \(frame.map { String(format: "%02X", $0) }.joined(separator: " "))")

        guard frame.count >= 17, frame[0] == O2_FRAME_HEADER else {
            NSLog("⚠️ [O2 SELF-PARSE] Unrecognized frame layout, ignoring")
            return
        }

        let spo2 = Int(frame[7])
        let pr = Int(frame[8]) | (Int(frame[9]) << 8)
        let piRaw = Int(frame[16])
        let batteryRaw = Int(frame[14])
        let battery = batteryRaw <= 100 ? batteryRaw : 0

        // Finger-in when SpO2/PR are in physiological range; otherwise treat as finger-out.
        let fingerIn = spo2 >= 1 && spo2 <= 100 && pr >= 1 && pr <= 511
        if fingerIn {
            NSLog("✅ [O2 SELF-PARSE] Finger-in reading: spo2=\(spo2) pr=\(pr) pi=\(Double(piRaw)/10.0) battery=\(battery)%")
            emitO2Rt(spo2: spo2, pr: pr, pi: piRaw, battery: battery, battState: 0, sensorState: 0, runState: 2)
        } else {
            NSLog("ℹ️ [O2 SELF-PARSE] Finger out / no reading (spo2=\(spo2) pr=\(pr)). Emitting finger-out status.")
            emitO2Rt(spo2: 0, pr: 0, pi: 0, battery: battery, battState: 0, sensorState: 1, runState: 0)
        }
    }

    /// Emits a normalized o2RingRt event to JavaScript.
    private func emitO2Rt(spo2: Int, pr: Int, pi: Int, battery: Int, battState: Int, sensorState: Int, runState: Int) {
        var rt = JSObject()
        rt["spo2"] = spo2
        rt["pr"] = pr
        rt["pi"] = Double(pi) / 10.0
        rt["battery"] = battery
        rt["batteryState"] = battState
        rt["state"] = sensorState
        rt["runStatus"] = runState
        NSLog("📡 [O2 SELF-PARSE] ✅ Emitting o2RingRt: spo2=\(spo2) pr=\(pr) pi=\(Double(pi)/10.0) battery=\(battery) sensor=\(sensorState)")
        notifyListeners("o2RingRt", data: rt)
    }
    
    @objc(peripheral:didWriteValueForCharacteristic:error:)
    public func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        if let error = error {
            NSLog("❌ [BLE WRITE] didWriteValueFor \(characteristic.uuid.uuidString) error: \(error.localizedDescription)")
        } else {
            NSLog("✅ [BLE WRITE] didWriteValueFor \(characteristic.uuid.uuidString) success")
        }
        if let fwd = self.sdkBLEDeviceDelegate, !(fwd is WellueSDK) {
            fwd.peripheral?(peripheral, didWriteValueFor: characteristic, error: error)
        }
    }
    
    @objc(peripheral:didUpdateNotificationStateForCharacteristic:error:)
    public func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
        NSLog("🔔 [BLE NOTIFY] didUpdateNotificationState: \(characteristic.uuid.uuidString) isNotifying=\(characteristic.isNotifying)")
        if let error = error {
            NSLog("❌ [BLE NOTIFY] error: \(error.localizedDescription)")
        }
        if let fwd = self.sdkBLEDeviceDelegate, !(fwd is WellueSDK) {
            fwd.peripheral?(peripheral, didUpdateNotificationStateFor: characteristic, error: error)
        }
    }
    
    @objc(peripheral:didDiscoverServices:)
    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        NSLog("🔧 [BLE INTERCEPT] didDiscoverServices: \(peripheral.services?.count ?? 0) services")
        if let error = error {
            NSLog("❌ [BLE INTERCEPT] didDiscoverServices error: \(error.localizedDescription)")
        }
        if let services = peripheral.services {
            for service in services {
                NSLog("   🔬 [SERVICE DISCOVERED] UUID: \(service.uuid.uuidString)")
            }
        }
        if let fwd = self.sdkBLEDeviceDelegate, !(fwd is WellueSDK) {
            fwd.peripheral?(peripheral, didDiscoverServices: error)
        }
    }
    
    @objc(peripheral:didDiscoverCharacteristicsForService:error:)
    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        NSLog("🔧 [BLE INTERCEPT] didDiscoverCharacteristicsFor: \(service.uuid.uuidString)")
        if let error = error {
            NSLog("❌ [BLE INTERCEPT] didDiscoverCharacteristicsFor error: \(error.localizedDescription)")
        }
        if let characteristics = service.characteristics {
            for char in characteristics {
                NSLog("   🔬 [CHAR DISCOVERED] UUID: \(char.uuid.uuidString) (properties: \(char.properties.rawValue))")
            }
        }
        
        // Cache O2Ring characteristics if discovered (for diagnostics and fallback)
        let deviceName = self.currentDevice?.name ?? self.connectedDevice?.name ?? ""
        let isOxi = (self.viatomUtils?.currentType == VTMDeviceTypeWOxi) || 
                    (self.connectedModel == "O2Ring") ||
                    self.isO2RingDeviceName(deviceName) ||
                    (self.viatomUtils is VTO2Communicate)
        
        if isOxi, let o2Comm = self.viatomUtils as? VTO2Communicate {
            NSLog("🔧 [O2RING CHAR DISCOVERY] Injecting chars from service \(service.uuid.uuidString) into o2Comm...")
            self.injectO2Chars(from: service, into: o2Comm, peripheral: peripheral)
            if o2Comm.txcharacteristic != nil && o2Comm.rxcharacteristic != nil {
                NSLog("✅ [O2RING CHAR DISCOVERY] Both TX and RX now set!")
            }
        } else if isOxi, let characteristics = service.characteristics {
            for char in characteristics {
                if char.uuid.uuidString.caseInsensitiveCompare(O2RING_WRITE_CHAR_UUID.uuidString) == .orderedSame ||
                   char.uuid.uuidString.caseInsensitiveCompare(BP2_WRITE_CHAR_UUID.uuidString) == .orderedSame {
                    self.o2RingTxChar = char
                    NSLog("🔧 [O2RING] Cached txChar: \(char.uuid.uuidString)")
                } else if char.uuid.uuidString.caseInsensitiveCompare(O2RING_NOTIFY_CHAR_UUID.uuidString) == .orderedSame ||
                          char.uuid.uuidString.caseInsensitiveCompare(BP2_NOTIFY_CHAR_UUID.uuidString) == .orderedSame {
                    self.o2RingRxChar = char
                    NSLog("🔧 [O2RING] Cached rxChar: \(char.uuid.uuidString)")
                }
            }
        }
        
        // Forward to SDK's VTMBLEDevice (guard against self-recursion)
        if let fwd = self.sdkBLEDeviceDelegate, !(fwd is WellueSDK) {
            fwd.peripheral?(peripheral, didDiscoverCharacteristicsFor: service, error: error)
        }
    }

}

extension WellueSDK: VTMURATDeviceExtension {
    @objc(extensionNamePrefixsWithType:)
    public func extensionNamePrefixs(with type: VTMDeviceType) -> [String]? {
        let prefixes: [String]?
        switch type {
        case VTMDeviceTypeWOxi:
            prefixes = ["O2", "O2Ring", "O2RingS", "OxyLink", "Oximeter", "WearOxi", "OxiBand"]
        case VTMDeviceTypeBP:
            prefixes = ["BP2", "BP2A", "BP2T", "BP2W", "BP2Pro", "BPW1", "Monitraq"]
        case VTMDeviceTypeECG:
            prefixes = ["ER1", "ER2", "VBeat", "DuoEK", "DuoEKS"]
        default:
            prefixes = nil
        }
        NSLog("🔧 [VTM EXTENSION] Name prefixes requested for type \(type.rawValue): \(String(describing: prefixes))")
        return prefixes
    }
}

extension WellueSDK {
    // MARK: - VTO2CommunicateDelegate

    @objc(o2_serviceDeployed:)
    public func o2_serviceDeployed(_ completed: Bool) {
        let selfPtr = Unmanaged.passUnretained(self).toOpaque()
        NSLog("🎉🎉🎉 [O2 COMMUNICATE] SERVICE DEPLOYED! completed=\(completed) self=\(selfPtr)")
        
        if completed {
            if !isSdkDeployed {
                if let o2Comm = self.viatomUtils as? VTO2Communicate {
                    NSLog("✅ [O2 COMMUNICATE] Triggering utilDeployCompletion via VTO2Communicate delegate")
                    
                    // The SDK completed service discovery but may not have bound txcharacteristic.
                    // Manually scan ALL discovered services to find and inject O2Ring characteristics.
                    if let peripheral = self.currentDevice ?? self.connectedDevice {
                        if o2Comm.txcharacteristic == nil || o2Comm.rxcharacteristic == nil {
                            NSLog("🔧 [O2 COMMUNICATE] Chars nil after deploy — scanning ALL services to inject...")
                            if let services = peripheral.services {
                                for service in services {
                                    NSLog("🔧 [O2 COMMUNICATE] Checking service: \(service.uuid.uuidString) chars=\(service.characteristics?.count ?? 0)")
                                    self.injectO2Chars(from: service, into: o2Comm, peripheral: peripheral)
                                }
                            }
                            NSLog("🔧 [O2 COMMUNICATE] Post-injection: tx=\(o2Comm.txcharacteristic?.uuid.uuidString ?? "STILL NIL"), rx=\(o2Comm.rxcharacteristic?.uuid.uuidString ?? "STILL NIL")")
                            
                            // If still nil, trigger characteristic discovery and retry
                            if o2Comm.txcharacteristic == nil {
                                NSLog("⚠️ [O2 COMMUNICATE] Chars still nil — triggering discovery + scheduling retry...")
                                if let services = peripheral.services {
                                    for service in services {
                                        if service.characteristics == nil || service.characteristics?.isEmpty == true {
                                            NSLog("🔧 [O2 RETRY] Discovering characteristics for \(service.uuid.uuidString)...")
                                            peripheral.discoverCharacteristics(nil, for: service)
                                        }
                                    }
                                }
                                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
                                    guard let self = self,
                                          let o2 = self.viatomUtils as? VTO2Communicate,
                                          o2.txcharacteristic == nil,
                                          let p = self.currentDevice ?? self.connectedDevice,
                                          let services = p.services else { return }
                                    NSLog("🔧 [O2 RETRY] Retrying injection after 1s delay...")
                                    for service in services {
                                        self.injectO2Chars(from: service, into: o2, peripheral: p)
                                    }
                                    if o2.txcharacteristic != nil {
                                        NSLog("✅ [O2 RETRY] TX now set: \(o2.txcharacteristic!.uuid.uuidString)")
                                    } else {
                                        NSLog("❌ [O2 RETRY] TX still nil after retry")
                                    }
                                }
                            }
                        } else {
                            self.o2RingTxChar = o2Comm.txcharacteristic
                            self.o2RingRxChar = o2Comm.rxcharacteristic
                            NSLog("✅ [O2 COMMUNICATE] Post-deploy chars already set: tx=\(o2Comm.txcharacteristic?.uuid.uuidString ?? "nil"), rx=\(o2Comm.rxcharacteristic?.uuid.uuidString ?? "nil")")
                        }
                    }
                    
                    self.utilDeployCompletion(o2Comm)
                }
            } else {
                NSLog("⚠️ [O2 COMMUNICATE] Already deployed, ignoring duplicate o2_serviceDeployed")
            }
        } else {
            NSLog("❌ [O2 COMMUNICATE] Service deployment failed")
            self.utilDeployFailed(self.viatomUtils ?? VTMURATUtils())
        }
    }

    @objc(realDataCallBackWithData:)
    public func realDataCallBack(with realData: Data?) {
        markDataReceived()
        
        guard let realData = realData else {
            NSLog("❌ [O2 COMMUNICATE] realDataCallBack received nil data")
            return
        }
        
        NSLog("📊 [O2 COMMUNICATE] realDataCallBack received \(realData.count) bytes: \(realData.prefix(16).map { String(format: "%02X", $0) }.joined(separator: " "))")
        let realObj = VTO2Parser.parseO2RealObject(with: realData)
        var rt = JSObject()
        rt["spo2"] = Int(realObj.spo2)
        rt["pr"] = Int(realObj.hr)
        rt["pi"] = Double(realObj.pi) / 10.0
        rt["battery"] = Int(realObj.battery)
        rt["batteryState"] = Int(realObj.batState)
        rt["state"] = Int(realObj.leadState)
        rt["runStatus"] = 0
        
        NSLog("📡 [O2 COMMUNICATE DELEGATE] ✅ Emitting o2RingRt: spo2=\(realObj.spo2) hr=\(realObj.hr) pi=\(realObj.pi) battery=\(realObj.battery) sensorState=\(realObj.leadState)")
        notifyListeners("o2RingRt", data: rt)
    }
    
    // MARK: - VTO2A5RespDelegate (A5 protocol real-time data from WOxi devices)

    @objc public func a5_realParams(_ params: VTParameters) {
        markDataReceived()
        NSLog("📡 [A5 DELEGATE] ✅ a5_realParams: spo2=\(params.spo2) pr=\(params.pr) pi=\(params.pi) battery=\(params.battery_percent) sensor=\(params.sensor_state)")
        var rt = JSObject()
        rt["spo2"] = Int(params.spo2)
        rt["pr"] = Int(params.pr)
        rt["pi"] = Double(params.pi) / 10.0
        rt["battery"] = Int(params.battery_percent)
        rt["batteryState"] = Int(params.battery_state)
        rt["state"] = Int(params.sensor_state)
        rt["runStatus"] = Int(params.run_state)
        notifyListeners("o2RingRt", data: rt)
    }

    @objc public func a5_realRunParams(_ params: VTO2SleepRunParams) {
        markDataReceived()
        NSLog("📡 [A5 DELEGATE] ✅ a5_realRunParams: spo2=\(params.spo2) pr=\(params.pr) pi=\(params.pi) battery=\(params.battery_percent) sensor=\(params.sensor_state) runStatus=\(params.run_status)")
        var rt = JSObject()
        rt["spo2"] = Int(params.spo2)
        rt["pr"] = Int(params.pr)
        rt["pi"] = Double(params.pi) / 10.0
        rt["battery"] = Int(params.battery_percent)
        rt["batteryState"] = Int(params.battery_state)
        rt["state"] = Int(params.sensor_state)
        rt["runStatus"] = Int(params.run_status)
        notifyListeners("o2RingRt", data: rt)
    }

    @objc public func a5_responseError(_ respRes: VTA5RespRes, withCmd cmd: Int32) {
        NSLog("❌ [A5 DELEGATE] a5_responseError: respRes=\(respRes.rawValue) cmd=0x\(String(format: "%02X", cmd))")
    }

    @objc(writeDataErrorCode:)
    public func writeDataErrorCode(_ errorCode: Int32) {
        NSLog("❌ [O2 COMMUNICATE DELEGATE] writeDataErrorCode: \(errorCode) (300=disconnected, 301=txChar nil)")
        
        // If txChar is nil (301), scan services and inject characteristics
        if errorCode == 301 {
            guard let o2Comm = self.viatomUtils as? VTO2Communicate else { return }
            
            // First try cached
            if let tx = self.o2RingTxChar {
                o2Comm.txcharacteristic = tx
                if let bleDevice = o2Comm.bleDevice {
                    bleDevice.a5_TxCharacteristic = tx
                    bleDevice.aa_TxCharacteristic = tx
                }
                NSLog("🔧 [O2 RECOVER] Re-injected cached txChar: \(tx.uuid.uuidString)")
                return
            }
            
            // Try reading from bleDevice's internal char storage
            if let bleDevice = o2Comm.bleDevice {
                let tx = bleDevice.a5_TxCharacteristic ?? bleDevice.aa_TxCharacteristic
                let rx = bleDevice.a5_RxCharacteristic ?? bleDevice.aa_RxCharacteristic
                if let tx = tx {
                    o2Comm.txcharacteristic = tx
                    self.o2RingTxChar = tx
                    NSLog("✅ [O2 RECOVER] Got TX from bleDevice: \(tx.uuid.uuidString)")
                    if let rx = rx {
                        o2Comm.rxcharacteristic = rx
                        self.o2RingRxChar = rx
                        NSLog("✅ [O2 RECOVER] Got RX from bleDevice: \(rx.uuid.uuidString)")
                    }
                    return
                }
            }
            
            // If no cache and no bleDevice chars, scan peripheral services
            guard let peripheral = self.currentDevice ?? self.connectedDevice,
                  let services = peripheral.services else {
                NSLog("❌ [O2 RECOVER] No peripheral or services available")
                return
            }

            NSLog("🔧 [O2 RECOVER] No cached chars — scanning ALL \(services.count) services...")
            var needsDiscovery = false
            for service in services {
                let svcUUID = service.uuid.uuidString.uppercased()
                if service.characteristics == nil || service.characteristics?.isEmpty == true {
                    NSLog("🔧 [O2 RECOVER] Service \(svcUUID) has no chars — will trigger discovery...")
                    needsDiscovery = true
                } else {
                    NSLog("🔧 [O2 RECOVER] Service \(svcUUID) has \(service.characteristics?.count ?? 0) chars — injecting...")
                    self.injectO2Chars(from: service, into: o2Comm, peripheral: peripheral)
                }
            }
            
            // If injection succeeded, we're done
            if o2Comm.txcharacteristic != nil {
                NSLog("✅ [O2 RECOVER] TX injected successfully: \(o2Comm.txcharacteristic!.uuid.uuidString)")
                self.o2RingTxChar = o2Comm.txcharacteristic
                return
            }
            
            // Need to discover characteristics — temporarily take delegate
            if needsDiscovery {
                NSLog("🔧 [O2 RECOVER] Temporarily taking delegate for char discovery...")
                let originalDelegate = peripheral.delegate
                peripheral.delegate = self
                for service in services {
                    if service.characteristics == nil || service.characteristics?.isEmpty == true {
                        peripheral.discoverCharacteristics(nil, for: service)
                    }
                }
                // Restore delegate after discovery
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
                    guard let self = self else { return }
                    if let origDel = originalDelegate {
                        peripheral.delegate = origDel
                    }
                    NSLog("🔧 [O2 RECOVER] Delegate restored after discovery window")
                }
            }
        }
    }
    
    @objc(commonResponse:andResult:)
    public func commonResponse(_ cmdType: VTCmd, andResult result: VTCommonResult) {
        NSLog("📡 [O2 COMMUNICATE DELEGATE] commonResponse: cmd=\(cmdType.rawValue) result=\(result.rawValue)")
    }
}
