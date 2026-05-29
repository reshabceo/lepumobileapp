import Capacitor
import AliveCorKitLite
import CoreBluetooth

@objc(AliveCorSDK)
public class AliveCorSDK: CAPPlugin, CAPBridgedPlugin, ACKEcgMonitorDelegate {
    public let identifier = "AliveCorSDK"
    public let jsName = "AliveCorSDK"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startSixLeadRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getDeviceStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startScan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopScan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "dispose", returnType: CAPPluginReturnPromise),
    ]

    private var isInitialized = false
    private var lastBatteryLevel: Int = -1
    private var centralManager: CBCentralManager?
    private var isScanning = false

    /// Pending plugin call resolved when recording completes.
    private var pendingRecordCall: CAPPluginCall?

    /// Accumulated ECG samples captured per-lead during recording.
    /// Index: lead index (0=I, 1=II, 2=III, 3=aVR, 4=aVL, 5=aVF)
    private var capturedLeadSamples: [[Double]] = Array(repeating: [], count: 6)

    // AliveCor SDK records at a fixed 300 Hz sample rate.
    private let sampleRate: Int = 300

    // MARK: - initialize

    @objc func initialize(_ call: CAPPluginCall) {
        guard let jwt = call.getString("jwt") else {
            call.reject("jwt is required")
            return
        }
        let debugMode = call.getBool("isDebugMode") ?? false
        let appName = call.getString("appName") ?? "Monitraq Mobile"

        ACKManager.initWithApiKey(jwt, isDebugMode: debugMode, appName: appName) { [weak self] error, config in
            DispatchQueue.main.async {
                if let error = error {
                    print("[AliveCorSDK] Init error: \(error.localizedDescription)")
                    call.reject("AliveCor SDK init error: \(error.localizedDescription)")
                    return
                }
                self?.isInitialized = true
                print("[AliveCorSDK] SDK initialized successfully")
                call.resolve()
            }
        }
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        call.resolve([
            "bluetooth": "granted",
            "audio": "granted"
        ])
    }

    // MARK: - startSixLeadRecording (mirrors Android API name)

    @objc func startSixLeadRecording(_ call: CAPPluginCall) {
        startRecordingInternal(call, leadsConfig: .six)
    }

    @objc func startRecording(_ call: CAPPluginCall) {
        let leadConfigStr = call.getString("leadConfig") ?? "six"
        let leadsConfig: ACKLeadsConfig = leadConfigStr == "single" ? .single : .six
        startRecordingInternal(call, leadsConfig: leadsConfig)
    }

    private func startRecordingInternal(_ call: CAPPluginCall, leadsConfig: ACKLeadsConfig) {
        // If SDK not yet initialized, try to initialize first
        if !isInitialized {
            guard let jwt = call.getString("jwt") else {
                call.reject("SDK not initialized. Pass jwt to initialize.")
                return
            }
            let debugMode = call.getBool("isDebugMode") ?? false
            let appName = call.getString("appName") ?? "Monitraq Mobile"

            ACKManager.initWithApiKey(jwt, isDebugMode: debugMode, appName: appName) { [weak self] error, _ in
                DispatchQueue.main.async {
                    if let error = error {
                        call.reject("SDK init failed: \(error.localizedDescription)")
                        return
                    }
                    self?.isInitialized = true
                    self?.launchRecordingUI(call, leadsConfig: leadsConfig)
                }
            }
        } else {
            launchRecordingUI(call, leadsConfig: leadsConfig)
        }
    }

    private func launchRecordingUI(_ call: CAPPluginCall, leadsConfig: ACKLeadsConfig) {
        guard let bridge = self.bridge,
              let viewController = bridge.viewController else {
            call.reject("Unable to access view controller")
            return
        }

        let maxDuration = call.getInt("durationSeconds") ?? 30
        let mainsFilter = call.getInt("mainsFilter") ?? 50
        let frequency: NSInteger = mainsFilter == 60 ? 60 : 50
        let algorithmPackage = ACKManager.sharedInstance().algorithmPackageForCurrentKAI()

        // Reset captured samples
        capturedLeadSamples = Array(repeating: [], count: 6)
        pendingRecordCall = call

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            var configError: ACKError?
            guard let recordingConfig = ACKEcgRecordingConfig(
                deviceType: .triangle,
                leadsConfig: leadsConfig,
                filterType: .enhanced,
                maxDuration: maxDuration,
                frequency: frequency,
                algorithmPackage: algorithmPackage,
                error: &configError
            ) else {
                let errMsg = configError?.localizedDescription ?? "unknown"
                print("[AliveCorSDK] Config error: \(errMsg)")
                call.reject("Recording config error: \(errMsg)")
                self.pendingRecordCall = nil
                return
            }

            guard let monitorVC = ACKEcgMonitorViewController(config: recordingConfig, delegate: self) else {
                call.reject("Failed to create ECG monitor view controller")
                self.pendingRecordCall = nil
                return
            }

            let navController = UINavigationController(rootViewController: monitorVC)
            navController.modalPresentationStyle = .fullScreen
            viewController.present(navController, animated: true, completion: nil)
        }
    }

    // MARK: - ACKEcgMonitorDelegate

    private func extractWaveformFromAtc(atcPath: String) -> [String: [Double]] {
        var leads: [String: [Double]] = [:]
        guard let file = ECGFile.openedEcgFile(withAtcPath: atcPath) as ECGFile? else {
            print("[AliveCorSDK] Failed to open ATC file: \(atcPath)")
            return leads
        }
        
        let totalSamples = Int(file.totalSamples)
        guard totalSamples > 0 else {
            file.close()
            return leads
        }
        
        let leadNames = ["I", "II", "III", "aVR", "aVL", "aVF"]
        let leadTypes: [ECGFileLead] = [kECGFileLead1, kECGFileLead2, kECGFileLead3, kECGFileLead4, kECGFileLead5, kECGFileLead6]
        
        var scale: Double = 0.00284
        if file.aliveFileFormat != nil {
            scale = Double(file.aliveFileFormat.pointee.resolution_nV) / 1_000_000.0
            print("[AliveCorSDK] ATC resolution_nV: \(file.aliveFileFormat.pointee.resolution_nV), scale: \(scale)")
        } else {
            print("[AliveCorSDK] Warning: aliveFileFormat is nil, using default scale: \(scale)")
        }
        
        for (i, name) in leadNames.enumerated() {
            var buffer = [Int16](repeating: 0, count: totalSamples)
            let readCount = file.readSamples(&buffer, fromSample: 0, length: UInt(totalSamples), for: leadTypes[i])
            if readCount > 0 {
                leads[name] = buffer.map { Double($0) * scale }
            }
        }
        
        file.close()
        return leads
    }

    public func ecgMonitorViewController(
        _ viewController: ACKEcgMonitorViewController,
        didCompleteRecording record: ACKEcgRecord?
    ) {
        DispatchQueue.main.async {
            viewController.dismiss(animated: true, completion: nil)
        }

        guard let call = pendingRecordCall else { return }
        pendingRecordCall = nil

        guard let record = record else {
            call.reject("Recording cancelled or failed")
            return
        }

        let evaluation = record.evaluation
        let durationMs = record.duration?.doubleValue ?? 0
        let durationSec = durationMs / 1000.0

        let leadsConfigStr = record.config.leadsConfig == .six ? "six" : "single"
        let deviceName = record.device?.deviceName ?? "KardiaMobile 6L"
        let hr = evaluation?.averageHeartRate ?? 0
        let determination = evaluation?.determination.rawValue ?? "NO_ANALYSIS"
        let modifier = evaluation?.modifier.rawValue ?? "NONE"
        let algPackage = evaluation?.algorithmPackage ?? "KAIv1"
        let isInverted = evaluation?.isInverted ?? false

        // Extract high-quality waveform data directly from the saved ATC file
        var waveformLeads: [String: [Double]] = [:]
        var flatMvData: [Double] = []
        
        let path = record.enhancedPath ?? record.originalPath
        if let path = path, !path.isEmpty {
            print("[AliveCorSDK] Parsing waveform from ATC file at: \(path)")
            waveformLeads = extractWaveformFromAtc(atcPath: path)
        }
        
        // Fallback to accumulated real-time samples if ATC parsing fails/is empty
        if waveformLeads.isEmpty {
            print("[AliveCorSDK] ATC waveform parsing empty, falling back to accumulated real-time preview samples.")
            let leadNames = ["I", "II", "III", "aVR", "aVL", "aVF"]
            let isMultiLead = record.config.leadsConfig == .six
            if isMultiLead {
                for (i, samples) in capturedLeadSamples.enumerated() {
                    if i < leadNames.count && !samples.isEmpty {
                        waveformLeads[leadNames[i]] = samples
                    }
                }
            } else {
                flatMvData = capturedLeadSamples[0]
            }
        } else {
            // For single lead, populate flatMvData
            if record.config.leadsConfig == .single {
                flatMvData = waveformLeads["I"] ?? []
            }
        }

        let serial = record.device?.serialNumber ?? "2025102328492"
        var batteryLevel: Double = Double(lastBatteryLevel)
        if let devBattery = record.device?.batteryLevel {
            batteryLevel = Double(devBattery)
        }

        // Save last paired device ID and battery when recording successfully completes!
        UserDefaults.standard.set(serial, forKey: "paired_device_id")
        if batteryLevel > 0 {
            UserDefaults.standard.set(batteryLevel, forKey: "last_battery")
        }

        print("[AliveCorSDK] Recording complete. HR=\(hr), determination=\(determination), duration=\(durationSec)s")

        var response: [String: Any] = [
            "success": true,
            "mvData": flatMvData,
            "sampleRate": sampleRate,
            "durationSeconds": durationSec,
            "heartRate": hr,
            "diagnosisText": mapDiagnosisText(determination),
            "determination": determination,
            "modifier": modifier,
            "algorithmPackage": algPackage,
            "leadConfig": leadsConfigStr,
            "deviceType": deviceName,
            "isInverted": isInverted,
            "serialNumber": serial,
            "batteryLevel": batteryLevel,
        ]

        if !waveformLeads.isEmpty {
            response["waveformLeads"] = waveformLeads
        }

        call.resolve(response as PluginCallResultData)
    }

    public func ecgMonitorViewController(
        _ viewController: ACKEcgMonitorViewController,
        didCancelWithError error: ACKError?
    ) {
        DispatchQueue.main.async {
            viewController.dismiss(animated: true, completion: nil)
        }
        if let call = pendingRecordCall {
            pendingRecordCall = nil
            if let error = error {
                call.reject("Recording cancelled: \(error.localizedDescription)")
            } else {
                call.reject("Recording cancelled by user")
            }
        }
    }

    public func ecgMonitorViewController(
        _ viewController: ACKEcgMonitorViewController,
        didConnectWith device: ACKDevice,
        continueWithRecording continueHandler: @escaping (Bool) -> Void
    ) {
        print("[AliveCorSDK] Connected with device: \(device.deviceName ?? "Unknown")")
        continueHandler(true)
    }

    public func ecgMonitorViewController(
        _ viewController: ACKEcgMonitorViewController,
        connectedDevice: ACKDevice,
        batteryLevelDetected batteryLevel: NSInteger
    ) {
        print("[AliveCorSDK] Battery level detected: \(batteryLevel)%")
        self.lastBatteryLevel = batteryLevel
        UserDefaults.standard.set(Double(batteryLevel), forKey: "last_battery")
    }

    /// Real-time ECG frame callback — accumulate samples per lead.
    /// ECGFrame struct has named fields: lead1, lead2, lead3, aVR, aVL, aVF
    public func ecgMonitorViewController(
        _ viewController: ACKEcgMonitorViewController,
        didReceive ecgFrame: ECGFrame
    ) {
        // ECGFrame is a C struct with 6 named SInt16 fields.
        // Accumulate each lead sample converting from raw SInt16 ADC to mV
        // AliveCor SDK resolution: 1 LSB = ~4.88 µV → divide by 204.8 to get mV
        let scale: Double = 1.0 / 204.8
        capturedLeadSamples[0].append(Double(ecgFrame.lead1) * scale)
        capturedLeadSamples[1].append(Double(ecgFrame.lead2) * scale)
        capturedLeadSamples[2].append(Double(ecgFrame.lead3) * scale)
        capturedLeadSamples[3].append(Double(ecgFrame.aVR) * scale)
        capturedLeadSamples[4].append(Double(ecgFrame.aVL) * scale)
        capturedLeadSamples[5].append(Double(ecgFrame.aVF) * scale)
    }

    public func ecgMonitorViewController(
        _ viewController: ACKEcgMonitorViewController,
        didEncounterError error: ACKError?
    ) {
        if let error = error {
            print("[AliveCorSDK] Recording error: \(error.localizedDescription)")
        }
    }

    public func ecgMonitorViewController(
        _ viewController: ACKEcgMonitorViewController,
        didEncounterAudioError error: ACKError?
    ) {
        // Audio errors happen with ultrasound devices (KardiaMobile original)
        DispatchQueue.main.async {
            viewController.dismiss(animated: true, completion: nil)
        }
        if let call = pendingRecordCall {
            pendingRecordCall = nil
            call.reject("Audio error: \(error?.localizedDescription ?? "microphone unavailable")")
        }
    }

    public func showCancelButton(in viewController: ACKEcgMonitorViewController) -> Bool {
        return true
    }

    public func showSettingsButton(in viewController: ACKEcgMonitorViewController) -> Bool {
        return false
    }

    public func ecgMonitorViewControllerShouldEnableLeadModeSwitch(
        _ viewController: ACKEcgMonitorViewController
    ) -> Bool {
        return false
    }

    public func availableDeviceTypes(_ viewController: ACKEcgMonitorViewController) -> [ACKDeviceType] {
        return ACKManager.sharedInstance().supportedDevices
    }

    // MARK: - getDeviceStatus

    @objc func getDeviceStatus(_ call: CAPPluginCall) {
        let pairedId = UserDefaults.standard.string(forKey: "paired_device_id")
        let hasPaired = pairedId != nil
        let battery = UserDefaults.standard.double(forKey: "last_battery")
        
        var result: [String: Any] = [
            "connected": hasPaired,
            "ready": true,
            "deviceName": hasPaired ? "KardiaMobile 6L" : "",
            "deviceId": pairedId ?? "",
            "bluetoothEnabled": true,
            "statusText": hasPaired ? "Connected" : "Ready to Pair"
        ]
        
        if battery > 0 {
            result["batteryLevel"] = battery
        } else if lastBatteryLevel >= 0 {
            result["batteryLevel"] = lastBatteryLevel
        }
        
        call.resolve(result as PluginCallResultData)
    }

    // MARK: - startScan / stopScan / connect (stubs — iOS uses SDK-internal BLE)

    @objc func startScan(_ call: CAPPluginCall) {
        if centralManager == nil {
            centralManager = CBCentralManager(delegate: self, queue: nil)
        }
        isScanning = true
        let state = centralManager?.state
        print("[AliveCorSDK] startScan called. Central manager state: \(state?.rawValue ?? -1)")
        if state == .poweredOn {
            centralManager?.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
            print("[AliveCorSDK] Started BLE scanning immediately")
        }
        call.resolve()
    }

    @objc func stopScan(_ call: CAPPluginCall) {
        print("[AliveCorSDK] stopScan called")
        isScanning = false
        centralManager?.stopScan()
        centralManager = nil
        call.resolve()
    }

    @objc func connect(_ call: CAPPluginCall) {
        guard let deviceId = call.getString("deviceId") else {
            call.reject("Device ID is required")
            return
        }
        
        UserDefaults.standard.set(deviceId, forKey: "paired_device_id")
        
        let result: [String: Any] = [
            "success": true,
            "deviceId": deviceId,
            "deviceName": "KardiaMobile 6L"
        ]
        notifyListeners("deviceConnected", data: result)
        call.resolve(result as PluginCallResultData)
    }

    // MARK: - dispose

    @objc func dispose(_ call: CAPPluginCall) {
        isInitialized = false
        pendingRecordCall = nil
        capturedLeadSamples = Array(repeating: [], count: 6)
        isScanning = false
        centralManager?.stopScan()
        centralManager = nil
        call.resolve()
    }
}

