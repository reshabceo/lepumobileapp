import Foundation
import Capacitor
import StoreKit

/**
 * Custom Capacitor Plugin for In-App Purchases using StoreKit 2.
 * Register this in your AppDelegate or BridgeViewController.
 */
@available(iOS 15.0, *)
@objc(IAP)
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
                
                let result = try await product.purchase()
                
                switch result {
                case .success(let verification):
                    let transaction = try verification.payloadValue
                    
                    // Get receipt data
                    let receipt = (try? Data(contentsOf: Bundle.main.appStoreReceiptURL!))?.base64EncodedString() ?? ""
                    
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
                call.resolve(["success": true])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }
}
