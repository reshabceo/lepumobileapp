import Foundation
import Capacitor
import CoreBluetooth
import VTMProductLib

@objc(WellueSDKPlugin)
public class WellueSDKPlugin: CAPPlugin, CBPeripheralDelegate {
    private enum BPCmd: UInt8 {
        case getRealPressure = 0x05
        case getRealStatus = 0x06
        case getRealWave = 0x07
        case getRealData = 0x08
        case switchState = 0x09
        case batteryInfo = 0xE4
        case deviceInfo = 0xE1
    }

    private let targetServiceUUID = CBUUID(string: "14839AC4-7D7E-415C-9A42-167340CF2339")
    private let targetNamePrefixes = ["BP2", "Wellue", "Viatom"]
    private let bluetoothQueue = DispatchQueue(label: "com.monitraq.wellue.bluetooth", qos: .userInitiated)

    private var centralManager: CBCentralManager?
    private var viatomUtils: VTMURATUtils?

    private var discoveredDevices: [UUID: CBPeripheral] = [:]
    private var currentDevice: CBPeripheral?

    private var pendingInitializeCall: CAPPluginCall?
    private var pendingConnectCall: CAPPluginCall?
    private var pendingDisconnectCall: CAPPluginCall?
    private var pendingBatteryCall: CAPPluginCall?

    private var deploymentTimer: Timer?
    private var deploymentRetryCount = 0
    private let maxDeploymentRetries = 3
    private var isSdkDeployed = false

    private var healthTimer: Timer?
    private var lastDataTimestamp: Date?
    private let healthCheckInterval: TimeInterval = 3.0
    private let dataTimeoutInterval: TimeInterval = 10.0

    private var isScanning = false
    private var scanStopTimer: Timer?

    // MARK: - Lifecycle

    public override func load() {
        super.load()
        logInfo("Plugin loaded - starting initialization")

        centralManager = CBCentralManager(delegate: self, queue: bluetoothQueue)
        viatomUtils = VTMURATUtils()
        viatomUtils?.delegate = self
        viatomUtils?.deviceDelegate = self
        viatomUtils?.notifyDeviceRSSI = true
    }

    // MARK: - Public API

    @objc public func initialize(_ call: CAPPluginCall) {
        logInfo("Initialize called from JavaScript")
        if isBluetoothReady {
            call.resolve(["success": true])
        } else {
            pendingInitializeCall = call
            logWarn("Bluetooth not powered on yet - deferring initialization")
        }
    }

    @objc public func isBluetoothEnabled(_ call: CAPPluginCall) {
        call.resolve(["enabled": isBluetoothReady])
    }

    @objc public func startScan(_ call: CAPPluginCall) {
        guard ensureBluetoothReady(for: call) else { return }

        bluetoothQueue.async {
            if self.isScanning {
                self.stopScanInternal()
            }

            self.discoveredDevices.removeAll()
            self.isScanning = true
            self.logInfo("Starting CoreBluetooth scan for Wellue devices")

            self.centralManager?.scanForPeripherals(withServices: nil, options: [
                CBCentralManagerScanOptionAllowDuplicatesKey: false
            ])

            self.scheduleScanTimeout()
            DispatchQueue.main.async {
                call.resolve(["success": true])
            }
        }
    }

    @objc public func stopScan(_ call: CAPPluginCall) {
        bluetoothQueue.async {
            self.stopScanInternal()
            DispatchQueue.main.async {
                call.resolve(["success": true])
            }
        }
    }

    @objc public func connect(_ call: CAPPluginCall) {
        guard ensureBluetoothReady(for: call) else { return }
        guard let identifier = call.getString("address") ?? call.getString("deviceId"),
              let uuid = UUID(uuidString: identifier) else {
            call.reject("Device identifier is required")
            return
        }

        bluetoothQueue.async {
            var peripheral = self.discoveredDevices[uuid]
            if peripheral == nil {
                let retrieved = self.centralManager?.retrievePeripherals(withIdentifiers: [uuid])
                peripheral = retrieved?.first
            }

            guard let target = peripheral else {
                DispatchQueue.main.async {
                    call.reject("Device not found. Please scan first.")
                }
                return
            }

            self.logInfo("Attempting to connect to device: \(target.name ?? "Unknown") (\(identifier))")
            self.pendingConnectCall = call
            self.currentDevice = target
            target.delegate = self

            self.viatomUtils?.peripheral = target
            self.centralManager?.connect(target, options: nil)
            self.triggerSDKDeployment()
        }
    }

