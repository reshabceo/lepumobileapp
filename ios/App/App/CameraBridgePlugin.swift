//
// Native RTSP→WHIP bridge for iOS.
//
// The video pipeline is the SAME Go code as Android: camera-bridge-core/mobile
// is compiled to an XCFramework with gomobile and imported here as module `Mobile`.
//   cd camera-bridge-core && make xcframework
//   (outputs ../lepumobileapp/ios/App/Frameworks/Mobile.xcframework)
//   cd ios/App && pod install         # CameraBridge.podspec vendors the framework
//
// This file compiles WITH or WITHOUT that framework:
//   • framework embedded  → full Reolink RTSP→WHIP, identical to Android
//   • framework missing   → start() rejects, callers fall back to usePhoneBridge
//
// Capacitor events emitted (consumed by useNativeCameraBridge.ts):
//   cameraBridgeState { state }, cameraBridgeError { error }, cameraBridgeBytes { bytesTransferred }
//

import AVFoundation
import Capacitor
import Foundation
import UIKit

#if canImport(Mobile)
import Mobile
#endif

@objc(CameraBridgePlugin)
public class CameraBridgePlugin: CAPPlugin {
    private var bgTaskId: UIBackgroundTaskIdentifier = .invalid

    #if canImport(Mobile)
    private var bridge: MobileBridge?
    private var listener: BridgeStatusListener?
    #endif

    @objc func start(_ call: CAPPluginCall) {
        let rtspUrl = call.getString("rtspUrl") ?? ""
        guard let patientId = call.getString("patientId"),
              let sfuOrigin = call.getString("sfuOrigin"),
              let jwt = call.getString("jwt") else {
            call.reject("missing fields: rtspUrl, patientId, sfuOrigin, jwt are required")
            return
        }
        let iceJson = call.getString("iceJson") ?? ""
        let useUdp = call.getBool("useUdp") ?? false

        // Keep the socket + RTSP pull alive briefly when backgrounded.
        bgTaskId = UIApplication.shared.beginBackgroundTask(withName: "monitraq.camera.bridge") { [weak self] in
            self?.endBackgroundTask()
        }

        // playAndRecord lets us forward camera audio later without killing other audio.
        do {
            let s = AVAudioSession.sharedInstance()
            try s.setCategory(.playAndRecord, mode: .default, options: [.mixWithOthers, .allowBluetooth])
            try s.setActive(true, options: [])
        } catch {}

        #if canImport(Mobile)
        let lst = BridgeStatusListener(plugin: self)
        self.listener = lst
        let b = MobileBridge()
        self.bridge = b
        // Mirrors core.Run(rtspURL, sfuOrigin, patientID, jwt, iceJSON, useUDP, hwSerial, listener)
        b.start(
            rtspUrl,
            sfuOrigin: sfuOrigin.hasSuffix("/") ? String(sfuOrigin.dropLast()) : sfuOrigin,
            patientID: patientId,
            jwt: jwt,
            iceJSON: iceJson,
            useUDP: useUdp,
            hwSerial: "",
            lst: lst
        )
        notifyListeners("cameraBridgeState", data: ["state": "connecting"])
        call.resolve(["ok": true, "state": "connecting"])
        #else
        let errMsg = """
            Native iOS gomobile bridge not embedded. Build it once:
            cd camera-bridge-core && make xcframework && cd ../lepumobileapp/ios/App && pod install
            Until then iOS falls back to the foreground WebRTC (usePhoneBridge) path.
            """
        endBackgroundTask()
        call.reject(errMsg.trimmingCharacters(in: .whitespacesAndNewlines), "UNSUPPORTED_IOS_NATIVE", nil)
        #endif
    }

    @objc func stop(_ call: CAPPluginCall) {
        #if canImport(Mobile)
        bridge?.stop()
        bridge = nil
        listener = nil
        #endif
        endBackgroundTask()
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        notifyListeners("cameraBridgeState", data: ["state": "idle"])
        call.resolve(["ok": true])
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        call.resolve(["bytesTransferred": lastBytes])
    }

    fileprivate var lastBytes: Int = 0

    fileprivate func endBackgroundTask() {
        if bgTaskId != .invalid {
            UIApplication.shared.endBackgroundTask(bgTaskId)
            bgTaskId = .invalid
        }
    }
}

#if canImport(Mobile)
/// Bridges gomobile's MobileStatusListener callbacks to Capacitor events.
private class BridgeStatusListener: NSObject, MobileStatusListener {
    weak var plugin: CameraBridgePlugin?
    init(plugin: CameraBridgePlugin) { self.plugin = plugin }

    func onState(_ state: String?) {
        plugin?.notifyListeners("cameraBridgeState", data: ["state": state ?? "idle"])
    }

    func onError(_ msg: String?) {
        plugin?.notifyListeners("cameraBridgeError", data: ["error": msg ?? ""])
    }

    func onBytes(_ total: Int64) {
        plugin?.lastBytes = Int(total)
        plugin?.notifyListeners("cameraBridgeBytes", data: ["bytesTransferred": Int(total)])
    }
}
#endif
