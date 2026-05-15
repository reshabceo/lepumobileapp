import Foundation
import Capacitor
import StoreKit
import AliveCorKitLite
import CoreBluetooth

/**
 * Combined Native Plugins for Monitraq.
 * This file contains both IAPPlugin and AliveCorSDK to ensure they are compiled,
 * as IAP.swift is already registered in the Xcode project.
 */

// MARK: - IAPPlugin

@available(iOS 15.0, *)
@objc(IAPPlugin)
public class IAPPlugin: CAPPlugin {
    
    @objc public func loadProducts(_ call: CAPPluginCall) {
        let ids = call.getArray("productIds", String.self) ?? []
        Task {
            do {
                let products = try await Product.products(for: ids)
                let data = products.map { [
                    "productId": $0.id, 
                    "localizedPrice": $0.displayPrice,
                    "title": $0.displayName,
                    "description": $0.description
                ] }
                call.resolve(["products": data])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }
    
    @objc public func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("productId") else {
            call.reject("Product ID is required")
            return
        }
        
        Task {
            do {
                let products = try await Product.products(for: [id])
                guard let product = products.first else {
                    call.reject("Product not found: \(id)")
                    return
                }
                
                print("🛒 [IAP] Initiating purchase for: \(id)")
                let result = try await product.purchase()
                
                switch result {
                case .success(let verification):
                    let transaction = try verification.payloadValue
                    
                    var receipt = ""
                    if let receiptURL = Bundle.main.appStoreReceiptURL,
                       let data = try? Data(contentsOf: receiptURL) {
                        receipt = data.base64EncodedString()
                    }
                    
                    print("🛒 [IAP] Purchase successful! Transaction ID: \(transaction.id)")
                    await transaction.finish()
                    
                    call.resolve([
                        "success": true, 
                        "transaction": [
                            "transactionId": String(transaction.id), 
                            "receipt": receipt
                        ]
                    ])
                    
                case .userCancelled:
                    call.reject("User cancelled", "USER_CANCELLED")
                case .pending:
                    call.reject("Purchase pending", "PENDING")
                @unknown default:
                    call.reject("Unknown result")
                }
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }
    
    @objc public func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                
                var transactions: [[String: Any]] = []
                for await result in Transaction.currentEntitlements {
                    if case .verified(let transaction) = result {
                        transactions.append([
                            "transactionId": String(transaction.id),
                            "productId": transaction.productID,
                            "purchaseDate": Int(transaction.purchaseDate.timeIntervalSince1970 * 1000),
                            "originalTransactionId": String(transaction.originalID)
                        ])
                    }
                }
                
                call.resolve(["transactions": transactions])
            } catch {
                call.reject("Failed to restore: \(error.localizedDescription)")
            }
        }
    }
}

// MARK: - AliveCorSDK

@objc(AliveCorSDK)
public class AliveCorSDK: CAPPlugin, ACKEcgMonitorDelegate, CBCentralManagerDelegate {
    
    private var isInitialized = false
    private var centralManager: CBCentralManager?
    private var discoveredPeripherals: [String: CBPeripheral] = [:]
    private var connectedPeripheral: CBPeripheral?
    private var savedDeviceId: String?
    private var recordingCall: CAPPluginCall?
    
    override public func load() {
        NSLog("🔧 [ALIVECOR SDK] Plugin loaded")
        centralManager = CBCentralManager(delegate: self, queue: nil)
    }
    
