import Foundation
import Capacitor
import CoreBluetooth
import VTMProductLib

@objc(WellueSDK)
public class WellueSDK: CAPPlugin, CBPeripheralDelegate {
    private enum BPCmd: UInt8 {
        case getRealPressure = 0x05
        case getRealStatus = 0x06
        case getRealWave = 0x07
        case getRealData = 0x08
        case switchState = 0x09
        case batteryInfo = 0xE4
        case deviceInfo = 0xE1
        // File protocol commands (Viatom File Parse Protocol)
        case getFileList = 0xF1
        case readFileStart = 0xF2
        case readFileContent = 0xF3
        case readFileEnd = 0xF4
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
    // SIMPLIFIED: Single status polling timer
    private var statusPollingTimer: Timer?
    private let idlePollingInterval: TimeInterval = 1.0 // Fast polling when idle (1s)
    private let measuringPollingInterval: TimeInterval = 3.0 // SLOW polling during measurement (3s) - prevents device overload
    
    // Simple measurement tracking
    private var previousStatus: UInt8 = 0
    private var justCompletedMeasurement: Bool = false
    private var measurementCompletionTime: Date?
    private var isMeasuring = false
    private var measurementStartTime: Date?
    private let measurementTimeout: TimeInterval = 60.0 // Force completion after 60 seconds
    private var isCurrentlyDeflating = false // ✅ Track deflation state to suppress status 3 events
    
    // File reading state
    private var downloadingFileName: String?
    private var downloadData: NSMutableData?
    private var expectedFileLength: UInt32 = 0
    private var fileReadAttempts = 0
    private let maxFileReadAttempts = 3
    private var isFileReadInProgress = false // ✅ Prevent multiple file reads
    private var hasCompletedCurrentMeasurement = false // ✅ Prevent duplicate completeMeasurement calls

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
        logInfo("🚀 [STATUS POLLING] Starting simple status monitoring")
        
        // ✅ FIX 6: If SDK not ready, trigger deployment and retry
        guard ensureBluetoothReady(for: call) else {
            logError("❌ [STATUS POLLING] Bluetooth not ready")
            return
        }
        
        guard currentDevice?.state == .connected else {
            call.reject("Device is not connected")
            return
        }
        
        // ✅ FIX 6: If SDK not deployed, trigger deployment first
        if !isSdkDeployed {
            logWarn("⚠️ [STATUS POLLING] SDK not deployed yet - triggering deployment...")
            if let device = currentDevice {
                viatomUtils?.peripheral = device
                triggerSDKDeployment()
            }
            
            // Wait for SDK deployment with retry
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
                guard let self = self else { return }
                if self.isSdkDeployed {
                    self.logInfo("✅ [STATUS POLLING] SDK deployed, starting polling")
                    self.statusPollingTimer?.invalidate()
                    self.startStatusPolling()
                    call.resolve(["success": true])
                } else {
                    self.logError("❌ [STATUS POLLING] SDK deployment timeout - rejecting call")
                    call.reject("SDK deployment timeout. Please ensure device is connected.")
                }
            }
            return
        }
        
        // Stop any existing timer
        statusPollingTimer?.invalidate()
        
        // Start simple status polling (1 second interval)
        startStatusPolling()
        
