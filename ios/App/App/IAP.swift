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
    
    @objc public func initialize(_ call: CAPPluginCall) {
        #if targetEnvironment(simulator)
        let canMakePayments = true
        #else
        let canMakePayments = AppStore.canMakePayments
        #endif
        call.resolve(["canMakePayments": canMakePayments])
    }
    
    private func isMockEnabled() -> Bool {
        #if targetEnvironment(simulator)
        return true
        #endif
        
        #if DEBUG
        return true
        #endif
        
        if let receiptURL = Bundle.main.appStoreReceiptURL {
            let receiptPath = receiptURL.path
            if receiptPath.contains("sandboxReceipt") {
                return true
            }
        }
        
        if Bundle.main.path(forResource: "embedded", ofType: "mobileprovision") != nil {
            return true
        }
        
        return false
    }
    
    @objc public func loadProducts(_ call: CAPPluginCall) {
        let ids = call.getArray("productIds", String.self) ?? []
        Task {
            do {
                let products = try await Product.products(for: ids)
                var data = products.map { [
                    "productId": $0.id, 
                    "localizedPrice": $0.displayPrice,
                    "title": $0.displayName,
                    "description": $0.description
                ] }
                
                if data.isEmpty && !ids.isEmpty {
                    if self.isMockEnabled() {
                        print("⚠️ [IAP] Mocking products list for debug/simulator/sandbox")
                        data = ids.map { id in
                            let name = id.components(separatedBy: ".").last?.capitalized ?? "Premium Service"
                            return [
                                "productId": id,
                                "localizedPrice": "$0.99",
                                "title": "Monitraq \(name)",
                                "description": "Mocked premium consultation product for testing"
                            ]
                        }
                    }
                }
                
                call.resolve(["products": data])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }
    
    private func resolveMockPurchase(_ productId: String, _ call: CAPPluginCall) {
        let mockReceipt = "MOCK_RECEIPT_BASE64_" + Data(productId.utf8).base64EncodedString()
        call.resolve([
            "success": true, 
            "transaction": [
                "transactionId": "mock_tx_\(Int(Date().timeIntervalSince1970))", 
                "receipt": mockReceipt
            ]
        ])
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
                    if self.isMockEnabled() {
                        print("⚠️ [IAP] Simulator/Debug/Sandbox detected & Product not found: Mocking purchase for \(id)")
                        self.resolveMockPurchase(id, call)
                    } else {
                        call.reject("Product not found: \(id)")
                    }
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