    @objc public func disconnect(_ call: CAPPluginCall) {
        bluetoothQueue.async {
            guard let device = self.currentDevice else {
                DispatchQueue.main.async { call.resolve(["success": true]) }
                return
            }
            self.pendingDisconnectCall = call
            self.centralManager?.cancelPeripheralConnection(device)
        }
    }

    @objc public func startBPMeasurement(_ call: CAPPluginCall) {
        guard ensureSDKReady(for: call) else { return }
        viatomUtils?.requestChangeBPState(0)
        viatomUtils?.requestBPRealData()
        viatomUtils?.bp_requestRealStatus()
        notifyListeners("bpLifecycle", data: ["state": "starting"])
        call.resolve(["success": true])
    }

    @objc public func startECGMeasurement(_ call: CAPPluginCall) {
        guard ensureSDKReady(for: call) else { return }
        viatomUtils?.requestChangeBPState(1)
        call.resolve(["success": true])
        notifyListeners("ecgLifecycle", data: ["state": "start"])
    }

    @objc public func stopMeasurement(_ call: CAPPluginCall) {
        guard ensureBluetoothReady(for: call) else { return }
        viatomUtils?.requestChangeBPState(4)
        viatomUtils?.bp_requestRealStatus()
        call.resolve(["success": true])
    }

    @objc public func startRtTaskForConnectedDevice(_ call: CAPPluginCall) {
        guard ensureSDKReady(for: call) else { return }
        viatomUtils?.requestBPRealData()
        viatomUtils?.bp_requestRealStatus()
        call.resolve(["success": true])
    }

    @objc public func getBatteryLevel(_ call: CAPPluginCall) {
        guard ensureSDKReady(for: call) else { return }
        pendingBatteryCall = call
        viatomUtils?.requestBatteryInfo()
    }

    @objc public func getConnectedDevices(_ call: CAPPluginCall) {
        let devices = currentDevice.map { device -> JSObject in
            return [
                "deviceId": device.identifier.uuidString,
                "name": device.name ?? "Unknown",
                "address": device.identifier.uuidString,
                "isConnected": device.state == .connected
            ]
        }

        call.resolve(["devices": devices != nil ? [devices!] : []])
    }

    @objc public func isDeviceConnected(_ call: CAPPluginCall) {
        let connected = currentDevice?.state == .connected && isSdkDeployed
        call.resolve(["connected": connected])
    }

    @objc public func getBondedDevices(_ call: CAPPluginCall) {
        call.resolve(["devices": []])
    }

    @objc public func getBp2FileList(_ call: CAPPluginCall) {
        call.resolve(["files": []])
    }

    @objc public func bp2ReadFile(_ call: CAPPluginCall) {
        call.resolve(["fileType": 0, "fileContent": ""])
    }

    // MARK: - Helpers

    private var isBluetoothReady: Bool {
        centralManager?.state == .poweredOn
    }

    private func ensureBluetoothReady(for call: CAPPluginCall) -> Bool {
        guard isBluetoothReady else {
            call.reject("Bluetooth is not powered on")
            return false
        }
        return true
    }

    private func ensureSDKReady(for call: CAPPluginCall) -> Bool {
        guard ensureBluetoothReady(for: call) else { return false }
        guard isSdkDeployed else {
            call.reject("SDK not ready yet. Please wait for deployment to finish.")
            return false
        }
        guard currentDevice?.state == .connected else {
            call.reject("Device is not connected")
            return false
        }
        return true
    }

    private func stopScanInternal() {
        guard isScanning else { return }
        scanStopTimer?.invalidate()
        scanStopTimer = nil
        isScanning = false
        centralManager?.stopScan()
        logInfo("Stopped CoreBluetooth scan")
    }

