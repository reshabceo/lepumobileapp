import Foundation
import Capacitor
import CoreBluetooth

@objc(WellueSDK)
public class WellueSDK: CAPPlugin, CBCentralManagerDelegate {
    private var central: CBCentralManager?
    private var isScanning = false
    private var connectedDevices: [CBPeripheral] = []
    private var discoveredDevices: [CBPeripheral] = []

    public override func load() {
        // Initialize central manager lazily
        self.central = CBCentralManager(delegate: self, queue: nil)
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
        }
    }
    
    public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
        // Add to discovered devices if not already present
        if !discoveredDevices.contains(where: { $0.identifier == peripheral.identifier }) {
            discoveredDevices.append(peripheral)
            
            // Notify web view about discovered device
            let device = JSObject()
            device["deviceName"] = peripheral.name ?? "Unknown Device"
            device["deviceId"] = peripheral.identifier.uuidString
            device["address"] = peripheral.identifier.uuidString
            device["model"] = "unknown"
            device["rssi"] = RSSI.intValue
            
            notifyListeners("deviceFound", data: device)
        }
    }
    
    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        if !connectedDevices.contains(where: { $0.identifier == peripheral.identifier }) {
            connectedDevices.append(peripheral)
        }
        
        // Notify web view about connected device
        let device = JSObject()
        device["deviceName"] = peripheral.name ?? "Unknown Device"
        device["deviceId"] = peripheral.identifier.uuidString
        device["address"] = peripheral.identifier.uuidString
        device["model"] = "unknown"
        
        notifyListeners("deviceConnected", data: device)
    }
    
    public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        connectedDevices.removeAll { $0.identifier == peripheral.identifier }
        
        // Notify web view about disconnected device
        let device = JSObject()
        device["deviceName"] = peripheral.name ?? "Unknown Device"
        device["deviceId"] = peripheral.identifier.uuidString
        device["address"] = peripheral.identifier.uuidString
        
        notifyListeners("deviceDisconnected", data: device)
    }

    // MARK: - Plugin API
    @objc public func initialize(_ call: CAPPluginCall) {
        if self.central == nil {
            self.central = CBCentralManager(delegate: self, queue: nil)
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
        guard let central = self.central else {
            print("❌ iOS Bluetooth scan failed: Bluetooth not initialized")
            call.reject("Bluetooth not initialized")
            return
        }
        
        guard central.state == .poweredOn else {
            print("❌ iOS Bluetooth scan failed: Bluetooth is not enabled (state=\(central.state.rawValue))")
            call.reject("Bluetooth is not enabled")
            return
        }
        
        if !isScanning {
            isScanning = true
            discoveredDevices.removeAll()
            
            // Start scanning for all devices (no specific service UUIDs for now)
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
        guard let deviceId = call.getString("deviceId") else {
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
        guard let deviceId = call.getString("deviceId") else {
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
        notifyListeners("error", data: ["message": "Wellue iOS SDK not integrated yet. startBPMeasurement is a stub."], retainUntilConsumed: false)
        call.reject("Not implemented")
    }

    @objc public func startECGMeasurement(_ call: CAPPluginCall) {
        notifyListeners("error", data: ["message": "Wellue iOS SDK not integrated yet. startECGMeasurement is a stub."], retainUntilConsumed: false)
        call.reject("Not implemented")
    }

    @objc public func startRtTaskForConnectedDevice(_ call: CAPPluginCall) {
        call.resolve()
    }

    @objc public func stopMeasurement(_ call: CAPPluginCall) {
        call.resolve()
    }

    @objc public func getBatteryLevel(_ call: CAPPluginCall) {
        call.resolve(["battery": 0])
    }

    @objc public func getBondedDevices(_ call: CAPPluginCall) {
        call.resolve(["devices": []])
    }

    @objc public func getConnectedDevices(_ call: CAPPluginCall) {
        let devices = connectedDevices.map { peripheral in
            let device = JSObject()
            device["deviceName"] = peripheral.name ?? "Unknown Device"
            device["deviceId"] = peripheral.identifier.uuidString
            device["address"] = peripheral.identifier.uuidString
            device["model"] = "unknown"
            return device
        }
        
        let result = JSObject()
        result["devices"] = devices
        call.resolve(result)
    }

    @objc public func isDeviceConnected(_ call: CAPPluginCall) {
        guard let deviceId = call.getString("deviceId") else {
            call.reject("Device ID is required")
            return
        }
        
        let isConnected = connectedDevices.contains { $0.identifier.uuidString == deviceId }
        call.resolve(["connected": isConnected])
    }

    @objc public func getBp2FileList(_ call: CAPPluginCall) {
        call.resolve(["files": []])
    }

    @objc public func bp2ReadFile(_ call: CAPPluginCall) {
        call.resolve([:])
    }
}