        call.resolve(["success": true])
        logInfo("✅ [STATUS POLLING] Status monitoring started (1s interval)")
    }
    
    // SIMPLIFIED: Just poll status every 1 second
    private func stopStatusPolling() {
        logInfo("🛑 [STATUS POLLING] Stopping")
        DispatchQueue.main.async { [weak self] in
            self?.statusPollingTimer?.invalidate()
            self?.statusPollingTimer = nil
        }
    }
    
    private func startStatusPolling() {
        // Use slow interval during measurement to prevent device overload!
        let interval = isMeasuring ? measuringPollingInterval : idlePollingInterval
        logInfo("✅ [STATUS POLLING] Starting (interval: \(interval)s, measuring: \(isMeasuring))")
        
        // Request initial data immediately (use getRealData to get full state)
        bluetoothQueue.async { [weak self] in
            guard let self = self else { return }
            self.logInfo("📡 [INITIAL] Requesting initial data...")
            
            // Diagnostic checks
            guard let utils = self.viatomUtils else {
                self.logError("❌ [INITIAL] viatomUtils is nil!")
                return
            }
            
            // Use getRealData initially to get full device state (pressure + status)
            utils.requestBPRealData()
            self.logInfo("📡 [INITIAL] requestBPRealData() called")
        }
        
        // Create timer on main thread with appropriate interval
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            self.logInfo("⏱️ [TIMER] Creating status polling timer...")
            
            self.statusPollingTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] timer in
                guard let self = self else {
                    timer.invalidate()
                return
            }
                
                self.logInfo("⏱️ [TIMER] 🔔 Timer fired - requesting data...")
                
                // Request data on bluetooth queue
            self.bluetoothQueue.async {
                    // Diagnostic checks
                    guard let utils = self.viatomUtils else {
                        self.logError("❌ [TIMER] viatomUtils is nil!")
                        return
                    }
                    if utils.peripheral.state != .connected {
                        self.logError("❌ [TIMER] peripheral not connected (state: \(utils.peripheral.state.rawValue))")
                        return
                    }
                    
                    // ONLY request BP data during measurement - no other commands to avoid overload!
                    if self.isMeasuring {
                        self.logInfo("📡 [TIMER] Calling requestBPRealData() (3s interval)...")
                self.viatomUtils?.requestBPRealData()
                        self.logInfo("📡 [TIMER] requestBPRealData() sent")
                    } else {
                        self.logInfo("📡 [TIMER] Calling bp_requestRealStatus() (1s interval)...")
                        self.viatomUtils?.bp_requestRealStatus()
                        self.logInfo("📡 [TIMER] bp_requestRealStatus() sent")
                    }
                }
            }
            
            // Add to run loop
            if let timer = self.statusPollingTimer {
                RunLoop.main.add(timer, forMode: .common)
                self.logInfo("✅ [TIMER] Timer created and added to run loop (interval: \(interval)s)")
            } else {
                self.logError("❌ [TIMER] Failed to create timer!")
            }
        }
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

    // SIMPLIFIED: Clean status-based detection
    private func handleStatusUpdate(_ status: VTMBPRunStatus) {
        logInfo("📊 [HANDLE STATUS] handleStatusUpdate called with status: \(status.status), isMeasuring: \(isMeasuring), previousStatus: \(previousStatus), hasCompleted: \(hasCompletedCurrentMeasurement)")
        
        // ✅ CRITICAL FIX: Check if we should suppress status 3 (ready) events
        var shouldSuppressReadyEvent = false
        var shouldEmitStatus = true
        
        // ✅ FIX: Check if status 5 should be suppressed (already completed)
        if status.status == 5 && hasCompletedCurrentMeasurement {
            logInfo("⚠️ [SUPPRESS STATUS] Status 5 already processed - suppressing status emission to prevent UI reset")
            shouldEmitStatus = false
        }
        
        // Check if this is a spurious status 3 during measurement
        if status.status == 3 {
            logInfo("🔍 [STATUS 3 CHECK] Status 3 detected - isMeasuring: \(isMeasuring), previousStatus: \(previousStatus), hasCompleted: \(hasCompletedCurrentMeasurement), isDeflating: \(isCurrentlyDeflating)")
            
            // ✅ SIMPLE & ROBUST FIX: Ignore ALL status 3 while measurement is in progress
            // Once measurement starts (status 4), ignore status 3 until results are obtained (status 5 + file read)
            if isMeasuring {
                // Measurement is in progress - suppress ALL status 3 events until results are shown
                logInfo("⚠️ [SUPPRESS] Status 3 received during measurement (isMeasuring=true) - ignoring throughout entire measurement until results shown")
                shouldSuppressReadyEvent = true
                shouldEmitStatus = false
            } else if previousStatus == 4 {
                // We were just in status 4 (measuring) - suppress status 3 to prevent UI reset
                // This covers edge cases where isMeasuring might be false but we just finished measuring
                logInfo("⚠️ [SUPPRESS] Status 3 received after status 4 (just finished measuring) - suppressing to prevent UI reset")
                shouldSuppressReadyEvent = true
                shouldEmitStatus = false
            } else if hasCompletedCurrentMeasurement {
                // Results are already displayed - suppress status 3 to keep results visible
                logInfo("✅ [SUPPRESS] Status 3 received after results displayed - suppressing to preserve results")
                shouldSuppressReadyEvent = true
                shouldEmitStatus = false
            } else if isCurrentlyDeflating {
                // Device is actively deflating - suppress status 3 to prevent UI reset
                logInfo("⚠️ [SUPPRESS] Status 3 received during DEFLATION - suppressing to prevent UI reset")
                shouldSuppressReadyEvent = true
                shouldEmitStatus = false
            } else if justCompletedMeasurement {
                // Just completed measurement - suppress status 3 for 10 seconds to prevent UI reset
                if let completionTime = measurementCompletionTime {
                    let elapsed = Date().timeIntervalSince(completionTime)
                    if elapsed < 10.0 {
                        logInfo("✅ [SUPPRESS] Status 3 received within 10s of completion (elapsed: \(Int(elapsed))s) - suppressing to preserve results")
                        shouldSuppressReadyEvent = true
                        shouldEmitStatus = false
                    } else {
                        // Grace period expired, allow status 3
                        justCompletedMeasurement = false
                        measurementCompletionTime = nil
                    }
                }
            } else if previousStatus == 5 {
                // Device returned to ready after completion - suppress it
                logInfo("✅ [SUPPRESS] Status 5→3 transition - suppressing ready event to preserve results")
                shouldSuppressReadyEvent = true
                shouldEmitStatus = false
            }
            if shouldSuppressReadyEvent {
                logInfo("✅ [STATUS 3 SUPPRESSED] Suppressing status 3 event (shouldSuppressReadyEvent=true)")
            }
        }
        
        // Emit status to JS (only if not suppressed)
        if shouldEmitStatus {
        var statusPayload = JSObject()
        statusPayload["deviceId"] = currentDevice?.identifier.uuidString
        statusPayload["status"] = Int(status.status)
        statusPayload["batteryPercent"] = Int(status.battery.percent)
        statusPayload["batteryState"] = Int(status.battery.state)
        statusPayload["batteryVoltage"] = Int(status.battery.voltage)
        notifyListeners("bp2Rt", data: statusPayload)
            logInfo("📊 [HANDLE STATUS] Status emitted to JS: \(status.status)")
        }

        // Map status to lifecycle state
        let lifecycleState: String
        switch status.status {
        case 0: lifecycleState = "sleep"
        case 1: lifecycleState = "memory"
        case 2: lifecycleState = "charge"
        case 3:
            // 🚨 FIX: If measurement is in progress, don't set lifecycle to "ready"
            // Ready state should only be shown at start or after measurement completes
            if isMeasuring {
                // Status 3 received during measurement - keep current state (measuring)
                // Don't change lifecycle state, it will be handled in the switch below
                lifecycleState = "measuring" // Keep measuring state instead of ready
                logInfo("⚠️ [LIFECYCLE] Status 3 during measurement - keeping 'measuring' state instead of 'ready'")
            } else {
            lifecycleState = "ready"
            }
        case 4: lifecycleState = "measuring"
        case 5: lifecycleState = "complete"
        case 6: lifecycleState = "ecgMeasuring"
        case 7: lifecycleState = "ecgComplete"
        default: lifecycleState = "idle"
        }
        
        // ✅ CRITICAL FIX: Only emit lifecycle event if NOT suppressed AND not during measurement
        // Double check: if status is 3 and we're measuring, don't emit ready lifecycle
        if status.status == 3 && isMeasuring {
            // 🚨 FIX: Status 3 received during active measurement - suppress lifecycle event
            // Keep the app in "measuring" state instead of switching to "ready"
            logInfo("⚠️ [SUPPRESS] Suppressing bpLifecycle('ready') event - measurement in progress (isMeasuring=true)")
            // Don't emit lifecycle event - keep current measuring state
        } else if !shouldSuppressReadyEvent {
        notifyListeners("bpLifecycle", data: ["state": lifecycleState])
        } else {
            logInfo("⚠️ [SUPPRESS] Suppressed bpLifecycle('ready') event to prevent UI reset")
        }
        
        // Log only status changes
        if status.status != previousStatus {
            logInfo("📊 [STATUS] \(previousStatus) → \(status.status) (\(lifecycleState))")
        }
        
        // SIMPLE LOGIC: Handle each status
        switch status.status {
        case 3: // Ready
            logInfo("🔍 [STATUS 3 PROCESSING] Processing status 3 - isMeasuring: \(isMeasuring), previousStatus: \(previousStatus), shouldSuppress: \(shouldSuppressReadyEvent)")
            // ✅ CRITICAL FIX: Check if actively measuring FIRST - this prevents reset during deflation
            if isMeasuring {
                logInfo("🔍 [STATUS 3 DURING MEASURE] isMeasuring=true, previousStatus: \(previousStatus)")
                if previousStatus == 4 {
                    // Normal completion: 4→3 transition
                    logInfo("✅ [STATUS 3] 4→3 transition detected - calling completeMeasurement()")
                    completeMeasurement()
                } else {
                    // Status 3 received DURING active measurement (device glitch) - ignore it!
                    logInfo("⚠️ [IGNORE] Status 3 received during active measurement (previous: \(previousStatus)) - ignoring to prevent UI reset")
                    previousStatus = status.status
                    return // Exit early - don't emit status 3 or process it
                }
            } else if shouldSuppressReadyEvent {
                logInfo("✅ [STATUS 3 SUPPRESSED] Suppressing status 3 event (shouldSuppressReadyEvent=true)")
                // Already suppressed above, just update previous status
                previousStatus = status.status
                return
            } else if hasCompletedCurrentMeasurement {
                // Already completed - don't process status 3
                logInfo("✅ [IGNORE] Status 3 after completion - ignoring to preserve results")
                previousStatus = status.status
                return
            }
            
        case 4: // Measuring
            // ✅ FIX: Reset completion flag when new measurement starts
            if previousStatus != 4 {
                hasCompletedCurrentMeasurement = false
                isFileReadInProgress = false
            }
            
            // ✅ FIX: Prevent starting new measurement if we just completed one (5→4 transition)
            if previousStatus == 5 {
                logInfo("⚠️ [STATUS] Status 5→4 transition - device resetting after completion, ignoring as new measurement")
                previousStatus = status.status
                return // Exit early - don't treat this as a new measurement
            }
            
            // ✅ FIX 3: Prevent duplicate starts
            if !isMeasuring {
                logInfo("🎬 [START] Measurement started")
                startMeasurement()
            } else {
                // Already measuring - just check timeout
                logInfo("⏱️ [MEASURING] Measurement in progress, checking timeout...")
                checkMeasurementTimeout()
            }
            
        case 5: // Complete
            logInfo("🔍 [STATUS 5 PROCESSING] Processing status 5 - hasCompletedCurrentMeasurement: \(hasCompletedCurrentMeasurement), isMeasuring: \(isMeasuring)")
            // ✅ CRITICAL FIX: Prevent duplicate completeMeasurement() calls and file reads
            if !hasCompletedCurrentMeasurement {
                logInfo("✅ [COMPLETE] Status 5 detected - calling completeMeasurement()")
                completeMeasurement()
                // Note: completeMeasurement() now sets hasCompletedCurrentMeasurement internally
            } else {
                logInfo("⚠️ [IGNORE] Status 5 already processed - ignoring duplicate (results already shown). NOT emitting status or lifecycle event.")
                // ✅ FIX: Don't emit status OR lifecycle event for duplicate status 5
                shouldEmitStatus = false // Prevent status emission
                previousStatus = status.status
                return // Exit early - don't emit status or lifecycle event
            }
            
        default:
            break
        }
        
        previousStatus = status.status
    }
    
    // Start measurement tracking
    private func startMeasurement() {
        // ✅ FIX 3: Guard against duplicate starts
        guard !isMeasuring else {
            logInfo("⚠️ [START] Already measuring, skipping duplicate start")
            return
        }
        
        // ✅ Reset completion and file read flags for new measurement
        hasCompletedCurrentMeasurement = false
        isFileReadInProgress = false
        fileReadAttempts = 0
        isCurrentlyDeflating = false // ✅ Reset deflation state for new measurement
            
        isMeasuring = true
        measurementStartTime = Date()
        logInfo("⏱️ [START] Measurement timer started")
        
        // Restart polling with slower interval (3s) to prevent device overload
        stopStatusPolling()
        startStatusPolling()
    }
    
    // Check if measurement has been running too long
    private func checkMeasurementTimeout() {
        guard let startTime = measurementStartTime else { return }
        let elapsed = Date().timeIntervalSince(startTime)
        
        if elapsed > measurementTimeout {
            logWarn("⏱️ [TIMEOUT] Measurement stuck in status 4 for \(Int(elapsed))s - forcing completion")
            completeMeasurement()
        }
    }
    
    // Complete measurement and read results
    private func completeMeasurement() {
        // ✅ CRITICAL FIX: If already completed, don't process again
        guard !hasCompletedCurrentMeasurement else {
            logInfo("⚠️ [COMPLETE] Already completed - ignoring duplicate completion")
            return
        }
        
        guard isMeasuring else {
            // If not measuring, might be old result - only read if we haven't read it yet
            if previousStatus == 5 && !hasCompletedCurrentMeasurement && !isFileReadInProgress {
                logInfo("📖 [OLD RESULT] Reading stored measurement")
                readLatestStoredBPMeasurement()
                hasCompletedCurrentMeasurement = true // Mark as completed to prevent duplicate reads
            }
            return
        }
        
        // ✅ CRITICAL FIX: DON'T set isMeasuring = false here!
        // Keep it true until results are actually emitted (in emitBPMeasurementResult)
        // This ensures status 3 is ignored throughout the entire measurement until results are shown
        measurementStartTime = nil
        
        // ✅ CRITICAL FIX: Mark completion BEFORE reading file to prevent duplicate reads
        hasCompletedCurrentMeasurement = true
        
        // ✅ CRITICAL FIX: Keep deflation flag true until results are shown - this prevents status 3 from resetting UI
        // We'll clear it after results are displayed or after a timeout
        // Note: isCurrentlyDeflating might already be false if deflation completed, but we keep it suppressed
        
        // ✅ CRITICAL FIX: Mark that we just completed measurement to suppress status 3 events
        justCompletedMeasurement = true
        measurementCompletionTime = Date()
        
        logInfo("📖 [COMPLETE] Reading BP file from device...")
        readLatestStoredBPMeasurement()
        
        // ✅ CRITICAL FIX: Clear deflation state after a delay to allow results to be displayed
        // This ensures status 3 suppression continues until results are shown
        DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) { [weak self] in
            self?.isCurrentlyDeflating = false
            self?.logInfo("✅ [DEFLATION] Cleared deflation state after results timeout")
        }
        
        // Restart polling with faster interval (1s) now that measurement is done
        stopStatusPolling()
        startStatusPolling()
        
        // ✅ CRITICAL FIX: DON'T send requestChangeBPState(0) - it causes device to report status 3
        // This was causing the UI reset! Let the device naturally reset on its own
        logInfo("✅ [COMPLETE] Measurement complete - NOT resetting device state to avoid triggering status 3")
    }
    
    // Track measurement start time and set timeout
    // Read latest BP measurement using Viatom File Protocol (more reliable than waiting for waveform type 1)
    private func readLatestStoredBPMeasurement() {
        // ✅ CRITICAL FIX: Prevent multiple simultaneous file reads
        guard !isFileReadInProgress else {
            logInfo("⚠️ [FILE] File read already in progress - skipping duplicate request")
            return
        }
        
        guard isSdkDeployed, currentDevice?.state == .connected else {
            logWarn("⚠️ [FILE] Cannot read files - SDK not ready")
            return
        }
        
        guard fileReadAttempts < maxFileReadAttempts else {
            logWarn("⚠️ [FILE] Max file read attempts reached")
            isFileReadInProgress = false // ✅ Reset flag when max attempts reached
            return
        }
        
        isFileReadInProgress = true
        fileReadAttempts += 1
        logInfo("📖 [FILE] Requesting file list from device (attempt \(fileReadAttempts)/\(maxFileReadAttempts))...")
        
        bluetoothQueue.async { [weak self] in
            self?.viatomUtils?.requestFilelist()
        }
    }
    
    // SIMPLIFIED: Just emit pressure data (no stability detection)
    private func emitBPMeasuringData(_ data: VTMBPMeasuringData) {
        // ✅ CRITICAL FIX: Track deflation state to suppress status 3 events during deflation
        let wasDeflating = isCurrentlyDeflating
        isCurrentlyDeflating = data.is_deflating == 1 || data.is_deflating_2 == 1
        
        // Log deflation state changes for debugging
        if wasDeflating != isCurrentlyDeflating {
            if isCurrentlyDeflating {
                logInfo("🔄 [DEFLATION] Deflation started - will suppress status 3 events until results shown")
            } else {
                logInfo("🔄 [DEFLATION] Deflation ended")
            }
        }
        
        var progress = JSObject()
        progress["deviceId"] = currentDevice?.identifier.uuidString
        progress["pressure"] = Int(data.pressure)
        progress["pulse"] = Int(data.pulse_rate)
        progress["isDeflating"] = isCurrentlyDeflating
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
        
        // ✅ CRITICAL: Only now that results are emitted, clear isMeasuring flag
        // This ensures status 3 is ignored throughout entire measurement until results are shown
        isMeasuring = false
        logInfo("✅ [RESULTS SHOWN] Measurement complete - isMeasuring set to false, status 3 will now be allowed")
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
        // Also emit to JavaScript console for visibility
        notifyListeners("nativeLog", data: ["level": "info", "message": message])
    }

    private func logWarn(_ message: String) {
        NSLog("⚠️ [WELLUE SDK] \(message)")
        notifyListeners("nativeLog", data: ["level": "warn", "message": message])
    }

    private func logError(_ message: String) {
        NSLog("❌ [WELLUE SDK] \(message)")
        notifyListeners("nativeLog", data: ["level": "error", "message": message])
    }
}