    private func scheduleScanTimeout() {
        scanStopTimer?.invalidate()
        scanStopTimer = Timer.scheduledTimer(withTimeInterval: 15.0, repeats: false) { [weak self] _ in
            self?.bluetoothQueue.async {
                self?.stopScanInternal()
            }
        }
    }

    private func triggerSDKDeployment() {
        bluetoothQueue.async {
            self.isSdkDeployed = false
            self.deploymentTimer?.invalidate()
            self.deploymentTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: false) { [weak self] _ in
                guard let self else { return }
                if !self.isSdkDeployed {
                    self.logWarn("SDK deployment timeout")
                    if self.deploymentRetryCount < self.maxDeploymentRetries {
                        self.deploymentRetryCount += 1
                        self.logWarn("Retrying SDK deployment (\(self.deploymentRetryCount)/\(self.maxDeploymentRetries))")
                        if let device = self.currentDevice {
                            self.viatomUtils?.peripheral = device
                        }
                        self.triggerSDKDeployment()
                    } else {
                        self.notifyListeners("sdkDeploymentFailed", data: ["error": "Deployment timeout"])
                        self.pendingConnectCall?.reject("SDK deployment failed")
                        self.pendingConnectCall = nil
                    }
                }
            }
        }
    }

    private func startHealthMonitoring() {
        healthTimer?.invalidate()
        lastDataTimestamp = Date()
        healthTimer = Timer.scheduledTimer(withTimeInterval: healthCheckInterval, repeats: true) { [weak self] _ in
            self?.performHealthCheck()
        }
    }

    private func performHealthCheck() {
        guard isSdkDeployed, let lastData = lastDataTimestamp else { return }
        let delta = Date().timeIntervalSince(lastData)
        if delta > dataTimeoutInterval {
            logWarn("SDK health check timeout detected (\(Int(delta))s without data)")
            notifyListeners("sdkHealthWarning", data: ["timeSinceLastData": delta])
            triggerSDKDeployment()
        }
    }

    private func markDataReceived() {
        lastDataTimestamp = Date()
    }

    private func handleStatusUpdate(_ status: VTMBPRunStatus) {
        var statusPayload = JSObject()
        statusPayload["deviceId"] = currentDevice?.identifier.uuidString
        statusPayload["status"] = Int(status.status)
        statusPayload["batteryPercent"] = Int(status.battery.percent)
        statusPayload["batteryState"] = Int(status.battery.state)
        notifyListeners("bp2Rt", data: statusPayload)

        let lifecycleState: String
        switch status.status {
        case 3:
            lifecycleState = "ready"
        case 4:
            lifecycleState = "measuring"
        case 5:
            lifecycleState = "complete"
        default:
            lifecycleState = "idle"
        }

        notifyListeners("bpLifecycle", data: ["state": lifecycleState])
    }

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

    private func emitECGMeasuring(_ data: VTMECGMeasuringData) {
        var payload = JSObject()
        payload["deviceId"] = currentDevice?.identifier.uuidString
        payload["heartRate"] = Int(data.pulse_rate)
        payload["duration"] = Int(data.duration)
        payload["weakSignal"] = (data.special_status & 0x1) == 0x1
        payload["leadOff"] = (data.special_status & 0x2) == 0x2
        payload["timestamp"] = Date().timeIntervalSince1970 * 1000
        notifyListeners("ecgData", data: payload)
    }

    private func emitECGEnd(_ data: VTMECGEndMeasureData) {
        var payload = JSObject()
        payload["deviceId"] = currentDevice?.identifier.uuidString
        payload["heartRate"] = Int(data.hr)
        payload["result"] = Int(data.result)
        payload["qrs"] = Int(data.qrs)
        payload["pvcs"] = Int(data.pvcs)
        payload["qtc"] = Int(data.qtc)
        notifyListeners("ecgData", data: payload)
        notifyListeners("ecgLifecycle", data: ["state": "stop"])
    }

    private func notifyBluetoothState(_ state: CBManagerState) {
        let enabled = state == .poweredOn
        notifyListeners("bluetoothStatusChanged", data: ["enabled": enabled])
        if enabled, let initCall = pendingInitializeCall {
            initCall.resolve(["success": true])
            pendingInitializeCall = nil
        }
    }

    private func logInfo(_ message: String) {
        NSLog("🔵 [WELLUE SDK] \(message)")
    }

    private func logWarn(_ message: String) {
        NSLog("⚠️ [WELLUE SDK] \(message)")
    }

    private func logError(_ message: String) {
        NSLog("❌ [WELLUE SDK] \(message)")
    }
}

