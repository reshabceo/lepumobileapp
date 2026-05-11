//
//  RecordingConfig.swift
//  AliveCorKitExample
//
//  Created by rex hsu on 9/30/24.
//  Copyright © 2024 AliveCor. All rights reserved.
//

import Foundation
import AliveCorKitLite

extension ACKDeviceType {
    var title: String {
        switch self {
        case .triangle:
            return "Triangle"
        case .mobile:
            return "Kardia Mobile"
        case .sakuraOne:
            return "Sakura One"
        case .band:
            return "Kardia Band"
        case .card:
            return "Kardia Card"
        case .unknown:
            return "Unknown"
        default:
            assertionFailure("Invalid deviceType: \(self)")
            return "???"
        }
    }
}

extension ACKLeadsConfig {
    var title: String {
        switch self {
        case .single:
            return "Single Lead"
        case .six:
            return "Six Leads"
        default:
            assertionFailure("Invalid leads config :\(self)")
            return "???"
        }
    }
}

extension ACKFilterType {
    var title: String {
        switch self {
        case .enhanced:
            return "Enhanced"
        case .original:
            return "Original"
        default:
            assertionFailure("Invalid filter type: \(self)")
            return "???"
        }
    }
}

extension ACKMainsFrequency {
    var title: String {
        switch self {
        case .frequency50Hz:
            return "50 Hz"
        case .frequency60Hz:
            return "60 Hz"
        default:
            assertionFailure("Invalid mains frequency: \(self)")
            return "???"
        }
    }
}


class RecordingConfig {
    static let shared = RecordingConfig()
    
    var deviceType: ACKDeviceType {
        get {
           return UserDefaultsHelper.shared.selectedRecordingDeviceType
        }
        set {
            UserDefaultsHelper.shared.selectedRecordingDeviceType = newValue
        }
    }
    
    var duration: Int {
        get {
            return UserDefaultsHelper.shared.selectedRecordingDuration
        }
        set {
            UserDefaultsHelper.shared.selectedRecordingDuration = newValue
        }
    }
    
    var leadsConfig: ACKLeadsConfig {
        get {
            return UserDefaultsHelper.shared.selectedRecordingLeadsConfig
        }
        set {
            UserDefaultsHelper.shared.selectedRecordingLeadsConfig = newValue
        }
    }
    
    var filter: ACKFilterType {
        get {
            return UserDefaultsHelper.shared.selectedRecordingFilter
        }
        set {
            UserDefaultsHelper.shared.selectedRecordingFilter = newValue
        }
    }
    
    var mainsFrequency: ACKMainsFrequency {
        get {
            return UserDefaultsHelper.shared.selectedMainsFrequency
        }
        
        set {
            UserDefaultsHelper.shared.selectedMainsFrequency = newValue
        }
    }
    
}