extension AliveCorSDK: CBCentralManagerDelegate {
    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        print("[AliveCorSDK] centralManagerDidUpdateState: \(central.state.rawValue)")
        if central.state == .poweredOn && isScanning {
            central.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
            print("[AliveCorSDK] Started BLE scanning in didUpdateState")
        }
    }
    
    public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi: NSNumber) {
        let name = peripheral.name ?? advertisementData[CBAdvertisementDataLocalNameKey] as? String ?? ""
        let lowerName = name.lowercased()
        if lowerName.contains("kardia") || lowerName.contains("k6l") || lowerName.contains("alivecor") || lowerName.contains("ac-") || lowerName.contains("ac_") {
            let deviceId = peripheral.identifier.uuidString
            print("[AliveCorSDK] BLE Discovered matching device: \(name) (\(deviceId))")
            notifyListeners("deviceFound", data: [
                "deviceName": name.isEmpty ? "KardiaMobile 6L" : name,
                "deviceId": deviceId,
                "rssi": rssi.intValue
            ])
        }
    }

    // MARK: - Helpers

    private func mapDiagnosisText(_ determination: String) -> String {
        let upper = determination.uppercased()
        if upper.contains("NORMAL") || upper.contains("NSR") || upper.contains("SINUS") {
            return "Normal Sinus Rhythm"
        } else if upper.contains("AFIB") || upper.contains("ATRIAL_FIBRILLATION") {
            return "Atrial Fibrillation"
        } else if upper.contains("BRADY") {
            return "Bradycardia"
        } else if upper.contains("TACHY") {
            return "Tachycardia"
        } else if upper.contains("UNREAD") {
            return "Unreadable"
        } else {
            return determination.replacingOccurrences(of: "_", with: " ")
        }
    }
}
