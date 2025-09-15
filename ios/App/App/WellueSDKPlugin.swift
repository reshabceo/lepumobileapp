import Foundation
import Capacitor
import CoreBluetooth
import VTProductLib

@objc(WellueSDK)
public class WellueSDK: CAPPlugin, CBCentralManagerDelegate, VTMProductDelegate {
    private var central: CBCentralManager?
    private var isScanning = false
    private var connectedDevices: [CBPeripheral] = []
    private var discoveredDevices: [CBPeripheral] = []
    private var vtmProduct: VTMProduct?
    private var currentDevice: VTMDevice?

    public override func load() {
        print("🔵 WellueSDK Plugin loaded with VTProductLib")
        // Initialize central manager
        self.central = CBCentralManager(delegate: self, queue: nil)
        // Initialize VTMProduct
        self.vtmProduct = VTMProduct()
        self.vtmProduct?.delegate = self
        print("🔵 VTProductLib initialized")
    }

    // MARK: - CBCentralManagerDelegate
    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        let isEnabled = (central.state == .poweredOn)
        print("🔵 iOS Bluetooth state changed to: \(isEnabled) (state=\(central.state.rawValue))")
        
        // Notify web view about Bluetooth state change
        let result = JSObject()
        result["enabled"] = isEnabled
        notifyListeners("bluetoothStatusChanged", data: result)
        