// MARK: - CBCentralManagerDelegate

extension WellueSDKPlugin: CBCentralManagerDelegate {
    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        bluetoothQueue.async {
            switch central.state {
            case .poweredOn:
                self.logInfo("Bluetooth state changed: poweredOn")
            case .poweredOff:
                self.logWarn("Bluetooth state changed: poweredOff")
                self.stopScanInternal()
                self.isSdkDeployed = false
            case .unauthorized:
                self.logWarn("Bluetooth state unauthorized")
            case .unsupported:
                self.logError("Bluetooth unsupported on this device")
            case .resetting:
                self.logWarn("Bluetooth resetting")
            case .unknown:
                fallthrough
            @unknown default:
                self.logWarn("Bluetooth state unknown")
            }

            DispatchQueue.main.async {
                self.notifyBluetoothState(central.state)
            }
        }
    }

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

    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        bluetoothQueue.async {
            self.logInfo("Connected to peripheral: \(peripheral.name ?? "Unknown")")
            self.viatomUtils?.peripheral = peripheral
            self.currentDevice = peripheral
            self.deploymentRetryCount = 0

            var payload = JSObject()
            payload["deviceId"] = peripheral.identifier.uuidString
            payload["deviceName"] = peripheral.name ?? "Unknown"
            payload["connected"] = true
            payload["address"] = peripheral.identifier.uuidString
            self.notifyListeners("deviceConnected", data: payload)
        }
    }

    public func centralManager(_ central: CBCentralManager,
                               didFailToConnect peripheral: CBPeripheral,
                               error: Error?) {
        bluetoothQueue.async {
            self.logError("Failed to connect to device: \(error?.localizedDescription ?? "unknown error")")
            self.pendingConnectCall?.reject("Connection failed: \(error?.localizedDescription ?? "Unknown error")")
            self.pendingConnectCall = nil
        }
    }

    public func centralManager(_ central: CBCentralManager,
                               didDisconnectPeripheral peripheral: CBPeripheral,
                               error: Error?) {
        bluetoothQueue.async {
            self.logWarn("Disconnected from device: \(peripheral.name ?? "Unknown") - \(error?.localizedDescription ?? "normal")")
            self.isSdkDeployed = false
            self.currentDevice = nil
            self.healthTimer?.invalidate()
            self.deploymentTimer?.invalidate()

            var payload = JSObject()
            payload["deviceId"] = peripheral.identifier.uuidString
            payload["address"] = peripheral.identifier.uuidString
            payload["deviceName"] = peripheral.name ?? "Unknown"
            payload["error"] = error?.localizedDescription
            self.notifyListeners("deviceDisconnected", data: payload)

            self.pendingDisconnectCall?.resolve(["success": true])
            self.pendingDisconnectCall = nil
        }
    }
}

// MARK: - VTMURATDeviceDelegate & VTMURATUtilsDelegate

extension WellueSDKPlugin: VTMURATDeviceDelegate, VTMURATUtilsDelegate {
    public func utilDeployCompletion(_ util: VTMURATUtils) {
        bluetoothQueue.async {
            self.logInfo("SDK deployment completed successfully")
            self.deploymentTimer?.invalidate()
            self.deploymentRetryCount = 0
            self.isSdkDeployed = true
            self.markDataReceived()
            self.startHealthMonitoring()

            self.viatomUtils?.requestBPRealData()
            self.viatomUtils?.bp_requestRealStatus()
            self.viatomUtils?.requestDeviceInfo()

            if let call = self.pendingConnectCall {
                var payload = JSObject()
                payload["deviceId"] = self.currentDevice?.identifier.uuidString
                payload["deviceName"] = self.currentDevice?.name ?? "Unknown"
                payload["connected"] = true
                call.resolve(payload)
                self.pendingConnectCall = nil
            }
        }
    }