// MARK: - CBCentralManagerDelegate

extension WellueSDK: CBCentralManagerDelegate {
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
            self.statusPollingTimer?.invalidate()
            self.isMeasuring = false
            self.measurementStartTime = nil

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

extension WellueSDK: VTMURATDeviceDelegate, VTMURATUtilsDelegate {
    public func utilDeployCompletion(_ util: VTMURATUtils) {
        bluetoothQueue.async {
            self.logInfo("✅ [DEPLOY] SDK deployment completed successfully")
            self.deploymentTimer?.invalidate()
            self.deploymentRetryCount = 0
            self.isSdkDeployed = true
            self.markDataReceived()
            self.startHealthMonitoring()

            self.logInfo("📡 [DEPLOY] Requesting initial device data...")
            self.viatomUtils?.requestBPRealData()
            self.logInfo("📡 [DEPLOY] Requesting initial status...")
            self.viatomUtils?.bp_requestRealStatus()
            self.logInfo("📡 [DEPLOY] Requesting device info...")
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
        logError("❌ [COMMAND] Command send failed - Error code: \(errorCode), Message: \(message)")
        notifyListeners("commandError", data: ["error": message])
    }

    public func util(_ util: VTMURATUtils,
                     commandFailed cmdType: UInt8,
                     deviceType: VTMDeviceType,
                     failedType: VTMBLEPkgType) {
        logError("❌ [COMMAND] Command 0x\(String(format: "%02X", cmdType)) failed - DeviceType: \(deviceType.rawValue), FailedType: \(failedType.rawValue)")
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
        
        // DIAGNOSTIC: Always log command completion to see what's arriving
        logInfo("📥 [DELEGATE] commandCompletion called - CMD: 0x\(String(format: "%02X", cmdType)), Size: \(response?.count ?? 0) bytes")
        
        guard let response else {
            logWarn("⚠️ [COMMAND] No response data for command 0x\(String(format: "%02X", cmdType))")
            return
        }
        
        switch cmdType {
        case BPCmd.getRealStatus.rawValue:
            logInfo("📊 [DELEGATE] Parsing status response (0x06)...")
            let status = VTMBLEParser.parseBPRealTimeStatus(response)
            logInfo("📊 [DELEGATE] Status parsed: \(status.status)")
            handleStatusUpdate(status)
        case BPCmd.getRealData.rawValue:
            // Parse complete real-time data structure
            let realTimeData = VTMBLEParser.parseBPRealTime(response)
            
            // Handle status update
            handleStatusUpdate(realTimeData.run_status)
            
            // Extract waveform data
            var waveform = realTimeData.rt_wav
            
            // Extract data array - BP data is 20 bytes according to SDK protocol
            // waveform.data is a tuple of 20 UInt8 values, convert to Data
            let waveformData = withUnsafeBytes(of: &waveform.data) { Data($0) }
            
            // Parse based on waveform type
            switch waveform.type {
            case 0:  // BP measuring
                let measuring = VTMBLEParser.parseBPMeasuring(waveformData)
                // Log every 10 mmHg to diagnose pressure parsing
                if measuring.pressure > 0 && measuring.pressure % 10 == 0 {
                    logInfo("🩺 Measuring - Pressure: \(measuring.pressure) mmHg, Pulse: \(measuring.pulse_rate) bpm, Deflating: \(measuring.is_deflating), GetPulse: \(measuring.is_get_pulse)")
                }
                emitBPMeasuringData(measuring)
            case 1:  // BP measure finished (documented path)
                let end = VTMBLEParser.parseBPEndMeasure(waveformData)
                logInfo("✅ [RESULT] SYS: \(end.systolic_pressure), DIA: \(end.diastolic_pressure), Mean: \(end.mean_pressure), Pulse: \(end.pulse_rate)")
                emitBPEndData(end)
                // Mark measurement as complete
                isMeasuring = false
                measurementStartTime = nil
            case 2:  // ECG measuring
                let ecg = VTMBLEParser.parseECGMeasuring(waveformData)
                emitECGMeasuring(ecg)
            case 3:  // ECG measure finished
                let ecgEnd = VTMBLEParser.parseECGEndMeasure(waveformData)
                logInfo("✅ [ECG RESULT] HR: \(ecgEnd.hr), Result: \(ecgEnd.result)")
                emitECGEnd(ecgEnd)
            default:
                // Ignore unknown waveform types silently (type 255 is common when device is idle)
                break
            }
            
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
            
        // FILE PROTOCOL - Robust result retrieval
        case BPCmd.getFileList.rawValue:
            handleFileListResponse(response)
        case BPCmd.readFileStart.rawValue:
            handleReadFileStart(response)
        case BPCmd.readFileContent.rawValue:
            handleReadFileContent(response)
        case BPCmd.readFileEnd.rawValue:
            handleReadFileEnd()
        default:
            break
        }
    }
    
    // MARK: - File Protocol Handlers (Robust Result Retrieval)
    
    private func handleFileListResponse(_ response: Data) {
        let fileList = VTMBLEParser.parseFileList(response)
        logInfo("📂 [FILE] Received file list - \(fileList.file_num) files")
        
        // Find latest BP file (format: "yyyyMMddhhmmss")
        var bpFiles: [String] = []
        
        // Use Mirror to iterate through the tuple elements
        let mirror = Mirror(reflecting: fileList.fileName)
        var index = 0
        for child in mirror.children {
            if index >= Int(fileList.file_num) { break }
            
            if var fileName = child.value as? VTMFileName {
                let fileNameData = withUnsafeBytes(of: &fileName.str) { Data($0) }
                if let fileNameStr = String(data: fileNameData, encoding: .utf8)?.trimmingCharacters(in: CharacterSet(charactersIn: "\0")) {
                    // BP files don't have extension, ECG files start with '.'
                    if !fileNameStr.hasPrefix(".") && !fileNameStr.isEmpty {
                        bpFiles.append(fileNameStr)
                        logInfo("📂 [FILE] Found BP file: \(fileNameStr)")
                    }
                }
            }
            index += 1
        }
        
        // Sort by filename (which is timestamp) and get the latest
        let sortedFiles = bpFiles.sorted().reversed()
        if let latestFile = sortedFiles.first {
            logInfo("📂 [FILE] Latest BP file: \(latestFile)")
            downloadingFileName = latestFile
            downloadData = NSMutableData()
            expectedFileLength = 0
            
            bluetoothQueue.async { [weak self] in
                self?.logInfo("📖 [FILE] Preparing to read file: \(latestFile)")
                self?.viatomUtils?.prepareReadFile(latestFile)
            }
        } else {
            logWarn("⚠️ [FILE] No BP files found on device")
        }
    }
    
    private func handleReadFileStart(_ response: Data) {
        let fileInfo = VTMBLEParser.parseFileLength(response)
        expectedFileLength = fileInfo.file_size
        logInfo("📖 [FILE] File size: \(expectedFileLength) bytes, starting read...")
        
        if expectedFileLength == 0 {
            logWarn("⚠️ [FILE] File is empty, aborting")
            bluetoothQueue.async { [weak self] in
                self?.viatomUtils?.endReadFile()
            }
            return
        }
        
        downloadData = NSMutableData()
        bluetoothQueue.async { [weak self] in
            self?.viatomUtils?.readFile(0)
        }
    }
    
    private func handleReadFileContent(_ response: Data) {
        downloadData?.append(response)
        let currentLength = downloadData?.length ?? 0
        
        logInfo("📥 [FILE] Downloaded \(currentLength)/\(expectedFileLength) bytes")
        
        if currentLength >= expectedFileLength {
            // File download complete
            bluetoothQueue.async { [weak self] in
                self?.viatomUtils?.endReadFile()
            }
        } else {
            // Request next chunk
            bluetoothQueue.async { [weak self] in
                self?.viatomUtils?.readFile(UInt32(currentLength))
            }
        }
    }
    
    private func handleReadFileEnd() {
        guard let fileData = downloadData, fileData.length > 0 else {
            logError("❌ [FILE] File read completed but no data received")
            return
        }
        
        logInfo("✅ [FILE] File downloaded successfully (\(fileData.length) bytes), parsing BP result...")
        
        // Parse BP file structure according to Viatom File Parse Protocol
        if fileData.length >= MemoryLayout<VTMBPBPResult>.size {
            let bpResult = VTMBLEParser.parseBPResult(fileData as Data)
            logInfo("✅ [FILE RESULT] ⭐ SYS: \(bpResult.systolic_pressure), DIA: \(bpResult.diastolic_pressure), Mean: \(bpResult.mean_pressure), Pulse: \(bpResult.pulse_rate) ⭐")
            
            // Emit result using same format as waveform type 1
            var payload = JSObject()
            payload["deviceId"] = currentDevice?.identifier.uuidString
            payload["systolic"] = Int(bpResult.systolic_pressure)
            payload["diastolic"] = Int(bpResult.diastolic_pressure)
            payload["mean"] = Int(bpResult.mean_pressure)
            payload["pulse"] = Int(bpResult.pulse_rate)
            payload["stateCode"] = Int(bpResult.status_code)
            payload["medicalResult"] = Int(bpResult.medical_result)
            payload["source"] = "file" // Mark as file-based result
            
            notifyListeners("bpMeasurement", data: payload)
            notifyListeners("bpLifecycle", data: ["state": "complete"])
            
            // ✅ CRITICAL: Only now that results are emitted, clear isMeasuring flag
            // This ensures status 3 is ignored throughout entire measurement until results are shown
            isMeasuring = false
            logInfo("✅ [RESULTS SHOWN] Measurement complete (file-based) - isMeasuring set to false, status 3 will now be allowed")
            
            // ✅ Reset file reading state
            isFileReadInProgress = false
            fileReadAttempts = 0
            downloadingFileName = nil
            downloadData = nil
        } else {
            logError("❌ [FILE] Invalid file size: \(fileData.length) bytes")
        }
    }
}

