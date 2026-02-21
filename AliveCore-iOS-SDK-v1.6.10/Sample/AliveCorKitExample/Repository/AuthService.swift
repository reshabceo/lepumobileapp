//
//  AuthService.swift
//  AliveCorKitExample
//
//  Created by rex hsu on 9/12/24.
//  Copyright © 2024 Alivecor. All rights reserved.
//

import AliveCorKitLite

class AuthService {
    
    private static let partnerId = "<partner ID>"
    private static let bundleId = "<bundle ID>"
    private static let userId = "<user ID>"
    private static let authStr = "<auth string>"
    
    static func fetchAuthToken() async throws -> String {
        let configuration = URLSessionConfiguration.default
        let session = URLSession(configuration: configuration)
        
        let parameters: [String: Any] = [
            "partnerId": partnerId,
            "bundleId": bundleId,
            "userId": userId
        ]
        
        guard let url = URL(string: "https://us-kardia-staging.alivecor.com/auth/sdk") else {
            throw NSError(domain: "Invalid URL", code: 400, userInfo: nil)
        }
        
        let jsonData = try JSONSerialization.data(withJSONObject: parameters, options: [])
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = jsonData
        
        let authStr = authStr
        if let authData = authStr.data(using: .utf8) {
            let authValue = "Basic \(authData.base64EncodedString())"
            request.setValue(authValue, forHTTPHeaderField: "Authorization")
        }
        
        let (data, _) = try await session.data(for: request)
        guard let responseObject = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any],
              let jwt = responseObject["jwt"] as? String else {
            throw NSError(domain: "Invalid Response", code: 500, userInfo: nil)
        }
        return jwt
    }
}