    public func utilDeployFailed(_ util: VTMURATUtils) {
        bluetoothQueue.async {
            self.logError("SDK deployment failed")
            self.isSdkDeployed = false
            self.pendingConnectCall?.reject("SDK deployment failed")
            self.pendingConnectCall = nil
            self.notifyListeners("sdkDeploymentFailed", data: ["error": "Deployment failed"])
        }
    }

    public func util(_ util: VTMURATUtils, updateDeviceRSSI RSSI: NSNumber) {
        notifyListeners("deviceRSSI", data: [
            "deviceId": currentDevice?.identifier.uuidString ?? "",
            "rssi": RSSI.intValue
        ])
    }

    public func util(_ util: VTMURATUtils,
                     commandSendFailed errorCode: UInt8) {
        var message = "Unknown"
        switch errorCode {
        case 0: message = "Peripheral unavailable"
        case 1: message = "Write characteristic unavailable"
        case 2: message = "Peripheral not connected"
        case 3: message = "Command timeout"
        default: break
        }
        logError("Command send failed: \(message)")
        notifyListeners("commandError", data: ["error": message])
    }

    public func util(_ util: VTMURATUtils,
                     commandFailed cmdType: UInt8,
                     deviceType: VTMDeviceType,
                     failedType: VTMBLEPkgType) {
        logError("Command 0x\(String(format: "%02X", cmdType)) failed with type \(failedType.rawValue)")
        notifyListeners("commandError", data: [
            "cmdType": Int(cmdType),
            "error": failedType.rawValue
        ])
    }

    public func util(_ util: VTMURATUtils,
                     commandCompletion cmdType: UInt8,
                     deviceType: VTMDeviceType,
                     response: Data?) {
        markDataReceived()
        guard let response else { return }
        switch cmdType {
        case BPCmd.getRealStatus.rawValue:
            let status = VTMBLEParser.parseBPRealTimeStatus(response)
            handleStatusUpdate(status)
        case BPCmd.getRealData.rawValue:
            let measuring = VTMBLEParser.parseBPMeasuring(response)
            emitBPMeasuringData(measuring)
        case BPCmd.getRealPressure.rawValue:
            let pressure = VTMBLEParser.parseBPRealTimePressure(response)
            notifyListeners("bp2Rt", data: [
                "deviceId": currentDevice?.identifier.uuidString ?? "",
                "pressure": Int(pressure.pressure)
            ])
        case BPCmd.deviceInfo.rawValue:
            let info = VTMBLEParser.parseDeviceInfo(response)
            notifyListeners("deviceInfo", data: [
                "deviceId": currentDevice?.identifier.uuidString ?? "",
                "hardwareVersion": Int(info.hw_version),
                "firmwareVersion": Int(info.fw_version),
                "bootloaderVersion": Int(info.bl_version),
                "deviceType": Int(info.device_type),
                "protocolVersion": Int(info.protocol_version)
            ])
        case BPCmd.batteryInfo.rawValue:
            let battery = VTMBLEParser.parseBatteryInfo(response)
            let level = Int(battery.percent)
            notifyListeners("batteryUpdate", data: [
                "deviceId": currentDevice?.identifier.uuidString ?? "",
                "battery": level
            ])
            pendingBatteryCall?.resolve(["batteryLevel": level])
            pendingBatteryCall = nil
        default:
            break
        }
    }

    public func bpRealData(_ realData: VTMBPRealTimeData) {
        markDataReceived()
        handleStatusUpdate(realData.run_status)

        var waveform = realData.rt_wav
        let data = withUnsafeBytes(of: &waveform.data) { Data($0) }

        switch waveform.type {
        case 0:
            let measuring = VTMBLEParser.parseBPMeasuring(data)
            emitBPMeasuringData(measuring)
        case 1:
            let end = VTMBLEParser.parseBPEndMeasure(data)
            emitBPEndData(end)
        case 2:
            let ecg = VTMBLEParser.parseECGMeasuring(data)
            emitECGMeasuring(ecg)
        case 3:
            let ecgEnd = VTMBLEParser.parseECGEndMeasure(data)
            emitECGEnd(ecgEnd)
        default:
            break
        }
    }

    public func bpMeasurementResult(_ result: VTMBPEndMeasureData) {
        emitBPEndData(result)
    }
}