    @objc public func initialize(_ call: CAPPluginCall) {
        guard let jwt = call.getString("jwt") else {
            call.reject("JWT is required")
            return
        }
        
        let isDebug = call.getBool("isDebugMode") ?? false
        
        ACKManager.initWithApiKey(jwt, isDebugMode: isDebug) { [weak self] error, config in
            DispatchQueue.main.async {
                if let error = error {
                    NSLog("❌ [ALIVECOR SDK] Initialization failed: \(error.localizedDescription)")
                    call.reject("Initialization failed: \(error.localizedDescription)")
                } else {
                    self?.isInitialized = true
                    NSLog("✅ [ALIVECOR SDK] Initialized successfully")
                    call.resolve()
                }
            }
        }
    }
    
    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        call.resolve([
            "bluetooth": "granted",
            "audio": "granted"
        ])
    }
    
    @objc public func startScan(_ call: CAPPluginCall) {
        guard let cm = centralManager else {
            NSLog("❌ [ALIVECOR SDK] Central manager not initialized")
            call.reject("Central manager not initialized")
            return
        }
        
        if cm.state != .poweredOn {
            NSLog("⚠️ [ALIVECOR SDK] Bluetooth is not powered on (state: \(cm.state.rawValue))")
            call.reject("Bluetooth is not powered on")
            return
        }
        
        discoveredPeripherals.removeAll()
        // Scan for all peripherals; we'll filter in the delegate
        cm.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
        NSLog("🔍 [ALIVECOR SDK] Scanning started for Kardia devices...")
        call.resolve()
    }
    
    @objc public func stopScan(_ call: CAPPluginCall) {
        centralManager?.stopScan()
        NSLog("🔍 [ALIVECOR SDK] Scanning stopped")
        call.resolve()
    }
    
    @objc public func connect(_ call: CAPPluginCall) {
        guard let deviceId = call.getString("deviceId") else {
            call.reject("deviceId is required")
            return
        }
        
        self.savedDeviceId = deviceId
        NSLog("🔗 [ALIVECOR SDK] Device selected: \(deviceId)")
        
        let ret: [String: Any] = [
            "success": true,
            "deviceId": deviceId,
            "deviceName": "KardiaMobile 6L"
        ]
        
        notifyListeners("deviceConnected", data: ret)
        call.resolve(ret)
    }
    
    @objc public func getDeviceStatus(_ call: CAPPluginCall) {
        let btOn = centralManager?.state == .poweredOn
        let deviceId = self.savedDeviceId
        
        var ret = JSObject()
        ret["connected"] = btOn && deviceId != nil
        ret["ready"] = isInitialized
        ret["deviceName"] = (btOn && deviceId != nil) ? "KardiaMobile 6L" : ""
        ret["deviceId"] = deviceId ?? ""
        ret["bluetoothEnabled"] = btOn
        ret["statusText"] = btOn ? (deviceId != nil ? "Connected" : "Ready to Pair") : "Bluetooth Off"
        
        call.resolve(ret)
    }
    
    @objc public func startSixLeadRecording(_ call: CAPPluginCall) {
        guard isInitialized else {
            NSLog("❌ [ALIVECOR SDK] startSixLeadRecording failed: SDK not initialized")
            call.reject("SDK not initialized. Call initialize() first.")
            return
        }
        
        guard let viewController = self.bridge?.viewController else {
            NSLog("❌ [ALIVECOR SDK] startSixLeadRecording failed: ViewController not available")
            call.reject("ViewController not available")
            return
        }
        
        if centralManager?.state != .poweredOn {
            NSLog("⚠️ [ALIVECOR SDK] startSixLeadRecording failed: Bluetooth is disabled")
            call.reject("Bluetooth is disabled")
            return
        }

        self.recordingCall = call
        
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            let algorithmPackage = ACKManager.sharedInstance().algorithmPackageForCurrentKAI()
            var error: ACKError?
            
            NSLog("🎬 [ALIVECOR SDK] Launching 6-lead ECG monitor...")
            
            // KardiaMobile 6L is .triangle device type
            let config = ACKEcgRecordingConfig(
                deviceType: .triangle, 
                leadsConfig: .six,
                filterType: .enhanced,
                maxDuration: 30,
                algorithmPackage: algorithmPackage,
                error: &error
            )
            
            if let error = error {
                NSLog("❌ [ALIVECOR SDK] Config error: \(error.localizedTitle)")
                call.reject("Config error: \(error.localizedTitle)")
                return
            }
            
            guard let monitorVC = ACKEcgMonitorViewController(config: config!, delegate: self) else {
                NSLog("❌ [ALIVECOR SDK] Could not create monitor view controller")
                call.reject("Could not create monitor view controller")
                return
            }
            
            // The SDK UI usually expects to be in a navigation controller
            let navController = UINavigationController(rootViewController: monitorVC)
            navController.modalPresentationStyle = .fullScreen
            
            viewController.present(navController, animated: true) {
                NSLog("✅ [ALIVECOR SDK] ECG monitor presented successfully")
            }
        }
    }
    
    @objc public func dispose(_ call: CAPPluginCall) {
        centralManager?.stopScan()
        call.resolve()
    }
    
    // MARK: - CBCentralManagerDelegate
    
    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        NSLog("🔵 [ALIVECOR SDK] Bluetooth state: \(central.state.rawValue)")
    }
    
    public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        let name = peripheral.name ?? (advertisementData[CBAdvertisementDataLocalNameKey] as? String) ?? ""
        let deviceId = peripheral.identifier.uuidString
        
        // Kardia devices advertising names: "Kardia", "K6L", "KM6L", "KardiaMobile", or "ACK" prefix
        let isKardia = name.localizedCaseInsensitiveContains("Kardia") || 
                       name.localizedCaseInsensitiveContains("K6L") || 
                       name.localizedCaseInsensitiveContains("KM6L") ||
                       name.hasPrefix("ACK")
        
        if isKardia || !name.isEmpty {
            NSLog("🔍 [ALIVECOR SDK] Discovered device: \(name) (\(deviceId)) RSSI: \(RSSI)")
            
            if isKardia {
                discoveredPeripherals[deviceId] = peripheral
                
                notifyListeners("deviceFound", data: [
                    "deviceName": name.isEmpty ? "Kardia Device" : name,
                    "deviceId": deviceId,
                    "rssi": RSSI.intValue
                ])
            }
        }
    }
    
    // MARK: - ACKEcgMonitorDelegate
    
    public func ecgMonitorViewController(_ viewController: ACKEcgMonitorViewController, didCompleteRecording record: ACKEcgRecord?) {
        viewController.dismiss(animated: true) { [weak self] in
            guard let self = self, let call = self.recordingCall else { return }
            
            if let record = record {
                let evaluation = record.evaluation
                var result: [String: Any] = [
                    "success": true,
                    "heartRate": evaluation?.averageHeartRate ?? 0,
                    "determination": evaluation?.determination ?? "UNKNOWN",
                    "diagnosisText": evaluation?.localizedDeterminationShortTitle() ?? "No Analysis",
                    "isInverted": evaluation?.isInverted ?? false,
                    "durationSeconds": record.duration?.doubleValue ?? 30.0,
                    "deviceType": "KardiaMobile 6L"
                ]
                call.resolve(result)
            } else {
                call.reject("Recording failed or was incomplete")
            }
            self.recordingCall = nil
        }
    }
    
    public func ecgMonitorViewController(_ viewController: ACKEcgMonitorViewController, didEncounterError error: ACKError?) {
        NSLog("❌ [ALIVECOR SDK] Recording error: \(error?.localizedTitle ?? "unknown")")
        viewController.dismiss(animated: true) { [weak self] in
            self?.recordingCall?.reject(error?.localizedTitle ?? "Recording error")
            self?.recordingCall = nil
        }
    }
    
    public func ecgMonitorViewControllerDidCancel(_ viewController: ACKEcgMonitorViewController) {
        viewController.dismiss(animated: true) { [weak self] in
            self?.recordingCall?.reject("User cancelled recording")
            self?.recordingCall = nil
        }
    }
    
    public func showCancelButton(in viewController: ACKEcgMonitorViewController) -> Bool {
        return true
    }
    
    public func showSettingsButton(in viewController: ACKEcgMonitorViewController) -> Bool {
        return false
    }
    
    public func ecgMonitorViewControllerShouldEnableLeadModeSwitch(_ viewController: ACKEcgMonitorViewController) -> Bool {
        return false
    }
    
    public func availableDeviceTypes(_ viewController: ACKEcgMonitorViewController) -> [ACKDeviceType] {
        return [.triangle]
    }
}
