import Capacitor
import AliveCorKitLite

@objc(AliveCorPlugin)
public class AliveCorPlugin: CAPPlugin, CAPBridgedPlugin, ACKEcgMonitorDelegate {
    public let identifier = "AliveCorPlugin"
    public let jsName = "AliveCor"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getDeviceStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "dispose", returnType: CAPPluginReturnPromise),
    ]

    private var isInitialized = false

    /// Pending plugin call that is resolved when recording completes.
    private var pendingRecordCall: CAPPluginCall?

    /// Accumulated ECG samples captured in real-time during recording via the
    /// `didReceiveEcgFrame` delegate callback. Each inner array holds samples
    /// for one lead (up to 6 leads for KardiaMobile 6L).
    private var capturedLeadSamples: [[Double]] = []

    /// Lead count determined from the first received frame.
    private var detectedLeadCount: Int = 0

    // AliveCor SDK records at a fixed 300 Hz sample rate.
    private let sampleRate: Int = 300

    // MARK: - initialize

    @objc func initialize(_ call: CAPPluginCall) {
        guard let jwt = call.getString("jwt") else {
            call.reject("jwt is required")
            return
        }
        let debugMode = call.getBool("isDebugMode") ?? false

        // ACKStatusListener signature: (NSError?, ACKConfiguration?) -> Void
        ACKManager.initWithApiKey(jwt, isDebugMode: debugMode) { [weak self] error, config in
            DispatchQueue.main.async {
                if let error = error {
                    call.reject("AliveCor SDK init error: \(error.localizedDescription)")
                    return
                }
                self?.isInitialized = true
                call.resolve()
            }
        }
    }

    // MARK: - startRecording

    @objc func startRecording(_ call: CAPPluginCall) {
        guard isInitialized else {
            call.reject("SDK not initialized. Call initialize() first.")
            return
        }

        guard let bridge = self.bridge,
              let viewController = bridge.viewController else {
            call.reject("Unable to access view controller")
            return
        }

        // Parse options from JS
        let leadConfigStr = call.getString("leadConfig") ?? "six"
        let leadsConfig: ACKLeadsConfig = leadConfigStr == "single" ? .single : .six
        let durationSeconds = call.getInt("durationSeconds") ?? 30
        let mainsFilter = call.getInt("mainsFilter") ?? 50
        let mainsFrequency: ACKMainsFrequency = mainsFilter == 60 ? .sixtyHz : .fiftyHz

        // Reset captured samples
        capturedLeadSamples = []
        detectedLeadCount = 0
        pendingRecordCall = call

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            let algorithmPackage = ACKManager.sharedInstance().algorithmPackageForCurrentKAI()

            var configError: ACKError?
            guard let recordingConfig = ACKEcgRecordingConfig(
                deviceType: .triangle,
                leadsConfig: leadsConfig,
                filterType: .enhanced,
                maxDuration: durationSeconds,
                algorithmPackage: algorithmPackage,
                error: &configError
            ) else {
                call.reject("Recording config error: \(configError?.localizedTitle ?? "unknown")")
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

    public func ecgMonitorViewController(
        _ viewController: ACKEcgMonitorViewController,
        didCompleteRecording record: ACKEcgRecord?
    ) {
        // Dismiss the SDK UI
        viewController.dismiss(animated: true, completion: nil)

        guard let call = pendingRecordCall else { return }
        pendingRecordCall = nil

        guard let record = record else {
            call.reject("Recording cancelled or failed")
            return
        }

        let evaluation = record.evaluation
        let durationMs = record.duration?.doubleValue ?? 0
        let durationSec = durationMs / 1000.0

        // Build the per-lead waveform dictionary if we captured multi-lead data
        let leadNames = ["I", "II", "III", "aVR", "aVL", "aVF"]
        var waveformLeads: [String: [Double]] = [:]
        var flatMvData: [Double] = []

        if detectedLeadCount > 1 && capturedLeadSamples.count == detectedLeadCount {
            for (i, samples) in capturedLeadSamples.enumerated() {
                if i < leadNames.count {
                    waveformLeads[leadNames[i]] = samples
                }
            }
        } else if !capturedLeadSamples.isEmpty {
            // Single-lead: flatten first lead
            flatMvData = capturedLeadSamples.first ?? []
        }

        let leadsConfigStr = record.config.leadsConfig == .six ? "six" : "single"
        let deviceName = record.device?.name ?? "KARDIA_MOBILE"

        var response: [String: Any] = [
            "mvData": flatMvData,
            "sampleRate": sampleRate,
            "durationSeconds": durationSec,
            "heartRate": evaluation?.averageHeartRate ?? 0,
            "determination": determinationString(evaluation?.determination),
            "modifier": modifierString(evaluation?.modifier),
            "algorithmPackage": evaluation?.algorithmPackage ?? "kaiv2",
            "leadConfig": leadsConfigStr,
            "deviceType": deviceName,
            "isInverted": evaluation?.isInverted ?? false,
            "qualityScore": 0.0,
        ]

        if !waveformLeads.isEmpty {
            response["waveformLeads"] = waveformLeads
        }

        call.resolve(response as PluginCallResultData)
    }

    /// Real-time ECG frame callback — accumulate samples per lead.
    public func ecgMonitorViewController(
        _ viewController: ACKEcgMonitorViewController,
        didReceiveEcgFrame ecgFrame: ECGFrame
    ) {
        let leadCount = Int(ecgFrame.numberOfLeads)
        if leadCount <= 0 { return }

        // Initialize lead arrays on first frame
        if detectedLeadCount == 0 {
            detectedLeadCount = leadCount
            capturedLeadSamples = Array(repeating: [], count: leadCount)
        }

        // Each frame contains `samplesPerLead` samples for each of `numberOfLeads` leads
        let samplesPerLead = Int(ecgFrame.samplesPerLead)
        let totalSamples = leadCount * samplesPerLead

        guard let buffer = ecgFrame.samples else { return }
        let samples = Array(UnsafeBufferPointer(start: buffer, count: totalSamples))

        // Samples are interleaved: [L0S0, L1S0, L0S1, L1S1, ...] for 2 leads
        // Or sequential blocks depending on SDK version — handle both patterns
        for lead in 0..<leadCount {
            for s in 0..<samplesPerLead {
                let idx = s * leadCount + lead
                if idx < samples.count && lead < capturedLeadSamples.count {
                    capturedLeadSamples[lead].append(Double(samples[idx]))
                }
            }
        }
    }

    public func ecgMonitorViewController(
        _ viewController: ACKEcgMonitorViewController,
        didEncounterError error: ACKError?
    ) {
        if let error = error {
            print("AliveCorPlugin recording error: \(error.localizedDescription)")
        }
    }

    public func ecgMonitorViewController(
        _ viewController: ACKEcgMonitorViewController,
        didEncounterAudioError error: ACKError?
    ) {
        // Audio errors happen with ultrasound devices (KardiaMobile original)
        viewController.dismiss(animated: true, completion: nil)
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
        let result: [String: Any] = [
            "connected": isInitialized,
            "deviceName": "Kardia",
            "deviceType": "KARDIA_MOBILE",
        ]
        call.resolve(result as PluginCallResultData)
    }

    // MARK: - dispose

    @objc func dispose(_ call: CAPPluginCall) {
        isInitialized = false
        pendingRecordCall = nil
        capturedLeadSamples = []
        call.resolve()
    }

    // MARK: - Helpers

    private func determinationString(_ determination: ACKAlgorithmDetermination?) -> String {
        guard let d = determination else { return "NO_ANALYSIS" }
        // ACKAlgorithmDetermination is an NSString typedef
        return d as String
    }

    private func modifierString(_ modifier: ACKDeterminationModifier?) -> String {
        guard let m = modifier else { return "NONE" }
        return m as String
    }
}
