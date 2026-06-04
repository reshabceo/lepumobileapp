import Foundation
import Capacitor
import CoreBluetooth
import VTMProductLib

// Retroactively conform VTMURATUtils to CBPeripheralDelegate so Swift casts (as? CBPeripheralDelegate) succeed.
extension VTMURATUtils: CBPeripheralDelegate {}

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
public class WellueSDK: CAPPlugin, CBCentralManagerDelegate, CBPeripheralDelegate, VTMURATDeviceDelegate, VTMURATUtilsDelegate {
    public static var shared: WellueSDK?
    private static var activePluginForJS: WellueSDK?
    
    // Direct references to characteristics
    private var o2RingTxChar: CBCharacteristic?
    private var o2RingRxChar: CBCharacteristic?

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
        return nameLower.contains("o2") || nameLower.contains("ring") || nameLower.contains("oxy") || nameLower.contains("jodu")
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
    private let DATA_TIMEOUT_THRESHOLD = 10.0  // If no data for 10 seconds, SDK is dead
    
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
        
        // Dump VTMURATUtils structure
        dumpClassInfo(cls: VTMURATUtils.self)
        
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
        } else if periLower.contains("jodu") {
            resolvedName = periClean
        } else if advLower.contains("jodu") && !periClean.isEmpty {
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
        let containsO2 = nameLower.contains("o2") || nameLower.contains("ring") || nameLower.contains("oxy") || nameLower.contains("jodu") ||
                         advLower.contains("jodu") || periLower.contains("jodu")
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
        
        guard device.state == .connected else {
            NSLog("⚠️ [SDK DEPLOY] Device state is \(device.state.rawValue) (not connected). Postponing.")
            return
        }
        
        guard let utils = viatomUtils else {
            NSLog("❌ [SDK DEPLOY] viatomUtils not initialized")
            return
        }
        
        // Reset deployment state to ensure we always run the handshake
        isSdkDeployed = false
        
        // Force the SDK to re-run its internal setter by clearing it first via KVC (peripheral is non-optional in Swift)
        utils.setValue(nil, forKey: "peripheral")
        
        if isConnectingO2Ring {
            let originalName = device.name ?? "O2Ring"
            if !originalName.hasPrefix("BP2") {
                let tempBP2Name = "BP2-\(originalName)"
                NSLog("🔧 [O2RING DEPLOY] Temporary renaming peripheral to '\(tempBP2Name)' to satisfy SDK prefix checks...")
                device.setValue(tempBP2Name, forKey: "name")
            }
        }
        
        NSLog("🔄 [SDK DEPLOY] Triggering SDK deployment for device: \(device.name ?? "Unknown")")
        
        // Cancel any stale deployment timer (but do NOT restart peripheral assignment)
        deploymentTimer?.invalidate()
        deploymentRetryCount = 0
        
        // ✅ FIX #2: Correct delegate ordering — extension MUST be set before peripheral.
        // 'extension' supplies the name-prefix map used for device-type inference.
        // 'peripheral' assignment triggers discoverServices() internally inside the SDK.
        utils.extension = self       // ← 1st: type-inference prefix map
        utils.deviceDelegate = self  // ← 2nd: deployment completion callback
        utils.delegate = self        // ← 3rd: command completion callbacks
        utils.peripheral = device    // ← 4th: triggers SDK-owned GATT discovery
        
        // 🧪 DELEGATE INTERCEPT: Route CBPeripheralDelegate through the plugin so we can 
        // inject write/notify characteristics dynamically during discovery. All calls are forwarded.
        // device.delegate = self
        
        // ✅ DIAGNOSTIC: Verify the delegate was successfully set.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            NSLog("🔬 [DELEGATE AUDIT] peripheral.delegate class = \(type(of: device.delegate as AnyObject))")
            NSLog("🔬 [DELEGATE AUDIT] Is plugin delegate: \(device.delegate is WellueSDK)")
        }
        
        // ✅ FIX #3: 15-second timeout — O2Ring is slower than BP2.
        // CRITICAL: Do NOT re-assign utils.peripheral on timeout.
        // Re-assigning peripheral restarts service discovery and breaks ongoing deployment.
        deploymentTimer = Timer.scheduledTimer(withTimeInterval: 15.0, repeats: false) { [weak self] _ in
            guard let self = self else { return }
            
            if !self.isSdkDeployed {
                NSLog("⏰ [SDK DEPLOY] Timeout! utilDeployCompletion not received within 15 seconds")
                NSLog("⏰ [SDK DEPLOY] IMPORTANT: NOT re-assigning peripheral (would cancel discovery)")
                
                if let device = self.currentDevice {
                    let currentName = device.name ?? ""
                    if currentName.hasPrefix("BP2-") {
                        let cleanName = currentName.replacingOccurrences(of: "BP2-", with: "")
                        NSLog("🔧 [O2RING DEPLOY TIMEOUT] Restoring original name '\(cleanName)' to peripheral...")
                        device.setValue(cleanName, forKey: "name")
                    }
                }
                
                // Notify JavaScript layer — do not restart discovery
                var result = JSObject()
                result["error"] = "SDK deployment timeout after 15 seconds"
                self.notifyListeners("sdkDeploymentFailed", data: result)
            }
        }
        
        NSLog("⏰ [SDK DEPLOY] Deployment started — 15-second timeout set (no re-trigger on timeout)")
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
        // If addresses differ, the singleton fix did not take effect.
        let utilPtr  = Unmanaged.passUnretained(util).toOpaque()
        let localPtr  = viatomUtils.map { Unmanaged.passUnretained($0).toOpaque() }
        NSLog("🔬 [INSTANCE AUDIT] deployed util ptr = \(utilPtr)")
        NSLog("🔬 [INSTANCE AUDIT] local viatomUtils ptr = \(String(describing: localPtr))")
        NSLog("🔬 [INSTANCE AUDIT] Addresses match (singleton fix effective): \(localPtr.map { $0 == utilPtr } ?? false)")
        
        viatomUtils = util
        viatomUtils?.extension = self
        viatomUtils?.delegate = self  // Ensure callbacks flow to us
        isSdkDeployed = true  // ✅ SDK is now ready to accept commands
        
        // 🧪 DELEGATE KEEP-ALIVE: Do NOT hand back delegate directly to SDK.
        // Keeping WellueSDK as the CBPeripheralDelegate allows us to intercept/preserve
        // injected characteristics, while forwardingTarget(for:) routes all unimplemented events dynamically.
        // util.peripheral.delegate = util
        
        // Determine the connected device model
        if let device = currentDevice {
            let nameLower = (device.name ?? "").lowercased()
            let utilsType = util.currentType
            
            NSLog("🔬 [DEPLOY] util.currentType = \(utilsType.rawValue) (6=WOxi expected for O2Ring)")
            
            if utilsType == VTMDeviceTypeWOxi || self.isO2RingDeviceName(device.name ?? "") || self.targetModel == "O2Ring" {
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
            
            if self.connectedModel == "O2Ring" {
                NSLog("🔧 [O2RING DEPLOY] Keeping currentType as BP (2) post-handshake to receive notifications on 0734...")
                // util.currentType = VTMDeviceTypeWOxi
                
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
                
                // Double check and re-inject for maximum stability
                self.injectO2RingCharacteristics()
                
                if let tx = util.txcharacteristic {
                    NSLog("🔧 [O2RING KVC FIX] Verification: txcharacteristic is now \(tx.uuid.uuidString)")
                } else {
                    NSLog("❌ [O2RING KVC FIX] Verification failed: txcharacteristic is still nil")
                }
                if let rx = util.rxcharacteristic {
                    NSLog("🔧 [O2RING KVC FIX] Verification: rxcharacteristic is now \(rx.uuid.uuidString)")
                } else {
                    NSLog("❌ [O2RING KVC FIX] Verification failed: rxcharacteristic is still nil")
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
            // Auto-start real-time polling with a 2.0s delay after deployment
            // to allow certain O2Ring firmware versions to settle before receiving commands
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
                guard let self = self else { return }
                self.startO2RingPollingTimer()
            }
        } else {
            // Begin real-time BP stream immediately so device-initiated measurements are detected
            debugLog("Requesting BP real-time data stream after deployment")
            viatomUtils?.requestBPRealData()

            // Request periodic status updates (battery, measuring state)
            viatomUtils?.bp_requestRealStatus()
        }
    }

    // MARK: - VTMURATUtilsDelegate (generic command callbacks)
    @objc public func util(_ util: VTMURATUtils, commandCompletion cmdType: UInt8, deviceType: VTMDeviceType, response: NSData?) {
        // 🏥 Mark data as received (SDK is alive!)
        markDataReceived()
        
        let data = response as Data?
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

    @objc public func util(_ util: VTMURATUtils, commandFailed cmdType: UInt8, deviceType: VTMDeviceType, failedType: VTMBLEPkgType) {
        NSLog("❌ [UTIL] CMD FAILED: cmdType=0x\(String(format: "%02X", cmdType)), deviceType=\(deviceType.rawValue), failedType=\(failedType.rawValue)")
        errorLog("Command failed. cmdType=\(cmdType) deviceType=\(deviceType) failedType=\(failedType.rawValue)")
    }
    
    @objc public func util(_ util: VTMURATUtils, commandSendFailed errorCode: UInt8) {
        let pluginPtr = Unmanaged.passUnretained(self).toOpaque()
        // errorCode: 0=peripheral nil, 1=txCharacteristic nil, 2=peripheral not connected, 3=timeout
        let errorMeaning: String
        switch errorCode {
        case 0: errorMeaning = "peripheral is nil"
        case 1: errorMeaning = "txCharacteristic is nil — SDK cannot write to device"
        case 2: errorMeaning = "peripheral.state != connected"
        case 3: errorMeaning = "timeout"
        default: errorMeaning = "unknown"
        }
        NSLog("❌ [UTIL] SEND FAILED: errorCode=\(errorCode) (\(errorMeaning)) connectedModel=\(self.connectedModel) currentType=\(util.currentType.rawValue) plugin_ptr=\(pluginPtr)")
        errorLog("Command send failed. errorCode=\(errorCode) (\(errorMeaning))")
        
        // ✅ DIAGNOSTIC: Compare instance pointers to verify singleton fix is effective.
        // If 'util' and 'viatomUtils' have DIFFERENT addresses, we are still using
        // two separate instances — which means txCharacteristic is on one, commands on the other.
        let utilPtr = Unmanaged.passUnretained(util).toOpaque()
        let localPtr = viatomUtils.map { Unmanaged.passUnretained($0).toOpaque() }
        NSLog("🔬 [SEND FAIL DIAG] util ptr=\(utilPtr)  viatomUtils ptr=\(String(describing: localPtr))")
        NSLog("🔬 [SEND FAIL DIAG] Same instance: \(localPtr.map { $0 == utilPtr } ?? false)")
        NSLog("🔬 [SEND FAIL DIAG] util.currentType=\(util.currentType.rawValue), peripheral services: \(util.peripheral.services?.map { $0.uuid.uuidString } ?? [])")
        NSLog("🔬 [SEND FAIL DIAG] peripheral.state=\(util.peripheral.state.rawValue) (2=connected)")
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
        var crc: UInt8 = 0
        for b in data {
            let chk = crc ^ b
            crc = 0
            if (chk & 0x01) != 0 { crc ^= 0x07 }
            if (chk & 0x02) != 0 { crc ^= 0x0e }
            if (chk & 0x04) != 0 { crc ^= 0x1c }
            if (chk & 0x08) != 0 { crc ^= 0x38 }
            if (chk & 0x10) != 0 { crc ^= 0x70 }
            if (chk & 0x20) != 0 { crc ^= 0xe0 }
            if (chk & 0x40) != 0 { crc ^= 0xc7 }
            if (chk & 0x80) != 0 { crc ^= 0x89 }
        }
        return crc
    }
    
    /// Starts the O2Ring real-time polling timer. Safe to call multiple times (idempotent).
    private func startO2RingPollingTimer() {
        let selfPtr = Unmanaged.passUnretained(self).toOpaque()
        DispatchQueue.main.async {
            self.realTimeDataTimer?.invalidate()
            self.viatomUtils?.delegate = self
            let currentType = self.viatomUtils?.currentType.rawValue ?? 0
            NSLog("✅ [O2RING] RT polling timer starting. currentType=\(currentType), peripheral=\(self.viatomUtils?.peripheral.name ?? "nil"), peripheralState=\(self.viatomUtils?.peripheral.state.rawValue ?? -1) plugin_ptr=\(selfPtr)")
            self.realTimeDataTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
                guard let self = self else { return }
                guard self.isSdkDeployed else {
                    NSLog("⏰ [RT TIMER] O2Ring poll tick – SDK not deployed, skipping real data request")
                    return
                }
                guard self.connectedModel == "O2Ring" || self.viatomUtils?.currentType == VTMDeviceTypeWOxi else {
                    NSLog("⏰ [RT TIMER] O2Ring poll tick – device is not O2Ring and type is not WOxi, skipping real data request")
                    return
                }
                
                // Keep currentType as BP to ensure notification reception on BP characteristic
                // self.viatomUtils?.currentType = VTMDeviceTypeWOxi
                
                // Dynamically re-inject characteristics before call to prevent SDK resetting them
                self.injectO2RingCharacteristics()
                
                let ct = self.viatomUtils?.currentType.rawValue ?? 0
                NSLog("⏰ [RT TIMER] O2Ring poll tick – requesting real data. currentType=\(ct) plugin_ptr=\(selfPtr)")
                
                // Try SDK path first
                self.viatomUtils?.woxi_requestWOxiRealData()
                
                // Direct write fallback
                self.sendO2RingRealDataRequestDirectly()
            }
            NSLog("✅ [O2RING] RT polling timer started")
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
                    self.isO2RingDeviceName(device.name ?? "")
        
        NSLog("📊 [RT TASK] isOxy evaluated to: \(isOxy)")
        
        if isOxy {
            // Set delegate to be absolutely sure we receive command completion callbacks
            viatomUtils?.delegate = self
            
            // Dynamically inject/preserve characteristics before starting timer
            self.injectO2RingCharacteristics()
            
            // Start (or restart) the RT polling timer
            self.startO2RingPollingTimer()
            NSLog("📊 [RT TASK] O2Ring detected, started/restarted 1s polling timer")
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
    
    // MARK: - CBPeripheralDelegate Interception & Proxying
    // We proxy peripheral callbacks to the SDK singleton (viatomUtils) to inspect and override 
    // properties in real time (specifically injecting O2Ring tx/rxcharacteristics) before the 
    // SDK attempts its initialization handshake.
    
    public override func responds(to aSelector: Selector!) -> Bool {
        if let sdk = viatomUtils, sdk.responds(to: aSelector) {
            return true
        }
        return super.responds(to: aSelector)
    }
    
    public override func forwardingTarget(for aSelector: Selector!) -> Any? {
        if let sdk = viatomUtils, sdk.responds(to: aSelector) {
            NSLog("🔧 [BLE INTERCEPT] Dynamic forwarding selector \(NSStringFromSelector(aSelector)) to SDK")
            return sdk
        }
        return super.forwardingTarget(for: aSelector)
    }
    
    @objc(peripheral:didUpdateValueForCharacteristic:error:)
    public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        NSLog("🔧 [BLE INTERCEPT] didUpdateValueFor: \(characteristic.uuid.uuidString)")
        if let error = error {
            NSLog("❌ [BLE INTERCEPT] didUpdateValueFor error: \(error.localizedDescription)")
        }
        if let sdk = viatomUtils {
            (sdk as AnyObject).peripheral?(peripheral, didUpdateValueFor: characteristic, error: error)
        }
    }
    
    @objc(peripheral:didWriteValueForCharacteristic:error:)
    public func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        NSLog("🔧 [BLE INTERCEPT] didWriteValueFor: \(characteristic.uuid.uuidString)")
        if let error = error {
            NSLog("❌ [BLE INTERCEPT] didWriteValueFor error: \(error.localizedDescription)")
        }
        if let sdk = viatomUtils {
            (sdk as AnyObject).peripheral?(peripheral, didWriteValueFor: characteristic, error: error)
        }
    }
    
    @objc(peripheral:didUpdateNotificationStateForCharacteristic:error:)
    public func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
        NSLog("🔧 [BLE INTERCEPT] didUpdateNotificationStateFor: \(characteristic.uuid.uuidString)")
        if let error = error {
            NSLog("❌ [BLE INTERCEPT] didUpdateNotificationStateFor error: \(error.localizedDescription)")
        }
        if let sdk = viatomUtils {
            (sdk as AnyObject).peripheral?(peripheral, didUpdateNotificationStateFor: characteristic, error: error)
        }
        // Re-inject after SDK may have reset them
        self.injectO2RingCharacteristics()
        // Also restore our direct references
        if let tx = self.o2RingTxChar {
            self.viatomUtils?.txcharacteristic = tx
        }
        if let rx = self.o2RingRxChar {
            self.viatomUtils?.rxcharacteristic = rx
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
        if let sdk = viatomUtils {
            NSLog("   👉 Forwarding didDiscoverServices to SDK using AnyObject dynamic dispatch")
            (sdk as AnyObject).peripheral?(peripheral, didDiscoverServices: error)
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
        
        let injectBlock = { [weak self] in
            guard let self = self else { return }
            let deviceName = self.currentDevice?.name ?? self.connectedDevice?.name ?? ""
            let isOxi = (self.viatomUtils?.currentType == VTMDeviceTypeWOxi) || 
                        (self.connectedModel == "O2Ring") ||
                        self.isO2RingDeviceName(deviceName)
            
            if isOxi {
                if service.uuid.uuidString.caseInsensitiveCompare(self.O2RING_SERVICE_UUID.uuidString) == .orderedSame {
                    if let characteristics = service.characteristics {
                        for char in characteristics {
                            if char.uuid.uuidString.caseInsensitiveCompare(self.O2RING_WRITE_CHAR_UUID.uuidString) == .orderedSame {
                                NSLog("🔧 [O2RING KVC INTERCEPT] Injecting O2Ring S txcharacteristic: \(char.uuid.uuidString)")
                                self.viatomUtils?.txcharacteristic = char
                                self.o2RingTxChar = char
                            } else if char.uuid.uuidString.caseInsensitiveCompare(self.O2RING_NOTIFY_CHAR_UUID.uuidString) == .orderedSame {
                                NSLog("🔧 [O2RING KVC INTERCEPT] Injecting O2Ring S rxcharacteristic: \(char.uuid.uuidString)")
                                self.viatomUtils?.rxcharacteristic = char
                                self.o2RingRxChar = char
                            }
                        }
                    }
                } else if service.uuid.uuidString.caseInsensitiveCompare(self.BP2_SERVICE_UUID.uuidString) == .orderedSame {
                    if let characteristics = service.characteristics {
                        for char in characteristics {
                            if char.uuid.uuidString.caseInsensitiveCompare(self.BP2_WRITE_CHAR_UUID.uuidString) == .orderedSame {
                                NSLog("🔧 [O2RING KVC INTERCEPT] Injecting PO2/O2Ring txcharacteristic: \(char.uuid.uuidString)")
                                self.viatomUtils?.txcharacteristic = char
                                self.o2RingTxChar = char
                            } else if char.uuid.uuidString.caseInsensitiveCompare(self.BP2_NOTIFY_CHAR_UUID.uuidString) == .orderedSame {
                                NSLog("🔧 [O2RING KVC INTERCEPT] Injecting PO2/O2Ring rxcharacteristic: \(char.uuid.uuidString)")
                                self.viatomUtils?.rxcharacteristic = char
                                self.o2RingRxChar = char
                            }
                        }
                    }
                }
            }
        }
        
        // 1. Inject BEFORE forwarding so synchronous handshake writes find them non-nil
        injectBlock()
        
        // 2. Forward first to let SDK run its own logic
        if let sdk = viatomUtils {
            NSLog("   👉 Forwarding didDiscoverCharacteristicsFor to SDK using AnyObject dynamic dispatch")
            (sdk as AnyObject).peripheral?(peripheral, didDiscoverCharacteristicsFor: service, error: error)
        }
        
        // 3. Inject AFTER forwarding (just in case the SDK overwrote them to nil)
        injectBlock()
        
        // Log verification results
        let deviceName = self.currentDevice?.name ?? self.connectedDevice?.name ?? ""
        let isOxi = (self.viatomUtils?.currentType == VTMDeviceTypeWOxi) || 
                    (self.connectedModel == "O2Ring") ||
                    self.isO2RingDeviceName(deviceName)
        if isOxi {
            if let tx = viatomUtils?.txcharacteristic {
                NSLog("🔧 [O2RING KVC INTERCEPT] Verification: txcharacteristic successfully set to \(tx.uuid.uuidString)")
            } else {
                NSLog("❌ [O2RING KVC INTERCEPT] Verification failed: txcharacteristic remains nil")
            }
            if let rx = viatomUtils?.rxcharacteristic {
                NSLog("🔧 [O2RING KVC INTERCEPT] Verification: rxcharacteristic successfully set to \(rx.uuid.uuidString)")
            } else {
                NSLog("❌ [O2RING KVC INTERCEPT] Verification failed: rxcharacteristic remains nil")
            }
            
            // Handshake will be triggered and completed natively by the SDK central manager and delegate.
            NSLog("🔧 [O2RING KVC INTERCEPT] PO2/O2Ring detected on BP2 service. Awaiting native SDK handshake and utilDeployCompletion...")
        }
    }

}

extension WellueSDK: VTMURATDeviceExtension {
    @objc(extensionNamePrefixsWithType:)
    public func extensionNamePrefixs(with type: VTMDeviceType) -> [String]? {
        let prefixes: [String]?
        switch type {
        case VTMDeviceTypeWOxi:
            prefixes = ["O2RingS", "JODU"]
        case VTMDeviceTypeBP:
            prefixes = ["BP2", "BP2A", "BP2T", "BP2W", "BP2Pro", "BPW1", "Monitraq", "O2", "O2Ring", "OxyLink", "Oximeter", "WearOxi", "OxiBand", "JODU"]
        case VTMDeviceTypeECG:
            prefixes = ["ER1", "ER2", "VBeat", "DuoEK", "DuoEKS"]
        default:
            prefixes = nil
        }
        NSLog("🔧 [VTM EXTENSION] Name prefixes requested for type \(type.rawValue): \(String(describing: prefixes))")
        return prefixes
    }
}
