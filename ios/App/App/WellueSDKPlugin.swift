import Foundation
import Capacitor
import CoreBluetooth

@objc(WellueSDK)
public class WellueSDK: CAPPlugin, CBCentralManagerDelegate {
    private var central: CBCentralManager?

    public override func load() {
        // Initialize central manager lazily
        self.central = CBCentralManager(delegate: self, queue: nil)
    }

    // MARK: - CBCentralManagerDelegate
    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        // No-op: state changes are queried on demand
    }

    // MARK: - Plugin API
    @objc public func initialize(_ call: CAPPluginCall) {
        if self.central == nil {
            self.central = CBCentralManager(delegate: self, queue: nil)
        }
        call.resolve()
    }

    @objc public func isBluetoothEnabled(_ call: CAPPluginCall) {
        let enabled: Bool
        if let state = self.central?.state {
            enabled = (state == .poweredOn)
        } else {
            enabled = false
        }
        call.resolve(["enabled": enabled])
    }

    @objc public func startScan(_ call: CAPPluginCall) {
        notifyListeners("error", data: ["message": "Wellue iOS SDK not integrated yet. startScan is a stub."], retainUntilConsumed: false)
        call.resolve()
    }

    @objc public func stopScan(_ call: CAPPluginCall) {
        call.resolve()
    }

    @objc public func connect(_ call: CAPPluginCall) {
        notifyListeners("error", data: ["message": "Wellue iOS SDK not integrated yet. connect is a stub."], retainUntilConsumed: false)
        call.reject("Not implemented")
    }

    @objc public func disconnect(_ call: CAPPluginCall) {
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
        call.resolve(["devices": []])
    }

    @objc public func isDeviceConnected(_ call: CAPPluginCall) {
        call.resolve(["connected": false])
    }

    @objc public func getBp2FileList(_ call: CAPPluginCall) {
        call.resolve(["files": []])
    }

    @objc public func bp2ReadFile(_ call: CAPPluginCall) {
        call.resolve([:])
    }
}



