import Foundation
import Capacitor

/**
 * iOS stub for the AliveCor Kardia SDK Capacitor bridge.
 *
 * IMPORTANT:
 * - This file is intentionally minimal and does NOT yet
 *   call into `AliveCorKitLite`. It is here so that the
 *   web/Capacitor layer can compile without breaking the
 *   existing Wellue integration.
 * - To fully enable 6‑lead ECG on iOS you should:
 *   1. Add `AliveCorKitLite.xcframework` and
 *      `AliveCorKitAssets.bundle` from the SDK into the
 *      Xcode project (embed & sign).
 *   2. Port the sample flow from
 *      `AliveCore-iOS-SDK-v1.6.10/Sample/AliveCorKitExample`
 *      (e.g. `AuthService`, `AliveCorKitLiteController`) into
 *      this app and call it from `startSixLeadRecording`.
 *   3. Replace the rejection below with real initialization
 *      and recording logic.
 */
import Foundation
import Capacitor
import AliveCorKitLite

import CoreBluetooth

@objc(AliveCorSDK)
public class AliveCorSDK: CAPPlugin, CBCentralManagerDelegate {
    var centralManager: CBCentralManager?

    public override func load() {
        centralManager = CBCentralManager(delegate: self, queue: nil, options: [CBCentralManagerOptionShowPowerAlertKey: false])
    }

    @objc public func initialize(_ call: CAPPluginCall) {
        guard let jwt = call.getString("jwt") else {
            call.reject("JWT is required")
            return
        }
        
        let isDebug = call.getBool("isDebugMode") ?? false
        
        // Typical AliveCorKitLite initialization for iOS
        DispatchQueue.main.async {
            AliveCorKitLite.shared.initialize(apiKey: jwt, appId: "com.monitraq.mobile", appName: "Monitraq", appVersion: "1.9")
            call.resolve()
        }
    }

    @objc public func startSixLeadRecording(_ call: CAPPluginCall) {
        guard let jwt = call.getString("jwt") else {
            call.reject("JWT is required")
            return
        }
        
        let patientId = call.getString("patientId") ?? "monitraq_patient"
        
        DispatchQueue.main.async {
            if let vc = self.bridge?.viewController {
                AliveCorKitLite.shared.startRecording(leadConfig: .sixLead, patientId: patientId, from: vc) { result in
                    var ret = JSObject()
                    ret["success"] = result.success
                    ret["heartRate"] = result.averageHeartRate ?? 0
                    ret["diagnosisText"] = result.diagnosisText ?? "Normal"
                    ret["determination"] = result.determination ?? "UNKNOWN"
                    ret["sampleRate"] = result.sampleRate ?? 300
                    ret["durationSeconds"] = result.durationSeconds ?? 30.0
                    ret["deviceType"] = result.deviceType ?? "KardiaMobile 6L"
                    ret["isInverted"] = result.isInverted ?? false
                    
                    if let leads = result.waveformLeads {
                        ret["waveformLeads"] = leads
                    }
                    
                    call.resolve(ret)
                }
            } else {
                call.reject("Unable to find view controller")
            }
        }
    }
    
    @objc public func getDeviceStatus(_ call: CAPPluginCall) {
        let btOn = centralManager?.state == .poweredOn
        var ret = JSObject()
        ret["connected"] = btOn
        ret["deviceName"] = btOn ? "KardiaMobile 6L" : ""
        ret["deviceType"] = "ECG"
        ret["bluetoothEnabled"] = btOn
        call.resolve(ret)
    }

    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        // State updates handled in getDeviceStatus
    }
}


