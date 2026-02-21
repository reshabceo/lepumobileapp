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
@objc(AliveCorSDK)
public class AliveCorSDK: CAPPlugin {
    @objc public func startSixLeadRecording(_ call: CAPPluginCall) {
        // Stub implementation so iOS builds keep working.
        // This makes it very clear at runtime that the
        // native iOS SDK still needs to be wired.
        call.reject("AliveCor iOS SDK wiring is pending. Follow the comments in AliveCorSDKPlugin.swift to complete integration.")
    }
}