        // If Bluetooth is disabled, clear connected devices
        if !isEnabled {
            connectedDevices.removeAll()
            discoveredDevices.removeAll()
            currentDevice = nil
        }
    }
    
    public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
        print("🔍 iOS discovered device: \(peripheral.name ?? "Unknown") (\(peripheral.identifier.uuidString))")
        
        // Check if this is a Wellue BP2 device
        if let deviceName = peripheral.name, deviceName.contains("BP2") || deviceName.contains("Wellue") {
            // Add to discovered devices if not already present
            if !discoveredDevices.contains(where: { $0.identifier == peripheral.identifier }) {
                discoveredDevices.append(peripheral)
                
                // Notify web view about discovered device
                let device = JSObject()
                device["deviceName"] = peripheral.name ?? "BP2 Device"
                device["deviceId"] = peripheral.identifier.uuidString
                device["address"] = peripheral.identifier.uuidString
                device["model"] = "BP2"
                device["rssi"] = RSSI.intValue
                
                print("🔍 iOS notifying web view about Wellue device: \(device)")
                notifyListeners("deviceFound", data: device)
            }
        }
    }
    
    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        print("🔗 iOS connected to device: \(peripheral.name ?? "Unknown")")
        
        if !connectedDevices.contains(where: { $0.identifier == peripheral.identifier }) {
            connectedDevices.append(peripheral)
        }
        
        // Initialize VTMDevice for the connected peripheral
        if let vtmProduct = self.vtmProduct {
            currentDevice = VTMDevice(peripheral: peripheral, product: vtmProduct)
        }
        
        // Notify web view about connected device
        let device = JSObject()
        device["deviceName"] = peripheral.name ?? "BP2 Device"
        device["deviceId"] = peripheral.identifier.uuidString
        device["address"] = peripheral.identifier.uuidString
        device["model"] = "BP2"
        
        notifyListeners("deviceConnected", data: device)
    }
    
    public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        print("🔌 iOS disconnected from device: \(peripheral.name ?? "Unknown")")
        
        connectedDevices.removeAll { $0.identifier == peripheral.identifier }
        currentDevice = nil
        
        // Notify web view about disconnected device
        let device = JSObject()
        device["deviceName"] = peripheral.name ?? "BP2 Device"
        device["deviceId"] = peripheral.identifier.uuidString
        device["address"] = peripheral.identifier.uuidString
        
        notifyListeners("deviceDisconnected", data: device)
    }

    // MARK: - VTMProductDelegate
    public func productDidConnect(_ product: VTMProduct, device: VTMDevice) {
        print("✅ VTProductLib: Device connected - \(device.name)")
        currentDevice = device
        
        // Notify about successful connection
        let deviceInfo = JSObject()
        deviceInfo["deviceName"] = device.name
        deviceInfo["deviceId"] = device.peripheral?.identifier.uuidString ?? ""
        deviceInfo["address"] = device.peripheral?.identifier.uuidString ?? ""
        deviceInfo["model"] = "BP2"
        
        notifyListeners("deviceConnected", data: deviceInfo)
    }
    
    public func productDidDisconnect(_ product: VTMProduct, device: VTMDevice) {
        print("❌ VTProductLib: Device disconnected - \(device.name)")
        currentDevice = nil
        
        // Notify about disconnection
        let deviceInfo = JSObject()
        deviceInfo["deviceName"] = device.name
        deviceInfo["deviceId"] = device.peripheral?.identifier.uuidString ?? ""
        deviceInfo["address"] = device.peripheral?.identifier.uuidString ?? ""
        
        notifyListeners("deviceDisconnected", data: deviceInfo)
    }
    
    public func product(_ product: VTMProduct, didReceiveData data: VTMData) {
        print("📊 VTProductLib: Received data from device")
        
        // Handle different types of data from BP2
        if let bpData = data as? VTMBPData {
            handleBPData(bpData)
        } else if let realTimeData = data as? VTMRealTimeData {
            handleRealTimeData(realTimeData)
        }
    }
    
    private func handleBPData(_ bpData: VTMBPData) {
        print("🩺 BP Measurement result: SYS=\(bpData.systolic), DIA=\(bpData.diastolic), HR=\(bpData.heartRate)")
        
        let measurement = JSObject()
        measurement["systolic"] = bpData.systolic
        measurement["diastolic"] = bpData.diastolic
        measurement["pulseRate"] = bpData.heartRate
        measurement["timestamp"] = Date().timeIntervalSince1970 * 1000
        measurement["quality"] = bpData.result == 0 ? "good" : "fair"
        measurement["map"] = bpData.map
        
        notifyListeners("bpMeasurement", data: measurement)
    }
    
    private func handleRealTimeData(_ realTimeData: VTMRealTimeData) {
        print("📈 Real-time data: Pressure=\(realTimeData.pressure), HR=\(realTimeData.heartRate)")
        
        let progress = JSObject()
        progress["pressure"] = realTimeData.pressure
        progress["heartRate"] = realTimeData.heartRate
        progress["timestamp"] = Date().timeIntervalSince1970 * 1000
        
        notifyListeners("bpProgress", data: progress)
    }

    // MARK: - Plugin API
    @objc public func initialize(_ call: CAPPluginCall) {
        print("🔵 iOS initialize called")
        
        if self.central == nil {
            self.central = CBCentralManager(delegate: self, queue: nil)
        }
        
        if self.vtmProduct == nil {
            self.vtmProduct = VTMProduct()
            self.vtmProduct?.delegate = self
        }
        
        // Check initial Bluetooth state and notify
        if let central = self.central {
            let isEnabled = (central.state == .poweredOn)
            let result = JSObject()
            result["enabled"] = isEnabled
            notifyListeners("bluetoothStatusChanged", data: result)
            print("🔵 iOS Bluetooth initialized with state: \(isEnabled) (state=\(central.state.rawValue))")
        }
        
        call.resolve()
    }

    @objc public func isBluetoothEnabled(_ call: CAPPluginCall) {
        let enabled: Bool
        if let state = self.central?.state {
            enabled = (state == .poweredOn)
            print("🔵 iOS Bluetooth status check: \(enabled) (state=\(state.rawValue))")
        } else {
            enabled = false
            print("🔵 iOS Bluetooth status check: false (no central manager)")
        }
        call.resolve(["enabled": enabled])
    }

    @objc public func startScan(_ call: CAPPluginCall) {
        print("🔍 iOS startScan called")
        guard let central = self.central else {
            print("❌ iOS Bluetooth scan failed: Bluetooth not initialized")
            call.reject("Bluetooth not initialized")
            return
        }
        
        print("🔍 iOS Bluetooth state: \(central.state.rawValue)")
        guard central.state == .poweredOn else {
            print("❌ iOS Bluetooth scan failed: Bluetooth is not enabled (state=\(central.state.rawValue))")
            call.reject("Bluetooth is not enabled")
            return
        }
        
        if !isScanning {
            isScanning = true
            discoveredDevices.removeAll()
            
            // Start scanning for Wellue devices specifically
            central.scanForPeripherals(withServices: nil, options: [
                CBCentralManagerScanOptionAllowDuplicatesKey: false
            ])
            
            print("🔍 iOS Bluetooth scan started successfully")
        } else {
            print("🔍 iOS Bluetooth scan already running")
        }
        
        call.resolve()
    }

    @objc public func stopScan(_ call: CAPPluginCall) {
        guard let central = self.central else {
            call.resolve()
            return
        }
        
        if isScanning {
            central.stopScan()
            isScanning = false
            print("🛑 iOS Bluetooth scan stopped")
        }
        
        call.resolve()
    }

    @objc public func connect(_ call: CAPPluginCall) {
        guard let deviceId = call.getString("address") ?? call.getString("deviceId") else {
            call.reject("Device ID is required")
            return
        }
        
        guard let central = self.central else {
            call.reject("Bluetooth not initialized")
            return
        }
        
        // Find the peripheral by device ID
        guard let peripheral = discoveredDevices.first(where: { $0.identifier.uuidString == deviceId }) else {
            call.reject("Device not found")
            return
        }
        
        // Connect to the peripheral
        central.connect(peripheral, options: nil)
        print("🔗 iOS connecting to device: \(peripheral.name ?? "Unknown")")
        
        call.resolve()
    }

    @objc public func disconnect(_ call: CAPPluginCall) {
        guard let deviceId = call.getString("address") ?? call.getString("deviceId") else {
            call.reject("Device ID is required")
            return
        }
        
        guard let central = self.central else {
            call.resolve()
            return
        }
        
        // Find the connected peripheral by device ID
        if let peripheral = connectedDevices.first(where: { $0.identifier.uuidString == deviceId }) {
            central.cancelPeripheralConnection(peripheral)
            print("🔌 iOS disconnecting from device: \(peripheral.name ?? "Unknown")")
        }
        
        call.resolve()
    }

    @objc public func startBPMeasurement(_ call: CAPPluginCall) {
        guard let device = currentDevice else {
            call.reject("No device connected")
            return
        }
        
        print("🩺 Starting BP measurement with VTProductLib")
        
        // Use VTProductLib to start BP measurement
        vtmProduct?.startBPMeasurement(device: device)
        
        call.resolve()
    }

    @objc public func startECGMeasurement(_ call: CAPPluginCall) {
        guard let device = currentDevice else {
            call.reject("No device connected")
            return
        }
        
        print("📈 Starting ECG measurement with VTProductLib")
        
        // Use VTProductLib to start ECG measurement
        vtmProduct?.startECGMeasurement(device: device)
        
        call.resolve()
    }

    @objc public func startRtTaskForConnectedDevice(_ call: CAPPluginCall) {
        guard let device = currentDevice else {
            call.reject("No device connected")
            return
        }
        
        print("📊 Starting real-time task with VTProductLib")
        
        // Use VTProductLib to start real-time monitoring
        vtmProduct?.startRealTimeMonitoring(device: device)
        
        call.resolve()
    }

    @objc public func stopMeasurement(_ call: CAPPluginCall) {
        guard let device = currentDevice else {
            call.resolve()
            return
        }
        
        print("🛑 Stopping measurement with VTProductLib")
        
        // Use VTProductLib to stop measurement
        vtmProduct?.stopMeasurement(device: device)
        
        call.resolve()
    }

    @objc public func getBatteryLevel(_ call: CAPPluginCall) {
        guard let device = currentDevice else {
            call.resolve(["battery": 0])
            return
        }
        
        // Get battery level from VTProductLib
        let batteryLevel = device.batteryLevel
        print("🔋 Battery level: \(batteryLevel)%")
        
        call.resolve(["battery": batteryLevel])
    }

    @objc public func getBondedDevices(_ call: CAPPluginCall) {
        call.resolve(["devices": []])
    }

    @objc public func getConnectedDevices(_ call: CAPPluginCall) {
        let devices = connectedDevices.map { peripheral in
            let device = JSObject()
            device["deviceName"] = peripheral.name ?? "BP2 Device"
            device["deviceId"] = peripheral.identifier.uuidString
            device["address"] = peripheral.identifier.uuidString
            device["model"] = "BP2"
            return device
        }
        
        let result = JSObject()
        result["devices"] = devices
        call.resolve(result)
    }

    @objc public func isDeviceConnected(_ call: CAPPluginCall) {
        guard let deviceId = call.getString("address") ?? call.getString("deviceId") else {
            call.reject("Device ID is required")
            return
        }
        
        let isConnected = connectedDevices.contains { $0.identifier.uuidString == deviceId }
        call.resolve(["connected": isConnected])
    }

    @objc public func getBp2FileList(_ call: CAPPluginCall) {
        guard let device = currentDevice else {
            call.resolve(["files": []])
            return
        }
        
        // Get file list from VTProductLib
        let files = vtmProduct?.getStoredFiles(device: device) ?? []
        call.resolve(["files": files])
    }

    @objc public func bp2ReadFile(_ call: CAPPluginCall) {
        guard let device = currentDevice,
              let fileName = call.getString("fileName") else {
            call.resolve([:])
            return
        }
        
        // Read file from VTProductLib
        let fileData = vtmProduct?.readFile(device: device, fileName: fileName)
        call.resolve(fileData ?? [:])
    }
}